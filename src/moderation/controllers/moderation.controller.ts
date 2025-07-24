import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ModerationService } from '../services/moderation.service';

interface RequestWithUser {
  user: {
    _id: string;
    username: string;
    role: string;
  };
}

// DTOs
class FlagContentDto {
  reason: 'inappropriate' | 'spam' | 'incorrect' | 'offensive' | 'copyright' | 'other';
  description?: string;
  category?: string;
}

class BulkApprovalDto {
  wordIds: string[];
  action: 'approve' | 'reject';
  reason?: string;
  notes?: string;
}

class ModerationActionDto {
  action: 'approve' | 'reject' | 'edit' | 'delete' | 'warn_user';
  reason?: string;
  notes?: string;
  newStatus?: 'approved' | 'rejected' | 'pending';
}

@ApiTags('moderation')
@Controller('moderation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('reported-content')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin', 'moderator')
  @ApiOperation({ summary: 'Récupérer le contenu signalé' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats par page',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'resolved', 'dismissed', 'all'],
    description: 'Statut des signalements',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['word', 'comment', 'user', 'all'],
    description: 'Type de contenu signalé',
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    enum: ['low', 'medium', 'high', 'critical'],
    description: 'Niveau de gravité',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenu signalé récupéré',
    schema: {
      type: 'object',
      properties: {
        reports: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              contentType: { type: 'string', enum: ['word', 'comment', 'user'] },
              contentId: { type: 'string' },
              reason: { type: 'string' },
              description: { type: 'string' },
              reportedBy: { type: 'string' },
              reportedAt: { type: 'string', format: 'date-time' },
              status: { type: 'string', enum: ['pending', 'resolved', 'dismissed'] },
              severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              moderatorId: { type: 'string' },
              resolvedAt: { type: 'string', format: 'date-time' },
              content: { type: 'object' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async getReportedContent(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status: 'pending' | 'resolved' | 'dismissed' | 'all' = 'pending',
    @Query('type') type: 'word' | 'comment' | 'user' | 'all' = 'all',
    @Query('severity') severity?: 'low' | 'medium' | 'high' | 'critical',
  ) {
    return this.moderationService.getReportedContent({
      page: +page,
      limit: +limit,
      status,
      type,
      severity,
    });
  }

  @Post('words/:id/flag')
  @ApiOperation({ summary: 'Signaler un mot comme inapproprié' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot à signaler',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: FlagContentDto })
  @ApiResponse({
    status: 201,
    description: 'Signalement créé avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        reportId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async flagWord(
    @Param('id') wordId: string,
    @Body() flagDto: FlagContentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.moderationService.flagContent(
      'word',
      wordId,
      flagDto.reason,
      req.user._id,
      flagDto.description,
      flagDto.category,
    );
  }

  @Post('comments/:id/flag')
  @ApiOperation({ summary: 'Signaler un commentaire comme inapproprié' })
  @ApiParam({
    name: 'id',
    description: 'ID du commentaire à signaler',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: FlagContentDto })
  @ApiResponse({
    status: 201,
    description: 'Signalement créé avec succès',
  })
  async flagComment(
    @Param('id') commentId: string,
    @Body() flagDto: FlagContentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.moderationService.flagContent(
      'comment',
      commentId,
      flagDto.reason,
      req.user._id,
      flagDto.description,
      flagDto.category,
    );
  }

  @Post('users/:id/flag')
  @ApiOperation({ summary: 'Signaler un utilisateur' })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'utilisateur à signaler',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: FlagContentDto })
  @ApiResponse({
    status: 201,
    description: 'Signalement créé avec succès',
  })
  async flagUser(
    @Param('id') userId: string,
    @Body() flagDto: FlagContentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.moderationService.flagContent(
      'user',
      userId,
      flagDto.reason,
      req.user._id,
      flagDto.description,
      flagDto.category,
    );
  }

  @Post('bulk-approve')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin', 'moderator')
  @ApiOperation({ summary: 'Approbation ou rejet en masse de mots' })
  @ApiBody({ type: BulkApprovalDto })
  @ApiResponse({
    status: 200,
    description: 'Action en masse effectuée',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        processed: { type: 'number' },
        failed: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              wordId: { type: 'string' },
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async bulkApproval(
    @Body() bulkDto: BulkApprovalDto,
    @Request() req: RequestWithUser,
  ) {
    return this.moderationService.bulkModerationAction(
      bulkDto.wordIds,
      bulkDto.action,
      req.user._id,
      bulkDto.reason,
      bulkDto.notes,
    );
  }

  @Get('user-contributions/:userId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin', 'moderator')
  @ApiOperation({ summary: 'Historique des contributions d\'un utilisateur' })
  @ApiParam({
    name: 'userId',
    description: 'ID de l\'utilisateur',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats par page',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['approved', 'pending', 'rejected', 'all'],
    description: 'Statut des contributions',
  })
  @ApiResponse({
    status: 200,
    description: 'Contributions de l\'utilisateur récupérées',
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
            totalContributions: { type: 'number' },
          },
        },
        contributions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['word', 'revision', 'comment'] },
              content: { type: 'object' },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              moderatedBy: { type: 'string' },
              moderatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        stats: {
          type: 'object',
          properties: {
            approved: { type: 'number' },
            pending: { type: 'number' },
            rejected: { type: 'number' },
            successRate: { type: 'number' },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getUserContributions(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status: 'approved' | 'pending' | 'rejected' | 'all' = 'all',
  ) {
    return this.moderationService.getUserContributions(userId, {
      page: +page,
      limit: +limit,
      status,
    });
  }

  @Patch('reports/:reportId')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin', 'moderator')
  @ApiOperation({ summary: 'Traiter un signalement' })
  @ApiParam({
    name: 'reportId',
    description: 'ID du signalement',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: ModerationActionDto })
  @ApiResponse({
    status: 200,
    description: 'Signalement traité avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        report: { type: 'object' },
        actionTaken: { type: 'string' },
      },
    },
  })
  async handleReport(
    @Param('reportId') reportId: string,
    @Body() actionDto: ModerationActionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.moderationService.handleReport(
      reportId,
      actionDto.action,
      req.user._id,
      actionDto.reason,
      actionDto.notes,
      actionDto.newStatus,
    );
  }

  @Get('queue')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin', 'moderator')
  @ApiOperation({ summary: 'File d\'attente de modération prioritaire' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'éléments à récupérer',
    example: 10,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['high_priority', 'reported', 'auto_flagged', 'pending_review'],
    description: 'Type de file d\'attente',
  })
  @ApiResponse({
    status: 200,
    description: 'File d\'attente de modération récupérée',
    schema: {
      type: 'object',
      properties: {
        queue: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              contentId: { type: 'string' },
              priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              reason: { type: 'string' },
              waitTime: { type: 'number' },
              content: { type: 'object' },
            },
          },
        },
        totalInQueue: { type: 'number' },
        averageWaitTime: { type: 'number' },
      },
    },
  })
  async getModerationQueue(
    @Query('limit') limit: number = 10,
    @Query('type') type: 'high_priority' | 'reported' | 'auto_flagged' | 'pending_review' = 'high_priority',
  ) {
    return this.moderationService.getModerationQueue(+limit, type);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin', 'moderator')
  @ApiOperation({ summary: 'Statistiques de modération' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['day', 'week', 'month', 'quarter'],
    description: 'Période d\'analyse',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de modération récupérées',
    schema: {
      type: 'object',
      properties: {
        overview: {
          type: 'object',
          properties: {
            totalReports: { type: 'number' },
            pendingReports: { type: 'number' },
            resolvedReports: { type: 'number' },
            averageResolutionTime: { type: 'number' },
          },
        },
        reportsByType: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              count: { type: 'number' },
              percentage: { type: 'number' },
            },
          },
        },
        moderatorActivity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              moderatorId: { type: 'string' },
              username: { type: 'string' },
              actionsCount: { type: 'number' },
              averageResponseTime: { type: 'number' },
            },
          },
        },
        trends: {
          type: 'object',
          properties: {
            reportsGrowth: { type: 'number' },
            resolutionRateImprovement: { type: 'number' },
            qualityScore: { type: 'number' },
          },
        },
      },
    },
  })
  async getModerationStats(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' | 'quarter' = 'week',
  ) {
    return this.moderationService.getModerationStats(timeframe);
  }

  @Post('auto-moderation/configure')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Configurer les règles de modération automatique' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['keyword', 'pattern', 'ml_model'] },
              condition: { type: 'string' },
              action: { type: 'string', enum: ['flag', 'auto_reject', 'review'] },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              enabled: { type: 'boolean' },
            },
          },
        },
        thresholds: {
          type: 'object',
          properties: {
            autoApprove: { type: 'number' },
            autoReject: { type: 'number' },
            requireReview: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration de modération automatique mise à jour',
  })
  async configureAutoModeration(
    @Body() config: any,
    @Request() req: RequestWithUser,
  ) {
    return this.moderationService.configureAutoModeration(config, req.user._id);
  }

  @Get('my-reports')
  @ApiOperation({ summary: 'Mes signalements effectués' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats par page',
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'resolved', 'dismissed', 'all'],
    description: 'Statut des signalements',
  })
  @ApiResponse({
    status: 200,
    description: 'Mes signalements récupérés',
  })
  async getMyReports(
    @Request() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status: 'pending' | 'resolved' | 'dismissed' | 'all' = 'all',
  ) {
    return this.moderationService.getUserReports(req.user._id, {
      page: +page,
      limit: +limit,
      status,
    });
  }
}