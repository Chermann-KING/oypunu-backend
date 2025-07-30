import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { IPostCommentRepository } from "../../repositories/interfaces/post-comment.repository.interface";
import { DatabaseErrorHandler } from "../../common/utils/database-error-handler.util";

export interface ReportedContentOptions {
  page: number;
  limit: number;
  status: "pending" | "resolved" | "dismissed" | "all";
  type: "word" | "comment" | "user" | "all";
  severity?: "low" | "medium" | "high" | "critical";
}

export interface UserContributionsOptions {
  page: number;
  limit: number;
  status: "approved" | "pending" | "rejected" | "all";
}

export interface UserReportsOptions {
  page: number;
  limit: number;
  status: "pending" | "resolved" | "dismissed" | "all";
}

export interface ModerationReport {
  id: string;
  contentType: "word" | "comment" | "user";
  contentId: string;
  reason: string;
  description?: string;
  reportedBy: string;
  reportedAt: Date;
  status: "pending" | "resolved" | "dismissed";
  severity: "low" | "medium" | "high" | "critical";
  moderatorId?: string;
  resolvedAt?: Date;
  content: any;
}

export interface BulkModerationResult {
  success: boolean;
  processed: number;
  failed: number;
  results: Array<{
    wordId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface ModerationQueue {
  queue: Array<{
    id: string;
    type: string;
    contentId: string;
    priority: "low" | "medium" | "high" | "critical";
    reason: string;
    waitTime: number;
    content: any;
  }>;
  totalInQueue: number;
  averageWaitTime: number;
}

export interface ModerationStats {
  overview: {
    totalReports: number;
    pendingReports: number;
    resolvedReports: number;
    averageResolutionTime: number;
  };
  reportsByType: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  moderatorActivity: Array<{
    moderatorId: string;
    username: string;
    actionsCount: number;
    averageResponseTime: number;
  }>;
  trends: {
    reportsGrowth: number;
    resolutionRateImprovement: number;
    qualityScore: number;
  };
}

@Injectable()
export class ModerationService {
  // Simuler une base de données de signalements en mémoire pour cette démo
  private reports: Map<string, ModerationReport> = new Map();
  private reportCounter = 1;

  constructor(
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @Inject("IUserRepository") private userRepository: IUserRepository,
    @Inject("IPostCommentRepository") private commentRepository: IPostCommentRepository
  ) {}

  async getReportedContent(options: ReportedContentOptions): Promise<{
    reports: ModerationReport[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Filtrer les rapports selon les critères
        let filteredReports = Array.from(this.reports.values());

        if (options.status !== "all") {
          filteredReports = filteredReports.filter(
            (report) => report.status === options.status
          );
        }

        if (options.type !== "all") {
          filteredReports = filteredReports.filter(
            (report) => report.contentType === options.type
          );
        }

        if (options.severity) {
          filteredReports = filteredReports.filter(
            (report) => report.severity === options.severity
          );
        }

        // Pagination
        const total = filteredReports.length;
        const startIndex = (options.page - 1) * options.limit;
        const paginatedReports = filteredReports.slice(
          startIndex,
          startIndex + options.limit
        );

        // Enrichir avec le contenu réel
        const enrichedReports = await Promise.all(
          paginatedReports.map(async (report) => {
            let content = {};
            try {
              switch (report.contentType) {
                case "word":
                  content = await this.wordRepository.findById(
                    report.contentId
                  );
                  break;
                case "user":
                  content = await this.userRepository.findById(
                    report.contentId
                  );
                  break;
                case "comment":
                  content = await this.commentRepository.findById(
                    report.contentId
                  );
                  break;
              }
            } catch (error) {
              content = { error: "Content not found" };
            }

            return {
              ...report,
              content,
            };
          })
        );

        return {
          reports: enrichedReports,
          total,
          page: options.page,
          limit: options.limit,
          totalPages: Math.ceil(total / options.limit),
        };
      },
      "Moderation",
      "reported-content"
    );
  }

  async flagContent(
    contentType: "word" | "comment" | "user",
    contentId: string,
    reason:
      | "inappropriate"
      | "spam"
      | "incorrect"
      | "offensive"
      | "copyright"
      | "other",
    reportedBy: string,
    description?: string,
    category?: string
  ): Promise<{ success: boolean; reportId: string; message: string }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le contenu existe
        let contentExists = false;
        try {
          switch (contentType) {
            case "word":
              contentExists = !!(await this.wordRepository.findById(contentId));
              break;
            case "user":
              contentExists = !!(await this.userRepository.findById(contentId));
              break;
            case "comment":
              contentExists =
                !!(await this.commentRepository.findById(contentId));
              break;
          }
        } catch (error) {
          throw new NotFoundException(`${contentType} not found`);
        }

        if (!contentExists) {
          throw new NotFoundException(`${contentType} not found`);
        }

        // Vérifier si l'utilisateur n'a pas déjà signalé ce contenu
        const existingReport = Array.from(this.reports.values()).find(
          (report) =>
            report.contentType === contentType &&
            report.contentId === contentId &&
            report.reportedBy === reportedBy &&
            report.status === "pending"
        );

        if (existingReport) {
          throw new BadRequestException(
            "You have already reported this content"
          );
        }

        // Déterminer la gravité automatiquement
        const severity = this.calculateSeverity(reason, description);

        // Créer le signalement
        const reportId = `report_${this.reportCounter++}`;
        const report: ModerationReport = {
          id: reportId,
          contentType,
          contentId,
          reason,
          description,
          reportedBy,
          reportedAt: new Date(),
          status: "pending",
          severity,
          content: {},
        };

        this.reports.set(reportId, report);

        // Envoyer une notification aux modérateurs selon la gravité
        await this.notifyModerators(reportId, severity, contentType, reason);

        return {
          success: true,
          reportId,
          message:
            "Content reported successfully. Our moderation team will review it shortly.",
        };
      },
      "Moderation",
      contentId
    );
  }

  async bulkModerationAction(
    wordIds: string[],
    action: "approve" | "reject",
    moderatorId: string,
    reason?: string,
    notes?: string
  ): Promise<BulkModerationResult> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const results: Array<{
          wordId: string;
          success: boolean;
          error?: string;
        }> = [];

        let processed = 0;
        let failed = 0;

        for (const wordId of wordIds) {
          try {
            // Vérifier que le mot existe
            const word = await this.wordRepository.findById(wordId);
            if (!word) {
              results.push({
                wordId,
                success: false,
                error: "Word not found",
              });
              failed++;
              continue;
            }

            // Effectuer l'action de modération
            const status = action === "approve" ? "approved" : "rejected";
            await this.wordRepository.updateStatus(wordId, status, moderatorId);

            // Enregistrer l'action de modération
            await this.logModerationAction(
              `bulk_${action}`,
              "word",
              wordId,
              moderatorId,
              reason,
              { notes, bulkAction: true }
            );

            // Notifier l'auteur du mot
            if ((word as any).createdBy) {
              await this.notifyContentAuthor(
                (word as any).createdBy,
                action === "approve" ? "approved" : "rejected",
                "word",
                reason
              );
            }

            results.push({
              wordId,
              success: true,
            });
            processed++;
          } catch (error) {
            results.push({
              wordId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            failed++;
          }
        }

        return {
          success: processed > 0,
          processed,
          failed,
          results,
        };
      },
      "Moderation",
      moderatorId
    );
  }

  async getUserContributions(
    userId: string,
    options: UserContributionsOptions
  ): Promise<{
    user: any;
    contributions: any[];
    stats: {
      approved: number;
      pending: number;
      rejected: number;
      successRate: number;
    };
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Récupérer les informations utilisateur
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new NotFoundException("User not found");
        }

        // Récupérer les contributions de l'utilisateur
        const offset = (options.page - 1) * options.limit;
        const contributions = await this.wordRepository.findByUserId(userId, {
          limit: options.limit,
          offset,
          status: options.status !== "all" ? options.status : undefined,
        });

        // Pour les statistiques, utiliser des méthodes simplifiées
        const totalContributions = contributions.length;

        return {
          user: {
            id: userId,
            username: user.username,
            role: user.role,
            joinDate: (user as any).createdAt || new Date(),
            totalContributions,
          },
          contributions: contributions.map((word) => ({
            id: (word as any)._id,
            type: "word",
            content: {
              word: word.word,
              language: word.language,
              meanings: word.meanings,
            },
            status: word.status,
            createdAt: (word as any).createdAt,
            moderation: {
              reviewedBy: (word as any).reviewedBy || null,
              reviewedAt: (word as any).reviewedAt || null,
              rejectionReason: (word as any).rejectionReason || null,
              qualityScore: (word as any).qualityScore || 0,
              flagCount: (word as any).flagCount || 0,
            },
          })),
          stats: {
            approved: contributions.filter((w) => w.status === "approved")
              .length,
            pending: contributions.filter((w) => w.status === "pending").length,
            rejected: contributions.filter((w) => w.status === "rejected")
              .length,
            successRate:
              totalContributions > 0
                ? Math.round(
                    (contributions.filter((w) => w.status === "approved")
                      .length /
                      totalContributions) *
                      100 *
                      100
                  ) / 100
                : 0,
          },
          total: totalContributions,
          page: options.page,
          limit: options.limit,
        };
      },
      "Moderation",
      userId
    );
  }

  async handleReport(
    reportId: string,
    action: "approve" | "reject" | "edit" | "delete" | "warn_user",
    moderatorId: string,
    reason?: string,
    notes?: string,
    newStatus?: "approved" | "rejected" | "pending"
  ): Promise<{
    success: boolean;
    report: ModerationReport;
    actionTaken: string;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const report = this.reports.get(reportId);
        if (!report) {
          throw new NotFoundException("Report not found");
        }

        // Effectuer l'action sur le contenu signalé
        let actionTaken = "";
        try {
          switch (report.contentType) {
            case "word":
              switch (action) {
                case "approve":
                  await this.wordRepository.updateStatus(
                    report.contentId,
                    "approved",
                    moderatorId
                  );
                  actionTaken = "Word approved";
                  break;
                case "reject":
                  await this.wordRepository.updateStatus(
                    report.contentId,
                    "rejected",
                    moderatorId
                  );
                  actionTaken = "Word rejected";
                  break;
                case "delete":
                  await this.wordRepository.delete(report.contentId);
                  actionTaken = "Word deleted";
                  break;
                case "edit":
                  // Pour l'instant, marquer comme nécessitant une révision
                  await this.wordRepository.updateStatus(
                    report.contentId,
                    "pending",
                    moderatorId
                  );
                  actionTaken = "Word marked for revision";
                  break;
              }
              break;
            case "user":
              switch (action) {
                case "warn_user":
                  await this.warnUser(
                    report.contentId,
                    moderatorId,
                    reason || notes
                  );
                  actionTaken = "User warned";
                  break;
              }
              break;
          }

          // Marquer le signalement comme résolu
          report.status = "resolved";
          report.moderatorId = moderatorId;
          report.resolvedAt = new Date();
          this.reports.set(reportId, report);

          return {
            success: true,
            report,
            actionTaken,
          };
        } catch (error) {
          throw new BadRequestException(
            `Failed to handle report: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      },
      "Moderation",
      reportId,
      moderatorId
    );
  }

  async getModerationQueue(
    limit: number,
    type: "high_priority" | "reported" | "auto_flagged" | "pending_review"
  ): Promise<ModerationQueue> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let queueItems: any[] = [];

        switch (type) {
          case "high_priority":
            // Signalements critiques et élevés
            queueItems = Array.from(this.reports.values())
              .filter(
                (report) =>
                  report.status === "pending" &&
                  (report.severity === "high" || report.severity === "critical")
              )
              .slice(0, limit);
            break;
          case "reported":
            // Tous les signalements en attente
            queueItems = Array.from(this.reports.values())
              .filter((report) => report.status === "pending")
              .slice(0, limit);
            break;
          case "pending_review":
            // Mots en attente d'approbation
            const pendingWords = await this.wordRepository.findAll({
              page: 1,
              limit,
              status: "pending",
            });
            queueItems = pendingWords.words;
            break;
        }

        const queue = queueItems.map((item) => ({
          id: item.id || item._id,
          type: item.contentType || "word",
          contentId: item.contentId || item._id,
          priority: item.severity || "medium",
          reason: item.reason || "Pending review",
          waitTime: item.reportedAt
            ? Math.floor(
                (Date.now() - item.reportedAt.getTime()) / (1000 * 60 * 60)
              )
            : 0,
          content: item.content || item,
        }));

        const totalInQueue = Array.from(this.reports.values()).filter(
          (r) => r.status === "pending"
        ).length;
        const averageWaitTime =
          queue.length > 0
            ? queue.reduce((sum, item) => sum + item.waitTime, 0) / queue.length
            : 0;

        return {
          queue,
          totalInQueue,
          averageWaitTime: Math.round(averageWaitTime * 100) / 100,
        };
      },
      "Moderation",
      "queue"
    );
  }

  async getModerationStats(
    timeframe: "day" | "week" | "month" | "quarter"
  ): Promise<ModerationStats> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        let startDate: Date;

        switch (timeframe) {
          case "day":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "quarter":
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }

        const reports = Array.from(this.reports.values()).filter(
          (report) => report.reportedAt >= startDate
        );

        const totalReports = reports.length;
        const pendingReports = reports.filter(
          (r) => r.status === "pending"
        ).length;
        const resolvedReports = reports.filter(
          (r) => r.status === "resolved"
        ).length;

        // Calculer le temps moyen de résolution
        const resolvedWithTime = reports.filter(
          (r) => r.status === "resolved" && r.resolvedAt
        );
        const averageResolutionTime =
          resolvedWithTime.length > 0
            ? resolvedWithTime.reduce(
                (sum, report) =>
                  sum +
                  (report.resolvedAt!.getTime() - report.reportedAt.getTime()),
                0
              ) /
              (resolvedWithTime.length * 1000 * 60 * 60)
            : 0; // en heures

        // Statistiques par type
        const reportsByType = [
          "inappropriate",
          "spam",
          "incorrect",
          "offensive",
          "copyright",
          "other",
        ].map((type) => {
          const count = reports.filter((r) => r.reason === type).length;
          return {
            type,
            count,
            percentage:
              totalReports > 0
                ? Math.round((count / totalReports) * 100 * 100) / 100
                : 0,
          };
        });

        // Calculer les statistiques d'activité des modérateurs
        const moderatorActivity = await this.calculateModeratorActivity(
          reports,
          startDate
        );

        return {
          overview: {
            totalReports,
            pendingReports,
            resolvedReports,
            averageResolutionTime:
              Math.round(averageResolutionTime * 100) / 100,
          },
          reportsByType,
          moderatorActivity,
          trends: await this.calculateTrends(
            timeframe,
            reports,
            resolvedReports,
            totalReports
          ),
        };
      },
      "Moderation",
      "stats"
    );
  }

  async configureAutoModeration(
    config: any,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Valider la configuration
        const validatedConfig = await this.validateModerationConfig(config);

        // Sauvegarder la configuration
        const configEntry = {
          config: validatedConfig,
          updatedBy: adminId,
          updatedAt: new Date(),
          version: this.generateConfigVersion(),
          isActive: true,
        };

        console.log("📋 Auto-moderation config updated:", {
          adminId,
          version: configEntry.version,
          rules: Object.keys(validatedConfig),
        });

        // Log de l'action administrative
        await this.logModerationAction(
          "update_auto_moderation_config",
          "system",
          "auto-moderation",
          adminId,
          "Configuration updated",
          {
            configVersion: configEntry.version,
            rulesCount: Object.keys(validatedConfig).length,
          }
        );

        // TODO: Sauvegarder dans une vraie base de données de configuration
        // await this.moderationConfigRepository.create(configEntry);

        return {
          success: true,
          message: `Auto-moderation configuration updated successfully (version ${configEntry.version})`,
        };
      },
      "Moderation",
      "config",
      adminId
    );
  }

  private async validateModerationConfig(config: any): Promise<any> {
    // Règles de validation de base
    const defaultConfig = {
      autoApprove: {
        enabled: false,
        thresholds: {
          minWords: 2,
          maxWords: 100,
          qualityScore: 80,
        },
      },
      autoReject: {
        enabled: true,
        rules: {
          spam: true,
          offensive: true,
          duplicate: true,
        },
      },
      flagging: {
        autoFlag: true,
        thresholds: {
          reportCount: 3,
          severityEscalation: "medium",
        },
      },
      notifications: {
        urgentAlerts: true,
        dailyDigest: true,
        slackIntegration: false,
      },
    };

    // Fusionner avec la configuration par défaut
    return { ...defaultConfig, ...config };
  }

  private generateConfigVersion(): string {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[-:]/g, "");
    return `v${timestamp}`;
  }

  async getUserReports(
    userId: string,
    options: UserReportsOptions
  ): Promise<{
    reports: ModerationReport[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let userReports = Array.from(this.reports.values()).filter(
          (report) => report.reportedBy === userId
        );

        if (options.status !== "all") {
          userReports = userReports.filter(
            (report) => report.status === options.status
          );
        }

        const total = userReports.length;
        const startIndex = (options.page - 1) * options.limit;
        const paginatedReports = userReports.slice(
          startIndex,
          startIndex + options.limit
        );

        return {
          reports: paginatedReports,
          total,
          page: options.page,
          limit: options.limit,
        };
      },
      "Moderation",
      userId
    );
  }

  // ========== MÉTHODES DE NOTIFICATION ==========

  private async notifyModerators(
    reportId: string,
    severity: "low" | "medium" | "high" | "critical",
    contentType: string,
    reason: string
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // TODO: Récupérer les modérateurs actifs avec une vraie méthode
        // const moderators = await this.userRepository.findByRole("moderator");
        const moderators = []; // Temporaire jusqu'à implémentation complète

        // Pour les urgences, notifier immédiatement
        if (severity === "high" || severity === "critical") {
          console.log(
            `🚨 URGENT: ${severity.toUpperCase()} report ${reportId}`,
            {
              contentType,
              reason,
              moderators: moderators.length,
            }
          );

          // TODO: Intégrer avec un service de notification réel (email, SMS, Slack, etc.)
          // await this.notificationService.sendUrgentAlert(moderators, {
          //   reportId, severity, contentType, reason
          // });
        } else {
          console.log(
            `📋 New ${severity} report ${reportId} for moderation queue`
          );
        }
      },
      "Moderation",
      `notify-${reportId}`
    );
  }

  private async logModerationAction(
    action: string,
    targetType: string,
    targetId: string,
    moderatorId: string,
    reason?: string,
    metadata?: any
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const logEntry = {
          action,
          targetType,
          targetId,
          moderatorId,
          reason,
          metadata,
          timestamp: new Date(),
        };

        console.log("📝 Moderation action logged:", logEntry);

        // TODO: Sauvegarder dans une vraie base de données de logs
        // await this.moderationLogRepository.create(logEntry);
      },
      "Moderation",
      `log-${targetId}`
    );
  }

  private async notifyContentAuthor(
    authorId: string,
    action: string,
    contentType: string,
    reason?: string
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const notification = {
          userId: authorId,
          type: "moderation_action",
          title: `Your ${contentType} has been ${action}`,
          message: reason
            ? `Reason: ${reason}`
            : `Your ${contentType} has been ${action} by our moderation team.`,
          timestamp: new Date(),
        };

        console.log("📬 Author notification:", notification);

        // TODO: Intégrer avec le service de notifications utilisateur
        // await this.userNotificationService.create(notification);
      },
      "Moderation",
      `notify-author-${authorId}`
    );
  }

  private async warnUser(
    userId: string,
    moderatorId: string,
    reason: string
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const warning = {
          userId,
          moderatorId,
          reason,
          level: "warning", // warning, suspension, ban
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
        };

        console.log("⚠️ User warning issued:", warning);

        // Log de l'action
        await this.logModerationAction(
          "warn_user",
          "user",
          userId,
          moderatorId,
          reason
        );

        // Notifier l'utilisateur
        await this.notifyContentAuthor(userId, "warned", "account", reason);

        // TODO: Sauvegarder dans une vraie base de données d'avertissements
        // await this.userWarningRepository.create(warning);
      },
      "Moderation",
      `warn-${userId}`
    );
  }

  private async calculateModeratorActivity(
    reports: ModerationReport[],
    startDate: Date
  ): Promise<
    Array<{
      moderatorId: string;
      username: string;
      actionsCount: number;
      averageResponseTime: number;
    }>
  > {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Grouper par modérateur
        const moderatorStats = new Map<
          string,
          {
            actionsCount: number;
            totalResponseTime: number;
            username: string;
          }
        >();

        const resolvedReports = reports.filter(
          (r) => r.status === "resolved" && r.moderatorId
        );

        for (const report of resolvedReports) {
          if (!report.moderatorId || !report.resolvedAt) continue;

          const responseTime =
            (report.resolvedAt.getTime() - report.reportedAt.getTime()) /
            (1000 * 60 * 60); // en heures

          if (!moderatorStats.has(report.moderatorId)) {
            // Récupérer le nom d'utilisateur du modérateur
            let username = "Unknown";
            try {
              const moderator = await this.userRepository.findById(
                report.moderatorId
              );
              username = moderator?.username || "Unknown";
            } catch (error) {
              console.warn(`Could not fetch moderator ${report.moderatorId}`);
            }

            moderatorStats.set(report.moderatorId, {
              actionsCount: 0,
              totalResponseTime: 0,
              username,
            });
          }

          const stats = moderatorStats.get(report.moderatorId)!;
          stats.actionsCount++;
          stats.totalResponseTime += responseTime;
        }

        // Convertir en tableau avec moyennes
        return Array.from(moderatorStats.entries())
          .map(([moderatorId, stats]) => ({
            moderatorId,
            username: stats.username,
            actionsCount: stats.actionsCount,
            averageResponseTime:
              stats.actionsCount > 0
                ? Math.round(
                    (stats.totalResponseTime / stats.actionsCount) * 100
                  ) / 100
                : 0,
          }))
          .sort((a, b) => b.actionsCount - a.actionsCount);
      },
      "Moderation",
      "moderator-activity"
    );
  }

  private async calculateTrends(
    timeframe: "day" | "week" | "month" | "quarter",
    currentReports: ModerationReport[],
    currentResolved: number,
    currentTotal: number
  ): Promise<{
    reportsGrowth: number;
    resolutionRateImprovement: number;
    qualityScore: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Calculer la période précédente pour comparaison
        const now = new Date();
        let previousStartDate: Date;
        let periodDays: number;

        switch (timeframe) {
          case "day":
            previousStartDate = new Date(
              now.getTime() - 2 * 24 * 60 * 60 * 1000
            );
            periodDays = 1;
            break;
          case "week":
            previousStartDate = new Date(
              now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000
            );
            periodDays = 7;
            break;
          case "month":
            previousStartDate = new Date(
              now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000
            );
            periodDays = 30;
            break;
          case "quarter":
            previousStartDate = new Date(
              now.getTime() - 2 * 90 * 24 * 60 * 60 * 1000
            );
            periodDays = 90;
            break;
        }

        const previousEndDate = new Date(
          now.getTime() - periodDays * 24 * 60 * 60 * 1000
        );

        // Récupérer les rapports de la période précédente
        const previousReports = Array.from(this.reports.values()).filter(
          (report) =>
            report.reportedAt >= previousStartDate &&
            report.reportedAt <= previousEndDate
        );

        const previousTotal = previousReports.length;
        const previousResolved = previousReports.filter(
          (r) => r.status === "resolved"
        ).length;

        // Calculer la croissance des signalements
        const reportsGrowth =
          previousTotal > 0
            ? Math.round(
                ((currentTotal - previousTotal) / previousTotal) * 100 * 100
              ) / 100
            : currentTotal > 0
              ? 100
              : 0;

        // Calculer l'amélioration du taux de résolution
        const currentResolutionRate =
          currentTotal > 0 ? (currentResolved / currentTotal) * 100 : 0;
        const previousResolutionRate =
          previousTotal > 0 ? (previousResolved / previousTotal) * 100 : 0;
        const resolutionRateImprovement =
          Math.round((currentResolutionRate - previousResolutionRate) * 100) /
          100;

        // Calculer le score de qualité basé sur plusieurs métriques
        const avgResolutionTime =
          this.calculateAverageResolutionTime(currentReports);
        const severityDistribution =
          this.calculateSeverityDistribution(currentReports);

        // Score de qualité composite (0-100)
        let qualityScore = 85; // Score de base

        // Ajustements basés sur les métriques
        if (avgResolutionTime < 2)
          qualityScore += 10; // Résolution rapide
        else if (avgResolutionTime > 24) qualityScore -= 15; // Résolution lente

        if (severityDistribution.critical < 5) qualityScore += 5; // Peu de problèmes critiques
        if (currentResolutionRate > 90)
          qualityScore += 5; // Bon taux de résolution
        else if (currentResolutionRate < 70) qualityScore -= 10; // Mauvais taux

        qualityScore = Math.max(0, Math.min(100, qualityScore)); // Limiter entre 0-100

        return {
          reportsGrowth,
          resolutionRateImprovement,
          qualityScore: Math.round(qualityScore * 100) / 100,
        };
      },
      "Moderation",
      "trends"
    );
  }

  private calculateAverageResolutionTime(reports: ModerationReport[]): number {
    const resolvedReports = reports.filter(
      (r) => r.status === "resolved" && r.resolvedAt
    );
    if (resolvedReports.length === 0) return 0;

    const totalTime = resolvedReports.reduce((sum, report) => {
      return sum + (report.resolvedAt!.getTime() - report.reportedAt.getTime());
    }, 0);

    return totalTime / (resolvedReports.length * 1000 * 60 * 60); // en heures
  }

  private calculateSeverityDistribution(reports: ModerationReport[]): {
    low: number;
    medium: number;
    high: number;
    critical: number;
  } {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    const total = reports.length;

    reports.forEach((report) => {
      distribution[report.severity]++;
    });

    // Convertir en pourcentages
    Object.keys(distribution).forEach((key) => {
      distribution[key as keyof typeof distribution] =
        total > 0
          ? Math.round(
              (distribution[key as keyof typeof distribution] / total) *
                100 *
                100
            ) / 100
          : 0;
    });

    return distribution;
  }

  private calculateSeverity(
    reason: string,
    description?: string
  ): "low" | "medium" | "high" | "critical" {
    // Logique simple de détermination de gravité
    const criticalReasons = ["offensive", "copyright"];
    const highReasons = ["inappropriate"];
    const mediumReasons = ["spam", "incorrect"];

    if (criticalReasons.includes(reason)) {
      return "critical";
    }
    if (highReasons.includes(reason)) {
      return "high";
    }
    if (mediumReasons.includes(reason)) {
      return "medium";
    }

    // Analyser la description pour des mots-clés critiques
    if (description) {
      const criticalKeywords = ["hate", "violence", "illegal", "harassment"];
      if (
        criticalKeywords.some((keyword) =>
          description.toLowerCase().includes(keyword)
        )
      ) {
        return "critical";
      }
    }

    return "low";
  }
}
