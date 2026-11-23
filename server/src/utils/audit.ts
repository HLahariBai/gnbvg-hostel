import { prisma } from '../config/database.js';

export interface AuditLogParams {
  actorId?: string | null;
  actorRole: string;
  action: string;
  entityName: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousState?: unknown;
  newState?: unknown;
}

/**
 * Creates an immutable audit log record in PostgreSQL.
 * Used for tracking administrative, authentication, security, and exception events.
 */
export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId || null,
        actorRole: params.actorRole,
        action: params.action,
        entityName: params.entityName,
        entityId: params.entityId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        previousState: params.previousState ? JSON.stringify(params.previousState) : null,
        newState: params.newState ? JSON.stringify(params.newState) : null,
      },
    });
  } catch (error) {
    // Non-blocking error handling: Log failure but do not crash the primary operational transaction
    console.error('[AUDIT LOGGING FAILURE]:', error);
  }
}
