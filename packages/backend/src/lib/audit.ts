import { db } from '../db';
import { auditLogs } from '../db/schema';
import logger from './logger';

interface AuditLogParams {
  userId?: number;
  action: string;
  entityType?: string;
  entityId?: number;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      changes: params.changes ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    logger.error('Failed to create audit log', { error, params });
  }
}
