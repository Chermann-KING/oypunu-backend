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
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { WordsService } from "../services/words.service";
import { CreateWordDto } from "../dto/create-word.dto";
import { UpdateWordDto } from "../dto/update-word.dto";
import { SearchWordsDto } from "../dto/search-words.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { User } from "../../users/schemas/user.schema";
import { Word } from "../schemas/word.schema";

interface RequestWithUser {
  user: User;
}

class SearchResults {
  words: Word[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Contrôleur spécialisé pour les opérations CRUD de base des mots
 * PHASE 3-1: Extraction du WordsController god class (1138 lignes)
 * Responsabilité: Création, lecture, mise à jour, suppression et recherche des mots
 */
@ApiTags("words-core")
@Controller("words")
export class WordsCoreController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * Créer un nouveau mot
   */
  @Post()
  @ApiOperation({ summary: "Créer un nouveau mot" })
  @ApiResponse({
    status: 201,
    description: "Le mot a été créé avec succès",
    type: () => Word,
  })
  @ApiResponse({ status: 400, description: "Requête invalide" })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({
    status: 403,
    description: "Permissions insuffisantes - Rôle contributeur requis",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("contributor", "admin", "superadmin")
  async create(
    @Body() createWordDto: CreateWordDto,
    @Request() req: RequestWithUser
  ): Promise<Word> {
    console.log("=== DEBUG CREATE WORD (WordsCoreController) ===");
    console.log("DTO received:", createWordDto);
    console.log("User:", req.user?.username);

    // Validation basique
    if (!createWordDto.word?.trim()) {
      throw new BadRequestException('Le champ "word" ne peut pas être vide');
    }

    if (!createWordDto.meanings || createWordDto.meanings.length === 0) {
      throw new BadRequestException("Au moins une signification est requise");
    }

    console.log("Création du mot avec WordsService...");
    const result = await this.wordsService.create(createWordDto, req.user);
    console.log("Mot créé avec succès:", result.word);

    return result;
  }

  /**
   * Récupérer tous les mots avec pagination
   */
  @Get()
  @ApiOperation({ summary: "Récupérer la liste des mots" })
  @ApiResponse({
    status: 200,
    description: "Liste des mots récupérée avec succès",
    type: [Word],
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Numéro de page (défaut: 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Nombre d'éléments par page (défaut: 10, max: 100)",
    example: 10,
  })
  @ApiQuery({
    name: "language",
    required: false,
    description: "Filtrer par langue",
    example: "fr",
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrer par statut (approved, pending, rejected)",
    example: "approved",
  })
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("language") language?: string,
    @Query("status") status?: string,
    @Request() req?: RequestWithUser
  ): Promise<SearchResults> {
    console.log("=== DEBUG FIND ALL WORDS ===");
    console.log("Paramètres:", { page, limit, language, status });
    console.log("Utilisateur connecté:", req?.user?.username || "Anonyme");

    // Validation des paramètres de pagination
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit) || 10));

    const result = await this.wordsService.findAll(
      validatedPage,
      validatedLimit,
      status?.trim() || "approved",
      language?.trim() || undefined
    );

    console.log(`Récupération de ${result.total} mots (page ${validatedPage})`);
    return result;
  }

  /**
   * Rechercher des mots avec critères avancés
   */
  @Get("search")
  @ApiOperation({ summary: "Rechercher des mots avec critères avancés" })
  @ApiResponse({
    status: 200,
    description: "Résultats de recherche récupérés avec succès",
    type: SearchResults,
  })
  @ApiQuery({
    name: "query",
    required: true,
    description: "Terme de recherche",
    example: "bonjour",
  })
  @ApiQuery({
    name: "language",
    required: false,
    description: "Langue de recherche",
    example: "fr",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Numéro de page",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Nombre de résultats par page",
    example: 10,
  })
  @UseGuards(OptionalJwtAuthGuard)
  async search(
    @Query() searchDto: SearchWordsDto,
    @Request() req?: RequestWithUser
  ): Promise<SearchResults> {
    console.log("=== DEBUG SEARCH WORDS ===");
    console.log("Paramètres de recherche:", searchDto);
    console.log("Utilisateur connecté:", req?.user?.username || "Anonyme");

    if (!searchDto.query?.trim()) {
      throw new BadRequestException(
        'Le paramètre "query" est requis pour la recherche'
      );
    }

    const result = await this.wordsService.search(searchDto);

    const resultWithTotalPages = {
      ...result,
      totalPages: Math.ceil(result.total / result.limit),
    };

    console.log(
      `Recherche "${searchDto.query}" - ${resultWithTotalPages.total} résultats trouvés`
    );
    return resultWithTotalPages;
  }

