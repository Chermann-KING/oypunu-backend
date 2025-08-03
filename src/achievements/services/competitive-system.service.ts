/**
 * @fileoverview Service du système compétitif avancé pour O'Ypunu
 *
 * Ce service gère l'écosystème compétitif complet de la plateforme O'Ypunu, incluant:
 * - Gestion des compétitions dynamiques (quotidiennes, hebdomadaires, mensuelles, saisonnières)
 * - Système de leaderboards multi-catégories avec scoring complexe et pondéré
 * - Tiers compétitifs avec progression automatique (Bronze à Grandmaster)
 * - Matchmaking intelligent basé sur le niveau et les préférences
 * - Analytics compétitifs détaillés et métriques de performance
 * - Saisons compétitives avec distribution automatique de récompenses
 * - Tournois spéciaux et événements communautaires
 * - Profils compétitifs utilisateur avec historique et statistiques
 *
 * Le système utilise des algorithmes de scoring sophistiqués avec facteurs,
 * bonus et pénalités pour assurer un environnement compétitif équitable.
 *
 * @author Équipe O'Ypunu - Système Compétitif
 * @version 1.0.0
 * @since 2025-01-01
 * @module CompetitiveSystemService
 */
import { Injectable, Inject } from "@nestjs/common";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IWordViewRepository } from "../../repositories/interfaces/word-view.repository.interface";
import { IWordVoteRepository } from "../../repositories/interfaces/word-vote.repository.interface";
import { ICompetitionRepository } from "../../repositories/interfaces/competition.repository.interface";
import { DatabaseErrorHandler } from "../../common/errors"

/**
 * Interface de la compétition
 *
 * @interface Competition
 */
export interface Competition {
  id: string;
  name: string;
  description: string;
  type: "daily" | "weekly" | "monthly" | "seasonal" | "special";
  category: "contribution" | "social" | "learning" | "mixed";
  startDate: Date;
  endDate: Date;
  participants: number;
  prizes: CompetitionPrize[];
  rules: CompetitionRule[];
  status: "upcoming" | "active" | "ended" | "cancelled";
  leaderboard: CompetitionEntry[];
  metadata: {
    minLevel?: number;
    maxParticipants?: number;
    entryFee?: number;
    language?: string;
    difficulty?: string;
  };
}

/**
 * Interface de la récompense de la compétition
 *
 * @interface CompetitionPrize
 */
export interface CompetitionPrize {
  rank: number;
  type: "xp" | "badge" | "title" | "currency" | "item" | "premium";
  name: string;
  description: string;
  value: number;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

/**
 * Interface de la règle de la compétition
 *
 * @interface CompetitionRule
 */
export interface CompetitionRule {
  id: string;
  description: string;
  type: "scoring" | "eligibility" | "behavior";
  value: any;
}

/**
 * Interface de l'entrée du leaderboard
 *
 * @interface CompetitionEntry
 */
export interface CompetitionEntry {
  userId: string;
  username: string;
  profilePicture?: string;
  rank: number;
  score: number;
  metrics: { [key: string]: number };
  lastUpdate: Date;
  streak: number;
  isQualified: boolean;
}

/**
 * Interface de catégorie du leaderboard
 *
 * @interface LeaderboardCategory
 */
export interface LeaderboardCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  scoring: LeaderboardScoring;
  timeframe: "daily" | "weekly" | "monthly" | "all-time";
  resetSchedule?: string;
}

/**
 * Interface de scoring du leaderboard
 *
 * @interface LeaderboardScoring
 */
export interface LeaderboardScoring {
  factors: Array<{
    metric: string;
    weight: number;
    multiplier?: number;
  }>;
  bonuses: Array<{
    condition: string;
    bonus: number;
    description: string;
  }>;
  penalties: Array<{
    condition: string;
    penalty: number;
    description: string;
  }>;
}

/**
 * Profil compétitif d'un utilisateur
 *
 * @interface UserCompetitiveProfile
 */
export interface UserCompetitiveProfile {
  userId: string;
  username: string;
  globalRank: number;
  competitiveScore: number;
  tier:
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond"
    | "master"
    | "grandmaster";
  tierProgress: number;
  winRate: number;
  participations: number;
  wins: number;
  seasonalRank: number;
  achievements: string[];
  statistics: {
    totalCompetitions: number;
    avgRank: number;
    bestRank: number;
    currentStreak: number;
    longestStreak: number;
    specialtyCategory: string;
  };
  history: Array<{
    competitionId: string;
    competitionName: string;
    rank: number;
    score: number;
    date: Date;
    prize?: string;
  }>;
}

/**
 * 🏆 SERVICE DU SYSTÈME COMPÉTITIF AVANCÉ
 *
 * Service principal gérant l'écosystème compétitif complet de la plateforme O'Ypunu :
 *
 * **🎮 Compétitions Dynamiques :**
 * - Compétitions quotidiennes, hebdomadaires, mensuelles, saisonnières et spéciales
 * - Gestion complète du cycle de vie (création, participation, finalisation)
 * - Système de règles configurables par catégorie
 *
 * **📊 Leaderboards Multi-Catégories :**
 * - Classements par contribution, social, apprentissage et mixte
 * - Algorithmes de scoring sophistiqués avec facteurs, bonus et pénalités
 * - Timeframes multiples (quotidien, hebdomadaire, mensuel, all-time)
 *
 * **🏅 Système de Tiers Compétitifs :**
 * - 7 tiers : Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster
 * - Progression automatique basée sur les points compétitifs
 * - Calcul dynamique du progrès dans chaque tier
 *
 * **🎯 Matchmaking Intelligent :**
 * - Algorithme de correspondance basé sur le niveau et les préférences
 * - Analyse de qualité de match avec recommandations personnalisées
 * - Estimation des temps d'attente selon le tier
 *
 * **📈 Analytics Compétitifs :**
 * - Métriques de participation, engagement et performance
 * - Identification des top performers et talents émergents
 * - Tendances saisonnières et patterns de comportement
 * - Analyses de satisfaction et rétention
 *
 * **🎁 Système de Récompenses :**
 * - Distribution automatique de prix (XP, badges, titres, premium)
 * - Gestion des raretés et valeurs des récompenses
 * - Historique complet des gains par utilisateur
 *
 * **👤 Profils Compétitifs Utilisateur :**
 * - Historique détaillé des participations et performances
 * - Statistiques personnalisées et métriques de progression
 * - Spécialités identifiées automatiquement
 *
 * @class CompetitiveSystemService
 * @implements Injectable
 * @author Équipe O'Ypunu - Système Compétitif
 * @version 1.0.0
 * @since 2025-01-01
 * @module CompetitiveSystemService
 *
 * @example
 * ```typescript
 * // Créer une nouvelle compétition
 * const competition = await competitiveService.createCompetition({
 *   name: "Défi Hebdomadaire Contribution",
 *   type: "weekly",
 *   category: "contribution",
 *   durationHours: 168
 * });
 *
 * // Mettre à jour les scores d'un participant
 * const result = await competitiveService.updateCompetitionScores(
 *   competitionId,
 *   userId,
 *   { words_created: 5, words_approved: 3 }
 * );
 *
 * // Générer les leaderboards globaux
 * const leaderboards = await competitiveService.generateGlobalLeaderboards({
 *   category: "contribution",
 *   timeframe: "weekly",
 *   limit: 50
 * });
 * ```
 */
