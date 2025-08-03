/**
 * @fileoverview Contrôleur REST pour le système d'achievements et gamification
 *
 * Ce contrôleur expose tous les endpoints nécessaires pour gérer le système de badges,
 * achievements et classements des utilisateurs. Il permet de:
 * - Consulter les achievements disponibles et les progrès
 * - Afficher les classements et leaderboards
 * - Gérer les achievements rares et exclusifs
 * - Fournir des statistiques pour les administrateurs
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AchievementsService } from "../services/achievements.service";

/**
 * Interface pour les requêtes avec utilisateur authentifié
 *
 * @interface RequestWithUser
 */
interface RequestWithUser {
  user?: {
    _id: string;
    username: string;
    role: string;
  };
}

/**
 * Contrôleur REST pour la gestion des achievements et de la gamification
 *
 * Ce contrôleur fournit une API complète pour:
 * - La consultation des achievements et badges disponibles
 * - Le suivi des progrès utilisateur et déblocage automatique
 * - Les classements et leaderboards communautaires
 * - La gestion des achievements rares et exclusifs
 * - Les statistiques globales pour les administrateurs
 *
 * @class AchievementsController
 * @version 1.0.0
 */
@ApiTags("achievements")
@Controller("achievements")
export class AchievementsController {
  /**
   * Constructeur du contrôleur achievements
   *
   * @constructor
   * @param {AchievementsService} achievementsService - Service des achievements
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection automatique :
   * @Controller('achievements')
   * export class AchievementsController {
   *   constructor(private readonly achievementsService: AchievementsService) {}
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AchievementsController
   */
  constructor(private readonly achievementsService: AchievementsService) {}

