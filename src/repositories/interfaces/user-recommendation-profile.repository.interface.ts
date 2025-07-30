import { UserRecommendationProfile, RecommendationFeedback } from '../../recommendations/schemas/user-recommendation-profile.schema';

export interface IUserRecommendationProfileRepository {
  create(profile: Partial<UserRecommendationProfile>): Promise<UserRecommendationProfile>;
  findById(id: string): Promise<UserRecommendationProfile | null>;
  findByUserId(userId: string): Promise<UserRecommendationProfile | null>;
  findOrCreateByUserId(userId: string): Promise<UserRecommendationProfile>;
  updatePreferredCategories(userId: string, categories: string[]): Promise<UserRecommendationProfile | null>;
  updateLanguageProficiency(userId: string, language: string, level: number): Promise<UserRecommendationProfile | null>;
  updateInteractionPatterns(userId: string, patterns: any): Promise<UserRecommendationProfile | null>;
  addFeedback(userId: string, feedback: RecommendationFeedback): Promise<UserRecommendationProfile | null>;
  updateRecommendationStats(userId: string, stats: {
    seen?: number;
    clicked?: number;
    favorited?: number;
  }): Promise<UserRecommendationProfile | null>;
  updateAlgorithmWeights(userId: string, weights: {
    behavioralWeight?: number;
    semanticWeight?: number;
    communityWeight?: number;
    linguisticWeight?: number;
  }): Promise<UserRecommendationProfile | null>;
  updateLastRecommendationTime(userId: string): Promise<UserRecommendationProfile | null>;
  getFeedbackStats(userId: string): Promise<{
    totalFeedbacks: number;
    positiveRatio: number;
    feedbacksByType: { [key: string]: number };
  }>;
  findUsersForRecommendation(lastRecommendationBefore?: Date, limit?: number): Promise<UserRecommendationProfile[]>;
  delete(userId: string): Promise<boolean>;
}