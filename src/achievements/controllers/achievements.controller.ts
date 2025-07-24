import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AchievementsService } from '../services/achievements.service';

interface RequestWithUser {
  user?: {
    _id: string;
    username: string;
    role: string;
  };
}

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer tous les achievements disponibles' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['contribution', 'social', 'learning', 'milestone', 'special'],
    description: 'Filtrer par catégorie',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    description: 'Filtrer par difficulté',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des achievements récupérée',
    schema: {
      type: 'object',
      properties: {
        achievements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              category: { 
                type: 'string', 
                enum: ['contribution', 'social', 'learning', 'milestone', 'special'] 
              },
              difficulty: { 
                type: 'string', 
                enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'] 
              },
              icon: { type: 'string' },
              points: { type: 'number' },
              requirements: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  target: { type: 'number' },
                  conditions: { type: 'array', items: { type: 'string' } },
                },
              },
              isUnlocked: { type: 'boolean' },
              progress: {
                type: 'object',
                properties: {
                  current: { type: 'number' },
                  target: { type: 'number' },
                  percentage: { type: 'number' },
                },
              },
              unlockedAt: { type: 'string', format: 'date-time' },
              rarity: { type: 'number' },
            },
          },
        },
        userStats: {
          type: 'object',
          properties: {
            totalAchievements: { type: 'number' },
            unlockedAchievements: { type: 'number' },
            totalPoints: { type: 'number' },
            level: { type: 'number' },
            nextLevelPoints: { type: 'number' },
          },
        },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              total: { type: 'number' },
              unlocked: { type: 'number' },
              points: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getAllAchievements(
    @Request() req?: RequestWithUser,
    @Query('category') category?: 'contribution' | 'social' | 'learning' | 'milestone' | 'special',
    @Query('difficulty') difficulty?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond',
  ) {
    return this.achievementsService.getAllAchievements(req?.user?._id, {
      category,
      difficulty,
    });
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Récupérer les achievements d\'un utilisateur spécifique' })
  @ApiParam({
    name: 'userId',
    description: 'ID de l\'utilisateur',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiQuery({
    name: 'unlocked',
    required: false,
    type: Boolean,
    description: 'Filtrer par statut débloqué/non débloqué',
  })
  @ApiResponse({
    status: 200,
    description: 'Achievements de l\'utilisateur récupérés',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            profilePicture: { type: 'string' },
            level: { type: 'number' },
            totalPoints: { type: 'number' },
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
              category: { type: 'string' },
              difficulty: { type: 'string' },
              icon: { type: 'string' },
              points: { type: 'number' },
              unlockedAt: { type: 'string', format: 'date-time' },
              rarity: { type: 'number' },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            totalAchievements: { type: 'number' },
            unlockedCount: { type: 'number' },
            completionRate: { type: 'number' },
            recentUnlocks: { type: 'number' },
            rareAchievements: { type: 'number' },
          },
        },
      },
    },
  })
  async getUserAchievements(
    @Param('userId') userId: string,
    @Query('unlocked') unlocked?: boolean,
  ) {
    return this.achievementsService.getUserAchievements(userId, { unlocked });
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer mes achievements' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['contribution', 'social', 'learning', 'milestone', 'special'],
    description: 'Filtrer par catégorie',
  })
  @ApiQuery({
    name: 'unlocked',
    required: false,
    type: Boolean,
    description: 'Filtrer par statut débloqué/non débloqué',
  })
  @ApiResponse({
    status: 200,
    description: 'Mes achievements récupérés',
  })
  async getMyAchievements(
    @Request() req: RequestWithUser,
    @Query('category') category?: 'contribution' | 'social' | 'learning' | 'milestone' | 'special',
    @Query('unlocked') unlocked?: boolean,
  ) {
    return this.achievementsService.getUserAchievements(req.user!._id, {
      category,
      unlocked,
    });
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Classement des achievements' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['week', 'month', 'quarter', 'year', 'all'],
    description: 'Période du classement',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['contribution', 'social', 'learning', 'milestone', 'special'],
    description: 'Filtrer par catégorie',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'utilisateurs à afficher',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Classement récupéré',
    schema: {
      type: 'object',
      properties: {
        leaderboard: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rank: { type: 'number' },
              userId: { type: 'string' },
              username: { type: 'string' },
              profilePicture: { type: 'string' },
              level: { type: 'number' },
              totalPoints: { type: 'number' },
              achievementsCount: { type: 'number' },
              recentActivity: { type: 'string', format: 'date-time' },
              badges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    icon: { type: 'string' },
                    rarity: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        period: { type: 'string' },
        totalUsers: { type: 'number' },
        userRank: { type: 'number' },
      },
    },
  })
  async getLeaderboard(
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' | 'all' = 'all',
    @Query('category') category?: 'contribution' | 'social' | 'learning' | 'milestone' | 'special',
    @Query('limit') limit: number = 50,
  ) {
    return this.achievementsService.getLeaderboard({
      period,
      category,
      limit: +limit,
    });
  }

  @Post('check-progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Vérifier les progrès et débloquer de nouveaux achievements',
    description: 'Déclenche une vérification manuelle des achievements pour l\'utilisateur connecté'
  })
  @ApiResponse({
    status: 200,
    description: 'Vérification effectuée',
    schema: {
      type: 'object',
      properties: {
        newAchievements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              points: { type: 'number' },
              difficulty: { type: 'string' },
              category: { type: 'string' },
              unlockedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        updatedProgress: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              achievementId: { type: 'string' },
              name: { type: 'string' },
              previousProgress: { type: 'number' },
              currentProgress: { type: 'number' },
              target: { type: 'number' },
              percentage: { type: 'number' },
            },
          },
        },
        levelUp: {
          type: 'object',
          properties: {
            previousLevel: { type: 'number' },
            newLevel: { type: 'number' },
            pointsRequired: { type: 'number' },
            bonusAchievements: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  async checkProgress(@Request() req: RequestWithUser) {
    return this.achievementsService.checkAndUpdateProgress(req.user!._id);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Achievements récemment débloqués (communauté)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'achievements récents à afficher',
    example: 20,
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    type: Number,
    description: 'Période en heures pour considérer comme "récent"',
    example: 24,
  })
  @ApiResponse({
    status: 200,
    description: 'Achievements récents récupérés',
    schema: {
      type: 'object',
      properties: {
        recentAchievements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              username: { type: 'string' },
              profilePicture: { type: 'string' },
              achievement: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  icon: { type: 'string' },
                  difficulty: { type: 'string' },
                  points: { type: 'number' },
                  rarity: { type: 'number' },
                },
              },
              unlockedAt: { type: 'string', format: 'date-time' },
              isRare: { type: 'boolean' },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            totalUnlocked: { type: 'number' },
            uniqueUsers: { type: 'number' },
            rareUnlocks: { type: 'number' },
          },
        },
      },
    },
  })
  async getRecentAchievements(
    @Query('limit') limit: number = 20,
    @Query('hours') hours: number = 24,
  ) {
    return this.achievementsService.getRecentCommunityAchievements({
      limit: +limit,
      hours: +hours,
    });
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statistiques globales des achievements (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées',
    schema: {
      type: 'object',
      properties: {
        overview: {
          type: 'object',
          properties: {
            totalAchievements: { type: 'number' },
            totalUnlocks: { type: 'number' },
            activeUsers: { type: 'number' },
            averageCompletionRate: { type: 'number' },
          },
        },
        byCategory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              totalAchievements: { type: 'number' },
              totalUnlocks: { type: 'number' },
              completionRate: { type: 'number' },
              popularAchievements: { type: 'array' },
            },
          },
        },
        byDifficulty: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              difficulty: { type: 'string' },
              totalAchievements: { type: 'number' },
              totalUnlocks: { type: 'number' },
              averageTimeToUnlock: { type: 'number' },
            },
          },
        },
        trends: {
          type: 'object',
          properties: {
            dailyUnlocks: { type: 'array', items: { type: 'number' } },
            popularCategories: { type: 'array' },
            engagementMetrics: { type: 'object' },
          },
        },
      },
    },
  })
  async getStatistics() {
    return this.achievementsService.getGlobalStatistics();
  }

  @Get('rare')
  @ApiOperation({ summary: 'Achievements rares et exclusifs' })
  @ApiQuery({
    name: 'threshold',
    required: false,
    type: Number,
    description: 'Seuil de rareté (pourcentage max d\'utilisateurs qui l\'ont)',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Achievements rares récupérés',
    schema: {
      type: 'object',
      properties: {
        rareAchievements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              icon: { type: 'string' },
              difficulty: { type: 'string' },
              points: { type: 'number' },
              rarity: { type: 'number' },
              unlockCount: { type: 'number' },
              firstUnlockedBy: { type: 'string' },
              firstUnlockedAt: { type: 'string', format: 'date-time' },
              holders: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    username: { type: 'string' },
                    unlockedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
        totalUsers: { type: 'number' },
        threshold: { type: 'number' },
      },
    },
  })
  async getRareAchievements(@Query('threshold') threshold: number = 5) {
    return this.achievementsService.getRareAchievements(+threshold);
  }

  @Get('progress/:achievementId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Détails du progrès d\'un achievement spécifique' })
  @ApiParam({
    name: 'achievementId',
    description: 'ID de l\'achievement',
  })
  @ApiResponse({
    status: 200,
    description: 'Progrès détaillé récupéré',
    schema: {
      type: 'object',
      properties: {
        achievement: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            difficulty: { type: 'string' },
            points: { type: 'number' },
            requirements: { type: 'object' },
          },
        },
        progress: {
          type: 'object',
          properties: {
            current: { type: 'number' },
            target: { type: 'number' },
            percentage: { type: 'number' },
            isUnlocked: { type: 'boolean' },
            unlockedAt: { type: 'string', format: 'date-time' },
          },
        },
        breakdown: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              criterion: { type: 'string' },
              current: { type: 'number' },
              target: { type: 'number' },
              completed: { type: 'boolean' },
            },
          },
        },
        tips: {
          type: 'array',
          items: { type: 'string' },
        },
        similarUsers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              progress: { type: 'number' },
              timeToUnlock: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getAchievementProgress(
    @Param('achievementId') achievementId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.achievementsService.getAchievementProgress(achievementId, req.user!._id);
  }
}