/**
 * @fileoverview Contrôleur REST pour la gestion des langues O'Ypunu
 * 
 * Ce contrôleur gère toutes les opérations sur les langues du dictionnaire
 * avec endpoints publics, authentifiés et administratifs. Il inclut la
 * gestion des propositions de langues, approbations et migrations.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { LanguagesService } from '../services/languages.service';
import { LanguageMigrationService } from '../migration/language-migration.service';
import {
  CreateLanguageDto,
  ApproveLanguageDto,
  RejectLanguageDto,
} from '../dto/create-language.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Language } from '../schemas/language.schema';
import { User } from '../../users/schemas/user.schema';

/**
 * Interface pour les requêtes avec utilisateur authentifié
 * 
 * @interface RequestWithUser
 * @property {User} user - Utilisateur authentifié avec rôles
 */
interface RequestWithUser {
  user: User;
}

/**
 * Contrôleur REST pour la gestion des langues O'Ypunu
 * 
 * Gère toutes les opérations sur les langues du dictionnaire multilingue
 * avec trois niveaux d'accès : public, authentifié et administratif.
 * Inclut système complet de proposition/approbation et outils de migration.
 * 
 * ## Sections d'endpoints :
 * 
 * ### 🌍 Endpoints publics
 * - Consultation des langues actives et africaines
 * - Recherche et filtrage par région
 * - Statistiques publiques des langues
 * 
 * ### 🔐 Endpoints authentifiés
 * - Proposition de nouvelles langues (contributeurs+)
 * - Soumission avec validation et workflow d'approbation
 * 
 * ### 👑 Endpoints administratifs
 * - Approbation/rejet des langues proposées
 * - Gestion du workflow de validation
 * - Accès aux langues en attente
 * 
 * ### 🔧 Endpoints de migration (superadmin)
 * - Seeding des langues africaines
 * - Migration des données existantes
 * - Nettoyage et maintenance
 * 
 * @class LanguagesController
 * @version 1.0.0
 */
@ApiTags('languages')
@Controller('languages')
export class LanguagesController {
  constructor(
    private readonly languagesService: LanguagesService,
    private readonly migrationService: LanguageMigrationService,
  ) {}

  // ===== ENDPOINTS PUBLICS =====

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les langues actives' })
  @ApiResponse({
    status: 200,
    description: 'Liste des langues actives récupérée avec succès',
    type: [Language],
  })
  @ApiQuery({
    name: 'region',
    required: false,
    description: 'Filtrer par région',
    example: 'Afrique Centrale',
  })
  @ApiQuery({
    name: 'featured',
    required: false,
    description: 'Langues mises en avant uniquement',
    type: Boolean,
  })
  async getActiveLanguages(
    @Query('region') region?: string,
    @Query('featured') featured?: boolean,
  ): Promise<Language[]> {
    if (featured) {
      return this.languagesService.getFeaturedLanguages();
    }
    if (region) {
      return this.languagesService.getLanguagesByRegion(region);
    }
    return this.languagesService.getActiveLanguages();
  }

