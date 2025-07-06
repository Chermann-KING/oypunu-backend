import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { WordsService } from '../services/words.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface RequestWithUser {
  user: {
    userId: string;
    sub?: string; // Le champ sub pourrait être présent dans certains cas
    _id?: string; // Pour la compatibilité avec mongodb
    email: string;
    username: string;
    role: string;
  };
}

@ApiTags('favorites')
@Controller('favorite-words')
export class FavoriteWordsController {
  constructor(private readonly _wordsService: WordsService) {}

  @Get()
  @ApiOperation({ summary: "Récupérer les mots favoris de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Liste des favoris récupérée avec succès',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getFavoriteWords(
    @Request() req: RequestWithUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const userId = req.user.userId || req.user.sub || req.user._id;
    console.log('🔥 Controller getFavoriteWords - userId:', userId, 'type:', typeof userId);
    
    if (!userId) {
      throw new UnauthorizedException('ID utilisateur non trouvé dans le token');
    }
    
    return this._wordsService.getFavoriteWords(userId.toString(), +page, +limit);
  }

  @Post(':wordId')
  @ApiOperation({ summary: 'Ajouter un mot aux favoris' })
  @ApiResponse({
    status: 200,
    description: 'Mot ajouté aux favoris avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'wordId',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  addToFavorites(
    @Param('wordId') wordId: string,
    @Request() req: RequestWithUser,
  ) {
    console.log('User from request:', req.user);

    // Utiliser userId au lieu de _id
    const userId = req.user.userId || req.user.sub || req.user._id;

    if (!userId) {
      console.error("Pas d'ID utilisateur trouvé dans req.user:", req.user);
      throw new UnauthorizedException(
        'ID utilisateur non trouvé dans le token',
      );
    }

    console.log('🔥 Controller userId final:', userId, 'type:', typeof userId);
    return this._wordsService.addToFavorites(wordId, userId.toString());
  }

  @Delete(':wordId')
  @ApiOperation({ summary: 'Retirer un mot des favoris' })
  @ApiResponse({
    status: 200,
    description: 'Mot retiré des favoris avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'wordId',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeFromFavorites(
    @Param('wordId') wordId: string,
    @Request() req: RequestWithUser,
  ) {
    // Utiliser userId au lieu de _id
    const userId = req.user.userId || req.user.sub || req.user._id;

    if (!userId) {
      console.error("Pas d'ID utilisateur trouvé dans req.user:", req.user);
      throw new UnauthorizedException(
        'ID utilisateur non trouvé dans le token',
      );
    }
    return this._wordsService.removeFromFavorites(wordId, req.user.userId);
  }

  @Get('check/:wordId')
  @ApiOperation({
    summary: "Vérifier si un mot est dans les favoris de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'Statut vérifié avec succès',
    type: Boolean,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'wordId',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  checkIfFavorite(
    @Param('wordId') wordId: string,
    @Request() req: RequestWithUser,
  ) {
    // Utiliser userId au lieu de _id
    const userId = req.user.userId || req.user.sub || req.user._id;

    if (!userId) {
      console.error("Pas d'ID utilisateur trouvé dans req.user:", req.user);
      throw new UnauthorizedException(
        'ID utilisateur non trouvé dans le token',
      );
    }
    return this._wordsService.checkIfFavorite(wordId, userId.toString());
  }

  @Post('share')
  @ApiOperation({ summary: 'Partager un mot favori avec un autre utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Mot partagé avec succès',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot ou utilisateur non trouvé' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  shareWord(
    @Body() shareData: { wordId: string; username: string },
    @Request() req: RequestWithUser,
  ) {
    // Utiliser userId au lieu de _id
    const userId = req.user.userId || req.user.sub || req.user._id;

    if (!userId) {
      throw new UnauthorizedException(
        'ID utilisateur non trouvé dans le token',
      );
    }

    return this._wordsService.shareWordWithUser(
      shareData.wordId,
      userId,
      shareData.username,
    );
  }
}