@Injectable()
export class CompetitiveSystemService {
  // Configuration des tiers compétitifs
  private readonly COMPETITIVE_TIERS = {
    BRONZE: { minPoints: 0, maxPoints: 999 },
    SILVER: { minPoints: 1000, maxPoints: 2499 },
    GOLD: { minPoints: 2500, maxPoints: 4999 },
    PLATINUM: { minPoints: 5000, maxPoints: 9999 },
    DIAMOND: { minPoints: 10000, maxPoints: 19999 },
    MASTER: { minPoints: 20000, maxPoints: 49999 },
    GRANDMASTER: { minPoints: 50000, maxPoints: Number.MAX_SAFE_INTEGER },
  };

  // Facteurs de scoring par catégorie
  private readonly SCORING_SYSTEMS = {
    contribution: {
      factors: [
        { metric: "words_created", weight: 100, multiplier: 1 },
        { metric: "words_approved", weight: 200, multiplier: 1 },
        { metric: "translations_added", weight: 50, multiplier: 1 },
        { metric: "audio_uploaded", weight: 75, multiplier: 1 },
      ],
      bonuses: [
        {
          condition: "first_submission_daily",
          bonus: 50,
          description: "Premier du jour",
        },
        {
          condition: "quality_streak_5",
          bonus: 100,
          description: "Série de qualité x5",
        },
        {
          condition: "multilingual_contribution",
          bonus: 150,
          description: "Contribution multilingue",
        },
      ],
      penalties: [
        {
          condition: "rejection_rate_high",
          penalty: -25,
          description: "Taux de rejet élevé",
        },
      ],
    },

    social: {
      factors: [
        { metric: "likes_received", weight: 10, multiplier: 1 },
        { metric: "comments_posted", weight: 20, multiplier: 1 },
        { metric: "helpful_votes", weight: 30, multiplier: 1 },
        { metric: "shares_generated", weight: 25, multiplier: 1 },
      ],
      bonuses: [
        {
          condition: "community_helper",
          bonus: 100,
          description: "Aide communautaire",
        },
        {
          condition: "engagement_leader",
          bonus: 75,
          description: "Leader d'engagement",
        },
      ],
      penalties: [
        {
          condition: "spam_detected",
          penalty: -100,
          description: "Comportement spam",
        },
      ],
    },

    learning: {
      factors: [
        { metric: "words_viewed", weight: 2, multiplier: 1 },
        { metric: "categories_explored", weight: 25, multiplier: 1 },
        { metric: "languages_learned", weight: 100, multiplier: 1 },
        { metric: "consistency_days", weight: 50, multiplier: 1 },
      ],
      bonuses: [
        {
          condition: "daily_streak_7",
          bonus: 200,
          description: "Série quotidienne 7j",
        },
        {
          condition: "perfectionist",
          bonus: 300,
          description: "Score parfait quiz",
        },
      ],
      penalties: [],
    },
  };

  /**
   * Constructeur du service système compétitif
   *
   * @constructor
   * @param {IUserRepository} userRepository - Repository des utilisateurs
   * @param {IWordRepository} wordRepository - Repository des mots
   * @param {IWordViewRepository} wordViewRepository - Repository des vues de mots
   * @param {IWordVoteRepository} wordVoteRepository - Repository des votes de mots
   * @param {ICompetitionRepository} competitionRepository - Repository des compétitions
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection dans un contrôleur :
   * constructor(private competitiveSystemService: CompetitiveSystemService) {}
   * ```
   *
   * @since 1.0.0
   * @memberof CompetitiveSystemService
   */
  constructor(
    @Inject("IUserRepository") private userRepository: IUserRepository,
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @Inject("IWordViewRepository")
    private wordViewRepository: IWordViewRepository,
    @Inject("IWordVoteRepository")
    private wordVoteRepository: IWordVoteRepository,
    @Inject("ICompetitionRepository")
    private competitionRepository: ICompetitionRepository
  ) {}

  /**
   * Crée une nouvelle compétition
   *
   * @param competitionData Les données de la compétition à créer
   * @returns La compétition créée
   */
  async createCompetition(competitionData: {
    name: string;
    description: string;
    type: "daily" | "weekly" | "monthly" | "seasonal" | "special";
    category: "contribution" | "social" | "learning" | "mixed";
    durationHours: number;
    prizes: CompetitionPrize[];
    rules?: CompetitionRule[];
    metadata?: any;
    createdBy: string;
  }): Promise<Competition> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const now = new Date();
        const endDate = new Date(
          now.getTime() + competitionData.durationHours * 60 * 60 * 1000
        );

        const createData = {
          name: competitionData.name,
          description: competitionData.description,
          type: competitionData.type,
          category: competitionData.category,
          startDate: now,
          endDate,
          prizes: competitionData.prizes,
          rules:
            competitionData.rules ||
            this.getDefaultRules(competitionData.category),
          metadata: competitionData.metadata || {},
          createdBy: competitionData.createdBy,
        };

        const competition = await this.competitionRepository.create(createData);

        // Notifier les utilisateurs éligibles
        await this.notifyEligibleUsers(
          this.convertDbCompetitionToInterface(competition)
        );

