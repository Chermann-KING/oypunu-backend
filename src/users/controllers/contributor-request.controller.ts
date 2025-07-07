import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
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
import { ContributorRequestService } from '../services/contributor-request.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../schemas/user.schema';
import { ContributorRequestStatus, ContributorRequestPriority } from '../schemas/contributor-request.schema';
import { CreateContributorRequestDto } from '../dto/create-contributor-request.dto';
import {
  ReviewContributorRequestDto,
  UpdateContributorRequestPriorityDto,
  BulkActionDto,
  ContributorRequestFiltersDto,
} from '../dto/review-contributor-request.dto';

interface JwtUser {
  userId?: string;
  _id?: string;
  username: string;
  email: string;
  role: UserRole;
}

@ApiTags('contributor-requests')
@Controller('contributor-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContributorRequestController {
  constructor(
    private readonly contributorRequestService: ContributorRequestService,
  ) {}

  // === ENDPOINTS POUR LES UTILISATEURS ===

  @Post()
  @ApiOperation({ summary: 'Créer une demande de contribution' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Demande créée avec succès',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données invalides ou demande déjà existante',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Une demande est déjà en cours de traitement',
  })
  async createRequest(
    @Request() req: { user: JwtUser },
    @Body() createDto: CreateContributorRequestDto,
  ) {
    const userId = req.user.userId || req.user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }
    return this.contributorRequestService.createRequest(userId, createDto);
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Récupérer mes demandes de contribution' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demandes récupérées avec succès',
  })
  async getMyRequests(@Request() req: { user: JwtUser }) {
    const userId = req.user.userId || req.user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }
    return this.contributorRequestService.getUserRequests(userId);
  }

  // === ENDPOINTS POUR L'ADMINISTRATION ===

  @Get()
  @Roles('admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Récupérer la liste des demandes de contribution (Admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected', 'under_review'] })
  @ApiQuery({ name: 'priority', required: false, enum: ['low', 'medium', 'high', 'urgent'] })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Recherche textuelle' })
  @ApiQuery({ name: 'reviewedBy', required: false, type: String, description: 'ID du reviewer' })
  @ApiQuery({ name: 'highPriorityOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'specialReviewOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'maxDaysOld', required: false, type: Number, description: 'Demandes de moins de X jours' })
  @ApiQuery({ name: 'expiringSoon', required: false, type: Boolean, description: 'Demandes expirant bientôt' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liste des demandes récupérée avec succès',
  })
  async getRequests(
    @Request() req: { user: JwtUser },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query() filters?: ContributorRequestFiltersDto,
  ) {
    return this.contributorRequestService.getRequests(
      page || 1,
      limit || 20,
      filters || {},
      req.user.role,
    );
  }

  @Get('statistics')
  @Roles('admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Récupérer les statistiques des demandes (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistiques récupérées avec succès',
  })
  async getStatistics(@Request() req: { user: JwtUser }) {
    return this.contributorRequestService.getStatistics(req.user.role);
  }

  @Get(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Récupérer une demande spécifique (Admin)' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demande récupérée avec succès',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Demande non trouvée',
  })
  async getRequestById(
    @Param('id') requestId: string,
    @Request() req: { user: JwtUser },
  ) {
    return this.contributorRequestService.getRequestById(requestId, req.user.role);
  }

  @Patch(':id/review')
  @Roles('admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Réviser une demande de contribution (Admin)' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiBody({ type: ReviewContributorRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demande révisée avec succès',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Demande non trouvée',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Données de révision invalides',
  })
  async reviewRequest(
    @Param('id') requestId: string,
    @Body() reviewDto: ReviewContributorRequestDto,
    @Request() req: { user: JwtUser },
  ) {
    const reviewerId = req.user.userId || req.user._id;
    if (!reviewerId) {
      throw new Error('Reviewer ID not found');
    }
    return this.contributorRequestService.reviewRequest(
      requestId,
      reviewDto,
      reviewerId,
      req.user.role,
    );
  }

  @Patch(':id/priority')
  @Roles('admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Mettre à jour la priorité d\'une demande (Admin)' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiBody({ type: UpdateContributorRequestPriorityDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Priorité mise à jour avec succès',
  })
  async updatePriority(
    @Param('id') requestId: string,
    @Body() priorityDto: UpdateContributorRequestPriorityDto,
    @Request() req: { user: JwtUser },
  ) {
    const adminId = req.user.userId || req.user._id;
    if (!adminId) {
      throw new Error('Admin ID not found');
    }
    return this.contributorRequestService.updatePriority(
      requestId,
      priorityDto,
      adminId,
      req.user.role,
    );
  }

  @Post('bulk-action')
  @Roles('admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Actions en lot sur les demandes (Admin)' })
  @ApiBody({ type: BulkActionDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Actions appliquées avec succès',
  })
  async bulkAction(
    @Body() bulkDto: BulkActionDto,
    @Request() req: { user: JwtUser },
  ) {
    const adminId = req.user.userId || req.user._id;
    if (!adminId) {
      throw new Error('Admin ID not found');
    }
    return this.contributorRequestService.bulkAction(
      bulkDto,
      adminId,
      req.user.role,
    );
  }

  @Delete('cleanup')
  @Roles('superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Nettoyer les demandes expirées (Superadmin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Nettoyage effectué avec succès',
  })
  async cleanupExpiredRequests() {
    return this.contributorRequestService.cleanupExpiredRequests();
  }

  // === ENDPOINTS POUR LES CONTRIBUTEURS ===

  @Get('pending/quick-view')
  @Roles('contributor', 'admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Vue rapide des demandes en attente (Contributeurs+)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vue rapide des demandes récupérée avec succès',
  })
  async getQuickView(
    @Request() req: { user: JwtUser },
    @Query('limit') limit = 10,
  ) {
    // Vue simplifiée pour les contributeurs
    const result = await this.contributorRequestService.getRequests(
      1,
      limit,
      { status: ContributorRequestStatus.PENDING },
      req.user.role,
    );

    // Retourner seulement les informations essentielles
    return {
      pendingCount: result.total,
      recentRequests: result.requests.map((request: any) => ({
        id: request._id,
        username: request.username,
        motivation: request.motivation.substring(0, 100) + '...',
        priority: request.priority,
        createdAt: request.createdAt,
        daysOld: Math.floor(
          (new Date().getTime() - new Date(request.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      })),
      statistics: result.statistics,
    };
  }

  @Patch(':id/quick-review')
  @Roles('contributor', 'admin', 'superadmin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Révision rapide par contributeur' })
  @ApiParam({ name: 'id', description: 'ID de la demande' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['recommend', 'flag'], example: 'recommend' },
        notes: { type: 'string', maxLength: 300, example: 'Candidat prometteur' },
      },
      required: ['action'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Révision rapide effectuée avec succès',
  })
  async quickReview(
    @Param('id') requestId: string,
    @Body() body: { action: 'recommend' | 'flag'; notes?: string },
    @Request() req: { user: JwtUser },
  ) {
    const contributorId = req.user.userId || req.user._id;
    if (!contributorId) {
      throw new Error('Contributor ID not found');
    }

    if (body.action === 'recommend') {
      // Marquer comme recommandé par un contributeur
      return this.contributorRequestService.updatePriority(
        requestId,
        { priority: ContributorRequestPriority.HIGH, reason: `Recommandé par ${req.user.username}: ${body.notes || ''}` },
        contributorId,
        req.user.role,
      );
    } else {
      // Marquer pour révision spéciale
      return this.contributorRequestService.updatePriority(
        requestId,
        { priority: ContributorRequestPriority.URGENT, reason: `Signalé par ${req.user.username}: ${body.notes || ''}` },
        contributorId,
        req.user.role,
      );
    }
  }
}