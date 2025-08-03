/**
 * @fileoverview Contrôleur REST pour le système de traduction intelligente O'Ypunu
 * 
 * Ce contrôleur gère toutes les opérations de traduction avec intelligence
 * artificielle, détection automatique de doublons, validation communautaire
 * et système d'apprentissage adaptatif pour optimiser la qualité.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TranslationService } from '../services/translation.service';
import { LearningService } from '../services/learning.service';
import {
  CreateTranslationDto,
  ValidateTranslationDto,
  VoteTranslationDto,
  SearchTranslationDto,
} from '../dto/create-translation.dto';
import {
  TranslationDto,
  AvailableLanguageDto,
  TranslationSuggestionDto,
  ValidationResultDto,
  LanguageStatsDto,
} from '../dto/translation-response.dto';

/**
 * Contrôleur REST pour le système de traduction intelligente O'Ypunu
 * 
 * Orchestre un système de traduction sophistiqué avec IA, validation
 * communautaire et apprentissage automatique pour garantir la qualité
 * et la cohérence des traductions multilingues.
 * 
 * ## 🧠 Fonctionnalités principales :
 * 
 * ### 🔍 Traductions intelligentes
 * - Récupération optimisée des traductions existantes
 * - Suggestions basées sur similarité sémantique
 * - Support multilingue complet avec statistiques
 * 
 * ### ✨ Création et validation
 * - Détection automatique de doublons
 * - Système de validation communautaire avec votes
 * - Fusion intelligente de traductions similaires
 * 
 * ### 📊 Administration et insights
 * - Statistiques de performance détaillées
 * - Métriques d'efficacité de l'algorithme d'apprentissage
 * - Outils de debugging et optimisation
 * 
 * ### 🎯 Apprentissage adaptatif
 * - Seuils d'auto-validation dynamiques
 * - Analyse comportementale des utilisateurs
 * - Amélioration continue des algorithmes
 * 
 * @class TranslationController
 * @version 1.0.0
 */
@ApiTags('translation')
@Controller('translation')
export class TranslationController {
  constructor(
    private readonly translationService: TranslationService,
    private readonly learningService: LearningService,
  ) {}

  @Get('languages')
  @ApiOperation({
    summary: 'Récupérer toutes les langues disponibles avec statistiques',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des langues avec statistiques',
    type: [LanguageStatsDto],
  })
  async getLanguageStats(): Promise<LanguageStatsDto[]> {
    return this.translationService.getLanguageStats();
  }

  @Get(':wordId/languages')
  @ApiOperation({
    summary: 'Récupérer les langues disponibles pour un mot spécifique',
  })
  @ApiParam({ name: 'wordId', description: 'ID du mot source' })
  @ApiResponse({
    status: 200,
    description: 'Langues disponibles pour ce mot',
    type: [AvailableLanguageDto],
  })
  async getAvailableLanguages(
    @Param('wordId') wordId: string,
  ): Promise<AvailableLanguageDto[]> {
    return this.translationService.getAvailableLanguages(wordId);
  }