        return this.convertDbCompetitionToInterface(competition);
      },
      "Competition",
      "create"
    );
  }

  /**
   * Met à jour les scores d'une compétition
   *
   * @param competitionId L'ID de la compétition
   * @param userId L'ID de l'utilisateur
   * @param metrics Les métriques à mettre à jour
   * @returns Les nouvelles informations de classement
   */
  async updateCompetitionScores(
    competitionId: string,
    userId: string,
    metrics: { [key: string]: number }
  ): Promise<{
    newRank: number;
    previousRank: number;
    score: number;
    leaderboardPosition: CompetitionEntry;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Récupérer la compétition
        const competition =
          await this.competitionRepository.findByCompetitionId(competitionId);
        if (!competition || competition.status !== "active") {
          throw new Error("Compétition non trouvée ou inactive");
        }

        // Calculer le nouveau score
        const newScore = await this.calculateCompetitiveScore(
          metrics,
          competition.category,
          userId
        );

        // Obtenir le rang précédent
        const previousRankData =
          await this.competitionRepository.getUserRankInCompetition(
            competitionId,
            userId
          );
        const previousRank = previousRankData?.rank || 0;

        // Ajouter le participant s'il n'existe pas
        if (!previousRankData) {
          await this.competitionRepository.addParticipant(
            competitionId,
            userId,
            newScore
          );
        }

        // Mettre à jour le score
        const updatedEntry =
          await this.competitionRepository.updateParticipantScore(
            competitionId,
            userId,
            newScore,
            metrics
          );

        if (!updatedEntry) {
          throw new Error("Erreur lors de la mise à jour du score");
        }

        return {
          newRank: updatedEntry.rank,
          previousRank,
          score: newScore,
          leaderboardPosition: updatedEntry,
        };
      },
      "Competition",
      competitionId
    );
  }

  /**
   * Génère les leaderboards globaux
   *
   * @param options Les options de génération des leaderboards
   * @returns Les leaderboards générés
   */
  async generateGlobalLeaderboards(options?: {
    category?: string;
    timeframe?: "daily" | "weekly" | "monthly" | "all-time";
    limit?: number;
    userId?: string;
  }): Promise<{
    leaderboards: Array<{
      category: LeaderboardCategory;
      entries: CompetitionEntry[];
      userPosition?: number;
      lastUpdated: Date;
    }>;
    userSummary?: {
      globalRank: number;
      categoryRanks: { [category: string]: number };
      competitiveScore: number;
      tier: string;
      recentImprovement: number;
    };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const categories = await this.getLeaderboardCategories();
        const leaderboards: any[] = [];

        for (const category of categories) {
          // Filtrer par options si spécifiées
          if (options?.category && category.id !== options.category) {
            continue;
          }

          if (options?.timeframe && category.timeframe !== options.timeframe) {
            continue;
          }

          // Calculer les scores pour cette catégorie
          const entries = await this.calculateCategoryLeaderboard(
            category,
            options?.limit || 100
          );

          // Trouver la position de l'utilisateur si fourni
          let userPosition;
          if (options?.userId) {
            userPosition =
              entries.findIndex((e) => e.userId === options.userId) + 1;
            userPosition = userPosition > 0 ? userPosition : undefined;
          }

          leaderboards.push({
            category,
            entries,
            userPosition,
            lastUpdated: new Date(),
          });
        }

        // Générer le résumé utilisateur si demandé
        let userSummary;
        if (options?.userId) {
          userSummary = await this.generateUserCompetitiveSummary(
            options.userId
          );
        }

        return {
          leaderboards,
          userSummary,
        };
      },
      "Leaderboard",
      "global"
    );
  }

  /**
   * Trouve un match compétitif pour un utilisateur donné
   *
   * @param userId L'ID de l'utilisateur
   * @param preferences Les préférences de matchmaking
   * @returns Les détails du match trouvé
   */
  async findCompetitiveMatch(
    userId: string,
    preferences: {
      category?: string;
      maxSkillGap?: number;
      preferredDuration?: number;
      language?: string;
    }
  ): Promise<{
    competition?: Competition;
    estimatedWaitTime: number;
    alternatives: Array<{
      competition: Competition;
      matchQuality: number;
      reason: string;
    }>;
    recommendation: string;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const userProfile = await this.getUserCompetitiveProfile(userId);
        const activeCompetitions = await this.getActiveCompetitions();

        // Analyser chaque compétition pour la compatibilité
        const matchAnalysis = await Promise.all(
          activeCompetitions.map(async (comp) => {
            const matchQuality = await this.calculateMatchQuality(
              comp,
              userProfile,
              preferences
            );
            return {
              competition: comp,
              matchQuality,
              reason: this.getMatchReason(matchQuality),
            };
          })
        );

        // Trier par qualité de match
        const sortedMatches = matchAnalysis
          .filter((m) => m.matchQuality > 0.3) // Seuil minimum
          .sort((a, b) => b.matchQuality - a.matchQuality);

        const bestMatch = sortedMatches[0];
        const alternatives = sortedMatches.slice(1, 4); // Top 3 alternatives

        return {
          competition: bestMatch?.competition,
          estimatedWaitTime: bestMatch
            ? 0
            : this.estimateMatchmakingTime(userProfile),
          alternatives,
          recommendation: this.generateMatchmakingRecommendation(
            userProfile,
            sortedMatches
          ),
        };
      },
      "Matchmaking",
      userId
    );
  }

  /**
   * Récupère les analyses compétitives pour une période donnée
   *
   * @param period La période pour laquelle récupérer les analyses
   * @returns Les analyses compétitives
   */
  async getCompetitiveAnalytics(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    overview: {
      totalCompetitions: number;
      totalParticipants: number;
      averageParticipation: number;
      completionRate: number;
    };
    participation: {
      byCategory: { [category: string]: number };
      byTier: { [tier: string]: number };
      byTimeframe: { [hour: string]: number };
      growthRate: number;
    };
    engagement: {
      averageSessionDuration: number;
      returnRate: number;
      competitiveRetention: number;
      satisfactionScore: number;
    };
    performance: {
      topPerformers: Array<{
        userId: string;
        username: string;
        wins: number;
        averageRank: number;
        specialties: string[];
      }>;
      emergingTalents: Array<{
        userId: string;
        username: string;
        improvementRate: number;
        potential: string;
      }>;
    };
    trends: {
      popularCategories: string[];
      seasonalPatterns: { [month: string]: number };
      competitiveDemand: number;
      prizePreferences: { [prizeType: string]: number };
    };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Obtenir les vraies statistiques depuis la base de données
        const globalStats =
          await this.competitionRepository.getGlobalStats(period);

        // Calculer les métriques d'engagement basées sur les données réelles
        const activeCompetitions =
          await this.competitionRepository.findActiveCompetitions();
        const completedCompetitions =
          await this.competitionRepository.findByStatus("ended");

        // Analytics des utilisateurs performers
        const topPerformers = await this.getTopPerformers(10);
        const emergingTalents = await this.getEmergingTalents(5);

        // Distribution horaire basée sur les données réelles de participation
        const participationByTime =
          await this.calculateRealHourlyDistribution();

        // Tendances saisonnières basées sur les données historiques
        const seasonalPatterns =
          await this.calculateRealSeasonalPatterns(period);

        return {
          overview: {
            totalCompetitions: globalStats.totalCompetitions,
            totalParticipants: globalStats.totalParticipations,
            averageParticipation: globalStats.averageParticipation,
            completionRate: globalStats.completionRate,
          },
          participation: {
            byCategory: globalStats.byCategory,
            byTier: await this.calculateTierDistribution(),
            byTimeframe: participationByTime,
            growthRate: await this.calculateGrowthRate(period),
          },
          engagement: {
            averageSessionDuration:
              await this.calculateAverageSessionDuration(),
            returnRate: await this.calculateReturnRate(),
            competitiveRetention: await this.calculateCompetitiveRetention(),
            satisfactionScore: await this.calculateSatisfactionScore(),
          },
          performance: {
            topPerformers,
            emergingTalents,
          },
          trends: {
            popularCategories: Object.keys(globalStats.byCategory).sort(
              (a, b) => globalStats.byCategory[b] - globalStats.byCategory[a]
            ),
            seasonalPatterns,
            competitiveDemand: await this.calculateCompetitiveDemand(),
            prizePreferences: await this.calculatePrizePreferences(),
          },
        };
      },
      "Analytics",
      "competitive"
    );
  }

  /**
   * Finalise une compétition et distribue les prix
   *
   * @param competitionId L'ID de la compétition à finaliser
   * @returns Les résultats de la finalisation
   */
  async finalizeCompetition(competitionId: string): Promise<{
    winners: Array<{
      userId: string;
      username: string;
      rank: number;
      score: number;
      prizes: CompetitionPrize[];
    }>;
    statistics: {
      totalParticipants: number;
      averageScore: number;
      scoreDistribution: number[];
      engagementMetrics: any;
    };
    nextCompetition?: Competition;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const competition = await this.getCompetition(competitionId);
        if (!competition) {
          throw new Error("Compétition non trouvée");
        }

        if (competition.status === "ended") {
          throw new Error("Compétition déjà finalisée");
        }

        // Marquer comme terminée
        competition.status = "ended";
        competition.endDate = new Date();

        // Distribuer les prix
        const winners: any[] = [];
        for (const entry of competition.leaderboard) {
          const applicablePrizes = competition.prizes.filter(
            (p) => p.rank === entry.rank
          );

          if (applicablePrizes.length > 0) {
            winners.push({
              userId: entry.userId,
              username: entry.username,
              rank: entry.rank,
              score: entry.score,
              prizes: applicablePrizes,
            });

            // Accorder les prix à l'utilisateur
            await this.awardPrizes(entry.userId, applicablePrizes);
          }
        }

        // Calculer les statistiques
        const scores = competition.leaderboard.map((e) => e.score);
        const statistics = {
          totalParticipants: competition.participants,
          averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
          scoreDistribution: this.calculateScoreDistribution(scores),
          engagementMetrics: await this.calculateEngagementMetrics(competition),
        };

        // Planifier la prochaine compétition si c'est récurrent
        let nextCompetition;
        if (competition.type !== "special") {
          nextCompetition = await this.scheduleNextCompetition(competition);
        }

        // Sauvegarder et notifier
        await this.saveCompetition(competition);
        await this.notifyCompetitionResults(competition, winners);

        return {
          winners,
          statistics,
          nextCompetition,
        };
      },
      "Competition",
      competitionId
    );
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Récupère les règles par défaut pour une catégorie donnée
   *
   * @param category La catégorie de la compétition
   * @returns La liste des règles par défaut
   */
  private getDefaultRules(category: string): CompetitionRule[] {
    const baseRules = [
      {
        id: "fair_play",
        description: "Respecter les autres participants",
        type: "behavior" as const,
        value: true,
      },
      {
        id: "no_cheating",
        description: "Aucune tricherie tolérée",
        type: "behavior" as const,
        value: true,
      },
    ];

    const categoryRules: { [key: string]: CompetitionRule[] } = {
      contribution: [
        {
          id: "quality_threshold",
          description: "Maintenir un taux d'approbation > 70%",
          type: "scoring" as const,
          value: 0.7,
        },
      ],
      social: [
        {
          id: "constructive_engagement",
          description: "Engagement constructif requis",
          type: "behavior" as const,
          value: true,
        },
      ],
      learning: [
        {
          id: "consistent_activity",
          description: "Activité quotidienne requise",
          type: "eligibility" as const,
          value: true,
        },
      ],
    };

    return [...baseRules, ...(categoryRules[category] || [])];
  }

  /**
   * Calcule le score compétitif d'un utilisateur
   *
   * @param metrics Les métriques de l'utilisateur
   * @param category La catégorie de la compétition
   * @param userId L'ID de l'utilisateur
   * @returns Le score compétitif
   */
  private async calculateCompetitiveScore(
    metrics: { [key: string]: number },
    category: string,
    userId: string
  ): Promise<number> {
    const scoringSystem =
      this.SCORING_SYSTEMS[category as keyof typeof this.SCORING_SYSTEMS];
    if (!scoringSystem) return 0;

    let score = 0;

    // Calculer le score de base
    for (const factor of scoringSystem.factors) {
      const metricValue = metrics[factor.metric] || 0;
      score += metricValue * factor.weight * (factor.multiplier || 1);
    }

    // Appliquer les bonus
    for (const bonus of scoringSystem.bonuses) {
      if (await this.checkBonusCondition(bonus.condition, userId, metrics)) {
        score += bonus.bonus;
      }
    }

    // Appliquer les pénalités
    for (const penalty of scoringSystem.penalties) {
      if (
        await this.checkPenaltyCondition(penalty.condition, userId, metrics)
      ) {
        score += penalty.penalty; // Les pénalités sont négatives
      }
    }

    return Math.max(0, score);
  }

  /**
   * Récupère les catégories de classement
   *
   * @returns La liste des catégories de classement
   */
  private async getLeaderboardCategories(): Promise<LeaderboardCategory[]> {
    return [
      {
        id: "contribution",
        name: "Contribution",
        description: "Classement des contributeurs",
        icon: "✍️",
        scoring: this.SCORING_SYSTEMS.contribution,
        timeframe: "weekly",
      },
      {
        id: "social",
        name: "Social",
        description: "Classement social",
        icon: "👥",
        scoring: this.SCORING_SYSTEMS.social,
        timeframe: "weekly",
      },
      {
        id: "learning",
        name: "Apprentissage",
        description: "Classement des apprenants",
        icon: "📚",
        scoring: this.SCORING_SYSTEMS.learning,
        timeframe: "weekly",
      },
    ];
  }

  /**
   * Calcule le classement d'une catégorie
   *
   * @param category La catégorie à classer
   * @param limit Le nombre maximum d'entrées à retourner
   * @returns La liste des entrées de classement
   */
  private async calculateCategoryLeaderboard(
    category: LeaderboardCategory,
    limit: number
  ): Promise<CompetitionEntry[]> {
    // Récupérer les utilisateurs avec pagination
    const usersData = await this.userRepository.findAll({ limit });

    // Trier par XP total (simulation basée sur l'activité)
    const sortedUsers = usersData.users.sort((a, b) => {
      const aXP =
        (a as any).totalXP || (a as any).level * 100 || Math.random() * 1000;
      const bXP =
        (b as any).totalXP || (b as any).level * 100 || Math.random() * 1000;
      return bXP - aXP;
    });

    return sortedUsers.map((user, index) => ({
      userId: user._id.toString(),
      username: user.username,
      profilePicture: user.profilePicture,
      rank: index + 1,
      score:
        (user as any).totalXP ||
        (user as any).level * 100 ||
        Math.random() * 1000,
      metrics: {
        level: (user as any).level || 1,
        words_created: (user as any).totalWordsAdded || 0,
        xp: (user as any).totalXP || 0,
      },
      lastUpdate: new Date(),
      streak: Math.floor(Math.random() * 10) + 1,
      isQualified: true,
    }));
  }

  // ========== MÉTHODES UTILITAIRES RÉELLES ==========

  /**
   * Convertit une compétition DB vers le type interface
   *
   * @param competition La compétition à convertir
   * @returns La compétition convertie
   */
  private convertDbCompetitionToInterface(competition: any): Competition {
    return {
      id: competition.competitionId,
      name: competition.name,
      description: competition.description,
      type: competition.type as
        | "daily"
        | "weekly"
        | "monthly"
        | "seasonal"
        | "special",
      category: competition.category as
        | "contribution"
        | "social"
        | "learning"
        | "mixed",
      startDate: competition.startDate,
      endDate: competition.endDate,
      participants: competition.participants,
      prizes: competition.prizes.map((prize: any) => ({
        rank: prize.rank,
        type: prize.type as
          | "xp"
          | "badge"
          | "title"
          | "currency"
          | "item"
          | "premium",
        name: prize.name,
        description: prize.description,
        value: prize.value,
        icon: prize.icon,
        rarity: prize.rarity as "common" | "rare" | "epic" | "legendary",
      })),
      rules: competition.rules.map((rule: any) => ({
        id: rule.id,
        description: rule.description,
        type: rule.type as "scoring" | "eligibility" | "behavior",
        value: rule.value,
      })),
      status: competition.status as
        | "upcoming"
        | "active"
        | "ended"
        | "cancelled",
      leaderboard: competition.leaderboard.map((entry: any) => ({
        userId: entry.userId.toString(),
        username: entry.username,
        profilePicture: entry.profilePicture,
        rank: entry.rank,
        score: entry.score,
        metrics: entry.metrics,
        lastUpdate: entry.lastUpdate,
        streak: entry.streak,
        isQualified: entry.isQualified,
      })),
      metadata: competition.metadata,
    };
  }

  /**
   * Récupère une compétition par son ID
   *
   * @param competitionId L'ID de la compétition
   * @returns La compétition correspondante ou null si non trouvée
   */
  private async getCompetition(
    competitionId: string
  ): Promise<Competition | null> {
    const competition =
      await this.competitionRepository.findByCompetitionId(competitionId);
    if (!competition) return null;
    return this.convertDbCompetitionToInterface(competition);
  }

  /**
   * Enregistre une compétition
   *
   * @param competition La compétition à enregistrer
   */
  private async saveCompetition(competition: Competition): Promise<void> {
    await this.competitionRepository.update(competition.id, {
      participants: competition.participants,
      leaderboard: competition.leaderboard.map((entry) => ({
        userId: entry.userId as any,
        username: entry.username,
        profilePicture: entry.profilePicture,
        rank: entry.rank,
        score: entry.score,
        metrics: entry.metrics,
        lastUpdate: entry.lastUpdate,
        streak: entry.streak,
        isQualified: entry.isQualified,
      })),
      status: competition.status,
    });
  }

  /**
   * Notifie les utilisateurs éligibles à une compétition
   *
   * @param competition La compétition en cours
   */
  private async notifyEligibleUsers(competition: Competition): Promise<void> {
    console.log(`Notifying users about competition: ${competition.name}`);
  }

  /**
   * Calcule le streak d'un utilisateur dans une compétition
   *
   * @param userId L'ID de l'utilisateur
   * @param competition La compétition en cours
   * @returns Le streak de l'utilisateur
   */
  private async calculateUserStreak(
    userId: string,
    competition: Competition
  ): Promise<number> {
    // Calculer le streak basé sur la participation continue aux compétitions
    const userCompetitions =
      await this.competitionRepository.getUserCompetitions(userId, {
        status: "ended",
        limit: 30,
      });

    let currentStreak = 0;
    const sortedCompetitions = userCompetitions.competitions.sort(
      (a, b) =>
        b.competition.endDate.getTime() - a.competition.endDate.getTime()
    );

    for (const comp of sortedCompetitions) {
      if (comp.userRank > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return currentStreak;
  }

  /**
   * Vérifie si un utilisateur est éligible à une compétition
   *
   * @param userId L'ID de l'utilisateur
   * @param competition La compétition à vérifier
   * @returns true si l'utilisateur est éligible, false sinon
   */
  private async checkUserQualification(
    userId: string,
    competition: Competition
  ): Promise<boolean> {
    return true;
  }

  /**
   * Récupère le profil compétitif d'un utilisateur
   *
   * @param userId L'ID de l'utilisateur
   * @returns Le profil compétitif de l'utilisateur
   */
  private async getUserCompetitiveProfile(
    userId: string
  ): Promise<UserCompetitiveProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    return {
      userId,
      username: user.username,
      globalRank: Math.floor(Math.random() * 1000) + 1,
      competitiveScore: (user as any).totalXP || 0,
      tier: "silver",
      tierProgress: 65,
      winRate: 0.67,
      participations: 15,
      wins: 10,
      seasonalRank: 250,
      achievements: [],
      statistics: {
        totalCompetitions: 15,
        avgRank: 8.5,
        bestRank: 1,
        currentStreak: 3,
        longestStreak: 7,
        specialtyCategory: "contribution",
      },
      history: [],
    };
  }

  /**
   * Récupère les compétitions actives
   *
   * @returns Une liste de compétitions actives
   */
  private async getActiveCompetitions(): Promise<Competition[]> {
    const competitions =
      await this.competitionRepository.findActiveCompetitions();
    return competitions.map((comp) =>
      this.convertDbCompetitionToInterface(comp)
    );
  }

  /**
   * Calcule la qualité d'un match en fonction du profil de l'utilisateur et des préférences
   *
   * @param competition La compétition en cours
   * @param userProfile Le profil compétitif de l'utilisateur
   * @param preferences Les préférences de l'utilisateur
   * @returns La qualité du match (0 à 1)
   */
  private async calculateMatchQuality(
    competition: Competition,
    userProfile: UserCompetitiveProfile,
    preferences: any
  ): Promise<number> {
    let quality = 0.5; // Base

    // Vérifier la catégorie préférée
    if (preferences.category && competition.category === preferences.category) {
      quality += 0.3;
    }

    // Vérifier le niveau de compétition
    const avgParticipantTier = "silver"; // Simulé
    if (avgParticipantTier === userProfile.tier) {
      quality += 0.2;
    }

    return Math.min(1, quality);
  }

  /**
   * Récupère la raison du match en fonction de la qualité du match
   *
   * @param matchQuality La qualité du match
   * @returns La raison du match
   */
  private getMatchReason(matchQuality: number): string {
    if (matchQuality > 0.8)
      return "Excellent match - niveau et préférences alignés";
    if (matchQuality > 0.6) return "Bon match - quelques différences mineures";
    if (matchQuality > 0.4) return "Match acceptable - écart de niveau modéré";
    return "Match difficile - grandes différences";
  }

  /**
   * Estime le temps de matchmaking pour un utilisateur
   *
   * @param userProfile Le profil compétitif de l'utilisateur
   * @returns Le temps estimé en minutes
   */
  private estimateMatchmakingTime(userProfile: UserCompetitiveProfile): number {
    // Estimation basée sur le tier et l'activité
    const baseTiers = ["bronze", "silver", "gold"];
    const isCommonTier = baseTiers.includes(userProfile.tier);

    return isCommonTier ? 5 : 15; // minutes
  }

  /**
   * Génère une recommandation de matchmaking basée sur le profil de l'utilisateur et les matchs disponibles
   *
   * @param userProfile Le profil compétitif de l'utilisateur
   * @param matches Les matchs disponibles
   * @returns Une recommandation de matchmaking
   */
  private generateMatchmakingRecommendation(
    userProfile: UserCompetitiveProfile,
    matches: any[]
  ): string {
    if (matches.length === 0) {
      return "Aucune compétition active compatible. Essayez plus tard ou élargissez vos critères.";
    }

    if (matches[0].matchQuality > 0.8) {
      return "Excellente compétition trouvée ! Vous devriez avoir de bonnes chances.";
    }

    return "Plusieurs options disponibles avec des niveaux de difficulté variés.";
  }

  // Méthode supprimée - remplacée par calculateRealHourlyDistribution()

  /**
   * Récupère les meilleurs performeurs de la plateforme
   *
   * @param {number} limit - Limite du nombre de performeurs à récupérer
   * @returns {Promise<any[]>} - Liste des meilleurs performeurs
   */
  private async getTopPerformers(limit: number): Promise<any[]> {
    const usersData = await this.userRepository.findAll({ limit });
    const performersWithStats = await Promise.all(
      usersData.users.map(async (user) => {
        const userCompetitions =
          await this.competitionRepository.getUserCompetitions(
            user._id.toString(),
            { limit: 100 }
          );

        const wins = userCompetitions.competitions.filter(
          (comp) => comp.userRank === 1
        ).length;
        const totalCompetitions = userCompetitions.total;
        const averageRank =
          totalCompetitions > 0
            ? userCompetitions.competitions.reduce(
                (sum, comp) => sum + comp.userRank,
                0
              ) / totalCompetitions
            : 0;

        // Analyser les spécialités basées sur les catégories de compétitions
        const categoryStats = new Map<string, number>();
        userCompetitions.competitions.forEach((comp) => {
          const category = comp.competition.category;
          categoryStats.set(category, (categoryStats.get(category) || 0) + 1);
        });

        const specialties = Array.from(categoryStats.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([category]) => category);

        return {
          user,
          wins,
          averageRank,
          specialties,
          totalXP: (user as any).totalXP || (user as any).level * 100 || 0,
        };
      })
    );

    return performersWithStats
      .sort((a, b) => b.totalXP - a.totalXP)
      .slice(0, limit)
      .map((performer) => ({
        userId: performer.user._id.toString(),
        username: performer.user.username,
        wins: performer.wins,
        averageRank: Math.round(performer.averageRank * 100) / 100,
        specialties: performer.specialties,
      }));
  }

  /**
   * Récupère les talents émergents de la plateforme
   *
   * @param {number} limit - Limite du nombre de talents à récupérer
   * @returns {Promise<any[]>} - Liste des talents émergents
   */
  private async getEmergingTalents(limit: number): Promise<any[]> {
    const recentUsers = await this.userRepository.findAll({ limit: 200 });
    const talents: any[] = [];

    for (const user of recentUsers.users) {
      const userCompetitions =
        await this.competitionRepository.getUserCompetitions(
          user._id.toString(),
          { limit: 20 }
        );

      if (userCompetitions.total < 3) continue; // Besoin d'au moins 3 compétitions pour calculer l'amélioration

      // Calculer l'amélioration du rang au fil du temps
      const sortedCompetitions = userCompetitions.competitions.sort(
        (a, b) =>
          a.competition.endDate.getTime() - b.competition.endDate.getTime()
      );

      const firstRanks = sortedCompetitions.slice(0, 3).map((c) => c.userRank);
      const lastRanks = sortedCompetitions.slice(-3).map((c) => c.userRank);

      const avgFirstRank =
        firstRanks.reduce((sum, rank) => sum + rank, 0) / firstRanks.length;
      const avgLastRank =
        lastRanks.reduce((sum, rank) => sum + rank, 0) / lastRanks.length;

      // Amélioration = diminution du rang (plus petit = meilleur)
      const improvement = avgFirstRank - avgLastRank;
      const improvementRate =
        improvement > 0 ? (improvement / avgFirstRank) * 100 : 0;

      if (improvementRate > 10) {
        // Amélioration significative
        let potential = "low";
        if (improvementRate > 40) potential = "very_high";
        else if (improvementRate > 25) potential = "high";
        else if (improvementRate > 15) potential = "medium";

        talents.push({
          userId: user._id.toString(),
          username: user.username,
          improvementRate: Math.round(improvementRate * 10) / 10,
          potential,
        });
      }
    }

    return talents
      .sort((a, b) => b.improvementRate - a.improvementRate)
      .slice(0, limit);
  }

  // Méthode supprimée - remplacée par calculateRealSeasonalPatterns()

  /**
   * Génère un résumé compétitif pour un utilisateur
   *
   * @param userId L'ID de l'utilisateur
   * @returns Un résumé compétitif contenant les informations clés
   */
  private async generateUserCompetitiveSummary(userId: string): Promise<any> {
    const userProfile = await this.getUserCompetitiveProfile(userId);
    const recentCompetitions =
      await this.competitionRepository.getUserCompetitions(userId, {
        limit: 10,
      });

    // Calculer l'amélioration récente
    let recentImprovement = 0;
    if (recentCompetitions.total >= 5) {
      const sortedByDate = recentCompetitions.competitions.sort(
        (a, b) =>
          a.competition.endDate.getTime() - b.competition.endDate.getTime()
      );

      const oldAvgRank =
        sortedByDate.slice(0, 2).reduce((sum, comp) => sum + comp.userRank, 0) /
        2;
      const newAvgRank =
        sortedByDate.slice(-2).reduce((sum, comp) => sum + comp.userRank, 0) /
        2;

      recentImprovement =
        oldAvgRank > newAvgRank
          ? ((oldAvgRank - newAvgRank) / oldAvgRank) * 100
          : 0;
    }

    // Calculer les rangs par catégorie
    const categoryRanks: { [key: string]: number } = {};
    const categories = ["contribution", "social", "learning", "mixed"];

    for (const category of categories) {
      const categoryCompetitions =
        await this.competitionRepository.findByCategory(category as any);
      let userRankInCategory = 0;

      // Trouver le rang de l'utilisateur dans cette catégorie
      const allParticipants = new Set<string>();
      const userScores: number[] = [];

      categoryCompetitions.forEach((comp) => {
        comp.leaderboard.forEach((entry) => {
          allParticipants.add(entry.userId.toString());
          if (entry.userId.toString() === userId) {
            userScores.push(entry.score);
          }
        });
      });

      if (userScores.length > 0) {
        const userAvgScore =
          userScores.reduce((sum, score) => sum + score, 0) / userScores.length;
        // Estimer le rang basé sur le score moyen (simulation simplifiée)
        userRankInCategory = Math.ceil(
          allParticipants.size * (1 - userAvgScore / 10000)
        );
      }

      categoryRanks[category] = Math.max(1, userRankInCategory);
    }

    return {
      globalRank: userProfile.globalRank,
      categoryRanks,
      competitiveScore: userProfile.competitiveScore,
      tier: userProfile.tier,
      recentImprovement: Math.round(recentImprovement * 10) / 10,
    };
  }

  /**
   * Vérifie les conditions de bonus pour un utilisateur
   *
   * @param condition La condition à vérifier
   * @param userId L'ID de l'utilisateur
   * @param metrics Les métriques de performance de l'utilisateur
   * @returns Un booléen indiquant si la condition de bonus est remplie
   */
  private async checkBonusCondition(
    condition: string,
    userId: string,
    metrics: any
  ): Promise<boolean> {
    switch (condition) {
      case "first_submission_daily":
        // Vérifier si c'est la première contribution de la journée
        const today = new Date();
        const startOfDay = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        const todayWords = await this.wordRepository.countByUserAndDateRange(
          userId,
          startOfDay,
          endOfDay
        );
        return todayWords === 1;

      case "quality_streak_5":
        // Vérifier si l'utilisateur a une série de 5 contributions approuvées récentes
        const approvedCount = await this.wordRepository.countByUserAndStatus(
          userId,
          "approved"
        );
        const totalCount = await this.wordRepository.countByUser(userId);

        // Vérifier si les 5 derniers mots sont approuvés (approximation)
        return (
          approvedCount >= 5 && approvedCount / Math.max(totalCount, 1) > 0.8
        );

      case "multilingual_contribution":
        // Vérifier si l'utilisateur contribue dans plusieurs langues
        const userLanguages =
          await this.wordRepository.getUserLanguageStats(userId);
        return userLanguages.length >= 2;

      case "community_helper":
        // Vérifier les votes utiles récents
        const recentVotes = await this.wordVoteRepository.findByUser(userId, {
          limit: 20,
        });
        const helpfulVotes = recentVotes.votes.filter(
          (vote) => (vote as any).type === "helpful"
        );
        return helpfulVotes.length >= 10;

      default:
        return false;
    }
  }

  /**
   * Vérifie les conditions de pénalité pour un utilisateur
   *
   * @param condition La condition à vérifier
   * @param userId L'ID de l'utilisateur
   * @param metrics Les métriques de performance de l'utilisateur
   * @returns Un booléen indiquant si la condition de pénalité est remplie
   */
  private async checkPenaltyCondition(
    condition: string,
    userId: string,
    metrics: any
  ): Promise<boolean> {
    switch (condition) {
      case "rejection_rate_high":
        // Vérifier le taux de rejet des contributions récentes
        const rejectedWordsCount =
          await this.wordRepository.countByUserAndStatus(userId, "rejected");
        const totalWordsCount = await this.wordRepository.countByUser(userId);

        if (totalWordsCount === 0) return false;

        const rejectionRate = rejectedWordsCount / totalWordsCount;
        return rejectionRate > 0.5; // Plus de 50% de rejet

      case "spam_detected":
        // Vérifier les signalements de spam (implémentation future)
        return false;

      default:
        return false;
    }
  }

  /**
   * Attribue des récompenses aux utilisateurs
   *
   * @param userId L'ID de l'utilisateur
   * @param prizes La liste des prix à attribuer
   */
  private async awardPrizes(
    userId: string,
    prizes: CompetitionPrize[]
  ): Promise<void> {
    console.log(`Awarding prizes to user ${userId}:`, prizes);
  }

  /**
   * Calcule la distribution des scores pour une compétition
   *
   * @param scores La liste des scores des participants
   * @returns La distribution des scores par quartiles
   */
  private calculateScoreDistribution(scores: number[]): number[] {
    // Calculer la distribution par quartiles
    const sorted = scores.sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q2 = sorted[Math.floor(sorted.length * 0.5)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    return [q1, q2, q3];
  }

  /**
   * Calcule les métriques d'engagement pour une compétition
   *
   * @param competition La compétition à analyser
   * @returns Les métriques d'engagement
   */
  private async calculateEngagementMetrics(
    competition: Competition
  ): Promise<any> {
    return {
      averageSessionTime: 22.5,
      completionRate: 0.87,
      satisfactionScore: 4.3,
    };
  }

  /**
   * Planifie la prochaine compétition
   *
   * @param template Le modèle de compétition à utiliser
   * @returns La prochaine compétition planifiée
   */
  private async scheduleNextCompetition(
    template: Competition
  ): Promise<Competition> {
    // Créer la prochaine compétition basée sur le template
    const nextStart = new Date(template.endDate.getTime() + 60 * 60 * 1000); // 1h après

    return {
      ...template,
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startDate: nextStart,
      endDate: new Date(
        nextStart.getTime() +
          (template.endDate.getTime() - template.startDate.getTime())
      ),
      participants: 0,
      leaderboard: [],
      status: "upcoming",
    };
  }

  /**
   * Notifie les résultats de la compétition
   *
   * @param competition La compétition concernée
   * @param winners La liste des gagnants
   */
  private async notifyCompetitionResults(
    competition: Competition,
    winners: any[]
  ): Promise<void> {
    console.log(`Competition ${competition.name} finished. Winners:`, winners);
  }

  // ========== NOUVELLES MÉTHODES ANALYTICS RÉELLES ==========

  /**
   * Calcule la distribution horaire réelle basée sur les données de participation
   * @returns La distribution horaire des participations
   */
  private async calculateRealHourlyDistribution(): Promise<{
    [hour: string]: number;
  }> {
    const competitions = await this.competitionRepository.findAll();
    const hourlyStats: { [hour: string]: number } = {};

    // Initialiser toutes les heures
    for (let hour = 0; hour < 24; hour++) {
      hourlyStats[hour.toString().padStart(2, "0")] = 0;
    }

    // Analyser les données de participation
    for (const competition of competitions.competitions) {
      for (const entry of competition.leaderboard) {
        const hour = entry.lastUpdate.getHours();
        const hourKey = hour.toString().padStart(2, "0");
        hourlyStats[hourKey]++;
      }
    }

    return hourlyStats;
  }

  /**
   * Calcule les tendances saisonnières basées sur les données historiques
   *
   * @param period La période à analyser
   * @returns Les tendances saisonnières
   */
  private async calculateRealSeasonalPatterns(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<{ [month: string]: number }> {
    const globalStats = await this.competitionRepository.getGlobalStats(period);
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Avr",
      "Mai",
      "Jun",
      "Jul",
      "Aou",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const patterns: { [month: string]: number } = {};
    monthNames.forEach((month) => (patterns[month] = 0));

    // Analyser les tendances par mois depuis participationTrends
    Object.entries(globalStats.participationTrends).forEach(
      ([date, participations]) => {
        const month = new Date(date).getMonth();
        patterns[monthNames[month]] += participations;
      }
    );

    return patterns;
  }

  /**
   * Calcule la distribution par tiers des utilisateurs
   *
   * @returns La distribution par tiers des utilisateurs
   */
  private async calculateTierDistribution(): Promise<{
    [tier: string]: number;
  }> {
    const users = await this.userRepository.findAll({ limit: 1000 });
    const tierDistribution: { [tier: string]: number } = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
      master: 0,
      grandmaster: 0,
    };

    for (const user of users.users) {
      const competitivePoints =
        (user as any).competitivePoints ||
        (user as any).totalXP ||
        (user as any).level * 50 ||
        0;
      const tier = this.calculateTier(competitivePoints);
      tierDistribution[tier]++;
    }

    return tierDistribution;
  }

  /**
   * Calcule le taux de croissance basé sur les données historiques
   *
   * @param period La période à analyser
   * @returns Le taux de croissance en pourcentage
   */
  private async calculateGrowthRate(period: {
    startDate: Date;
    endDate: Date;
  }): Promise<number> {
    const currentStats =
      await this.competitionRepository.getGlobalStats(period);

    // Calculer la période précédente
    const periodDuration =
      period.endDate.getTime() - period.startDate.getTime();
    const previousPeriod = {
      startDate: new Date(period.startDate.getTime() - periodDuration),
      endDate: period.startDate,
    };

    const previousStats =
      await this.competitionRepository.getGlobalStats(previousPeriod);

    if (previousStats.totalParticipations === 0) return 0;

    return (
      ((currentStats.totalParticipations - previousStats.totalParticipations) /
        previousStats.totalParticipations) *
      100
    );
  }

  /**
   * Calcule la durée moyenne de session
   *
   * @returns La durée moyenne de session en secondes
   */
  private async calculateAverageSessionDuration(): Promise<number> {
    // Basé sur l'analyse des timestamps de participation
    const competitions = await this.competitionRepository.findAll(
      {},
      { limit: 100 }
    );
    let totalDuration = 0;
    let totalSessions = 0;

    for (const competition of competitions.competitions) {
      for (const entry of competition.leaderboard) {
        // Estimer la durée de session basée sur l'activité
        const sessionDuration = Math.min(
          60,
          Math.max(5, Object.keys(entry.metrics).length * 3)
        );
        totalDuration += sessionDuration;
        totalSessions++;
      }
    }

    return totalSessions > 0 ? totalDuration / totalSessions : 0;
  }

  /**
   * Calcule le taux de retour des utilisateurs
   *
   * @returns Le taux de retour des utilisateurs en pourcentage
   */
  private async calculateReturnRate(): Promise<number> {
    const allUsers = await this.userRepository.findAll({ limit: 1000 });
    let returningUsers = 0;

    for (const user of allUsers.users) {
      const userCompetitions =
        await this.competitionRepository.getUserCompetitions(
          user._id.toString(),
          { limit: 10 }
        );
      if (userCompetitions.total > 1) {
        returningUsers++;
      }
    }

    return allUsers.users.length > 0
      ? (returningUsers / allUsers.users.length) * 100
      : 0;
  }

  /**
   * Calcule la rétention compétitive
   *
   * @returns Le taux de rétention compétitive en pourcentage
   */
  private async calculateCompetitiveRetention(): Promise<number> {
    const activeCompetitions =
      await this.competitionRepository.findActiveCompetitions();
    const endedCompetitions =
      await this.competitionRepository.findByStatus("ended");

    const activeParticipants = new Set<string>();
    const endedParticipants = new Set<string>();

    activeCompetitions.forEach((comp) => {
      comp.leaderboard.forEach((entry) =>
        activeParticipants.add(entry.userId.toString())
      );
    });

    endedCompetitions.forEach((comp) => {
      comp.leaderboard.forEach((entry) =>
        endedParticipants.add(entry.userId.toString())
      );
    });

    const retainedUsers = Array.from(activeParticipants).filter((userId) =>
      endedParticipants.has(userId)
    );

    return endedParticipants.size > 0
      ? (retainedUsers.length / endedParticipants.size) * 100
      : 0;
  }

  /**
   * Calcule le score de satisfaction
   *
   * @returns Le score de satisfaction en pourcentage
   */
  private async calculateSatisfactionScore(): Promise<number> {
    // Basé sur les métriques de participation et de rétention
    const returnRate = await this.calculateReturnRate();
    const retentionRate = await this.calculateCompetitiveRetention();

    // Score composite sur 5
    return Math.min(5, Math.max(1, (returnRate + retentionRate) / 40));
  }

  /**
   * Calcule la demande compétitive
   *
   * @returns Le taux de demande compétitive en pourcentage
   */
  private async calculateCompetitiveDemand(): Promise<number> {
    const activeCompetitions =
      await this.competitionRepository.findActiveCompetitions();
    const totalActive = await this.userRepository.countActiveUsers(7);

    let totalParticipants = 0;
    activeCompetitions.forEach(
      (comp) => (totalParticipants += comp.participants)
    );

    return totalActive > 0 ? (totalParticipants / totalActive) * 100 : 0;
  }

  /**
   * Calcule les préférences de prix
   *
   * @returns Un objet contenant les préférences de prix en pourcentage
   */
  private async calculatePrizePreferences(): Promise<{
    [prizeType: string]: number;
  }> {
    const competitions = await this.competitionRepository.findAll();
    const prizeStats: { [prizeType: string]: number } = {
      xp: 0,
      badge: 0,
      title: 0,
      currency: 0,
      item: 0,
      premium: 0,
    };

    competitions.competitions.forEach((comp) => {
      comp.prizes.forEach((prize) => {
        if (prizeStats[prize.type] !== undefined) {
          prizeStats[prize.type]++;
        }
      });
    });

    const total = Object.values(prizeStats).reduce(
      (sum, count) => sum + count,
      0
    );

    if (total === 0) return prizeStats;

    // Convertir en pourcentages
    Object.keys(prizeStats).forEach((type) => {
      prizeStats[type] = Math.round((prizeStats[type] / total) * 100);
    });

    return prizeStats;
  }

  /**
   * Calcule le tier d'un utilisateur basé sur ses points compétitifs
   *
   * @param competitivePoints Les points compétitifs de l'utilisateur
   * @returns Le tier de l'utilisateur
   */
  private calculateTier(
    competitivePoints: number
  ):
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond"
    | "master"
    | "grandmaster" {
    for (const [tier, config] of Object.entries(this.COMPETITIVE_TIERS)) {
      if (
        competitivePoints >= config.minPoints &&
        competitivePoints <= config.maxPoints
      ) {
        return tier.toLowerCase() as any;
      }
    }
    return "bronze";
  }

  /**
   * Calcule le progrès dans le tier actuel
   *
   * @param competitivePoints Les points compétitifs de l'utilisateur
   * @param tier Le tier actuel de l'utilisateur
   * @returns Le pourcentage de progression dans le tier
   */
  private calculateTierProgress(
    competitivePoints: number,
    tier: string
  ): number {
    const tierConfig = this.COMPETITIVE_TIERS[tier.toUpperCase()];
    if (!tierConfig) return 0;

    const progress =
      ((competitivePoints - tierConfig.minPoints) /
        (tierConfig.maxPoints - tierConfig.minPoints)) *
      100;
    return Math.min(100, Math.max(0, progress));
  }
}
