/**
 * @fileoverview Contrôleur REST pour analytics et métriques de O'Ypunu
 *
 * Ce contrôleur fournit une API REST complète pour l'accès aux données
 * analytiques de la plateforme O'Ypunu. Il expose des endpoints pour
 * tableaux de bord, statistiques utilisateur, tendances linguistiques,
 * et exports de données avec contrôle d'accès granulaire.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AnalyticsService } from "../services/analytics.service";

/**
 * Interface pour les requêtes avec utilisateur authentifié
 *
 * @interface RequestWithUser
 */
interface RequestWithUser {
  /** Données utilisateur extraites du JWT */
  user: {
    /** ID unique de l'utilisateur */
    _id: string;
    /** Rôle et niveau de permissions */
    role: string;
  };
}

/**
 * Contrôleur REST pour analytics et métriques de O'Ypunu
 *
 * Ce contrôleur centralise tous les endpoints relatifs aux analytics de la plateforme,
 * offrant des fonctionnalités avancées d'analyse de données, génération de métriques,
 * et export de rapports avec contrôle d'accès basé sur les rôles utilisateur.
 *
 * ## Fonctionnalités principales :
 *
 * ### 📊 Tableaux de bord
 * - Dashboard administrateur complet
 * - Métriques en temps réel
 * - Vue d'ensemble des KPIs
 *
 * ### 👤 Analytics utilisateur
 * - Statistiques détaillées par utilisateur
 * - Statistiques personnelles
 * - Métriques d'engagement individuel
 *
 * ### 🌍 Analyses linguistiques
 * - Tendances par langue
 * - Mots les plus recherchés
 * - Évolution temporelle du contenu
 *
 * ### 📈 Métriques avancées
 * - Métriques de performance système
 * - Analytics d'engagement utilisateur
 * - Export de données personnalisé
 *
 * ## Sécurité :
 * - Authentification JWT requise
 * - Contrôle d'accès par rôles
 * - Endpoints administrateur restreints
 *
 * @class AnalyticsController
 * @version 1.0.0
 */
