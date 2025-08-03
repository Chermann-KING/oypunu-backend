import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  PostComment, 
  PostCommentDocument 
} from '../../communities/schemas/post-comment.schema';
import { 
  IPostCommentRepository, 
  CreatePostCommentData, 
  UpdatePostCommentData 
} from '../interfaces/post-comment.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

/**
 * 💬 REPOSITORY POST COMMENT - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository PostComment utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les commentaires.
 */
@Injectable()
export class PostCommentRepository implements IPostCommentRepository {
  constructor(
    @InjectModel(PostComment.name) private commentModel: Model<PostCommentDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(commentData: CreatePostCommentData): Promise<PostComment> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const comment = new this.commentModel({
          ...commentData,
          postId: new Types.ObjectId(commentData.postId),
          authorId: new Types.ObjectId(commentData.authorId),
          ...(commentData.parentCommentId && { 
            parentCommentId: new Types.ObjectId(commentData.parentCommentId) 
          }),
        });
        return comment.save();
      },
      'PostComment'
    );
  }

  async findById(id: string): Promise<PostComment | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.commentModel.findById(id).exec();
      },
      'PostComment',
      id
    );
  }

  async update(id: string, updateData: UpdatePostCommentData): Promise<PostComment | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.commentModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .exec();
      },
      'PostComment',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.commentModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'PostComment',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findByPost(postId: string, options: {
    page?: number;
    limit?: number;
    sortBy?: 'score' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    status?: 'active' | 'deleted' | 'hidden' | 'all';
    includeReplies?: boolean;
  } = {}): Promise<{
    comments: PostComment[];
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
          sortOrder = 'asc',
          status = 'active',
          includeReplies = false
        } = options;

        const filter: any = { postId: new Types.ObjectId(postId) };
        if (status !== 'all') {
          filter.status = status;
        }
        
        // Si on ne veut pas les réponses, on prend seulement les commentaires de niveau racine
        if (!includeReplies) {
          filter.parentCommentId = { $exists: false };
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [comments, total] = await Promise.all([
          this.commentModel
            .find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.commentModel.countDocuments(filter).exec(),
        ]);

        return { comments, total, page, limit };
      },
      'PostComment'
    );
  }

  async findByAuthor(authorId: string, options: {
    page?: number;
    limit?: number;
    postId?: string;
  } = {}): Promise<{
    comments: PostComment[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { page = 1, limit = 10, postId } = options;

        const filter: any = { authorId: new Types.ObjectId(authorId) };
        if (postId) {
          filter.postId = new Types.ObjectId(postId);
        }

        const [comments, total] = await Promise.all([
          this.commentModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.commentModel.countDocuments(filter).exec(),
        ]);

        return { comments, total, page, limit };
      },
      'PostComment'
    );
  }

  async findReplies(parentCommentId: string, options: {
    limit?: number;
    sortBy?: 'score' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<PostComment[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          limit = 10,
          sortBy = 'createdAt',
          sortOrder = 'asc'
        } = options;

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        return this.commentModel
          .find({ 
            parentCommentId: new Types.ObjectId(parentCommentId),
            status: 'active'
          })
          .sort(sort)
          .limit(limit)
          .exec();
      },
      'PostComment'
    );
  }

  async search(query: string, options: {
    postId?: string;
    limit?: number;
    status?: 'active' | 'deleted' | 'hidden';
  } = {}): Promise<PostComment[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { postId, limit = 10, status = 'active' } = options;
        const searchRegex = new RegExp(query, 'i');

        const filter: any = {
          status,
          content: { $regex: searchRegex },
        };

        if (postId) {
          filter.postId = new Types.ObjectId(postId);
        }

        return this.commentModel
          .find(filter)
          .sort({ score: -1, createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'PostComment'
    );
  }

  // ========== STATISTIQUES ET SCORING ==========

  async updateScore(commentId: string, scoreChange: number): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne(
            { _id: commentId },
            { $inc: { score: scoreChange } }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  async updateVoteCounts(commentId: string, upvotes: number, downvotes: number): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne(
            { _id: commentId },
            { 
              upvotes, 
              downvotes,
              score: upvotes - downvotes
            }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  async incrementRepliesCount(commentId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne({ _id: commentId }, { $inc: { repliesCount: 1 } })
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  async decrementRepliesCount(commentId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne(
            { _id: commentId },
            { $inc: { repliesCount: -1 } }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  // ========== MODÉRATION ==========

  async updateStatus(commentId: string, status: 'active' | 'deleted' | 'hidden', reason?: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const updateData: any = { status };
        if (reason) {
          updateData.moderationReason = reason;
        }

        const result = await this.commentModel
          .updateOne({ _id: commentId }, updateData)
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  async markAsAccepted(commentId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne({ _id: commentId }, { isAccepted: true })
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  async unmarkAsAccepted(commentId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne({ _id: commentId }, { isAccepted: false })
          .exec();
        return result.modifiedCount > 0;
      },
      'PostComment',
      commentId
    );
  }

  async markAsReported(commentId: string, reportedBy: string, reason: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(commentId)) {
          return false;
        }
        const result = await this.commentModel
          .updateOne(
            { _id: commentId },
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
      'PostComment',
      commentId
    );
  }

  async findReported(options: {
    postId?: string;
    limit?: number;
  } = {}): Promise<PostComment[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { postId, limit = 10 } = options;

        const filter: any = { 'reports.0': { $exists: true } };
        if (postId) {
          filter.postId = new Types.ObjectId(postId);
        }

        return this.commentModel
          .find(filter)
          .sort({ 'reports.reportedAt': -1 })
          .limit(limit)
          .exec();
      },
      'PostComment'
    );
  }

  // ========== STATISTIQUES ==========

  async countByPost(postId: string, status?: 'active' | 'deleted' | 'hidden'): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const filter: any = { postId: new Types.ObjectId(postId) };
        if (status) {
          filter.status = status;
        }
        return this.commentModel.countDocuments(filter).exec();
      },
      'PostComment',
      postId
    );
  }

  async countByAuthor(authorId: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.commentModel
          .countDocuments({ authorId: new Types.ObjectId(authorId) })
          .exec();
      },
      'PostComment',
      authorId
    );
  }

  async findTopRated(options: {
    postId?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  } = {}): Promise<PostComment[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { postId, timeframe = 'all', limit = 10 } = options;

        const filter: any = { status: 'active' };
        if (postId) {
          filter.postId = new Types.ObjectId(postId);
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

        return this.commentModel
          .find(filter)
          .sort({ score: -1, upvotes: -1 })
          .limit(limit)
          .exec();
      },
      'PostComment'
    );
  }

  async findRecent(options: {
    postId?: string;
    limit?: number;
    status?: 'active' | 'deleted' | 'hidden';
  } = {}): Promise<PostComment[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { postId, limit = 10, status = 'active' } = options;

        const filter: any = { status };
        if (postId) {
          filter.postId = new Types.ObjectId(postId);
        }

        return this.commentModel
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'PostComment'
    );
  }

  async findAcceptedByPost(postId: string): Promise<PostComment[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.commentModel
          .find({ 
            postId: new Types.ObjectId(postId),
            isAccepted: true,
            status: 'active'
          })
          .sort({ score: -1 })
          .exec();
      },
      'PostComment'
    );
  }
}