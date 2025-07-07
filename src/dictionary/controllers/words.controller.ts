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
  // SetMetadata,
  CanActivate,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import "multer";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { WordsService } from "../services/words.service";
import { CreateWordDto, MeaningDto } from "../dto/create-word.dto";
import { UpdateWordDto, UpdateTranslationDto } from "../dto/update-word.dto";
import { SearchWordsDto } from "../dto/search-words.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { User } from "../../users/schemas/user.schema";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Word } from "../schemas/word.schema";
import { Roles } from "../../common/decorators/roles.decorator";
// import { UserRole } from '../../users/schemas/user.schema';
import { FileInterceptor } from "@nestjs/platform-express";
import { Express, Request as ExpressRequest } from "express";
import { plainToInstance } from "class-transformer";
import {
  CreateWordFormDataDto,
  UpdateWordFormDataDto,
} from "../dto/create-word-formdata.dto";

class SearchResults {
  words: Word[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RequestWithUser {
  user: User;
}

// Assertion de type
const typedRolesGuard = RolesGuard as unknown as CanActivate;

@ApiTags("dictionary")
@Controller("words")
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

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
  create(
    @Body() createWordDto: CreateWordDto,
    @Request() req: RequestWithUser
  ) {
    // Debug logs pour identifier le problème
    console.log("=== DEBUG CREATE WORD ===");
    console.log("Raw body:", (req as unknown as ExpressRequest).body);
    console.log("DTO received:", createWordDto);
    console.log("DTO type:", typeof createWordDto);
    console.log(
      "Word field:",
      createWordDto.word,
      "type:",
      typeof createWordDto.word
    );
    console.log(
      "Language field:",
      createWordDto.language,
      "type:",
      typeof createWordDto.language
    );
    console.log(
      "Meanings field:",
      createWordDto.meanings,
      "type:",
      typeof createWordDto.meanings
    );
    console.log("=========================");

    try {
      // Transformation pour FormData
      if (typeof createWordDto.meanings === "string") {
        console.log("Parsing meanings from string...");
        try {
          const parsed: unknown = JSON.parse(createWordDto.meanings);
          if (!Array.isArray(parsed)) {
            throw new BadRequestException("meanings doit être un tableau");
          }
          createWordDto.meanings = plainToInstance(
            MeaningDto,
            parsed as object[]
          );
          console.log("Parsed meanings:", createWordDto.meanings);
        } catch (parseError: unknown) {
          console.error(
            "Error parsing meanings:",
            parseError instanceof Error ? parseError.message : parseError
          );
          throw new BadRequestException(
            "Le champ meanings est mal formé: " +
              (parseError instanceof Error ? parseError.message : "")
          );
        }
      }

      // Validation des champs requis après transformation
      if (!createWordDto.word || createWordDto.word.trim() === "") {
        throw new BadRequestException('Le champ "word" est requis');
      }

      if (!createWordDto.language || createWordDto.language.trim() === "") {
        throw new BadRequestException('Le champ "language" est requis');
      }

      // Forcer les types string pour FormData
      createWordDto.word = String(createWordDto.word).trim();
      createWordDto.language = String(createWordDto.language).trim();

      if (createWordDto.pronunciation) {
        createWordDto.pronunciation = String(createWordDto.pronunciation);
      }

      if (createWordDto.etymology) {
        createWordDto.etymology = String(createWordDto.etymology);
      }

      if (createWordDto.categoryId) {
        createWordDto.categoryId = String(createWordDto.categoryId);
      }

      console.log("Final DTO before service call:", createWordDto);

      return this.wordsService.create(createWordDto, req.user);
    } catch (error: unknown) {
      console.error(
        "Error in create method:",
        error instanceof Error ? error.message : error
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        "Erreur lors de la création du mot: " +
          (error instanceof Error ? error.message : "")
      );
    }
  }

  @Post("with-audio")
  @ApiOperation({ summary: "Créer un nouveau mot avec fichier audio" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audioFile"))
  @UseGuards(JwtAuthGuard)
  async createWithAudio(
    @Body() createWordDto: CreateWordFormDataDto,
    @UploadedFile() audioFile: Express.Multer.File,
    @Request() req: RequestWithUser
  ) {
    try {
      console.log("=== 🎵 DEBUT createWithAudio ===");
      console.log("📥 FormData DTO reçu:", {
        word: createWordDto.word,
        language: createWordDto.language,
        pronunciation: createWordDto.pronunciation,
        etymology: createWordDto.etymology,
        categoryId: createWordDto.categoryId,
        meanings:
          typeof createWordDto.meanings === "string" ? "JSON_STRING" : "OBJECT",
        audioFile: createWordDto.audioFile ? "PRESENT_IN_DTO" : "ABSENT_IN_DTO",
      });

      console.log("🎙️ Audio file parameter:", {
        isPresent: !!audioFile,
        originalname: audioFile?.originalname || "N/A",
        mimetype: audioFile?.mimetype || "N/A",
        size: audioFile?.size || 0,
        bufferLength: audioFile?.buffer?.length || 0,
      });

      if (audioFile) {
        console.log(
          "🔍 Audio file signature:",
          audioFile.buffer.slice(0, 12).toString("hex")
        );
      }

      // Validation et transformation des meanings
      let parsedMeanings: MeaningDto[];

      if (typeof createWordDto.meanings === "string") {
        try {
          parsedMeanings = JSON.parse(createWordDto.meanings) as MeaningDto[];
          console.log(
            "✅ Meanings parsed successfully, count:",
            parsedMeanings.length
          );
        } catch (error: unknown) {
          console.error("❌ Error parsing meanings:", error);
          throw new BadRequestException(
            "Données meanings invalides: " +
              (error instanceof Error ? error.message : "")
          );
        }
      } else {
        parsedMeanings = createWordDto.meanings;
        console.log(
          "✅ Meanings already object, count:",
          parsedMeanings?.length || 0
        );
      }

      if (!Array.isArray(parsedMeanings)) {
        throw new BadRequestException("meanings doit être un tableau");
      }

      // Construction du DTO standard
      const standardDto: CreateWordDto = {
        word: createWordDto.word?.trim(),
        languageId: createWordDto.languageId?.trim() || undefined,
        language: createWordDto.language?.trim() || undefined,
        pronunciation: createWordDto.pronunciation?.trim() || undefined,
        etymology: createWordDto.etymology?.trim() || undefined,
        categoryId: createWordDto.categoryId?.trim() || undefined,
        meanings: parsedMeanings,
      };

      // Validation manuelle supplémentaire
      if (!standardDto.word) {
        throw new BadRequestException("Le champ word est requis");
      }

      if (!standardDto.languageId && !standardDto.language) {
        throw new BadRequestException(
          "Le champ languageId ou language est requis"
        );
      }

      if (!standardDto.meanings || standardDto.meanings.length === 0) {
        throw new BadRequestException("Au moins une signification est requise");
      }

      console.log("📝 Création du mot avec DTO:", {
        word: standardDto.word,
        languageId: standardDto.languageId,
        language: standardDto.language,
        meaningsCount: standardDto.meanings.length,
      });

      // Créer le mot
      const createdWord = await this.wordsService.create(standardDto, req.user);
      const wordRaw = createdWord as unknown as { id?: any; _id?: any };
      console.log("✅ Mot créé avec ID:", wordRaw._id || wordRaw.id);

      // Si fichier audio présent, l'ajouter
      if (audioFile && createdWord) {
        try {
          const accent = this.getDefaultAccent(
            standardDto.language || "standard"
          );
          console.log("🎯 Accent déterminé:", accent);

          const raw = createdWord as unknown as { id?: any; _id?: any };
          const wordId = raw._id
            ? String(raw._id)
            : raw.id
              ? String(raw.id)
              : "";

          console.log("🔑 ID du mot pour audio:", wordId);
          console.log("🎵 Début upload audio...");

          const wordWithAudio = await this.wordsService.addAudioFile(
            wordId,
            accent,
            audioFile.buffer,
            req.user
          );

          // 🎯 AUTO-APPROBATION : Les mots avec audio sont automatiquement approuvés
          // car cela indique un effort supplémentaire de qualité de l'utilisateur
          console.log("🔄 Mise à jour du statut pour auto-approbation...");
          const wordToUpdate = await this.wordsService.findOne(wordId);
          if (wordToUpdate.status === "pending") {
            await this.wordsService.updateWordStatus(wordId, "approved");
            console.log(
              "✅ Mot auto-approuvé car il contient un fichier audio"
            );
          }

          console.log("✅ Audio uploadé avec succès!");
          console.log("=== 🎵 FIN createWithAudio (AVEC AUDIO) ===");
          return {
            success: true,
            word: wordWithAudio,
            message:
              "Mot créé avec succès et automatiquement approuvé grâce au fichier audio !",
          };
        } catch (audioError: unknown) {
          console.error("❌ Erreur upload audio:", {
            error:
              audioError instanceof Error ? audioError.message : audioError,
            stack: audioError instanceof Error ? audioError.stack : undefined,
          });
          // Retourner le mot même si l'audio a échoué
          console.log("⚠️ Retour du mot sans audio à cause de l'erreur");
          console.log("=== 🎵 FIN createWithAudio (SANS AUDIO) ===");
          return createdWord;
        }
      }

      console.log("ℹ️ Aucun fichier audio fourni");
      console.log("=== 🎵 FIN createWithAudio (PAS D'AUDIO) ===");
      return createdWord;
    } catch (error: unknown) {
      console.error("💥 Erreur générale dans createWithAudio:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        "Erreur lors de la création: " +
          (error instanceof Error ? error.message : "")
      );
    }
  }

  @Get()
  @ApiOperation({ summary: "Récupérer une liste de mots" })
  @ApiResponse({
    status: 200,
    description: "Liste de mots récupérée avec succès",
    type: [Word],
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Numéro de page",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre de résultats par page",
    example: 10,
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
    description: "Statut des mots à récupérer",
    example: "approved",
    enum: ["approved", "pending", "rejected"],
  })
  findAll(
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("status") status = "approved"
  ) {
    return this.wordsService.findAll(+page, +limit, status);
  }

  @Get("search")
  @ApiOperation({ summary: "Rechercher des mots avec filtres" })
  @ApiResponse({
    status: 200,
    description: "Résultats de recherche",
    type: SearchResults,
  })
  async search(
    @Query() searchDto: SearchWordsDto,
    @Request() req?: RequestWithUser
  ) {
    const results = await this.wordsService.search(searchDto);

    // Traquer les vues pour les mots dans les résultats de recherche si utilisateur authentifié
    if (req?.user?._id && results?.words?.length > 0) {
      // Traquer les vues pour les premiers mots des résultats (max 5)
      const wordsToTrack = results.words.slice(0, 5);
      for (const word of wordsToTrack) {
        const wordRaw = word as unknown as { _id: any };
        this.wordsService
          .trackWordView(String(wordRaw._id), String(req.user._id), "search")
          .catch(console.error);
      }
    }

    return results;
  }

  @Get("available-languages")
  @ApiOperation({
    summary: "Récupérer les langues disponibles avec comptage des mots",
  })
  @ApiResponse({
    status: 200,
    description:
      "Liste des langues disponibles avec le nombre de mots par langue",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string", example: "fr" },
          name: { type: "string", example: "Français" },
          nativeName: { type: "string", example: "Français" },
          wordCount: { type: "number", example: 150 },
        },
      },
    },
  })
  async getAvailableLanguages(): Promise<any[]> {
    return this.wordsService.getAvailableLanguages();
  }

