import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { IWordRepository } from '../../repositories/interfaces/word.repository.interface';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

export interface ReportedContentOptions {
  page: number;
  limit: number;
  status: 'pending' | 'resolved' | 'dismissed' | 'all';
  type: 'word' | 'comment' | 'user' | 'all';
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface UserContributionsOptions {
  page: number;
  limit: number;
  status: 'approved' | 'pending' | 'rejected' | 'all';
}

export interface UserReportsOptions {
  page: number;
  limit: number;
  status: 'pending' | 'resolved' | 'dismissed' | 'all';
}

export interface ModerationReport {
  id: string;
  contentType: 'word' | 'comment' | 'user';
  contentId: string;
  reason: string;
  description?: string;
  reportedBy: string;
  reportedAt: Date;
  status: 'pending' | 'resolved' | 'dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
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
    priority: 'low' | 'medium' | 'high' | 'critical';
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
    @Inject('IWordRepository') private wordRepository: IWordRepository,
    @Inject('IUserRepository') private userRepository: IUserRepository,
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

        if (options.status !== 'all') {
          filteredReports = filteredReports.filter(report => report.status === options.status);
        }

        if (options.type !== 'all') {
          filteredReports = filteredReports.filter(report => report.contentType === options.type);
        }

        if (options.severity) {
          filteredReports = filteredReports.filter(report => report.severity === options.severity);
        }

        // Pagination
        const total = filteredReports.length;
        const startIndex = (options.page - 1) * options.limit;
        const paginatedReports = filteredReports.slice(startIndex, startIndex + options.limit);

        // Enrichir avec le contenu réel
        const enrichedReports = await Promise.all(
          paginatedReports.map(async (report) => {
            let content = {};
            try {
              switch (report.contentType) {
                case 'word':
                  content = await this.wordRepository.findById(report.contentId);
                  break;
                case 'user':
                  content = await this.userRepository.findById(report.contentId);
                  break;
                // TODO: Implémenter pour les commentaires
              }
            } catch (error) {
              content = { error: 'Content not found' };
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
      'Moderation',
      'reported-content',
    );
  }

  async flagContent(
    contentType: 'word' | 'comment' | 'user',
    contentId: string,
    reason: 'inappropriate' | 'spam' | 'incorrect' | 'offensive' | 'copyright' | 'other',
    reportedBy: string,
    description?: string,
    category?: string,
  ): Promise<{ success: boolean; reportId: string; message: string }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le contenu existe
        let contentExists = false;
        try {
          switch (contentType) {
            case 'word':
              contentExists = !!(await this.wordRepository.findById(contentId));
              break;
            case 'user':
              contentExists = !!(await this.userRepository.findById(contentId));
              break;
            // TODO: Implémenter pour les commentaires
          }
        } catch (error) {
          throw new NotFoundException(`${contentType} not found`);
        }

        if (!contentExists) {
          throw new NotFoundException(`${contentType} not found`);
        }

        // Vérifier si l'utilisateur n'a pas déjà signalé ce contenu
        const existingReport = Array.from(this.reports.values()).find(
          report => 
            report.contentType === contentType && 
            report.contentId === contentId && 
            report.reportedBy === reportedBy &&
            report.status === 'pending'
        );

        if (existingReport) {
          throw new BadRequestException('You have already reported this content');
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
          status: 'pending',
          severity,
          content: {},
        };

        this.reports.set(reportId, report);

        // TODO: Envoyer une notification aux modérateurs si la gravité est élevée
        if (severity === 'high' || severity === 'critical') {
          // Logique de notification urgente
        }

        return {
          success: true,
          reportId,
          message: 'Content reported successfully. Our moderation team will review it shortly.',
        };
      },
      'Moderation',
      contentId,
    );
  }

