import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../../messaging/schemas/message.schema';
import { IMessageRepository } from '../interfaces/message.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

/**
 * 💬 REPOSITORY MESSAGE - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository Message utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les messages.
 * 
 * Fonctionnalités :
 * - CRUD complet des messages
 * - Gestion des statuts de lecture
 * - Recherche et filtrage avancés
 * - Statistiques et analytics
 * - Nettoyage automatisé
 */
@Injectable()
export class MessageRepository implements IMessageRepository {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(messageData: {
    senderId: string;
    receiverId: string;
    conversationId: string;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'system';
    metadata?: any;
  }): Promise<Message> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const newMessage = new this.messageModel({
          ...messageData,
          messageType: messageData.messageType || 'text',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return newMessage.save();
      },
      'Message'
    );
  }

  async findById(id: string): Promise<Message | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.messageModel.findById(id).exec();
      },
      'Message',
      id
    );
  }

  async update(id: string, updateData: Partial<Message>): Promise<Message | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.messageModel
          .findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true }
          )
          .exec();
      },
      'Message',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.messageModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'Message',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findByConversation(conversationId: string, options: {
    page?: number;
    limit?: number;
    before?: Date;
    after?: Date;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    messages: Message[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return {
            messages: [],
            total: 0,
            page: 1,
            limit: 10,
            hasMore: false,
          };
        }

        const {
          page = 1,
          limit = 50,
          before,
          after,
          sortOrder = 'desc'
        } = options;

        // Construire le filtre
        const filter: any = { conversationId };
        if (before || after) {
          filter.createdAt = {};
          if (before) filter.createdAt.$lt = before;
          if (after) filter.createdAt.$gt = after;
        }

        // Exécuter les requêtes en parallèle
        const [messages, total] = await Promise.all([
          this.messageModel
            .find(filter)
            .sort({ createdAt: sortOrder === 'asc' ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.messageModel.countDocuments(filter).exec(),
        ]);

        const hasMore = page * limit < total;

        return {
          messages,
          total,
          page,
          limit,
          hasMore,
        };
      },
      'Message'
    );
  }

  async search(query: string, userId: string, options: {
    conversationId?: string;
    limit?: number;
    messageTypes?: string[];
  } = {}): Promise<Message[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { conversationId, limit = 20, messageTypes } = options;
        const searchRegex = new RegExp(query, 'i');

        const filter: any = {
          $and: [
            {
              $or: [
                { senderId: userId },
                { receiverId: userId },
              ]
            },
            { content: { $regex: searchRegex } }
          ]
        };

        if (conversationId) {
          filter.conversationId = conversationId;
        }

        if (messageTypes && messageTypes.length > 0) {
          filter.messageType = { $in: messageTypes };
        }

        return this.messageModel
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'Message'
    );
  }

  async findBetweenUsers(user1Id: string, user2Id: string, options: {
    limit?: number;
    before?: Date;
    after?: Date;
  } = {}): Promise<Message[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(user1Id) || !Types.ObjectId.isValid(user2Id)) {
          return [];
        }

        const { limit = 50, before, after } = options;

        const filter: any = {
          $or: [
            { senderId: user1Id, receiverId: user2Id },
            { senderId: user2Id, receiverId: user1Id },
          ]
        };

        if (before || after) {
          filter.createdAt = {};
          if (before) filter.createdAt.$lt = before;
          if (after) filter.createdAt.$gt = after;
        }

        return this.messageModel
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'Message'
    );
  }

  // ========== GESTION DES STATUTS ==========

  async markAsRead(messageId: string, userId: string): Promise<Message | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(messageId)) {
          return null;
        }

        return this.messageModel
          .findOneAndUpdate(
            { 
              _id: messageId,
              receiverId: userId,
              isRead: false
            },
            { 
              isRead: true,
              readAt: new Date(),
              updatedAt: new Date()
            },
            { new: true }
          )
          .exec();
      },
      'Message',
      messageId
    );
  }

  async markConversationAsRead(conversationId: string, userId: string): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return 0;
        }

        const result = await this.messageModel
          .updateMany(
            {
              conversationId,
              receiverId: userId,
              isRead: false
            },
            {
              isRead: true,
              readAt: new Date(),
              updatedAt: new Date()
            }
          )
          .exec();

        return result.modifiedCount;
      },
      'Message',
      conversationId
    );
  }

  async findUnreadForUser(userId: string): Promise<Message[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return [];
        }

        return this.messageModel
          .find({
            receiverId: userId,
            isRead: false
          })
          .sort({ createdAt: -1 })
          .exec();
      },
      'Message'
    );
  }

  async countUnreadForUser(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return 0;
        }

        return this.messageModel
          .countDocuments({
            receiverId: userId,
            isRead: false
          })
          .exec();
      },
      'Message'
    );
  }

  async countUnreadInConversation(conversationId: string, userId: string): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
          return 0;
        }

        return this.messageModel
          .countDocuments({
            conversationId,
            receiverId: userId,
            isRead: false
          })
          .exec();
      },
      'Message'
    );
  }

  // ========== STATISTIQUES ==========

  async countInConversation(conversationId: string): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return 0;
        }
        return this.messageModel.countDocuments({ conversationId }).exec();
      },
      'Message'
    );
  }

  async findLastInConversation(conversationId: string): Promise<Message | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return null;
        }
        return this.messageModel
          .findOne({ conversationId })
          .sort({ createdAt: -1 })
          .exec();
      },
      'Message',
      conversationId
    );
  }

  async getUserStats(userId: string): Promise<{
    totalSent: number;
    totalReceived: number;
    totalUnread: number;
    conversationsCount: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return {
            totalSent: 0,
            totalReceived: 0,
            totalUnread: 0,
            conversationsCount: 0,
          };
        }

        const [totalSent, totalReceived, totalUnread, conversationsCount] = await Promise.all([
          this.messageModel.countDocuments({ senderId: userId }).exec(),
          this.messageModel.countDocuments({ receiverId: userId }).exec(),
          this.messageModel.countDocuments({ receiverId: userId, isRead: false }).exec(),
          this.messageModel.distinct('conversationId', {
            $or: [{ senderId: userId }, { receiverId: userId }]
          }).exec().then(conversations => conversations.length),
        ]);

        return {
          totalSent,
          totalReceived,
          totalUnread,
          conversationsCount,
        };
      },
      'Message'
    );
  }

  // ========== NETTOYAGE ==========

  async deleteOlderThan(date: Date): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.messageModel
          .deleteMany({ createdAt: { $lt: date } })
          .exec();
        return result.deletedCount || 0;
      },
      'Message',
      date.toISOString()
    );
  }

  async deleteByConversation(conversationId: string): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return 0;
        }
        const result = await this.messageModel
          .deleteMany({ conversationId })
          .exec();
        return result.deletedCount || 0;
      },
      'Message',
      conversationId
    );
  }
}