  @Get("featured")
  @ApiOperation({ summary: "Récupérer les mots mis en avant" })
  @ApiResponse({
    status: 200,
    description: "Mots mis en avant récupérés avec succès",
    type: [Word],
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre de mots à récupérer",
    example: 6,
  })
  getFeaturedWords(@Query("limit") limit = 6) {
    return this.wordsService.getFeaturedWords(+limit);
  }

  @Get("pending")
  @ApiOperation({ summary: "Récupérer les mots en attente (admin uniquement)" })
  @ApiResponse({
    status: 200,
    description: "Mots en attente récupérés avec succès",
    type: Object,
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Accès refusé" })
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin")
  getPendingWords(@Query("page") page = 1, @Query("limit") limit = 10) {
    return this.wordsService.getAdminPendingWords(+page, +limit);
  }

  @Patch(":id/status")
  @ApiOperation({
    summary: "Mettre à jour le statut d'un mot (admin uniquement)",
  })
  @ApiResponse({
    status: 200,
    description: "Statut du mot mis à jour avec succès",
    type: Word,
  })
  @ApiResponse({ status: 400, description: "Requête invalide" })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Accès refusé" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin")
  updateStatus(
    @Param("id") id: string,
    @Body("status") status: "approved" | "rejected"
  ) {
    return this.wordsService.updateWordStatus(id, status);
  }

  @Get("analytics/statistics")
  @ApiOperation({
    summary: "Obtenir les statistiques des mots en temps réel",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques des mots récupérées avec succès",
    schema: {
      type: "object",
      properties: {
        totalApprovedWords: {
          type: "number",
          description: "Nombre total de mots approuvés",
        },
        wordsAddedToday: {
          type: "number",
          description: "Mots approuvés ajoutés aujourd'hui",
        },
        wordsAddedThisWeek: {
          type: "number",
          description: "Mots approuvés ajoutés cette semaine",
        },
        wordsAddedThisMonth: {
          type: "number",
          description: "Mots approuvés ajoutés ce mois",
        },
        timestamp: {
          type: "string",
          format: "date-time",
          description: "Timestamp de la requête",
        },
      },
    },
  })
  async getWordsStatistics(): Promise<{
    totalApprovedWords: number;
    wordsAddedToday: number;
    wordsAddedThisWeek: number;
    wordsAddedThisMonth: number;
    timestamp: string;
  }> {
    const stats = await this.wordsService.getWordsStatistics();

    return {
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Récupérer un mot par son ID" })
  @ApiResponse({
    status: 200,
    description: "Mot récupéré avec succès",
    type: Word,
  })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  async findOne(@Param("id") id: string, @Request() req?: RequestWithUser) {
    const word = await this.wordsService.findOne(id);

    // Traquer la vue si l'utilisateur est authentifié (optionnel)
    if (req?.user?._id) {
      // Appel asynchrone sans attendre pour ne pas ralentir la réponse
      this.wordsService
        .trackWordView(id, String(req.user._id), "direct")
        .catch((error) => {
          console.error("❌ Erreur lors du tracking de vue:", error);
        });
      console.log(
        "✅ Tracking vue pour mot:",
        id,
        "utilisateur:",
        String(req.user._id)
      );
    } else {
      console.log("⚠️ Pas de tracking - utilisateur non authentifié");
    }

    return word;
  }

  @Get(":id/can-edit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Vérifier si l'utilisateur peut modifier un mot" })
  @ApiResponse({
    status: 200,
    description: "Permission vérifiée",
    schema: {
      type: "object",
      properties: {
        canEdit: { type: "boolean" },
        message: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  async canEditWord(
    @Param("id") id: string,
    @Request() req: RequestWithUser
  ): Promise<{ canEdit: boolean; message?: string }> {
    const canEdit = await this.wordsService.canUserEditWord(id, req.user);
    if (!canEdit) {
      return {
        canEdit: false,
        message:
          "Vous n'avez pas le droit de modifier ce mot. Seul le créateur ou un administrateur peut le faire.",
      };
    }
    return { canEdit: true };
  }

  @Post(":id/audio")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audioFile"))
  @ApiOperation({ summary: "Téléverser un fichier audio pour un mot" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        accent: { type: "string", example: "fr-FR" },
        audioFile: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async uploadAudio(
    @Param("id") id: string,
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("accent") accent: string
  ) {
    if (!file) {
      throw new BadRequestException("Fichier audio manquant.");
    }
    if (!accent) {
      throw new BadRequestException("L'accent est requis.");
    }
    return this.wordsService.addAudioFile(id, accent, file.buffer, req.user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Modifier un mot existant" })
  @ApiResponse({
    status: 200,
    description: "Mot modifié avec succès",
  })
  @ApiResponse({
    status: 400,
    description: "Données invalides ou permissions insuffisantes",
  })
  @ApiResponse({
    status: 404,
    description: "Mot non trouvé",
  })
  async update(
    @Param("id") id: string,
    @Body() updateWordDto: UpdateWordDto,
    @Request() req: RequestWithUser
  ) {
    return this.wordsService.update(id, updateWordDto, req.user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Supprimer un mot" })
  @ApiResponse({
    status: 200,
    description: "Mot supprimé avec succès",
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@Param("id") id: string, @Request() req: RequestWithUser) {
    return this.wordsService.remove(id, req.user);
  }

  @Post(":id/favorite")
  @ApiOperation({ summary: "Ajouter un mot aux favoris" })
  @ApiResponse({
    status: 200,
    description: "Mot ajouté aux favoris avec succès",
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  addToFavorites(@Param("id") id: string, @Request() req: RequestWithUser) {
    const userId = String(req.user._id);
    return this.wordsService.addToFavorites(id, userId);
  }

  @Delete(":id/favorite")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Supprimer un mot des favoris de l'utilisateur" })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: 200,
    description: "Mot retiré des favoris avec succès",
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  removeFromFavorites(
    @Param("id") id: string,
    @Request() req: RequestWithUser
  ) {
    const userId = String(req.user._id);
    return this.wordsService.removeFromFavorites(id, userId);
  }

  @Get("favorites/user")
  @ApiOperation({ summary: "Récupérer les mots favoris de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Liste des favoris récupérée avec succès",
    type: Object,
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Numéro de page",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre de résultats par page",
    example: 10,
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getFavoriteWords(
    @Request() req: RequestWithUser,
    @Query("page") page = 1,
    @Query("limit") limit = 10
  ) {
    return this.wordsService.getFavoriteWords(
      String(req.user._id),
      +page,
      +limit
    );
  }

  @Get(":id/isfavorite")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Vérifier si un mot est dans les favoris de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: "Statut de favori vérifié avec succès",
    type: Boolean,
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  checkIfFavorite(@Param("id") id: string, @Request() req: RequestWithUser) {
    const userId = String(req.user._id);
    return this.wordsService.checkIfFavorite(id, userId);
  }

  @Get(":id/revisions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtenir l'historique des révisions d'un mot" })
  @ApiResponse({
    status: 200,
    description: "Historique des révisions récupéré",
  })
  @ApiResponse({
    status: 404,
    description: "Mot non trouvé",
  })
  async getRevisionHistory(@Param("id") id: string) {
    return this.wordsService.getRevisionHistory(id);
  }

  @Post(":id/revisions/:revisionId/approve")
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin", "superadmin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Approuver une révision de mot (admin)" })
  @ApiResponse({
    status: 200,
    description: "Révision approuvée avec succès",
  })
  @ApiResponse({
    status: 403,
    description: "Permissions insuffisantes",
  })
  @ApiResponse({
    status: 404,
    description: "Révision non trouvée",
  })
  async approveRevision(
    @Param("id") wordId: string,
    @Param("revisionId") revisionId: string,
    @Body() body: { notes?: string },
    @Request() req: RequestWithUser
  ) {
    return this.wordsService.approveRevision(
      wordId,
      revisionId,
      req.user,
      body.notes
    );
  }

  @Post(":id/revisions/:revisionId/reject")
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin", "superadmin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Rejeter une révision de mot (admin)" })
  @ApiResponse({
    status: 200,
    description: "Révision rejetée avec succès",
  })
  @ApiResponse({
    status: 403,
    description: "Permissions insuffisantes",
  })
  @ApiResponse({
    status: 404,
    description: "Révision non trouvée",
  })
  async rejectRevision(
    @Param("id") wordId: string,
    @Param("revisionId") revisionId: string,
    @Body() body: { reason: string },
    @Request() req: RequestWithUser
  ) {
    return this.wordsService.rejectRevision(
      wordId,
      revisionId,
      req.user,
      body.reason
    );
  }

  @Get("revisions/pending")
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles("admin", "superadmin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtenir les révisions en attente (admin)" })
  @ApiResponse({
    status: 200,
    description: "Révisions en attente récupérées",
  })
  @ApiResponse({
    status: 403,
    description: "Permissions insuffisantes",
  })
  async getPendingRevisions(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10"
  ) {
    return this.wordsService.getPendingRevisions(
      parseInt(page),
      parseInt(limit)
    );
  }

  @Post("test-upload")
  @ApiOperation({ summary: "Test d'upload de fichier audio (DEBUG)" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audioFile"))
  @UseGuards(JwtAuthGuard)
  testUpload(
    @Body() body: Record<string, unknown>,
    @UploadedFile() audioFile: Express.Multer.File
  ) {
    console.log("🧪 === TEST UPLOAD DEBUG ===");
    console.log("📥 Body reçu:", body);
    console.log("🎙️ Fichier audio reçu:", {
      isPresent: !!audioFile,
      originalname: audioFile?.originalname || "N/A",
      mimetype: audioFile?.mimetype || "N/A",
      size: audioFile?.size || 0,
      bufferLength: audioFile?.buffer?.length || 0,
      signature: audioFile?.buffer
        ? audioFile.buffer.slice(0, 12).toString("hex")
        : "N/A",
    });

    return {
      success: true,
      message: "Test upload réussi",
      fileReceived: !!audioFile,
      fileInfo: audioFile
        ? {
            originalname: audioFile.originalname,
            mimetype: audioFile.mimetype,
            size: audioFile.size,
            signature: audioFile.buffer.slice(0, 12).toString("hex"),
          }
        : null,
      bodyKeys: Object.keys(body),
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(":id/with-audio")
  @ApiOperation({ summary: "Modifier un mot existant avec fichier audio" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("audioFile"))
  @UseGuards(JwtAuthGuard)
  async updateWithAudio(
    @Param("id") id: string,
    @Body() updateWordDto: UpdateWordFormDataDto,
    @UploadedFile() audioFile: Express.Multer.File,
    @Request() req: RequestWithUser
  ) {
    try {
      console.log("=== 🎵 DEBUT updateWithAudio ===");
      console.log("📥 Update FormData DTO reçu:", {
        wordId: id,
        pronunciation: updateWordDto.pronunciation,
        etymology: updateWordDto.etymology,
        categoryId: updateWordDto.categoryId,
        meanings:
          typeof updateWordDto.meanings === "string" ? "JSON_STRING" : "OBJECT",
        audioFile: updateWordDto.audioFile ? "PRESENT_IN_DTO" : "ABSENT_IN_DTO",
      });

      console.log("🎙️ Audio file parameter:", {
        isPresent: !!audioFile,
        originalname: audioFile?.originalname || "N/A",
        size: audioFile?.size || 0,
        mimetype: audioFile?.mimetype || "N/A",
      });

      // Validation du fichier audio si présent
      if (audioFile) {
        if (!audioFile.buffer || audioFile.size === 0) {
          throw new BadRequestException("Fichier audio vide ou corrompu");
        }

        console.log("✅ Fichier audio validé pour la modification");
      }

      // Transformation des meanings si nécessaire
      let parsedMeanings: MeaningDto[] | undefined;

      if (updateWordDto.meanings) {
        if (typeof updateWordDto.meanings === "string") {
          console.log("📝 Parsing meanings from string for update...");
          try {
            const parsed: unknown = JSON.parse(updateWordDto.meanings);
            if (!Array.isArray(parsed)) {
              throw new BadRequestException("meanings doit être un tableau");
            }
            parsedMeanings = plainToInstance(MeaningDto, parsed as object[]);
          } catch (parseError: unknown) {
            console.error("Error parsing meanings for update:", parseError);
            throw new BadRequestException(
              "Le champ meanings est mal formé: " +
                (parseError instanceof Error ? parseError.message : "")
            );
          }
        } else {
          parsedMeanings = updateWordDto.meanings;
        }
      }

      // Transformation des autres champs
      let parsedTranslations: UpdateTranslationDto[] | undefined;
      if (updateWordDto.translations) {
        try {
          const parsed = JSON.parse(updateWordDto.translations) as unknown;
          if (Array.isArray(parsed)) {
            parsedTranslations = parsed as UpdateTranslationDto[];
          }
        } catch {
          // Ignorer les erreurs de parsing pour les traductions
        }
      }

      let booleanForceRevision: boolean | undefined;
      if (updateWordDto.forceRevision) {
        booleanForceRevision = updateWordDto.forceRevision === "true";
      }

      // Conversion en UpdateWordDto (ne pas inclure les champs undefined)
      const updateData: UpdateWordDto = {};

      if (updateWordDto.pronunciation !== undefined) {
        updateData.pronunciation = updateWordDto.pronunciation;
      }
      if (updateWordDto.etymology !== undefined) {
        updateData.etymology = updateWordDto.etymology;
      }
      if (parsedMeanings !== undefined) {
        updateData.meanings = parsedMeanings;
      }
      if (updateWordDto.categoryId !== undefined) {
        updateData.categoryId = updateWordDto.categoryId;
      }
      if (parsedTranslations !== undefined) {
        updateData.translations = parsedTranslations;
      }
      if (updateWordDto.revisionNotes !== undefined) {
        updateData.revisionNotes = updateWordDto.revisionNotes;
      }
      if (booleanForceRevision !== undefined) {
        updateData.forceRevision = booleanForceRevision;
      }

      console.log("📤 Calling wordsService.updateWithAudio...");

      // Appel du service pour mise à jour avec audio
      return await this.wordsService.updateWithAudio(
        id,
        updateData,
        audioFile,
        req.user
      );
    } catch (error: unknown) {
      console.error("❌ Error in updateWithAudio:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        "Erreur lors de la modification du mot avec audio: " +
          (error instanceof Error ? error.message : "")
      );
    }
  }

  /**
   * Retourne l'accent par défaut pour une langue donnée
   */
  private getDefaultAccent(lang: string): string {
    switch ((lang || "").toLowerCase()) {
      case "fr":
        return "fr-fr";
      case "en":
        return "en-us";
      case "es":
        return "es-es";
      case "de":
        return "de-de";
      case "it":
        return "it-it";
      case "pt":
        return "pt-br";
      case "ru":
        return "ru-ru";
      case "ja":
        return "ja-jp";
      case "zh":
        return "zh-cn";
      case "ar":
        return "ar-sa";
      case "ko":
        return "ko-kr";
      case "hi":
        return "hi-in";
      default:
        return "standard";
    }
  }

  @Get(":id/all-translations")
  @ApiOperation({
    summary: "Récupérer toutes les traductions d'un mot (directes + inverses)",
  })
  @ApiResponse({
    status: 200,
    description: "Toutes les traductions récupérées avec succès",
    schema: {
      type: "object",
      properties: {
        directTranslations: {
          type: "array",
          description: "Traductions stockées dans ce mot",
        },
        reverseTranslations: {
          type: "array",
          description: "Traductions depuis d'autres mots vers ce mot",
        },
        allTranslations: {
          type: "array",
          description: "Toutes les traductions combinées",
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  async getAllTranslations(@Param("id") id: string) {
    return this.wordsService.getAllTranslations(id);
  }
}
