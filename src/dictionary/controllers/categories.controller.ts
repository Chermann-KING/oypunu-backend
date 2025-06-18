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
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Category } from '../schemas/category.schema';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Assertion de type
const typedRolesGuard = RolesGuard as unknown as CanActivate;

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle catégorie (admin uniquement)' })
  @ApiResponse({
    status: 201,
    description: 'La catégorie a été créée avec succès',
    type: Category,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin')
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les catégories' })
  @ApiResponse({
    status: 200,
    description: 'Liste des catégories récupérée avec succès',
    type: [Category],
  })
  @ApiQuery({
    name: 'language',
    required: false,
    type: String,
    description: 'Filtrer les catégories par langue',
    example: 'fr',
  })
  findAll(@Query('language') language?: string) {
    return this.categoriesService.findAll(language);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une catégorie par son ID' })
  @ApiResponse({
    status: 200,
    description: 'Catégorie récupérée avec succès',
    type: Category,
  })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une catégorie (admin uniquement)' })
  @ApiResponse({
    status: 200,
    description: 'Catégorie mise à jour avec succès',
    type: Category,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une catégorie (admin uniquement)' })
  @ApiResponse({
    status: 200,
    description: 'Catégorie supprimée avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  @ApiParam({
    name: 'id',
    description: 'ID de la catégorie',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
