import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
  Request as NestRequest,
  CanActivate,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { WordsService } from '../services/words.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../users/schemas/user.schema';
import { Word } from '../schemas/word.schema';

interface RequestWithUser extends Request {
  user: User;
}

// Assertion de type pour RolesGuard
const typedRolesGuard = RolesGuard as unknown as CanActivate;

/**
 * Contrôleur spécialisé pour l'administration et la modération des mots
 * PHASE 3-1: Extraction du WordsController god class (1138 lignes)
 * Responsabilité: Gestion administrative, modération, validation des mots
 */
@ApiTags('words-admin')
@Controller('words-admin')
export class WordsAdminController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * Récupérer les mots en attente de validation (admin uniquement)
   */
  @Get('pending')
  @ApiOperation({ summary: 'Récupérer les mots en attente (admin uniquement)' })
  @ApiResponse({
    status: 200,
    description: 'Mots en attente récupérés avec succès',
    schema: {
      type: 'object',
      properties: {
        words: {
          type: 'array',
          items: { $ref: '#/components/schemas/Word' }
        },
        total: { type: 'number', example: 15 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 2 }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle admin requis' })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: 'Numéro de page (défaut: 1)',
    example: 1
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: 'Nombre d\'éléments par page (défaut: 10, max: 50)',
    example: 10
  })
  @ApiQuery({ 
    name: 'language', 
    required: false, 
    description: 'Filtrer par langue',
    example: 'fr'
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin', 'superadmin')
  async getPendingWords(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('language') language?: string,
    @NestRequest() req?: RequestWithUser,
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    console.log('=== DEBUG GET PENDING WORDS (Admin) ===');
    console.log('Paramètres:', { page, limit, language });
    console.log('Admin:', req?.user?.username, 'Role:', req?.user?.role);

    // Validation des paramètres
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(50, Math.max(1, Math.floor(limit) || 10));

    const result = await this.wordsService.getAdminPendingWords(
      validatedPage, 
      validatedLimit,
      language?.trim()
    );
    
    console.log(`${result.total} mots en attente récupérés pour validation`);
    return result;
  }

  /**
   * Mettre à jour le statut d'un mot (admin uniquement)
   */
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
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle admin requis' })
  @ApiResponse({ status: 404, description: 'Mot non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot à modifier',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({
    description: 'Nouveau statut du mot',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['approved', 'rejected', 'pending'],
          example: 'approved'
        },
        reason: {
          type: 'string',
          description: 'Raison du changement de statut (optionnel)',
          example: 'Contenu approprié, mot validé'
        }
      },
      required: ['status']
    }
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin', 'superadmin')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateData: { 
      status: 'approved' | 'rejected' | 'pending'; 
      reason?: string 
    },
    @NestRequest() req: RequestWithUser,
  ): Promise<Word> {
    console.log('=== DEBUG UPDATE WORD STATUS (Admin) ===');
    console.log('ID du mot:', id);
    console.log('Nouveau statut:', updateData.status);
    console.log('Raison:', updateData.reason);
    console.log('Admin:', req.user?.username, 'Role:', req.user?.role);

    const result = await this.wordsService.updateWordStatus(
      id, 
      updateData.status, 
      req.user,
      updateData.reason
    );
    
    console.log(`Statut du mot "${result.word}" mis à jour: ${updateData.status}`);
    return result;
  }

  /**
   * Récupérer les révisions en attente (admin uniquement)
   */
  @Get('revisions/pending')
  @ApiOperation({ 
    summary: 'Récupérer les révisions en attente de validation (admin uniquement)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Révisions en attente récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        revisions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              wordId: { type: 'string' },
              originalWord: { type: 'string' },
              proposedChanges: { type: 'object' },
              submittedBy: { type: 'string' },
              submittedAt: { type: 'string', format: 'date-time' },
              status: { type: 'string', enum: ['pending', 'approved', 'rejected'] }
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle admin requis' })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: 'Numéro de page',
    example: 1
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: 'Nombre d\'éléments par page',
    example: 10
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin', 'superadmin')
  async getPendingRevisions(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @NestRequest() req: RequestWithUser,
  ): Promise<{
    revisions: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    console.log('=== DEBUG GET PENDING REVISIONS (Admin) ===');
    console.log('Paramètres:', { page, limit });
    console.log('Admin:', req.user?.username, 'Role:', req.user?.role);

    // Validation des paramètres
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(50, Math.max(1, Math.floor(limit) || 10));

    const result = await this.wordsService.getPendingRevisions(
      validatedPage, 
      validatedLimit
    );
    
    console.log(`${result.total} révisions en attente récupérées`);
    return result;
  }

  /**
   * Approuver une révision de mot (admin uniquement)
   */
  @Post(':id/revisions/:revisionId/approve')
  @ApiOperation({ 
    summary: 'Approuver une révision de mot (admin uniquement)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Révision approuvée avec succès',
    type: Word,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle admin requis' })
  @ApiResponse({ status: 404, description: 'Mot ou révision non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiParam({
    name: 'revisionId',
    description: 'ID de la révision à approuver',
    example: '60a1b2c3d4e5f6a7b8c9d0e2',
  })
  @ApiBody({
    description: 'Commentaire d\'approbation (optionnel)',
    schema: {
      type: 'object',
      properties: {
        comment: {
          type: 'string',
          description: 'Commentaire de l\'admin sur l\'approbation',
          example: 'Révision approuvée, modifications pertinentes'
        }
      }
    },
    required: false
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin', 'superadmin')
  async approveRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Body() approvalData?: { comment?: string },
    @NestRequest() req?: RequestWithUser,
  ): Promise<Word> {
    console.log('=== DEBUG APPROVE REVISION (Admin) ===');
    console.log('ID du mot:', id);
    console.log('ID de la révision:', revisionId);
    console.log('Commentaire:', approvalData?.comment);
    console.log('Admin:', req?.user?.username, 'Role:', req?.user?.role);

    const result = await this.wordsService.approveRevision(
      id, 
      revisionId, 
      req?.user,
      approvalData?.comment
    );
    
    console.log(`Révision ${revisionId} approuvée pour le mot "${result.word}"`);
    return result;
  }

  /**
   * Rejeter une révision de mot (admin uniquement)
   */
  @Post(':id/revisions/:revisionId/reject')
  @ApiOperation({ 
    summary: 'Rejeter une révision de mot (admin uniquement)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Révision rejetée avec succès',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Révision rejetée avec succès' },
        revisionId: { type: 'string' },
        reason: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle admin requis' })
  @ApiResponse({ status: 404, description: 'Mot ou révision non trouvé' })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiParam({
    name: 'revisionId',
    description: 'ID de la révision à rejeter',
    example: '60a1b2c3d4e5f6a7b8c9d0e2',
  })
  @ApiBody({
    description: 'Raison du rejet',
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Raison du rejet de la révision',
          example: 'Modifications inappropriées ou incorrectes'
        }
      },
      required: ['reason']
    }
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('admin', 'superadmin')
  async rejectRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Body() rejectionData: { reason: string },
    @NestRequest() req: RequestWithUser,
  ): Promise<{ message: string; revisionId: string; reason: string }> {
    console.log('=== DEBUG REJECT REVISION (Admin) ===');
    console.log('ID du mot:', id);
    console.log('ID de la révision:', revisionId);
    console.log('Raison du rejet:', rejectionData.reason);
    console.log('Admin:', req.user?.username, 'Role:', req.user?.role);

    await this.wordsService.rejectRevision(
      id, 
      revisionId, 
      req.user,
      rejectionData.reason
    );
    
    console.log(`Révision ${revisionId} rejetée avec raison: ${rejectionData.reason}`);
    return {
      message: 'Révision rejetée avec succès',
      revisionId,
      reason: rejectionData.reason
    };
  }

  /**
   * Obtenir un rapport de modération complet (superadmin uniquement)
   */
  @Get('moderation-report')
  @ApiOperation({ 
    summary: 'Obtenir un rapport de modération complet (superadmin uniquement)' 
  })
  @ApiResponse({
    status: 200,
    description: 'Rapport de modération généré avec succès',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            pendingWords: { type: 'number' },
            pendingRevisions: { type: 'number' },
            approvedToday: { type: 'number' },
            rejectedToday: { type: 'number' }
          }
        },
        recentActivity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              target: { type: 'string' }, 
              admin: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle superadmin requis' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, typedRolesGuard)
  @Roles('superadmin')
  async getModerationReport(
    @NestRequest() req: RequestWithUser,
  ): Promise<{
    summary: {
      pendingWords: number;
      pendingRevisions: number;
      approvedToday: number;
      rejectedToday: number;
    };
    recentActivity: Array<{
      action: string;
      target: string;
      admin: string;
      timestamp: Date;
    }>;
  }> {
    console.log('=== DEBUG GET MODERATION REPORT (SuperAdmin) ===');
    console.log('SuperAdmin:', req.user?.username, 'Role:', req.user?.role);

    const result = await this.wordsService.getModerationReport();
    
    console.log('Rapport de modération généré:', {
      pendingWords: result.summary.pendingWords,
      pendingRevisions: result.summary.pendingRevisions
    });
    
    return result;
  }
}