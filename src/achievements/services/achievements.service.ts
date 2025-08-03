/**
 * @fileoverview Service principal pour le système d'achievements et gamification
 *
 * Ce service gère l'ensemble du système d'achievements de O'Ypunu, incluant:
 * - Définition et gestion des achievements par catégorie et difficulté
 * - Calcul automatique des progrès basé sur l'activité utilisateur
 * - Déblocage automatique et notifications des achievements
 * - Système de classements et leaderboards communautaires
 * - Statistiques globales et analyse des tendances
 * - Gestion des achievements rares et exclusifs
 *
 * Le système utilise une approche hybride avec stockage en mémoire pour les performances
 * et persistance en base de données pour la fiabilité.
 *
 * @author Équipe O'Ypunu - Système d'Achievements
 * @version 1.0.0
 * @since 2025-01-01
 * @module AchievementsService
 */

import { Injectable, Inject } from "@nestjs/common";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IWordViewRepository } from "../../repositories/interfaces/word-view.repository.interface";
import { DatabaseErrorHandler } from "../../common/errors"

/**
 * Interface définissant la structure d'un achievement
 *
 * @interface Achievement
 */
export interface Achievement {
  /** Identifiant unique de l'achievement */
  id: string;
  /** Nom affiché de l'achievement */
  name: string;
  /** Description détaillée des conditions */
  description: string;
  /** Catégorie thématique de l'achievement */
  category: "contribution" | "social" | "learning" | "milestone" | "special";
  /** Niveau de difficulté et rareté */
  difficulty: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  /** Icône ou emoji représentatif */
  icon: string;
  /** Points accordés lors du déblocage */
  points: number;
  /** Critères de déblocage */
  requirements: {
    /** Type de métrique à mesurer */
    type: string;
    /** Valeur cible à atteindre */
    target: number;
    /** Conditions additionnelles optionnelles */
    conditions?: string[];
  };
  /** Pourcentage d'utilisateurs qui possèdent cet achievement (0-100) */
  rarity: number;
}

/**
 * Interface pour un achievement avec état utilisateur
 *
 * @interface UserAchievement
 * @extends Achievement
 */
export interface UserAchievement extends Achievement {
  /** Indique si l'utilisateur a débloqué cet achievement */
  isUnlocked: boolean;
  /** Progression actuelle vers le déblocage */
  progress?: {
    /** Valeur actuelle de la métrique */
    current: number;
    /** Valeur cible à atteindre */
    target: number;
    /** Pourcentage de progression (0-100) */
    percentage: number;
  };
  /** Date de déblocage si applicable */
  unlockedAt?: Date;
}

/**
 * Service principal pour le système d'achievements et gamification
 *
 * Ce service gère l'ensemble du système d'achievements de O'Ypunu, incluant:
 * - Définition et gestion des achievements par catégorie et difficulté
 * - Calcul automatique des progrès basé sur l'activité utilisateur
 * - Déblocage automatique et notifications des achievements
 * - Système de classements et leaderboards communautaires
 * - Statistiques globales et analyse des tendances
 * - Gestion des achievements rares et exclusifs
 *
 * Le système utilise une approche hybride avec stockage en mémoire pour les performances
 * et persistance en base de données pour la fiabilité.
 *
 * @class AchievementsService
 * @implements {Injectable}
 * @author Équipe O'Ypunu - Système d'Achievements
 * @version 1.0.0
 * @since 2025-01-01
 * @module AchievementsService
 *
 * @example
 * ```typescript
 * // Créer un nouvel achievement
 * const achievement = await achievementsService.createAchievement({
 *   name: "Nouveau Mot",
 *   description: "Ajouter un nouveau mot au dictionnaire",
 *   category: "contribution",
 *   difficulty: "bronze",
 *   icon: "🆕",
 *   points: 10,
 *   requirements: { type: "words_created", target: 1 },
 *   rarity: 85.2,
 * });
 * ```
 */
@Injectable()
export class AchievementsService {
  /**
   * Cache en mémoire des définitions d'achievements
   * Optimise les performances pour les consultations fréquentes
   *
   * @private
   * @readonly
   * @type {Map<string, Achievement>}
   */
  private readonly achievements: Map<string, Achievement> = new Map();

