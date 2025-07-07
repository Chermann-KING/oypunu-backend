import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailService } from '../../common/services/mail.service';
import { User, UserDocument } from '../schemas/user.schema';
import { ContributorRequest, ContributorRequestDocument } from '../schemas/contributor-request.schema';

export interface ContributorRequestCreatedEvent {
  requestId: string;
  userId: string;
  username: string;
  priority: string;
}

export interface ContributorRequestReviewedEvent {
  requestId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
  reviewerId: string;
  reviewNotes?: string;
}

export interface UserPromotedEvent {
  userId: string;
  newRole: string;
  promotedAt: Date;
}

@Injectable()
export class ContributorRequestListener {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ContributorRequest.name) private contributorRequestModel: Model<ContributorRequestDocument>,
    private mailService: MailService,
  ) {}

  @OnEvent('contributor.request.created')
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
      if (event.priority === 'high' || event.priority === 'urgent') {
        await this.notifyAdminsUrgent(event);
      }

      console.log(`✅ Notifications envoyées pour la nouvelle demande ${event.requestId}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi des notifications de création:', error);
    }
  }

  @OnEvent('contributor.request.reviewed')
  async handleRequestReviewed(event: ContributorRequestReviewedEvent) {
    try {
      const [request, user, reviewer] = await Promise.all([
        this.contributorRequestModel.findById(event.requestId),
        this.userModel.findById(event.userId),
        this.userModel.findById(event.reviewerId),
      ]);

      if (!request || !user) {
        console.error(`❌ Données manquantes pour la notification de révision ${event.requestId}`);
        return;
      }

      // Envoyer un email selon le nouveau statut
      switch (event.newStatus) {
        case 'approved':
          await this.mailService.sendContributorRequestApproved({
            to: user.email,
            username: user.username,
            reviewerName: reviewer?.username || 'L\'équipe admin',
            reviewNotes: event.reviewNotes,
          });
          break;

        case 'rejected':
          await this.mailService.sendContributorRequestRejected({
            to: user.email,
            username: user.username,
            reviewerName: reviewer?.username || 'L\'équipe admin',
            rejectionReason: request.rejectionReason,
            reviewNotes: event.reviewNotes,
          });
          break;

        case 'under_review':
          await this.mailService.sendContributorRequestUnderReview({
            to: user.email,
            username: user.username,
            reviewerName: reviewer?.username || 'L\'équipe admin',
            reviewNotes: event.reviewNotes,
          });
          break;
      }

      // Marquer comme notifié
      await this.contributorRequestModel.findByIdAndUpdate(event.requestId, {
        applicantNotified: true,
        lastNotificationSent: new Date(),
      });

      console.log(`✅ Notification de révision envoyée pour ${event.requestId} (${event.newStatus})`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi des notifications de révision:', error);
    }
  }

  @OnEvent('user.promoted')
  async handleUserPromoted(event: UserPromotedEvent) {
    try {
      const user = await this.userModel.findById(event.userId);
      if (!user) {
        console.error(`❌ Utilisateur ${event.userId} non trouvé pour la promotion`);
        return;
      }

      // Envoyer un email de félicitations
      await this.mailService.sendContributorWelcome({
        to: user.email,
        username: user.username,
        newRole: event.newRole,
        promotedAt: event.promotedAt,
      });

      console.log(`✅ Email de bienvenue envoyé au nouveau contributeur ${user.username}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'email de promotion:', error);
    }
  }

  private async notifyAdminsOfNewRequest(event: ContributorRequestCreatedEvent) {
    try {
      // Récupérer tous les administrateurs
      const admins = await this.userModel.find({
        role: { $in: ['admin', 'superadmin'] },
        isActive: true,
      });

      // Envoyer une notification à chaque admin
      const notifications = admins.map(admin =>
        this.mailService.sendAdminNewContributorRequest({
          to: admin.email,
          adminName: admin.username,
          applicantName: event.username,
          requestId: event.requestId,
          priority: event.priority,
        })
      );

      await Promise.allSettled(notifications);
      console.log(`✅ ${admins.length} administrateurs notifiés de la nouvelle demande`);
    } catch (error) {
      console.error('❌ Erreur lors de la notification des admins:', error);
    }
  }

  private async notifyAdminsUrgent(event: ContributorRequestCreatedEvent) {
    try {
      // Pour les demandes urgentes, on peut ajouter d'autres canaux de notification
      // Par exemple : Slack, Discord, SMS, etc.
      
      // Ici on se contente de marquer dans les logs
      console.log(`🚨 DEMANDE URGENTE: ${event.requestId} de ${event.username} (priorité: ${event.priority})`);
      
      // TODO: Implémenter les notifications urgentes (Slack, webhooks, etc.)
    } catch (error) {
      console.error('❌ Erreur lors de la notification urgente:', error);
    }
  }

  // Méthode pour nettoyer les demandes expirées et envoyer des rappels
  @OnEvent('contributor.request.cleanup')
  async handleCleanupAndReminders() {
    try {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Trouver les demandes qui expirent dans 7 jours
      const expiringSoon = await this.contributorRequestModel
        .find({
          status: 'pending',
          expiresAt: { $lte: weekFromNow, $gt: now },
          applicantNotified: false,
        })
        .populate('userId', 'username email');

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
        status: 'pending',
        expiresAt: { $lt: now },
      });

      console.log(`🗑️ ${expired.deletedCount} demandes expirées supprimées`);
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage des demandes:', error);
    }
  }

  // Méthode pour les statistiques périodiques
  @OnEvent('contributor.request.weekly.stats')
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
                $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
              },
            },
            approved: {
              $sum: {
                $cond: [{ $eq: ['$status', 'approved'] }, 1, 0],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0],
              },
            },
          },
        },
      ]);

      if (stats) {
        // Envoyer un rapport hebdomadaire aux super admins
        const superAdmins = await this.userModel.find({
          role: 'superadmin',
          isActive: true,
        });

        const reports = superAdmins.map(admin =>
          this.mailService.sendWeeklyContributorStats({
            to: admin.email,
            adminName: admin.username,
            stats: {
              total: stats.total,
              pending: stats.pending,
              approved: stats.approved,
              rejected: stats.rejected,
              week: weekAgo.toISOString().split('T')[0],
            },
          })
        );

        await Promise.allSettled(reports);
        console.log(`📊 Rapport hebdomadaire envoyé à ${superAdmins.length} super admins`);
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du rapport hebdomadaire:', error);
    }
  }
}