  @Get('african')
  @ApiOperation({ summary: 'Récupérer les langues africaines prioritaires' })
  @ApiResponse({
    status: 200,
    description: 'Langues africaines récupérées avec succès',
    type: [Language],
  })
  async getAfricanLanguages(): Promise<Language[]> {
    return this.languagesService.getAfricanLanguages();
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Récupérer les langues populaires (avec le plus de mots)',
  })
  @ApiResponse({
    status: 200,
    description: 'Langues populaires récupérées avec succès',
    type: [Language],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre de langues à récupérer',
    example: 10,
  })
  async getPopularLanguages(
    @Query('limit') limit?: string,
  ): Promise<Language[]> {
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.languagesService.getPopularLanguages(limitNumber);
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des langues' })
  @ApiResponse({
    status: 200,
    description: 'Résultats de recherche',
    type: [Language],
  })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Terme de recherche',
    example: 'fang',
  })
  async searchLanguages(@Query('q') query: string): Promise<Language[]> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException(
        'La recherche doit contenir au moins 2 caractères',
      );
    }
    return this.languagesService.searchLanguages(query.trim());
  }

  @Get('stats')
  @ApiOperation({ summary: 'Récupérer les statistiques des langues' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
  })
  async getLanguageStats(): Promise<any> {
    return this.languagesService.getLanguageStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une langue par son ID' })
  @ApiResponse({
    status: 200,
    description: 'Langue récupérée avec succès',
    type: Language,
  })
  @ApiResponse({ status: 404, description: 'Langue non trouvée' })
  @ApiParam({
    name: 'id',
    description: 'ID de la langue',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  async getLanguageById(@Param('id') id: string): Promise<Language> {
    return this.languagesService.getLanguageById(id);
  }

  // ===== ENDPOINTS UTILISATEURS AUTHENTIFIÉS =====

  @Post('propose')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('contributor', 'admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proposer une nouvelle langue (contributeur+)' })
  @ApiResponse({
    status: 201,
    description: 'Langue proposée avec succès',
    type: Language,
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes (contributeur requis)',
  })
  async proposeLanguage(
    @Body() createLanguageDto: CreateLanguageDto,
    @Request() req: RequestWithUser,
  ): Promise<Language> {
    try {
      console.log('📥 Received DTO:', createLanguageDto);
      console.log('👤 User:', req.user);

      const result = await this.languagesService.proposeLanguage(
        createLanguageDto,
        req.user,
      );

      console.log('📤 Returning result:', {
        id: (result as any)._id,
        name: result.name,
        systemStatus: result.systemStatus,
      });

      return result;
    } catch (error) {
      console.error('❌ Error in proposeLanguage controller:', error);
      throw error;
    }
  }

  // ===== ENDPOINTS ADMINISTRATEURS =====

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Récupérer les langues en attente d'approbation (admin)",
  })
  @ApiResponse({
    status: 200,
    description: 'Langues en attente récupérées avec succès',
    type: [Language],
  })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  async getPendingLanguages(
    @Request() req: RequestWithUser,
  ): Promise<Language[]> {
    return this.languagesService.getPendingLanguages(req.user);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approuver une langue proposée (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Langue approuvée avec succès',
    type: Language,
  })
  @ApiResponse({
    status: 400,
    description: "Langue non éligible à l'approbation",
  })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  @ApiResponse({ status: 404, description: 'Langue non trouvée' })
  async approveLanguage(
    @Param('id') id: string,
    @Body() approveDto: ApproveLanguageDto,
    @Request() req: RequestWithUser,
  ): Promise<Language> {
    return this.languagesService.approveLanguage(id, approveDto, req.user);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rejeter une langue proposée (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Langue rejetée avec succès',
    type: Language,
  })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  @ApiResponse({ status: 404, description: 'Langue non trouvée' })
  async rejectLanguage(
    @Param('id') id: string,
    @Body() rejectDto: RejectLanguageDto,
    @Request() req: RequestWithUser,
  ): Promise<Language> {
    return this.languagesService.rejectLanguage(id, rejectDto, req.user);
  }

  // ===== ENDPOINTS DE MIGRATION (SUPERADMIN UNIQUEMENT) =====

  @Post('migration/seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seeder les langues africaines (superadmin)' })
  @ApiResponse({
    status: 200,
    description: 'Seeding terminé avec succès',
  })
  async seedAfricanLanguages(): Promise<{ message: string }> {
    await this.migrationService.seedAfricanLanguages();
    return { message: 'Seeding des langues africaines terminé avec succès' };
  }

  @Post('migration/migrate-words')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Migrer les mots vers les IDs de langue (superadmin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration des mots terminée avec succès',
  })
  async migrateWords(): Promise<{ message: string }> {
    await this.migrationService.migrateWordsToLanguageIds();
    return { message: 'Migration des mots terminée avec succès' };
  }

  @Post('migration/migrate-users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Migrer les utilisateurs vers les IDs de langue (superadmin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Migration des utilisateurs terminée avec succès',
  })
  async migrateUsers(): Promise<{ message: string }> {
    await this.migrationService.migrateUsersToLanguageIds();
    return { message: 'Migration des utilisateurs terminée avec succès' };
  }

  @Post('migration/update-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mettre à jour les statistiques des langues (superadmin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Mise à jour des statistiques terminée avec succès',
  })
  async updateLanguageStats(): Promise<{ message: string }> {
    await this.migrationService.updateLanguageStatistics();
    return { message: 'Mise à jour des statistiques terminée avec succès' };
  }

  @Post('migration/full')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Migration complète (superadmin)' })
  @ApiResponse({
    status: 200,
    description: 'Migration complète terminée avec succès',
  })
  async runFullMigration(): Promise<{ message: string; report: any }> {
    await this.migrationService.runFullMigration();
    const report = await this.migrationService.getMigrationReport();
    return {
      message: 'Migration complète terminée avec succès',
      report,
    };
  }

  @Get('migration/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rapport de migration (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Rapport de migration récupéré avec succès',
  })
  async getMigrationReport(): Promise<any> {
    return this.migrationService.getMigrationReport();
  }

  @Delete('migration/cleanup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Nettoyer les anciens champs de langue (superadmin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Nettoyage terminé avec succès',
  })
  async cleanupOldLanguageFields(): Promise<{ message: string }> {
    await this.migrationService.cleanupOldLanguageFields();
    return { message: 'Nettoyage des anciens champs terminé avec succès' };
  }
}