  /**
   * Cache des achievements utilisateur par ID utilisateur
   * Structure: userId -> achievementId -> { unlockedAt, progress }
   *
   * @private
   * @readonly
   * @type {Map<string, Map<string, { unlockedAt: Date; progress: number }>>}
   */
  private readonly userAchievements: Map<
    string,
    Map<string, { unlockedAt: Date; progress: number }>
  > = new Map();

  /**
   * Constructeur du service achievements
   *
   * @constructor
   * @param {IUserRepository} userRepository - Repository des utilisateurs
   * @param {IWordRepository} wordRepository - Repository des mots
   * @param {IWordViewRepository} wordViewRepository - Repository des vues de mots
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection dans un contrôleur :
   * constructor(private achievementsService: AchievementsService) {}
   * ```
   *
   * @since 1.0.0
   * @memberof AchievementsService
   */
  constructor(
    @Inject("IUserRepository") private readonly userRepository: IUserRepository,
    @Inject("IWordRepository") private readonly wordRepository: IWordRepository,
    @Inject("IWordViewRepository")
    private readonly wordViewRepository: IWordViewRepository
  ) {
    this.initializeAchievements();
  }

  /**
   * Initialise la base de données des achievements en mémoire
   *
   * Cette méthode configure tous les achievements disponibles avec leurs critères,
   * points, difficultés et statistiques de rareté. Elle est appelée au démarrage
   * du service pour optimiser les performances d'accès.
   *
   * @private
   * @method initializeAchievements
   * @returns {void}
   */
  private initializeAchievements(): void {
    // Achievements de contribution
    this.achievements.set("first-word", {
      id: "first-word",
      name: "Premier Pas",
      description: "Ajouter votre premier mot au dictionnaire",
      category: "contribution",
      difficulty: "bronze",
      icon: "🎯",
      points: 10,
      requirements: { type: "words_created", target: 1 },
      rarity: 85.2,
    });

    // Achievements de contribution
    this.achievements.set("word-master", {
      id: "word-master",
      name: "Maître des Mots",
      description: "Créer 100 mots approuvés",
      category: "contribution",
      difficulty: "gold",
      icon: "👑",
      points: 500,
      requirements: { type: "approved_words", target: 100 },
      rarity: 2.1,
    });

    // Achievements d'entraide
    this.achievements.set("linguist", {
      id: "linguist",
      name: "Polyglotte",
      description: "Contribuer dans 5 langues différentes",
      category: "contribution",
      difficulty: "platinum",
      icon: "🌍",
      points: 750,
      requirements: { type: "languages_contributed", target: 5 },
      rarity: 0.8,
    });

    // Achievements sociaux
    this.achievements.set("social-butterfly", {
      id: "social-butterfly",
      name: "Papillon Social",
      description: "Recevoir 50 likes sur vos mots",
      category: "social",
      difficulty: "silver",
      icon: "🦋",
      points: 100,
      requirements: { type: "likes_received", target: 50 },
      rarity: 15.7,
    });

    // Achievements d'entraide
    this.achievements.set("helpful", {
      id: "helpful",
      name: "Aide Précieuse",
      description: "Écrire 25 commentaires utiles",
      category: "social",
      difficulty: "silver",
      icon: "🤝",
      points: 75,
      requirements: { type: "helpful_comments", target: 25 },
      rarity: 12.3,
    });

    // Achievements d'apprentissage
    this.achievements.set("curious", {
      id: "curious",
      name: "Curieux",
      description: "Consulter 500 mots différents",
      category: "learning",
      difficulty: "bronze",
      icon: "🔍",
      points: 50,
      requirements: { type: "words_viewed", target: 500 },
      rarity: 35.4,
    });

    // Achievements d'apprentissage
    this.achievements.set("scholar", {
      id: "scholar",
      name: "Érudit",
      description: "Consulter 5000 mots différents",
      category: "learning",
      difficulty: "diamond",
      icon: "📚",
      points: 1000,
      requirements: { type: "words_viewed", target: 5000 },
      rarity: 0.3,
    });

    // Achievements jalons
    this.achievements.set("veteran", {
      id: "veteran",
      name: "Vétéran",
      description: "Membre depuis 1 an",
      category: "milestone",
      difficulty: "gold",
      icon: "🏆",
      points: 200,
      requirements: { type: "days_active", target: 365 },
      rarity: 8.9,
    });

    // Achievements spéciaux
    this.achievements.set("early-bird", {
      id: "early-bird",
      name: "Lève-tôt",
      description: "Parmi les 100 premiers utilisateurs",
      category: "special",
      difficulty: "diamond",
      icon: "🌅",
      points: 1500,
      requirements: { type: "early_adopter", target: 100 },
      rarity: 0.1,
    });
  }

