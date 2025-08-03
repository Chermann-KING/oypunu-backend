/**
 * @fileoverview Contrôleur REST pour les recommandations intelligentes O'Ypunu
 * 
 * Ce contrôleur gère tous les endpoints de recommandations personnalisées
 * avec algorithmes d'apprentissage automatique, feedback utilisateur,
 * et analytics comportementaux pour optimiser l'expérience d'apprentissage.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { RecommendationsService } from '../services/recommendations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

// DTOs
import {
  GetRecommendationsDto,
  RecommendationFeedbackDto,
  TrendingRecommendationsDto,
  LinguisticRecommendationsDto,
} from '../dto/recommendation-request.dto';
import {
  RecommendationsResponseDto,
  RecommendationExplanationDto,
  FeedbackResponseDto,
} from '../dto/recommendation-response.dto';

/**
 * Contrôleur REST pour les recommandations intelligentes O'Ypunu
 * 
 * Orchestre un système de recommandations sophistiqué avec multiple
 * algorithmes d'IA, feedback utilisateur et analytics comportementaux
 * pour personnaliser l'expérience d'apprentissage linguistique.
 * 
 * ## 🎯 Types de recommandations :
 * 
 * ### 🧠 Recommandations personnelles
 * - Basées sur l'historique et comportement utilisateur
 * - Algorithmes d'apprentissage adaptatifs
 * - Cache intelligent pour performances optimales
 * 
 * ### 📈 Recommandations tendance
 * - Mots populaires dans la communauté
 * - Filtrage par région géographique
 * - Analyse temporelle des tendances
 * 
 * ### 🗣️ Recommandations linguistiques
 * - Adaptées au niveau d'apprentissage
 * - Progression pédagogique intelligente
 * - Support multilingue complet
 * 
 * ### 🔄 Feedback et amélioration
 * - Système de feedback utilisateur
 * - Explications détaillées des recommandations
 * - Statistiques d'interaction et performance
 * 
 * @class RecommendationsController
 * @version 1.0.0
 */
