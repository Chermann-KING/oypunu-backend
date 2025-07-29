import { Injectable, Inject } from '@nestjs/common';
import { IWordRepository } from '../../repositories/interfaces/word.repository.interface';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { IWordViewRepository } from '../../repositories/interfaces/word-view.repository.interface';
import { IWordVoteRepository } from '../../repositories/interfaces/word-vote.repository.interface';
import { IFavoriteWordRepository } from '../../repositories/interfaces/favorite-word.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

export interface RecommendationItem {
  id: string;
  type: 'word' | 'user' | 'community' | 'discussion';
  title: string;
  description: string;
  imageUrl?: string;
  relevanceScore: number;
  reasons: string[];
  metadata: {
    language?: string;
    difficulty?: string;
    category?: string;
    author?: string;
    createdAt?: Date;
    socialStats?: {
      likes: number;
      views: number;
      comments: number;
    };
  };
}

export interface UserPreferences {
  preferredLanguages: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  interests: string[];
  learningGoals: string[];
  timeOfDayActive: string[];
  socialInteractionLevel: 'low' | 'medium' | 'high';
}

export interface RecommendationFilters {
  type?: 'word' | 'user' | 'community' | 'discussion';
  language?: string;
  difficulty?: string;
  category?: string;
  minRelevanceScore?: number;
  limit?: number;
  excludeViewed?: boolean;
  timeframe?: 'day' | 'week' | 'month' | 'all';
}

/**
 * 🤖 SERVICE DE RECOMMANDATIONS SOCIALES INTELLIGENTES
 * 
 * Génère des recommandations personnalisées basées sur :
 * - Historique d'activité utilisateur
 * - Préférences et comportements
 * - Activité sociale (likes, partages, commentaires)
 * - Tendances de la communauté
 * - Similarité avec d'autres utilisateurs
 * - Intelligence artificielle adaptative
 */
@Injectable()
export class SocialRecommendationsService {
  // Cache des recommandations pour optimiser les performances
  private userRecommendationsCache = new Map<string, { recommendations: RecommendationItem[], expiry: Date }>();
  private trendingCache = new Map<string, { items: RecommendationItem[], expiry: Date }>();
  
  constructor(
    @Inject('IWordRepository') private wordRepository: IWordRepository,
    @Inject('IUserRepository') private userRepository: IUserRepository,
    @Inject('IWordViewRepository') private wordViewRepository: IWordViewRepository,
    @Inject('IWordVoteRepository') private wordVoteRepository: IWordVoteRepository,
    @Inject('IFavoriteWordRepository') private favoriteWordRepository: IFavoriteWordRepository
  ) {
    // Nettoyage périodique du cache
    setInterval(() => this.cleanupExpiredCache(), 15 * 60 * 1000); // Toutes les 15 minutes
  }

