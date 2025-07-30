import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRecommendationProfile, UserRecommendationProfileDocument, RecommendationFeedback } from '../../recommendations/schemas/user-recommendation-profile.schema';
import { IUserRecommendationProfileRepository } from '../interfaces/user-recommendation-profile.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

@Injectable()
export class UserRecommendationProfileRepository implements IUserRecommendationProfileRepository {
  constructor(
    @InjectModel(UserRecommendationProfile.name)
    private profileModel: Model<UserRecommendationProfileDocument>
  ) {}

  async create(profile: Partial<UserRecommendationProfile>): Promise<UserRecommendationProfile> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.profileModel(profile);
        return await created.save();
      },
      'UserRecommendationProfile',
      'create'
    );
  }

  async findById(id: string): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.profileModel.findById(id).exec();
      },
      'UserRecommendationProfile',
      id
    );
  }

  async findByUserId(userId: string): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.profileModel.findOne({ userId }).exec();
      },
      'UserRecommendationProfile',
      `user-${userId}`
    );
  }

  async findOrCreateByUserId(userId: string): Promise<UserRecommendationProfile> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        let profile = await this.profileModel.findOne({ userId }).exec();
        
        if (!profile) {
          profile = new this.profileModel({
            userId,
            preferredCategories: [],
            languageProficiency: new Map(),
            interactionPatterns: {
              peakHours: [],
              preferredContentTypes: [],
              averageSessionDuration: 0
            },
            semanticInterests: [],
            lastRecommendationAt: new Date(),
            feedbackHistory: [],
            totalRecommendationsSeen: 0,
            totalRecommendationsClicked: 0,
            totalRecommendationsFavorited: 0,
            algorithmWeights: {
              behavioralWeight: 0.4,
              semanticWeight: 0.3,
              communityWeight: 0.2,
              linguisticWeight: 0.1
            }
          });
          profile = await profile.save();
        }
        
        return profile;
      },
      'UserRecommendationProfile',
      `findOrCreate-${userId}`
    );
  }

  async updatePreferredCategories(userId: string, categories: string[]): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            { preferredCategories: categories },
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `categories-${userId}`
    );
  }

  async updateLanguageProficiency(userId: string, language: string, level: number): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            { [`languageProficiency.${language}`]: level },
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `proficiency-${userId}-${language}`
    );
  }

  async updateInteractionPatterns(userId: string, patterns: any): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            { interactionPatterns: patterns },
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `patterns-${userId}`
    );
  }

  async addFeedback(userId: string, feedback: RecommendationFeedback): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            { 
              $push: { 
                feedbackHistory: {
                  $each: [feedback],
                  $slice: -100 // Garder seulement les 100 derniers feedbacks
                }
              }
            },
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `feedback-${userId}`
    );
  }

  async updateRecommendationStats(userId: string, stats: {
    seen?: number;
    clicked?: number;
    favorited?: number;
  }): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updateFields: any = {};
        
        if (stats.seen !== undefined) {
          updateFields.$inc = { ...updateFields.$inc, totalRecommendationsSeen: stats.seen };
        }
        if (stats.clicked !== undefined) {
          updateFields.$inc = { ...updateFields.$inc, totalRecommendationsClicked: stats.clicked };
        }
        if (stats.favorited !== undefined) {
          updateFields.$inc = { ...updateFields.$inc, totalRecommendationsFavorited: stats.favorited };
        }

        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            updateFields,
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `stats-${userId}`
    );
  }

  async updateAlgorithmWeights(userId: string, weights: {
    behavioralWeight?: number;
    semanticWeight?: number;
    communityWeight?: number;
    linguisticWeight?: number;
  }): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updateFields: any = {};
        
        if (weights.behavioralWeight !== undefined) {
          updateFields['algorithmWeights.behavioralWeight'] = weights.behavioralWeight;
        }
        if (weights.semanticWeight !== undefined) {
          updateFields['algorithmWeights.semanticWeight'] = weights.semanticWeight;
        }
        if (weights.communityWeight !== undefined) {
          updateFields['algorithmWeights.communityWeight'] = weights.communityWeight;
        }
        if (weights.linguisticWeight !== undefined) {
          updateFields['algorithmWeights.linguisticWeight'] = weights.linguisticWeight;
        }

        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            { $set: updateFields },
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `weights-${userId}`
    );
  }

  async updateLastRecommendationTime(userId: string): Promise<UserRecommendationProfile | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.profileModel
          .findOneAndUpdate(
            { userId },
            { lastRecommendationAt: new Date() },
            { new: true }
          )
          .exec();
      },
      'UserRecommendationProfile',
      `lastReco-${userId}`
    );
  }

  async getFeedbackStats(userId: string): Promise<{
    totalFeedbacks: number;
    positiveRatio: number;
    feedbacksByType: { [key: string]: number };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const profile = await this.profileModel.findOne({ userId }).exec();
        
        if (!profile || !profile.feedbackHistory || profile.feedbackHistory.length === 0) {
          return {
            totalFeedbacks: 0,
            positiveRatio: 0,
            feedbacksByType: {}
          };
        }

        const feedbacks = profile.feedbackHistory;
        const totalFeedbacks = feedbacks.length;
        const positiveFeedbacks = feedbacks.filter(f => 
          ['like', 'favorite', 'view'].includes(f.feedbackType)
        ).length;
        
        const feedbacksByType: { [key: string]: number } = {};
        feedbacks.forEach(feedback => {
          feedbacksByType[feedback.feedbackType] = (feedbacksByType[feedback.feedbackType] || 0) + 1;
        });

        return {
          totalFeedbacks,
          positiveRatio: totalFeedbacks > 0 ? positiveFeedbacks / totalFeedbacks : 0,
          feedbacksByType
        };
      },
      'UserRecommendationProfile',
      `feedbackStats-${userId}`
    );
  }

  async findUsersForRecommendation(lastRecommendationBefore?: Date, limit: number = 100): Promise<UserRecommendationProfile[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = {};
        
        if (lastRecommendationBefore) {
          query.lastRecommendationAt = { $lt: lastRecommendationBefore };
        }

        return await this.profileModel
          .find(query)
          .sort({ lastRecommendationAt: 1 })
          .limit(limit)
          .exec();
      },
      'UserRecommendationProfile',
      'usersForRecommendation'
    );
  }

  async delete(userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.profileModel.deleteOne({ userId }).exec();
        return result.deletedCount > 0;
      },
      'UserRecommendationProfile',
      `user-${userId}`
    );
  }
}