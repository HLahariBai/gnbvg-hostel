import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// Declaration for global prisma instance in development to prevent connection exhaustion
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Production-ready PrismaClient singleton.
 * Configured with structured query logging in development/test
 * and error/warn telemetry in production.
 *
 * All ORM operations execute strictly parameterized SQL queries under the hood,
 * eliminating SQL injection vulnerabilities.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// In development, log parameterized query execution time for performance auditing
if (env.NODE_ENV === 'development') {
  // @ts-expect-error Prisma event typing for query logs
  prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
    // Exclude noise queries like heartbeat checks
    if (!e.query.includes('SELECT 1')) {
      console.log(`[DB QUERY ${e.duration}ms]: ${e.query}`);
    }
  });
}

/**
 * Gracefully disconnects the database connection during process shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
