import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Request as NestRequest,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { WordsService } from '../services/words.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';

interface RequestWithUser extends Request {
  user: User;
}

/**
 * Contrôleur spécialisé pour la gestion des traductions de mots
 * PHASE 3-1: Extraction du WordsController god class (1138 lignes)
 * Responsabilité: Traductions multilingues, équivalences, liens entre langues
 */
@ApiTags('words-translations')
@Controller('words-translations')
export class WordsTranslationController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * Récupérer toutes les traductions d'un mot
   */
  @Get(':id/all')
  @ApiOperation({ 
    summary: 'Récupérer toutes les traductions d\'un mot' 
  })
  @ApiResponse({
    status: 200,
    description: 'Traductions récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        wordId: { type: 'string' },
        sourceWord: { type: 'string' },
        sourceLanguage: { type: 'string' },
        translations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              word: { type: 'string' },
              language: { type: 'string' },
              languageName: { type: 'string' },
              meanings: { type: 'array' },
              confidence: { type: 'number' },
              verified: { type: 'boolean' },
              createdBy: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' }
            }
          }
        },
        availableLanguages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              name: { type: 'string' },
              hasTranslation: { type: 'boolean' }
            }
          }
        },
        statistics: {
          type: 'object',
          properties: {
            totalTranslations: { type: 'number' },
            verifiedTranslations: { type: 'number' },
            completionRate: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot source',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiQuery({ 
    name: 'includeUnverified', 
    required: false, 
    description: 'Inclure les traductions non vérifiées',
    example: false
  })
  @ApiQuery({ 
    name: 'targetLanguages', 
    required: false, 
    description: 'Filtrer par langues cibles (séparées par des virgules)',
    example: 'en,es,de'
  })
  @UseGuards(OptionalJwtAuthGuard)
  async getAllTranslations(
    @Param('id') id: string,
    @Query('includeUnverified') includeUnverified = false,
    @Query('targetLanguages') targetLanguages?: string,
    @NestRequest() req?: RequestWithUser,
  ): Promise<{
    wordId: string;
    sourceWord: string;
    sourceLanguage: string;
    translations: Array<{
      id: string;
      word: string;
      language: string;
      languageName: string;
      meanings: any[];
      confidence: number;
      verified: boolean;
      createdBy: string;
      createdAt: Date;
    }>;
    availableLanguages: Array<{
      code: string;
      name: string;
      hasTranslation: boolean;
    }>;
    statistics: {
      totalTranslations: number;
      verifiedTranslations: number;
      completionRate: number;
    };
  }> {    console.log('ID du mot:', id);
    console.log('Paramètres:', { includeUnverified, targetLanguages });
    console.log('Utilisateur:', req?.user?.username || 'Anonyme');

    // Parse des langues cibles
    const targetLanguageList = targetLanguages
      ? targetLanguages.split(',').map(lang => lang.trim()).filter(Boolean)
      : undefined;

    const result = await this.wordsService.getAllTranslations(id, {
      includeUnverified,
      targetLanguages: targetLanguageList,
      userId: req?.user?._id?.toString(),
    });
    
    console.log(`Traductions récupérées pour "${result.sourceWord}" (${result.sourceLanguage}):`);
    console.log(`${result.statistics.totalTranslations} traductions, ${result.statistics.verifiedTranslations} vérifiées`);
    
    return result;
  }

  /**
   * Ajouter une nouvelle traduction pour un mot
   */
  @Post(':id/add')
  @ApiOperation({ 
    summary: 'Ajouter une nouvelle traduction pour un mot' 
  })
  @ApiResponse({
    status: 201,
    description: 'Traduction ajoutée avec succès',
    schema: {
      type: 'object',
      properties: {
        translationId: { type: 'string' },
        sourceWordId: { type: 'string' },
        targetWord: { type: 'string' },
        targetLanguage: { type: 'string' },
        status: { type: 'string', example: 'pending' },
        message: { type: 'string', example: 'Traduction ajoutée avec succès' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot source non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot source',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({
    description: 'Données de la traduction',
    schema: {
      type: 'object',
      properties: {
        targetWord: {
          type: 'string',
          description: 'Mot traduit',
          example: 'hello'
        },
        targetLanguage: {
          type: 'string',
          description: 'Code de la langue cible',
          example: 'en'
        },
        meanings: {
          type: 'array',
          description: 'Significations du mot traduit',
          items: {
            type: 'object',
            properties: {
              definition: { type: 'string' },
              example: { type: 'string' },
              partOfSpeech: { type: 'string' }
            }
          }
        },
        confidence: {
          type: 'number',
          description: 'Niveau de confiance de la traduction (0-100)',
          example: 85
        },
        notes: {
          type: 'string',
          description: 'Notes sur la traduction',
          example: 'Traduction courante, utilisée dans les salutations'
        }
      },
      required: ['targetWord', 'targetLanguage', 'meanings']
    }
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addTranslation(
    @Param('id') id: string,
    @Body() translationData: {
      targetWord: string;
      targetLanguage: string;
      meanings: Array<{
        definition: string;
        example?: string;
        partOfSpeech?: string;
      }>;
      confidence?: number;
      notes?: string;
    },
    @NestRequest() req: RequestWithUser,
  ): Promise<{
    translationId: string;
    sourceWordId: string;
    targetWord: string;
    targetLanguage: string;
    status: string;
    message: string;
  }> {    console.log('ID du mot source:', id);
    console.log('Traduction:', translationData.targetWord, '(' + translationData.targetLanguage + ')');
    console.log('Significations:', translationData.meanings.length);
    console.log('Utilisateur:', req.user?.username);

    const result = await this.wordsService.addTranslation(
      id,
      translationData,
      req.user
    );
    
    console.log(`Traduction ajoutée: ${result.targetWord} (${result.targetLanguage})`);
    console.log(`Statut: ${result.status}`);
    
    return result;
  }

  /**
   * Supprimer une traduction spécifique
   */
  @Delete(':id/translations/:translationId')
  @ApiOperation({ 
    summary: 'Supprimer une traduction spécifique' 
  })
  @ApiResponse({
    status: 200,
    description: 'Traduction supprimée avec succès',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Traduction supprimée avec succès' },
        deletedTranslationId: { type: 'string' },
        sourceWordId: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  @ApiResponse({ status: 404, description: 'Mot ou traduction non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot source',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiParam({
    name: 'translationId',
    description: 'ID de la traduction à supprimer',
    example: '60a1b2c3d4e5f6a7b8c9d0e2',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeTranslation(
    @Param('id') id: string,
    @Param('translationId') translationId: string,
    @NestRequest() req: RequestWithUser,
  ): Promise<{
    message: string;
    deletedTranslationId: string;
    sourceWordId: string;
  }> {    console.log('ID du mot source:', id);
    console.log('ID de la traduction:', translationId);
    console.log('Utilisateur:', req.user?.username);

    await this.wordsService.removeTranslation(id, translationId, req.user);
    
    console.log(`Traduction ${translationId} supprimée avec succès`);
    
    return {
      message: 'Traduction supprimée avec succès',
      deletedTranslationId: translationId,
      sourceWordId: id
    };
  }

  /**
   * Vérifier/valider une traduction
   */
  @Post(':id/translations/:translationId/verify')
  @ApiOperation({ 
    summary: 'Vérifier/valider une traduction' 
  })
  @ApiResponse({
    status: 200,
    description: 'Traduction vérifiée avec succès',
    schema: {
      type: 'object',
      properties: {
        translationId: { type: 'string' },
        verified: { type: 'boolean' },
        verifiedBy: { type: 'string' },
        verifiedAt: { type: 'string', format: 'date-time' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes - Rôle contributeur ou admin requis' })
  @ApiResponse({ status: 404, description: 'Traduction non trouvée' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot source',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiParam({
    name: 'translationId',
    description: 'ID de la traduction à vérifier',
    example: '60a1b2c3d4e5f6a7b8c9d0e2',
  })
  @ApiBody({
    description: 'Commentaire de vérification (optionnel)',
    schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: 'Commentaire sur la vérification',
          example: 'Traduction vérifiée, équivalence correcte'
        }
      }
    },
    required: false
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async verifyTranslation(
    @Param('id') id: string,
    @Param('translationId') translationId: string,
    @Body() verificationData?: { comment?: string },
    @NestRequest() req?: RequestWithUser,
  ): Promise<{
    translationId: string;
    verified: boolean;
    verifiedBy: string;
    verifiedAt: Date;
    message: string;
  }> {    console.log('ID du mot source:', id);
    console.log('ID de la traduction:', translationId);
    console.log('Commentaire:', verificationData?.comment);
    console.log('Vérificateur:', req?.user?.username);

    const result = await this.wordsService.verifyTranslation(
      id,
      translationId,
      req?.user,
      verificationData?.comment
    );
    
    console.log(`Traduction ${translationId} vérifiée par ${result.verifiedBy}`);
    
    return result;
  }

  /**
   * Rechercher des traductions dans plusieurs langues
   */
  @Get('search')
  @ApiOperation({ 
    summary: 'Rechercher des traductions dans plusieurs langues' 
  })
  @ApiResponse({
    status: 200,
    description: 'Recherche de traductions effectuée avec succès',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceWord: { type: 'string' },
              sourceLanguage: { type: 'string' },
              translations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    word: { type: 'string' },
                    language: { type: 'string' },
                    confidence: { type: 'number' },
                    verified: { type: 'boolean' }
                  }
                }
              },
              relevanceScore: { type: 'number' }
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  @ApiQuery({ 
    name: 'q', 
    required: true, 
    description: 'Terme de recherche',
    example: 'hello'
  })
  @ApiQuery({ 
    name: 'sourceLanguage', 
    required: false, 
    description: 'Langue source',
    example: 'en'
  })
  @ApiQuery({ 
    name: 'targetLanguage', 
    required: false, 
    description: 'Langue cible',
    example: 'fr'
  })
  @ApiQuery({ 
    name: 'verified', 
    required: false, 
    description: 'Inclure seulement les traductions vérifiées',
    example: true
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: 'Numéro de page',
    example: 1
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: 'Nombre de résultats par page',
    example: 10
  })
  @UseGuards(OptionalJwtAuthGuard)
  async searchTranslations(
    @Query('q') query: string,
    @Query('sourceLanguage') sourceLanguage?: string,
    @Query('targetLanguage') targetLanguage?: string,
    @Query('verified') verified?: boolean,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @NestRequest() req?: RequestWithUser,
  ): Promise<{
    query: string;
    results: Array<{
      sourceWord: string;
      sourceLanguage: string;
      translations: Array<{
        word: string;
        language: string;
        confidence: number;
        verified: boolean;
      }>;
      relevanceScore: number;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {    console.log('Requête:', query);
    console.log('Paramètres:', { sourceLanguage, targetLanguage, verified, page, limit });
    console.log('Utilisateur:', req?.user?.username || 'Anonyme');

    if (!query?.trim()) {
      throw new Error('Le paramètre "q" est requis pour la recherche');
    }

    // Validation des paramètres
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(50, Math.max(1, Math.floor(limit) || 10));

    const result = await this.wordsService.searchTranslations({
      query: query.trim(),
      sourceLanguage: sourceLanguage?.trim(),
      targetLanguage: targetLanguage?.trim(),
      verified,
      page: validatedPage,
      limit: validatedLimit,
      userId: req?.user?._id?.toString(),
    });
    
    console.log(`Recherche de traductions: ${result.total} résultats pour "${query}"`);
    
    return result;
  }

  /**
   * Obtenir les statistiques des traductions
   */
  @Get('statistics')
  @ApiOperation({ 
    summary: 'Obtenir les statistiques des traductions' 
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des traductions récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        totalTranslations: { type: 'number' },
        verifiedTranslations: { type: 'number' },
        byLanguagePair: {
          type: 'object',
          additionalProperties: { type: 'number' }
        },
        topContributors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              translationCount: { type: 'number' },
              verificationCount: { type: 'number' }
            }
          }
        },
        qualityMetrics: {
          type: 'object',
          properties: {
            averageConfidence: { type: 'number' },
            verificationRate: { type: 'number' },
            completionRate: { type: 'number' }
          }
        },
        recentActivity: {
          type: 'object',
          properties: {
            today: { type: 'number' },
            thisWeek: { type: 'number' },
            thisMonth: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    description: 'Période d\'analyse (week, month, year)',
    example: 'month'
  })
  @UseGuards(OptionalJwtAuthGuard)
  async getTranslationStatistics(
    @Query('period') period = 'month',
    @NestRequest() req?: RequestWithUser,
  ): Promise<{
    totalTranslations: number;
    verifiedTranslations: number;
    byLanguagePair: Record<string, number>;
    topContributors: Array<{
      username: string;
      translationCount: number;
      verificationCount: number;
    }>;
    qualityMetrics: {
      averageConfidence: number;
      verificationRate: number;
      completionRate: number;
    };
    recentActivity: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  }> {    console.log('Période:', period);
    console.log('Utilisateur:', req?.user?.username || 'Anonyme');

    // Validation de la période
    const validPeriods = ['week', 'month', 'year'];
    const validatedPeriod = validPeriods.includes(period) ? period : 'month';

    const result = await this.wordsService.getTranslationStatistics({
      period: validatedPeriod,
      userId: req?.user?._id?.toString(),
    });
    
    console.log(`Statistiques de traductions pour la période: ${validatedPeriod}`);
    console.log(`${result.totalTranslations} traductions, ${result.verifiedTranslations} vérifiées`);
    console.log(`Taux de vérification: ${result.qualityMetrics.verificationRate}%`);
    
    return result;
  }
}