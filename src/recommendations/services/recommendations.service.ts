import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Imports des schémas
import { UserRecommendationProfile, UserRecommendationProfileDocument } from '../schemas/user-recommendation-profile.schema';
import { RecommendationCache, RecommendationCacheDocument, RecommendationResult } from '../schemas/recommendation-cache.schema';
import { WordView, WordViewDocument } from '../../users/schemas/word-view.schema';
import { FavoriteWord, FavoriteWordDocument } from '../../dictionary/schemas/favorite-word.schema';
import { ActivityFeed, ActivityFeedDocument } from '../../common/schemas/activity-feed.schema';
import { Word, WordDocument } from '../../dictionary/schemas/word.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Language, LanguageDocument } from '../../languages/schemas/language.schema';

// DTOs
import { GetRecommendationsDto, RecommendationFeedbackDto, TrendingRecommendationsDto, LinguisticRecommendationsDto } from '../dto/recommendation-request.dto';
import { RecommendationItemDto, RecommendationsResponseDto, RecommendationExplanationDto, FeedbackResponseDto } from '../dto/recommendation-response.dto';

// Services existants
import { SimilarityService } from '../../translation/services/similarity.service';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectModel(UserRecommendationProfile.name) private userProfileModel: Model<UserRecommendationProfileDocument>,
    @InjectModel(RecommendationCache.name) private cacheModel: Model<RecommendationCacheDocument>,
    @InjectModel(WordView.name) private wordViewModel: Model<WordViewDocument>,
    @InjectModel(FavoriteWord.name) private favoriteWordModel: Model<FavoriteWordDocument>,
    @InjectModel(ActivityFeed.name) private activityModel: Model<ActivityFeedDocument>,
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Language.name) private languageModel: Model<LanguageDocument>,
    private similarityService: SimilarityService,
  ) {}

  /**
   * Point d'entrée principal pour obtenir des recommandations personnalisées
   */
  async getPersonalRecommendations(userId: string, dto: GetRecommendationsDto): Promise<RecommendationsResponseDto> {
    const startTime = Date.now();
    this.logger.log(`🎯 Génération de recommandations pour utilisateur: ${userId}, type: ${dto.type}`);

    try {
      // Vérifier le cache si refresh n'est pas demandé
      if (!dto.refresh) {
        const cachedRecommendations = await this.getCachedRecommendations(userId, dto.type || 'mixed');
        if (cachedRecommendations) {
          this.logger.log(`📋 Recommandations trouvées en cache pour ${userId}`);
          return this.formatResponse(cachedRecommendations, true, Date.now() - startTime);
        }
      }

      // Obtenir ou créer le profil utilisateur
      const userProfile = await this.getUserProfile(userId);
      const user = await this.userModel.findById(userId);

      if (!user) {
        throw new Error(`Utilisateur non trouvé: ${userId}`);
      }

      // Générer les recommandations selon le type
      let recommendations: RecommendationResult[] = [];
      
      switch (dto.type) {
        case 'behavioral':
          recommendations = await this.generateBehavioralRecommendations(userId, userProfile, dto.limit || 5);
          break;
        case 'semantic':
          recommendations = await this.generateSemanticRecommendations(userId, userProfile, dto.limit || 5);
          break;
        case 'community':
          recommendations = await this.generateCommunityRecommendations(userId, userProfile, dto.limit || 5);
          break;
        case 'linguistic':
          recommendations = await this.generateLinguisticRecommendations(userId, userProfile, dto.limit || 5);
          break;
        case 'mixed':
        default:
          recommendations = await this.generateMixedRecommendations(userId, userProfile, dto.limit || 5);
          break;
      }

      // Sauvegarder en cache
      await this.saveToCache(userId, recommendations, dto.type || 'mixed', Date.now() - startTime);

      // Mettre à jour le profil utilisateur
      await this.updateUserProfile(userId, { lastRecommendationAt: new Date() });

      this.logger.log(`✅ ${recommendations.length} recommandations générées en ${Date.now() - startTime}ms`);
      
      return this.formatResponse(recommendations, false, Date.now() - startTime);

    } catch (error) {
      this.logger.error(`❌ Erreur lors de la génération de recommandations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Algorithme de recommandations comportementales (40% du score)
   * Basé sur l'historique de consultations et favoris
   */
  private async generateBehavioralRecommendations(userId: string, profile: UserRecommendationProfile, limit: number): Promise<RecommendationResult[]> {
    this.logger.log(`🧠 Génération recommandations comportementales pour ${userId}`);

    // Récupérer les consultations récentes (30 derniers jours)
    const recentViews = await this.wordViewModel
      .find({ 
        userId, 
        lastViewedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
      .sort({ lastViewedAt: -1 })
      .limit(50)
      .populate('wordId')
      .lean();

    // Récupérer les favoris
    const favorites = await this.favoriteWordModel
      .find({ userId })
      .populate('wordId')
      .lean();

    // Extraire les mots-clés et catégories des mots consultés/favorisés
    const userInterests = this.extractUserInterests(recentViews, favorites);

    // Trouver des mots similaires
    const candidates = await this.findSimilarWords(userInterests, userId, limit * 3);

    // Scorer et trier
    const scoredCandidates = await this.scoreBehavioralCandidates(candidates, userInterests, recentViews, favorites);

    return scoredCandidates.slice(0, limit).map(candidate => ({
      wordId: candidate.word._id.toString(),
      score: candidate.behavioralScore,
      reasons: candidate.reasons,
      category: 'behavioral',
      metadata: {
        viewCount: candidate.word.translationCount || 0,
        category: candidate.word.categoryId,
        similarity: candidate.similarity
      }
    }));
  }

  /**
   * Algorithme de recommandations sémantiques (30% du score)
   * Basé sur la similarité des mots et concepts
   */
  private async generateSemanticRecommendations(userId: string, profile: UserRecommendationProfile, limit: number): Promise<RecommendationResult[]> {
    this.logger.log(`🔗 Génération recommandations sémantiques pour ${userId}`);

    // Récupérer les mots récemment consultés pour analyse sémantique
    const recentWords = await this.getRecentUserWords(userId, 10);
    
    if (recentWords.length === 0) {
      return [];
    }

    const semanticCandidates: any[] = [];

    // Pour chaque mot récent, trouver des mots sémantiquement similaires
    for (const word of recentWords) {
      try {
        // Utiliser le service de similarité existant
        const similarWords = await this.findSemanticallyRelatedWords(word, limit);
        semanticCandidates.push(...similarWords);
      } catch (error) {
        this.logger.warn(`Erreur lors de la recherche sémantique pour ${word.word}: ${error.message}`);
      }
    }

    // Éliminer les doublons et scorer
    const uniqueCandidates = this.removeDuplicates(semanticCandidates, 'wordId');
    const scoredCandidates = await this.scoreSemanticCandidates(uniqueCandidates, recentWords);

    return scoredCandidates.slice(0, limit).map(candidate => ({
      wordId: candidate.wordId,
      score: candidate.semanticScore,
      reasons: [`Similaire à "${candidate.relatedWord}"`, `Concept connexe: ${candidate.relationship}`],
      category: 'semantic',
      metadata: {
        relatedWord: candidate.relatedWord,
        relationship: candidate.relationship,
        similarity: candidate.similarity
      }
    }));
  }

  /**
   * Algorithme de recommandations communautaires (20% du score)
   * Basé sur l'activité de la communauté et les tendances
   */
  private async generateCommunityRecommendations(userId: string, profile: UserRecommendationProfile, limit: number): Promise<RecommendationResult[]> {
    this.logger.log(`👥 Génération recommandations communautaires pour ${userId}`);

    // Récupérer l'activité récente de la communauté (7 derniers jours)
    const communityActivities = await this.activityModel
      .find({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        type: { $in: ['word_created', 'word_approved', 'word_favorited'] }
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Analyser les tendances par région/langue
    const user = await this.userModel.findById(userId);
    const userLanguages = [user?.nativeLanguage, ...(user?.learningLanguages || [])].filter(Boolean);

    // Mots populaires dans les langues de l'utilisateur
    const trendingWords = await this.getTrendingWords(userLanguages.filter(lang => lang !== undefined), limit * 2);

    // Scorer selon la popularité et la pertinence
    const scoredCandidates = await this.scoreCommunityTrends(trendingWords, userId, communityActivities);

    return scoredCandidates.slice(0, limit).map(candidate => ({
      wordId: candidate._id.toString(),
      score: candidate.communityScore,
      reasons: [
        `Populaire dans la communauté (${candidate.trendScore} interactions)`,
        `Tendance en ${candidate.language}`,
        candidate.isNew ? 'Mot récemment ajouté' : 'Mot en vogue'
      ],
      category: 'community',
      metadata: {
        trendScore: candidate.trendScore,
        interactions: candidate.interactions,
        isNew: candidate.isNew,
        region: candidate.region
      }
    }));
  }

  /**
   * Algorithme de recommandations linguistiques (10% du score)
   * Basé sur les langues d'apprentissage et le niveau
   */
  private async generateLinguisticRecommendations(userId: string, profile: UserRecommendationProfile, limit: number): Promise<RecommendationResult[]> {
    this.logger.log(`🌍 Génération recommandations linguistiques pour ${userId}`);

    const user = await this.userModel.findById(userId);
    const learningLanguages = user?.learningLanguageIds || user?.learningLanguages || [];

    if (learningLanguages.length === 0) {
      return [];
    }

    const linguisticCandidates: any[] = [];

    // Pour chaque langue d'apprentissage
    for (const languageId of learningLanguages) {
      const language = await this.languageModel.findById(languageId);
      if (!language) continue;

      // Récupérer les mots de base/intermédiaires dans cette langue
      const words = await this.getWordsForLanguageLearning((language as any).codes?.iso639_1 || language.name, profile, limit);
      linguisticCandidates.push(...words);
    }

    // Scorer selon le niveau et la progression
    const scoredCandidates = await this.scoreLinguisticCandidates(linguisticCandidates, profile, userId);

    return scoredCandidates.slice(0, limit).map(candidate => ({
      wordId: candidate._id.toString(),
      score: candidate.linguisticScore,
      reasons: [
        `Adapté pour apprendre le ${candidate.languageName}`,
        `Niveau ${candidate.difficulty}: ${candidate.difficultyReason}`,
        candidate.isCore ? 'Mot fondamental' : 'Mot enrichissant'
      ],
      category: 'linguistic',
      metadata: {
        language: candidate.language,
        difficulty: candidate.difficulty,
        isCore: candidate.isCore,
        learningPath: candidate.learningPath
      }
    }));
  }

  /**
   * Algorithme mixte qui combine tous les types de recommandations
   */
  private async generateMixedRecommendations(userId: string, profile: UserRecommendationProfile, totalLimit: number): Promise<RecommendationResult[]> {
    this.logger.log(`🎭 Génération recommandations mixtes pour ${userId}`);

    const weights = profile.algorithmWeights || {
      behavioralWeight: 0.4,
      semanticWeight: 0.3,
      communityWeight: 0.2,
      linguisticWeight: 0.1
    };

    // Répartir le nombre de recommandations selon les poids
    const behavioralCount = Math.ceil(totalLimit * weights.behavioralWeight);
    const semanticCount = Math.ceil(totalLimit * weights.semanticWeight);
    const communityCount = Math.ceil(totalLimit * weights.communityWeight);
    const linguisticCount = Math.ceil(totalLimit * weights.linguisticWeight);

    // Générer chaque type de recommandation en parallèle
    const [behavioral, semantic, community, linguistic] = await Promise.all([
      this.generateBehavioralRecommendations(userId, profile, behavioralCount),
      this.generateSemanticRecommendations(userId, profile, semanticCount),
      this.generateCommunityRecommendations(userId, profile, communityCount),
      this.generateLinguisticRecommendations(userId, profile, linguisticCount)
    ]);

    // Combiner et recalculer les scores avec les poids
    const allRecommendations = [
      ...behavioral.map(r => ({ ...r, score: r.score * weights.behavioralWeight })),
      ...semantic.map(r => ({ ...r, score: r.score * weights.semanticWeight })),
      ...community.map(r => ({ ...r, score: r.score * weights.communityWeight })),
      ...linguistic.map(r => ({ ...r, score: r.score * weights.linguisticWeight }))
    ];

    // Éliminer les doublons et trier par score final
    const uniqueRecommendations = this.removeDuplicates(allRecommendations, 'wordId');
    uniqueRecommendations.sort((a, b) => b.score - a.score);

    // Marquer comme mixte et ajuster les raisons
    return uniqueRecommendations.slice(0, totalLimit).map(r => ({
      ...r,
      category: 'mixed',
      reasons: [...r.reasons, `Score combiné: ${(r.score * 100).toFixed(1)}%`]
    }));
  }

  // ======= MÉTHODES UTILITAIRES =======

  /**
   * Obtenir ou créer un profil de recommandations pour l'utilisateur
   */
  private async getUserProfile(userId: string): Promise<UserRecommendationProfile> {
    let profile = await this.userProfileModel.findOne({ userId });
    
    if (!profile) {
      profile = await this.userProfileModel.create({
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
        totalRecommendationsFavorited: 0
      });
      
      this.logger.log(`📊 Nouveau profil de recommandations créé pour ${userId}`);
    }

    return profile;
  }

  /**
   * Vérifier le cache de recommandations
   */
  private async getCachedRecommendations(userId: string, type: string): Promise<RecommendationResult[] | null> {
    const cached = await this.cacheModel.findOne({
      userId,
      recommendationType: type,
      validUntil: { $gt: new Date() }
    });

    return cached?.recommendations || null;
  }

  /**
   * Sauvegarder les recommandations en cache
   */
  private async saveToCache(userId: string, recommendations: RecommendationResult[], type: string, generationTimeMs: number): Promise<void> {
    const validUntil = new Date(Date.now() + 60 * 60 * 1000); // Cache 1h

    await this.cacheModel.findOneAndUpdate(
      { userId, recommendationType: type },
      {
        recommendations,
        generatedAt: new Date(),
        validUntil,
        algorithm: 'intelligent_v1',
        generationTimeMs,
        totalCandidates: recommendations.length,
        avgScore: recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length || 0
      },
      { upsert: true }
    );
  }

  /**
   * Mettre à jour le profil utilisateur
   */
  private async updateUserProfile(userId: string, updates: Partial<UserRecommendationProfile>): Promise<void> {
    await this.userProfileModel.findOneAndUpdate({ userId }, updates);
  }

  /**
   * Extraire les intérêts de l'utilisateur à partir de son historique
   */
  private extractUserInterests(recentViews: any[], favorites: any[]): any {
    const categories = new Set<string>();
    const languages = new Set<string>();
    const keywords = new Set<string>();

    [...recentViews, ...favorites].forEach(item => {
      const word = item.wordId;
      if (word) {
        if (word.categoryId) categories.add(word.categoryId.toString());
        if (word.language) languages.add(word.language);
        if (word.extractedKeywords) {
          word.extractedKeywords.forEach((keyword: string) => keywords.add(keyword));
        }
      }
    });

    return {
      categories: Array.from(categories),
      languages: Array.from(languages),
      keywords: Array.from(keywords)
    };
  }

  /**
   * Trouver des mots similaires basés sur les intérêts
   */
  private async findSimilarWords(interests: any, excludeUserId: string, limit: number): Promise<any[]> {
    const query: any = {
      status: 'approved',
      createdBy: { $ne: excludeUserId } // Exclure les mots de l'utilisateur
    };

    // Filtrer par catégories d'intérêt
    if (interests.categories.length > 0) {
      query.categoryId = { $in: interests.categories };
    }

    // Filtrer par langues d'intérêt
    if (interests.languages.length > 0) {
      query.language = { $in: interests.languages };
    }

    // Recherche par mots-clés
    if (interests.keywords.length > 0) {
      query.extractedKeywords = { $in: interests.keywords };
    }

    return await this.wordModel
      .find(query)
      .limit(limit)
      .populate('categoryId')
      .lean();
  }

  /**
   * Obtenir les mots récemment consultés par l'utilisateur
   */
  private async getRecentUserWords(userId: string, limit: number): Promise<any[]> {
    const recentViews = await this.wordViewModel
      .find({ userId })
      .sort({ lastViewedAt: -1 })
      .limit(limit)
      .populate('wordId')
      .lean();

    return recentViews.map(view => view.wordId).filter(Boolean);
  }

  /**
   * Trouver des mots sémantiquement liés (utilise le service existant)
   */
  private async findSemanticallyRelatedWords(word: any, limit: number): Promise<any[]> {
    // Cette méthode utiliserait le SimilarityService existant
    // Pour l'instant, on utilise une approche basique basée sur les catégories et mots-clés
    
    const relatedWords = await this.wordModel
      .find({
        $or: [
          { categoryId: word.categoryId },
          { extractedKeywords: { $in: word.extractedKeywords || [] } },
          { 'meanings.partOfSpeech': { $in: word.meanings?.map((m: any) => m.partOfSpeech) || [] } }
        ],
        _id: { $ne: word._id },
        status: 'approved'
      })
      .limit(limit)
      .lean();

    return relatedWords.map(w => ({
      wordId: w._id.toString(),
      word: w.word,
      language: w.language,
      relatedWord: word.word,
      relationship: 'same_category',
      similarity: 0.7 // Score de base
    }));
  }

  /**
   * Obtenir les mots tendance
   */
  private async getTrendingWords(languages: string[], limit: number): Promise<any[]> {
    // Analyser l'activité récente pour identifier les tendances
    const pipeline = [
      {
        $match: {
          type: { $in: ['word_created', 'word_approved', 'word_favorited'] },
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$targetId',
          interactions: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $sort: { interactions: -1 as 1 | -1 }
      },
      {
        $limit: limit * 2
      }
    ];

    const trending = await this.activityModel.aggregate(pipeline);
    const wordIds = trending.map(t => t._id);

    const words = await this.wordModel
      .find({ 
        _id: { $in: wordIds },
        language: { $in: languages },
        status: 'approved'
      })
      .lean();

    return words.map(word => {
      const trendData = trending.find(t => t._id.toString() === word._id.toString());
      return {
        ...word,
        trendScore: trendData?.interactions || 0,
        lastActivity: trendData?.lastActivity
      };
    });
  }

  /**
   * Obtenir des mots adaptés à l'apprentissage d'une langue
   */
  private async getWordsForLanguageLearning(language: string, profile: UserRecommendationProfile, limit: number): Promise<any[]> {
    // Mots de base pour débutants, plus complexes pour avancés
    const proficiency = profile.languageProficiency?.get(language) || 1;
    
    let complexityFilter: any = {};
    if (proficiency <= 2) {
      // Débutant: mots simples, fréquents
      complexityFilter = {
        $or: [
          { 'meanings.0.definitions.0': { $exists: true } }, // Au moins une définition
          { translationCount: { $gte: 1 } } // Traduit au moins une fois
        ]
      };
    } else if (proficiency <= 4) {
      // Intermédiaire: mots plus variés
      complexityFilter = {
        $or: [
          { 'meanings.length': { $gte: 2 } }, // Plusieurs significations
          { extractedKeywords: { $exists: true, $ne: [] } } // Avec mots-clés
        ]
      };
    }

    return await this.wordModel
      .find({
        language,
        status: 'approved',
        ...complexityFilter
      })
      .limit(limit)
      .lean();
  }

  /**
   * Supprimer les doublons d'un tableau
   */
  private removeDuplicates(array: any[], key: string): any[] {
    const seen = new Set();
    return array.filter(item => {
      const keyValue = item[key];
      if (seen.has(keyValue)) {
        return false;
      }
      seen.add(keyValue);
      return true;
    });
  }

  /**
   * Scorer les candidats comportementaux
   */
  private async scoreBehavioralCandidates(candidates: any[], interests: any, recentViews: any[], favorites: any[]): Promise<any[]> {
    return candidates.map(candidate => {
      let score = 0.1; // Score de base
      const reasons: string[] = [];

      // Bonus pour catégorie d'intérêt
      if (interests.categories.includes(candidate.categoryId?.toString())) {
        score += 0.3;
        reasons.push('Catégorie d\'intérêt');
      }

      // Bonus pour langue familière
      if (interests.languages.includes(candidate.language)) {
        score += 0.2;
        reasons.push('Langue familière');
      }

      // Bonus pour mots-clés communs
      const commonKeywords = candidate.extractedKeywords?.filter((k: string) => interests.keywords.includes(k)) || [];
      if (commonKeywords.length > 0) {
        score += Math.min(0.3, commonKeywords.length * 0.1);
        reasons.push(`Concepts similaires (${commonKeywords.length})`);
      }

      // Bonus pour popularité
      if (candidate.translationCount > 5) {
        score += 0.1;
        reasons.push('Mot populaire');
      }

      return {
        word: candidate,
        behavioralScore: Math.min(1, score),
        reasons,
        similarity: score
      };
    });
  }

  /**
   * Scorer les candidats sémantiques
   */
  private async scoreSemanticCandidates(candidates: any[], recentWords: any[]): Promise<any[]> {
    return candidates.map(candidate => ({
      ...candidate,
      semanticScore: Math.min(1, candidate.similarity * 0.8 + 0.2)
    }));
  }

  /**
   * Scorer les tendances communautaires
   */
  private async scoreCommunityTrends(words: any[], userId: string, activities: any[]): Promise<any[]> {
    return words.map(word => {
      let score = 0.1;
      
      // Score basé sur les interactions récentes
      const interactionScore = Math.min(0.6, word.trendScore * 0.1);
      score += interactionScore;

      // Bonus pour mots récents
      const daysSinceCreation = (Date.now() - new Date(word.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceCreation <= 7) {
        score += 0.3;
        word.isNew = true;
      }

      return {
        ...word,
        communityScore: Math.min(1, score),
        interactions: word.trendScore
      };
    });
  }

  /**
   * Scorer les candidats linguistiques
   */
  private async scoreLinguisticCandidates(candidates: any[], profile: UserRecommendationProfile, userId: string): Promise<any[]> {
    return candidates.map(candidate => {
      const proficiency = profile.languageProficiency?.get(candidate.language) || 1;
      
      let score = 0.2; // Score de base
      let difficulty = 'débutant';
      let difficultyReason = '';

      // Ajuster selon le niveau
      if (proficiency <= 2) {
        // Privilégier les mots simples
        if (candidate.meanings?.length === 1) {
          score += 0.4;
          difficulty = 'débutant';
          difficultyReason = 'mot simple';
        }
      } else {
        // Privilégier les mots plus complexes
        if (candidate.meanings?.length > 1) {
          score += 0.5;
          difficulty = 'intermédiaire';
          difficultyReason = 'sens multiples';
        }
      }

      // Bonus pour mots fondamentaux
      const isCore = candidate.translationCount > 3;
      if (isCore) {
        score += 0.3;
      }

      return {
        ...candidate,
        linguisticScore: Math.min(1, score),
        difficulty,
        difficultyReason,
        isCore,
        languageName: candidate.language // À améliorer avec le nom complet
      };
    });
  }

  /**
   * Formater la réponse finale
   */
  private async formatResponse(recommendations: RecommendationResult[], fromCache: boolean, generationTimeMs: number): Promise<RecommendationsResponseDto> {
    const formattedRecommendations: RecommendationItemDto[] = [];

    for (const rec of recommendations) {
      const word = await this.wordModel.findById(rec.wordId).populate('categoryId').lean();
      if (!word) continue;

      const language = await this.languageModel.findOne({
        $or: [
          { 'codes.iso639_1': word.language },
          { name: word.language }
        ]
      });

      formattedRecommendations.push({
        id: word._id.toString(),
        word: word.word,
        language: word.language || 'unknown',
        languageName: language?.name || word.language || 'Unknown',
        languageFlag: language?.flagEmoji || '🌍',
        definition: word.meanings?.[0]?.definitions?.[0]?.definition || 'Définition non disponible',
        score: rec.score,
        reasons: rec.reasons,
        category: rec.category,
        pronunciation: word.pronunciation,
        examples: word.meanings?.[0]?.definitions?.[0]?.examples || [],
        audioUrl: word.audioFiles ? Object.values(word.audioFiles as any)?.[0]?.['url'] : undefined,
        metadata: rec.metadata
      });
    }

    return {
      recommendations: formattedRecommendations,
      count: formattedRecommendations.length,
      type: recommendations[0]?.category || 'mixed',
      timestamp: new Date().toISOString(),
      fromCache,
      generationTimeMs,
      avgScore: recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length || 0,
      algorithm: {
        type: 'intelligent_v1',
        weights: {
          behavioral: 0.4,
          semantic: 0.3,
          community: 0.2,
          linguistic: 0.1
        }
      }
    };
  }

  /**
   * Enregistrer le feedback utilisateur
   */
  async recordFeedback(userId: string, feedback: RecommendationFeedbackDto): Promise<FeedbackResponseDto> {
    this.logger.log(`📝 Feedback reçu de ${userId}: ${feedback.feedbackType} pour mot ${feedback.wordId}`);

    try {
      // Mettre à jour le profil utilisateur
      await this.userProfileModel.findOneAndUpdate(
        { userId },
        { 
          $push: { 
            feedbackHistory: {
              wordId: feedback.wordId,
              feedbackType: feedback.feedbackType,
              timestamp: new Date(),
              reason: feedback.reason
            }
          },
          $inc: {
            totalRecommendationsSeen: feedback.feedbackType === 'view' ? 1 : 0,
            totalRecommendationsClicked: ['view', 'like', 'favorite'].includes(feedback.feedbackType) ? 1 : 0,
            totalRecommendationsFavorited: feedback.feedbackType === 'favorite' ? 1 : 0
          }
        },
        { upsert: true }
      );

      // Invalider le cache pour forcer une régénération
      await this.cacheModel.deleteMany({ userId });

      let impact = '';
      switch (feedback.feedbackType) {
        case 'like':
          impact = 'Augmentera les recommandations similaires';
          break;
        case 'dislike':
          impact = 'Réduira les recommandations de ce type';
          break;
        case 'not_interested':
          impact = 'Évitera cette catégorie de mots';
          break;
        case 'favorite':
          impact = 'Privilégiera des mots dans la même thématique';
          break;
        case 'view':
          impact = 'Enrichira votre profil d\'intérêts';
          break;
      }

      return {
        success: true,
        message: 'Feedback enregistré avec succès',
        impact,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'enregistrement du feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtenir des recommandations tendance
   */
  async getTrendingRecommendations(dto: TrendingRecommendationsDto): Promise<RecommendationsResponseDto> {
    this.logger.log(`📈 Génération recommandations tendance: région=${dto.region}, période=${dto.period}`);

    const startTime = Date.now();
    const periodMs = this.getPeriodInMs(dto.period || '7d');

    // Analyser l'activité récente pour identifier les tendances
    const trendingWords = await this.activityModel.aggregate([
      {
        $match: {
          type: { $in: ['word_created', 'word_approved', 'word_favorited'] },
          createdAt: { $gte: new Date(Date.now() - periodMs) },
          ...(dto.region && { region: dto.region })
        }
      },
      {
        $group: {
          _id: '$targetId',
          interactions: { $sum: 1 },
          lastActivity: { $max: '$createdAt' },
          types: { $addToSet: '$type' }
        }
      },
      {
        $sort: { interactions: -1 as 1 | -1 }
      },
      {
        $limit: dto.limit || 5
      }
    ]);

    const recommendations: RecommendationResult[] = [];

    for (const trend of trendingWords) {
      const word = await this.wordModel.findById(trend._id);
      if (word && word.status === 'approved') {
        recommendations.push({
          wordId: (word._id as any).toString(),
          score: Math.min(1, trend.interactions / 10), // Normaliser le score
          reasons: [
            `${trend.interactions} interactions récentes`,
            `Tendance ${dto.period || '7d'}`,
            trend.types.includes('word_created') ? 'Mot récemment ajouté' : 'Populaire'
          ],
          category: 'community',
          metadata: {
            interactions: trend.interactions,
            trendPeriod: dto.period,
            region: dto.region,
            activityTypes: trend.types
          }
        });
      }
    }

    return this.formatResponse(recommendations, false, Date.now() - startTime);
  }

  /**
   * Obtenir des recommandations linguistiques spécifiques
   */
  async getLinguisticRecommendations(dto: LinguisticRecommendationsDto): Promise<RecommendationsResponseDto> {
    this.logger.log(`🌍 Génération recommandations linguistiques: langue=${dto.language}, niveau=${dto.level}`);

    const startTime = Date.now();
    
    // Adapter la complexité selon le niveau
    let complexityFilter: any = {};
    let difficultyLabel = '';

    switch (dto.level) {
      case 1:
      case 2:
        // Débutant: mots simples
        complexityFilter = {
          $or: [
            { 'meanings': { $size: 1 } },
            { translationCount: { $gte: 3 } }
          ]
        };
        difficultyLabel = 'débutant';
        break;
      case 3:
        // Intermédiaire
        complexityFilter = {
          'meanings': { $size: { $gte: 1, $lte: 3 } }
        };
        difficultyLabel = 'intermédiaire';
        break;
      case 4:
      case 5:
        // Avancé: mots complexes
        complexityFilter = {
          $or: [
            { 'meanings': { $size: { $gte: 2 } } },
            { etymology: { $exists: true, $ne: '' } }
          ]
        };
        difficultyLabel = 'avancé';
        break;
    }

    const words = await this.wordModel
      .find({
        language: dto.language,
        status: 'approved',
        ...complexityFilter
      })
      .limit(dto.limit || 5)
      .sort({ translationCount: -1 }) // Privilégier les mots populaires
      .lean();

    const recommendations: RecommendationResult[] = words.map(word => ({
      wordId: word._id.toString(),
      score: 0.8 + (dto.level || 3) * 0.04, // Score basé sur le niveau
      reasons: [
        `Adapté niveau ${difficultyLabel}`,
        `Langue: ${dto.language}`,
        word.translationCount > 5 ? 'Mot populaire' : 'Mot enrichissant'
      ],
      category: 'linguistic',
      metadata: {
        language: dto.language,
        level: dto.level,
        difficulty: difficultyLabel,
        translationCount: word.translationCount
      }
    }));

    return this.formatResponse(recommendations, false, Date.now() - startTime);
  }

  /**
   * Convertir une période en millisecondes
   */
  private getPeriodInMs(period: string): number {
    switch (period) {
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }
}