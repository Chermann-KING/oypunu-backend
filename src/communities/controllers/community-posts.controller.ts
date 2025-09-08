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
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CommunityPostsService } from '../services/community-posts.service';

interface RequestWithUser {
  user: {
    _id?: string;
    userId?: string;
    username: string;
    email: string;
    role: string;
  };
}

interface VoteResult {
  success: boolean;
  newScore: number;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  message: string;
}

@ApiTags('community-posts')
@Controller('community-posts')
@ApiBearerAuth()
export class CommunityPostsController {
  constructor(private readonly _postsService: CommunityPostsService) {}

  // Fonction utilitaire pour extraire l'ID utilisateur
  private _getUserId(user: {
    userId?: string;
    _id?: string;
    id?: string;
  }): string {
    return user?.userId || user?._id || user?.id || '';
  }

  @Post('communities/:communityId/posts')
  @ApiOperation({
    summary: 'Créer une nouvelle publication dans une communauté',
  })
  @ApiResponse({ status: 201, description: 'Publication créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - pas membre de la communauté',
  })
  @UseGuards(JwtAuthGuard)
  async createPost(
    @Param('communityId') communityId: string,
    @Body()
    postData: {
      title: string;
      content: string;
      postType:
        | 'question'
        | 'explanation'
        | 'etymology'
        | 'usage'
        | 'translation'
        | 'discussion';
      languages?: string[];
      tags?: string[];
      targetWord?: string;
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
    },
    @Request() req: RequestWithUser,
  ) {
    const userId = this._getUserId(req.user);    return this._postsService.createPost(communityId, userId, postData);
  }

