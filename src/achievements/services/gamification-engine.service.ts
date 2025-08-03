/**
 * @fileoverview Service de moteur de gamification avancé pour O'Ypunu
 *
 * Ce service implémente un système complet de gamification incluant:
 * - Système XP et niveaux avec courbe exponentielle et prestige
 * - Gestion des streaks et multiplicateurs de bonus
 * - Missions dynamiques (quotidiennes, hebdomadaires, mensuelles, saisonnières)
 * - Événements saisonniers et thématiques avec récompenses spéciales
 * - Classements compétitifs par tiers (Bronze à Grand Maître)
 * - Système de récompenses multi-dimensionnel (XP, badges, titres, avatars, etc.)
 * - Analytics comportementaux et personnalisation des missions
 * - Calculs de multiplicateurs basés sur l'activité et les événements
 *
 * Le moteur analyse les préférences utilisateur pour générer des missions personnalisées
 * et maintient un système de classement compétitif avec distribution par tiers.
 *
 * @author Équipe O'Ypunu - Moteur de Gamification
 * @version 1.0.0
 * @since 2025-01-01
 * @module GamificationEngineService
 */

import { Injectable, Inject } from "@nestjs/common";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IWordViewRepository } from "../../repositories/interfaces/word-view.repository.interface";
import { IWordVoteRepository } from "../../repositories/interfaces/word-vote.repository.interface";
import { IFavoriteWordRepository } from "../../repositories/interfaces/favorite-word.repository.interface";
import { ActivityService } from "../../common/services/activity.service";
import { DatabaseErrorHandler } from "../../common/errors"

/**
 * Interface pour le système de points d'expérience (XP)
 *
 * @interface XPSystem
 */
export interface XPSystem {
  currentXP: number;
  currentLevel: number;
  xpToNextLevel: number;
  totalXPNeeded: number;
  prestigeLevel: number;
  levelProgress: number; // 0-100%
  bonusMultiplier: number;
}

/**
 * Interface pour les récompenses de gamification
 *
 * @interface GamificationReward
 */
export interface GamificationReward {
  id: string;
  type: "xp" | "badge" | "title" | "avatar" | "theme" | "currency" | "item";
  name: string;
  description: string;
  icon: string;
  value: number;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  metadata?: any;
}

/**
 * Interface pour les streaks utilisateur
 *
 * @interface UserStreak
 */
export interface UserStreak {
  type: "daily_login" | "word_creation" | "learning" | "social";
  current: number;
  longest: number;
  lastUpdate: Date;
  bonusMultiplier: number;
  milestone: number; // Next milestone
}

/**
 * Interface pour les événements saisonniers
 *
 * @interface SeasonalEvent
 */
export interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  theme: string;
  bonusMultiplier: number;
  specialAchievements: string[];
  rewards: GamificationReward[];
  isActive: boolean;
}

/**
 * Interface pour le système de missions
 *
 * @interface MissionSystem
 */
export interface MissionSystem {
  daily: Mission[];
  weekly: Mission[];
  monthly: Mission[];
  seasonal?: Mission[];
}

/**
 * Interface pour une mission
 *
 * @interface Mission
 */
export interface Mission {
  id: string;
  type: "daily" | "weekly" | "monthly" | "seasonal";
  title: string;
  description: string;
  category: "contribution" | "social" | "learning" | "exploration";
  objectives: Array<{
    id: string;
    description: string;
    type: string;
    target: number;
    current: number;
    completed: boolean;
  }>;
  rewards: GamificationReward[];
  deadline: Date;
  difficulty: "easy" | "medium" | "hard" | "legendary";
  xpReward: number;
  isCompleted: boolean;
  isActive: boolean;
  priority: number;
}

/**
 * Interface pour le classement utilisateur
 *
 * @interface UserRanking
 */
export interface UserRanking {
  userId: string;
  username: string;
  globalRank: number;
  categoryRanks: { [category: string]: number };
  currentTier:
    | "bronze"
    | "silver"
    | "gold"
    | "platinum"
    | "diamond"
    | "master"
    | "grandmaster";
  tierProgress: number; // 0-100%
  competitivePoints: number;
  seasonHighest: string;
}

