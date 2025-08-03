import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  CommunityPost, 
  CommunityPostDocument 
} from '../../communities/schemas/community-post.schema';
import { 
  ICommunityPostRepository, 
  CreateCommunityPostData, 
  UpdateCommunityPostData 
} from '../interfaces/community-post.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

/**
 * 📝 REPOSITORY COMMUNITY POST - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository CommunityPost utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les posts communautaires.
 */
@Injectable()
export class CommunityPostRepository implements ICommunityPostRepository {
  constructor(
    @InjectModel(CommunityPost.name) private postModel: Model<CommunityPostDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(postData: CreateCommunityPostData): Promise<CommunityPost> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const post = new this.postModel({
          ...postData,
          communityId: new Types.ObjectId(postData.communityId),
          authorId: new Types.ObjectId(postData.authorId),
        });
        return post.save();
      },
      'CommunityPost'
    );
  }

  async findById(id: string): Promise<CommunityPost | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.postModel.findById(id).exec();
      },
      'CommunityPost',
      id
    );
  }

  async update(id: string, updateData: UpdateCommunityPostData): Promise<CommunityPost | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.postModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .exec();
      },
      'CommunityPost',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.postModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'CommunityPost',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findByCommunity(communityId: string, options: {
    page?: number;
    limit?: number;
    sortBy?: 'score' | 'createdAt' | 'views' | 'commentsCount';
    sortOrder?: 'asc' | 'desc';
    status?: 'active' | 'hidden' | 'deleted' | 'all';
  } = {}): Promise<{
    posts: CommunityPost[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          sortBy = 'createdAt',
          sortOrder = 'desc',
          status = 'active'
        } = options;

        const filter: any = { communityId: new Types.ObjectId(communityId) };
        if (status !== 'all') {
          filter.status = status;
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [posts, total] = await Promise.all([
          this.postModel
            .find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.postModel.countDocuments(filter).exec(),
        ]);

        return { posts, total, page, limit };
      },
      'CommunityPost'
    );
  }

  async findByAuthor(authorId: string, options: {
    page?: number;
    limit?: number;
    communityId?: string;
  } = {}): Promise<{
    posts: CommunityPost[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { page = 1, limit = 10, communityId } = options;

        const filter: any = { authorId: new Types.ObjectId(authorId) };
        if (communityId) {
          filter.communityId = new Types.ObjectId(communityId);
        }

        const [posts, total] = await Promise.all([
          this.postModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.postModel.countDocuments(filter).exec(),
        ]);

        return { posts, total, page, limit };
      },
      'CommunityPost'
    );
  }

  async search(query: string, options: {
    communityId?: string;
    limit?: number;
    status?: 'active' | 'hidden' | 'deleted';
  } = {}): Promise<CommunityPost[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { communityId, limit = 10, status = 'active' } = options;
        const searchRegex = new RegExp(query, 'i');

        const filter: any = {
          status,
          $or: [
            { title: { $regex: searchRegex } },
            { content: { $regex: searchRegex } },
          ],
        };

        if (communityId) {
          filter.communityId = new Types.ObjectId(communityId);
        }

        return this.postModel
          .find(filter)
          .sort({ score: -1, createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'CommunityPost'
    );
  }

  async findByTags(tags: string[], options: {
    communityId?: string;
    limit?: number;
  } = {}): Promise<CommunityPost[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { communityId, limit = 10 } = options;

        const filter: any = { tags: { $in: tags } };
        if (communityId) {
          filter.communityId = new Types.ObjectId(communityId);
        }

        return this.postModel
          .find(filter)
          .sort({ score: -1, createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'CommunityPost'
    );
  }

  // ========== STATISTIQUES ET SCORING ==========

  async updateScore(postId: string, scoreChange: number): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }
        const result = await this.postModel
          .updateOne(
            { _id: postId },
            { $inc: { score: scoreChange } }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  async updateVoteCounts(postId: string, upvotes: number, downvotes: number): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }
        const result = await this.postModel
          .updateOne(
            { _id: postId },
            { 
              upvotes, 
              downvotes,
              score: upvotes - downvotes
            }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  async incrementViews(postId: string, userId?: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }

        // Si on a un userId, vérifier qu'il n'a pas déjà vu aujourd'hui
        if (userId) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const post = await this.postModel.findById(postId).exec();
          if (!post) return false;

          // Réinitialiser la liste si c'est un nouveau jour
          if (!post.lastViewersReset || post.lastViewersReset < today) {
            await this.postModel.updateOne(
              { _id: postId },
              { 
                viewersToday: [userId],
                lastViewersReset: new Date(),
                $inc: { views: 1 }
              }
            ).exec();
            return true;
          }

          // Si l'utilisateur n'a pas encore vu aujourd'hui
          if (!post.viewersToday.includes(userId)) {
            await this.postModel.updateOne(
              { _id: postId },
              { 
                $addToSet: { viewersToday: userId },
                $inc: { views: 1 }
              }
            ).exec();
            return true;
          }
          return false; // Déjà vu aujourd'hui
        }

        // Sans userId, incrémenter directement
        const result = await this.postModel
          .updateOne({ _id: postId }, { $inc: { views: 1 } })
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  async incrementCommentsCount(postId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }
        const result = await this.postModel
          .updateOne({ _id: postId }, { $inc: { commentsCount: 1 } })
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  async decrementCommentsCount(postId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }
        const result = await this.postModel
          .updateOne(
            { _id: postId },
            { $inc: { commentsCount: -1 } }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  // ========== MODÉRATION ==========

  async updateStatus(postId: string, status: 'active' | 'hidden' | 'deleted', reason?: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }
        const updateData: any = { status };
        if (reason) {
          updateData.moderationReason = reason;
        }

        const result = await this.postModel
          .updateOne({ _id: postId }, updateData)
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  async markAsReported(postId: string, reportedBy: string, reason: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(postId)) {
          return false;
        }
        const result = await this.postModel
          .updateOne(
            { _id: postId },
            {
              $addToSet: { 
                reports: { 
                  reportedBy: new Types.ObjectId(reportedBy), 
                  reason, 
                  reportedAt: new Date() 
                }
              }
            }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'CommunityPost',
      postId
    );
  }

  async findReported(options: {
    communityId?: string;
    limit?: number;
  } = {}): Promise<CommunityPost[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { communityId, limit = 10 } = options;

        const filter: any = { 'reports.0': { $exists: true } };
        if (communityId) {
          filter.communityId = new Types.ObjectId(communityId);
        }

        return this.postModel
          .find(filter)
          .sort({ 'reports.reportedAt': -1 })
          .limit(limit)
          .exec();
      },
      'CommunityPost'
    );
  }

  // ========== STATISTIQUES ==========

  async countByCommunity(communityId: string, status?: 'active' | 'hidden' | 'deleted'): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const filter: any = { communityId: new Types.ObjectId(communityId) };
        if (status) {
          filter.status = status;
        }
        return this.postModel.countDocuments(filter).exec();
      },
      'CommunityPost',
      communityId
    );
  }

  async countByAuthor(authorId: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.postModel
          .countDocuments({ authorId: new Types.ObjectId(authorId) })
          .exec();
      },
      'CommunityPost',
      authorId
    );
  }

  async findMostPopular(options: {
    communityId?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  } = {}): Promise<CommunityPost[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { communityId, timeframe = 'all', limit = 10 } = options;

        const filter: any = { status: 'active' };
        if (communityId) {
          filter.communityId = new Types.ObjectId(communityId);
        }

        // Filtrer par période
        if (timeframe !== 'all') {
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
          }
          filter.createdAt = { $gte: startDate };
        }

        return this.postModel
          .find(filter)
          .sort({ score: -1, views: -1 })
          .limit(limit)
          .exec();
      },
      'CommunityPost'
    );
  }

  async findRecent(options: {
    communityId?: string;
    limit?: number;
    status?: 'active' | 'hidden' | 'deleted';
  } = {}): Promise<CommunityPost[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { communityId, limit = 10, status = 'active' } = options;

        const filter: any = { status };
        if (communityId) {
          filter.communityId = new Types.ObjectId(communityId);
        }

        return this.postModel
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'CommunityPost'
    );
  }
}