import {
  Controller,
  Get,
  Post,
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
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { WordSocialService } from '../services/word-social.service';

interface RequestWithUser {
  user?: {
    _id: string;
    username: string;
  };
}

// DTOs
class CommentDto {
  content: string;
  parentId?: string; // Pour les réponses aux commentaires
}

class ShareDto {
  platform: 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'telegram' | 'email';
  message?: string;
  recipients?: string[]; // Pour email ou messages privés
}

class RatingDto {
  rating: number; // 1-5 étoiles
  comment?: string;
}

class VoteDto {
  reactionType: 'like' | 'love' | 'helpful' | 'accurate' | 'clear' | 'funny' | 'insightful' | 'disagree';
  context?: 'word' | 'definition' | 'pronunciation' | 'etymology' | 'example' | 'translation';
  contextId?: string;
  comment?: string;
}

@ApiTags('word-social')
@Controller('words')
export class WordSocialController {
  constructor(private readonly wordSocialService: WordSocialService) {}

  @Get('word-of-the-day')
  @ApiOperation({ summary: 'Récupérer le mot du jour' })
  @ApiResponse({
    status: 200,
    description: 'Mot du jour récupéré',
    schema: {
      type: 'object',
      properties: {
        word: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            word: { type: 'string' },
            language: { type: 'string' },
            meanings: { type: 'array' },
            pronunciation: { type: 'string' },
            etymology: { type: 'string' },
            examples: { type: 'array' },
            audioUrl: { type: 'string' },
          },
        },
        date: { type: 'string', format: 'date' },
        stats: {
          type: 'object',
          properties: {
            views: { type: 'number' },
            likes: { type: 'number' },
            shares: { type: 'number' },
            comments: { type: 'number' },
          },
        },
        didYouKnow: { type: 'string' },
        relatedWords: { type: 'array' },
        challenge: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correctAnswer: { type: 'number' },
            explanation: { type: 'string' },
          },
        },
      },
    },
  })
  async getWordOfTheDay() {
    return this.wordSocialService.getWordOfTheDay();
  }

  @Post(':id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajouter un commentaire à un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: CommentDto })
  @ApiResponse({
    status: 201,
    description: 'Commentaire ajouté avec succès',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        content: { type: 'string' },
        authorId: { type: 'string' },
        authorName: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        likes: { type: 'number' },
        replies: { type: 'number' },
        parentId: { type: 'string' },
      },
    },
  })
  async addComment(
    @Param('id') wordId: string,
    @Body() commentDto: CommentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.addComment(
      wordId,
      commentDto.content,
      req.user!._id,
      commentDto.parentId,
    );
  }

  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer les commentaires d\'un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
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
    description: 'Nombre de commentaires par page',
    example: 20,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['newest', 'oldest', 'most_liked', 'most_replies'],
    description: 'Tri des commentaires',
  })
  @ApiResponse({
    status: 200,
    description: 'Commentaires récupérés',
    schema: {
      type: 'object',
      properties: {
        comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              author: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  profilePicture: { type: 'string' },
                  role: { type: 'string' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              likes: { type: 'number' },
              isLiked: { type: 'boolean' },
              replies: {
                type: 'array',
                items: { type: 'object' },
              },
              parentId: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        hasMore: { type: 'boolean' },
      },
    },
  })
  async getComments(
    @Param('id') wordId: string,
    @Request() req?: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('sort') sort: 'newest' | 'oldest' | 'most_liked' | 'most_replies' = 'newest',
  ) {
    return this.wordSocialService.getComments(wordId, {
      page: +page,
      limit: +limit,
      sort,
      userId: req?.user?._id,
    });
  }

  @Post(':id/share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Partager un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: ShareDto })
  @ApiResponse({
    status: 200,
    description: 'Mot partagé avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        shareUrl: { type: 'string' },
        platform: { type: 'string' },
        message: { type: 'string' },
        analytics: {
          type: 'object',
          properties: {
            shareId: { type: 'string' },
            trackingUrl: { type: 'string' },
          },
        },
      },
    },
  })
  async shareWord(
    @Param('id') wordId: string,
    @Body() shareDto: ShareDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.shareWord(
      wordId,
      shareDto.platform,
      req.user!._id,
      shareDto.message,
      shareDto.recipients,
    );
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liker un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiResponse({
    status: 200,
    description: 'Like ajouté/retiré',
    schema: {
      type: 'object',
      properties: {
        liked: { type: 'boolean' },
        totalLikes: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async toggleLike(
    @Param('id') wordId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.toggleLike(wordId, req.user!._id);
  }

  @Post(':id/rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Noter un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: RatingDto })
  @ApiResponse({
    status: 200,
    description: 'Note ajoutée',
    schema: {
      type: 'object',
      properties: {
        userRating: { type: 'number' },
        averageRating: { type: 'number' },
        totalRatings: { type: 'number' },
        ratingDistribution: {
          type: 'object',
          properties: {
            '1': { type: 'number' },
            '2': { type: 'number' },
            '3': { type: 'number' },
            '4': { type: 'number' },
            '5': { type: 'number' },
          },
        },
      },
    },
  })
  async rateWord(
    @Param('id') wordId: string,
    @Body() ratingDto: RatingDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.rateWord(
      wordId,
      req.user!._id,
      ratingDto.rating,
      ratingDto.comment,
    );
  }

  @Get(':id/social-stats')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Récupérer les statistiques sociales d\'un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques sociales récupérées',
    schema: {
      type: 'object',
      properties: {
        likes: { type: 'number' },
        shares: { type: 'number' },
        comments: { type: 'number' },
        views: { type: 'number' },
        favorites: { type: 'number' },
        averageRating: { type: 'number' },
        totalRatings: { type: 'number' },
        userInteractions: {
          type: 'object',
          properties: {
            liked: { type: 'boolean' },
            shared: { type: 'boolean' },
            commented: { type: 'boolean' },
            rated: { type: 'number' },
            favorited: { type: 'boolean' },
          },
        },
        popularityScore: { type: 'number' },
        trendingRank: { type: 'number' },
      },
    },
  })
  async getSocialStats(
    @Param('id') wordId: string,
    @Request() req?: RequestWithUser,
  ) {
    return this.wordSocialService.getSocialStats(wordId, req?.user?._id);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Récupérer les mots tendances' })
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
    description: 'Nombre de mots tendances',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Mots tendances récupérés',
    schema: {
      type: 'object',
      properties: {
        trendingWords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              word: { type: 'object' },
              trendScore: { type: 'number' },
              socialStats: { type: 'object' },
              growth: { type: 'number' },
              rank: { type: 'number' },
              reasons: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        timeframe: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getTrendingWords(
    @Query('timeframe') timeframe: 'hour' | 'day' | 'week' | 'month' = 'day',
    @Query('language') language?: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.wordSocialService.getTrendingWords({
      timeframe,
      language,
      limit: +limit,
    });
  }

  @Post('comments/:commentId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liker un commentaire' })
  @ApiParam({
    name: 'commentId',
    description: 'ID du commentaire',
  })
  @ApiResponse({
    status: 200,
    description: 'Like du commentaire ajouté/retiré',
  })
  async toggleCommentLike(
    @Param('commentId') commentId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.toggleCommentLike(commentId, req.user!._id);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  @ApiParam({
    name: 'commentId',
    description: 'ID du commentaire',
  })
  @ApiResponse({
    status: 200,
    description: 'Commentaire supprimé',
  })
  async deleteComment(
    @Param('commentId') commentId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.deleteComment(commentId, req.user!._id);
  }

  @Get(':id/usage-examples')
  @ApiOperation({ summary: 'Récupérer les exemples d\'usage d\'un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'exemples',
    example: 10,
  })
  @ApiQuery({
    name: 'context',
    required: false,
    enum: ['formal', 'informal', 'technical', 'literary', 'everyday'],
    description: 'Contexte d\'usage',
  })
  @ApiResponse({
    status: 200,
    description: 'Exemples d\'usage récupérés',
    schema: {
      type: 'object',
      properties: {
        examples: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              sentence: { type: 'string' },
              translation: { type: 'string' },
              context: { type: 'string' },
              source: { type: 'string' },
              difficulty: { type: 'string' },
              contributedBy: { type: 'string' },
              likes: { type: 'number' },
              audioUrl: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
        contexts: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getUsageExamples(
    @Param('id') wordId: string,
    @Query('limit') limit: number = 10,
    @Query('context') context?: 'formal' | 'informal' | 'technical' | 'literary' | 'everyday',
  ) {
    return this.wordSocialService.getUsageExamples(wordId, {
      limit: +limit,
      context,
    });
  }

  @Post(':id/usage-examples')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajouter un exemple d\'usage' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sentence: { type: 'string' },
        translation: { type: 'string' },
        context: { 
          type: 'string', 
          enum: ['formal', 'informal', 'technical', 'literary', 'everyday'] 
        },
        source: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Exemple d\'usage ajouté',
  })
  async addUsageExample(
    @Param('id') wordId: string,
    @Body() exampleData: {
      sentence: string;
      translation?: string;
      context: 'formal' | 'informal' | 'technical' | 'literary' | 'everyday';
      source?: string;
    },
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.addUsageExample(
      wordId,
      exampleData.sentence,
      req.user!._id,
      exampleData.context,
      exampleData.translation,
      exampleData.source,
    );
  }

  @Get(':id/related-discussions')
  @ApiOperation({ summary: 'Récupérer les discussions liées à un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de discussions',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Discussions liées récupérées',
    schema: {
      type: 'object',
      properties: {
        discussions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              excerpt: { type: 'string' },
              author: { type: 'string' },
              replies: { type: 'number' },
              lastActivity: { type: 'string', format: 'date-time' },
              tags: { type: 'array', items: { type: 'string' } },
              community: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  })
  async getRelatedDiscussions(
    @Param('id') wordId: string,
    @Query('limit') limit: number = 5,
  ) {
    return this.wordSocialService.getRelatedDiscussions(wordId, +limit);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Voter pour un mot avec réaction sophistiquée' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({ type: VoteDto })
  @ApiResponse({
    status: 200,
    description: 'Vote enregistré',
    schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['created', 'updated', 'removed'] },
        reactionType: { type: 'string' },
        previousReaction: { type: 'string' },
        totalVotes: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async voteForWord(
    @Param('id') wordId: string,
    @Body() voteDto: VoteDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wordSocialService.voteForWord(
      wordId,
      req.user!._id,
      voteDto.reactionType,
      voteDto.context,
      voteDto.contextId,
      voteDto.comment,
    );
  }

  @Get(':id/votes')
  @ApiOperation({ summary: 'Récupérer les votes d\'un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiQuery({
    name: 'reactionType',
    required: false,
    description: 'Filtrer par type de réaction',
  })
  @ApiQuery({
    name: 'context',
    required: false,
    description: 'Filtrer par contexte',
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
    description: 'Nombre de votes par page',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Votes récupérés',
    schema: {
      type: 'object',
      properties: {
        votes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              reactionType: { type: 'string' },
              context: { type: 'string' },
              weight: { type: 'number' },
              comment: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  reputation: { type: 'number' },
                },
              },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getWordVotes(
    @Param('id') wordId: string,
    @Query('reactionType') reactionType?: string,
    @Query('context') context?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.wordSocialService.getWordVotes(wordId, {
      reactionType,
      context,
      page: +page,
      limit: +limit,
    });
  }

  @Get(':id/vote-stats')
  @ApiOperation({ summary: 'Récupérer les statistiques de vote d\'un mot' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de vote récupérées',
    schema: {
      type: 'object',
      properties: {
        reactions: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              weight: { type: 'number' },
            },
          },
        },
        totalVotes: { type: 'number' },
        averageWeight: { type: 'number' },
        popularityScore: { type: 'number' },
        qualityScore: { type: 'number' },
        weightedScore: {
          type: 'object',
          properties: {
            positiveScore: { type: 'number' },
            negativeScore: { type: 'number' },
            neutralScore: { type: 'number' },
            overallScore: { type: 'number' },
            weightedAverage: { type: 'number' },
          },
        },
      },
    },
  })
  async getWordVoteStats(
    @Param('id') wordId: string,
  ) {
    return this.wordSocialService.getWordVoteStats(wordId);
  }

  @Get('trending-quality')
  @ApiOperation({ summary: 'Récupérer les mots de meilleure qualité' })
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: ['day', 'week', 'month', 'all'],
    description: 'Période d\'analyse',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de mots',
    example: 10,
  })
  @ApiQuery({
    name: 'minVotes',
    required: false,
    type: Number,
    description: 'Nombre minimum de votes',
    example: 3,
  })
  @ApiResponse({
    status: 200,
    description: 'Mots de qualité récupérés',
    schema: {
      type: 'object',
      properties: {
        topQualityWords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              wordId: { type: 'string' },
              qualityScore: { type: 'number' },
              accurateVotes: { type: 'number' },
              clearVotes: { type: 'number' },
              helpfulVotes: { type: 'number' },
            },
          },
        },
        timeframe: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getTopQualityWords(
    @Query('timeframe') timeframe: 'day' | 'week' | 'month' | 'all' = 'week',
    @Query('limit') limit: number = 10,
    @Query('minVotes') minVotes: number = 3,
  ) {
    return this.wordSocialService.getTopQualityWords({
      timeframe,
      limit: +limit,
      minVotes: +minVotes,
    });
  }
}