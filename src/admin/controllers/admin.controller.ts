import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { AnalyticsService } from '../services/analytics.service';
import { ContributorRequestService } from '../../users/services/contributor-request.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

interface JwtUser {
  userId?: string;
  _id?: string;
  username: string;
  email: string;
  role: UserRole;
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AnalyticsService,
    private readonly contributorRequestService: ContributorRequestService,
  ) {}

  // Dashboard principal
  @Get('dashboard')
  @Roles('contributor', 'admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer les statistiques du dashboard admin' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
  })
  async getDashboard(@Request() req: { user: JwtUser }) {
    const [adminStats, contributorStats] = await Promise.all([
      this.adminService.getDashboardStats(req.user.role),
      this.contributorRequestService
        .getStatistics(req.user.role)
        .catch(() => null),
    ]);

    return {
      ...adminStats,
      contributorRequests: contributorStats || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
      },
    };
  }

  // === GESTION DES UTILISATEURS ===

  @Get('users')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer la liste des utilisateurs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'suspended', 'all'],
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getUsers(
    @Request() req: { user: JwtUser },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('role') role?: UserRole,
    @Query('status') status?: 'active' | 'suspended' | 'all',
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      +page,
      +limit,
      role,
      status,
      search,
      req.user.role,
    );
  }

  @Patch('users/:id/suspension')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Suspendre ou activer un utilisateur' })
  @ApiParam({ name: 'id', description: "ID de l'utilisateur" })
  async toggleUserSuspension(
    @Param('id') userId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { suspend: boolean; reason?: string; suspendUntil?: Date },
  ) {
    return this.adminService.toggleUserSuspension(
      userId,
      body.suspend,
      body.reason,
      body.suspendUntil,
      req.user.role,
    );
  }

  @Patch('users/:id/role')
  @Roles('superadmin')
  @ApiOperation({
    summary: "Changer le rôle d'un utilisateur (superadmin uniquement)",
  })
  @ApiParam({ name: 'id', description: "ID de l'utilisateur" })
  async changeUserRole(
    @Param('id') userId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { role: UserRole },
  ) {
    return this.adminService.changeUserRole(userId, body.role, req.user.role);
  }

  // === MODÉRATION DES MOTS ===

  @Get('words/pending')
  @Roles('contributor', 'admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer les mots en attente de modération' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'language', required: false, type: String })
  async getPendingWords(
    @Request() req: { user: JwtUser },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('language') language?: string,
  ) {
    return this.adminService.getPendingWords(
      +page,
      +limit,
      language,
      req.user.role,
    );
  }

  @Patch('words/:id/moderate')
  @Roles('contributor', 'admin', 'superadmin')
  @ApiOperation({ summary: 'Approuver ou rejeter un mot' })
  @ApiParam({ name: 'id', description: 'ID du mot' })
  async moderateWord(
    @Param('id') wordId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { action: 'approve' | 'reject'; reason?: string },
  ) {
    return this.adminService.moderateWord(
      wordId,
      body.action,
      body.reason,
      req.user.role,
    );
  }

  // === GESTION DES COMMUNAUTÉS ===

  @Get('communities')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer la liste des communautés' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  async getCommunities(
    @Request() req: { user: JwtUser },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    return this.adminService.getCommunities(
      +page,
      +limit,
      status,
      req.user.role,
    );
  }

  @Delete('communities/:id')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Supprimer une communauté' })
  @ApiParam({ name: 'id', description: 'ID de la communauté' })
  async deleteCommunity(
    @Param('id') communityId: string,
    @Request() req: { user: JwtUser },
  ) {
    return this.adminService.deleteCommunity(communityId, req.user.role);
  }

  // === ACTIVITÉ ET LOGS ===

  @Get('activity')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: "Récupérer l'activité récente" })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecentActivity(
    @Request() req: { user: JwtUser },
    @Query('limit') limit = 50,
  ) {
    return this.adminService.getRecentActivity(+limit, req.user.role);
  }

  // === TABLEAU DE BORD SPÉCIALISÉ PAR RÔLE ===

  @Get('dashboard/contributor')
  @Roles('contributor', 'admin', 'superadmin')
  @ApiOperation({ summary: 'Dashboard spécialisé pour les contributeurs' })
  async getContributorDashboard(@Request() req: { user: JwtUser }) {
    // Retourner uniquement les statistiques de modération
    const stats = await this.adminService.getDashboardStats(req.user.role);
    return {
      pendingWords: stats.pendingWords,
      approvedWords: stats.approvedWords,
      rejectedWords: stats.rejectedWords,
      newWordsThisWeek: stats.newWordsThisWeek,
    };
  }

  @Get('dashboard/admin')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Dashboard spécialisé pour les administrateurs' })
  async getAdminDashboard(@Request() req: { user: JwtUser }) {
    const [stats, recentActivity] = await Promise.all([
      this.adminService.getDashboardStats(req.user.role),
      this.adminService.getRecentActivity(20, req.user.role),
    ]);

    return {
      stats,
      recentActivity,
    };
  }

  @Get('dashboard/superadmin')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Dashboard spécialisé pour les superadmins' })
  async getSuperAdminDashboard(@Request() req: { user: JwtUser }) {
    const [stats, recentActivity] = await Promise.all([
      this.adminService.getDashboardStats(req.user.role),
      this.adminService.getRecentActivity(50, req.user.role),
    ]);

    return {
      stats,
      recentActivity,
      systemHealth: {
        // Ici on pourrait ajouter des métriques système
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
  }

  // === ANALYTICS ENDPOINTS ===

  @Get('analytics/users')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer les analytics des utilisateurs' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y', 'all'] })
  async getUserAnalytics(
    @Request() req: { user: JwtUser },
    @Query('period') period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d',
  ) {
    const timeRange = this.getTimeRangeFromPeriod(period);
    return this.analyticsService.getUserAnalytics(timeRange);
  }

  @Get('analytics/content')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer les analytics du contenu' })
  async getContentAnalytics(@Request() req: { user: JwtUser }) {
    return this.analyticsService.getContentAnalytics();
  }

  @Get('analytics/communities')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer les analytics des communautés' })
  async getCommunityAnalytics(@Request() req: { user: JwtUser }) {
    return this.analyticsService.getCommunityAnalytics();
  }

  @Get('analytics/system')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer les métriques système' })
  async getSystemMetrics(@Request() req: { user: JwtUser }) {
    return this.analyticsService.getSystemMetrics();
  }

  @Get('analytics/overview')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Récupérer vue d\'ensemble complète des analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y', 'all'] })
  async getAnalyticsOverview(
    @Request() req: { user: JwtUser },
    @Query('period') period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d',
  ) {
    const timeRange = this.getTimeRangeFromPeriod(period);
    
    const [userAnalytics, contentAnalytics, communityAnalytics, systemMetrics] = 
      await Promise.all([
        this.analyticsService.getUserAnalytics(timeRange),
        this.analyticsService.getContentAnalytics(),
        this.analyticsService.getCommunityAnalytics(),
        this.analyticsService.getSystemMetrics(),
      ]);

    return {
      users: userAnalytics,
      content: contentAnalytics,
      communities: communityAnalytics,
      system: systemMetrics,
      generatedAt: new Date().toISOString(),
    };
  }

  // === REPORTS ENDPOINTS ===

  @Get('reports/export')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Exporter un rapport détaillé' })
  @ApiQuery({ name: 'type', required: true, enum: ['users', 'content', 'communities', 'full'] })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y', 'all'] })
  async exportReport(
    @Request() req: { user: JwtUser },
    @Query('type') type: 'users' | 'content' | 'communities' | 'full',
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('period') period: '7d' | '30d' | '90d' | '1y' | 'all' = '30d',
  ) {
    const timeRange = this.getTimeRangeFromPeriod(period);
    
    let reportData: any;
    
    switch (type) {
      case 'users':
        reportData = await this.analyticsService.getUserAnalytics(timeRange);
        break;
      case 'content':
        reportData = await this.analyticsService.getContentAnalytics();
        break;
      case 'communities':
        reportData = await this.analyticsService.getCommunityAnalytics();
        break;
      case 'full':
        reportData = await this.getAnalyticsOverview(req, period);
        break;
      default:
        throw new Error('Type de rapport non supporté');
    }

    return {
      type,
      format,
      period,
      data: reportData,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.username,
    };
  }

  // === MÉTHODES UTILITAIRES ===

  private getTimeRangeFromPeriod(period: string) {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = new Date('2020-01-01');
        break;
    }
    
    return {
      startDate,
      endDate: now,
      period: period as any,
    };
  }
}
