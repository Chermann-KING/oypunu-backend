import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../../messaging/schemas/conversation.schema";
import { IConversationRepository } from "../interfaces/conversation.repository.interface";
import { DatabaseErrorHandler } from "../../common/errors"

/**
 * 💬 REPOSITORY CONVERSATION - IMPLÉMENTATION MONGOOSE
 *
 * Implémentation concrète du repository Conversation utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les conversations.
 *
 * Fonctionnalités :
 * - CRUD complet des conversations
 * - Gestion des participants
 * - Recherche et filtrage
 * - Métadonnées et statuts
 * - Statistiques et analytics
 */
@Injectable()
export class ConversationRepository implements IConversationRepository {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>
  ) {}

  // ========== CRUD DE BASE ==========

  async create(conversationData: {
    participants: string[];
    type?: "private" | "group";
    title?: string;
    createdBy: string;
  }): Promise<Conversation> {
    return DatabaseErrorHandler.handleCreateOperation(async () => {
      const newConversation = new this.conversationModel({
        ...conversationData,
        type: conversationData.type || "private",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivity: new Date(),
      });
      return newConversation.save();
    }, "Conversation");
  }

  async findById(id: string): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.conversationModel.findById(id).exec();
      },
      "Conversation",
      id
    );
  }

  async update(
    id: string,
    updateData: Partial<Conversation>
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.conversationModel
          .findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.conversationModel
          .findByIdAndDelete(id)
          .exec();
        return result !== null;
      },
      "Conversation",
      id
    );
  }

  // ========== RECHERCHE ET GESTION ==========

  async findByParticipants(
    participantIds: string[]
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleFindOperation(async () => {
      // Valider les IDs
      const validIds = participantIds.filter((id) =>
        Types.ObjectId.isValid(id)
      );
      if (validIds.length !== participantIds.length || validIds.length === 0) {
        return null;
      }

      // Pour une conversation privée entre 2 participants
      if (participantIds.length === 2) {
        return this.conversationModel
          .findOne({
            type: "private",
            participants: { $all: participantIds, $size: 2 },
          })
          .exec();
      }

      // Pour les conversations de groupe
      return this.conversationModel
        .findOne({
          participants: { $all: participantIds },
        })
        .exec();
    }, "Conversation");
  }

  async findByUser(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      includeArchived?: boolean;
      sortBy?: "lastMessage" | "createdAt" | "title";
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    conversations: Conversation[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          conversations: [],
          total: 0,
          page: 1,
          limit: 10,
        };
      }

      const {
        page = 1,
        limit = 20,
        includeArchived = false,
        sortBy = "lastActivity",
        sortOrder = "desc",
      } = options;

      // Construire le filtre
      const filter: any = {
        participants: userId,
        isActive: true,
      };

      if (!includeArchived) {
        filter.isArchived = { $ne: true };
      }

      // Construire le tri
      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      // Exécuter les requêtes en parallèle
      const [conversations, total] = await Promise.all([
        this.conversationModel
          .find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.conversationModel.countDocuments(filter).exec(),
      ]);

      return {
        conversations,
        total,
        page,
        limit,
      };
    }, "Conversation");
  }

  async searchByTitle(
    userId: string,
    query: string,
    options: {
      limit?: number;
      includeArchived?: boolean;
    } = {}
  ): Promise<Conversation[]> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }

      const { limit = 10, includeArchived = false } = options;
      const searchRegex = new RegExp(query, "i");

      const filter: any = {
        participants: userId,
        isActive: true,
        title: { $regex: searchRegex },
      };

      if (!includeArchived) {
        filter.isArchived = { $ne: true };
      }

      return this.conversationModel
        .find(filter)
        .limit(limit)
        .sort({ lastActivity: -1 })
        .exec();
    }, "Conversation");
  }

  async isParticipant(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (
        !Types.ObjectId.isValid(conversationId) ||
        !Types.ObjectId.isValid(userId)
      ) {
        return false;
      }

      const conversation = await this.conversationModel
        .findOne({
          _id: conversationId,
          participants: userId,
        })
        .exec();

      return conversation !== null;
    }, "Conversation");
  }

  // ========== GESTION DES PARTICIPANTS ==========

  async addParticipants(
    conversationId: string,
    participantIds: string[]
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return null;
        }

        const validIds = participantIds.filter((id) =>
          Types.ObjectId.isValid(id)
        );
        if (validIds.length === 0) {
          return null;
        }

        return this.conversationModel
          .findByIdAndUpdate(
            conversationId,
            {
              $addToSet: { participants: { $each: validIds } },
              updatedAt: new Date(),
              lastActivity: new Date(),
            },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      conversationId
    );
  }

  async removeParticipants(
    conversationId: string,
    participantIds: string[]
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return null;
        }

        const validIds = participantIds.filter((id) =>
          Types.ObjectId.isValid(id)
        );
        if (validIds.length === 0) {
          return null;
        }

        return this.conversationModel
          .findByIdAndUpdate(
            conversationId,
            {
              $pullAll: { participants: validIds },
              updatedAt: new Date(),
              lastActivity: new Date(),
            },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      conversationId
    );
  }

  async getParticipants(conversationId: string): Promise<string[]> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(conversationId)) {
        return [];
      }

      const conversation = await this.conversationModel
        .findById(conversationId)
        .select("participants")
        .exec();

      return conversation
        ? conversation.participants.map((p) => p.toString())
        : [];
    }, "Conversation");
  }

  // ========== MÉTADONNÉES ET STATUTS ==========

  async updateLastMessage(
    conversationId: string,
    messageId: string,
    messagePreview: string
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return null;
        }

        return this.conversationModel
          .findByIdAndUpdate(
            conversationId,
            {
              lastMessageId: messageId,
              lastMessagePreview: messagePreview,
              lastActivity: new Date(),
              updatedAt: new Date(),
            },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      conversationId
    );
  }

  async updateLastActivity(
    conversationId: string
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(conversationId)) {
          return null;
        }

        return this.conversationModel
          .findByIdAndUpdate(
            conversationId,
            {
              lastActivity: new Date(),
              updatedAt: new Date(),
            },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      conversationId
    );
  }

  async toggleArchive(
    conversationId: string,
    userId: string,
    isArchived: boolean
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(conversationId) ||
          !Types.ObjectId.isValid(userId)
        ) {
          return null;
        }

        // Vérifier que l'utilisateur est participant
        const isParticipant = await this.isParticipant(conversationId, userId);
        if (!isParticipant) {
          return null;
        }

        return this.conversationModel
          .findByIdAndUpdate(
            conversationId,
            {
              isArchived,
              updatedAt: new Date(),
            },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      conversationId
    );
  }

  async togglePin(
    conversationId: string,
    userId: string,
    isPinned: boolean
  ): Promise<Conversation | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(conversationId) ||
          !Types.ObjectId.isValid(userId)
        ) {
          return null;
        }

        // Vérifier que l'utilisateur est participant
        const isParticipant = await this.isParticipant(conversationId, userId);
        if (!isParticipant) {
          return null;
        }

        return this.conversationModel
          .findByIdAndUpdate(
            conversationId,
            {
              isPinned,
              updatedAt: new Date(),
            },
            { new: true }
          )
          .exec();
      },
      "Conversation",
      conversationId
    );
  }

  // ========== STATISTIQUES ==========

  async countByUser(
    userId: string,
    options: {
      includeArchived?: boolean;
      type?: "private" | "group";
    } = {}
  ): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return 0;
      }

      const { includeArchived = false, type } = options;

      const filter: any = {
        participants: userId,
        isActive: true,
      };

      if (!includeArchived) {
        filter.isArchived = { $ne: true };
      }

      if (type) {
        filter.type = type;
      }

      return this.conversationModel.countDocuments(filter).exec();
    }, "Conversation");
  }

  async getMostActive(
    userId: string,
    limit: number = 10
  ): Promise<Conversation[]> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return [];
      }

      return this.conversationModel
        .find({
          participants: userId,
          isActive: true,
          isArchived: { $ne: true },
        })
        .sort({ lastActivity: -1 })
        .limit(limit)
        .exec();
    }, "Conversation");
  }

  async getStats(conversationId: string): Promise<{
    messagesCount: number;
    participantsCount: number;
    lastActivity: Date;
    createdAt: Date;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(conversationId)) {
        return {
          messagesCount: 0,
          participantsCount: 0,
          lastActivity: new Date(0),
          createdAt: new Date(0),
        };
      }

      const conversation = await this.conversationModel
        .findById(conversationId)
        .exec();

      if (!conversation) {
        return {
          messagesCount: 0,
          participantsCount: 0,
          lastActivity: new Date(0),
          createdAt: new Date(0),
        };
      }

      // Note: messagesCount nécessiterait une jointure avec MessageRepository
      // Pour l'instant, retourner les données disponibles
      return {
        messagesCount: 0, // À implémenter avec MessageRepository
        participantsCount: conversation.participants.length,
        lastActivity:
          conversation.lastActivity || (conversation as any).updatedAt,
        createdAt: (conversation as any).createdAt,
      };
    }, "Conversation");
  }

  // ========== NETTOYAGE ==========

  async deleteEmpty(): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Cette méthode nécessiterait une coordination avec MessageRepository
        // Pour l'instant, retourner 0
        return 0;
      },
      "Conversation",
      "empty-conversations"
    );
  }

  async deleteOldArchived(olderThan: Date): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.conversationModel
          .deleteMany({
            isArchived: true,
            updatedAt: { $lt: olderThan },
          })
          .exec();
        return result.deletedCount || 0;
      },
      "Conversation",
      olderThan.toISOString()
    );
  }

  async cleanupInactiveParticipants(): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Cette méthode nécessiterait une validation avec UserRepository
        // Pour l'instant, retourner 0
        return 0;
      },
      "Conversation",
      "cleanup-participants"
    );
  }
}
