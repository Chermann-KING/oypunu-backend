import { AuditLog } from '../../auth/schemas/audit-log.schema';

export interface IAuditLogRepository {
  create(auditLog: Partial<AuditLog>): Promise<AuditLog>;
  findByUserId(userId: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<AuditLog[]>;
  findByAction(action: string, options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]>;
  findByTimeRange(startDate: Date, endDate: Date): Promise<AuditLog[]>;
  findSuspiciousActivity(userId: string): Promise<AuditLog[]>;
  deleteOldLogs(olderThanDays: number): Promise<number>;
  countByUser(userId: string): Promise<number>;
  findByIpAddress(ipAddress: string): Promise<AuditLog[]>;
}