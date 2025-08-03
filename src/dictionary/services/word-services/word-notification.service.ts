import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WordNotification,
  WordNotificationDocument,
} from '../../schemas/word-notification.schema';
import { User } from '../../../users/schemas/user.schema';
import { Word } from '../../schemas/word.schema';
import { RevisionHistory } from '../../schemas/revision-history.schema';
import { DatabaseErrorHandler } from "../../../common/errors";

/**
 * Service spécialisé pour les notifications liées aux mots
 * PHASE 1 - Service utilitaire pour centraliser la logique de notification
 */
@Injectable()
export class WordNotificationService {
  private readonly logger = new Logger(WordNotificationService.name);

  constructor(
    @InjectModel(WordNotification.name)
    private wordNotificationModel: Model<WordNotificationDocument>,
  ) {}

  /**
   * Notifie les admins qu'une révision est en attente
   * Ligne 708-742 dans WordsService original
   */
  async notifyAdminsOfRevision(
    wordId: string,
    userId: string,
    revisionId: string,
    changes: any[],
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📧 Notification admins - Révision en attente:', {
          wordId,
          userId,
          revisionId,
          changesCount: changes.length,
        });

        const notification = new this.wordNotificationModel({
          wordId,
          userId,
          adminTargeted: true, // Pour tous les admins
          type: 'revision_pending',
          message: `Une révision est en attente d'approbation pour le mot ${wordId}`,
          metadata: {
            revisionId,
            changes,
            createdAt: new Date(),
          },
          isRead: false,
          createdAt: new Date(),
        });

        await notification.save();
        console.log('✅ Notification admins créée avec succès');
      },
      'WordNotification',
      revisionId,
    );
  }

  /**
   * Notifie l'utilisateur que sa révision a été approuvée
   * Ligne 974-994 dans WordsService original
   */
  async notifyUserOfRevisionApproval(
    userId: string,
    wordId: string,
    revisionId: string,
    adminNotes?: string,
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📧 Notification utilisateur - Révision approuvée:', {
          userId,
          wordId,
          revisionId,
        });

        const notification = new this.wordNotificationModel({
          wordId,
          userId,
          adminTargeted: false,
          type: 'revision_approved',
          message: `Votre révision du mot ${wordId} a été approuvée`,
          metadata: {
            revisionId,
            adminNotes: adminNotes || null,
            approvedAt: new Date(),
          },
          isRead: false,
          createdAt: new Date(),
        });

        await notification.save();
        console.log('✅ Notification approbation envoyée à l\'utilisateur');
      },
      'WordNotification',
      userId,
    );
  }

  /**
   * Notifie l'utilisateur que sa révision a été rejetée
   * Ligne 996-1017 dans WordsService original
   */
  async notifyUserOfRevisionRejection(
    userId: string,
    wordId: string,
    revisionId: string,
    adminNotes?: string,
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📧 Notification utilisateur - Révision rejetée:', {
          userId,
          wordId,
          revisionId,
        });

        const notification = new this.wordNotificationModel({
          wordId,
          userId,
          adminTargeted: false,
          type: 'revision_rejected',
          message: `Votre révision du mot ${wordId} a été rejetée`,
          metadata: {
            revisionId,
            adminNotes: adminNotes || null,
            rejectedAt: new Date(),
          },
          isRead: false,
          createdAt: new Date(),
        });

        await notification.save();
        console.log('✅ Notification rejet envoyée à l\'utilisateur');
      },
      'WordNotification',
      userId,
    );
  }

  /**
   * Récupère les notifications non lues pour un utilisateur
   */
  async getUnreadNotifications(userId: string): Promise<WordNotification[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const notifications = await this.wordNotificationModel
          .find({
            $or: [
              { userId, adminTargeted: false },
              { adminTargeted: true }, // Admin notifications for all admins
            ],
            isRead: false,
          })
          .sort({ createdAt: -1 })
          .limit(50)
          .exec();

        console.log(`📧 ${notifications.length} notifications non lues trouvées`);
        return notifications;
      },
      'WordNotification',
      userId,
    );
  }

  /**
   * Marque une notification comme lue
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        await this.wordNotificationModel.findByIdAndUpdate(
          notificationId,
          { isRead: true, readAt: new Date() },
        );
        console.log('✅ Notification marquée comme lue');
      },
      'WordNotification',
      notificationId,
    );
  }

  /**
   * Nettoie les anciennes notifications (plus de 30 jours)
   */
  async cleanupOldNotifications(): Promise<{ deletedCount: number }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await this.wordNotificationModel.deleteMany({
          createdAt: { $lt: thirtyDaysAgo },
          isRead: true,
        });

        console.log(`🧹 ${result.deletedCount} anciennes notifications supprimées`);
        return { deletedCount: result.deletedCount };
      },
      'WordNotification',
      'cleanup',
    );
  }
}