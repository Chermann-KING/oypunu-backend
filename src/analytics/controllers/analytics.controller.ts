import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from '../services/analytics.service';

interface RequestWithUser {
  user: {
    _id: string;
    role: string;
  };
}

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Tableau de bord analytics pour admins' })
  @ApiResponse({
    status: 200,
    description: 'Métriques du tableau de bord récupérées',
    schema: {
      type: 'object',
      properties: {
        overview: {
          type: 'object',
          properties: {
            totalWords: { type: 'number' },
            totalUsers: { type: 'number' },
            totalViews: { type: 'number' },
            pendingWords: { type: 'number' },
          },
        },
        wordsByLanguage: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              count: { type: 'number' },
              percentage: { type: 'number' },
            },
          },
        },
        recentActivity: {
          type: 'object',
          properties: {
            wordsAddedToday: { type: 'number' },
            wordsAddedThisWeek: { type: 'number' },
            wordsAddedThisMonth: { type: 'number' },
            usersJoinedToday: { type: 'number' },
          },
        },
        topContributors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              username: { type: 'string' },
              contributionCount: { type: 'number' },
              lastContribution: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async getDashboard() {
    return this.analyticsService.getDashboardMetrics();
  }

  @Get('user-activity/:userId')
  @ApiOperation({ summary: 'Statistiques détaillées d\'un utilisateur' })
  @ApiParam({
    name: 'userId',
    description: 'ID de l\'utilisateur',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques utilisateur récupérées',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            role: { type: 'string' },
            joinDate: { type: 'string', format: 'date-time' },
          },
        },
        contributions: {
          type: 'object',
          properties: {
            totalWords: { type: 'number' },
            approvedWords: { type: 'number' },
            pendingWords: { type: 'number' },
            rejectedWords: { type: 'number' },
          },
        },
        activity: {
          type: 'object',
          properties: {
            totalViews: { type: 'number' },
            uniqueWordsViewed: { type: 'number' },
            averageViewsPerDay: { type: 'number' },
            lastActivity: { type: 'string', format: 'date-time' },
          },
        },
        languagePreferences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              wordCount: { type: 'number' },
              viewCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getUserActivity(@Param('userId') userId: string) {
    return this.analyticsService.getUserActivityStats(userId);
  }

  @Get('language-trends')
  @ApiOperation({ summary: 'Tendances par langue' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['week', 'month', 'quarter', 'year'],
    description: 'Période d\'analyse',
  })
  @ApiResponse({
    status: 200,
    description: 'Tendances par langue récupérées',
    schema: {
      type: 'object',
      properties: {
        trends: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              currentPeriod: { type: 'number' },
              previousPeriod: { type: 'number' },
              growth: { type: 'number' },
              growthPercentage: { type: 'number' },
            },
          },
        },
        timeframe: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getLanguageTrends(
    @Query('timeframe') timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    return this.analyticsService.getLanguageTrends(timeframe);
  }

  @Get('most-searched-words')
  @ApiOperation({ summary: 'Mots les plus recherchés' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats',
    example: 20,
  })
  @ApiQuery({
    name: 'language',
    required: false,
    type: String,
    description: 'Filtrer par langue',
  })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['day', 'week', 'month', 'all'],
    description: 'Période d\'analyse',
  })
  @ApiResponse({
    status: 200,
    description: 'Mots les plus recherchés récupérés',
    schema: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              wordId: { type: 'string' },
              word: { type: 'string' },
              language: { type: 'string' },
              searchCount: { type: 'number' },
              uniqueUsers: { type: 'number' },
              lastSearched: { type: 'string', format: 'date-time' },
            },
          },
        },
        totalSearches: { type: 'number' },
        timeframe: { type: 'string' },
      },
    },
  })
  async getMostSearchedWords(
    @Query('limit') limit: number = 20,
    @Query('language') language?: string,
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' | 'all' = 'week',
  ) {
    return this.analyticsService.getMostSearchedWords({
      limit: +limit,
      language,
      timeframe,
    });
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Export des données analytics' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    description: 'Format d\'export',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['dashboard', 'users', 'words', 'activity'],
    description: 'Type de données à exporter',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Date de début (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Date de fin (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Données exportées',
    schema: {
      oneOf: [
        {
          type: 'object',
          description: 'Format JSON',
        },
        {
          type: 'string',
          description: 'Format CSV',
        },
      ],
    },
  })
  async exportData(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('type') type: 'dashboard' | 'users' | 'words' | 'activity' = 'dashboard',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.exportData({
      format,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('performance-metrics')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Métriques de performance système' })
  @ApiResponse({
    status: 200,
    description: 'Métriques de performance récupérées',
    schema: {
      type: 'object',
      properties: {
        database: {
          type: 'object',
          properties: {
            avgResponseTime: { type: 'number' },
            slowQueries: { type: 'number' },
            connectionCount: { type: 'number' },
          },
        },
        api: {
          type: 'object',
          properties: {
            requestsPerMinute: { type: 'number' },
            avgResponseTime: { type: 'number' },
            errorRate: { type: 'number' },
          },
        },
        storage: {
          type: 'object',
          properties: {
            totalAudioFiles: { type: 'number' },
            totalStorageUsed: { type: 'string' },
            avgFileSize: { type: 'number' },
          },
        },
      },
    },
  })
  async getPerformanceMetrics() {
    return this.analyticsService.getPerformanceMetrics();
  }

  @Get('user-engagement')
  @ApiOperation({ summary: 'Métriques d\'engagement utilisateur' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['day', 'week', 'month'],
    description: 'Période d\'analyse',
  })
  @ApiResponse({
    status: 200,
    description: 'Métriques d\'engagement récupérées',
    schema: {
      type: 'object',
      properties: {
        activeUsers: {
          type: 'object',
          properties: {
            daily: { type: 'number' },
            weekly: { type: 'number' },
            monthly: { type: 'number' },
          },
        },
        engagement: {
          type: 'object',
          properties: {
            avgSessionDuration: { type: 'number' },
            avgWordsViewedPerSession: { type: 'number' },
            bounceRate: { type: 'number' },
            returnUserRate: { type: 'number' },
          },
        },
        features: {
          type: 'object',
          properties: {
            searchUsage: { type: 'number' },
            favoriteUsage: { type: 'number' },
            audioPlaybacks: { type: 'number' },
            shareActions: { type: 'number' },
          },
        },
      },
    },
  })
  async getUserEngagement(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' = 'week',
  ) {
    return this.analyticsService.getUserEngagementMetrics(timeframe);
  }

  @Get('my-stats')
  @ApiOperation({ summary: 'Statistiques personnelles de l\'utilisateur connecté' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques personnelles récupérées',
    schema: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            joinDate: { type: 'string', format: 'date-time' },
            role: { type: 'string' },
          },
        },
        contributions: {
          type: 'object',
          properties: {
            totalWords: { type: 'number' },
            approvedWords: { type: 'number' },
            wordsThisMonth: { type: 'number' },
            rank: { type: 'number' },
          },
        },
        activity: {
          type: 'object',
          properties: {
            totalViews: { type: 'number' },
            uniqueWords: { type: 'number' },
            streakDays: { type: 'number' },
            favoriteWords: { type: 'number' },
          },
        },
        achievements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              unlockedAt: { type: 'string', format: 'date-time' },
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