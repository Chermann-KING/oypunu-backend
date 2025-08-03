/**
 * @fileoverview Listener d'événements pour les demandes de contribution O'Ypunu
 * 
 * Ce service gère tous les événements liés aux demandes de contribution avec
 * notifications automatiques, rapports périodiques et workflow de communication
 * pour maintenir un processus transparent et professionnel.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { MailService } from "../../common/services/mail.service";
import { User, UserDocument } from "../schemas/user.schema";
import {
  ContributorRequest,
  ContributorRequestDocument,
} from "../schemas/contributor-request.schema";

/**
 * Interface pour l'événement de création de demande de contribution
 * 
 * @interface ContributorRequestCreatedEvent
 */
export interface ContributorRequestCreatedEvent {
  /** Identifiant unique de la demande */
  requestId: string;
  /** Identifiant de l'utilisateur demandeur */
  userId: string;
  /** Nom d'utilisateur du demandeur */
  username: string;
  /** Niveau de priorité de la demande */
  priority: string;
}

/**
 * Interface pour l'événement de révision de demande
 * 
 * @interface ContributorRequestReviewedEvent
 */
export interface ContributorRequestReviewedEvent {
  /** Identifiant unique de la demande */
  requestId: string;
  /** Identifiant de l'utilisateur demandeur */
  userId: string;
  /** Ancien statut de la demande */
  oldStatus: string;
  /** Nouveau statut après révision */
  newStatus: string;
  /** Identifiant de l'administrateur reviewer */
  reviewerId: string;
  /** Notes optionnelles de révision */
  reviewNotes?: string;
}

/**
 * Interface pour l'événement de promotion d'utilisateur
 * 
 * @interface UserPromotedEvent
 */
export interface UserPromotedEvent {
  /** Identifiant de l'utilisateur promu */
  userId: string;
  /** Nouveau rôle attribué */
  newRole: string;
  /** Date de la promotion */
  promotedAt: Date;
}

/**
 * Interface pour les canaux de notification urgente
 * 
 * @interface UrgentNotificationChannel
 */
export interface UrgentNotificationChannel {
  /** Type de canal (slack, discord, webhook, sms) */
  type: 'slack' | 'discord' | 'webhook' | 'sms';
  /** URL ou endpoint du canal */
  endpoint: string;
  /** Token d'authentification si requis */
  token?: string;
  /** Actif ou non */
  enabled: boolean;
}

/**
 * Interface pour les métriques de performance
 * 
 * @interface PerformanceMetrics
 */
export interface PerformanceMetrics {
  /** Temps moyen de traitement en heures */
  avgProcessingTime: number;
  /** Taux d'approbation en pourcentage */
  approvalRate: number;
  /** Nombre de demandes en attente */
  pendingCount: number;
  /** Nombre de demandes urgentes */
  urgentCount: number;
  /** Charge de travail des administrateurs */
  adminWorkload: Record<string, number>;
}

/**
 * Listener d'événements pour les demandes de contribution
 * 
 * Service central de gestion des événements du workflow de contribution
 * avec notifications automatisées, rapports périodiques et nettoyage.
 * 
 * ## 📧 Notifications automatiques :
 * - **Confirmation** : Email de réception de demande aux candidats
 * - **Révision** : Notifications de changement de statut
 * - **Administration** : Alertes aux admins pour nouvelles demandes
 * - **Promotion** : Félicitations aux nouveaux contributeurs
 * 
 * ## 📊 Rapports et analytics :
 * - **Statistiques hebdomadaires** : Rapport automatique aux super-admins
 * - **Métriques d'activité** : Suivi des volumes et tendances
 * - **Alertes de performance** : Détection des goulots d'étranglement
 * 
 * ## 🧹 Maintenance automatique :
 * - **Nettoyage** : Suppression des demandes expirées
 * - **Rappels** : Notifications d'expiration imminente
 * - **Optimisation** : Purge des données obsolètes
 * 
 * ## 🚨 Gestion d'urgence :
 * - **Priorités élevées** : Notifications spéciales pour demandes urgentes
 * - **Escalade** : Mécanismes d'alerte avancés
 * - **Monitoring** : Surveillance des SLA de traitement
 * 
 * @class ContributorRequestListener
 * @version 1.0.0
 */
