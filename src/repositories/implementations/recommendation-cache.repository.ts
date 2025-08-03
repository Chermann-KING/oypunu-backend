import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RecommendationCache, RecommendationCacheDocument } from '../../recommendations/schemas/recommendation-cache.schema';
import { IRecommendationCacheRepository } from '../interfaces/recommendation-cache.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

@Injectable()
export class RecommendationCacheRepository implements IRecommendationCacheRepository {
  constructor(
    @InjectModel(RecommendationCache.name)
    private cacheModel: Model<RecommendationCacheDocument>
  ) {}

  async create(cache: Partial<RecommendationCache>): Promise<RecommendationCache> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.cacheModel(cache);
        return await created.save();
      },
      'RecommendationCache',
      'create'
    );
  }

  async findById(id: string): Promise<RecommendationCache | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.cacheModel.findById(id).exec();
      },
      'RecommendationCache',
      id
    );
  }

  async findByUserId(userId: string, recommendationType?: string): Promise<RecommendationCache | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = { userId };
        if (recommendationType) {
          query.recommendationType = recommendationType;
        }

        return await this.cacheModel
          .findOne(query)
          .sort({ generatedAt: -1 })
          .exec();
      },
      'RecommendationCache',
      `user-${userId}-type-${recommendationType || 'any'}`
    );
  }

  async findValidByUserId(userId: string, recommendationType?: string): Promise<RecommendationCache | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = {
          userId,
          validUntil: { $gte: new Date() }
        };
        
        if (recommendationType) {
          query.recommendationType = recommendationType;
        }

        return await this.cacheModel
          .findOne(query)
          .sort({ generatedAt: -1 })
          .exec();
      },
      'RecommendationCache',
      `valid-user-${userId}-type-${recommendationType || 'any'}`
    );
  }

  async updateRecommendations(id: string, recommendations: any[]): Promise<RecommendationCache | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.cacheModel
          .findByIdAndUpdate(
            id,
            { 
              recommendations,
              generatedAt: new Date()
            },
            { new: true }
          )
          .exec();
      },
      'RecommendationCache',
      id
    );
  }

  async deleteExpired(): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.cacheModel.deleteMany({
          validUntil: { $lt: new Date() }
        }).exec();
        return result.deletedCount || 0;
      },
      'RecommendationCache',
      'expired-cleanup'
    );
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.cacheModel.deleteMany({ userId }).exec();
        return result.deletedCount > 0;
      },
      'RecommendationCache',
      `user-${userId}`
    );
  }

  async countByUserId(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.cacheModel.countDocuments({ userId }).exec();
      },
      'RecommendationCache',
      `count-user-${userId}`
    );
  }

  async findRecentByType(recommendationType: string, limit: number = 10): Promise<RecommendationCache[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.cacheModel
          .find({ recommendationType })
          .sort({ generatedAt: -1 })
          .limit(limit)
          .exec();
      },
      'RecommendationCache',
      `recent-type-${recommendationType}`
    );
  }

  async getPerformanceStats(): Promise<{
    avgGenerationTime: number;
    avgTotalCandidates: number;
    avgScore: number;
    totalCaches: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const stats = await this.cacheModel.aggregate([
          {
            $group: {
              _id: null,
              avgGenerationTime: { $avg: '$generationTimeMs' },
              avgTotalCandidates: { $avg: '$totalCandidates' },
              avgScore: { $avg: '$avgScore' },
              totalCaches: { $sum: 1 }
            }
          }
        ]).exec();

        if (stats.length === 0) {
          return {
            avgGenerationTime: 0,
            avgTotalCandidates: 0,
            avgScore: 0,
            totalCaches: 0
          };
        }

        return {
          avgGenerationTime: stats[0].avgGenerationTime || 0,
          avgTotalCandidates: stats[0].avgTotalCandidates || 0,
          avgScore: stats[0].avgScore || 0,
          totalCaches: stats[0].totalCaches || 0
        };
      },
      'RecommendationCache',
      'performance-stats'
    );
  }
}