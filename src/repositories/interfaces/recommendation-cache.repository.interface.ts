import { RecommendationCache } from '../../recommendations/schemas/recommendation-cache.schema';

export interface IRecommendationCacheRepository {
  create(cache: Partial<RecommendationCache>): Promise<RecommendationCache>;
  findById(id: string): Promise<RecommendationCache | null>;
  findByUserId(userId: string, recommendationType?: string): Promise<RecommendationCache | null>;
  findValidByUserId(userId: string, recommendationType?: string): Promise<RecommendationCache | null>;
  updateRecommendations(id: string, recommendations: any[]): Promise<RecommendationCache | null>;
  deleteExpired(): Promise<number>;
  deleteByUserId(userId: string): Promise<boolean>;
  countByUserId(userId: string): Promise<number>;
  findRecentByType(recommendationType: string, limit?: number): Promise<RecommendationCache[]>;
  getPerformanceStats(): Promise<{
    avgGenerationTime: number;
    avgTotalCandidates: number;
    avgScore: number;
    totalCaches: number;
  }>;
}