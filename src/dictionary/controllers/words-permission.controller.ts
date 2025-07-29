import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request as NestRequest,
} from "@nestjs/common";
import { Request } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { WordsService } from "../services/words.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { User } from "../../users/schemas/user.schema";

interface RequestWithUser extends Request {
  user: User;
}

/**
 * Contrôleur spécialisé pour la vérification des permissions sur les mots
 * PHASE 3-1: Extraction du WordsController god class (1138 lignes)
 * Responsabilité: Vérification des permissions d'édition, suppression, modération
 */
@ApiTags("words-permissions")
@Controller("words-permissions")
export class WordsPermissionController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * Vérifier si l'utilisateur peut éditer un mot spécifique
   */
  @Get(":id/can-edit")
  @ApiOperation({
    summary: "Vérifier si l'utilisateur peut éditer un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions d'édition vérifiées avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        canEdit: { type: "boolean" },
        reason: { type: "string" },
        permissions: {
          type: "object",
          properties: {
            isOwner: { type: "boolean" },
            isAdmin: { type: "boolean" },
            isContributor: { type: "boolean" },
            hasEditRole: { type: "boolean" },
          },
        },
        restrictions: {
          type: "array",
          items: { type: "string" },
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
  @UseGuards(OptionalJwtAuthGuard)
  async canEditWord(
    @Param("id") id: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    wordId: string;
    canEdit: boolean;
    reason: string;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      isContributor: boolean;
      hasEditRole: boolean;
    };
    restrictions: string[];
  }> {
    console.log("=== DEBUG CAN EDIT WORD ===");
    console.log("ID du mot:", id);
    console.log("Utilisateur:", req?.user?.username || "Anonyme");

    const result = await this.wordsService.canUserEditWord(id, req?.user);

    console.log(
      `Permission d'édition pour "${id}": ${result.canEdit ? "AUTORISÉ" : "REFUSÉ"}`
    );
    console.log("Raison:", result.reason);

    return result;
  }

  /**
   * Vérifier si l'utilisateur peut supprimer un mot spécifique
   */
  @Get(":id/can-delete")
  @ApiOperation({
    summary: "Vérifier si l'utilisateur peut supprimer un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions de suppression vérifiées avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        canDelete: { type: "boolean" },
        reason: { type: "string" },
        permissions: {
          type: "object",
          properties: {
            isOwner: { type: "boolean" },
            isAdmin: { type: "boolean" },
            isSuperAdmin: { type: "boolean" },
            hasDeleteRole: { type: "boolean" },
          },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
        dependencies: {
          type: "object",
          properties: {
            translations: { type: "number" },
            favorites: { type: "number" },
            references: { type: "number" },
          },
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
  @UseGuards(OptionalJwtAuthGuard)
  async canDeleteWord(
    @Param("id") id: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    wordId: string;
    canDelete: boolean;
    reason: string;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      isSuperAdmin: boolean;
      hasDeleteRole: boolean;
    };
    warnings: string[];
    dependencies: {
      translations: number;
      favorites: number;
      references: number;
    };
  }> {
    console.log("=== DEBUG CAN DELETE WORD ===");
    console.log("ID du mot:", id);
    console.log("Utilisateur:", req?.user?.username || "Anonyme");

    const result = await this.wordsService.canUserDeleteWord(id, req?.user);

    console.log(
      `Permission de suppression pour "${id}": ${result.canDelete ? "AUTORISÉ" : "REFUSÉ"}`
    );
    console.log("Raison:", result.reason);
    console.log("Dépendances:", result.dependencies);

    return result;
  }

  /**
   * Vérifier si l'utilisateur peut modérer un mot spécifique
   */
  @Get(":id/can-moderate")
  @ApiOperation({
    summary: "Vérifier si l'utilisateur peut modérer un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions de modération vérifiées avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        canModerate: { type: "boolean" },
        reason: { type: "string" },
        permissions: {
          type: "object",
          properties: {
            isAdmin: { type: "boolean" },
            isSuperAdmin: { type: "boolean" },
            isModerator: { type: "boolean" },
            hasModerateRole: { type: "boolean" },
          },
        },
        availableActions: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "approve",
              "reject",
              "edit",
              "delete",
              "feature",
              "unfeature",
            ],
          },
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async canModerateWord(
    @Param("id") id: string,
    @NestRequest() req: RequestWithUser
  ): Promise<{
    wordId: string;
    canModerate: boolean;
    reason: string;
    permissions: {
      isAdmin: boolean;
      isSuperAdmin: boolean;
      isModerator: boolean;
      hasModerateRole: boolean;
    };
    availableActions: string[];
  }> {
    console.log("=== DEBUG CAN MODERATE WORD ===");
    console.log("ID du mot:", id);
    console.log("Utilisateur:", req.user?.username, "Role:", req.user?.role);

    const result = await this.wordsService.canUserModerateWord(id, req.user);

    console.log(
      `Permission de modération pour "${id}": ${result.canModerate ? "AUTORISÉ" : "REFUSÉ"}`
    );
    console.log("Actions disponibles:", result.availableActions);

    return result;
  }

  /**
   * Vérifier si l'utilisateur peut créer des révisions pour un mot
   */
  @Get(":id/can-revise")
  @ApiOperation({
    summary: "Vérifier si l'utilisateur peut créer des révisions pour un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions de révision vérifiées avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        canRevise: { type: "boolean" },
        reason: { type: "string" },
        permissions: {
          type: "object",
          properties: {
            isAuthenticated: { type: "boolean" },
            isContributor: { type: "boolean" },
            canEdit: { type: "boolean" },
            hasRevisionRole: { type: "boolean" },
          },
        },
        limitations: {
          type: "object",
          properties: {
            maxRevisionsPerDay: { type: "number" },
            currentRevisions: { type: "number" },
            cooldownRemaining: { type: "number" },
          },
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
  @UseGuards(OptionalJwtAuthGuard)
  async canReviseWord(
    @Param("id") id: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    wordId: string;
    canRevise: boolean;
    reason: string;
    permissions: {
      isAuthenticated: boolean;
      isContributor: boolean;
      canEdit: boolean;
      hasRevisionRole: boolean;
    };
    limitations: {
      maxRevisionsPerDay: number;
      currentRevisions: number;
      cooldownRemaining: number;
    };
  }> {
    console.log("=== DEBUG CAN REVISE WORD ===");
    console.log("ID du mot:", id);
    console.log("Utilisateur:", req?.user?.username || "Anonyme");

    const result = await this.wordsService.canUserReviseWord(id, req?.user);

    console.log(
      `Permission de révision pour "${id}": ${result.canRevise ? "AUTORISÉ" : "REFUSÉ"}`
    );
    console.log("Limitations:", result.limitations);

    return result;
  }

  /**
   * Obtenir un résumé complet des permissions pour un mot
   */
  @Get(":id/summary")
  @ApiOperation({
    summary: "Obtenir un résumé complet des permissions pour un mot",
  })
  @ApiResponse({
    status: 200,
    description: "Résumé des permissions récupéré avec succès",
    schema: {
      type: "object",
      properties: {
        wordId: { type: "string" },
        word: { type: "string" },
        language: { type: "string" },
        status: { type: "string" },
        owner: { type: "string" },
        userPermissions: {
          type: "object",
          properties: {
            canView: { type: "boolean" },
            canEdit: { type: "boolean" },
            canDelete: { type: "boolean" },
            canModerate: { type: "boolean" },
            canRevise: { type: "boolean" },
            canAddToFavorites: { type: "boolean" },
            canReport: { type: "boolean" },
          },
        },
        userRoles: {
          type: "object",
          properties: {
            isOwner: { type: "boolean" },
            isAdmin: { type: "boolean" },
            isModerator: { type: "boolean" },
            isContributor: { type: "boolean" },
          },
        },
        restrictions: {
          type: "array",
          items: { type: "string" },
        },
        metadata: {
          type: "object",
          properties: {
            createdAt: { type: "string", format: "date-time" },
            lastModified: { type: "string", format: "date-time" },
            revisionCount: { type: "number" },
          },
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
  @UseGuards(OptionalJwtAuthGuard)
  async getPermissionSummary(
    @Param("id") id: string,
    @NestRequest() req?: RequestWithUser
  ): Promise<{
    wordId: string;
    word: string;
    language: string;
    status: string;
    owner: string;
    userPermissions: {
      canView: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canModerate: boolean;
      canRevise: boolean;
      canAddToFavorites: boolean;
      canReport: boolean;
    };
    userRoles: {
      isOwner: boolean;
      isAdmin: boolean;
      isModerator: boolean;
      isContributor: boolean;
    };
    restrictions: string[];
    metadata: {
      createdAt: Date;
      lastModified: Date;
      revisionCount: number;
    };
  }> {
    console.log("=== DEBUG GET PERMISSION SUMMARY ===");
    console.log("ID du mot:", id);
    console.log("Utilisateur:", req?.user?.username || "Anonyme");

    const result = await this.wordsService.getWordPermissionSummary(
      id,
      req?.user
    );

    console.log(
      `Résumé des permissions pour "${result.word}" (${result.language}):`
    );
    console.log("Permissions utilisateur:", result.userPermissions);
    console.log("Rôles utilisateur:", result.userRoles);

    return result as any;
  }

  /**
   * Vérifier les permissions en lot pour plusieurs mots
   */
  @Get("batch-check")
  @ApiOperation({
    summary: "Vérifier les permissions en lot pour plusieurs mots",
  })
  @ApiResponse({
    status: 200,
    description: "Permissions vérifiées avec succès pour tous les mots",
    schema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              wordId: { type: "string" },
              canEdit: { type: "boolean" },
              canDelete: { type: "boolean" },
              canModerate: { type: "boolean" },
              restrictions: { type: "array", items: { type: "string" } },
            },
          },
        },
        summary: {
          type: "object",
          properties: {
            totalChecked: { type: "number" },
            canEditCount: { type: "number" },
            canDeleteCount: { type: "number" },
            canModerateCount: { type: "number" },
          },
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async batchCheckPermissions(@NestRequest() req: RequestWithUser): Promise<{
    results: Array<{
      wordId: string;
      canEdit: boolean;
      canDelete: boolean;
      canModerate: boolean;
      restrictions: string[];
    }>;
    summary: {
      totalChecked: number;
      canEditCount: number;
      canDeleteCount: number;
      canModerateCount: number;
    };
  }> {
    console.log("=== DEBUG BATCH CHECK PERMISSIONS ===");
    console.log("Utilisateur:", req.user?.username, "Role:", req.user?.role);

    // Note: Cette méthode nécessiterait une liste d'IDs de mots à vérifier
    // Pour l'exemple, on va vérifier les mots récents de l'utilisateur
    const wordIds = ["dummy1", "dummy2"]; // TODO: Récupérer les vrais IDs des mots de l'utilisateur
    const result = await this.wordsService.batchCheckUserPermissions(
      wordIds,
      req.user,
      "edit"
    );

    console.log(
      `Vérification en lot terminée: ${result.summary.totalChecked} mots vérifiés`
    );
    console.log(
      `Permissions: ${result.summary.canEditCount} éditables, ${result.summary.canDeleteCount} supprimables`
    );

    return result;
  }
}