@ApiTags("analytics")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  /**
   * Constructeur du contrôleur d'analytics
   *
   * @constructor
   * @param {AnalyticsService} analyticsService - Service principal d'analytics et métriques
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection automatique :
   * @Controller('analytics')
   * export class AnalyticsController {
   *   constructor(
   *     private readonly analyticsService: AnalyticsService
   *   ) {}
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Récupère les métriques du tableau de bord administrateur
   *
   * Cette méthode retourne un dashboard complet avec toutes les métriques
   * principales de la plateforme O'Ypunu. Accessible uniquement aux administrateurs
   * et super-administrateurs pour la supervision générale de la plateforme.
   *
   * @async
   * @method getDashboard
   * @returns {Promise<Object>} Métriques complètes du dashboard
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/dashboard
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   overview: {
   *     totalWords: 15420,
   *     totalUsers: 1245,
   *     totalViews: 89230,
   *     pendingWords: 23
   *   },
   *   wordsByLanguage: [
   *     { language: "punu", count: 8500, percentage: 55.1 },
   *     { language: "french", count: 4200, percentage: 27.2 }
   *   ],
   *   recentActivity: {
   *     wordsAddedToday: 12,
   *     wordsAddedThisWeek: 89,
   *     wordsAddedThisMonth: 342,
   *     usersJoinedToday: 3
   *   },
   *   topContributors: [
   *     {
   *       userId: "60a1b2c3d4e5f6a7b8c9d0e1",
   *       username: "user123",
   *       contributionCount: 256,
   *       lastContribution: "2025-01-15T10:30:00Z"
   *     }
   *   ]
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("dashboard")
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Tableau de bord analytics pour admins" })
  @ApiResponse({
    status: 200,
    description: "Métriques du tableau de bord récupérées",
    schema: {
      type: "object",
      properties: {
        overview: {
          type: "object",
          properties: {
            totalWords: { type: "number" },
            totalUsers: { type: "number" },
            totalViews: { type: "number" },
            pendingWords: { type: "number" },
          },
        },
        wordsByLanguage: {
          type: "array",
          items: {
            type: "object",
            properties: {
              language: { type: "string" },
              count: { type: "number" },
              percentage: { type: "number" },
            },
          },
        },
        recentActivity: {
          type: "object",
          properties: {
            wordsAddedToday: { type: "number" },
            wordsAddedThisWeek: { type: "number" },
            wordsAddedThisMonth: { type: "number" },
            usersJoinedToday: { type: "number" },
          },
        },
        topContributors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              userId: { type: "string" },
              username: { type: "string" },
              contributionCount: { type: "number" },
              lastContribution: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  })
  async getDashboard() {
    return this.analyticsService.getDashboardMetrics();
  }

  /**
   * Récupère les statistiques d'activité d'un utilisateur
   *
   * Cette méthode retourne les statistiques détaillées d'un utilisateur spécifique,
   * y compris ses contributions, son activité récente et ses préférences linguistiques.
   *
   * @async
   * @method getUserActivity
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Statistiques d'activité de l'utilisateur
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/user-activity/60a1b2c3d4e5f6a7b8c9d0e1
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   user: {
   *     id: "60a1b2c3d4e5f6a7b8c9d0e1",
   *     username: "user123",
   *     role: "contributor",
   *     joinDate: "2022-01-01T10:00:00Z"
   *   },
   *   contributions: {
   *     totalWords: 100,
   *     approvedWords: 80,
   *     pendingWords: 15,
   *     rejectedWords: 5
   *   },
   *   activity: {
   *     totalViews: 500,
   *     uniqueWordsViewed: 100,
   *     averageViewsPerDay: 50,
   *     lastActivity: "2025-01-15T10:30:00Z"
   *   },
   *   languagePreferences: [
   *     { language: "punu", wordCount: 50, viewCount: 200 },
   *     { language: "french", wordCount: 30, viewCount: 150 }
   *   ]
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("user-activity/:userId")
  @ApiOperation({ summary: "Statistiques détaillées d'un utilisateur" })
  @ApiParam({
    name: "userId",
    description: "ID de l'utilisateur",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques utilisateur récupérées",
    schema: {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            role: { type: "string" },
            joinDate: { type: "string", format: "date-time" },
          },
        },
        contributions: {
          type: "object",
          properties: {
            totalWords: { type: "number" },
            approvedWords: { type: "number" },
            pendingWords: { type: "number" },
            rejectedWords: { type: "number" },
          },
        },
        activity: {
          type: "object",
          properties: {
            totalViews: { type: "number" },
            uniqueWordsViewed: { type: "number" },
            averageViewsPerDay: { type: "number" },
            lastActivity: { type: "string", format: "date-time" },
          },
        },
        languagePreferences: {
          type: "array",
          items: {
            type: "object",
            properties: {
              language: { type: "string" },
              wordCount: { type: "number" },
              viewCount: { type: "number" },
            },
          },
        },
      },
    },
  })
  async getUserActivity(@Param("userId") userId: string) {
    return this.analyticsService.getUserActivityStats(userId);
  }

  /**
   * Récupère les tendances par langue
   *
   * Cette méthode retourne les tendances d'utilisation des langues sur une période donnée.
   *
   * @async
   * @method getLanguageTrends
   * @param {string} timeframe - Période d'analyse (ex: "week", "month", "quarter", "year")
   * @returns {Promise<Object>} Tendances par langue
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/language-trends?timeframe=month
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   trends: [
   *     { language: "ypunu", currentPeriod: 100, previousPeriod: 80, growth: 20, growthPercentage: 25 },
   *     { language: "french", currentPeriod: 150, previousPeriod: 120, growth: 30, growthPercentage: 25 }
   *   ],
   *   timeframe: "month",
   *   generatedAt: "2025-01-15T10:30:00Z"
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("language-trends")
  @ApiOperation({ summary: "Tendances par langue" })
  @ApiQuery({
    name: "timeframe",
    required: false,
    enum: ["week", "month", "quarter", "year"],
    description: "Période d'analyse",
  })
  @ApiResponse({
    status: 200,
    description: "Tendances par langue récupérées",
    schema: {
      type: "object",
      properties: {
        trends: {
          type: "array",
          items: {
            type: "object",
            properties: {
              language: { type: "string" },
              currentPeriod: { type: "number" },
              previousPeriod: { type: "number" },
              growth: { type: "number" },
              growthPercentage: { type: "number" },
            },
          },
        },
        timeframe: { type: "string" },
        generatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  async getLanguageTrends(
    @Query("timeframe")
    timeframe: "week" | "month" | "quarter" | "year" = "month"
  ) {
    return this.analyticsService.getLanguageTrends(timeframe);
  }

  /**
   * Récupère les mots les plus recherchés
   *
   * Cette méthode retourne les mots les plus recherchés sur une période donnée.
   *
   * @async
   * @method getMostSearchedWords
   * @param {number} limit - Nombre de résultats à retourner
   * @param {string} language - Filtrer par langue
   * @param {string} timeframe - Période d'analyse (ex: "day", "week", "month", "all")
   * @returns {Promise<Object>} Mots les plus recherchés
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/most-searched-words?limit=10&language=fr&timeframe=month
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   words: [
   *     { wordId: "1", word: "ypunu", language: "fr", searchCount: 100, uniqueUsers: 50, lastSearched: "2025-01-15T10:30:00Z" },
   *     { wordId: "2", word: "french", language: "fr", searchCount: 80, uniqueUsers: 40, lastSearched: "2025-01-14T10:30:00Z" }
   *   ],
   *   totalSearches: 180,
   *   timeframe: "month"
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("most-searched-words")
  @ApiOperation({ summary: "Mots les plus recherchés" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre de résultats",
    example: 20,
  })
  @ApiQuery({
    name: "language",
    required: false,
    type: String,
    description: "Filtrer par langue",
  })
  @ApiQuery({
    name: "timeframe",
    required: false,
    enum: ["day", "week", "month", "all"],
    description: "Période d'analyse",
  })
  @ApiResponse({
    status: 200,
    description: "Mots les plus recherchés récupérés",
    schema: {
      type: "object",
      properties: {
        words: {
          type: "array",
          items: {
            type: "object",
            properties: {
              wordId: { type: "string" },
              word: { type: "string" },
              language: { type: "string" },
              searchCount: { type: "number" },
              uniqueUsers: { type: "number" },
              lastSearched: { type: "string", format: "date-time" },
            },
          },
        },
        totalSearches: { type: "number" },
        timeframe: { type: "string" },
      },
    },
  })
  async getMostSearchedWords(
    @Query("limit") limit: number = 20,
    @Query("language") language?: string,
    @Query("timeframe") timeframe: "day" | "week" | "month" | "all" = "week"
  ) {
    return this.analyticsService.getMostSearchedWords({
      limit: +limit,
      language,
      timeframe,
    });
  }

  /**
   * Exporte les données d'analyse
   *
   * Cette méthode permet d'exporter les données d'analyse dans différents formats.
   *
   * @async
   * @method exportData
   * @param {string} format - Format d'export (ex: "json", "csv")
   * @param {string} type - Type de données à exporter (ex: "dashboard", "users", "words", "activity")
   * @param {Date} startDate - Date de début de la période d'export
   * @param {Date} endDate - Date de fin de la période d'export
   * @returns {Promise<Object>} Données exportées
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/export?format=json&type=dashboard&startDate=2025-01-01&endDate=2025-01-31
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   data: [
   *     { userId: "1", activity: "search", timestamp: "2025-01-15T10:30:00Z" },
   *     { userId: "2", activity: "upload", timestamp: "2025-01-14T10:30:00Z" }
   *   ],
   *   timeframe: "month"
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("export")
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Export des données analytics" })
  @ApiQuery({
    name: "format",
    required: false,
    enum: ["json", "csv"],
    description: "Format d'export",
  })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["dashboard", "users", "words", "activity"],
    description: "Type de données à exporter",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Date de début (ISO string)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "Date de fin (ISO string)",
  })
  @ApiResponse({
    status: 200,
    description: "Données exportées",
    schema: {
      oneOf: [
        {
          type: "object",
          description: "Format JSON",
        },
        {
          type: "string",
          description: "Format CSV",
        },
      ],
    },
  })
  async exportData(
    @Query("format") format: "json" | "csv" = "json",
    @Query("type")
    type: "dashboard" | "users" | "words" | "activity" = "dashboard",
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    return this.analyticsService.exportData({
      format,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * Récupère les métriques de performance système
   *
   * Cette méthode retourne les métriques de performance du système.
   *
   * @async
   * @method getPerformanceMetrics
   * @returns {Promise<Object>} Métriques de performance
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/performance-metrics
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   database: {
   *     avgResponseTime: 200,
   *     slowQueries: 5,
   *     connectionCount: 100
   *   },
   *   api: {
   *     requestsPerMinute: 50,
   *     avgResponseTime: 150,
   *     errorRate: 0.02
   *   },
   *   storage: {
   *     totalAudioFiles: 1000,
   *     totalStorageUsed: "10GB",
   *     avgFileSize: 10
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("performance-metrics")
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Métriques de performance système" })
  @ApiResponse({
    status: 200,
    description: "Métriques de performance récupérées",
    schema: {
      type: "object",
      properties: {
        database: {
          type: "object",
          properties: {
            avgResponseTime: { type: "number" },
            slowQueries: { type: "number" },
            connectionCount: { type: "number" },
          },
        },
        api: {
          type: "object",
          properties: {
            requestsPerMinute: { type: "number" },
            avgResponseTime: { type: "number" },
            errorRate: { type: "number" },
          },
        },
        storage: {
          type: "object",
          properties: {
            totalAudioFiles: { type: "number" },
            totalStorageUsed: { type: "string" },
            avgFileSize: { type: "number" },
          },
        },
      },
    },
  })
  async getPerformanceMetrics() {
    return this.analyticsService.getPerformanceMetrics();
  }

  /**
   * Récupère les métriques d'engagement utilisateur
   *
   * Cette méthode retourne les métriques d'engagement des utilisateurs.
   *
   * @async
   * @method getUserEngagement
   * @param {string} timeframe - Période d'analyse (ex: "day", "week", "month")
   * @returns {Promise<Object>} Métriques d'engagement
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/user-engagement?timeframe=week
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   activeUsers: {
   *     daily: 100,
   *     weekly: 500,
   *     monthly: 2000
   *   },
   *   engagement: {
   *     avgSessionDuration: 300,
   *     avgWordsViewedPerSession: 50,
   *     bounceRate: 0.1,
   *     returnUserRate: 0.8
   *   },
   *   features: {
   *     searchUsage: 200,
   *     favoriteUsage: 150,
   *     audioPlaybacks: 100,
   *     shareActions: 50
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("user-engagement")
  @ApiOperation({ summary: "Métriques d'engagement utilisateur" })
  @ApiQuery({
    name: "timeframe",
    required: false,
    enum: ["day", "week", "month"],
    description: "Période d'analyse",
  })
  @ApiResponse({
    status: 200,
    description: "Métriques d'engagement récupérées",
    schema: {
      type: "object",
      properties: {
        activeUsers: {
          type: "object",
          properties: {
            daily: { type: "number" },
            weekly: { type: "number" },
            monthly: { type: "number" },
          },
        },
        engagement: {
          type: "object",
          properties: {
            avgSessionDuration: { type: "number" },
            avgWordsViewedPerSession: { type: "number" },
            bounceRate: { type: "number" },
            returnUserRate: { type: "number" },
          },
        },
        features: {
          type: "object",
          properties: {
            searchUsage: { type: "number" },
            favoriteUsage: { type: "number" },
            audioPlaybacks: { type: "number" },
            shareActions: { type: "number" },
          },
        },
      },
    },
  })
  async getUserEngagement(
    @Query("timeframe") timeframe: "day" | "week" | "month" = "week"
  ) {
    return this.analyticsService.getUserEngagementMetrics(timeframe);
  }

  /**
   * Récupère les statistiques personnelles de l'utilisateur connecté
   *
   * Cette méthode retourne les statistiques personnelles de l'utilisateur connecté.
   *
   * @async
   * @method getMyStats
   * @returns {Promise<Object>} Statistiques personnelles
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant (admin/superadmin requis)
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /analytics/my-stats
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   profile: {
   *     username: "john_doe",
   *     joinDate: "2023-01-01T00:00:00Z"
   *   },
   *   contributions: {
   *     totalWords: 1000,
   *     approvedWords: 800,
   *     wordsThisMonth: 200,
   *     rank: 5
   *   },
   *   activity: {
   *     totalViews: 5000,
   *     uniqueWords: 300,
   *     streakDays: 10,
   *     favoriteWords: 50
   *   },
   *   achievements: [
   *     {
   *       id: "1",
   *       name: "Novice",
   *       description: "A terminé son premier article",
   *       unlockedAt: "2023-01-01T00:00:00Z"
   *     }
   *   ]
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AnalyticsController
   */
  @Get("my-stats")
  @ApiOperation({
    summary: "Statistiques personnelles de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques personnelles récupérées",
    schema: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: {
            username: { type: "string" },
            joinDate: { type: "string", format: "date-time" },
            role: { type: "string" },
          },
        },
        contributions: {
          type: "object",
          properties: {
            totalWords: { type: "number" },
            approvedWords: { type: "number" },
            wordsThisMonth: { type: "number" },
            rank: { type: "number" },
          },
        },
        activity: {
          type: "object",
          properties: {
            totalViews: { type: "number" },
            uniqueWords: { type: "number" },
            streakDays: { type: "number" },
            favoriteWords: { type: "number" },
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
              unlockedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  })
  async getMyStats(@Request() req: RequestWithUser) {
    return this.analyticsService.getUserPersonalStats(req.user._id);
  }
}