  /**
   * Récupère tous les achievements disponibles avec filtres optionnels
   *
   * Cette méthode retourne la liste complète des achievements avec leurs détails,
   * incluant le progrès de l'utilisateur connecté s'il y en a un.
   * Supporte le filtrage par catégorie et difficulté pour une navigation optimisée.
   *
   * @async
   * @method getAllAchievements
   * @param {RequestWithUser} [req] - Requête avec utilisateur optionnel
   * @param {'contribution' | 'social' | 'learning' | 'milestone' | 'special'} [category] - Filtre par catégorie
   * @param {'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'} [difficulty] - Filtre par difficulté
   * @returns {Promise<Object>} Liste des achievements avec progrès et statistiques
   *
   * @example
   * ```typescript
   * // Récupérer tous les achievements de contribution
   * GET /achievements?category=contribution
   *
   * // Récupérer seulement les achievements gold
   * GET /achievements?difficulty=gold
   *
   * // Réponse typique:
   * {
   *   achievements: [
   *     {
   *       id: "first_word",
   *       name: "Premier Mot",
   *       description: "Ajouter votre premier mot au dictionnaire",
   *       category: "contribution",
   *       difficulty: "bronze",
   *       points: 10,
   *       isUnlocked: true,
   *       progress: { current: 1, target: 1, percentage: 100 }
   *     }
   *   ],
   *   userStats: {
   *     totalAchievements: 45,
   *     unlockedAchievements: 12,
   *     totalPoints: 450,
   *     level: 3
   *   }
   * }
   * ```
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Récupérer tous les achievements disponibles" })
  @ApiQuery({
    name: "category",
    required: false,
    enum: ["contribution", "social", "learning", "milestone", "special"],
    description: "Filtrer par catégorie",
  })
  @ApiQuery({
    name: "difficulty",
    required: false,
    enum: ["bronze", "silver", "gold", "platinum", "diamond"],
    description: "Filtrer par difficulté",
  })
  @ApiResponse({
    status: 200,
    description: "Liste des achievements récupérée",
    schema: {
      type: "object",
      properties: {
        achievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              category: {
                type: "string",
                enum: [
                  "contribution",
                  "social",
                  "learning",
                  "milestone",
                  "special",
                ],
              },
              difficulty: {
                type: "string",
                enum: ["bronze", "silver", "gold", "platinum", "diamond"],
              },
              icon: { type: "string" },
              points: { type: "number" },
              requirements: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  target: { type: "number" },
                  conditions: { type: "array", items: { type: "string" } },
                },
              },
              isUnlocked: { type: "boolean" },
              progress: {
                type: "object",
                properties: {
                  current: { type: "number" },
                  target: { type: "number" },
                  percentage: { type: "number" },
                },
              },
              unlockedAt: { type: "string", format: "date-time" },
              rarity: { type: "number" },
            },
          },
        },
        userStats: {
          type: "object",
          properties: {
            totalAchievements: { type: "number" },
            unlockedAchievements: { type: "number" },
            totalPoints: { type: "number" },
            level: { type: "number" },
            nextLevelPoints: { type: "number" },
          },
        },
        categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              total: { type: "number" },
              unlocked: { type: "number" },
              points: { type: "number" },
            },
          },
        },
      },
    },
  })
  async getAllAchievements(
    @Request() req?: RequestWithUser,
    @Query("category")
    category?: "contribution" | "social" | "learning" | "milestone" | "special",
    @Query("difficulty")
    difficulty?: "bronze" | "silver" | "gold" | "platinum" | "diamond"
  ) {
    return this.achievementsService.getAllAchievements(req?.user?._id, {
      category,
      difficulty,
    });
  }

  /**
   * Récupérer les achievements d'un utilisateur spécifique
   *
   * Cette méthode permet de récupérer les achievements d'un utilisateur spécifique,
   * avec la possibilité de filtrer par statut débloqué.
   *
   * @param userId ID de l'utilisateur
   * @param unlocked Filtrer par statut débloqué
   * @returns Liste des achievements de l'utilisateur
   *
   * @example
   * ```typescript
   * // Récupérer les achievements de l'utilisateur avec ID "user123"
   * GET /achievements/user/user123
   * Authorization: Bearer <jwt-token>
   *
   * // Récupérer les achievements débloqués de l'utilisateur avec ID "user123"
   * GET /achievements/user/user123?unlocked=true
   * ```
   *
   * // Réponse typique:
   * {
   *   user: {
   *     id: "user123",
   *     username: "mon_pseudo",
   *     level: 8,
   *     totalPoints: 1250,
   *     nextLevelPoints: 1500
   *   },
   *   achievements: [
   *     {
   *       id: "ach1",
   *       name: "Achievement 1",
   *       description: "Description de l'achievement 1",
   *       category: "contribution",
   *       difficulty: "gold",
   *       icon: "icon-url",
   *       points: 100,
   *       unlockedAt: "2023-01-01T00:00:00Z",
   *       rarity: 1
   *     },
   *     // Autres achievements...
   *   ],
   *   stats: {
   *     totalAchievements: 10,
   *     unlockedCount: 8,
   *     completionRate: 80,
   *     recentUnlocks: 2,
   *     rareAchievements: 1
   *   }
   * }
   */
  @Get("user/:userId")
  @ApiOperation({
    summary: "Récupérer les achievements d'un utilisateur spécifique",
  })
  @ApiParam({
    name: "userId",
    description: "ID de l'utilisateur",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiQuery({
    name: "unlocked",
    required: false,
    type: Boolean,
    description: "Filtrer par statut débloqué/non débloqué",
  })
  @ApiResponse({
    status: 200,
    description: "Achievements de l'utilisateur récupérés",
    schema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            profilePicture: { type: "string" },
            level: { type: "number" },
            totalPoints: { type: "number" },
          },
        },
        achievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              category: { type: "string" },
              difficulty: { type: "string" },
              icon: { type: "string" },
              points: { type: "number" },
              unlockedAt: { type: "string", format: "date-time" },
              rarity: { type: "number" },
            },
          },
        },
        stats: {
          type: "object",
          properties: {
            totalAchievements: { type: "number" },
            unlockedCount: { type: "number" },
            completionRate: { type: "number" },
            recentUnlocks: { type: "number" },
            rareAchievements: { type: "number" },
          },
        },
      },
    },
  })
  async getUserAchievements(
    @Param("userId") userId: string,
    @Query("unlocked") unlocked?: boolean
  ) {
    return this.achievementsService.getUserAchievements(userId, { unlocked });
  }

  /**
   * Récupère les achievements de l'utilisateur authentifié avec filtres optionnels
   *
   * Cette méthode permet à l'utilisateur connecté de consulter ses propres achievements,
   * incluant son progrès détaillé, ses achievements débloqués et ceux en cours.
   * Supporte le filtrage par catégorie et statut de déblocage pour une expérience personnalisée.
   *
   * @async
   * @method getMyAchievements
   * @param {RequestWithUser} req - Requête avec utilisateur authentifié
   * @param {'contribution' | 'social' | 'learning' | 'milestone' | 'special'} [category] - Filtre par catégorie
   * @param {boolean} [unlocked] - Filtre par statut débloqué/non débloqué
   * @returns {Promise<Object>} Achievements personnels avec progrès et statistiques
   *
   * @example
   * ```typescript
   * // Récupérer tous mes achievements de contribution
   * GET /achievements/my?category=contribution
   * Authorization: Bearer <jwt-token>
   *
   * // Récupérer seulement mes achievements débloqués
   * GET /achievements/my?unlocked=true
   *
   * // Réponse typique:
   * {
   *   user: {
   *     id: "user123",
   *     username: "mon_pseudo",
   *     level: 8,
   *     totalPoints: 1250,
   *     nextLevelPoints: 1500
   *   },
   *   achievements: [
   *     {
   *       id: "first_word",
   *       name: "Premier Mot",
   *       description: "Ajouter votre premier mot au dictionnaire",
   *       category: "contribution",
   *       difficulty: "bronze",
   *       points: 10,
   *       isUnlocked: true,
   *       unlockedAt: "2024-12-15T10:30:00Z",
   *       progress: { current: 1, target: 1, percentage: 100 }
   *     }
   *   ],
   *   stats: {
   *     totalAchievements: 45,
   *     unlockedCount: 12,
   *     completionRate: 26.7,
   *     recentUnlocks: 3,
   *     favoriteCategory: "contribution"
   *   }
   * }
   * ```
   */
  @Get("my")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Récupérer mes achievements" })
  @ApiQuery({
    name: "category",
    required: false,
    enum: ["contribution", "social", "learning", "milestone", "special"],
    description: "Filtrer par catégorie",
  })
  @ApiQuery({
    name: "unlocked",
    required: false,
    type: Boolean,
    description: "Filtrer par statut débloqué/non débloqué",
  })
  @ApiResponse({
    status: 200,
    description: "Mes achievements récupérés",
  })
  async getMyAchievements(
    @Request() req: RequestWithUser,
    @Query("category")
    category?: "contribution" | "social" | "learning" | "milestone" | "special",
    @Query("unlocked") unlocked?: boolean
  ) {
    return this.achievementsService.getUserAchievements(req.user!._id, {
      category,
      unlocked,
    });
  }

  /**
   * Récupère le classement des utilisateurs par achievements
   *
   * Cette méthode génère un leaderboard basé sur les points d'achievements,
   * avec possibilité de filtrer par période et catégorie.
   * Inclut les badges rares et les statistiques de rang pour chaque utilisateur.
   *
   * @async
   * @method getLeaderboard
   * @param {'week' | 'month' | 'quarter' | 'year' | 'all'} period - Période de calcul du classement
   * @param {'contribution' | 'social' | 'learning' | 'milestone' | 'special'} [category] - Catégorie d'achievements
   * @param {number} limit - Nombre maximum d'utilisateurs à retourner
   * @returns {Promise<Object>} Classement avec rangs et statistiques
   *
   * @example
   * ```typescript
   * // Classement mensuel des contributions
   * GET /achievements/leaderboard?period=month&category=contribution&limit=20
   *
   * // Réponse:
   * {
   *   leaderboard: [
   *     {
   *       rank: 1,
   *       userId: "user123",
   *       username: "contributor_pro",
   *       level: 15,
   *       totalPoints: 2450,
   *       achievementsCount: 28,
   *       badges: [
   *         { id: "diamond_contributor", name: "Contributeur Diamant", rarity: 0.5 }
   *       ]
   *     }
   *   ],
   *   period: "month",
   *   totalUsers: 1247,
   *   userRank: 42
   * }
   * ```
   */
  @Get("leaderboard")
  @ApiOperation({ summary: "Classement des achievements" })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["week", "month", "quarter", "year", "all"],
    description: "Période du classement",
  })
  @ApiQuery({
    name: "category",
    required: false,
    enum: ["contribution", "social", "learning", "milestone", "special"],
    description: "Filtrer par catégorie",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre d'utilisateurs à afficher",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Classement récupéré",
    schema: {
      type: "object",
      properties: {
        leaderboard: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rank: { type: "number" },
              userId: { type: "string" },
              username: { type: "string" },
              profilePicture: { type: "string" },
              level: { type: "number" },
              totalPoints: { type: "number" },
              achievementsCount: { type: "number" },
              recentActivity: { type: "string", format: "date-time" },
              badges: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    icon: { type: "string" },
                    rarity: { type: "number" },
                  },
                },
              },
            },
          },
        },
        period: { type: "string" },
        totalUsers: { type: "number" },
        userRank: { type: "number" },
      },
    },
  })
  async getLeaderboard(
    @Query("period")
    period: "week" | "month" | "quarter" | "year" | "all" = "all",
    @Query("category")
    category?: "contribution" | "social" | "learning" | "milestone" | "special",
    @Query("limit") limit: number = 50
  ) {
    return this.achievementsService.getLeaderboard({
      period,
      category,
      limit: +limit,
    });
  }

  /**
   * Déclenche une vérification manuelle des progrès et déblocage d'achievements
   *
   * Cette méthode force une vérification complète des progrès de l'utilisateur connecté
   * et débloque automatiquement tous les achievements éligibles.
   * Retourne les nouveaux achievements obtenus et les mises à jour de progression.
   *
   * @async
   * @method checkProgress
   * @param {RequestWithUser} req - Requête avec utilisateur authentifié
   * @returns {Promise<Object>} Nouveaux achievements et progression mise à jour
   * @throws {UnauthorizedException} Si l'utilisateur n'est pas authentifié
   *
   * @example
   * ```typescript
   * // Déclencher la vérification des progrès
   * POST /achievements/check-progress
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse après déblocage:
   * {
   *   newAchievements: [
   *     {
   *       id: "word_master",
   *       name: "Maître des Mots",
   *       description: "Ajouter 100 mots au dictionnaire",
   *       points: 500,
   *       difficulty: "gold",
   *       category: "contribution",
   *       unlockedAt: "2025-01-01T12:00:00Z"
   *     }
   *   ],
   *   updatedProgress: [
   *     {
   *       achievementId: "social_butterfly",
   *       name: "Papillon Social",
   *       previousProgress: 45,
   *       currentProgress: 52,
   *       target: 100,
   *       percentage: 52
   *     }
   *   ],
   *   levelUp: {
   *     previousLevel: 7,
   *     newLevel: 8,
   *     pointsRequired: 2000,
   *     bonusAchievements: ["level_8_master"]
   *   }
   * }
   * ```
   */
  @Post("check-progress")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Vérifier les progrès et débloquer de nouveaux achievements",
    description:
      "Déclenche une vérification manuelle des achievements pour l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Vérification effectuée",
    schema: {
      type: "object",
      properties: {
        newAchievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              points: { type: "number" },
              difficulty: { type: "string" },
              category: { type: "string" },
              unlockedAt: { type: "string", format: "date-time" },
            },
          },
        },
        updatedProgress: {
          type: "array",
          items: {
            type: "object",
            properties: {
              achievementId: { type: "string" },
              name: { type: "string" },
              previousProgress: { type: "number" },
              currentProgress: { type: "number" },
              target: { type: "number" },
              percentage: { type: "number" },
            },
          },
        },
        levelUp: {
          type: "object",
          properties: {
            previousLevel: { type: "number" },
            newLevel: { type: "number" },
            pointsRequired: { type: "number" },
            bonusAchievements: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  })
  async checkProgress(@Request() req: RequestWithUser) {
    return this.achievementsService.checkAndUpdateProgress(req.user!._id);
  }

  /**
   * Récupère les achievements récemment débloqués par la communauté
   *
   * Cette méthode affiche un flux des derniers achievements débloqués par tous les utilisateurs,
   * permettant de voir l'activité récente de la communauté et de découvrir des achievements rares.
   * Utile pour créer un sentiment d'émulation et de partage entre utilisateurs.
   *
   * @async
   * @method getRecentAchievements
   * @param {number} [limit=20] - Nombre maximum d'achievements récents à retourner
   * @param {number} [hours=24] - Période en heures pour considérer comme "récent"
   * @returns {Promise<Object>} Liste des achievements récemment débloqués avec statistiques
   *
   * @example
   * ```typescript
   * // Récupérer les 10 derniers achievements des 12 dernières heures
   * GET /achievements/recent?limit=10&hours=12
   *
   * // Réponse typique:
   * {
   *   recentAchievements: [
   *     {
   *       userId: "user456",
   *       username: "contributeur_actif",
   *       profilePicture: "avatar.jpg",
   *       achievement: {
   *         id: "word_master",
   *         name: "Maître des Mots",
   *         description: "Ajouter 100 mots au dictionnaire",
   *         icon: "word-icon.svg",
   *         difficulty: "gold",
   *         points: 500,
   *         rarity: 15.2
   *       },
   *       unlockedAt: "2025-01-01T10:30:00Z",
   *       isRare: false
   *     }
   *   ],
   *   stats: {
   *     totalUnlocked: 47,
   *     uniqueUsers: 23,
   *     rareUnlocks: 3
   *   }
   * }
   * ```
   */
  @Get("recent")
  @ApiOperation({ summary: "Achievements récemment débloqués (communauté)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre d'achievements récents à afficher",
    example: 20,
  })
  @ApiQuery({
    name: "hours",
    required: false,
    type: Number,
    description: 'Période en heures pour considérer comme "récent"',
    example: 24,
  })
  @ApiResponse({
    status: 200,
    description: "Achievements récents récupérés",
    schema: {
      type: "object",
      properties: {
        recentAchievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              userId: { type: "string" },
              username: { type: "string" },
              profilePicture: { type: "string" },
              achievement: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  description: { type: "string" },
                  icon: { type: "string" },
                  difficulty: { type: "string" },
                  points: { type: "number" },
                  rarity: { type: "number" },
                },
              },
              unlockedAt: { type: "string", format: "date-time" },
              isRare: { type: "boolean" },
            },
          },
        },
        stats: {
          type: "object",
          properties: {
            totalUnlocked: { type: "number" },
            uniqueUsers: { type: "number" },
            rareUnlocks: { type: "number" },
          },
        },
      },
    },
  })
  async getRecentAchievements(
    @Query("limit") limit: number = 20,
    @Query("hours") hours: number = 24
  ) {
    return this.achievementsService.getRecentCommunityAchievements({
      limit: +limit,
      hours: +hours,
    });
  }

  /**
   * Récupère les statistiques globales des achievements (admin uniquement)
   *
   * Cette méthode fournit des statistiques complètes sur l'utilisation des achievements
   * dans l'application, incluant les taux de completion, les tendances et les métriques
   * d'engagement. Accès restreint aux administrateurs.
   *
   * @async
   * @method getStatistics
   * @returns {Promise<Object>} Statistiques globales détaillées
   *
   * @example
   * ```typescript
   * // Récupérer les statistiques globales
   * GET /achievements/statistics
   * Authorization: Bearer <admin-jwt-token>
   *
   * // Réponse typique:
   * {
   *   overview: {
   *     totalAchievements: 45,
   *     totalUnlocks: 12547,
   *     activeUsers: 1247,
   *     averageCompletionRate: 34.2
   *   },
   *   byCategory: [
   *     {
   *       category: "contribution",
   *       totalAchievements: 12,
   *       totalUnlocks: 5634,
   *       completionRate: 45.2
   *     }
   *   ],
   *   trends: {
   *     dailyUnlocks: [45, 67, 23, 89],
   *     popularCategories: ["contribution", "social"],
   *     engagementMetrics: { activeRate: 0.75 }
   *   }
   * }
   * ```
   */
  @Get("statistics")
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Statistiques globales des achievements (admin)" })
  @ApiResponse({
    status: 200,
    description: "Statistiques récupérées",
    schema: {
      type: "object",
      properties: {
        overview: {
          type: "object",
          properties: {
            totalAchievements: { type: "number" },
            totalUnlocks: { type: "number" },
            activeUsers: { type: "number" },
            averageCompletionRate: { type: "number" },
          },
        },
        byCategory: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              totalAchievements: { type: "number" },
              totalUnlocks: { type: "number" },
              completionRate: { type: "number" },
              popularAchievements: { type: "array" },
            },
          },
        },
        byDifficulty: {
          type: "array",
          items: {
            type: "object",
            properties: {
              difficulty: { type: "string" },
              totalAchievements: { type: "number" },
              totalUnlocks: { type: "number" },
              averageTimeToUnlock: { type: "number" },
            },
          },
        },
        trends: {
          type: "object",
          properties: {
            dailyUnlocks: { type: "array", items: { type: "number" } },
            popularCategories: { type: "array" },
            engagementMetrics: { type: "object" },
          },
        },
      },
    },
  })
  async getStatistics() {
    return this.achievementsService.getGlobalStatistics();
  }

  /**
   * Récupère les achievements rares et exclusifs disponibles
   *
   * Cette méthode retourne les achievements considérés comme rares,
   * c'est-à-dire débloqués par moins d'un certain pourcentage d'utilisateurs.
   * Inclut des informations sur la rareté et les détenteurs actuels.
   *
   * @async
   * @method getRareAchievements
   * @param {number} [threshold=5] - Seuil de rareté (pourcentage max d'utilisateurs)
   * @returns {Promise<Object>} Liste des achievements rares avec statistiques
   *
   * @example
   * ```typescript
   * // Récupérer les achievements possédés par moins de 3% des utilisateurs
   * GET /achievements/rare?threshold=3
   *
   * // Réponse typique:
   * {
   *   rareAchievements: [
   *     {
   *       id: "legendary_contributor",
   *       name: "Contributeur Légendaire",
   *       description: "Ajouter 1000 mots validés au dictionnaire",
   *       icon: "legendary-icon.svg",
   *       difficulty: "diamond",
   *       points: 5000,
   *       rarity: 0.8,
   *       unlockCount: 12,
   *       firstUnlockedBy: "pioneer_user",
   *       firstUnlockedAt: "2024-06-15T08:00:00Z",
   *       holders: [...]
   *     }
   *   ],
   *   totalUsers: 1500,
   *   threshold: 5
   * }
   * ```
   */
  @Get("rare")
  @ApiOperation({ summary: "Achievements rares et exclusifs" })
  @ApiQuery({
    name: "threshold",
    required: false,
    type: Number,
    description: "Seuil de rareté (pourcentage max d'utilisateurs qui l'ont)",
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: "Achievements rares récupérés",
    schema: {
      type: "object",
      properties: {
        rareAchievements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              icon: { type: "string" },
              difficulty: { type: "string" },
              points: { type: "number" },
              rarity: { type: "number" },
              unlockCount: { type: "number" },
              firstUnlockedBy: { type: "string" },
              firstUnlockedAt: { type: "string", format: "date-time" },
              holders: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                    username: { type: "string" },
                    unlockedAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
        totalUsers: { type: "number" },
        threshold: { type: "number" },
      },
    },
  })
  async getRareAchievements(@Query("threshold") threshold: number = 5) {
    return this.achievementsService.getRareAchievements(+threshold);
  }

  /**
   * Récupère le progrès détaillé d'un achievement spécifique pour l'utilisateur authentifié
   *
   * Cette méthode permet à l'utilisateur connecté de consulter le progrès détaillé
   * d'un achievement particulier, incluant les critères spécifiques, les étapes manquantes,
   * et des conseils pour débloquer l'achievement. Utile pour guider l'utilisateur
   * vers la completion d'achievements complexes.
   *
   * @async
   * @method getAchievementProgress
   * @param {string} achievementId - ID de l'achievement à consulter
   * @param {RequestWithUser} req - Requête avec utilisateur authentifié
   * @returns {Promise<Object>} Progrès détaillé avec conseils et comparaisons
   *
   * @example
   * ```typescript
   * // Consulter le progrès de l'achievement "word_master"
   * GET /achievements/progress/word_master
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   achievement: {
   *     id: "word_master",
   *     name: "Maître des Mots",
   *     description: "Ajouter 100 mots validés au dictionnaire",
   *     category: "contribution",
   *     difficulty: "gold",
   *     points: 500,
   *     requirements: {
   *       type: "word_contribution",
   *       target: 100,
   *       conditions: ["validated_words"]
   *     }
   *   },
   *   progress: {
   *     current: 67,
   *     target: 100,
   *     percentage: 67,
   *     isUnlocked: false,
   *     estimatedCompletion: "2025-02-15T00:00:00Z"
   *   },
   *   breakdown: [
   *     {
   *       criterion: "Mots validés",
   *       current: 67,
   *       target: 100,
   *       completed: false,
   *       description: "Mots ajoutés et approuvés par la communauté"
   *     }
   *   ],
   *   tips: [
   *     "Ajoutez des mots avec des définitions claires et précises",
   *     "Utilisez des exemples d'usage pour augmenter vos chances de validation"
   *   ],
   *   similarUsers: [
   *     {
   *       username: "contributeur_actif",
   *       progress: 89,
   *       timeToUnlock: 15
   *     }
   *   ]
   * }
   * ```
   */
  @Get("progress/:achievementId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Détails du progrès d'un achievement spécifique" })
  @ApiParam({
    name: "achievementId",
    description: "ID de l'achievement",
  })
  @ApiResponse({
    status: 200,
    description: "Progrès détaillé récupéré",
    schema: {
      type: "object",
      properties: {
        achievement: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            difficulty: { type: "string" },
            points: { type: "number" },
            requirements: { type: "object" },
          },
        },
        progress: {
          type: "object",
          properties: {
            current: { type: "number" },
            target: { type: "number" },
            percentage: { type: "number" },
            isUnlocked: { type: "boolean" },
            unlockedAt: { type: "string", format: "date-time" },
          },
        },
        breakdown: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion: { type: "string" },
              current: { type: "number" },
              target: { type: "number" },
              completed: { type: "boolean" },
            },
          },
        },
        tips: {
          type: "array",
          items: { type: "string" },
        },
        similarUsers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              username: { type: "string" },
              progress: { type: "number" },
              timeToUnlock: { type: "number" },
            },
          },
        },
      },
    },
  })
  async getAchievementProgress(
    @Param("achievementId") achievementId: string,
    @Request() req: RequestWithUser
  ) {
    return this.achievementsService.getAchievementProgress(
      achievementId,
      req.user!._id
    );
  }
}