  async bulkModerationAction(
    wordIds: string[],
    action: 'approve' | 'reject',
    moderatorId: string,
    reason?: string,
    notes?: string,
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
                error: 'Word not found',
              });
              failed++;
              continue;
            }

            // Effectuer l'action de modération
            const status = action === 'approve' ? 'approved' : 'rejected';
            await this.wordRepository.updateStatus(wordId, status, moderatorId);

            // TODO: Enregistrer l'action de modération dans un log
            // TODO: Envoyer une notification à l'auteur du mot

            results.push({
              wordId,
              success: true,
            });
            processed++;

          } catch (error) {
            results.push({
              wordId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
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
      'Moderation',
      moderatorId,
    );
  }

  async getUserContributions(userId: string, options: UserContributionsOptions): Promise<{
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
          throw new NotFoundException('User not found');
        }

        // Récupérer les contributions de l'utilisateur
        const contributions = await this.wordRepository.findByUser(userId, {
          page: options.page,
          limit: options.limit,
          status: options.status,
          includeRevisions: true,
        });

        // Calculer les statistiques
        const [approved, pending, rejected] = await Promise.all([
          this.wordRepository.countByUserAndStatus(userId, 'approved'),
          this.wordRepository.countByUserAndStatus(userId, 'pending'),
          this.wordRepository.countByUserAndStatus(userId, 'rejected'),
        ]);

        const total = approved + pending + rejected;
        const successRate = total > 0 ? Math.round((approved / total) * 100 * 100) / 100 : 0;

        return {
          user: {
            id: userId,
            username: user.username,
            role: user.role,
            joinDate: user.createdAt,
            totalContributions: total,
          },
          contributions: contributions.words.map(word => ({
            id: word._id,
            type: 'word',
            content: {
              word: word.word,
              language: word.language,
              meanings: word.meanings,
            },
            status: word.status,
            createdAt: word.createdAt,
            // TODO: Ajouter les informations de modération
          })),
          stats: {
            approved,
            pending,
            rejected,
            successRate,
          },
          total: contributions.total,
          page: options.page,
          limit: options.limit,
        };
      },
      'Moderation',
      userId,
    );
  }

  async handleReport(
    reportId: string,
    action: 'approve' | 'reject' | 'edit' | 'delete' | 'warn_user',
    moderatorId: string,
    reason?: string,
    notes?: string,
    newStatus?: 'approved' | 'rejected' | 'pending',
  ): Promise<{ success: boolean; report: ModerationReport; actionTaken: string }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const report = this.reports.get(reportId);
        if (!report) {
          throw new NotFoundException('Report not found');
        }

        // Effectuer l'action sur le contenu signalé
        let actionTaken = '';
        try {
          switch (report.contentType) {
            case 'word':
              switch (action) {
                case 'approve':
                  await this.wordRepository.updateStatus(report.contentId, 'approved', moderatorId);
                  actionTaken = 'Word approved';
                  break;
                case 'reject':
                  await this.wordRepository.updateStatus(report.contentId, 'rejected', moderatorId);
                  actionTaken = 'Word rejected';
                  break;
                case 'delete':
                  await this.wordRepository.delete(report.contentId);
                  actionTaken = 'Word deleted';
                  break;
                // TODO: Implémenter les autres actions
              }
              break;
            case 'user':
              switch (action) {
                case 'warn_user':
                  // TODO: Implémenter le système d'avertissement
                  actionTaken = 'User warned';
                  break;
                // TODO: Implémenter les autres actions utilisateur
              }
              break;
          }

          // Marquer le signalement comme résolu
          report.status = 'resolved';
          report.moderatorId = moderatorId;
          report.resolvedAt = new Date();
          this.reports.set(reportId, report);

          return {
            success: true,
            report,
            actionTaken,
          };

        } catch (error) {
          throw new BadRequestException(`Failed to handle report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      'Moderation',
      reportId,
      moderatorId,
    );
  }

  async getModerationQueue(
    limit: number,
    type: 'high_priority' | 'reported' | 'auto_flagged' | 'pending_review',
  ): Promise<ModerationQueue> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let queueItems: any[] = [];

        switch (type) {
          case 'high_priority':
            // Signalements critiques et élevés
            queueItems = Array.from(this.reports.values())
              .filter(report => report.status === 'pending' && (report.severity === 'high' || report.severity === 'critical'))
              .slice(0, limit);
            break;
          case 'reported':
            // Tous les signalements en attente
            queueItems = Array.from(this.reports.values())
              .filter(report => report.status === 'pending')
              .slice(0, limit);
            break;
          case 'pending_review':
            // Mots en attente d'approbation
            const pendingWords = await this.wordRepository.findAll({
              page: 1,
              limit,
              status: 'pending',
            });
            queueItems = pendingWords.words;
            break;
        }

        const queue = queueItems.map(item => ({
          id: item.id || item._id,
          type: item.contentType || 'word',
          contentId: item.contentId || item._id,
          priority: item.severity || 'medium',
          reason: item.reason || 'Pending review',
          waitTime: item.reportedAt ? Math.floor((Date.now() - item.reportedAt.getTime()) / (1000 * 60 * 60)) : 0,
          content: item.content || item,
        }));

        const totalInQueue = Array.from(this.reports.values()).filter(r => r.status === 'pending').length;
        const averageWaitTime = queue.length > 0 ? 
          queue.reduce((sum, item) => sum + item.waitTime, 0) / queue.length : 0;

        return {
          queue,
          totalInQueue,
          averageWaitTime: Math.round(averageWaitTime * 100) / 100,
        };
      },
      'Moderation',
      'queue',
    );
  }

  async getModerationStats(timeframe: 'day' | 'week' | 'month' | 'quarter'): Promise<ModerationStats> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        let startDate: Date;

        switch (timeframe) {
          case 'day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'quarter':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }

        const reports = Array.from(this.reports.values())
          .filter(report => report.reportedAt >= startDate);

        const totalReports = reports.length;
        const pendingReports = reports.filter(r => r.status === 'pending').length;
        const resolvedReports = reports.filter(r => r.status === 'resolved').length;

        // Calculer le temps moyen de résolution
        const resolvedWithTime = reports.filter(r => r.status === 'resolved' && r.resolvedAt);
        const averageResolutionTime = resolvedWithTime.length > 0 ? 
          resolvedWithTime.reduce((sum, report) => 
            sum + (report.resolvedAt!.getTime() - report.reportedAt.getTime()), 0
          ) / (resolvedWithTime.length * 1000 * 60 * 60) : 0; // en heures

        // Statistiques par type
        const reportsByType = ['inappropriate', 'spam', 'incorrect', 'offensive', 'copyright', 'other']
          .map(type => {
            const count = reports.filter(r => r.reason === type).length;
            return {
              type,
              count,
              percentage: totalReports > 0 ? Math.round((count / totalReports) * 100 * 100) / 100 : 0,
            };
          });

        // TODO: Implémenter les statistiques d'activité des modérateurs
        const moderatorActivity = [
          {
            moderatorId: 'mod1',
            username: 'admin',
            actionsCount: 25,
            averageResponseTime: 2.5,
          },
        ];

        return {
          overview: {
            totalReports,
            pendingReports,
            resolvedReports,
            averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
          },
          reportsByType,
          moderatorActivity,
          trends: {
            reportsGrowth: 12.5, // TODO: Calculer la croissance réelle
            resolutionRateImprovement: 8.3, // TODO: Calculer l'amélioration réelle
            qualityScore: 94.2, // TODO: Calculer le score qualité réel
          },
        };
      },
      'Moderation',
      'stats',
    );
  }

  async configureAutoModeration(config: any, adminId: string): Promise<{ success: boolean; message: string }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // TODO: Implémenter la sauvegarde de la configuration de modération automatique
        // Pour l'instant, simuler la sauvegarde
        console.log('Auto-moderation config updated by:', adminId, config);

        return {
          success: true,
          message: 'Auto-moderation configuration updated successfully',
        };
      },
      'Moderation',
      'config',
      adminId,
    );
  }

  async getUserReports(userId: string, options: UserReportsOptions): Promise<{
    reports: ModerationReport[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let userReports = Array.from(this.reports.values())
          .filter(report => report.reportedBy === userId);

        if (options.status !== 'all') {
          userReports = userReports.filter(report => report.status === options.status);
        }

        const total = userReports.length;
        const startIndex = (options.page - 1) * options.limit;
        const paginatedReports = userReports.slice(startIndex, startIndex + options.limit);

        return {
          reports: paginatedReports,
          total,
          page: options.page,
          limit: options.limit,
        };
      },
      'Moderation',
      userId,
    );
  }

  private calculateSeverity(
    reason: string,
    description?: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Logique simple de détermination de gravité
    const criticalReasons = ['offensive', 'copyright'];
    const highReasons = ['inappropriate'];
    const mediumReasons = ['spam', 'incorrect'];

    if (criticalReasons.includes(reason)) {
      return 'critical';
    }
    if (highReasons.includes(reason)) {
      return 'high';
    }
    if (mediumReasons.includes(reason)) {
      return 'medium';
    }

    // Analyser la description pour des mots-clés critiques
    if (description) {
      const criticalKeywords = ['hate', 'violence', 'illegal', 'harassment'];
      if (criticalKeywords.some(keyword => description.toLowerCase().includes(keyword))) {
        return 'critical';
      }
    }

    return 'low';
  }
}