  @Get('communities/:communityId/posts')
  @ApiOperation({
    summary: "Récupérer les publications d'une communauté avec filtres",
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page",
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['score', 'newest', 'oldest', 'activity', 'controversial'],
  })
  @ApiQuery({
    name: 'postType',
    required: false,
    description: 'Type de publication',
  })
  @ApiQuery({
    name: 'languages',
    required: false,
    description: 'Langues (séparées par virgules)',
  })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    enum: ['beginner', 'intermediate', 'advanced'],
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    description: 'Tags (séparés par virgules)',
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['day', 'week', 'month', 'year', 'all'],
  })
  async getPostsByCommunity(
    @Param('communityId') communityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('postType') postType?: string,
    @Query('languages') languages?: string,
    @Query('difficulty') difficulty?: string,
    @Query('tags') tags?: string,
    @Query('timeRange') timeRange?: string,
  ) {
    const filters = {
      sortBy: sortBy as
        | 'score'
        | 'newest'
        | 'oldest'
        | 'activity'
        | 'controversial'
        | undefined,
      postType,
      languages: languages ? languages.split(',') : undefined,
      difficulty,
      tags: tags ? tags.split(',') : undefined,
      timeRange: timeRange as
        | 'day'
        | 'week'
        | 'month'
        | 'year'
        | 'all'
        | undefined,
    };

    return this._postsService.getPostsByCommunity(
      communityId,
      parseInt(page || '1') || 1,
      parseInt(limit || '10') || 10,
      filters,
    );
  }

  @Get('posts/:postId')
  @ApiOperation({ summary: 'Récupérer une publication spécifique' })
  @ApiResponse({ status: 200, description: 'Publication trouvée' })
  @ApiResponse({ status: 404, description: 'Publication non trouvée' })
  async getPostById(
    @Param('postId') postId: string,
    @Request() req: RequestWithUser,
  ): Promise<any> {
    const userId = this._getUserId(req.user);
    return this._postsService.getPostById(postId, userId);
  }

  @Post('posts/:postId/vote')
  @ApiOperation({ summary: 'Voter pour une publication (up/down)' })
  @ApiResponse({ status: 200, description: 'Vote enregistré avec succès' })
  @ApiResponse({ status: 400, description: 'Type de vote invalide' })
  @ApiResponse({ status: 403, description: 'Permission refusée' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async votePost(
    @Param('postId') postId: string,
    @Body() voteData: { voteType: 'up' | 'down'; reason?: string },
    @Request() req: RequestWithUser,
  ): Promise<VoteResult> {
    const userId = this._getUserId(req.user);
    return this._postsService.votePost(
      postId,
      userId,
      voteData.voteType,
      voteData.reason,
    );
  }

  @Post('comments/:commentId/vote')
  @ApiOperation({ summary: 'Voter pour un commentaire (up/down)' })
  @ApiResponse({ status: 200, description: 'Vote enregistré avec succès' })
  @ApiResponse({ status: 400, description: 'Type de vote invalide' })
  @ApiResponse({ status: 403, description: 'Permission refusée' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async voteComment(
    @Param('commentId') commentId: string,
    @Body() voteData: { voteType: 'up' | 'down'; reason?: string },
    @Request() req: RequestWithUser,
  ): Promise<VoteResult> {
    const userId = this._getUserId(req.user);
    return this._postsService.voteComment(
      commentId,
      userId,
      voteData.voteType,
      voteData.reason,
    );
  }

  @Post('posts/:postId/comments')
  @ApiOperation({ summary: 'Ajouter un commentaire à une publication' })
  @ApiResponse({ status: 201, description: 'Commentaire créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @UseGuards(JwtAuthGuard)
  async addComment(
    @Param('postId') postId: string,
    @Body()
    commentData: {
      content: string;
      commentType?:
        | 'correction'
        | 'explanation'
        | 'example'
        | 'translation'
        | 'general';
      parentCommentId?: string;
    },
    @Request() req: RequestWithUser,
  ) {
    const userId = this._getUserId(req.user);
    return this._postsService.addComment(
      postId,
      userId,
      commentData.content,
      commentData.commentType || 'general',
      commentData.parentCommentId,
    );
  }

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: "Récupérer les commentaires d'une publication" })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page",
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['score', 'newest', 'oldest'],
  })
  async getCommentsByPost(
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'score' | 'newest' | 'oldest',
  ) {
    return this._postsService.getCommentsByPost(
      postId,
      parseInt(page || '1') || 1,
      parseInt(limit || '20') || 20,
      sortBy || 'score',
    );
  }

  @Patch('posts/:postId/comments/:commentId/accept')
  @ApiOperation({ summary: 'Marquer un commentaire comme réponse acceptée' })
  @ApiResponse({ status: 200, description: 'Réponse acceptée avec succès' })
  @ApiResponse({
    status: 403,
    description: "Seul l'auteur peut accepter une réponse",
  })
  @ApiResponse({
    status: 400,
    description: 'Type de post invalide pour accepter une réponse',
  })
  @UseGuards(JwtAuthGuard)
  async acceptAnswer(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = this._getUserId(req.user);
    return this._postsService.acceptAnswer(postId, commentId, userId);
  }

  @Patch('posts/:postId/pin')
  @ApiOperation({ summary: 'Épingler/dépingler une publication (modérateurs)' })
  @ApiResponse({ status: 200, description: "Statut d'épinglage mis à jour" })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  @UseGuards(JwtAuthGuard)
  async togglePinPost(
    @Param('postId') postId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = this._getUserId(req.user);
    return this._postsService.togglePinPost(postId, userId);
  }

  @Get('user/votes')
  @ApiOperation({
    summary: "Obtenir les votes de l'utilisateur pour plusieurs contenus",
  })
  @ApiQuery({
    name: 'postIds',
    required: false,
    description: 'IDs des posts (séparés par virgules)',
  })
  @ApiQuery({
    name: 'commentIds',
    required: false,
    description: 'IDs des commentaires (séparés par virgules)',
  })
  @UseGuards(JwtAuthGuard)
  async getUserVotes(
    @Request() req: RequestWithUser,
    @Query('postIds') postIds?: string,
    @Query('commentIds') commentIds?: string,
  ) {
    const userId = this._getUserId(req.user);
    if (!req || !req.user) {
      throw new Error('User authentication required');
    }

    const postIdsArray = postIds ? postIds.split(',') : [];
    const commentIdsArray = commentIds ? commentIds.split(',') : [];

    const votes = await this._postsService.getUserVotesForContent(
      userId,
      postIdsArray,
      commentIdsArray,
    );

    // Convertir les Maps en objets pour la réponse JSON
    return {
      posts: Object.fromEntries(votes.posts),
      comments: Object.fromEntries(votes.comments),
    };
  }

  @Get('communities/:communityId/trending')
  @ApiOperation({
    summary: "Obtenir les publications tendances d'une communauté",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments à retourner",
  })
  @ApiQuery({
    name: 'timeRange',
    required: false,
    enum: ['day', 'week', 'month'],
  })
  async getTrendingPosts(
    @Param('communityId') communityId: string,
    @Query('limit') limit?: string,
    @Query('timeRange') timeRange?: 'day' | 'week' | 'month',
  ) {
    return this._postsService.getTrendingPosts(
      communityId,
      parseInt(limit || '10') || 10,
      timeRange || 'week',
    );
  }

  @Get('communities/:communityId/stats')
  @ApiOperation({ summary: "Obtenir les statistiques d'une communauté" })
  @ApiResponse({ status: 200, description: 'Statistiques de la communauté' })
  async getCommunityStats(@Param('communityId') communityId: string) {
    return this._postsService.getCommunityStats(communityId);
  }

  @Delete('posts/:postId')
  @ApiOperation({ summary: 'Supprimer une publication' })
  @ApiResponse({
    status: 200,
    description: 'Publication supprimée avec succès',
  })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  @ApiResponse({ status: 404, description: 'Publication non trouvée' })
  @UseGuards(JwtAuthGuard)
  async deletePost(
    @Param('postId') postId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = this._getUserId(req.user);
    return this._postsService.deletePost(postId, userId, req.user.role);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  @ApiResponse({ status: 200, description: 'Commentaire supprimé avec succès' })
  @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
  @ApiResponse({ status: 404, description: 'Commentaire non trouvé' })
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @Param('commentId') commentId: string,
    @Request() req: RequestWithUser,
  ) {
    const userId = this._getUserId(req.user);
    return this._postsService.deleteComment(commentId, userId, req.user.role);
  }
}