  /**
   * Récupère tous les achievements avec filtres et progression utilisateur
   *
   * Cette méthode centrale retourne la liste complète des achievements disponibles,
   * enrichie avec la progression de l'utilisateur si connecté. Elle supporte
   * le filtrage par catégorie et difficulté, et calcule les statistiques globales.
   *
   * @async
   * @method getAllAchievements
   * @param {string} [userId] - ID de l'utilisateur pour calculer la progression
   * @param {Object} [filters] - Filtres optionnels
   * @param {'contribution' | 'social' | 'learning' | 'milestone' | 'special'} [filters.category] - Filtre par catégorie
   * @param {'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'} [filters.difficulty] - Filtre par difficulté
   * @returns {Promise<Object>} Achievements avec progression et statistiques
   * @throws {DatabaseException} En cas d'erreur de base de données
   *
   * @example
   * ```typescript
   * // Récupérer tous les achievements pour un utilisateur
   * const result = await achievementsService.getAllAchievements('user123');
   * console.log(`Achievements débloqués: ${result.userStats.unlockedAchievements}`);
   *
   * // Filtrer par catégorie
   * const contributions = await achievementsService.getAllAchievements('user123', {
   *   category: 'contribution'
   * });
   *
   * // Réponse typique:
   * {
   *   achievements: [
   *     {
   *       id: "first-word",
   *       name: "Premier Pas",
   *       isUnlocked: true,
   *       points: 10,
   *       unlockedAt: "2025-01-01T10:00:00Z"
   *     }
   *   ],
   *   userStats: {
   *     totalAchievements: 15,
   *     unlockedAchievements: 8,
   *     totalPoints: 1250,
   *     level: 2,
   *     nextLevelPoints: 750
   *   },
   *   categories: [
   *     { name: "contribution", total: 5, unlocked: 3, points: 600 }
   *   ]
   * }
   * ```
   */
  async getAllAchievements(
    userId?: string,
    filters?: {
      category?:
        | "contribution"
        | "social"
        | "learning"
        | "milestone"
        | "special";
      difficulty?: "bronze" | "silver" | "gold" | "platinum" | "diamond";
    }
  ): Promise<{
    achievements: UserAchievement[];
    userStats?: {
      totalAchievements: number;
      unlockedAchievements: number;
      totalPoints: number;
      level: number;
      nextLevelPoints: number;
    };
    categories: Array<{
      name: string;
      total: number;
      unlocked: number;
      points: number;
    }>;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let filteredAchievements = Array.from(this.achievements.values());

        // Appliquer les filtres
        if (filters?.category) {
          filteredAchievements = filteredAchievements.filter(
            (a) => a.category === filters.category
          );
        }
        if (filters?.difficulty) {
          filteredAchievements = filteredAchievements.filter(
            (a) => a.difficulty === filters.difficulty
          );
        }

        let userStats;
        const userAchievementData = userId
          ? this.userAchievements.get(userId)
          : null;

        // Enrichir avec les données utilisateur si connecté
        const enrichedAchievements: UserAchievement[] = await Promise.all(
          filteredAchievements.map(async (achievement) => {
            let isUnlocked = false;
            let unlockedAt: Date | undefined;
            let progress:
              | { current: number; target: number; percentage: number }
              | undefined;

            if (userId) {
              const userAchievement = userAchievementData?.get(achievement.id);
              isUnlocked = !!userAchievement;
              unlockedAt = userAchievement?.unlockedAt;

              if (!isUnlocked) {
                // Calculer le progrès actuel
                const current = await this.calculateProgress(
                  userId,
                  achievement
                );
                progress = {
                  current,
                  target: achievement.requirements.target,
                  percentage: Math.min(
                    100,
                    Math.round(
                      (current / achievement.requirements.target) * 100
                    )
                  ),
                };
              }
            }

            return {
              ...achievement,
              isUnlocked,
              unlockedAt,
              progress,
            };
          })
        );

        // Calculer les stats utilisateur
        if (userId) {
          const unlockedCount = enrichedAchievements.filter(
            (a) => a.isUnlocked
          ).length;
          const totalPoints = enrichedAchievements
            .filter((a) => a.isUnlocked)
            .reduce((sum, a) => sum + a.points, 0);

          const level = Math.floor(totalPoints / 1000) + 1;
          const nextLevelPoints = level * 1000 - totalPoints;

          userStats = {
            totalAchievements: filteredAchievements.length,
            unlockedAchievements: unlockedCount,
            totalPoints,
            level,
            nextLevelPoints: nextLevelPoints > 0 ? nextLevelPoints : 0,
          };
        }

        // Calculer les stats par catégorie
        const categories = [
          "contribution",
          "social",
          "learning",
          "milestone",
          "special",
        ].map((cat) => {
          const categoryAchievements = enrichedAchievements.filter(
            (a) => a.category === cat
          );
          const unlocked = categoryAchievements.filter(
            (a) => a.isUnlocked
          ).length;
          const points = categoryAchievements
            .filter((a) => a.isUnlocked)
            .reduce((sum, a) => sum + a.points, 0);

          return {
            name: cat,
            total: categoryAchievements.length,
            unlocked,
            points,
          };
        });

        return {
          achievements: enrichedAchievements,
          userStats,
          categories,
        };
      },
      "Achievements",
      userId || "anonymous"
    );
  }

  /**
   * Récupère les achievements d'un utilisateur spécifique
   *
   * Cette méthode retourne la liste des achievements d'un utilisateur donné,
   * avec la possibilité de filtrer par catégorie et statut de déblocage.
   *
   * @async
   * @method getUserAchievements
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} [options] - Options de filtrage
   * @param {'contribution' | 'social' | 'learning' | 'milestone' | 'special'} [options.category] - Catégorie d'achievements
   * @param {boolean} [options.unlocked] - Filtrer par statut débloqué
   * @returns {Promise<Object>} Achievements de l'utilisateur
   *
   * @example
   * ```typescript
   * // Récupérer les achievements d'un utilisateur
   * const userAchievements = await achievementsService.getUserAchievements('user123');
   * ```
   */
  async getUserAchievements(
    userId: string,
    options?: {
      category?:
        | "contribution"
        | "social"
        | "learning"
        | "milestone"
        | "special";
      unlocked?: boolean;
    }
  ): Promise<{
    user: {
      id: string;
      username: string;
      profilePicture?: string;
      level: number;
      totalPoints: number;
    };
    achievements: UserAchievement[];
    stats: {
      totalAchievements: number;
      unlockedCount: number;
      completionRate: number;
      recentUnlocks: number;
      rareAchievements: number;
    };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error("Utilisateur introuvable");
        }

        const allAchievements = await this.getAllAchievements(userId, {
          category: options?.category,
        });

        let achievements = allAchievements.achievements;
        if (options?.unlocked !== undefined) {
          achievements = achievements.filter(
            (a) => a.isUnlocked === options.unlocked
          );
        }

        // Calculer les stats
        const unlockedCount = allAchievements.achievements.filter(
          (a) => a.isUnlocked
        ).length;
        const totalAchievements = allAchievements.achievements.length;
        const completionRate =
          Math.round((unlockedCount / totalAchievements) * 100 * 100) / 100;

        // Achievements récents (derniers 7 jours)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentUnlocks = achievements.filter(
          (a) => a.isUnlocked && a.unlockedAt && a.unlockedAt >= weekAgo
        ).length;

        // Achievements rares (moins de 5% des utilisateurs)
        const rareAchievements = achievements.filter(
          (a) => a.isUnlocked && a.rarity < 5
        ).length;

        return {
          user: {
            id: userId,
            username: user.username,
            profilePicture: user.profilePicture,
            level: allAchievements.userStats?.level || 1,
            totalPoints: allAchievements.userStats?.totalPoints || 0,
          },
          achievements,
          stats: {
            totalAchievements,
            unlockedCount,
            completionRate,
            recentUnlocks,
            rareAchievements,
          },
        };
      },
      "Achievements",
      userId
    );
  }

  /**
   * Vérifie et met à jour les progrès utilisateur avec déblocage automatique
   *
   * Cette méthode critique effectue une analyse complète de l'activité utilisateur
   * pour détecter les nouveaux achievements éligibles et calculer la progression.
   * Elle déclenche les déblocages automatiques et gère les level-ups.
   *
   * @async
   * @method checkAndUpdateProgress
   * @param {string} userId - ID de l'utilisateur à analyser
   * @returns {Promise<Object>} Résultats des mises à jour et nouveaux déblocages
   * @throws {DatabaseException} En cas d'erreur de calcul ou de persistance
   *
   * @example
   * ```typescript
   * // Vérifier les progrès après une action utilisateur
   * const result = await achievementsService.checkAndUpdateProgress('user123');
   *
   * if (result.newAchievements.length > 0) {
   *   console.log('Nouveaux achievements débloqués:');
   *   result.newAchievements.forEach(achievement => {
   *     console.log(`🏆 ${achievement.name} (+${achievement.points} points)`);
   *   });
   * }
   *
   * if (result.levelUp) {
   *   console.log(`🎉 Level up! Niveau ${result.levelUp.newLevel} atteint!`);
   * }
   *
   * // Réponse typique:
   * {
   *   newAchievements: [
   *     {
   *       id: "word-master",
   *       name: "Maître des Mots",
   *       description: "Créer 100 mots approuvés",
   *       points: 500,
   *       difficulty: "gold",
   *       category: "contribution",
   *       unlockedAt: "2025-01-01T15:30:00Z"
   *     }
   *   ],
   *   updatedProgress: [
   *     {
   *       achievementId: "linguist",
   *       name: "Polyglotte",
   *       previousProgress: 3,
   *       currentProgress: 4,
   *       target: 5,
   *       percentage: 80
   *     }
   *   ],
   *   levelUp: {
   *     previousLevel: 4,
   *     newLevel: 5,
   *     pointsRequired: 5000,
   *     bonusAchievements: ["level_5_milestone"]
   *   }
   * }
   * ```
   */
  async checkAndUpdateProgress(userId: string): Promise<{
    newAchievements: Array<{
      id: string;
      name: string;
      description: string;
      points: number;
      difficulty: string;
      category: string;
      unlockedAt: Date;
    }>;
    updatedProgress: Array<{
      achievementId: string;
      name: string;
      previousProgress: number;
      currentProgress: number;
      target: number;
      percentage: number;
    }>;
    levelUp?: {
      previousLevel: number;
      newLevel: number;
      pointsRequired: number;
      bonusAchievements: string[];
    };
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const newAchievements: any[] = [];
        const updatedProgress: any[] = [];

        const userAchievementData =
          this.userAchievements.get(userId) || new Map();
        const previousLevel = await this.getUserLevel(userId);

        for (const achievement of this.achievements.values()) {
          const isAlreadyUnlocked = userAchievementData.has(achievement.id);

          if (!isAlreadyUnlocked) {
            const previousProgress =
              userAchievementData.get(achievement.id)?.progress || 0;
            const currentProgress = await this.calculateProgress(
              userId,
              achievement
            );

            // Vérifier si l'achievement est maintenant débloqué
            if (currentProgress >= achievement.requirements.target) {
              const unlockedAt = new Date();
              userAchievementData.set(achievement.id, {
                unlockedAt,
                progress: currentProgress,
              });

              newAchievements.push({
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                points: achievement.points,
                difficulty: achievement.difficulty,
                category: achievement.category,
                unlockedAt,
              });
            } else if (currentProgress !== previousProgress) {
              // Progrès mis à jour mais pas encore débloqué
              updatedProgress.push({
                achievementId: achievement.id,
                name: achievement.name,
                previousProgress,
                currentProgress,
                target: achievement.requirements.target,
                percentage: Math.round(
                  (currentProgress / achievement.requirements.target) * 100
                ),
              });
            }
          }
        }

        // Sauvegarder les données utilisateur
        this.userAchievements.set(userId, userAchievementData);

        // Vérifier s'il y a un level up
        const newLevel = await this.getUserLevel(userId);
        let levelUp;
        if (newLevel > previousLevel) {
          levelUp = {
            previousLevel,
            newLevel,
            pointsRequired: newLevel * 1000,
            bonusAchievements: [], // TODO: Achievements bonus pour level up
          };
        }

        return {
          newAchievements,
          updatedProgress,
          levelUp,
        };
      },
      "Achievements",
      userId
    );
  }

  /**
   * Récupère le classement des utilisateurs en fonction de leurs achievements
   *
   * Cette méthode retourne un classement des utilisateurs basé sur leurs points
   * et achievements, avec des options de filtrage par période et catégorie.
   *
   * @async
   * @method getLeaderboard
   * @param {Object} options - Options de classement
   * @param {'week' | 'month' | 'quarter' | 'year' | 'all'} options.period - Période de classement
   * @param {'contribution' | 'social' | 'learning' | 'milestone' | 'special'} [options.category] - Catégorie d'achievements
   * @param {number} options.limit - Limite de résultats
   * @returns {Promise<Object>} Classement des utilisateurs
   *
   * @example
   * ```typescript
   * // Récupérer le classement mensuel
   * const leaderboard = await achievementsService.getLeaderboard({
   *   period: 'month',
   *   limit: 10
   * });
   * ```
   */
  async getLeaderboard(options: {
    period: "week" | "month" | "quarter" | "year" | "all";
    category?: "contribution" | "social" | "learning" | "milestone" | "special";
    limit: number;
  }): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      username: string;
      profilePicture?: string;
      level: number;
      totalPoints: number;
      achievementsCount: number;
      recentActivity: Date;
      badges: Array<{
        id: string;
        name: string;
        icon: string;
        rarity: number;
      }>;
    }>;
    period: string;
    totalUsers: number;
    userRank?: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Simuler un classement basé sur les points
        // Dans une vraie implémentation, cela viendrait de la base de données
        const mockLeaderboard = [
          {
            rank: 1,
            userId: "user1",
            username: "LanguageMaster",
            profilePicture: "/avatars/user1.jpg",
            level: 15,
            totalPoints: 15250,
            achievementsCount: 42,
            recentActivity: new Date(),
            badges: [
              { id: "linguist", name: "Polyglotte", icon: "🌍", rarity: 0.8 },
              {
                id: "word-master",
                name: "Maître des Mots",
                icon: "👑",
                rarity: 2.1,
              },
            ],
          },
          {
            rank: 2,
            userId: "user2",
            username: "DictionaryPro",
            profilePicture: "/avatars/user2.jpg",
            level: 12,
            totalPoints: 12890,
            achievementsCount: 38,
            recentActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
            badges: [
              { id: "scholar", name: "Érudit", icon: "📚", rarity: 0.3 },
              { id: "veteran", name: "Vétéran", icon: "🏆", rarity: 8.9 },
            ],
          },
          // ... plus d'utilisateurs
        ].slice(0, options.limit);

        return {
          leaderboard: mockLeaderboard,
          period: options.period,
          totalUsers: 1250, // Nombre total d'utilisateurs
          userRank: undefined, // TODO: Calculer le rang de l'utilisateur actuel
        };
      },
      "Achievements",
      "leaderboard"
    );
  }

  /**
   * Récupère les achievements récents de la communauté
   *
   * Cette méthode retourne les achievements débloqués récemment par les utilisateurs,
   * avec des options de filtrage par période et catégorie.
   *
   * @async
   * @method getRecentCommunityAchievements
   * @param {Object} options - Options de filtrage
   * @param {number} options.limit - Limite de résultats
   * @param {number} options.hours - Période de filtrage en heures
   * @returns {Promise<Object>} Achievements récents de la communauté
   *
   * @example
   * ```typescript
   * // Récupérer les achievements récents
   * const recentAchievements = await achievementsService.getRecentCommunityAchievements({
   *   limit: 5,
   *   hours: 24
   * });
   * ```
   */
  async getRecentCommunityAchievements(options: {
    limit: number;
    hours: number;
  }): Promise<{
    recentAchievements: Array<{
      userId: string;
      username: string;
      profilePicture?: string;
      achievement: {
        id: string;
        name: string;
        description: string;
        icon: string;
        difficulty: string;
        points: number;
        rarity: number;
      };
      unlockedAt: Date;
      isRare: boolean;
    }>;
    stats: {
      totalUnlocked: number;
      uniqueUsers: number;
      rareUnlocks: number;
    };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Simuler des achievements récents de la communauté
        const mockRecentAchievements = [
          {
            userId: "user3",
            username: "NewLearner",
            profilePicture: "/avatars/user3.jpg",
            achievement: this.achievements.get("first-word")!,
            unlockedAt: new Date(Date.now() - 30 * 60 * 1000),
            isRare: false,
          },
          {
            userId: "user4",
            username: "RareCollector",
            profilePicture: "/avatars/user4.jpg",
            achievement: this.achievements.get("linguist")!,
            unlockedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            isRare: true,
          },
        ].slice(0, options.limit);

        return {
          recentAchievements: mockRecentAchievements,
          stats: {
            totalUnlocked: mockRecentAchievements.length,
            uniqueUsers: new Set(mockRecentAchievements.map((a) => a.userId))
              .size,
            rareUnlocks: mockRecentAchievements.filter((a) => a.isRare).length,
          },
        };
      },
      "Achievements",
      "recent"
    );
  }

  /**
   * Récupère les statistiques globales des achievements
   *
   * Cette méthode retourne des statistiques agrégées sur l'ensemble des achievements,
   * incluant des métriques par catégorie et difficulté.
   *
   * @async
   * @method getGlobalStatistics
   * @returns {Promise<any>} Statistiques globales
   *
   * @example
   * ```typescript
   * // Récupérer les statistiques globales
   * const globalStats = await achievementsService.getGlobalStatistics();
   * ```
   */
  async getGlobalStatistics(): Promise<any> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Simuler des statistiques globales
        return {
          overview: {
            totalAchievements: this.achievements.size,
            totalUnlocks: 15420,
            activeUsers: 850,
            averageCompletionRate: 28.5,
          },
          byCategory: [
            {
              category: "contribution",
              totalAchievements: 8,
              totalUnlocks: 8500,
              completionRate: 45.2,
              popularAchievements: ["first-word", "word-master"],
            },
            // ... autres catégories
          ],
          byDifficulty: [
            {
              difficulty: "bronze",
              totalAchievements: 3,
              totalUnlocks: 12000,
              averageTimeToUnlock: 2.5, // jours
            },
            // ... autres difficultés
          ],
          trends: {
            dailyUnlocks: [120, 135, 98, 142, 156, 189, 201],
            popularCategories: ["contribution", "learning", "social"],
            engagementMetrics: {
              averageAchievementsPerUser: 8.2,
              retentionWithAchievements: 78.5,
            },
          },
        };
      },
      "Achievements",
      "global-stats"
    );
  }

  /**
   * Récupère les achievements rares en fonction d'un seuil de rareté
   *
   * Cette méthode retourne les achievements dont la rareté est inférieure ou égale
   * au seuil spécifié.
   *
   * @async
   * @method getRareAchievements
   * @param {number} threshold - Seuil de rareté
   * @returns {Promise<any>} Achievements rares
   *
   * @example
   * ```typescript
   * // Récupérer les achievements rares avec un seuil de 50
   * const rareAchievements = await achievementsService.getRareAchievements(50);
   * ```
   */
  async getRareAchievements(threshold: number): Promise<any> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const rareAchievements = Array.from(this.achievements.values())
          .filter((a) => a.rarity <= threshold)
          .map((achievement) => ({
            ...achievement,
            unlockCount: Math.floor((achievement.rarity / 100) * 1250), // Simulé
            firstUnlockedBy: "EarlyAdopter",
            firstUnlockedAt: new Date("2024-01-15"),
            holders: [], // TODO: Récupérer les vrais détenteurs
          }));

        return {
          rareAchievements,
          totalUsers: 1250,
          threshold,
        };
      },
      "Achievements",
      "rare"
    );
  }

  /**
   * Récupère les progrès d'un utilisateur pour un achievement spécifique
   *
   * Cette méthode retourne les détails du progrès d'un utilisateur pour un achievement donné,
   * incluant le statut de déblocage et les statistiques de progression.
   *
   * @async
   * @method getAchievementProgress
   * @param {string} achievementId - ID de l'achievement
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<any>} Détails du progrès de l'utilisateur
   *
   * @example
   * ```typescript
   * // Récupérer le progrès de l'utilisateur pour un achievement
   * const progress = await achievementsService.getAchievementProgress('first-word', 'user123');
   * ```
   */
  async getAchievementProgress(
    achievementId: string,
    userId: string
  ): Promise<any> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const achievement = this.achievements.get(achievementId);
        if (!achievement) {
          throw new Error("Achievement introuvable");
        }

        const userAchievementData = this.userAchievements.get(userId);
        const userAchievement = userAchievementData?.get(achievementId);
        const isUnlocked = !!userAchievement;

        let current = 0;
        if (!isUnlocked) {
          current = await this.calculateProgress(userId, achievement);
        }

        return {
          achievement,
          progress: {
            current: isUnlocked ? achievement.requirements.target : current,
            target: achievement.requirements.target,
            percentage: isUnlocked
              ? 100
              : Math.round((current / achievement.requirements.target) * 100),
            isUnlocked,
            unlockedAt: userAchievement?.unlockedAt,
          },
          breakdown: [], // TODO: Détail des critères
          tips: [
            "Continuez à contribuer régulièrement",
            "Explorez différentes langues",
            "Interagissez avec la communauté",
          ],
          similarUsers: [], // TODO: Utilisateurs avec progrès similaire
        };
      },
      "Achievements",
      `achievement-${achievementId}`
    );
  }

  /**
   * Calcule la progression actuelle d'un utilisateur pour un achievement spécifique
   *
   * Cette méthode détermine dynamiquement la valeur actuelle de la métrique
   * requise par l'achievement en interrogeant les repositories appropriés.
   * Elle supporte différents types de métriques de progression.
   *
   * @private
   * @async
   * @method calculateProgress
   * @param {string} userId - ID de l'utilisateur
   * @param {Achievement} achievement - Achievement à évaluer
   * @returns {Promise<number>} Valeur actuelle de la métrique
   *
   * @example
   * ```typescript
   * // Calculer progression du nombre de mots créés
   * const progress = await this.calculateProgress('user123', wordMasterAchievement);
   * console.log(`Progression: ${progress}/${wordMasterAchievement.requirements.target}`);
   * ```
   */
  private async calculateProgress(
    userId: string,
    achievement: Achievement
  ): Promise<number> {
    switch (achievement.requirements.type) {
      case "words_created":
        return this.wordRepository.countByUser(userId);
      case "approved_words":
        return this.wordRepository.countByUserAndStatus(userId, "approved");
      case "words_viewed":
        const stats =
          await this.wordViewRepository.getUserActivityStats(userId);
        return stats.uniqueWords;
      case "languages_contributed":
        const langStats =
          await this.wordRepository.getUserLanguageStats(userId);
        return langStats.length;
      default:
        return 0;
    }
  }

  /**
   * Calcule le niveau actuel d'un utilisateur basé sur ses points d'achievements
   *
   * Le système de niveaux utilise une progression linéaire de 1000 points par niveau.
   * Cette méthode totalise tous les points des achievements débloqués pour
   * déterminer le niveau actuel.
   *
   * @private
   * @async
   * @method getUserLevel
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<number>} Niveau actuel (minimum 1)
   *
   * @example
   * ```typescript
   * // Calculer le niveau d'un utilisateur
   * const level = await this.getUserLevel('user123');
   * console.log(`Niveau utilisateur: ${level}`);
   *
   * // Formule: niveau = floor(points_totaux / 1000) + 1
   * // 0-999 points = niveau 1
   * // 1000-1999 points = niveau 2
   * // etc.
   * ```
   */
  private async getUserLevel(userId: string): Promise<number> {
    const userAchievementData = this.userAchievements.get(userId);
    if (!userAchievementData) return 1;

    let totalPoints = 0;
    for (const [achievementId] of userAchievementData) {
      const achievement = this.achievements.get(achievementId);
      if (achievement) {
        totalPoints += achievement.points;
      }
    }

    return Math.floor(totalPoints / 1000) + 1;
  }
}
