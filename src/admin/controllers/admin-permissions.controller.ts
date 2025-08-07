/**
 * @fileoverview Controller pour la gestion des permissions d'administration
 *
 * Controller spécialisé dans la gestion des permissions granulaires pour
 * l'interface d'administration. Fournit les endpoints pour récupérer et
 * gérer les permissions contextuelles des utilisateurs.
 *
 * @author Équipe O'Ypunu Backend
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminPermissionsService } from '../services/admin-permissions.service';

/**
 * Interface pour une permission contextuelle
 */
interface ContextualPermission {
  readonly permission: string;
  readonly context?: string;
  readonly contextId?: string;
  readonly granted: boolean;
  readonly grantedAt: Date;
  readonly grantedBy?: string;
}

/**
 * Interface pour l'attribution de permission
 */
interface GrantPermissionDto {
  readonly permission: string;
  readonly context?: string;
  readonly contextId?: string;
}

/**
 * Controller AdminPermissions - Single Responsibility Principle
 *
 * Ce controller gère exclusivement les permissions d'administration
 * avec une API RESTful claire et sécurisée.
 */
@Controller('admin/permissions')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles('admin', 'superadmin')
export class AdminPermissionsController {
  constructor(private readonly adminPermissionsService: AdminPermissionsService) {}

  /**
   * Récupère les permissions contextuelles d'un utilisateur
   *
   * Endpoint appelé par le frontend pour charger les permissions
   * spécifiques d'un utilisateur au-delà de ses permissions de rôle.
   *
   * @route GET /api/admin/permissions/user/:userId/contextual
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<ContextualPermission[]>} Liste des permissions contextuelles
   */
  @Get('user/:userId/contextual')
  @HttpCode(HttpStatus.OK)
  async getUserContextualPermissions(
    @Param('userId') userId: string
  ): Promise<ContextualPermission[]> {
    return this.adminPermissionsService.getUserContextualPermissions(userId);
  }

  /**
   * Récupère toutes les permissions disponibles dans le système
   *
   * @route GET /api/admin/permissions/available
   * @returns {Promise<string[]>} Liste des permissions disponibles
   */
  @Get('available')
  @HttpCode(HttpStatus.OK)
  async getAvailablePermissions(): Promise<string[]> {
    return this.adminPermissionsService.getAvailablePermissions();
  }

  /**
   * Accorde une permission contextuelle à un utilisateur
   *
   * @route POST /api/admin/permissions/user/:userId
   * @param {string} userId - ID de l'utilisateur
   * @param {GrantPermissionDto} grantData - Données de la permission à accorder
   * @param {any} req - Request object avec les infos de l'admin
   * @returns {Promise<ContextualPermission>} Permission accordée
   */
  @Post('user/:userId')
  @HttpCode(HttpStatus.CREATED)
  async grantUserPermission(
    @Param('userId') userId: string,
    @Body() grantData: GrantPermissionDto,
    @Request() req: any
  ): Promise<ContextualPermission> {
    const adminId = req.user?.id || req.user?.sub;
    return this.adminPermissionsService.grantUserPermission(
      userId,
      grantData.permission,
      adminId,
      grantData.context,
      grantData.contextId
    );
  }

  /**
   * Révoque une permission contextuelle d'un utilisateur
   *
   * @route DELETE /api/admin/permissions/user/:userId/:permission
   * @param {string} userId - ID de l'utilisateur
   * @param {string} permission - Permission à révoquer
   * @param {string} context - Contexte optionnel
   * @param {string} contextId - ID du contexte optionnel
   * @returns {Promise<void>}
   */
  @Delete('user/:userId/:permission')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeUserPermission(
    @Param('userId') userId: string,
    @Param('permission') permission: string,
    @Query('context') context?: string,
    @Query('contextId') contextId?: string
  ): Promise<void> {
    return this.adminPermissionsService.revokeUserPermission(
      userId,
      permission,
      context,
      contextId
    );
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique
   *
   * @route GET /api/admin/permissions/user/:userId/check/:permission
   * @param {string} userId - ID de l'utilisateur
   * @param {string} permission - Permission à vérifier
   * @param {string} context - Contexte optionnel
   * @param {string} contextId - ID du contexte optionnel
   * @returns {Promise<{hasPermission: boolean}>}
   */
  @Get('user/:userId/check/:permission')
  @HttpCode(HttpStatus.OK)
  async checkUserPermission(
    @Param('userId') userId: string,
    @Param('permission') permission: string,
    @Query('context') context?: string,
    @Query('contextId') contextId?: string
  ): Promise<{ hasPermission: boolean }> {
    const hasPermission = await this.adminPermissionsService.checkUserPermission(
      userId,
      permission,
      context,
      contextId
    );
    return { hasPermission };
  }

  /**
   * Récupère l'historique des permissions d'un utilisateur
   *
   * @route GET /api/admin/permissions/user/:userId/history
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<any[]>} Historique des permissions
   */
  @Get('user/:userId/history')
  @HttpCode(HttpStatus.OK)
  async getUserPermissionHistory(@Param('userId') userId: string): Promise<any[]> {
    return this.adminPermissionsService.getUserPermissionHistory(userId);
  }
}