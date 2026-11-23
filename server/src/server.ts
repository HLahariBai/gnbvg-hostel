import http from 'http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { prisma, disconnectDatabase } from './config/database.js';
import { ensureCsrfCookie } from './middleware/csrf.js';
import { generalApiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocketServer } from './realtime/socket.js';

// Feature Routes
import authRoutes from './modules/auth/auth.routes.js';
import rbacRoutes from './modules/protected/rbac.routes.js';
import hostelRoutes from './modules/hostel/hostel.routes.js';
import biometricsRoutes from './modules/biometrics/biometrics.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import sosRoutes from './modules/sos/sos.routes.js';
import movementRoutes from './modules/movement/movement.routes.js';
import leaveRoutes from './modules/leave/leave.routes.js';
import safetyRoutes from './modules/safety/safety.routes.js';
import noticeVisitorRoutes from './modules/notice-visitor/noticeVisitor.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

// Local Persistent SQLite Database & API Routes
import { initSqliteDatabase, db } from './db/sqlite.js';
import sqliteAuthRoutes from './routes/sqliteAuth.routes.js';
import studentRoutes from './routes/student.routes.js';
import wardenRoutes from './routes/warden.routes.js';

const app = express();
const httpServer = http.createServer(app);

// Initialize Real-Time Engine (Socket.IO)
const io = initSocketServer(httpServer);

// 1. Helmet Production-Grade Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// 2. Cross-Origin Resource Sharing (CORS) with Explicit Whitelist
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        env.NODE_ENV !== 'production' ||
        env.CORS_ALLOWED_ORIGINS.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS Error: Origin ${origin} not permitted.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['Set-Cookie'],
  })
);

// 3. Body Parsing & Cookie Parser
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Ensure Anti-CSRF Token Cookie is set for all incoming requests
app.use(ensureCsrfCookie);

// 5. Health Check & Diagnostics Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'GNBVG Hostel Management Backend API',
    institution: 'G. Pulla Reddy Engineering College (GPREC), Kurnool',
    hostel: 'GNBVG (Arundhathi, Annapurna, Anuradha)',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    realtimeConnected: Boolean(io),
  });
});

app.get('/api/db-health', async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    res.status(200).json({
      status: 'connected',
      database: 'PostgreSQL',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DB HEALTH CHECK ERROR]:', error);
    res.status(503).json({
      status: 'disconnected',
      database: 'PostgreSQL',
      error: error instanceof Error ? error.message : 'Database connection error',
      timestamp: new Date().toISOString(),
    });
  }
});

// 6. Mount General API Rate Limiter and Feature Modules
app.use('/api', generalApiLimiter);

// Local Persistent SQLite Backend API Endpoints (Auth, Student Biometrics & Attendance, Warden Reports & Coordinates)
app.use('/api/auth', sqliteAuthRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/warden', wardenRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/protected', rbacRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/gate-pass', movementRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/notices', noticeVisitorRoutes);
app.use('/api/admin', adminRoutes);

// Serve static assets from client/public and client/dist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_PUBLIC = path.resolve(__dirname, '..', '..', 'client', 'public');
const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');

app.use(express.static(CLIENT_PUBLIC));
app.use(express.static(CLIENT_DIST));

app.get('/portal', (_req: Request, res: Response) => {
  res.sendFile(path.join(CLIENT_PUBLIC, 'hostel.html'));
});
app.get('/hostel', (_req: Request, res: Response) => {
  res.sendFile(path.join(CLIENT_PUBLIC, 'hostel.html'));
});

// Root fallback route
app.get('/', (_req: Request, res: Response) => {
  const hostelHtml = path.join(CLIENT_PUBLIC, 'hostel.html');
  if (fs.existsSync(hostelHtml)) {
    res.sendFile(hostelHtml);
    return;
  }
  res.status(200).json({
    name: 'GNBVG Hostel Safety, Attendance & Movement Management API',
    version: '1.0.0',
    portal: '/portal',
    documentation: '/api/docs',
    status: 'operational',
    modules: [
      'auth',
      'hostel',
      'biometrics',
      'attendance',
      'sos',
      'gate-pass',
      'leaves',
      'safety',
      'notices',
      'admin',
      'realtime',
    ],
  });
});

// 7. Centralized Global Error Handler (Must be registered after routes)
app.use(errorHandler);

// Initialize Local Persistent SQLite Database on startup
await initSqliteDatabase();

// Start Server Listener
httpServer.listen(env.PORT, () => {
  console.log(`[SERVER RUNNING] GNBVG API listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`[LOCAL SQLITE DB] Persistent database active with auto-migrated tables and seeded Warden & Blocks.`);
  console.log(`[REAL-TIME ENGINE] Socket.IO server active with role, student, and block channel isolation.`);
  console.log(`[AUTH HARDENING] Argon2id, AES-256-GCM, HMAC-SHA-256, TOTP, RBAC & CSRF Protection active.`);
});

// Graceful Termination Handlers
async function handleShutdown(signal: string) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing HTTP server, WebSockets and database pools...`);
  httpServer.close(async () => {
    try {
      try {
        db.close();
        console.log('[SHUTDOWN] SQLite database connection closed.');
      } catch {}
      await disconnectDatabase();
      console.log('[SHUTDOWN] Database connections closed. Process terminating cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN ERROR] Error while disconnecting database:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
export { httpServer, io };
