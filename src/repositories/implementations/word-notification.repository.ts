import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WordNotification, WordNotificationDocument } from '../../dictionary/schemas/word-notification.schema';
import { IWordNotificationRepository } from '../interfaces/word-notification.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

@Injectable()
export class WordNotificationRepository implements IWordNotificationRepository {
  constructor(
    @InjectModel(WordNotification.name)
    private notificationModel: Model<WordNotificationDocument>
  ) {}

  async create(notification: Partial<WordNotification>): Promise<WordNotification> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.notificationModel(notification);
        return await created.save();
      },
      'WordNotification',
      'create'
    );
  }

  async findById(id: string): Promise<WordNotification | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.notificationModel
          .findById(id)
          .populate('targetUserId')
          .populate('triggeredBy')
          .exec();
      },
      'WordNotification',
      id
    );
  }

  async findByUserId(userId: string, options: {
    limit?: number;
    offset?: number;
    includeRead?: boolean;
    type?: string;
  } = {}): Promise<WordNotification[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 50, offset = 0, includeRead = true, type } = options;
        const query: any = { targetUserId: userId };
        
        if (!includeRead) {
          query.isRead = false;
        }
        
        if (type) {
          query.type = type;
        }

        return await this.notificationModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .populate('targetUserId')
          .populate('triggeredBy')
          .exec();
      },
      'WordNotification',
      `user-${userId}`
    );
  }

  async findByWordId(wordId: string, options: {
    limit?: number;
    type?: string;
  } = {}): Promise<WordNotification[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 100, type } = options;
        const query: any = { wordId };
        
        if (type) {
          query.type = type;
        }

        return await this.notificationModel
          .find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('targetUserId')
          .populate('triggeredBy')
          .exec();
      },
      'WordNotification',
      `word-${wordId}`
    );
  }

  async findUnreadByUserId(userId: string, limit: number = 20): Promise<WordNotification[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.notificationModel
          .find({ 
            targetUserId: userId, 
            isRead: false 
          })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('targetUserId')
          .populate('triggeredBy')
          .exec();
      },
      'WordNotification',
      `unread-${userId}`
    );
  }

  async markAsRead(id: string): Promise<WordNotification | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.notificationModel
          .findByIdAndUpdate(
            id,
            { 
              isRead: true,
              readAt: new Date()
            },
            { new: true }
          )
          .exec();
      },
      'WordNotification',
      id
    );
  }

  async markAllAsReadByUserId(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.notificationModel
          .updateMany(
            { 
              targetUserId: userId,
              isRead: false
            },
            { 
              isRead: true,
              readAt: new Date()
            }
          )
          .exec();
        
        return result.modifiedCount || 0;
      },
      'WordNotification',
      `markAllRead-${userId}`
    );
  }

  async deleteById(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.notificationModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'WordNotification',
      id
    );
  }

  async deleteOldNotifications(olderThanDays: number): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.notificationModel.deleteMany({
          createdAt: { $lt: cutoffDate },
          isRead: true // Supprimer seulement les notifications lues
        }).exec();

        return result.deletedCount || 0;
      },
      'WordNotification',
      `cleanup-${olderThanDays}days`
    );
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.notificationModel.countDocuments({
          targetUserId: userId,
          isRead: false
        }).exec();
      },
      'WordNotification',
      `countUnread-${userId}`
    );
  }

  async findByType(type: string, options: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<WordNotification[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 100, startDate, endDate } = options;
        const query: any = { type };

        if (startDate || endDate) {
          query.createdAt = {};
          if (startDate) query.createdAt.$gte = startDate;
          if (endDate) query.createdAt.$lte = endDate;
        }

        return await this.notificationModel
          .find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('targetUserId')
          .populate('triggeredBy')
          .exec();
      },
      'WordNotification',
      `type-${type}`
    );
  }
}