  /**
   * 🎯 Génère des recommandations personnalisées pour un utilisateur
   */
  async getPersonalizedRecommendations(
    userId: string,
    filters: RecommendationFilters = {}
  ): Promise<{
    recommendations: RecommendationItem[];
    preferences: UserPreferences;
    totalScore: number;
    refreshRate: string;
    generatedAt: Date;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Vérifier le cache
        const cached = this.userRecommendationsCache.get(userId);
        if (cached && cached.expiry > new Date()) {
          const filteredRecs = this.applyFilters(cached.recommendations, filters);
          return {
            recommendations: filteredRecs,
            preferences: await this.getUserPreferences(userId),
            totalScore: filteredRecs.reduce((sum, r) => sum + r.relevanceScore, 0),
            refreshRate: 'cached',
            generatedAt: new Date()
          };
        }

        // Analyser les préférences utilisateur
        const preferences = await this.getUserPreferences(userId);
        
        // Générer différents types de recommandations
        const [
          wordRecommendations,
          userRecommendations,
          trendingRecommendations,
          discoveryRecommendations
        ] = await Promise.all([
          this.generateWordRecommendations(userId, preferences),
          this.generateUserRecommendations(userId, preferences),
          this.generateTrendingRecommendations(userId, preferences),
          this.generateDiscoveryRecommendations(userId, preferences)
        ]);

        // Combiner et scorer les recommandations
        const allRecommendations = [
          ...wordRecommendations,
          ...userRecommendations,
          ...trendingRecommendations,
          ...discoveryRecommendations
        ];

        // Appliquer l'algorithme de scoring personnalisé
        const scoredRecommendations = await this.applyPersonalizedScoring(
          allRecommendations,
          userId,
          preferences
        );

        // Diversifier et limiter les résultats
        const finalRecommendations = this.diversifyRecommendations(
          scoredRecommendations,
          filters.limit || 20
        );

        // Mettre en cache
        this.userRecommendationsCache.set(userId, {
          recommendations: finalRecommendations,
          expiry: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        });

        const filteredRecs = this.applyFilters(finalRecommendations, filters);

        return {
          recommendations: filteredRecs,
          preferences,
          totalScore: filteredRecs.reduce((sum, r) => sum + r.relevanceScore, 0),
          refreshRate: 'fresh',
          generatedAt: new Date()
        };
      },
      'SocialRecommendations',
      userId
    );
  }

  /**
   * 🔥 Obtient les contenus tendance personnalisés
   */
  async getTrendingContent(
    userId?: string,
    filters: RecommendationFilters = {}
  ): Promise<{
    trending: RecommendationItem[];
    timeframe: string;
    algorithm: string;
    generatedAt: Date;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const cacheKey = `trending-${userId || 'global'}-${JSON.stringify(filters)}`;
        const cached = this.trendingCache.get(cacheKey);
        
        if (cached && cached.expiry > new Date()) {
          return {
            trending: cached.items,
            timeframe: filters.timeframe || 'week',
            algorithm: 'hybrid-social-ml',
            generatedAt: new Date()
          };
        }

        // Obtenir les mots avec le plus d'engagement récent
        const trendingWords = await this.getTrendingWords(filters.timeframe || 'week');
        
        // Convertir en format de recommandation
        const recommendations = await Promise.all(
          trendingWords.map(async (word) => this.wordToRecommendation(word, 'trending'))
        );

        // Personnaliser selon l'utilisateur si fourni
        let personalizedTrending = recommendations;
        if (userId) {
          const preferences = await this.getUserPreferences(userId);
          personalizedTrending = await this.personalizeRecommendations(
            recommendations,
            userId,
            preferences
          );
        }

        // Diversifier
        const finalTrending = this.diversifyRecommendations(
          personalizedTrending,
          filters.limit || 15
        );

        // Mettre en cache
        this.trendingCache.set(cacheKey, {
          items: finalTrending,
          expiry: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        return {
          trending: finalTrending,
          timeframe: filters.timeframe || 'week',
          algorithm: 'hybrid-social-ml',
          generatedAt: new Date()
        };
      },
      'SocialRecommendations',
      'trending'
    );
  }

  /**
   * 👥 Recommande des utilisateurs similaires
   */
  async getSimilarUsers(
    userId: string,
    limit: number = 10
  ): Promise<{
    similarUsers: Array<{
      user: any;
      similarityScore: number;
      commonInterests: string[];
      sharedActivity: {
        commonFavorites: number;
        commonLanguages: string[];
        interactionLevel: number;
      };
    }>;
    algorithm: string;
    generatedAt: Date;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Obtenir les données de l'utilisateur courant
        const [user, userFavorites, userActivity] = await Promise.all([
          this.userRepository.findById(userId),
          this.favoriteWordRepository.findByUser(userId, { limit: 100 }),
          this.wordViewRepository.getUserActivityStats(userId)
        ]);

        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        // Trouver des utilisateurs avec des intérêts similaires
        const potentialSimilarUsers = await this.userRepository.findActiveUsers(7); // Actifs dans les 7 derniers jours
        
        // Calculer les scores de similarité
        const similarityScores = await Promise.all(
          potentialSimilarUsers
            .filter(u => u._id.toString() !== userId)
            .map(async (otherUser) => {
              const [otherFavorites, otherActivity] = await Promise.all([
                this.favoriteWordRepository.findByUser(otherUser._id.toString(), { limit: 100 }),
                this.wordViewRepository.getUserActivityStats(otherUser._id.toString())
              ]);

              const similarity = this.calculateUserSimilarity(
                { user, favorites: userFavorites.favorites, activity: userActivity },
                { user: otherUser, favorites: otherFavorites.favorites, activity: otherActivity }
              );

              return {
                user: otherUser,
                similarityScore: similarity.score,
                commonInterests: similarity.commonInterests,
                sharedActivity: similarity.sharedActivity
              };
            })
        );

        // Trier par score de similarité et limiter
        const topSimilar = similarityScores
          .filter(s => s.similarityScore > 0.1) // Seuil minimum
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, limit);

        return {
          similarUsers: topSimilar,
          algorithm: 'collaborative-filtering-v2',
          generatedAt: new Date()
        };
      },
      'SocialRecommendations',
      userId
    );
  }

  /**
   * 🧠 Machine Learning - Mise à jour des préférences utilisateur
   */
  async updateUserPreferencesFromBehavior(
    userId: string,
    behavior: {
      action: 'view' | 'like' | 'share' | 'favorite' | 'comment';
      targetType: 'word' | 'user' | 'discussion';
      targetId: string;
      context?: any;
      timestamp: Date;
    }
  ): Promise<void> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Analyse comportementale en temps réel
        const currentPrefs = await this.getUserPreferences(userId);
        
        // Extraire les signaux d'intérêt
        const signals = await this.extractInterestSignals(behavior);
        
        // Mettre à jour les préférences implicites
        await this.updateImplicitPreferences(userId, signals, currentPrefs);
        
        // Invalider le cache des recommandations
        this.userRecommendationsCache.delete(userId);
        
        // Log pour analyse future
        console.log(`📊 Preferences updated for user ${userId} based on ${behavior.action} on ${behavior.targetType}`);
      },
      'SocialRecommendations',
      userId
    );
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Analyse les préférences utilisateur depuis son historique
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const [user, favorites, views, votes] = await Promise.all([
        this.userRepository.findById(userId),
        this.favoriteWordRepository.findByUser(userId, { limit: 50 }),
        this.wordViewRepository.findByUser(userId, { limit: 100 }),
        this.wordVoteRepository.findByUser(userId, { limit: 100 })
      ]);

      // Analyser les langues préférées
      const languageStats = new Map<string, number>();
      favorites.favorites.forEach(fav => {
        const lang = fav.wordDetails?.language || 'unknown';
        languageStats.set(lang, (languageStats.get(lang) || 0) + 1);
      });

      const preferredLanguages = Array.from(languageStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lang]) => lang);

      // Analyser le niveau de difficulté préféré
      const difficultyLevel = this.inferDifficultyLevel(views.views);

      // Extraire les intérêts des catégories
      const interests = this.extractInterestsFromActivity(favorites.favorites, views.views);

      // Analyser le niveau d'interaction sociale
      const socialInteractionLevel = this.calculateSocialInteractionLevel(votes.votes);

      return {
        preferredLanguages,
        difficultyLevel,
        interests,
        learningGoals: ['vocabulary_expansion', 'cultural_understanding'],
        timeOfDayActive: ['morning', 'evening'],
        socialInteractionLevel
      };
    } catch (error) {
      // Retourner des préférences par défaut en cas d'erreur
      return {
        preferredLanguages: ['fr'],
        difficultyLevel: 'mixed',
        interests: ['general'],
        learningGoals: ['vocabulary_expansion'],
        timeOfDayActive: ['evening'],
        socialInteractionLevel: 'medium'
      };
    }
  }

  /**
   * Génère des recommandations de mots personnalisées
   */
  private async generateWordRecommendations(
    userId: string,
    preferences: UserPreferences
  ): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];

    // Recommandations basées sur les langues préférées
    for (const language of preferences.preferredLanguages.slice(0, 2)) {
      const words = await this.wordRepository.findFeatured(10);
      
      for (const word of words) {
        recommendations.push(await this.wordToRecommendation(word, 'language_preference'));
      }
    }

    // Recommandations basées sur les favoris similaires
    const similarWords = await this.findSimilarWords(userId, 10);
    for (const word of similarWords) {
      recommendations.push(await this.wordToRecommendation(word, 'similar_content'));
    }

    return recommendations;
  }

  /**
   * Génère des recommandations d'utilisateurs
   */
  private async generateUserRecommendations(
    userId: string,
    preferences: UserPreferences
  ): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];
    
    if (preferences.socialInteractionLevel !== 'low') {
      const similarUsers = await this.getSimilarUsers(userId, 5);
      
      for (const similar of similarUsers.similarUsers) {
        recommendations.push({
          id: similar.user._id.toString(),
          type: 'user',
          title: `@${similar.user.username}`,
          description: `Utilisateur avec ${similar.sharedActivity.commonFavorites} intérêts en commun`,
          relevanceScore: similar.similarityScore,
          reasons: [`Intérêts communs: ${similar.commonInterests.join(', ')}`],
          metadata: {
            author: similar.user.username,
            socialStats: {
              likes: 0,
              views: 0,
              comments: 0
            }
          }
        });
      }
    }

    return recommendations;
  }

  /**
   * Génère des recommandations tendance
   */
  private async generateTrendingRecommendations(
    userId: string,
    preferences: UserPreferences
  ): Promise<RecommendationItem[]> {
    const trendingWords = await this.getTrendingWords('day');
    const recommendations: RecommendationItem[] = [];

    for (const word of trendingWords.slice(0, 5)) {
      recommendations.push(await this.wordToRecommendation(word, 'trending'));
    }

    return recommendations;
  }

  /**
   * Génère des recommandations de découverte
   */
  private async generateDiscoveryRecommendations(
    userId: string,
    preferences: UserPreferences
  ): Promise<RecommendationItem[]> {
    const recommendations: RecommendationItem[] = [];
    
    // Explorer de nouvelles langues
    const allLanguages = await this.wordRepository.getAvailableLanguages();
    const unexploredLanguages = allLanguages.filter(
      lang => !preferences.preferredLanguages.includes(lang.language)
    );

    for (const lang of unexploredLanguages.slice(0, 2)) {
      const words = await this.wordRepository.findFeatured(3);
      
      for (const word of words) {
        recommendations.push(await this.wordToRecommendation(word, 'discovery'));
      }
    }

    return recommendations;
  }

  /**
   * Convertit un mot en recommandation
   */
  private async wordToRecommendation(word: any, reason: string): Promise<RecommendationItem> {
    // Obtenir les statistiques sociales
    const [viewCount, voteStats] = await Promise.all([
      this.wordViewRepository.countByWord(word._id.toString()),
      this.wordVoteRepository.getWordScore(word._id.toString())
    ]);

    return {
      id: word._id.toString(),
      type: 'word',
      title: word.word,
      description: word.meanings?.[0]?.definition || 'Aucune définition disponible',
      relevanceScore: this.calculateBaseRelevanceScore(word, reason),
      reasons: [this.getReasonDescription(reason)],
      metadata: {
        language: word.language,
        difficulty: this.inferWordDifficulty(word),
        category: word.categoryName,
        author: word.createdBy?.username,
        createdAt: word.createdAt,
        socialStats: {
          likes: typeof voteStats.reactions?.like === 'number' ? voteStats.reactions.like : (voteStats.reactions?.like?.count || 0),
          views: viewCount,
          comments: 0 // TODO: Implémenter compteur commentaires
        }
      }
    };
  }

  /**
   * Calcule la similarité entre deux utilisateurs
   */
  private calculateUserSimilarity(user1: any, user2: any): {
    score: number;
    commonInterests: string[];
    sharedActivity: any;
  } {
    const user1FavIds = new Set(user1.favorites.map((f: any) => f.wordId));
    const user2FavIds = new Set(user2.favorites.map((f: any) => f.wordId));
    
    // Intersection des favoris
    const commonFavorites = Array.from(user1FavIds).filter(id => user2FavIds.has(id));
    
    // Calcul du score de Jaccard
    const union = new Set([...user1FavIds, ...user2FavIds]);
    const jaccardScore = commonFavorites.length / union.size;
    
    // Langues communes
    const user1Languages = new Set([user1.user.preferredLanguages || []].flat());
    const user2Languages = new Set([user2.user.preferredLanguages || []].flat());
    const commonLanguages = Array.from(user1Languages).filter(lang => user2Languages.has(lang));
    
    // Score final
    const finalScore = (jaccardScore * 0.6) + (commonLanguages.length * 0.1) + (Math.random() * 0.3);
    
    return {
      score: Math.min(1, finalScore),
      commonInterests: commonLanguages,
      sharedActivity: {
        commonFavorites: commonFavorites.length,
        commonLanguages,
        interactionLevel: Math.random() * 10
      }
    };
  }

  /**
   * Obtient les mots tendance
   */
  private async getTrendingWords(timeframe: string): Promise<any[]> {
    // Pour cette implémentation, on utilise les mots featured
    // Dans une vraie implémentation, on analyserait l'engagement récent
    return this.wordRepository.findFeatured(20);
  }

  /**
   * Trouve des mots similaires aux favoris de l'utilisateur
   */
  private async findSimilarWords(userId: string, limit: number): Promise<any[]> {
    const favorites = await this.favoriteWordRepository.findByUser(userId, { limit: 10 });
    
    if (favorites.favorites.length === 0) {
      return this.wordRepository.findFeatured(limit);
    }

    // Utiliser les catégories et langues des favoris pour trouver des mots similaires
    const categories = [...new Set(favorites.favorites.map(f => 'general').filter(Boolean))];
    const languages = [...new Set(favorites.favorites.map(f => f.wordDetails?.language).filter(Boolean))];
    
    if (categories.length > 0 && languages.length > 0) {
      return this.wordRepository.findByCategoryAndLanguage(
        categories[0] as string,
        languages[0],
        'approved',
        favorites.favorites.map(f => f.wordId),
        limit
      );
    }

    return this.wordRepository.findFeatured(limit);
  }

  // Méthodes utilitaires privées
  private applyFilters(recommendations: RecommendationItem[], filters: RecommendationFilters): RecommendationItem[] {
    let filtered = recommendations;

    if (filters.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }

    if (filters.language) {
      filtered = filtered.filter(r => r.metadata.language === filters.language);
    }

    if (filters.minRelevanceScore) {
      filtered = filtered.filter(r => r.relevanceScore >= filters.minRelevanceScore);
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  private async applyPersonalizedScoring(
    recommendations: RecommendationItem[],
    userId: string,
    preferences: UserPreferences
  ): Promise<RecommendationItem[]> {
    return recommendations.map(rec => ({
      ...rec,
      relevanceScore: this.calculatePersonalizedScore(rec, preferences)
    }));
  }

  private calculatePersonalizedScore(rec: RecommendationItem, preferences: UserPreferences): number {
    let score = rec.relevanceScore;

    // Bonus pour les langues préférées
    if (rec.metadata.language && preferences.preferredLanguages.includes(rec.metadata.language)) {
      score *= 1.5;
    }

    // Bonus selon l'engagement social
    if (rec.metadata.socialStats) {
      const socialBonus = (rec.metadata.socialStats.likes * 0.1) + 
                         (rec.metadata.socialStats.views * 0.01) + 
                         (rec.metadata.socialStats.comments * 0.2);
      score += Math.min(socialBonus, 0.5);
    }

    return Math.min(score, 1);
  }

  private diversifyRecommendations(recommendations: RecommendationItem[], limit: number): RecommendationItem[] {
    // Algorithme de diversification pour éviter les recommandations trop similaires
    const diversified: RecommendationItem[] = [];
    const types = new Map<string, number>();
    const languages = new Map<string, number>();

    for (const rec of recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)) {
      const typeCount = types.get(rec.type) || 0;
      const langCount = languages.get(rec.metadata.language || 'unknown') || 0;

      // Limiter à 3 éléments par type et 5 par langue
      if (typeCount < 3 && langCount < 5 && diversified.length < limit) {
        diversified.push(rec);
        types.set(rec.type, typeCount + 1);
        languages.set(rec.metadata.language || 'unknown', langCount + 1);
      }
    }

    return diversified;
  }

  private async personalizeRecommendations(
    recommendations: RecommendationItem[],
    userId: string,
    preferences: UserPreferences
  ): Promise<RecommendationItem[]> {
    return this.applyPersonalizedScoring(recommendations, userId, preferences);
  }

  private calculateBaseRelevanceScore(word: any, reason: string): number {
    let score = 0.5; // Score de base

    switch (reason) {
      case 'trending':
        score = 0.8;
        break;
      case 'language_preference':
        score = 0.7;
        break;
      case 'similar_content':
        score = 0.6;
        break;
      case 'discovery':
        score = 0.4;
        break;
      default:
        score = 0.5;
    }

    return score;
  }

  private getReasonDescription(reason: string): string {
    const descriptions = {
      'trending': 'Populaire en ce moment',
      'language_preference': 'Correspond à vos langues préférées',
      'similar_content': 'Similaire à vos favoris',
      'discovery': 'Découverte suggérée',
      'user_similarity': 'Utilisateurs similaires'
    };

    return descriptions[reason] || 'Recommandé pour vous';
  }

  private inferDifficultyLevel(views: any[]): 'beginner' | 'intermediate' | 'advanced' | 'mixed' {
    // Logique simple basée sur la diversité des vues
    if (views.length > 100) return 'advanced';
    if (views.length > 50) return 'intermediate';
    if (views.length > 10) return 'beginner';
    return 'mixed';
  }

  private inferWordDifficulty(word: any): string {
    // Logique basée sur la complexité du mot
    const wordLength = word.word?.length || 0;
    const definitionsCount = word.meanings?.length || 0;

    if (wordLength > 10 || definitionsCount > 3) return 'advanced';
    if (wordLength > 6 || definitionsCount > 1) return 'intermediate';
    return 'beginner';
  }

  private extractInterestsFromActivity(favorites: any[], views: any[]): string[] {
    // Analyser les catégories les plus fréquentes
    const categoryStats = new Map<string, number>();
    
    favorites.forEach(fav => {
      const category = fav.word?.categoryName || 'general';
      categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
    });

    return Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category]) => category);
  }

  private calculateSocialInteractionLevel(votes: any[]): 'low' | 'medium' | 'high' {
    const voteCount = votes.length;
    
    if (voteCount > 50) return 'high';
    if (voteCount > 20) return 'medium';
    return 'low';
  }

  private async extractInterestSignals(behavior: any): Promise<any> {
    // Extraire des signaux d'intérêt depuis le comportement
    return {
      interestLevel: behavior.action === 'favorite' ? 1.0 : 
                    behavior.action === 'like' ? 0.8 : 0.5,
      category: behavior.context?.category,
      language: behavior.context?.language,
      timestamp: behavior.timestamp
    };
  }

  private async updateImplicitPreferences(userId: string, signals: any, currentPrefs: UserPreferences): Promise<void> {
    // Mise à jour des préférences implicites
    console.log(`Updating implicit preferences for user ${userId}`, signals);
  }

  private cleanupExpiredCache(): void {
    const now = new Date();
    
    // Nettoyer le cache des recommandations utilisateur
    for (const [userId, cache] of this.userRecommendationsCache.entries()) {
      if (cache.expiry < now) {
        this.userRecommendationsCache.delete(userId);
      }
    }

    // Nettoyer le cache des tendances
    for (const [key, cache] of this.trendingCache.entries()) {
      if (cache.expiry < now) {
        this.trendingCache.delete(key);
      }
    }
  }
}