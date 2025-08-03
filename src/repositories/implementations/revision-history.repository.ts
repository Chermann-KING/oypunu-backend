import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  RevisionHistory,
  RevisionHistoryDocument,
} from "../../dictionary/schemas/revision-history.schema";
import {
  IRevisionHistoryRepository,
  CreateRevisionData,
} from "../interfaces/revision-history.repository.interface";
import { DatabaseErrorHandler } from "../../common/errors"

@Injectable()
export class RevisionHistoryRepository implements IRevisionHistoryRepository {
  constructor(
    @InjectModel(RevisionHistory.name)
    private revisionHistoryModel: Model<RevisionHistoryDocument>
  ) {}

  /**
   * Créer une nouvelle révision
   */
  async create(revisionData: CreateRevisionData): Promise<RevisionHistory> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const revision = new this.revisionHistoryModel({
          ...revisionData,
          wordId: new Types.ObjectId(revisionData.wordId),
          modifiedBy: new Types.ObjectId(revisionData.modifiedBy),
          modifiedAt: revisionData.modifiedAt || new Date(),
        });

        return await revision.save();
      },
      "RevisionHistory",
      "create"
    );
  }

  /**
   * Trouver une révision par ID
   */
  async findById(id: string): Promise<RevisionHistory | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.revisionHistoryModel
          .findById(id)
          .populate("modifiedBy", "username email")
          .populate("reviewedBy", "username email")
          .exec();
      },
      "RevisionHistory",
      id
    );
  }

  /**
   * Récupérer toutes les révisions d'un mot
   */
  async findByWordId(
    wordId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      sortBy?: "modifiedAt" | "version" | "priority";
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          status,
          sortBy = "modifiedAt",
          sortOrder = "desc",
        } = options;

        const query: any = { wordId: new Types.ObjectId(wordId) };
        if (status && status !== "all") {
          query.status = status;
        }

        const sortObject: any = {};
        sortObject[sortBy] = sortOrder === "asc" ? 1 : -1;

        const [revisions, total] = await Promise.all([
          this.revisionHistoryModel
            .find(query)
            .sort(sortObject)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("modifiedBy", "username email")
            .populate("reviewedBy", "username email")
            .exec(),
          this.revisionHistoryModel.countDocuments(query).exec(),
        ]);

        return {
          revisions,
          total,
          page,
          limit,
        };
      },
      "RevisionHistory",
      `findByWordId-${wordId}`
    );
  }

  /**
   * Récupérer les révisions d'un utilisateur
   */
  async findByUserId(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      wordId?: string;
    } = {}
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { page = 1, limit = 10, status, wordId } = options;

        const query: any = { modifiedBy: new Types.ObjectId(userId) };
        if (status && status !== "all") {
          query.status = status;
        }
        if (wordId) {
          query.wordId = new Types.ObjectId(wordId);
        }

        const [revisions, total] = await Promise.all([
          this.revisionHistoryModel
            .find(query)
            .sort({ modifiedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("wordId", "word language")
            .populate("reviewedBy", "username email")
            .exec(),
          this.revisionHistoryModel.countDocuments(query).exec(),
        ]);

        return {
          revisions,
          total,
          page,
          limit,
        };
      },
      "RevisionHistory",
      `findByUserId-${userId}`
    );
  }

  /**
   * Mettre à jour une révision
   */
  async update(
    id: string,
    updateData: {
      status?: "pending" | "approved" | "rejected" | "cancelled";
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNotes?: string;
      actualProcessingTime?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<RevisionHistory | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updateFields: any = { ...updateData };

        if (updateData.reviewedBy) {
          updateFields.reviewedBy = new Types.ObjectId(updateData.reviewedBy);
        }

        return await this.revisionHistoryModel
          .findByIdAndUpdate(id, updateFields, { new: true })
          .populate("modifiedBy", "username email")
          .populate("reviewedBy", "username email")
          .exec();
      },
      "RevisionHistory",
      id
    );
  }

  /**
   * Supprimer une révision
   */
  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.revisionHistoryModel
          .findByIdAndDelete(id)
          .exec();
        return !!result;
      },
      "RevisionHistory",
      id
    );
  }

  /**
   * Approuver une révision
   */
  async approve(
    id: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<RevisionHistory | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const revision = await this.revisionHistoryModel.findById(id).exec();
        if (!revision) return null;

        const processingTime = revision.estimatedProcessingTime
          ? Math.ceil(
              (Date.now() - revision.modifiedAt.getTime()) / (1000 * 60)
            )
          : undefined;

        return await this.revisionHistoryModel
          .findByIdAndUpdate(
            id,
            {
              status: "approved",
              reviewedBy: new Types.ObjectId(reviewerId),
              reviewedAt: new Date(),
              reviewNotes,
              actualProcessingTime: processingTime,
            },
            { new: true }
          )
          .populate("modifiedBy", "username email")
          .populate("reviewedBy", "username email")
          .exec();
      },
      "RevisionHistory",
      `approve-${id}`
    );
  }

  /**
   * Rejeter une révision
   */
  async reject(
    id: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<RevisionHistory | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const revision = await this.revisionHistoryModel.findById(id).exec();
        if (!revision) return null;

        const processingTime = revision.estimatedProcessingTime
          ? Math.ceil(
              (Date.now() - revision.modifiedAt.getTime()) / (1000 * 60)
            )
          : undefined;

        return await this.revisionHistoryModel
          .findByIdAndUpdate(
            id,
            {
              status: "rejected",
              reviewedBy: new Types.ObjectId(reviewerId),
              reviewedAt: new Date(),
              reviewNotes,
              actualProcessingTime: processingTime,
            },
            { new: true }
          )
          .populate("modifiedBy", "username email")
          .populate("reviewedBy", "username email")
          .exec();
      },
      "RevisionHistory",
      `reject-${id}`
    );
  }

  /**
   * Obtenir les statistiques des révisions
   */
  async getStatistics(options: {
    period: string;
    userId?: string;
    wordId?: string;
  }): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    topContributors: Array<{
      userId: string;
      username: string;
      revisionCount: number;
      approvalRate: number;
    }>;
    averageProcessingTime: number;
    byPriority: {
      low: number;
      medium: number;
      high: number;
      urgent: number;
    };
    byAction: {
      create: number;
      update: number;
      delete: number;
      restore: number;
    };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let matchQuery: any = {};
        if (options.userId) {
          matchQuery.modifiedBy = new Types.ObjectId(options.userId);
        }
        if (options.wordId) {
          matchQuery.wordId = new Types.ObjectId(options.wordId);
        }

        const pipeline = [
          { $match: matchQuery },
          {
            $facet: {
              // Statistiques générales
              generalStats: [
                {
                  $group: {
                    _id: null,
                    total: { $sum: 1 },
                    pending: {
                      $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
                    },
                    approved: {
                      $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
                    },
                    rejected: {
                      $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
                    },
                    cancelled: {
                      $sum: {
                        $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
                      },
                    },
                    today: {
                      $sum: {
                        $cond: [{ $gte: ["$modifiedAt", today] }, 1, 0],
                      },
                    },
                    thisWeek: {
                      $sum: {
                        $cond: [{ $gte: ["$modifiedAt", thisWeek] }, 1, 0],
                      },
                    },
                    thisMonth: {
                      $sum: {
                        $cond: [{ $gte: ["$modifiedAt", thisMonth] }, 1, 0],
                      },
                    },
                    averageProcessingTime: { $avg: "$actualProcessingTime" },
                  },
                },
              ],
              // Statistiques par priorité
              priorityStats: [
                {
                  $group: {
                    _id: "$priority",
                    count: { $sum: 1 },
                  },
                },
              ],
              // Statistiques par action
              actionStats: [
                {
                  $group: {
                    _id: "$action",
                    count: { $sum: 1 },
                  },
                },
              ],
              // Top contributeurs
              topContributors: [
                {
                  $group: {
                    _id: "$modifiedBy",
                    revisionCount: { $sum: 1 },
                    approved: {
                      $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
                    },
                  },
                },
                {
                  $addFields: {
                    approvalRate: {
                      $multiply: [
                        { $divide: ["$approved", "$revisionCount"] },
                        100,
                      ],
                    },
                  },
                },
                { $sort: { revisionCount: -1 } },
                { $limit: 10 },
                {
                  $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user",
                  },
                },
                {
                  $project: {
                    userId: { $toString: "$_id" },
                    username: { $arrayElemAt: ["$user.username", 0] },
                    revisionCount: 1,
                    approvalRate: { $round: ["$approvalRate", 2] },
                  },
                },
              ],
            },
          },
        ];

        const [result] = await this.revisionHistoryModel
          .aggregate(pipeline as any)
          .exec();

        const generalStats = result.generalStats[0] || {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          cancelled: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
          averageProcessingTime: 0,
        };

        const priorityStats = result.priorityStats.reduce(
          (acc: any, stat: any) => {
            acc[stat._id || "medium"] = stat.count;
            return acc;
          },
          { low: 0, medium: 0, high: 0, urgent: 0 }
        );

        const actionStats = result.actionStats.reduce(
          (acc: any, stat: any) => {
            acc[stat._id || "update"] = stat.count;
            return acc;
          },
          { create: 0, update: 0, delete: 0, restore: 0 }
        );

        return {
          ...generalStats,
          averageProcessingTime: Math.round(
            generalStats.averageProcessingTime || 0
          ),
          topContributors: result.topContributors || [],
          byPriority: priorityStats,
          byAction: actionStats,
        };
      },
      "RevisionHistory",
      "getStatistics"
    );
  }

  /**
   * Rechercher dans les révisions
   */
  async search(
    query: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      userId?: string;
      wordId?: string;
      priority?: string;
      action?: string;
    } = {}
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          status,
          userId,
          wordId,
          priority,
          action,
        } = options;

        const searchQuery: any = {
          $text: { $search: query },
        };

        if (status && status !== "all") searchQuery.status = status;
        if (userId) searchQuery.modifiedBy = new Types.ObjectId(userId);
        if (wordId) searchQuery.wordId = new Types.ObjectId(wordId);
        if (priority) searchQuery.priority = priority;
        if (action) searchQuery.action = action;

        const [revisions, total] = await Promise.all([
          this.revisionHistoryModel
            .find(searchQuery, { score: { $meta: "textScore" } })
            .sort({ score: { $meta: "textScore" }, modifiedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("modifiedBy", "username email")
            .populate("reviewedBy", "username email")
            .populate("wordId", "word language")
            .exec(),
          this.revisionHistoryModel.countDocuments(searchQuery).exec(),
        ]);

        return {
          revisions,
          total,
          page,
          limit,
          hasMore: page * limit < total,
        };
      },
      "RevisionHistory",
      `search-${query}`
    );
  }

  /**
   * Obtenir les révisions en attente par priorité
   */
  async getPendingByPriority(
    priority?: "low" | "medium" | "high" | "urgent"
  ): Promise<RevisionHistory[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = { status: "pending" };
        if (priority) {
          query.priority = priority;
        }

        return await this.revisionHistoryModel
          .find(query)
          .sort({ priority: -1, modifiedAt: 1 }) // Urgent d'abord, puis par ancienneté
          .populate("modifiedBy", "username email")
          .populate("wordId", "word language")
          .exec();
      },
      "RevisionHistory",
      `pendingByPriority-${priority || "all"}`
    );
  }

  /**
   * Compter les révisions par statut
   */
  async countByStatus(
    status: "pending" | "approved" | "rejected" | "cancelled"
  ): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.revisionHistoryModel
          .countDocuments({ status })
          .exec();
      },
      "RevisionHistory",
      `countByStatus-${status}`
    );
  }

  /**
   * Obtenir les révisions récentes
   */
  async getRecentRevisions(
    limit = 10,
    userId?: string
  ): Promise<RevisionHistory[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = {};
        if (userId) {
          query.modifiedBy = new Types.ObjectId(userId);
        }

        return await this.revisionHistoryModel
          .find(query)
          .sort({ modifiedAt: -1 })
          .limit(limit)
          .populate("modifiedBy", "username email")
          .populate("reviewedBy", "username email")
          .populate("wordId", "word language")
          .exec();
      },
      "RevisionHistory",
      `recent-${userId || "all"}`
    );
  }

  /**
   * Obtenir le temps moyen de traitement
   */
  async getAverageProcessingTime(
    period: "day" | "week" | "month" | "year" = "month"
  ): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case "day":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "year":
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        }

        const [result] = await this.revisionHistoryModel
          .aggregate([
            {
              $match: {
                reviewedAt: { $gte: startDate },
                actualProcessingTime: { $exists: true, $ne: null },
              },
            },
            {
              $group: {
                _id: null,
                averageTime: { $avg: "$actualProcessingTime" },
              },
            },
          ])
          .exec();

        return Math.round(result?.averageTime || 0);
      },
      "RevisionHistory",
      `averageProcessingTime-${period}`
    );
  }

  /**
   * Obtenir les révisions par tags
   */
  async findByTags(
    tags: string[],
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { page = 1, limit = 10 } = options;

        const query = { tags: { $in: tags } };

        const [revisions, total] = await Promise.all([
          this.revisionHistoryModel
            .find(query)
            .sort({ modifiedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate("modifiedBy", "username email")
            .populate("wordId", "word language")
            .exec(),
          this.revisionHistoryModel.countDocuments(query).exec(),
        ]);

        return {
          revisions,
          total,
          page,
          limit,
        };
      },
      "RevisionHistory",
      `findByTags-${tags.join(",")}`
    );
  }

  /**
   * Archiver les anciennes révisions
   */
  async archiveOldRevisions(olderThanDays: number): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.revisionHistoryModel
          .deleteMany({
            modifiedAt: { $lt: cutoffDate },
            status: { $in: ["approved", "rejected", "cancelled"] },
          })
          .exec();

        return result.deletedCount || 0;
      },
      "RevisionHistory",
      `archive-${olderThanDays}days`
    );
  }

  /**
   * Compter les révisions faites aujourd'hui par un utilisateur
   */
  async countTodayRevisions(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return 0;
        }

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const count = await this.revisionHistoryModel.countDocuments({
          userId,
          createdAt: {
            $gte: startOfDay,
            $lt: endOfDay
          }
        }).exec();

        return count;
      },
      "RevisionHistory",
      userId
    );
  }
}