import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ActivityService } from '../services/activity.service';
import { ActivityGateway } from '../gateways/activity.gateway';
import { ActivityType } from '../schemas/activity-feed.schema';

@ApiTags('activities')
@Controller('activities')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly activityGateway: ActivityGateway,
  ) {}

  @Get('recent')
  @ApiOperation({
    summary: 'Obtenir les activités récentes',
  })
  @ApiResponse({
    status: 200,
    description: 'Activités récentes récupérées avec succès',
  })
  async getRecentActivities(
    @Query('limit') limit: string = '10',
    @Query('prioritizeAfrican') prioritizeAfrican: string = 'true',
  ) {
    const activities = await this.activityService.getRecentActivities(
      parseInt(limit),
      prioritizeAfrican === 'true',
    );

    console.log('🔍 Activités récentes récupérées:', activities.length);
    activities.forEach((activity, index) => {
      console.log(
        `  ${index + 1}. ${activity.activityType} - ${activity.username} - Metadata:`,
        activity.metadata,
      );
    });

    return {
      activities,
      count: activities.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('by-type')
  @ApiOperation({
    summary: 'Obtenir les activités par type',
  })
  async getActivitiesByType(
    @Query('type') type: string,
    @Query('limit') limit: string = '5',
  ) {
    const activities = await this.activityService.getActivitiesByType(
      type as ActivityType,
      parseInt(limit),
    );

    return {
      activityType: type,
      activities,
      count: activities.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test')
  @ApiOperation({
    summary: 'Créer une activité de test',
  })
  async createTestActivity(
    @Body()
    testData: {
      activityType?: string;
      wordName?: string;
      languageCode?: string;
      username?: string;
    },
  ) {
    try {
      const testActivity = await this.activityService.createActivity({
        userId: '000000000000000000000000', // Test user ID
        username: testData.username || 'TestUser',
        activityType:
          (testData.activityType as ActivityType) || ActivityType.WORD_CREATED,
        entityType: 'word' as any,
        entityId: '000000000000000000000001',
        metadata: {
          wordName: testData.wordName || 'test',
          languageCode: testData.languageCode || 'yo', // Default to Yoruba (African)
          language: testData.languageCode || 'yo',
        },
      });

      return {
        message: 'Activité de test créée avec succès',
        activity: testActivity,
        connectedClients: this.activityGateway.getConnectedClientsCount(),
      };
    } catch (error) {
      return {
        message: "Erreur lors de la création de l'activité de test",
        error: error.message,
      };
    }
  }

  @Post('test-broadcast')
  @ApiOperation({
    summary: 'Diffuser une activité de test via WebSocket',
  })
  async testBroadcast() {
    try {
      await this.activityGateway.broadcastTestActivity();

      return {
        message: 'Activité de test diffusée avec succès',
        connectedClients: this.activityGateway.getConnectedClientsCount(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        message: 'Erreur lors de la diffusion de test',
        error: error.message,
      };
    }
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtenir les statistiques des activités',
  })
  async getActivityStats() {
    try {
      const [recentActivities, wordCreatedActivities, translationActivities] =
        await Promise.all([
          this.activityService.getRecentActivities(5),
          this.activityService.getActivitiesByType(
            ActivityType.WORD_CREATED,
            3,
          ),
          this.activityService.getActivitiesByType(
            ActivityType.TRANSLATION_ADDED,
            3,
          ),
        ]);

      return {
        stats: {
          totalRecentActivities: recentActivities.length,
          wordCreatedCount: wordCreatedActivities.length,
          translationCount: translationActivities.length,
          connectedClients: this.activityGateway.getConnectedClientsCount(),
        },
        recentActivities: recentActivities.slice(0, 3),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message,
      };
    }
  }
}
