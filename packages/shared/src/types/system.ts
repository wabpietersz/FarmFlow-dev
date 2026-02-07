export enum NotificationType {
  MortalityAlert = 'mortality_alert',
  FcrAlert = 'fcr_alert',
  LowFeed = 'low_feed',
  PaymentDue = 'payment_due',
  LeaveRequest = 'leave_request',
  PayrollReady = 'payroll_ready',
}

export type EntityType = 'employee' | 'batch' | 'sale' | 'payroll';

export interface SystemConfig {
  id: number;
  configKey: string;
  configValue: unknown;
  description?: string | null;
  updatedBy?: number | null;
  updatedAt: Date;
}

export interface Notification {
  id: number;
  userId: number;
  notificationType: NotificationType;
  entityType?: string | null;
  entityId?: number | null;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date | null;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  timestamp: Date;
}

export interface Document {
  id: number;
  entityType: EntityType;
  entityId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy?: number | null;
  createdAt: Date;
}