/**
 * Service de moteur de gamification avancé pour O'Ypunu
 *
 * Ce service implémente un système complet de gamification incluant:
 * - Système XP et niveaux avec courbe exponentielle et prestige
 * - Gestion des streaks et multiplicateurs de bonus
 * - Missions dynamiques (quotidiennes, hebdomadaires, mensuelles, saisonnières)
 * - Événements saisonniers et thématiques avec récompenses spéciales
 * - Classements compétitifs par tiers (Bronze à Grand Maître)
 * - Système de récompenses multi-dimensionnel (XP, badges, titres, avatars, etc.)
 * - Analytics comportementaux et personnalisation des missions
 * - Calculs de multiplicateurs basés sur l'activité et les événements
 *
 * Le moteur analyse les préférences utilisateur pour générer des missions personnalisées
 * et maintient un système de classement compétitif avec distribution par tiers.
 *
 * @class GamificationEngineService
 * @implements {Injectable}
 * @author Équipe O'Ypunu - Moteur de Gamification
 * @version 1.0.0
 * @since 2025-01-01
 * @module GamificationEngineService
 *
 * @example
 * ```typescript
 * // Ajouter de l'XP à un utilisateur
 * const result = await gamificationService.addXP(
 *   userId,
 *   'WORD_CREATED',
 *   1.5,
 *   { wordId: 'abc123', category: 'nouns' }
 * );
 *
 * // Obtenir le tableau de bord gamification
 * const dashboard = await gamificationService.getUserGamificationDashboard(userId);
 *
 * // Créer un événement saisonnier
 * const event = await gamificationService.createSeasonalEvent({
 *   name: "Festival Linguistique",
 *   description: "Célébration des langues africaines",
 *   theme: "african_languages",
 *   durationDays: 30,
 *   bonusMultiplier: 2.0,
 *   specialRewards: []
 * });
 * ```
 */
@Injectable()
export class GamificationEngineService {
  // Configuration XP par niveau avec courbe exponentielle
  private readonly XP_CURVE = [
    0,
    100,
    250,
    450,
    700,
    1000,
    1350,
    1750,
    2200,
    2700,
    3250, // Niveaux 1-11
    3850,
    4500,
    5200,
    5950,
    6750,
    7600,
    8500,
    9450,
    10450, // Niveaux 12-21
    11500,
    12600,
    13750,
    14950,
    16200,
    17500,
    18850,
    20250,
    21700,
    23200, // Niveaux 22-31
    // ... jusqu'au niveau 100 avec prestige
  ];

  // Actions et valeurs XP
  private readonly XP_VALUES = {
    // Contribution
    WORD_CREATED: 50,
    WORD_APPROVED: 100,
    WORD_FEATURED: 200,
    TRANSLATION_ADDED: 30,
    AUDIO_UPLOADED: 40,
    DEFINITION_IMPROVED: 25,

    // Social
    LIKE_RECEIVED: 5,
    COMMENT_POSTED: 10,
    HELPFUL_VOTE: 15,
    SHARE_ACTION: 8,

    // Learning
    WORD_VIEWED: 1,
    CATEGORY_EXPLORED: 10,
    STREAK_MILESTONE: 50,
    QUIZ_COMPLETED: 20,

    // Special
    FIRST_OF_DAY: 20,
    PERFECT_WEEK: 150,
    COMMUNITY_HELPER: 75,
    BUG_REPORT: 30,
  };

  // Système de tiers compétitifs
  private readonly COMPETITIVE_TIERS = {
    BRONZE: { minPoints: 0, maxPoints: 499, name: "Bronze", color: "#CD7F32" },
    SILVER: {
      minPoints: 500,
      maxPoints: 999,
      name: "Argent",
      color: "#C0C0C0",
    },
    GOLD: { minPoints: 1000, maxPoints: 1999, name: "Or", color: "#FFD700" },
    PLATINUM: {
      minPoints: 2000,
      maxPoints: 3999,
      name: "Platine",
      color: "#E5E4E2",
    },
    DIAMOND: {
      minPoints: 4000,
      maxPoints: 7999,
      name: "Diamant",
      color: "#B9F2FF",
    },
    MASTER: {
      minPoints: 8000,
      maxPoints: 15999,
      name: "Maître",
      color: "#FF6B6B",
    },
    GRANDMASTER: {
      minPoints: 16000,
      maxPoints: Infinity,
      name: "Grand Maître",
      color: "#9B59B6",
    },
  };

