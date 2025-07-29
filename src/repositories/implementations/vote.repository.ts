import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Vote, VoteDocument } from "../../communities/schemas/vote.schema";
import { IVoteRepository } from "../interfaces/vote.repository.interface";
import { DatabaseErrorHandler } from "../../common/utils/database-error-handler.util";

/**
 * 🗳️ REPOSITORY VOTE - IMPLÉMENTATION MONGOOSE
 *
 * Implémentation concrète du repository Vote utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les votes.
 *
 * Fonctionnalités :
 * - CRUD complet des votes
 * - Gestion intelligente des votes (up/down)
 * - Statistiques et analytics
 * - Détection de contenu controversé
 * - Validation et intégrité
 */
@Injectable()
export class VoteRepository implements IVoteRepository {
  constructor(@InjectModel(Vote.name) private voteModel: Model<VoteDocument>) {}

  // ========== CRUD DE BASE ==========

  async create(voteData: {
    userId: string;
    targetType: "community_post" | "post_comment";
    targetId: string;
    voteType: "up" | "down";
    reason?: string;
    weight?: number;
  }): Promise<Vote> {
    return DatabaseErrorHandler.handleCreateOperation(async () => {
      if (
        !Types.ObjectId.isValid(voteData.userId) ||
        !Types.ObjectId.isValid(voteData.targetId)
      ) {
        throw new Error("Invalid ObjectId format");
      }

      const newVote = new this.voteModel({
        ...voteData,
        weight: voteData.weight || 1,
      });
      return newVote.save();
    }, "Vote");
  }

