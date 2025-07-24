import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
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
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { SearchService } from '../services/search.service';
import { WordsService } from '../../dictionary/services/words.service';

interface RequestWithUser {
  user?: {
    _id: string;
    username: string;
  };
}

// DTOs
class SaveSearchDto {
  query: string;
  filters?: {
    language?: string;
    category?: string;
    partOfSpeech?: string;
  };
  name?: string;
}

class SearchSuggestionsQuery {
  q: string;
  language?: string;
  limit?: number;
}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly wordsService: WordsService,
  ) {}

  @Get('suggestions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Obtenir des suggestions de recherche en temps réel' })
  @ApiQuery({
    name: 'q',
    description: 'Terme de recherche partiel',
    example: 'bon',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Filtrer par langue',
    example: 'fr',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de suggestions maximum',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Suggestions de recherche récupérées',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              type: { type: 'string', enum: ['word', 'category', 'recent', 'popular'] },
              language: { type: 'string' },
              frequency: { type: 'number' },
              metadata: {
                type: 'object',
                properties: {
                  wordId: { type: 'string' },
                  category: { type: 'string' },
                  partOfSpeech: { type: 'string' },
                },
              },
            },
          },
        },
        query: { type: 'string' },
        hasMore: { type: 'boolean' },
      },
    },
  })
  async getSuggestions(
    @Query() query: SearchSuggestionsQuery,
    @Request() req?: RequestWithUser,
  ) {
    const userId = req?.user?._id;
    return this.searchService.getSuggestions(
      query.q,
      {
        language: query.language,
        limit: query.limit || 10,
        userId,
      }
    );
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer l\'historique de recherche de l\'utilisateur' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'entrées à récupérer',
    example: 20,
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Filtrer par langue',
  })
  @ApiResponse({
    status: 200,
    description: 'Historique de recherche récupéré',
    schema: {
      type: 'object',
      properties: {
        history: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              query: { type: 'string' },
              filters: { type: 'object' },
              searchedAt: { type: 'string', format: 'date-time' },
              resultsCount: { type: 'number' },
              clickedResults: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  async getSearchHistory(
    @Request() req: RequestWithUser,
    @Query('limit') limit: number = 20,
    @Query('language') language?: string,
  ) {
    return this.searchService.getSearchHistory(req.user!._id, {
      limit: +limit,
      language,
    });
  }

  @Post('save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sauvegarder une recherche' })
  @ApiBody({ type: SaveSearchDto })
  @ApiResponse({
    status: 201,
    description: 'Recherche sauvegardée avec succès',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        query: { type: 'string' },
        filters: { type: 'object' },
        savedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async saveSearch(
    @Body() saveSearchDto: SaveSearchDto,
    @Request() req: RequestWithUser,
  ) {
    return this.searchService.saveSearch(
      req.user!._id,
      saveSearchDto.query,
      saveSearchDto.filters,
      saveSearchDto.name,
    );
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les recherches sauvegardées' })
  @ApiResponse({
    status: 200,
    description: 'Recherches sauvegardées récupérées',
    schema: {
      type: 'object',
      properties: {
        savedSearches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              query: { type: 'string' },
              filters: { type: 'object' },
              savedAt: { type: 'string', format: 'date-time' },
              lastUsed: { type: 'string', format: 'date-time' },
              useCount: { type: 'number' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  async getSavedSearches(@Request() req: RequestWithUser) {
    return this.searchService.getSavedSearches(req.user!._id);
  }

  @Delete('history/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une entrée de l\'historique' })
  @ApiParam({
    name: 'id',
    description: 'ID de l\'entrée d\'historique',
  })
  @ApiResponse({
    status: 200,
    description: 'Entrée supprimée avec succès',
  })
  async deleteHistoryEntry(
    @Param('id') historyId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.searchService.deleteHistoryEntry(req.user!._id, historyId);
  }

  @Delete('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vider tout l\'historique de recherche' })
  @ApiResponse({
    status: 200,
    description: 'Historique vidé avec succès',
  })
  async clearSearchHistory(@Request() req: RequestWithUser) {
    return this.searchService.clearSearchHistory(req.user!._id);
  }

  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une recherche sauvegardée' })
  @ApiParam({
    name: 'id',
    description: 'ID de la recherche sauvegardée',
  })
  @ApiResponse({
    status: 200,
    description: 'Recherche supprimée avec succès',
  })
  async deleteSavedSearch(
    @Param('id') savedSearchId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.searchService.deleteSavedSearch(req.user!._id, savedSearchId);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Récupérer les recherches tendances' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['hour', 'day', 'week', 'month'],
    description: 'Période d\'analyse',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Filtrer par langue',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de tendances à récupérer',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Recherches tendances récupérées',
    schema: {
      type: 'object',
      properties: {
        trending: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              searchCount: { type: 'number' },
              uniqueUsers: { type: 'number' },
              growth: { type: 'number' },
              category: { type: 'string' },
              language: { type: 'string' },
            },
          },
        },
        timeframe: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getTrendingSearches(
    @Query('timeframe') timeframe: 'hour' | 'day' | 'week' | 'month' = 'day',
    @Query('language') language?: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.searchService.getTrendingSearches({
      timeframe,
      language,
      limit: +limit,
    });
  }

  @Post('track')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Enregistrer une recherche pour analytics' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filters: { type: 'object' },
        resultsCount: { type: 'number' },
        clickedResults: {
          type: 'array',
          items: { type: 'string' },
        },
        searchDuration: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Recherche enregistrée pour analytics',
  })
  async trackSearch(
    @Body() trackData: {
      query: string;
      filters?: any;
      resultsCount: number;
      clickedResults?: string[];
      searchDuration?: number;
    },
    @Request() req?: RequestWithUser,
  ) {
    return this.searchService.trackSearch(
      trackData.query,
      trackData.resultsCount,
      req?.user?._id,
      trackData.filters,
      trackData.clickedResults,
      trackData.searchDuration,
    );
  }

  @Get('popular-terms')
  @ApiOperation({ summary: 'Récupérer les termes de recherche populaires' })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Filtrer par langue',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filtrer par catégorie',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de termes à récupérer',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Termes populaires récupérés',
    schema: {
      type: 'object',
      properties: {
        popularTerms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              frequency: { type: 'number' },
              language: { type: 'string' },
              category: { type: 'string' },
              trending: { type: 'boolean' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  async getPopularTerms(
    @Query('language') language?: string,
    @Query('category') category?: string,
    @Query('limit') limit: number = 20,
  ) {
    return this.searchService.getPopularTerms({
      language,
      category,
      limit: +limit,
    });
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analytics de recherche personnalisées' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['week', 'month', 'quarter', 'year'],
    description: 'Période d\'analyse',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics de recherche récupérées',
    schema: {
      type: 'object',
      properties: {
        searchStats: {
          type: 'object',
          properties: {
            totalSearches: { type: 'number' },
            uniqueQueries: { type: 'number' },
            averageResultsPerSearch: { type: 'number' },
            mostSearchedTerms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  term: { type: 'string' },
                  count: { type: 'number' },
                },
              },
            },
          },
        },
        languageDistribution: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              percentage: { type: 'number' },
              searchCount: { type: 'number' },
            },
          },
        },
        searchPatterns: {
          type: 'object',
          properties: {
            peakHours: { type: 'array', items: { type: 'number' } },
            averageSessionLength: { type: 'number' },
            bounceRate: { type: 'number' },
          },
        },
      },
    },
  })
  async getSearchAnalytics(
    @Request() req: RequestWithUser,
    @Query('timeframe') timeframe: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    return this.searchService.getSearchAnalytics(req.user!._id, timeframe);
  }

  @Post('feedback')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Envoyer feedback sur les résultats de recherche' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        searchId: { type: 'string' },
        rating: { type: 'number', minimum: 1, maximum: 5 },
        feedback: { type: 'string' },
        relevantResults: {
          type: 'array',
          items: { type: 'string' },
        },
        irrelevantResults: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback enregistré avec succès',
  })
  async submitSearchFeedback(
    @Body() feedbackData: {
      query: string;
      searchId?: string;
      rating: number;
      feedback?: string;
      relevantResults?: string[];
      irrelevantResults?: string[];
    },
    @Request() req?: RequestWithUser,
  ) {
    return this.searchService.submitSearchFeedback(
      feedbackData.query,
      feedbackData.rating,
      req?.user?._id,
      feedbackData.searchId,
      feedbackData.feedback,
      feedbackData.relevantResults,
      feedbackData.irrelevantResults,
    );
  }
}