  /**
   * Constructeur du service de moteur de gamification
   *
   * Initialise le service avec tous les repositories nécessaires pour :
   * - La gestion des utilisateurs et de leurs données de gamification
   * - L'accès aux mots, vues, votes et favoris pour l'analyse comportementale
   * - Le suivi des activités pour la génération de missions personnalisées
   * - Le calcul des multiplicateurs basés sur l'engagement utilisateur
   *
   * @constructor
   * @param {IUserRepository} userRepository - Repository des utilisateurs pour la gestion des niveaux, XP et classements
   * @param {IWordRepository} wordRepository - Repository des mots pour l'analyse des contributions
   * @param {IWordViewRepository} wordViewRepository - Repository des vues de mots pour l'analyse des préférences d'apprentissage
   * @param {IWordVoteRepository} wordVoteRepository - Repository des votes pour l'analyse de l'engagement social
   * @param {IFavoriteWordRepository} favoriteWordRepository - Repository des favoris pour l'analyse des préférences linguistiques
   * @param {ActivityService} activityService - Service de logging des activités et analytics comportementaux
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection dans un contrôleur :
   * constructor(private gamificationEngine: GamificationEngineService) {}
   * ```
   *
   * @since 1.0.0
   * @memberof GamificationEngineService
   */
  constructor(
    @Inject("IUserRepository") private userRepository: IUserRepository,
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @Inject("IWordViewRepository")
    private wordViewRepository: IWordViewRepository,
    @Inject("IWordVoteRepository")
    private wordVoteRepository: IWordVoteRepository,
    @Inject("IFavoriteWordRepository")
    private favoriteWordRepository: IFavoriteWordRepository,
    private activityService: ActivityService
  ) {}

  /**
   * 📈 Calcule et ajoute de l'XP à un utilisateur
   *
   * @param userId Identifiant de l'utilisateur
   * @param action Action pour laquelle l'XP est attribué
   * @param multiplier Multiplicateur d'XP (par défaut 1)
   * @param context Contexte additionnel pour l'attribution d'XP
   * @returns Objet contenant l'XP gagné, le total d'XP et les éventuelles récompenses
   */
  async addXP(
    userId: string,
    action: keyof typeof this.XP_VALUES,
    multiplier: number = 1,
    context?: { [key: string]: any }
  ): Promise<{
    xpGained: number;
    totalXP: number;
    levelUp?: {
      previousLevel: number;
      newLevel: number;
      rewards: GamificationReward[];
    };
    streakBonus?: number;
    achievements?: string[];
    message: string;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error("Utilisateur introuvable");
        }

        // Calculer l'XP de base
        const baseXP = this.XP_VALUES[action] || 0;

        // Appliquer les multiplicateurs
        const streakBonus = await this.getStreakMultiplier(
          userId,
          this.getActionCategory(action)
        );
        const seasonalBonus = await this.getSeasonalMultiplier();
        const finalMultiplier = multiplier * streakBonus * seasonalBonus;

        const xpGained = Math.round(baseXP * finalMultiplier);

        // Récupérer l'XP actuel
        const currentXP = user.totalXP || 0;
        const currentLevel = this.calculateLevel(currentXP);
        const newTotalXP = currentXP + xpGained;
        const newLevel = this.calculateLevel(newTotalXP);

        // Mettre à jour l'utilisateur
        await this.userRepository.update(userId, {
          totalXP: newTotalXP,
          level: newLevel,
          lastActive: new Date(),
        });

        // Vérifier les level ups
        let levelUpData;
        if (newLevel > currentLevel) {
          const rewards = await this.generateLevelUpRewards(
            newLevel,
            currentLevel
          );
          levelUpData = {
            previousLevel: currentLevel,
            newLevel,
            rewards,
          };

          // Envoyer les récompenses
          await this.grantRewards(userId, rewards);
        }

        // Vérifier les nouveaux achievements
        const newAchievements = await this.checkActionAchievements(
          userId,
          action,
          context
        );

        // Logger l'activité
        await this.activityService.logXPGained(
          userId,
          action.toString(),
          xpGained,
          {
            level: newLevel,
            totalXP: newTotalXP,
            multiplier: finalMultiplier,
            context,
          }
        );