@Injectable()
export class ContributorRequestListener {
  private readonly logger = new Logger(ContributorRequestListener.name);
  
  // Canaux de notification urgente configurables
  private urgentChannels: UrgentNotificationChannel[] = [];

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ContributorRequest.name)
    private contributorRequestModel: Model<ContributorRequestDocument>,
    private mailService: MailService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.initializeUrgentChannels();
  }

  /**
   * Gestionnaire d'événement pour les nouvelles demandes de contribution
   * 
   * Déclenche automatiquement les notifications de confirmation et d'alerte
   * administrative lors de la création d'une nouvelle demande.
   * 
   * @param event - Données de l'événement de création
   * 
   * @example
   * ```typescript
   * this.eventEmitter.emit('contributor.request.created', {
   *   requestId: "507f1f77bcf86cd799439011",
   *   userId: "507f1f77bcf86cd799439012", 
   *   username: "jean_dupont",
   *   priority: "medium"
   * });
   * ```
   */
  @OnEvent("contributor.request.created")
  async handleRequestCreated(event: ContributorRequestCreatedEvent) {
    try {
      // Envoyer un email de confirmation au demandeur
      const user = await this.userModel.findById(event.userId);
      if (user && user.email) {
        await this.mailService.sendContributorRequestConfirmation({
          to: user.email,
          username: event.username,
          requestId: event.requestId,
        });
      }

      // Notifier les administrateurs
      await this.notifyAdminsOfNewRequest(event);

      // Si priorité élevée, notification urgente
      if (event.priority === "high" || event.priority === "urgent") {
        await this.notifyAdminsUrgent(event);
      }

      console.log(
        `✅ Notifications envoyées pour la nouvelle demande ${event.requestId}`
      );
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'envoi des notifications de création:",
        error
      );
    }
  }

  /**
   * Gestionnaire d'événement pour les révisions de demandes
   * 
   * Envoie les notifications appropriées selon le nouveau statut de la demande
   * (approbation, rejet, révision supplémentaire).
   * 
   * @param event - Données de l'événement de révision
   */
  @OnEvent("contributor.request.reviewed")
  async handleRequestReviewed(event: ContributorRequestReviewedEvent) {
    try {
      const [request, user, reviewer] = await Promise.all([
        this.contributorRequestModel.findById(event.requestId),
        this.userModel.findById(event.userId),
        this.userModel.findById(event.reviewerId),
      ]);

      if (!request || !user) {
        console.error(
          `❌ Données manquantes pour la notification de révision ${event.requestId}`
        );
        return;
      }

      // Envoyer un email selon le nouveau statut
      switch (event.newStatus) {
        case "approved":
          await this.mailService.sendContributorRequestApproved({
            to: user.email,
            username: user.username,
            reviewerName: reviewer?.username || "L'équipe admin",
            reviewNotes: event.reviewNotes,
          });
          break;

        case "rejected":
          await this.mailService.sendContributorRequestRejected({
            to: user.email,
            username: user.username,
            reviewerName: reviewer?.username || "L'équipe admin",
            rejectionReason: request.rejectionReason,
            reviewNotes: event.reviewNotes,
          });
          break;

        case "under_review":
          await this.mailService.sendContributorRequestUnderReview({
            to: user.email,
            username: user.username,
            reviewerName: reviewer?.username || "L'équipe admin",
            reviewNotes: event.reviewNotes,
          });
          break;
      }

      // Marquer comme notifié
      await this.contributorRequestModel.findByIdAndUpdate(event.requestId, {
        applicantNotified: true,
        lastNotificationSent: new Date(),
      });

      console.log(
        `✅ Notification de révision envoyée pour ${event.requestId} (${event.newStatus})`
      );
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'envoi des notifications de révision:",
        error
      );
    }
  }

  @OnEvent("user.promoted")
  async handleUserPromoted(event: UserPromotedEvent) {
    try {
      const user = await this.userModel.findById(event.userId);
      if (!user) {
        console.error(
          `❌ Utilisateur ${event.userId} non trouvé pour la promotion`
        );
        return;
      }

      // Envoyer un email de félicitations
      await this.mailService.sendContributorWelcome({
        to: user.email,
        username: user.username,
        newRole: event.newRole,
        promotedAt: event.promotedAt,
      });

      console.log(
        `✅ Email de bienvenue envoyé au nouveau contributeur ${user.username}`
      );
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'envoi de l'email de promotion:",
        error
      );
    }
  }

  private async notifyAdminsOfNewRequest(
    event: ContributorRequestCreatedEvent
  ) {
    try {
      // Récupérer tous les administrateurs
      const admins = await this.userModel.find({
        role: { $in: ["admin", "superadmin"] },
        isActive: true,
      });

      // Envoyer une notification à chaque admin
      const notifications = admins.map((admin) =>
        this.mailService.sendAdminNewContributorRequest({
          to: admin.email,
          adminName: admin.username,
          applicantName: event.username,
          requestId: event.requestId,
          priority: event.priority,
        })
      );

      await Promise.allSettled(notifications);
      console.log(
        `✅ ${admins.length} administrateurs notifiés de la nouvelle demande`
      );
    } catch (error) {
      console.error("❌ Erreur lors de la notification des admins:", error);
    }
  }

  /**
   * Notifier les administrateurs pour les demandes urgentes via tous les canaux
   * 
   * Implémente un système multi-canal pour les notifications urgentes incluant
   * Slack, Discord, webhooks personnalisés et SMS selon la configuration.
   * 
   * @param event - Données de l'événement urgent
   */
  private async notifyAdminsUrgent(event: ContributorRequestCreatedEvent) {
    try {
      const urgentMessage = {
        title: "🚨 DEMANDE DE CONTRIBUTION URGENTE",
        text: `Nouvelle demande urgente de **${event.username}**`,
        fields: [
          { name: "Priorité", value: event.priority.toUpperCase(), inline: true },
          { name: "ID Demande", value: event.requestId, inline: true },
          { name: "Utilisateur", value: event.username, inline: true },
        ],
        timestamp: new Date().toISOString(),
        color: event.priority === 'urgent' ? '#ff0000' : '#ff8800', // Rouge pour urgent, orange pour high
      };

      this.logger.warn(`🚨 DEMANDE URGENTE: ${event.requestId} de ${event.username} (priorité: ${event.priority})`);

      // Envoyer via tous les canaux actifs en parallèle
      const notificationPromises = this.urgentChannels
        .filter(channel => channel.enabled)
        .map(channel => this.sendUrgentNotification(channel, urgentMessage, event));

      const results = await Promise.allSettled(notificationPromises);
      
      // Analyser les résultats
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      this.logger.log(`✅ Notifications urgentes: ${successful} réussies, ${failed} échouées`);
      
      // Si toutes les notifications échouent, fallback vers email admin
      if (successful === 0 && this.urgentChannels.length > 0) {
        await this.fallbackEmailNotification(event);
      }

    } catch (error) {
      this.logger.error("❌ Erreur lors de la notification urgente:", error);
      // Toujours tenter le fallback email en cas d'erreur critique
      await this.fallbackEmailNotification(event);
    }
  }

  // Méthode pour nettoyer les demandes expirées et envoyer des rappels
  @OnEvent("contributor.request.cleanup")
  async handleCleanupAndReminders() {
    try {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Trouver les demandes qui expirent dans 7 jours
      const expiringSoon = await this.contributorRequestModel
        .find({
          status: "pending",
          expiresAt: { $lte: weekFromNow, $gt: now },
          applicantNotified: false,
        })
        .populate("userId", "username email");

      // Envoyer des rappels
      for (const request of expiringSoon) {
        if (request.userId && (request.userId as any).email) {
          await this.mailService.sendContributorRequestReminder({
            to: (request.userId as any).email,
            username: (request.userId as any).username,
            requestId: (request._id as any).toString(),
            expiresAt: request.expiresAt!,
          });

          // Marquer comme notifié
          await this.contributorRequestModel.findByIdAndUpdate(request._id, {
            applicantNotified: true,
            lastNotificationSent: new Date(),
          });
        }
      }

      console.log(`✅ ${expiringSoon.length} rappels d'expiration envoyés`);

      // Nettoyer les demandes expirées
      const expired = await this.contributorRequestModel.deleteMany({
        status: "pending",
        expiresAt: { $lt: now },
      });

      console.log(`🗑️ ${expired.deletedCount} demandes expirées supprimées`);
    } catch (error) {
      console.error("❌ Erreur lors du nettoyage des demandes:", error);
    }
  }

  // Méthode pour les statistiques périodiques
  @OnEvent("contributor.request.weekly.stats")
  async handleWeeklyStats() {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [stats] = await this.contributorRequestModel.aggregate([
        {
          $match: {
            createdAt: { $gte: weekAgo },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
              },
            },
            approved: {
              $sum: {
                $cond: [{ $eq: ["$status", "approved"] }, 1, 0],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ["$status", "rejected"] }, 1, 0],
              },
            },
          },
        },
      ]);

      if (stats) {
        // Envoyer un rapport hebdomadaire aux super admins
        const superAdmins = await this.userModel.find({
          role: "superadmin",
          isActive: true,
        });

        const reports = superAdmins.map((admin) =>
          this.mailService.sendWeeklyContributorStats({
            to: admin.email,
            adminName: admin.username,
            stats: {
              total: stats.total,
              pending: stats.pending,
              approved: stats.approved,
              rejected: stats.rejected,
              week: weekAgo.toISOString().split("T")[0],
            },
          })
        );

        await Promise.allSettled(reports);
        console.log(
          `📊 Rapport hebdomadaire envoyé à ${superAdmins.length} super admins`
        );
      }
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'envoi du rapport hebdomadaire:",
        error
      );
    }
  }

  /**
   * Initialise les canaux de notification urgente depuis la configuration
   * 
   * @private
   */
  private initializeUrgentChannels(): void {
    try {
      // Configuration Slack
      const slackWebhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
      const slackToken = this.configService.get<string>('SLACK_BOT_TOKEN');
      if (slackWebhookUrl || slackToken) {
        this.urgentChannels.push({
          type: 'slack',
          endpoint: slackWebhookUrl || 'https://hooks.slack.com/services/...',
          token: slackToken,
          enabled: this.configService.get<boolean>('SLACK_NOTIFICATIONS_ENABLED', false),
        });
      }

      // Configuration Discord
      const discordWebhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
      if (discordWebhookUrl) {
        this.urgentChannels.push({
          type: 'discord',
          endpoint: discordWebhookUrl,
          enabled: this.configService.get<boolean>('DISCORD_NOTIFICATIONS_ENABLED', false),
        });
      }

      // Configuration Webhook personnalisé
      const customWebhookUrl = this.configService.get<string>('CUSTOM_WEBHOOK_URL');
      const customWebhookToken = this.configService.get<string>('CUSTOM_WEBHOOK_TOKEN');
      if (customWebhookUrl) {
        this.urgentChannels.push({
          type: 'webhook',
          endpoint: customWebhookUrl,
          token: customWebhookToken,
          enabled: this.configService.get<boolean>('CUSTOM_WEBHOOK_ENABLED', false),
        });
      }

      // Configuration SMS (Twilio par exemple)
      const smsEndpoint = this.configService.get<string>('SMS_ENDPOINT');
      const smsToken = this.configService.get<string>('SMS_API_TOKEN');
      if (smsEndpoint && smsToken) {
        this.urgentChannels.push({
          type: 'sms',
          endpoint: smsEndpoint,
          token: smsToken,
          enabled: this.configService.get<boolean>('SMS_NOTIFICATIONS_ENABLED', false),
        });
      }

      this.logger.log(`✅ ${this.urgentChannels.length} canaux de notification urgente configurés`);
      this.logger.debug('Canaux configurés:', this.urgentChannels.map(c => ({ type: c.type, enabled: c.enabled })));

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'initialisation des canaux urgents:', error);
    }
  }

  /**
   * Envoie une notification urgente via un canal spécifique
   * 
   * @param channel - Canal de notification
   * @param message - Message à envoyer
   * @param event - Événement original
   * @private
   */
  private async sendUrgentNotification(
    channel: UrgentNotificationChannel,
    message: any,
    event: ContributorRequestCreatedEvent,
  ): Promise<void> {
    try {
      switch (channel.type) {
        case 'slack':
          await this.sendSlackNotification(channel, message);
          break;
        case 'discord':
          await this.sendDiscordNotification(channel, message);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, message, event);
          break;
        case 'sms':
          await this.sendSMSNotification(channel, message, event);
          break;
        default:
          this.logger.warn(`Type de canal non supporté: ${channel.type}`);
      }
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'envoi via ${channel.type}:`, error);
      throw error; // Re-throw pour Promise.allSettled
    }
  }

  /**
   * Envoie une notification Slack
   * 
   * @param channel - Configuration Slack
   * @param message - Message formaté
   * @private
   */
  private async sendSlackNotification(channel: UrgentNotificationChannel, message: any): Promise<void> {
    const slackPayload = {
      text: message.title,
      attachments: [
        {
          color: message.color,
          fields: message.fields,
          footer: "O'Ypunu Admin Bot",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await this.httpService.axiosRef.post(channel.endpoint, slackPayload, {
      headers: {
        'Content-Type': 'application/json',
        ...(channel.token && { 'Authorization': `Bearer ${channel.token}` }),
      },
      timeout: 5000,
    });

    if (response.status !== 200) {
      throw new Error(`Slack API responded with status ${response.status}`);
    }
  }

  /**
   * Envoie une notification Discord
   * 
   * @param channel - Configuration Discord
   * @param message - Message formaté
   * @private
   */
  private async sendDiscordNotification(channel: UrgentNotificationChannel, message: any): Promise<void> {
    const discordPayload = {
      embeds: [
        {
          title: message.title,
          description: message.text,
          color: parseInt(message.color.replace('#', ''), 16),
          fields: message.fields,
          timestamp: message.timestamp,
          footer: {
            text: "O'Ypunu Admin Bot",
          },
        },
      ],
    };

    const response = await this.httpService.axiosRef.post(channel.endpoint, discordPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });

    if (response.status !== 204) {
      throw new Error(`Discord API responded with status ${response.status}`);
    }
  }

  /**
   * Envoie une notification via webhook personnalisé
   * 
   * @param channel - Configuration webhook
   * @param message - Message formaté
   * @param event - Événement original
   * @private
   */
  private async sendWebhookNotification(
    channel: UrgentNotificationChannel,
    message: any,
    event: ContributorRequestCreatedEvent,
  ): Promise<void> {
    const webhookPayload = {
      event: 'contributor.request.urgent',
      data: {
        requestId: event.requestId,
        userId: event.userId,
        username: event.username,
        priority: event.priority,
        timestamp: message.timestamp,
      },
      message: message,
    };

    const response = await this.httpService.axiosRef.post(channel.endpoint, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        ...(channel.token && { 'Authorization': `Bearer ${channel.token}` }),
      },
      timeout: 5000,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }
  }

  /**
   * Envoie une notification SMS
   * 
   * @param channel - Configuration SMS
   * @param message - Message formaté
   * @param event - Événement original
   * @private
   */
  private async sendSMSNotification(
    channel: UrgentNotificationChannel,
    message: any,
    event: ContributorRequestCreatedEvent,
  ): Promise<void> {
    // Obtenir les numéros des super-admins depuis la configuration
    const adminPhones = this.configService.get<string[]>('ADMIN_PHONE_NUMBERS', []);
    
    if (adminPhones.length === 0) {
      this.logger.warn('Aucun numéro de téléphone admin configuré pour SMS');
      return;
    }

    const smsText = `🚨 URGENCE O'Ypunu: Demande contribution ${event.priority} de ${event.username}. ID: ${event.requestId}`;

    // Envoyer à tous les numéros admin
    const smsPromises = adminPhones.map(async (phone) => {
      const smsPayload = {
        to: phone,
        body: smsText,
        from: this.configService.get<string>('SMS_FROM_NUMBER'),
      };

      return this.httpService.axiosRef.post(channel.endpoint, smsPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channel.token}`,
        },
        timeout: 10000, // Plus de temps pour SMS
      });
    });

    const results = await Promise.allSettled(smsPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    this.logger.log(`📱 SMS envoyés: ${successful}/${adminPhones.length} numéros`);
  }

  /**
   * Notification email de fallback en cas d'échec des autres canaux
   * 
   * @param event - Événement urgent
   * @private
   */
  private async fallbackEmailNotification(event: ContributorRequestCreatedEvent): Promise<void> {
    try {
      const superAdmins = await this.userModel.find({
        role: 'superadmin',
        isActive: true,
      });

      const fallbackPromises = superAdmins.map(admin =>
        this.mailService.sendUrgentContributorRequestAlert({
          to: admin.email,
          adminName: admin.username,
          applicantName: event.username,
          requestId: event.requestId,
          priority: event.priority,
          reason: 'Échec des notifications urgentes primaires',
        })
      );

      await Promise.allSettled(fallbackPromises);
      this.logger.log(`📧 Fallback email envoyé à ${superAdmins.length} super-admins`);

    } catch (error) {
      this.logger.error('❌ Erreur lors du fallback email:', error);
    }
  }

  /**
   * Calcule les métriques de performance du système de demandes
   * 
   * @returns Métriques détaillées
   * @private
   */
  private async calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [generalStats] = await this.contributorRequestModel.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
            },
            urgentCount: {
              $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] },
            },
            avgProcessingHours: {
              $avg: {
                $cond: [
                  { $ne: ['$reviewedAt', null] },
                  {
                    $divide: [
                      { $subtract: ['$reviewedAt', '$createdAt'] },
                      1000 * 60 * 60, // Convertir en heures
                    ],
                  },
                  null,
                ],
              },
            },
          },
        },
      ]);

      // Calculer la charge de travail par admin
      const adminWorkload = await this.contributorRequestModel.aggregate([
        {
          $match: {
            reviewedBy: { $exists: true },
            reviewedAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: '$reviewedBy',
            requestsReviewed: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'reviewer',
          },
        },
        {
          $project: {
            reviewerId: '$_id',
            reviewerName: { $arrayElemAt: ['$reviewer.username', 0] },
            requestsReviewed: 1,
          },
        },
      ]);

      const workloadMap: Record<string, number> = {};
      adminWorkload.forEach(admin => {
        workloadMap[admin.reviewerName || admin.reviewerId] = admin.requestsReviewed;
      });

      return {
        avgProcessingTime: generalStats?.avgProcessingHours || 0,
        approvalRate: generalStats 
          ? (generalStats.approvedCount / generalStats.totalRequests) * 100 
          : 0,
        pendingCount: generalStats?.pendingCount || 0,
        urgentCount: generalStats?.urgentCount || 0,
        adminWorkload: workloadMap,
      };

    } catch (error) {
      this.logger.error('❌ Erreur lors du calcul des métriques:', error);
      return {
        avgProcessingTime: 0,
        approvalRate: 0,
        pendingCount: 0,
        urgentCount: 0,
        adminWorkload: {},
      };
    }
  }

  /**
   * Nouvel événement pour les métriques de performance en temps réel
   */
  @OnEvent('contributor.request.metrics')
  async handlePerformanceMetrics(): Promise<void> {
    try {
      const metrics = await this.calculatePerformanceMetrics();
      
      // Émettre des alertes si les métriques sont préoccupantes
      if (metrics.pendingCount > 20) {
        this.logger.warn(`⚠️ Forte charge: ${metrics.pendingCount} demandes en attente`);
      }
      
      if (metrics.avgProcessingTime > 72) { // Plus de 3 jours
        this.logger.warn(`⏰ Temps de traitement élevé: ${metrics.avgProcessingTime.toFixed(1)}h en moyenne`);
      }
      
      if (metrics.approvalRate < 30) {
        this.logger.warn(`📉 Taux d'approbation faible: ${metrics.approvalRate.toFixed(1)}%`);
      }

      // Envoyer un rapport si les métriques sont critiques
      if (metrics.urgentCount > 5 || metrics.pendingCount > 50) {
        await this.sendCriticalMetricsAlert(metrics);
      }

      this.logger.debug('📊 Métriques de performance calculées:', metrics);

    } catch (error) {
      this.logger.error('❌ Erreur lors du traitement des métriques:', error);
    }
  }

  /**
   * Envoie une alerte pour des métriques critiques
   * 
   * @param metrics - Métriques calculées
   * @private
   */
  private async sendCriticalMetricsAlert(metrics: PerformanceMetrics): Promise<void> {
    try {
      const superAdmins = await this.userModel.find({
        role: 'superadmin',
        isActive: true,
      });

      const alertPromises = superAdmins.map(admin =>
        this.mailService.sendCriticalMetricsAlert({
          to: admin.email,
          adminName: admin.username,
          metrics: {
            pendingCount: metrics.pendingCount,
            urgentCount: metrics.urgentCount,
            avgProcessingTime: Math.round(metrics.avgProcessingTime * 10) / 10,
            approvalRate: Math.round(metrics.approvalRate * 10) / 10,
          },
          recommendations: this.generateMetricsRecommendations(metrics),
        })
      );

      await Promise.allSettled(alertPromises);
      this.logger.log(`🚨 Alerte métriques critiques envoyée à ${superAdmins.length} super-admins`);

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'envoi de l\'alerte métriques:', error);
    }
  }

  /**
   * Génère des recommandations basées sur les métriques
   * 
   * @param metrics - Métriques actuelles
   * @returns Liste de recommandations
   * @private
   */
  private generateMetricsRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.pendingCount > 50) {
      recommendations.push('Considérer l\'ajout d\'administrateurs supplémentaires');
    }

    if (metrics.urgentCount > 10) {
      recommendations.push('Réviser les critères de priorité urgente');
    }

    if (metrics.avgProcessingTime > 120) {
      recommendations.push('Optimiser le processus de révision des demandes');
    }

    if (metrics.approvalRate < 20) {
      recommendations.push('Examiner les critères d\'approbation - taux très faible');
    }

    if (metrics.approvalRate > 90) {
      recommendations.push('Examiner les critères d\'approbation - taux très élevé');
    }

    // Analyser la charge de travail des admins
    const workloadValues = Object.values(metrics.adminWorkload);
    if (workloadValues.length > 0) {
      const maxWorkload = Math.max(...workloadValues);
      const minWorkload = Math.min(...workloadValues);
      
      if (maxWorkload > minWorkload * 3) {
        recommendations.push('Rééquilibrer la charge de travail entre administrateurs');
      }
    }

    return recommendations;
  }
}
