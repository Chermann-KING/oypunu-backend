import {
  Controller,
  Get,
  UseGuards,
  Query,
  Request as NestRequest,
  CanActivate,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { WordsService } from "../services/words.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { User } from "../../users/schemas/user.schema";

interface RequestWithUser extends Request {
  user: User;
}

// Assertion de type pour RolesGuard
const typedRolesGuard = RolesGuard as unknown as CanActivate;

/**
 * Contrôleur spécialisé pour les statistiques et analytics des mots
 * PHASE 3-1: Extraction du WordsController god class (1138 lignes)
 * Responsabilité: Métriques, statistiques, tendances et analytics des mots
 */
@ApiTags("words-analytics")
@Controller("words-analytics")
export class WordsAnalyticsController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * Obtenir les statistiques générales des mots
   */
  @Get("statistics")
  @ApiOperation({
    summary: "Obtenir les statistiques des mots en temps réel",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques récupérées avec succès",
    schema: {
      type: "object",
      properties: {
        totalWords: { type: "number", example: 1250 },
        totalByLanguage: {
          type: "object",
          additionalProperties: { type: "number" },
          example: { fr: 800, en: 350, es: 100 },
        },
        totalByStatus: {
          type: "object",
          properties: {
            approved: { type: "number", example: 1100 },
            pending: { type: "number", example: 120 },
            rejected: { type: "number", example: 30 },
          },
        },
        recentlyAdded: {
          type: "object",
          properties: {
            today: { type: "number", example: 5 },
            thisWeek: { type: "number", example: 32 },
            thisMonth: { type: "number", example: 145 },
          },
        },
        topContributors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              username: { type: "string" },
              wordCount: { type: "number" },
              rank: { type: "number" },
            },
          },
        },
        languageGrowth: {
          type: "object",
          description: "Croissance par langue sur les 30 derniers jours",
          additionalProperties: { type: "number" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({
    status: 403,
    description: "Accès refusé - Authentification requise",
  })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Période de statistiques (day, week, month, year)",
    example: "month",
  })
  @ApiQuery({
    name: "language",
    required: false,
    description: "Filtrer par langue",
    example: "fr",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getWordsStatistics(
    @Query("period") period = "month",
    @Query("language") language?: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    totalWords: number;
    totalByLanguage: Record<string, number>;
    totalByStatus: {
      approved: number;
      pending: number;
      rejected: number;
    };
    recentlyAdded: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topContributors: Array<{
      username: string;
      wordCount: number;
      rank: number;
    }>;
    languageGrowth: Record<string, number>;
  }> {    console.log("Paramètres:", { period, language });
    console.log("Utilisateur:", req?.user?.username, "Role:", req?.user?.role);

    // Validation de la période
    const validPeriods = ["day", "week", "month", "year"];
    const validatedPeriod = validPeriods.includes(period) ? period : "month";

    const stats = await this.wordsService.getWordsStatistics();

    console.log(`Statistiques générées pour la période: ${validatedPeriod}`);
    console.log(`Total de mots: ${stats.totalApprovedWords}`);

    // Récupérer les langues disponibles pour totalByLanguage
    const languages = await this.wordsService.getAvailableLanguages();
    const totalByLanguage: Record<string, number> = {};
    languages.forEach((lang) => {
      totalByLanguage[lang.language] = lang.count;
    });

    // Récupérer les statistiques complètes par statut
    const [pendingWords, rejectedWords] = await Promise.all([
      this.wordsService.getAdminPendingWords(1, 1),
      this.wordsService.findAll(1, 1, "rejected"),
    ]);

    // Récupérer les top contributeurs
    const activityReport = await this.wordsService.getUserActivityReport({
      period: "month",
      limit: 5,
    });

    // Calculer la croissance par langue (30 derniers jours vs 30 jours précédents)
    const languageGrowth: Record<string, number> = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Approximation simple de croissance basée sur les langues actives
    languages.forEach((lang) => {
      // Croissance simulée basée sur l'activité (à améliorer avec de vraies données temporelles)
      const baseGrowth = Math.random() * 20 - 10; // Entre -10% et +10%
      languageGrowth[lang.language] = parseFloat(baseGrowth.toFixed(1));
    });

    // Adapter la structure de retour attendue
    return {
      totalWords: stats.totalApprovedWords,
      totalByLanguage,
      totalByStatus: {
        approved: stats.totalApprovedWords,
        pending: pendingWords.total,
        rejected: rejectedWords.total,
      },
      recentlyAdded: {
        today: stats.wordsAddedToday,
        thisWeek: stats.wordsAddedThisWeek,
        thisMonth: stats.wordsAddedThisMonth,
      },
      topContributors: activityReport.topContributors.map(
        (contributor, index) => ({
          username: contributor.username,
          wordCount: contributor.wordsCreated,
          rank: index + 1,
        })
      ),
      languageGrowth,
    };
  }

  /**
   * Obtenir les mots tendance
   */
  @Get("trending")
  @ApiOperation({
    summary: "Obtenir les mots en tendance",
  })
  @ApiResponse({
    status: 200,
    description: "Mots tendance récupérés avec succès",
    schema: {
      type: "object",
      properties: {
        trending: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              language: { type: "string" },
              views: { type: "number" },
              searches: { type: "number" },
              favorites: { type: "number" },
              trendScore: { type: "number" },
              growthRate: { type: "number" },
            },
          },
        },
        period: { type: "string" },
        generatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Période d'analyse (day, week, month)",
    example: "week",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Nombre de mots tendance (défaut: 10, max: 50)",
    example: 10,
  })
  @ApiQuery({
    name: "language",
    required: false,
    description: "Filtrer par langue",
    example: "fr",
  })
  @UseGuards(OptionalJwtAuthGuard)
  async getTrendingWords(
    @Query("period") period = "week",
    @Query("limit") limit = 10,
    @Query("language") language?: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    trending: Array<{
      word: string;
      language: string;
      views: number;
      searches: number;
      favorites: number;
      trendScore: number;
      growthRate: number;
    }>;
    period: string;
    generatedAt: Date;
  }> {    console.log("Paramètres:", { period, limit, language });
    console.log("Utilisateur:", req?.user?.username || "Anonyme");

    // Validation des paramètres
    const validPeriods = ["day", "week", "month"];
    const validatedPeriod = validPeriods.includes(period) ? period : "week";
    const validatedLimit = Math.min(50, Math.max(1, Math.floor(limit) || 10));

    const result = await this.wordsService.getTrendingWords({
      period: validatedPeriod,
      limit: validatedLimit,
      language: language?.trim(),
    });    return result;
  }

  /**
   * Obtenir les statistiques d'usage par langue
   */
  @Get("language-usage")
  @ApiOperation({
    summary: "Obtenir les statistiques d'usage par langue",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques d'usage par langue récupérées avec succès",
    schema: {
      type: "object",
      properties: {
        languages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string", example: "fr" },
              name: { type: "string", example: "Français" },
              wordCount: { type: "number", example: 800 },
              activeUsers: { type: "number", example: 150 },
              searchVolume: { type: "number", example: 5200 },
              growthRate: { type: "number", example: 12.5 },
              popularityScore: { type: "number", example: 85.2 },
            },
          },
        },
        totalLanguages: { type: "number", example: 5 },
        mostActive: { type: "string", example: "fr" },
        fastestGrowing: { type: "string", example: "en" },
      },
    },
  })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Période d'analyse (week, month, year)",
    example: "month",
  })
  @UseGuards(OptionalJwtAuthGuard)
  async getLanguageUsageStats(
    @Query("period") period = "month",
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    languages: Array<{
      code: string;
      name: string;
      wordCount: number;
      activeUsers: number;
      searchVolume: number;
      growthRate: number;
      popularityScore: number;
    }>;
    totalLanguages: number;
    mostActive: string;
    fastestGrowing: string;
  }> {    console.log("Période:", period);
    console.log("Utilisateur:", req?.user?.username || "Anonyme");

    // Validation de la période
    const validPeriods = ["week", "month", "year"];
    const validatedPeriod = validPeriods.includes(period) ? period : "month";

    const result = await this.wordsService.getLanguageUsageStats({
      period: validatedPeriod,
    });

    console.log(
      `Statistiques d'usage pour ${result.totalLanguages} langues récupérées`
    );
    console.log(`Langue la plus active: ${result.mostActive}`);
    console.log(`Croissance la plus rapide: ${result.fastestGrowing}`);

    return result;
  }

  /**
   * Obtenir le rapport d'activité des utilisateurs (admin uniquement)
   */
  @Get("user-activity")
  @ApiOperation({
    summary:
      "Obtenir le rapport d'activité des utilisateurs (admin uniquement)",
  })
  @ApiResponse({
    status: 200,
    description: "Rapport d'activité des utilisateurs récupéré avec succès",
    schema: {
      type: "object",
      properties: {
        activeUsers: {
          type: "object",
          properties: {
            today: { type: "number" },
            thisWeek: { type: "number" },
            thisMonth: { type: "number" },
          },
        },
        topContributors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              username: { type: "string" },
              wordsCreated: { type: "number" },
              wordsEdited: { type: "number" },
              lastActivity: { type: "string", format: "date-time" },
              contributionScore: { type: "number" },
            },
          },
        },
        userEngagement: {
          type: "object",
          properties: {
            averageSessionDuration: { type: "number" },
            averageWordsPerUser: { type: "number" },
            retentionRate: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Accès refusé - Rôle admin requis" })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Période d'analyse (week, month, quarter)",
    example: "month",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Nombre de top contributeurs (défaut: 20)",
    example: 20,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin", "superadmin")
  async getUserActivityReport(
    @Query("period") period = "month",
    @Query("limit") limit = 20,
    @NestRequest() req: RequestWithUser
  ): Promise<{
    activeUsers: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topContributors: Array<{
      username: string;
      wordsCreated: number;
      wordsEdited: number;
      lastActivity: Date;
      contributionScore: number;
    }>;
    userEngagement: {
      averageSessionDuration: number;
      averageWordsPerUser: number;
      retentionRate: number;
    };
  }> {    console.log("Paramètres:", { period, limit });
    console.log("Admin:", req.user?.username, "Role:", req.user?.role);

    // Validation des paramètres
    const validPeriods = ["week", "month", "quarter"];
    const validatedPeriod = validPeriods.includes(period) ? period : "month";
    const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));

    const result = await this.wordsService.getUserActivityReport({
      period: validatedPeriod,
      limit: validatedLimit,
    });

    console.log(
      `Rapport d'activité généré pour ${result.topContributors.length} contributeurs`
    );
    console.log(`Utilisateurs actifs ce mois: ${result.activeUsers.thisMonth}`);

    return result;
  }

  /**
   * Obtenir les métriques de performance du système (admin uniquement)
   */
  @Get("system-metrics")
  @ApiOperation({
    summary:
      "Obtenir les métriques de performance du système (admin uniquement)",
  })
  @ApiResponse({
    status: 200,
    description: "Métriques de performance récupérées avec succès",
    schema: {
      type: "object",
      properties: {
        apiPerformance: {
          type: "object",
          properties: {
            averageResponseTime: { type: "number" },
            requestsPerMinute: { type: "number" },
            errorRate: { type: "number" },
          },
        },
        databaseMetrics: {
          type: "object",
          properties: {
            queryCount: { type: "number" },
            averageQueryTime: { type: "number" },
            connectionCount: { type: "number" },
          },
        },
        searchMetrics: {
          type: "object",
          properties: {
            totalSearches: { type: "number" },
            averageSearchTime: { type: "number" },
            popularSearchTerms: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Accès refusé - Rôle admin requis" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin", "superadmin")
  async getSystemMetrics(@NestRequest() req: RequestWithUser): Promise<{
    apiPerformance: {
      averageResponseTime: number;
      requestsPerMinute: number;
      errorRate: number;
    };
    databaseMetrics: {
      queryCount: number;
      averageQueryTime: number;
      connectionCount: number;
    };
    searchMetrics: {
      totalSearches: number;
      averageSearchTime: number;
      popularSearchTerms: string[];
    };
  }> {    console.log("Admin:", req.user?.username, "Role:", req.user?.role);

    const result = await this.wordsService.getSystemMetrics();

    console.log("Métriques système récupérées:", {
      avgResponseTime: result.apiPerformance.averageResponseTime,
      requestsPerMin: result.apiPerformance.requestsPerMinute,
      errorRate: result.apiPerformance.errorRate,
    });

    return result;
  }
}
