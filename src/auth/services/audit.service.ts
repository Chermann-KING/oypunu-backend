import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
  AuditAction,
  AuditSeverity,
} from '../schemas/audit-log.schema';

export interface AuditContext {
  userId?: string;
  username?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestPath?: string;
  requestMethod?: string;
}

export interface AuditDetails {
  resource?: string;
  details?: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * 📊 Enregistre un événement d'audit
   */
  async logEvent(
    action: AuditAction,
    context: AuditContext,
    success: boolean = true,
    severity: AuditSeverity = AuditSeverity.LOW,
    auditDetails?: AuditDetails,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const startTime = Date.now();

      const auditLog = new this.auditLogModel({
        action,
        severity,
        userId: context.userId,
        username: context.username,
        userRole: context.userRole,
        ipAddress: context.ipAddress || 'unknown',
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        requestPath: context.requestPath,
        requestMethod: context.requestMethod,
        success,
        errorMessage,
        duration: Date.now() - startTime,
        ...auditDetails,
      });

      await auditLog.save();

      // Log console pour les événements critiques
      if (
        severity === AuditSeverity.CRITICAL ||
        severity === AuditSeverity.HIGH
      ) {
        this.logger.warn(
          `🚨 AUDIT ${severity.toUpperCase()}: ${action} by ${context.username || context.userId} (${context.ipAddress})`,
        );
      }
    } catch (error) {
      this.logger.error("Erreur lors de l'enregistrement de l'audit:", error);
      // Ne pas faire échouer l'opération principale si l'audit échoue
    }
  }

  /**
   * 🔐 Log des événements d'authentification
   */
  async logAuthEvent(
    action:
      | AuditAction.USER_LOGIN
      | AuditAction.USER_LOGOUT
      | AuditAction.USER_REGISTER
      | AuditAction.TOKEN_REFRESH,
    context: AuditContext,
    success: boolean = true,
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent(
      action,
      context,
      success,
      success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      { details },
      success ? undefined : "Échec d'authentification",
    );
  }

  /**
   * 👤 Log des modifications d'utilisateur
   */
  async logUserChange(
    action: AuditAction,
    context: AuditContext,
    targetUserId: string,
    beforeState?: any,
    afterState?: any,
  ): Promise<void> {
    await this.logEvent(action, context, true, AuditSeverity.MEDIUM, {
      resource: `user:${targetUserId}`,
      beforeState,
      afterState,
    });
  }

  /**
   * 🛡️ Log des violations de sécurité
   */
  async logSecurityViolation(
    context: AuditContext,
    violationType: string,
    details: Record<string, any>,
  ): Promise<void> {
    await this.logEvent(
      AuditAction.SECURITY_VIOLATION,
      context,
      false,
      AuditSeverity.CRITICAL,
      {
        details: {
          violationType,
          ...details,
        },
      },
      `Violation de sécurité: ${violationType}`,
    );
  }

  /**
   * 🚫 Log des refus de permission
   */
  async logPermissionDenied(
    context: AuditContext,
    resource: string,
    requiredRole: string,
  ): Promise<void> {
    await this.logEvent(
      AuditAction.PERMISSION_DENIED,
      context,
      false,
      AuditSeverity.HIGH,
      {
        resource,
        details: {
          requiredRole,
          userRole: context.userRole,
        },
      },
      `Accès refusé à ${resource}`,
    );
  }

  /**
   * 📝 Log des modifications de contenu
   */
  async logContentChange(
    action: AuditAction,
    context: AuditContext,
    resourceType: string,
    resourceId: string,
    beforeState?: any,
    afterState?: any,
  ): Promise<void> {
    await this.logEvent(action, context, true, AuditSeverity.LOW, {
      resource: `${resourceType}:${resourceId}`,
      beforeState,
      afterState,
    });
  }

  /**
   * 🔍 Recherche dans les logs d'audit
   */
  async searchLogs(
    filters: {
      userId?: string;
      action?: AuditAction;
      severity?: AuditSeverity;
      ipAddress?: string;
      dateFrom?: Date;
      dateTo?: Date;
      success?: boolean;
    },
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    logs: AuditLogDocument[];
    total: number;
    page: number;
    pages: number;
  }> {
    const query: any = {};

    // Construction de la requête
    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.severity) query.severity = filters.severity;
    if (filters.ipAddress) query.ipAddress = filters.ipAddress;
    if (filters.success !== undefined) query.success = filters.success;

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = filters.dateFrom;
      if (filters.dateTo) query.createdAt.$lte = filters.dateTo;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * 📊 Statistiques d'audit
   */
  async getAuditStats(dateFrom?: Date, dateTo?: Date): Promise<any> {
    const matchQuery: any = {};

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = dateFrom;
      if (dateTo) matchQuery.createdAt.$lte = dateTo;
    }

    const stats = await this.auditLogModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          successfulEvents: { $sum: { $cond: ['$success', 1, 0] } },
          failedEvents: { $sum: { $cond: ['$success', 0, 1] } },
          criticalEvents: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] },
          },
          highSeverityEvents: {
            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] },
          },
        },
      },
    ]);

    const actionStats = await this.auditLogModel.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return {
      summary: stats[0] || {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        criticalEvents: 0,
        highSeverityEvents: 0,
      },
      topActions: actionStats,
    };
  }

  /**
   * 🧹 Nettoyage des logs anciens (au-delà de la rétention)
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.auditLogModel.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    this.logger.log(`Nettoyage audit: ${result.deletedCount} logs supprimés`);
    return result.deletedCount;
  }
}