  @Get(':wordId/:targetLanguage')
  @ApiOperation({
    summary: "Récupérer la traduction d'un mot vers une langue spécifique",
  })
  @ApiParam({ name: 'wordId', description: 'ID du mot source' })
  @ApiParam({
    name: 'targetLanguage',
    description: 'Code de la langue cible (ex: es, en, de)',
  })
  @ApiResponse({
    status: 200,
    description: 'Traductions disponibles',
    type: [TranslationDto],
  })
  async getTranslation(
    @Param('wordId') wordId: string,
    @Param('targetLanguage') targetLanguage: string,
  ): Promise<TranslationDto[]> {
    return this.translationService.getTranslation(wordId, targetLanguage);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('contributor', 'admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Créer une nouvelle traduction avec détection intelligente de doublons',
  })
  @ApiResponse({
    status: 201,
    description: 'Traduction créée avec succès',
    type: ValidationResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Traduction similaire détectée - confirmation requise',
  })
  async createTranslation(
    @Body() createTranslationDto: CreateTranslationDto,
    @Request() req: any,
  ): Promise<ValidationResultDto> {
    return this.translationService.createTranslation(
      createTranslationDto,
      req.user.userId,
    );
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rechercher des suggestions intelligentes pour une traduction',
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestions de traduction avec scores de similarité',
    type: [TranslationSuggestionDto],
  })
  async searchSuggestions(
    @Body() searchDto: SearchTranslationDto,
  ): Promise<TranslationSuggestionDto[]> {
    return this.translationService.searchTranslationSuggestions(searchDto);
  }

  @Put(':translationId/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('contributor', 'admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Valider une traduction proposée (fusion ou séparation)',
  })
  @ApiParam({
    name: 'translationId',
    description: 'ID de la traduction à valider',
  })
  @ApiResponse({
    status: 200,
    description: 'Traduction validée avec succès',
    type: ValidationResultDto,
  })
  async validateTranslation(
    @Param('translationId') translationId: string,
    @Body() validateDto: ValidateTranslationDto,
    @Request() req: any,
  ): Promise<ValidationResultDto> {
    return this.translationService.validateTranslation(
      translationId,
      validateDto,
      req.user.userId,
    );
  }

  @Post(':translationId/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Voter pour une traduction existante (+1 pour valider)',
  })
  @ApiParam({ name: 'translationId', description: 'ID de la traduction' })
  @ApiResponse({
    status: 200,
    description: 'Vote enregistré avec succès',
  })
  @HttpCode(HttpStatus.OK)
  async voteForTranslation(
    @Param('translationId') translationId: string,
    @Body() voteDto: VoteTranslationDto,
    @Request() req: any,
  ): Promise<{ success: boolean; newVoteCount: number }> {
    // Valider que le vote est +1 ou -1
    if (voteDto.voteValue !== 1 && voteDto.voteValue !== -1) {
      throw new BadRequestException('Le vote doit être +1 ou -1');
    }

    return this.translationService.voteForTranslation(
      translationId,
      voteDto,
      req.user.userId,
    );
  }

  // ===== ENDPOINTS D'ADMINISTRATION =====

  @Get('admin/insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Obtenir des insights sur l'efficacité de l'algorithme d'apprentissage (Admin)",
    description:
      "Statistiques avancées sur la précision des prédictions et recommandations d'amélioration",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'entrées à analyser (défaut: 1000)",
    example: 1000,
  })
  @ApiResponse({
    status: 200,
    description: "Insights détaillés sur l'apprentissage automatique",
  })
  async getLearningInsights(@Query('limit') limit?: number) {
    return this.learningService.generateLearningInsights(limit || 1000);
  }

  @Put('admin/thresholds')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Mettre à jour les seuils d'auto-validation (Admin)",
    description:
      "Ajuste automatiquement les seuils basés sur l'historique d'apprentissage",
  })
  @ApiResponse({
    status: 200,
    description: 'Seuils mis à jour avec succès',
  })
  async updateAutoValidationThresholds() {
    return this.learningService.updateAutoValidationThresholds();
  }

  @Get('admin/performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Statistiques de performance du système de traduction (Admin)',
    description:
      "Métriques détaillées sur l'usage et la qualité des traductions",
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Nombre de jours à analyser (défaut: 30)',
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de performance détaillées',
  })
  async getPerformanceStats(@Query('days') days?: number) {
    // Cette méthode peut être étendue pour fournir des statistiques détaillées
    const period = days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    return {
      period: `${period} derniers jours`,
      startDate,
      endDate: new Date(),
      metrics: {
        totalTranslations: 0, // À implémenter
        autoValidated: 0, // À implémenter
        manualValidated: 0, // À implémenter
        averageConfidence: 0, // À implémenter
        topLanguagePairs: [], // À implémenter
        userActivity: [], // À implémenter
      },
    };
  }

  // ===== ENDPOINTS POUR DÉVELOPPEMENT/DEBUG =====

  @Get('debug/similar-words')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Tester l'algorithme de similarité entre deux mots (Debug)",
    description:
      "Endpoint de développement pour tester et déboguer l'algorithme",
  })
  @ApiQuery({ name: 'word1Id', description: 'ID du premier mot' })
  @ApiQuery({ name: 'word2Id', description: 'ID du deuxième mot' })
  async debugSimilarity(
    @Query('word1Id') word1Id: string,
    @Query('word2Id') word2Id: string,
  ) {
    // Cette méthode est principalement pour le développement
    // Elle permet de tester l'algorithme de similarité
    return {
      message: 'Endpoint de debug disponible en mode développement',
      word1Id,
      word2Id,
      // L'implémentation complète serait ajoutée selon les besoins
    };
  }
}
