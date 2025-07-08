import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RoleGuard, RequireRoles, UserRole } from '../guards/role.guard';
import {
  CurrentUser,
  UserId,
  CurrentUserData,
} from '../decorators/current-user.decorator';

/**
 * 🔒 EXEMPLE DE CONTROLLER SÉCURISÉ
 *
 * Ce controller démontre les bonnes pratiques de sécurité :
 * - Validation des rôles hiérarchiques
 * - Utilisation sécurisée des décorateurs
 * - Vérifications de permissions granulaires
 * - Audit logs automatique
 */
@ApiTags('secure-example')
@Controller('secure')
@UseGuards(JwtAuthGuard) // 🔐 Authentification requise pour tout le controller
export class SecureControllerExample {
  private readonly logger = new Logger(SecureControllerExample.name);

  /**
   * 👤 Route accessible à tous les utilisateurs authentifiés
   */
  @Get('profile')
  @ApiOperation({ summary: 'Voir son profil utilisateur' })
  @ApiResponse({ status: 200, description: 'Profil utilisateur' })
  @ApiBearerAuth()
  async getProfile(@CurrentUser() user: CurrentUserData) {
    this.logger.log(`Consultation profil par ${user.username}`);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }

  /**
   * ✏️ Route réservée aux contributeurs et plus
   */
  @Post('content')
  @UseGuards(RoleGuard)
  @RequireRoles(UserRole.CONTRIBUTOR, UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Créer du contenu (contributeurs+)' })
  @ApiResponse({ status: 201, description: 'Contenu créé' })
  @ApiBearerAuth()
  async createContent(
    @Body() data: { title: string; content: string },
    @UserId() userId: string,
    @CurrentUser('username') username: string,
  ) {
    this.logger.log(`Création de contenu par ${username} (${userId})`);

    // Validation métier supplémentaire si nécessaire
    if (!data.title || data.title.trim().length < 3) {
      throw new ForbiddenException('Titre trop court');
    }

    return {
      message: 'Contenu créé avec succès',
      contentId: `content_${Date.now()}`,
      createdBy: username,
    };
  }

  /**
   * 🛡️ Route réservée aux administrateurs
   */
  @Get('admin/users')
  @UseGuards(RoleGuard)
  @RequireRoles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Lister tous les utilisateurs (admins)' })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs' })
  @ApiBearerAuth()
  async getAllUsers(@CurrentUser() admin: CurrentUserData) {
    this.logger.log(`Consultation utilisateurs par admin ${admin.username}`);

    return {
      message: 'Liste des utilisateurs',
      requestedBy: admin.username,
      adminLevel: admin.role,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ⚠️ Route réservée aux super-administrateurs
   */
  @Delete('admin/users/:id')
  @UseGuards(RoleGuard)
  @RequireRoles(UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Supprimer un utilisateur (superadmin)' })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé' })
  @ApiBearerAuth()
  async deleteUser(
    @Param('id') targetUserId: string,
    @CurrentUser() superAdmin: CurrentUserData,
  ) {
    // 🚨 AUDIT CRITIQUE : Actions de suppression
    this.logger.warn(
      `🚨 SUPPRESSION UTILISATEUR: ${targetUserId} par ${superAdmin.username} (${superAdmin.id})`,
    );

    // Validation supplémentaire : un superadmin ne peut pas se supprimer lui-même
    if (targetUserId === superAdmin.id) {
      throw new ForbiddenException('Impossible de se supprimer soi-même');
    }

    return {
      message: 'Utilisateur supprimé',
      deletedUserId: targetUserId,
      deletedBy: superAdmin.username,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🔄 Route avec validation de propriété
   * Seul le propriétaire ou un admin peut modifier
   */
  @Patch('content/:id')
  @UseGuards(RoleGuard)
  @RequireRoles(UserRole.USER) // Au minimum utilisateur connecté
  @ApiOperation({ summary: 'Modifier du contenu (propriétaire ou admin)' })
  @ApiResponse({ status: 200, description: 'Contenu modifié' })
  @ApiBearerAuth()
  async updateContent(
    @Param('id') contentId: string,
    @Body() data: { title?: string; content?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    // Simulation : récupérer le propriétaire du contenu
    const contentOwnerId = 'user_123'; // Vient normalement de la DB

    // 🔒 Validation des permissions : propriétaire OU admin+
    const isOwner = user.id === contentOwnerId;
    const isAdmin = ['admin', 'superadmin'].includes(user.role);

    if (!isOwner && !isAdmin) {
      this.logger.warn(
        `Tentative de modification non autorisée: ${user.username} -> contenu ${contentId}`,
      );
      throw new ForbiddenException(
        'Vous ne pouvez modifier que votre propre contenu',
      );
    }

    this.logger.log(
      `Modification contenu ${contentId} par ${user.username} (${isOwner ? 'propriétaire' : 'admin'})`,
    );

    return {
      message: 'Contenu modifié avec succès',
      contentId,
      modifiedBy: user.username,
      permission: isOwner ? 'owner' : 'admin',
    };
  }
}
