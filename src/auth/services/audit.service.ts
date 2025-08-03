/**
 * @fileoverview Service d'audit et de traçabilité pour O'Ypunu
 * 
 * Ce service gère l'enregistrement, la recherche et l'analyse des événements
 * d'audit pour assurer la traçabilité, la conformité réglementaire et la
 * sécurité de la plateforme O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuditLog,
  AuditLogDocument,
  AuditAction,
  AuditSeverity,
} from '../schemas/audit-log.schema';

/**
 * Interface du contexte d'audit
 * 
 * @interface AuditContext
 */
export interface AuditContext {
  /** ID de l'utilisateur effectuant l'action */
  userId?: string;
  /** Nom d'utilisateur */
  username?: string;
  /** Rôle de l'utilisateur */
  userRole?: string;
  /** Adresse IP source */
  ipAddress?: string;
  /** User-Agent du navigateur */
  userAgent?: string;
  /** ID de session */
  sessionId?: string;
  /** Chemin de la requête */
  requestPath?: string;
  /** Méthode HTTP */
  requestMethod?: string;
}

/**
 * Interface des détails d'audit
 * 
 * @interface AuditDetails
 */
export interface AuditDetails {
  /** Ressource affectée */
  resource?: string;
  /** Détails spécifiques à l'action */
  details?: Record<string, any>;
  /** État avant modification */
  beforeState?: Record<string, any>;
  /** État après modification */
  afterState?: Record<string, any>;
  /** Métadonnées additionnelles */
  metadata?: Record<string, any>;
}

/**
 * Service d'audit et de traçabilité des événements système
 * 
 * Ce service centralise l'enregistrement et l'analyse de tous les événements
 * d'audit de la plateforme O'Ypunu pour assurer :
 * 
 * ## 📋 Fonctionnalités principales :
 * - **Logging événements** : Enregistrement automatique des actions
 * - **Recherche avancée** : Filtrage et pagination des logs
 * - **Statistiques** : Analyse et métriques d'audit
 * - **Nettoyage** : Gestion de la rétention des données
 * 
 * ## 🔐 Types d'événements trackés :
 * - **Authentification** : Login, logout, échecs
 * - **Autorisations** : Accès refusés, violations
 * - **Modifications** : CRUD utilisateurs, contenu
 * - **Sécurité** : Tentatives d'intrusion, anomalies
 * 
 * ## 📊 Niveaux de sévérité :
 * - **LOW** : Événements informatifs normaux
 * - **MEDIUM** : Événements nécessitant attention
 * - **HIGH** : Événements de sécurité importants
 * - **CRITICAL** : Événements critiques nécessitant intervention
 * 
 * @class AuditService
 * @version 1.0.0
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /**
   * Constructeur du service d'audit
   * 
   * @constructor
   * @param {Model<AuditLogDocument>} auditLogModel - Modèle Mongoose des logs d'audit
   */
  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Enregistre un événement d'audit dans le système
   * 
   * Méthode principale d'enregistrement qui persiste tous les événements
   * d'audit avec leur contexte complet et déclenche des alertes pour
   * les événements critiques.
   * 
   * @async
   * @method logEvent
   * @param {AuditAction} action - Type d'action auditée
   * @param {AuditContext} context - Contexte utilisateur et technique
   * @param {boolean} success - Indicateur de succès de l'opération
   * @param {AuditSeverity} severity - Niveau de sévérité de l'événement
   * @param {AuditDetails} auditDetails - Détails spécifiques à l'action
   * @param {string} errorMessage - Message d'erreur en cas d'échec
   * @returns {Promise<void>}
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