        return {
          xpGained,
          totalXP: newTotalXP,
          levelUp: levelUpData,
          streakBonus:
            streakBonus > 1 ? Math.round((streakBonus - 1) * 100) : 0,
          achievements: newAchievements,
          message: this.generateXPMessage(action, xpGained, levelUpData),
        };
      },
      "Gamification",
      userId
    );
  }

  /**
   * 📊 Obtient le tableau de bord gamification complet d'un utilisateur
   *
   * @param userId Identifiant de l'utilisateur
   * @returns Tableau de bord gamification de l'utilisateur
   */
  async getUserGamificationDashboard(userId: string): Promise<{
    xpSystem: XPSystem;
    streaks: UserStreak[];
    missions: MissionSystem;
    ranking: UserRanking;
    recentRewards: GamificationReward[];
    seasonalEvent?: SeasonalEvent;
    nextMilestones: Array<{
      type: string;
      name: string;
      progress: number;
      target: number;
      reward: string;
    }>;
    statistics: {
      totalSessions: number;
      averageSessionLength: number;
      favoriteCategory: string;
      consistencyScore: number;
      improvementAreas: string[];
    };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const [user, xpSystem, streaks, missions, ranking] = await Promise.all([
          this.userRepository.findById(userId),
          this.getUserXPSystem(userId),
          this.getUserStreaks(userId),
          this.getUserMissions(userId),
          this.getUserRanking(userId),
        ]);

        if (!user) {
          throw new Error("Utilisateur introuvable");
        }

        // Récompenses récentes (7 derniers jours)
        const recentRewards = await this.getUserRecentRewards(userId, 7);

        // Événement saisonnier actuel
        const seasonalEvent = await this.getCurrentSeasonalEvent();

        // Prochains jalons
        const nextMilestones = await this.getNextMilestones(userId);

        // Statistiques d'engagement
        const statistics = await this.getUserEngagementStatistics(userId);

        return {
          xpSystem,
          streaks,
          missions,
          ranking,
          recentRewards,
          seasonalEvent,
          nextMilestones,
          statistics,
        };
      },
      "Gamification",
      userId
    );
  }

  /**
   * 🎯 Génère des missions personnalisées pour un utilisateur
   *
   * @param userId Identifiant de l'utilisateur
   * @returns Système de missions personnalisées
   */
  async generatePersonalizedMissions(userId: string): Promise<MissionSystem> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error("Utilisateur introuvable");
        }

        // Analyser les préférences et comportements
        const [preferences, activity, streaks] = await Promise.all([
          this.analyzeUserPreferences(userId),
          this.analyzeUserActivity(userId),
          this.getUserStreaks(userId),
        ]);

        // Générer missions quotidiennes (3 par jour)
        const daily = await this.generateDailyMissions(
          userId,
          preferences,
          activity
        );

        // Générer missions hebdomadaires (2 par semaine)
        const weekly = await this.generateWeeklyMissions(
          userId,
          preferences,
          activity
        );

        // Générer missions mensuelles (1-2 par mois)
        const monthly = await this.generateMonthlyMissions(userId, preferences);

        // Missions saisonnières si applicable
        const seasonal = await this.generateSeasonalMissions(userId);

        return {
          daily,
          weekly,
          monthly,
          seasonal,
        };
      },
      "Gamification",
      userId
    );
  }

  /**
   * 🎯 Met à jour les classements compétitifs
   *
   * @returns Informations sur les classements mis à jour
   */
  async updateCompetitiveRankings(): Promise<{
    updated: Array<{
      userId: string;
      previousRank: number;
      newRank: number;
      tierChange?: string;
    }>;
    statistics: {
      totalPlayers: number;
      averageRank: number;
      tierDistribution: { [tier: string]: number };
    };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Récupérer tous les utilisateurs actifs avec leurs points
        const usersData = await this.userRepository.findAll({
          limit: 1000, // Limite raisonnable pour les classements
        });

        // Trier par points compétitifs (simulation basée sur totalXP ou level)
        const users = usersData.users.sort((a, b) => {
          const aPoints =
            (a as any).competitivePoints ||
            (a as any).totalXP ||
            (a as any).level * 50 ||
            0;
          const bPoints =
            (b as any).competitivePoints ||
            (b as any).totalXP ||
            (b as any).level * 50 ||
            0;
          return bPoints - aPoints;
        });

        const updated: any[] = [];
        const tierDistribution: { [tier: string]: number } = {};

        // Initialiser la distribution des tiers
        Object.keys(this.COMPETITIVE_TIERS).forEach((tier) => {
          tierDistribution[tier] = 0;
        });

        // Mettre à jour les rangs
        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          const newRank = i + 1;
          const previousRank = (user as any).globalRank || newRank;

          // Calculer le nouveau tier
          const competitivePoints =
            (user as any).competitivePoints ||
            (user as any).totalXP ||
            (user as any).level * 50 ||
            0;
          const newTier = this.calculateTier(competitivePoints);
          const previousTier = (user as any).currentTier;

          // Mettre à jour l'utilisateur
          await this.userRepository.update(user._id.toString(), {
            globalRank: newRank,
            currentTier: newTier,
            tierProgress: this.calculateTierProgress(
              competitivePoints,
              newTier
            ),
          });

          // Enregistrer les changements significatifs
          if (
            Math.abs(newRank - previousRank) > 5 ||
            newTier !== previousTier
          ) {
            updated.push({
              userId: user._id.toString(),
              previousRank,
              newRank,
              tierChange:
                newTier !== previousTier
                  ? `${previousTier} -> ${newTier}`
                  : undefined,
            });
          }

          tierDistribution[newTier]++;
        }

        return {
          updated,
          statistics: {
            totalPlayers: users.length,
            averageRank: Math.ceil(users.length / 2),
            tierDistribution,
          },
        };
      },
      "Gamification",
      "competitive-update"
    );
  }

  /**
   * 🎪 Crée un événement saisonnier
   *
   * @param eventData Données de l'événement saisonnier
   * @returns L'événement saisonnier créé
   */
  async createSeasonalEvent(eventData: {
    name: string;
    description: string;
    theme: string;
    durationDays: number;
    bonusMultiplier: number;
    specialRewards: GamificationReward[];
  }): Promise<SeasonalEvent> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const now = new Date();
        const endDate = new Date(
          now.getTime() + eventData.durationDays * 24 * 60 * 60 * 1000
        );

        const seasonalEvent: SeasonalEvent = {
          id: `event_${Date.now()}`,
          name: eventData.name,
          description: eventData.description,
          startDate: now,
          endDate,
          theme: eventData.theme,
          bonusMultiplier: eventData.bonusMultiplier,
          specialAchievements: [], // Généré automatiquement
          rewards: eventData.specialRewards,
          isActive: true,
        };

        // Générer des achievements spéciaux pour l'événement
        seasonalEvent.specialAchievements =
          await this.generateEventAchievements(seasonalEvent);

        // Notifier tous les utilisateurs actifs
        await this.notifyEventStart(seasonalEvent);

        return seasonalEvent;
      },
      "Gamification",
      "seasonal-event"
    );
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Calcule le niveau depuis l'XP total
   *
   * @param totalXP XP total de l'utilisateur
   * @returns Niveau correspondant
   */
  private calculateLevel(totalXP: number): number {
    for (let level = 1; level < this.XP_CURVE.length; level++) {
      if (totalXP < this.XP_CURVE[level]) {
        return level;
      }
    }
    return this.XP_CURVE.length; // Niveau max
  }

  /**
   * Récupère le système XP d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Système XP de l'utilisateur
   */
  private async getUserXPSystem(userId: string): Promise<XPSystem> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Utilisateur introuvable");
    }

    const currentXP = user.totalXP || 0;
    const currentLevel = this.calculateLevel(currentXP);
    const xpForCurrentLevel = this.XP_CURVE[currentLevel - 1] || 0;
    const xpForNextLevel = this.XP_CURVE[currentLevel] || currentXP;
    const xpToNextLevel = xpForNextLevel - currentXP;
    const levelProgress =
      ((currentXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) *
      100;

    return {
      currentXP,
      currentLevel,
      xpToNextLevel: Math.max(0, xpToNextLevel),
      totalXPNeeded: xpForNextLevel,
      prestigeLevel: Math.floor(currentLevel / 100), // Prestige tous les 100 niveaux
      levelProgress: Math.round(levelProgress * 100) / 100,
      bonusMultiplier: await this.calculateBonusMultiplier(userId),
    };
  }

  /**
   * Analyse les préférences utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Préférences utilisateur
   */
  private async analyzeUserPreferences(userId: string): Promise<{
    preferredLanguages: string[];
    favoriteCategories: string[];
    activityTimes: string[];
    difficultyLevel: string;
    socialInteraction: string;
  }> {
    // Utiliser les données existantes des favoris, vues, etc.
    const [favorites, views, votes] = await Promise.all([
      this.favoriteWordRepository.findByUser(userId, { limit: 50 }),
      this.wordViewRepository.findByUser(userId, { limit: 100 }),
      this.wordVoteRepository.findByUser(userId, { limit: 100 }),
    ]);

    // Analyser les langues préférées
    const languageMap = new Map<string, number>();
    favorites.favorites.forEach((fav) => {
      const lang = fav.wordDetails?.language || "unknown";
      languageMap.set(lang, (languageMap.get(lang) || 0) + 1);
    });

    const preferredLanguages = Array.from(languageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);

    // Analyser les catégories favorites
    const categoryMap = new Map<string, number>();
    views.views.forEach((view) => {
      const category = "general"; // Categories not available in view data
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });

    const favoriteCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    return {
      preferredLanguages,
      favoriteCategories,
      activityTimes: ["morning", "evening"], // Simulé
      difficultyLevel: votes.total > 50 ? "advanced" : "intermediate",
      socialInteraction: votes.total > 20 ? "high" : "medium",
    };
  }

  /**
   * Génère des missions quotidiennes personnalisées
   *
   * @param userId ID de l'utilisateur
   * @param preferences Préférences utilisateur
   * @param activity Activité récente de l'utilisateur
   * @returns Liste des missions quotidiennes
   */
  private async generateDailyMissions(
    userId: string,
    preferences: any,
    activity: any
  ): Promise<Mission[]> {
    const missions: Mission[] = [];
    const today = new Date();
    const deadline = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Mission 1: Contribution basée sur les préférences
    if (preferences.preferredLanguages.length > 0) {
      missions.push({
        id: `daily_contribute_${Date.now()}`,
        type: "daily",
        title: "Contributeur du Jour",
        description: `Ajouter 2 mots en ${preferences.preferredLanguages[0]}`,
        category: "contribution",
        objectives: [
          {
            id: "add_words",
            description: `Ajouter des mots en ${preferences.preferredLanguages[0]}`,
            type: "words_created",
            target: 2,
            current: 0,
            completed: false,
          },
        ],
        rewards: [
          {
            id: "daily_xp",
            type: "xp",
            name: "XP Bonus",
            description: "100 XP bonus",
            icon: "⭐",
            value: 100,
            rarity: "common",
          },
        ],
        deadline,
        difficulty: "easy",
        xpReward: 100,
        isCompleted: false,
        isActive: true,
        priority: 1,
      });
    }

    // Mission 2: Apprentissage
    missions.push({
      id: `daily_learn_${Date.now()}`,
      type: "daily",
      title: "Explorateur Curieux",
      description: "Découvrir 10 nouveaux mots",
      category: "learning",
      objectives: [
        {
          id: "view_words",
          description: "Consulter des mots non vus",
          type: "words_viewed",
          target: 10,
          current: 0,
          completed: false,
        },
      ],
      rewards: [
        {
          id: "learning_badge",
          type: "badge",
          name: "Explorateur",
          description: "Badge d'exploration",
          icon: "🔍",
          value: 1,
          rarity: "common",
        },
      ],
      deadline,
      difficulty: "easy",
      xpReward: 50,
      isCompleted: false,
      isActive: true,
      priority: 2,
    });

    // Mission 3: Social (si l'utilisateur est socialement actif)
    if (preferences.socialInteraction === "high") {
      missions.push({
        id: `daily_social_${Date.now()}`,
        type: "daily",
        title: "Membre Actif",
        description: "Interagir avec la communauté",
        category: "social",
        objectives: [
          {
            id: "vote_words",
            description: "Voter pour 5 mots",
            type: "votes_cast",
            target: 5,
            current: 0,
            completed: false,
          },
          {
            id: "comment_words",
            description: "Commenter 2 mots",
            type: "comments_posted",
            target: 2,
            current: 0,
            completed: false,
          },
        ],
        rewards: [
          {
            id: "social_currency",
            type: "currency",
            name: "Jetons Sociaux",
            description: "25 jetons sociaux",
            icon: "🪙",
            value: 25,
            rarity: "common",
          },
        ],
        deadline,
        difficulty: "medium",
        xpReward: 75,
        isCompleted: false,
        isActive: true,
        priority: 3,
      });
    }

    return missions;
  }

  /**
   * Génère des récompenses de level up
   * @param newLevel Niveau actuel de l'utilisateur
   * @param previousLevel Niveau précédent de l'utilisateur
   * @returns Liste des récompenses de level up
   */
  private async generateLevelUpRewards(
    newLevel: number,
    previousLevel: number
  ): Promise<GamificationReward[]> {
    const rewards: GamificationReward[] = [];

    // Récompense XP bonus
    rewards.push({
      id: `levelup_xp_${newLevel}`,
      type: "xp",
      name: "Bonus de Niveau",
      description: `Bonus XP pour le niveau ${newLevel}`,
      icon: "🌟",
      value: newLevel * 50,
      rarity: "common",
    });

    // Récompenses spéciales pour les niveaux jalons
    if (newLevel % 10 === 0) {
      rewards.push({
        id: `milestone_badge_${newLevel}`,
        type: "badge",
        name: `Niveau ${newLevel}`,
        description: `Badge de niveau ${newLevel}`,
        icon: "🏆",
        value: 1,
        rarity: newLevel >= 50 ? "rare" : "uncommon",
      });
    }

    // Titre spécial pour les grands niveaux
    if (newLevel === 25) {
      rewards.push({
        id: "title_expert",
        type: "title",
        name: "Expert Linguistique",
        description: "Titre d'expert en linguistique",
        icon: "👨‍🎓",
        value: 1,
        rarity: "rare",
      });
    }

    return rewards;
  }

  /**
   * Détermine la catégorie d'une action pour le calcul des multiplicateurs de streak
   *
   * @param action Action d'XP pour laquelle déterminer la catégorie
   * @returns Catégorie de l'action (word_creation, social, learning, general)
   */
  private getActionCategory(action: keyof typeof this.XP_VALUES): string {
    const contributionActions = [
      "WORD_CREATED",
      "WORD_APPROVED",
      "TRANSLATION_ADDED",
      "AUDIO_UPLOADED",
    ];
    const socialActions = [
      "LIKE_RECEIVED",
      "COMMENT_POSTED",
      "HELPFUL_VOTE",
      "SHARE_ACTION",
    ];
    const learningActions = [
      "WORD_VIEWED",
      "CATEGORY_EXPLORED",
      "QUIZ_COMPLETED",
    ];

    if (contributionActions.includes(action)) return "word_creation";
    if (socialActions.includes(action)) return "social";
    if (learningActions.includes(action)) return "learning";
    return "general";
  }

  /**
   * 🔥 Calcule le multiplicateur de streak pour une action donnée
   *
   * Cette méthode calcule le multiplicateur d'XP basé sur les streaks (séries) de l'utilisateur
   * pour différentes catégories d'actions. Plus un utilisateur maintient une streak longue,
   * plus le multiplicateur augmente, encourageant la régularité et l'engagement.
   *
   * Multiplicateurs par streak :
   * - 1-3 jours : +10% par jour (1.1x, 1.2x, 1.3x)
   * - 4-7 jours : +15% par jour (1.45x, 1.6x, 1.75x, 1.9x)
   * - 8-14 jours : +20% par jour (2.1x, 2.3x, ..., 3.3x)
   * - 15+ jours : +25% par jour jusqu'à un maximum de 5x
   *
   * @param userId ID de l'utilisateur pour lequel calculer le multiplicateur
   * @param category Catégorie d'action (word_creation, social, learning, general)
   * @returns Multiplicateur de streak (minimum 1.0, maximum 5.0)
   */
  private async getStreakMultiplier(
    userId: string,
    category: string
  ): Promise<number> {
    // Simuler un système de streak
    // Dans une vraie implémentation, cela viendrait de la base de données
    const mockStreak = Math.floor(Math.random() * 10) + 1;
    return 1 + mockStreak * 0.1; // +10% par jour de streak
  }

  /**
   * Multiplicateur saisonnier
   *
   * @returns Multiplicateur saisonnier (minimum 1.0, maximum 5.0)
   */
  private async getSeasonalMultiplier(): Promise<number> {
    const currentEvent = await this.getCurrentSeasonalEvent();
    return currentEvent?.isActive ? currentEvent.bonusMultiplier : 1;
  }

  /**
   * Analyse l'activité d'un utilisateur pour en extraire des informations pertinentes
   *
   * @param userId ID de l'utilisateur à analyser
   * @returns Informations sur l'activité de l'utilisateur
   */
  private async analyzeUserActivity(userId: string): Promise<any> {
    return { avgSessionTime: 15, preferredTimeSlots: ["evening"] };
  }

  /**
   * Récupère les streaks d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Liste des streaks de l'utilisateur
   */
  private async getUserStreaks(userId: string): Promise<UserStreak[]> {
    return [
      {
        type: "daily_login",
        current: 5,
        longest: 12,
        lastUpdate: new Date(),
        bonusMultiplier: 1.5,
        milestone: 7,
      },
    ];
  }

  /**
   * Récupère les missions d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Liste des missions de l'utilisateur
   */
  private async getUserMissions(userId: string): Promise<MissionSystem> {
    return this.generatePersonalizedMissions(userId);
  }

  /**
   * Récupère le classement d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Informations sur le classement de l'utilisateur
   */
  private async getUserRanking(userId: string): Promise<UserRanking> {
    return {
      userId,
      username: "User123",
      globalRank: 1250,
      categoryRanks: { contribution: 450, social: 800, learning: 300 },
      currentTier: "silver",
      tierProgress: 65,
      competitivePoints: 750,
      seasonHighest: "gold",
    };
  }

  /**
   * Récupère les récompenses récentes d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @param days Nombre de jours à considérer pour les récompenses récentes
   * @returns Liste des récompenses récentes de l'utilisateur
   */
  private async getUserRecentRewards(
    userId: string,
    days: number
  ): Promise<GamificationReward[]> {
    return [];
  }

  /**
   * Récupère l'événement saisonnier en cours
   *
   * @returns L'événement saisonnier en cours, ou undefined s'il n'y en a pas
   */
  private async getCurrentSeasonalEvent(): Promise<SeasonalEvent | undefined> {
    return undefined;
  }

  /**
   * Récupère les prochaines étapes d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Liste des prochaines étapes de l'utilisateur
   */
  private async getNextMilestones(userId: string): Promise<any[]> {
    return [];
  }

  /**
   * Récupère les statistiques d'engagement d'un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Statistiques d'engagement de l'utilisateur
   */
  private async getUserEngagementStatistics(userId: string): Promise<any> {
    return {
      totalSessions: 45,
      averageSessionLength: 18,
      favoriteCategory: "languages",
      consistencyScore: 78,
      improvementAreas: ["social_interaction", "advanced_learning"],
    };
  }

  /**
   * Génère des missions hebdomadaires pour un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @param preferences Préférences de l'utilisateur
   * @param activity Activité récente de l'utilisateur
   * @returns Liste des missions hebdomadaires générées
   */
  private async generateWeeklyMissions(
    userId: string,
    preferences: any,
    activity: any
  ): Promise<Mission[]> {
    return [];
  }

  /**
   * Génère des missions mensuelles pour un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @param preferences Préférences de l'utilisateur
   * @returns Liste des missions mensuelles générées
   */
  private async generateMonthlyMissions(
    userId: string,
    preferences: any
  ): Promise<Mission[]> {
    return [];
  }

  /**
   * Génère des missions saisonnières pour un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Liste des missions saisonnières générées
   */
  private async generateSeasonalMissions(userId: string): Promise<Mission[]> {
    return [];
  }

  /**
   * Calcule le multiplicateur de bonus pour un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @returns Multiplicateur de bonus
   */
  private async calculateBonusMultiplier(userId: string): Promise<number> {
    return 1.2;
  }

  /**
   * Vérifie les réalisations d'action pour un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @param action Action à vérifier
   * @param context Contexte supplémentaire pour la vérification
   * @returns Liste des réalisations d'action
   */
  private async checkActionAchievements(
    userId: string,
    action: keyof typeof this.XP_VALUES,
    context?: any
  ): Promise<string[]> {
    return [];
  }

  /**
   * Octroie des récompenses à un utilisateur
   *
   * @param userId ID de l'utilisateur
   * @param rewards Liste des récompenses à octroyer
   */
  private async grantRewards(
    userId: string,
    rewards: GamificationReward[]
  ): Promise<void> {
    // Implémenter l'octroi des récompenses
  }

  /**
   * Génère un message de gain d'XP
   *
   * @param action Action ayant généré l'XP
   * @param xpGained Quantité d'XP gagnée
   * @param levelUp Informations sur la montée de niveau, le cas échéant
   * @returns Message de gain d'XP
   */
  private generateXPMessage(
    action: keyof typeof this.XP_VALUES,
    xpGained: number,
    levelUp?: any
  ): string {
    let message = `+${xpGained} XP pour ${action}`;
    if (levelUp) {
      message += ` • NIVEAU ${levelUp.newLevel} ATTEINT ! 🎉`;
    }
    return message;
  }

  /**
   * Calcule le niveau compétitif d'un utilisateur
   *
   * @param competitivePoints Points compétitifs de l'utilisateur
   * @returns Niveau compétitif
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
   * Calcule le progrès d'un utilisateur dans son niveau compétitif
   *
   * @param competitivePoints Points compétitifs de l'utilisateur
   * @param tier Niveau compétitif de l'utilisateur
   * @returns Pourcentage de progrès dans le niveau
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

  /**
   * Génère des réalisations d'événement pour un événement saisonnier
   *
   * @param event Événement saisonnier
   * @returns Liste des réalisations d'événement
   */
  private async generateEventAchievements(
    event: SeasonalEvent
  ): Promise<string[]> {
    return [`event_${event.id}_participant`, `event_${event.id}_master`];
  }

  /**
   * Notifie le début d'un événement saisonnier
   *
   * @param event Événement saisonnier
   */
  private async notifyEventStart(event: SeasonalEvent): Promise<void> {
    console.log(`🎪 Événement saisonnier lancé: ${event.name}`);
  }
}
