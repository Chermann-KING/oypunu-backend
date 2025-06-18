import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
  HttpStatus,
  HttpCode,
  SetMetadata,
  CanActivate,
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
import { CreateWordDto } from '../dto/create-word.dto';
import { UpdateWordDto } from '../dto/update-word.dto';
import { SearchWordsDto } from '../dto/search-words.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Word } from '../schemas/word.schema';

class SearchResults {
  words: Word[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Définir la constante ROLES_KEY directement dans ce fichier si le décorateur n'est pas importable
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

interface RequestWithUser {
  user: User;
}

// Assertion de type
const typedRolesGuard = RolesGuard as unknown as CanActivate;

@ApiTags('dictionary')
@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau mot' })
  @ApiResponse({
    status: 201,
    description: 'Le mot a été créé avec succès',
    type: () => Word,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createWordDto: CreateWordDto,
    @Request() req: RequestWithUser,
  ) {
    console.log('Request user:', req.user);
    return this.wordsService.create(createWordDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer une liste de mots' })
  @ApiResponse({
    status: 200,
    description: 'Liste de mots récupérée avec succès',
    type: [Word],
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
    description: 'Nombre de résultats par page',
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Statut des mots à récupérer',
    example: 'approved',
    enum: ['approved', 'pending', 'rejected'],
  })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status = 'approved',
  ) {
    return this.wordsService.findAll(+page, +limit, status);
  }

  @Get('search')
  @ApiOperation({ summary: 'Rechercher des mots avec filtres' })
  @ApiResponse({
    status: 200,
    description: 'Résultats de recherche',
    type: SearchResults,
  })
  search(@Query() searchDto: SearchWordsDto) {
    return this.wordsService.search(searchDto);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Récupérer les mots mis en avant' })
  @ApiResponse({
    status: 200,
    description: 'Mots mis en avant récupérés avec succès',
    type: [Word],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de mots à récupérer',
    example: 6,
  })
  getFeaturedWords(@Query('limit') limit = 6) {
    return this.wordsService.getFeaturedWords(+limit);
  }

  @Get('languages')
  @ApiOperation({ summary: 'Récupérer la liste des langues disponibles' })
  @ApiResponse({
    status: 200,
    description: 'Liste des langues disponibles récupérée avec succès',
    type: [Object],
  })
  async getAvailableLanguages() {
    return this.wordsService.getAvailableLanguages();
  }

  @Get('pending')
  @ApiOperation({ summary: 'Récupérer les mots en attente (admin uniquement)' })
  @ApiResponse({
    status: 200,
    description: 'Mots en attente récupérés avec succès',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin')
  getPendingWords(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.wordsService.getAdminPendingWords(+page, +limit);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: "Mettre à jour le statut d'un mot (admin uniquement)",
  })
  @ApiResponse({
    status: 200,
    description: 'Statut du mot mis à jour avec succès',
    type: Word,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'approved' | 'rejected',
  ) {
    return this.wordsService.updateWordStatus(id, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un mot par son ID' })
  @ApiResponse({
    status: 200,
    description: 'Mot récupéré avec succès',
    type: Word,
  })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  findOne(@Param('id') id: string) {
    return this.wordsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un mot' })
  @ApiResponse({
    status: 200,
    description: 'Mot mis à jour avec succès',
    type: Word,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateWordDto: UpdateWordDto,
    @Request() req: RequestWithUser,
  ) {
    return this.wordsService.update(id, updateWordDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un mot' })
  @ApiResponse({
    status: 200,
    description: 'Mot supprimé avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.wordsService.remove(id, req.user);
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Ajouter un mot aux favoris' })
  @ApiResponse({
    status: 200,
    description: 'Mot ajouté aux favoris avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  addToFavorites(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.wordsService.addToFavorites(id, req.user._id);
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Retirer un mot des favoris' })
  @ApiResponse({
    status: 200,
    description: 'Mot retiré des favoris avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  removeFromFavorites(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.wordsService.removeFromFavorites(id, req.user._id);
  }

  @Get('favorites/user')
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
    return this.wordsService.getFavoriteWords(req.user._id, +page, +limit);
  }

  @Get(':id/favorite/check')
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
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  checkIfFavorite(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.wordsService.checkIfFavorite(id, req.user._id);
  }
}