@ApiTags('Recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /**
   * Obtenir des recommandations personnalisées pour l'utilisateur connecté
   */
  @Get('personal')
  @ApiOperation({
    summary: 'Obtenir des recommandations personnalisées',
    description:
      "Génère des recommandations intelligentes basées sur l'historique et les préférences de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'Recommandations générées avec succès',
    type: RecommendationsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de recommandations (1-20)',
    example: 5,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['personal', 'trending', 'linguistic', 'semantic', 'mixed'],
    description: 'Type de recommandations',
    example: 'mixed',
  })
  @ApiQuery({
    name: 'languages',
    required: false,
    type: [String],
    description: 'Langues spécifiques (codes)',
    example: ['fr', 'en'],
  })
  @ApiQuery({
    name: 'categories',
    required: false,
    type: [String],
    description: 'Catégories spécifiques',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: Boolean,
    description: 'Forcer la régénération du cache',
    example: false,
  })
  async getPersonalRecommendations(
    @Request() req: { user: { _id: string } },
    @Query() dto: GetRecommendationsDto,
  ): Promise<RecommendationsResponseDto> {
    return this.recommendationsService.getPersonalRecommendations(
      req.user._id,
      dto,
    );
  }

  /**
   * Obtenir des recommandations tendance
   */
  @Get('trending')
  @ApiOperation({
    summary: 'Obtenir des mots en tendance',
    description:
      'Récupère les mots populaires dans la communauté selon différents critères',
  })
  @ApiResponse({
    status: 200,
    description: 'Tendances récupérées avec succès',
    type: RecommendationsResponseDto,
  })
  @ApiQuery({
    name: 'region',
    required: false,
    type: String,
    description: 'Région géographique (africa, europe, etc.)',
    example: 'africa',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de mots tendance (1-10)',
    example: 5,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['24h', '7d', '30d'],
    description: 'Période pour analyser les tendances',
    example: '7d',
  })
  async getTrendingRecommendations(
    @Query() dto: TrendingRecommendationsDto,
  ): Promise<RecommendationsResponseDto> {
    return this.recommendationsService.getTrendingRecommendations(dto);
  }

  /**
   * Obtenir des recommandations linguistiques pour une langue spécifique
   */
  @Get('linguistic/:language')
  @ApiOperation({
    summary: 'Recommandations linguistiques',
    description:
      "Génère des recommandations adaptées à l'apprentissage d'une langue spécifique",
  })
  @ApiResponse({
    status: 200,
    description: 'Recommandations linguistiques générées',
    type: RecommendationsResponseDto,
  })
  @ApiParam({
    name: 'language',
    description: 'Code de langue (ex: fr, en, sw)',
    example: 'fr',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    type: Number,
    description: 'Niveau de difficulté (1-5)',
    example: 3,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de recommandations (1-15)',
    example: 5,
  })
  async getLinguisticRecommendations(
    @Param('language') language: string,
    @Query() query: Omit<LinguisticRecommendationsDto, 'language'>,
  ): Promise<RecommendationsResponseDto> {
    const dto: LinguisticRecommendationsDto = {
      language,
      ...query,
    };
    return this.recommendationsService.getLinguisticRecommendations(dto);
  }

  /**
   * Enregistrer un feedback sur une recommandation
   */
  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enregistrer un feedback',
    description:
      "Permet à l'utilisateur de donner son avis sur une recommandation pour améliorer les futures suggestions",
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback enregistré avec succès',
    type: FeedbackResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async recordFeedback(
    @Request() req: { user: { _id: string } },
    @Body() dto: RecommendationFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    return this.recommendationsService.recordFeedback(req.user._id, dto);
  }

  /**
   * Obtenir une explication détaillée d'une recommandation
   */
  @Get('explain/:wordId')
  @ApiOperation({
    summary: 'Expliquer une recommandation',
    description:
      "Fournit une explication détaillée des raisons d'une recommandation spécifique",
  })
  @ApiResponse({
    status: 200,
    description: 'Explication générée avec succès',
    type: RecommendationExplanationDto,
  })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'wordId',
    description: 'ID du mot recommandé',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  async explainRecommendation(
    @Request() req: { user: { _id: string } },
    @Param('wordId') wordId: string,
  ): Promise<RecommendationExplanationDto> {
    // Cette méthode serait implémentée pour fournir des explications détaillées
    // Pour l'instant, on retourne une structure basique
    return {
      wordId,
      score: 0.85,
      factors: {
        behavioral: {
          score: 0.7,
          details: [
            'Basé sur vos consultations récentes de mots similaires',
            "Catégorie d'intérêt identifiée",
          ],
        },
        semantic: {
          score: 0.6,
          details: [
            'Mots-clés en commun avec vos favoris',
            'Concepts sémantiquement liés',
          ],
        },
        community: {
          score: 0.4,
          details: ['Populaire dans votre région', 'Tendance cette semaine'],
        },
        linguistic: {
          score: 0.3,
          details: ['Adapté à votre niveau', "Langue d'apprentissage"],
        },
      },
      relatedWords: [],
      alternatives: [],
    };
  }

  /**
   * Obtenir les statistiques des recommandations de l'utilisateur
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Statistiques des recommandations',
    description:
      "Récupère les statistiques d'interaction avec les recommandations",
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
  })
  async getRecommendationStats(
    @Request() req: { user: { _id: string } },
  ): Promise<any> {
    // Cette méthode fournirait des statistiques détaillées
    // sur l'interaction de l'utilisateur avec les recommandations
    return {
      totalRecommendationsSeen: 0,
      totalClicked: 0,
      totalFavorited: 0,
      clickThroughRate: 0,
      favoriteRate: 0,
      topCategories: [],
      topLanguages: [],
      learningProgress: {},
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mettre à jour les préférences de recommandations
   */
  @Post('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre à jour les préférences',
    description: 'Permet de personnaliser les algorithmes de recommandations',
  })
  @ApiResponse({
    status: 200,
    description: 'Préférences mises à jour avec succès',
  })
  async updatePreferences(
    @Request() req: { user: { _id: string } },
    @Body()
    preferences: {
      algorithmWeights?: {
        behavioral?: number;
        semantic?: number;
        community?: number;
        linguistic?: number;
      };
      preferredCategories?: string[];
      languageProficiency?: Record<string, number>;
    },
  ): Promise<{ success: boolean; message: string }> {
    // Cette méthode permettrait aux utilisateurs de personnaliser
    // les poids des algorithmes et leurs préférences
    return {
      success: true,
      message: 'Préférences mises à jour avec succès',
    };
  }

  /**
   * Obtenir des recommandations pour la découverte de nouvelles langues
   */
  @Get('discover-languages')
  @ApiOperation({
    summary: 'Découvrir de nouvelles langues',
    description:
      'Recommande des langues intéressantes à explorer basées sur le profil utilisateur',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommandations de langues générées',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de langues à recommander',
    example: 3,
  })
  async discoverLanguages(
    @Request() req: { user: { _id: string } },
    @Query('limit') limit: number = 3,
  ): Promise<any> {
    // Cette méthode recommanderait de nouvelles langues à explorer
    // basées sur les intérêts et l'activité de l'utilisateur
    return {
      recommendations: [],
      count: 0,
      reasons: [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Obtenir des recommandations contextuelles (basées sur l'heure, localisation, etc.)
   */
  @Get('contextual')
  @ApiOperation({
    summary: 'Recommandations contextuelles',
    description:
      'Génère des recommandations adaptées au contexte actuel (heure, jour, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommandations contextuelles générées',
    type: RecommendationsResponseDto,
  })
  async getContextualRecommendations(
    @Request() req: { user: { _id: string } },
    @Query() dto: GetRecommendationsDto,
  ): Promise<RecommendationsResponseDto> {
    // Cette méthode générerait des recommandations basées sur :
    // - L'heure de la journée
    // - Le jour de la semaine
    // - L'historique d'activité à cette période
    // - Les patterns comportementaux

    // Pour l'instant, déléguer aux recommandations personnalisées
    return this.recommendationsService.getPersonalRecommendations(
      req.user._id,
      dto,
    );
  }
}