  async findById(id: string): Promise<Vote | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.voteModel
          .findById(id)
          .populate("userId", "username email")
          .exec();
      },
      "Vote",
      id
    );
  }

  async update(id: string, updateData: Partial<Vote>): Promise<Vote | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.voteModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate("userId", "username email")
          .exec();
      },
      "Vote",
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.voteModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      "Vote",
      id
    );
  }

  // ========== GESTION DES VOTES ==========

  async findUserVote(
    userId: string,
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<Vote | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(userId) ||
          !Types.ObjectId.isValid(targetId)
        ) {
          return null;
        }
        return this.voteModel
          .findOne({ userId, targetType, targetId })
          .populate("userId", "username email")
          .exec();
      },
      "Vote",
      `${userId}-${targetType}-${targetId}`
    );
  }

  async hasUserVoted(
    userId: string,
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (
        !Types.ObjectId.isValid(userId) ||
        !Types.ObjectId.isValid(targetId)
      ) {
        return false;
      }
      const vote = await this.voteModel
        .findOne({ userId, targetType, targetId })
        .select("_id")
        .exec();
      return vote !== null;
    }, "Vote");
  }

  async changeVoteType(
    userId: string,
    targetType: "community_post" | "post_comment",
    targetId: string,
    newVoteType: "up" | "down"
  ): Promise<Vote | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(userId) ||
          !Types.ObjectId.isValid(targetId)
        ) {
          return null;
        }
        return this.voteModel
          .findOneAndUpdate(
            { userId, targetType, targetId },
            { voteType: newVoteType },
            { new: true }
          )
          .populate("userId", "username email")
          .exec();
      },
      "Vote",
      `${userId}-${targetType}-${targetId}`
    );
  }

  async removeUserVote(
    userId: string,
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(userId) ||
          !Types.ObjectId.isValid(targetId)
        ) {
          return false;
        }
        const result = await this.voteModel
          .findOneAndDelete({ userId, targetType, targetId })
          .exec();
        return result !== null;
      },
      "Vote",
      `${userId}-${targetType}-${targetId}`
    );
  }

  async vote(
    userId: string,
    targetType: "community_post" | "post_comment",
    targetId: string,
    voteType: "up" | "down",
    reason?: string
  ): Promise<{
    vote: Vote;
    action: "created" | "updated" | "removed";
    previousVoteType?: "up" | "down";
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(userId) ||
          !Types.ObjectId.isValid(targetId)
        ) {
          throw new Error("Invalid ObjectId format");
        }

        const existingVote = await this.voteModel
          .findOne({ userId, targetType, targetId })
          .exec();

        if (!existingVote) {
          // Créer un nouveau vote
          const newVote = await this.create({
            userId,
            targetType,
            targetId,
            voteType,
            reason,
          });
          return { vote: newVote, action: "created" as const };
        }

        if (existingVote.voteType === voteType) {
          // Même type de vote : supprimer
          await this.removeUserVote(userId, targetType, targetId);
          return {
            vote: existingVote,
            action: "removed" as const,
            previousVoteType: existingVote.voteType,
          };
        } else {
          // Changer le type de vote
          const updatedVote = await this.changeVoteType(
            userId,
            targetType,
            targetId,
            voteType
          );
          return {
            vote: updatedVote!,
            action: "updated" as const,
            previousVoteType: existingVote.voteType,
          };
        }
      },
      "Vote",
      `${userId}-${targetType}-${targetId}`
    );
  }

  // ========== STATISTIQUES DES VOTES ==========

  async findByTarget(
    targetType: "community_post" | "post_comment",
    targetId: string,
    options: {
      voteType?: "up" | "down";
      page?: number;
      limit?: number;
      sortBy?: "createdAt" | "weight";
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    votes: Vote[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(targetId)) {
        return { votes: [], total: 0, page: 1, limit: 20 };
      }

      const {
        voteType,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const filter: any = { targetType, targetId };
      if (voteType) {
        filter.voteType = voteType;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const skip = (page - 1) * limit;

      const [votes, total] = await Promise.all([
        this.voteModel
          .find(filter)
          .populate("userId", "username email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.voteModel.countDocuments(filter).exec(),
      ]);

      return { votes, total, page, limit };
    }, "Vote");
  }

  async countByTarget(
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<{
    upVotes: number;
    downVotes: number;
    totalVotes: number;
    score: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(targetId)) {
        return { upVotes: 0, downVotes: 0, totalVotes: 0, score: 0 };
      }

      const [upVotes, downVotes] = await Promise.all([
        this.voteModel
          .countDocuments({ targetType, targetId, voteType: "up" })
          .exec(),
        this.voteModel
          .countDocuments({ targetType, targetId, voteType: "down" })
          .exec(),
      ]);

      const totalVotes = upVotes + downVotes;
      const score = upVotes - downVotes;

      return { upVotes, downVotes, totalVotes, score };
    }, "Vote");
  }

  async getWeightedScore(
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<{
    upVotes: number;
    downVotes: number;
    weightedScore: number;
    averageWeight: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(targetId)) {
        return { upVotes: 0, downVotes: 0, weightedScore: 0, averageWeight: 0 };
      }

      const stats = await this.voteModel
        .aggregate([
          { $match: { targetType, targetId: new Types.ObjectId(targetId) } },
          {
            $group: {
              _id: "$voteType",
              count: { $sum: 1 },
              totalWeight: { $sum: "$weight" },
            },
          },
        ])
        .exec();

      let upVotes = 0,
        downVotes = 0,
        upWeight = 0,
        downWeight = 0;

      stats.forEach((stat) => {
        if (stat._id === "up") {
          upVotes = stat.count;
          upWeight = stat.totalWeight;
        } else if (stat._id === "down") {
          downVotes = stat.count;
          downWeight = stat.totalWeight;
        }
      });

      const totalVotes = upVotes + downVotes;
      const totalWeight = upWeight + downWeight;
      const weightedScore = upWeight - downWeight;
      const averageWeight = totalVotes > 0 ? totalWeight / totalVotes : 0;

      return { upVotes, downVotes, weightedScore, averageWeight };
    }, "Vote");
  }

  async findByUser(
    userId: string,
    options: {
      targetType?: "community_post" | "post_comment";
      voteType?: "up" | "down";
      page?: number;
      limit?: number;
      sortBy?: "createdAt";
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    votes: Vote[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return { votes: [], total: 0, page: 1, limit: 20 };
      }

      const {
        targetType,
        voteType,
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const filter: any = { userId };
      if (targetType) filter.targetType = targetType;
      if (voteType) filter.voteType = voteType;

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const skip = (page - 1) * limit;

      const [votes, total] = await Promise.all([
        this.voteModel
          .find(filter)
          .populate("userId", "username email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.voteModel.countDocuments(filter).exec(),
      ]);

      return { votes, total, page, limit };
    }, "Vote");
  }

  // ========== MÉTHODES SIMPLIFIÉES (POUR L'INSTANT) ==========
  // Les méthodes suivantes sont des implémentations basiques
  // qui peuvent être étoffées selon les besoins

  async getMostVoted(
    targetType: "community_post" | "post_comment",
    options: {
      voteType?: "up" | "down" | "both";
      timeframe?: "day" | "week" | "month" | "all";
      limit?: number;
      minVotes?: number;
    } = {}
  ): Promise<
    Array<{
      targetId: string;
      upVotes: number;
      downVotes: number;
      score: number;
      weightedScore: number;
    }>
  > {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const { limit = 10 } = options;

      const pipeline = [
        { $match: { targetType } },
        {
          $group: {
            _id: "$targetId",
            upVotes: {
              $sum: { $cond: [{ $eq: ["$voteType", "up"] }, 1, 0] },
            },
            downVotes: {
              $sum: { $cond: [{ $eq: ["$voteType", "down"] }, 1, 0] },
            },
            weightedScore: {
              $sum: {
                $cond: [
                  { $eq: ["$voteType", "up"] },
                  "$weight",
                  { $multiply: ["$weight", -1] },
                ],
              },
            },
          },
        },
        {
          $addFields: {
            score: { $subtract: ["$upVotes", "$downVotes"] },
            targetId: { $toString: "$_id" },
          },
        },
        { $sort: { score: -1 as const } },
        { $limit: limit },
      ];

      return this.voteModel.aggregate(pipeline).exec();
    }, "Vote");
  }

  async getControversial(
    targetType: "community_post" | "post_comment",
    options: {
      timeframe?: "day" | "week" | "month" | "all";
      limit?: number;
      minVotes?: number;
    } = {}
  ): Promise<
    Array<{
      targetId: string;
      upVotes: number;
      downVotes: number;
      controversyScore: number;
    }>
  > {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const { limit = 10, minVotes = 5 } = options;

      const pipeline = [
        { $match: { targetType } },
        {
          $group: {
            _id: "$targetId",
            upVotes: {
              $sum: { $cond: [{ $eq: ["$voteType", "up"] }, 1, 0] },
            },
            downVotes: {
              $sum: { $cond: [{ $eq: ["$voteType", "down"] }, 1, 0] },
            },
          },
        },
        {
          $addFields: {
            totalVotes: { $add: ["$upVotes", "$downVotes"] },
            controversyScore: {
              $multiply: [
                { $add: ["$upVotes", "$downVotes"] },
                {
                  $subtract: [
                    1,
                    {
                      $abs: {
                        $divide: [
                          { $subtract: ["$upVotes", "$downVotes"] },
                          { $add: ["$upVotes", "$downVotes"] },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
            targetId: { $toString: "$_id" },
          },
        },
        { $match: { totalVotes: { $gte: minVotes } } },
        { $sort: { controversyScore: -1 as const } },
        { $limit: limit },
      ];

      return this.voteModel.aggregate(pipeline).exec();
    }, "Vote");
  }

  // ========== MÉTHODES STUB (À IMPLÉMENTER) ==========
  // Ces méthodes retournent des valeurs par défaut pour l'instant

  async getVoteStats(options?: any): Promise<any[]> {
    return [];
  }

  async getVoteTrends(
    targetType: "community_post" | "post_comment",
    targetId: string,
    days?: number
  ): Promise<any[]> {
    return [];
  }

  async findVotesWithReasons(options?: any): Promise<Vote[]> {
    return this.voteModel
      .find({ reason: { $exists: true, $ne: "" } })
      .limit(10)
      .exec();
  }

  async getCommonDownvoteReasons(limit: number = 10): Promise<
    Array<{
      reason: string;
      count: number;
      percentage: number;
    }>
  > {
    return [];
  }

  async detectSuspiciousVoting(
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    rapidVotes: number;
    sameIPVotes: number;
    newAccountVotes: number;
  }> {
    return {
      isSuspicious: false,
      reasons: [],
      rapidVotes: 0,
      sameIPVotes: 0,
      newAccountVotes: 0,
    };
  }

  async validateIntegrity(): Promise<any> {
    return { invalidTargets: [], invalidUsers: [] };
  }

  async cleanupOrphaned(): Promise<number> {
    return 0;
  }

  async deleteUserVotes(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) {
      return 0;
    }
    const result = await this.voteModel.deleteMany({ userId }).exec();
    return result.deletedCount || 0;
  }

  async deleteTargetVotes(
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<number> {
    if (!Types.ObjectId.isValid(targetId)) {
      return 0;
    }
    const result = await this.voteModel
      .deleteMany({ targetType, targetId })
      .exec();
    return result.deletedCount || 0;
  }

  async findDuplicates(): Promise<any[]> {
    return [];
  }

  async cachePopularScores(limit?: number): Promise<void> {
    // Cache à implémenter
  }

  async invalidateScoreCache(
    targetType: "community_post" | "post_comment",
    targetId: string
  ): Promise<void> {
    // Cache à implémenter
  }

  async getCachedScores(targetIds: string[]): Promise<Record<string, any>> {
    return {};
  }
}
