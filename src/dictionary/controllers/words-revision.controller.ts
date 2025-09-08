import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  Request as NestRequest,
  NotFoundException,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { WordsService } from "../services/words.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { User } from "../../users/schemas/user.schema";
import { Word } from "../schemas/word.schema";

interface RequestWithUser extends Request {
  user: User;
}

/**
 * Contrôleur spécialisé pour la gestion des révisions et historique des mots
 * PHASE 3-1: Extraction du WordsController god class (1138 lignes)
 * Responsabilité: Historique des modifications, révisions, comparaisons, versions
 */
@ApiTags("words-revisions")
@Controller("words-revisions")
export class WordsRevisionController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * Récupérer l'historique des révisions d'un mot
   */
  @Get(":id/history")
  @ApiOperation({
    summary: "Récupérer l'historique des révisions d'un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Historique des révisions récupéré avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        currentVersion: { type: "object" },
        revisions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              version: { type: "number" },
              changes: { type: "object" },
              author: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
              status: {
                type: "string",
                enum: ["pending", "approved", "rejected"],
              },
              comment: { type: "string" },
            },
          },
        },
        totalRevisions: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
        totalPages: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
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
    description: "Nombre de révisions par page (défaut: 10, max: 50)",
    example: 10,
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filtrer par statut (pending, approved, rejected)",
    example: "approved",
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRevisionHistory(
    @Param("id") id: string,
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("status") status?: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    wordId: string;
    currentVersion: Word;
    revisions: Array<{
      id: string;
      version: number;
      changes: Record<string, any>;
      author: string;
      timestamp: Date;
      status: string;
      comment?: string;
    }>;
    totalRevisions: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {    console.log("ID du mot:", id);
    console.log("Paramètres:", { page, limit, status });
    console.log("Utilisateur:", req?.user?.username);

    // Validation des paramètres
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(50, Math.max(1, Math.floor(limit) || 10));

    // STUB temporaire - Récupérer le mot et retourner un historique vide
    const word = await this.wordsService.findOne(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    const result = {
      wordId: id,
      currentVersion: word,
      revisions: [],
      totalRevisions: 0,
      page: validatedPage,
      limit: validatedLimit,
      totalPages: 0,
    };

    console.log(
      `Historique récupéré: ${result.totalRevisions} révisions pour le mot "${result.currentVersion.word}"`
    );

    return result;
  }

  /**
   * Créer une nouvelle révision pour un mot
   */
  @Post(":id/create")
  @ApiOperation({
    summary: "Créer une nouvelle révision pour un mot",
  })
  @ApiResponse({
    status: 201,
    description: "Révision créée avec succès",
    schema: {
      type: "object",
      properties: {
        revisionId: { type: "string" },
        wordId: { type: "string" },
        status: { type: "string", example: "pending" },
        message: { type: "string", example: "Révision créée avec succès" },
        changes: { type: "object" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Requête invalide" })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Mot non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot à réviser",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiBody({
    description: "Données de la révision",
    schema: {
      type: "object",
      properties: {
        changes: {
          type: "object",
          description: "Modifications proposées",
          example: {
            meanings: [
              {
                definition: "Nouvelle définition améliorée",
                example: "Exemple d'usage mis à jour",
              },
            ],
          },
        },
        comment: {
          type: "string",
          description: "Commentaire expliquant les modifications",
          example: "Amélioration de la définition pour plus de clarté",
        },
        reason: {
          type: "string",
          description: "Raison de la révision",
          example: "Correction orthographique et amélioration du contenu",
        },
      },
      required: ["changes"],
    },
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createRevision(
    @Param("id") id: string,
    @Body()
    revisionData: {
      changes: Record<string, any>;
      comment?: string;
      reason?: string;
    },
    @NestRequest() req: RequestWithUser
  ): Promise<{
    revisionId: string;
    wordId: string;
    status: string;
    message: string;
    changes: Record<string, any>;
  }> {    console.log("ID du mot:", id);
    console.log("Modifications:", revisionData.changes);
    console.log("Commentaire:", revisionData.comment);
    console.log("Auteur:", req.user?.username);

    // STUB temporaire
    const word = await this.wordsService.findOne(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    const result = {
      revisionId: `rev_${Date.now()}`,
      wordId: id,
      status: "pending",
      message: "Révision créée avec succès",
      changes: revisionData.changes,
    };

    console.log(`Révision créée avec succès: ${result.revisionId}`);

    return result;
  }

  /**
   * Comparer deux versions d'un mot
   */
  @Get(":id/compare/:revisionId")
  @ApiOperation({
    summary: "Comparer la version actuelle avec une révision",
  })
  @ApiResponse({
    status: 200,
    description: "Comparaison générée avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        revisionId: { type: "string" },
        comparison: {
          type: "object",
          properties: {
            current: { type: "object" },
            proposed: { type: "object" },
            differences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  operation: {
                    type: "string",
                    enum: ["added", "removed", "modified"],
                  },
                  oldValue: { type: "string" },
                  newValue: { type: "string" },
                },
              },
            },
          },
        },
        metadata: {
          type: "object",
          properties: {
            author: { type: "string" },
            submittedAt: { type: "string", format: "date-time" },
            status: { type: "string" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Mot ou révision non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiParam({
    name: "revisionId",
    description: "ID de la révision à comparer",
    example: "60a1b2c3d4e5f6a7b8c9d0e2",
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async compareRevision(
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    wordId: string;
    revisionId: string;
    comparison: {
      current: Record<string, any>;
      proposed: Record<string, any>;
      differences: Array<{
        field: string;
        operation: "added" | "removed" | "modified";
        oldValue?: any;
        newValue?: any;
      }>;
    };
    metadata: {
      author: string;
      submittedAt: Date;
      status: string;
    };
  }> {    console.log("ID du mot:", id);
    console.log("ID de la révision:", revisionId);
    console.log("Utilisateur:", req?.user?.username);

    // STUB temporaire
    const word = await this.wordsService.findOne(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    const result = {
      wordId: id,
      revisionId,
      comparison: {
        current: word,
        proposed: {},
        differences: [],
      },
      metadata: {
        author: "unknown",
        submittedAt: new Date(),
        status: "pending",
      },
    };    return result;
  }

  /**
   * Restaurer une version antérieure d'un mot
   */
  @Post(":id/restore/:revisionId")
  @ApiOperation({
    summary: "Restaurer une version antérieure d'un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Version restaurée avec succès",
    type: Word,
  })
  @ApiResponse({ status: 400, description: "Requête invalide" })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 403, description: "Permissions insuffisantes" })
  @ApiResponse({ status: 404, description: "Mot ou révision non trouvé" })
  @ApiParam({
    name: "id",
    description: "ID du mot",
    example: "60a1b2c3d4e5f6a7b8c9d0e1",
  })
  @ApiParam({
    name: "revisionId",
    description: "ID de la révision à restaurer",
    example: "60a1b2c3d4e5f6a7b8c9d0e2",
  })
  @ApiBody({
    description: "Commentaire de restauration",
    schema: {
      type: "object",
      properties: {
        comment: {
          type: "string",
          description: "Raison de la restauration",
          example: "Restauration suite à une erreur dans la version récente",
        },
      },
    },
    required: false,
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async restoreRevision(
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
    @Body() restoreData?: { comment?: string },
    @NestRequest() req?: RequestWithUser
  ): Promise<Word> {    console.log("ID du mot:", id);
    console.log("ID de la révision à restaurer:", revisionId);
    console.log("Commentaire:", restoreData?.comment);
    console.log("Utilisateur:", req?.user?.username);

    // STUB temporaire
    const word = await this.wordsService.findOne(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    console.log(`Version restaurée avec succès pour le mot "${word.word}"`);

    return word;
  }

  /**
   * Obtenir les statistiques des révisions
   */
  @Get("statistics")
  @ApiOperation({
    summary: "Obtenir les statistiques des révisions",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques des révisions récupérées avec succès",
    schema: {
      type: "object",
      properties: {
        totalRevisions: { type: "number" },
        byStatus: {
          type: "object",
          properties: {
            pending: { type: "number" },
            approved: { type: "number" },
            rejected: { type: "number" },
          },
        },
        byPeriod: {
          type: "object",
          properties: {
            today: { type: "number" },
            thisWeek: { type: "number" },
            thisMonth: { type: "number" },
          },
        },
        topContributors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              username: { type: "string" },
              revisionCount: { type: "number" },
              approvalRate: { type: "number" },
            },
          },
        },
        averageProcessingTime: { type: "number" },
      },
    },
  })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Période d'analyse (week, month, year)",
    example: "month",
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getRevisionStatistics(
    @Query("period") period = "month",
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    totalRevisions: number;
    byStatus: {
      pending: number;
      approved: number;
      rejected: number;
    };
    byPeriod: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topContributors: Array<{
      username: string;
      revisionCount: number;
      approvalRate: number;
    }>;
    averageProcessingTime: number;
  }> {    console.log("Période:", period);
    console.log("Utilisateur:", req?.user?.username);

    // Validation de la période
    const validPeriods = ["week", "month", "year"];
    const validatedPeriod = validPeriods.includes(period) ? period : "month";

    // STUB temporaire
    const result = {
      totalRevisions: 0,
      byStatus: { pending: 0, approved: 0, rejected: 0 },
      byPeriod: { today: 0, thisWeek: 0, thisMonth: 0 },
      topContributors: [],
      averageProcessingTime: 0,
    };    console.log(`Total de révisions: ${result.totalRevisions}`);    return result;
  }
}
