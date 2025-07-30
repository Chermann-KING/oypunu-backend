import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../../auth/schemas/audit-log.schema';
import { IAuditLogRepository } from '../interfaces/audit-log.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

@Injectable()
export class AuditLogRepository implements IAuditLogRepository {
  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLogDocument>
  ) {}

  async create(auditLog: Partial<AuditLog>): Promise<AuditLog> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.auditLogModel(auditLog);
        return await created.save();
      },
      'AuditLog',
      'create'
    );
  }

  async findByUserId(userId: string, options: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<AuditLog[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 50, offset = 0, sortBy = 'timestamp', sortOrder = 'desc' } = options;
        const sortObject: any = {};
        sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

        return await this.auditLogModel
          .find({ userId })
          .sort(sortObject)
          .skip(offset)
          .limit(limit)
          .exec();
      },
      'AuditLog',
      `userId-${userId}`
    );
  }

  async findByAction(action: string, options: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<AuditLog[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 100, startDate, endDate } = options;
        const query: any = { action };

        if (startDate || endDate) {
          query.timestamp = {};
          if (startDate) query.timestamp.$gte = startDate;
          if (endDate) query.timestamp.$lte = endDate;
        }

        return await this.auditLogModel
          .find(query)
          .sort({ timestamp: -1 })
          .limit(limit)
          .exec();
      },
      'AuditLog',
      `action-${action}`
    );
  }

  async findByTimeRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.auditLogModel
          .find({
            timestamp: {
              $gte: startDate,
              $lte: endDate
            }
          })
          .sort({ timestamp: -1 })
          .exec();
      },
      'AuditLog',
      'timeRange'
    );
  }

  async findSuspiciousActivity(userId: string): Promise<AuditLog[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        // Trouve les activités suspectes : beaucoup d'actions dans la dernière heure
        return await this.auditLogModel
          .find({
            userId,
            timestamp: { $gte: oneHourAgo },
            action: { $in: ['login_failed', 'password_change', 'email_change'] }
          })
          .sort({ timestamp: -1 })
          .exec();
      },
      'AuditLog',
      `suspicious-${userId}`
    );
  }

  async deleteOldLogs(olderThanDays: number): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.auditLogModel.deleteMany({
          timestamp: { $lt: cutoffDate }
        }).exec();

        return result.deletedCount || 0;
      },
      'AuditLog',
      `cleanup-${olderThanDays}days`
    );
  }

  async countByUser(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.auditLogModel.countDocuments({ userId }).exec();
      },
      'AuditLog',
      `countUser-${userId}`
    );
  }

  async findByIpAddress(ipAddress: string): Promise<AuditLog[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.auditLogModel
          .find({ ipAddress })
          .sort({ timestamp: -1 })
          .limit(100)
          .exec();
      },
      'AuditLog',
      `ip-${ipAddress}`
    );
  }
}