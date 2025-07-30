import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Like, LikeDocument } from '../../communities/schemas/like.schema';
import { ILikeRepository } from '../interfaces/like.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

@Injectable()
export class LikeRepository implements ILikeRepository {
  constructor(
    @InjectModel(Like.name)
    private likeModel: Model<LikeDocument>
  ) {}

  async create(like: Partial<Like>): Promise<Like> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.likeModel(like);
        return await created.save();
      },
      'Like',
      'create'
    );
  }

  async findById(id: string): Promise<Like | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.likeModel.findById(id).exec();
      },
      'Like',
      id
    );
  }

  async findByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<Like | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.likeModel.findOne({
          userId,
          targetType,
          targetId
        }).exec();
      },
      'Like',
      `user-${userId}-target-${targetType}-${targetId}`
    );
  }

  async findByTarget(targetType: string, targetId: string): Promise<Like[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.likeModel
          .find({ targetType, targetId })
          .sort({ createdAt: -1 })
          .exec();
      },
      'Like',
      `target-${targetType}-${targetId}`
    );
  }

  async findByUser(userId: string, options: {
    limit?: number;
    offset?: number;
    targetType?: string;
  } = {}): Promise<Like[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 50, offset = 0, targetType } = options;
        const query: any = { userId };
        
        if (targetType) {
          query.targetType = targetType;
        }

        return await this.likeModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .exec();
      },
      'Like',
      `user-${userId}`
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.likeModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'Like',
      id
    );
  }

  async deleteByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.likeModel.deleteOne({
          userId,
          targetType,
          targetId
        }).exec();
        return result.deletedCount > 0;
      },
      'Like',
      `user-${userId}-target-${targetType}-${targetId}`
    );
  }

  async countByTarget(targetType: string, targetId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.likeModel.countDocuments({
          targetType,
          targetId
        }).exec();
      },
      'Like',
      `count-target-${targetType}-${targetId}`
    );
  }

  async countByUser(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.likeModel.countDocuments({ userId }).exec();
      },
      'Like',
      `count-user-${userId}`
    );
  }

  async getUserTargetLikes(userId: string, targetType: string, targetIds: string[]): Promise<Like[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.likeModel
          .find({
            userId,
            targetType,
            targetId: { $in: targetIds }
          })
          .exec();
      },
      'Like',
      `user-${userId}-targets-${targetType}`
    );
  }
}