  /**
   * Récupérer les langues disponibles
   */
  @Get("available-languages")
  @ApiOperation({ summary: "Récupérer la liste des langues disponibles" })
  @ApiResponse({
    status: 200,
    description: "Liste des langues disponibles",
    schema: {
      type: "object",
      properties: {
        languages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string", example: "fr" },
              name: { type: "string", example: "Français" },
              wordCount: { type: "number", example: 1250 },
            },
          },
        },
        total: { type: "number", example: 5 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async getAvailableLanguages(): Promise<{
    languages: Array<{ code: string; name: string; wordCount: number }>;
    total: number;
  }> {
    console.log("=== DEBUG GET AVAILABLE LANGUAGES ===");

    const languages = await this.wordsService.getAvailableLanguages();
    const result = {
      languages: languages.map((lang) => ({
        code: lang.languageId || lang.language,
        name: lang.language,
        wordCount: lang.count,
      })),
      total: languages.length,
    };

    console.log(`${result.total} langues disponibles récupérées`);
    return result;
  }

  /**
   * Récupérer les mots en vedette
   */
  @Get("featured")
  @ApiOperation({ summary: "Récupérer les mots en vedette" })
  @ApiResponse({
    status: 200,
    description: "Mots en vedette récupérés avec succès",
    type: [Word],
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Nombre de mots en vedette (défaut: 5, max: 20)",
    example: 5,
  })
  @ApiQuery({
    name: "language",
    required: false,
    description: "Filtrer par langue",
    example: "fr",
  })
  @UseGuards(OptionalJwtAuthGuard)
  async getFeaturedWords(
    @Query("limit") limit = 5,
    @Query("language") language?: string,
    @Request() req?: RequestWithUser
  ): Promise<Word[]> {
    console.log("=== DEBUG GET FEATURED WORDS ===");
    console.log("Paramètres:", { limit, language });
    console.log("Utilisateur connecté:", req?.user?.username || "Anonyme");

    // Validation de la limite
    const validatedLimit = Math.min(20, Math.max(1, Math.floor(limit) || 5));

    const result = await this.wordsService.getFeaturedWords(validatedLimit);

    console.log(`${result.length} mots en vedette récupérés`);
    return result;
  }

  /**
   * Récupérer un mot spécifique par ID
   */
  @Get(":id")
  @ApiOperation({ summary: "Récupérer un mot par son ID" })
  @ApiResponse({
    status: 200,
    description: "Mot récupéré avec succès",
    type: Word,
  })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot à récupérer",
    example: "507f1f77bcf86cd799439011",
  })
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param("id") id: string,
    @Request() req?: RequestWithUser
  ): Promise<Word> {
    console.log("=== DEBUG FIND ONE WORD ===");
    console.log("ID recherché:", id);
    console.log("Utilisateur connecté:", req?.user?.username || "Anonyme");

    const result = await this.wordsService.findOne(id);

    console.log(`Mot récupéré: "${result.word}" (${result.language})`);
    return result;
  }

  /**
   * Mettre à jour un mot existant
   */
  @Patch(":id")
  @ApiOperation({ summary: "Mettre à jour un mot existant" })
  @ApiResponse({
    status: 200,
    description: "Mot mis à jour avec succès",
    type: Word,
  })
  @ApiResponse({ status: 400, description: "Requête invalide" })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Permissions insuffisantes" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot à mettre à jour",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body() updateWordDto: UpdateWordDto,
    @Request() req: RequestWithUser
  ): Promise<Word> {
    console.log("=== DEBUG UPDATE WORD ===");
    console.log("ID à mettre à jour:", id);
    console.log("Données de mise à jour:", updateWordDto);
    console.log("Utilisateur:", req.user?.username);

    const result = await this.wordsService.update(id, updateWordDto, req.user);

    console.log(`Mot "${result.word}" mis à jour avec succès`);
    return result;
  }

  /**
   * Supprimer un mot
   */
  @Delete(":id")
  @ApiOperation({ summary: "Supprimer un mot" })
  @ApiResponse({
    status: 200,
    description: "Mot supprimé avec succès",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Mot supprimé avec succès" },
        deletedId: { type: "string", example: "507f1f77bcf86cd799439011" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Permissions insuffisantes" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot à supprimer",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param("id") id: string,
    @Request() req: RequestWithUser
  ): Promise<{ message: string; deletedId: string }> {
    console.log("=== DEBUG DELETE WORD ===");
    console.log("ID à supprimer:", id);
    console.log("Utilisateur:", req.user?.username);

    const result = await this.wordsService.remove(id, req.user);

    console.log(`Mot supprimé avec succès: ${id}`);
    return {
      message: "Mot supprimé avec succès",
      deletedId: id,
    };
  }
}
