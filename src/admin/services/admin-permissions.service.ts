/**
 * @fileoverview Service pour la gestion des permissions d'administration
 *
 * Service métier gérant les permissions contextuelles des utilisateurs
 * pour l'interface d'administration. Intègre la logique de vérification
 * et gestion des permissions granulaires.
 *
 * @author Équipe O'Ypunu Backend
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { IUserPermissionRepository } from "../../repositories/interfaces/user-permission.repository.interface";

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
 * Interface pour l'historique des permissions
 */
interface PermissionHistory {
  readonly permission: string;
  readonly action: "granted" | "revoked";
  readonly context?: string;
  readonly contextId?: string;
  readonly timestamp: Date;
  readonly adminId: string;
}

/**
 * Schema pour les permissions contextuelles stockées
 */
interface UserPermissionDocument {
  userId: string;
  permission: string;
  context?: string;
  contextId?: string;
  granted: boolean;
  grantedAt: Date;
  grantedBy: string;
  revokedAt?: Date;
  revokedBy?: string;
}

/**
 * Service AdminPermissions - Single Responsibility Principle
 *
 * Ce service gère exclusivement les permissions contextuelles
 * des utilisateurs avec une logique métier claire.
 */
@Injectable()
export class AdminPermissionsService {
  constructor(
    // En attendant le vrai schéma, on simule avec le modèle User existant
    @InjectModel("User") private readonly userModel: Model<any>,
    // Repository pour la persistance des permissions
    @Inject("IUserPermissionRepository")
    private readonly userPermissionRepository: IUserPermissionRepository
  ) {}

  /**
   * Liste des permissions disponibles dans le système
   */
  private readonly availablePermissions = [
    // Gestion des utilisateurs
    "VIEW_USERS",
    "EDIT_USERS",
    "DELETE_USERS",
    "MANAGE_USER_ROLES",
    "SUSPEND_USERS",
    "VIEW_USER_DETAILS",
    "EXPORT_USER_DATA",

    // Modération de contenu
    "MODERATE_CONTENT",
    "APPROVE_WORDS",
    "REJECT_WORDS",
    "EDIT_WORDS",
    "DELETE_WORDS",
    "MANAGE_CATEGORIES",

    // Gestion des communautés
    "MANAGE_COMMUNITIES",
    "CREATE_COMMUNITIES",
    "DELETE_COMMUNITIES",
    "MODERATE_COMMUNITIES",
    "ASSIGN_COMMUNITY_MODERATORS",

    // Analytics et rapports
    "VIEW_ANALYTICS",
    "VIEW_DETAILED_ANALYTICS",
    "EXPORT_ANALYTICS",
    "VIEW_SYSTEM_METRICS",
    "VIEW_USER_ANALYTICS",
    "VIEW_CONTENT_ANALYTICS",

    // Administration système
    "MANAGE_SYSTEM",
    "VIEW_SYSTEM_LOGS",
    "MANAGE_SYSTEM_CONFIG",
    "PERFORM_MAINTENANCE",
    "MANAGE_BACKUPS",
    "VIEW_ERROR_LOGS",
    "RESTART_SERVICES",
    "MANAGE_CACHE",
  ];

  /**
   * Récupère les permissions contextuelles d'un utilisateur
   *
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<ContextualPermission[]>} Permissions contextuelles
   */
  async getUserContextualPermissions(
    userId: string
  ): Promise<ContextualPermission[]> {
    // Vérifier que l'utilisateur existe
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
    }

    // Récupérer les permissions stockées en base
    const storedPermissions = await this.userPermissionRepository.findByUserId(
      userId,
      { includeRevoked: false }
    );

    // Convertir vers le format ContextualPermission
    const contextualPermissions: ContextualPermission[] =
      storedPermissions.permissions.map((perm) => ({
        permission: perm.permission,
        context: perm.context,
        contextId: perm.contextId,
        granted: perm.granted,
        grantedAt: perm.grantedAt,
        grantedBy: perm.grantedBy?.toString(),
      }));

    // Ajouter les permissions basées sur le rôle si aucune permission spécifique n'est stockée
    if (contextualPermissions.length === 0) {
      const roleBasedPermissions = this.getRoleBasedPermissions(user.role);
      contextualPermissions.push(
        ...roleBasedPermissions.map((permission) => ({
          permission,
          context: "global",
          granted: true,
          grantedAt: user.createdAt || new Date(),
          grantedBy: "system",
        }))
      );
    }

    return contextualPermissions;
  }

  /**
   * Récupère toutes les permissions disponibles
   *
   * @returns {Promise<string[]>} Liste des permissions disponibles
   */
  async getAvailablePermissions(): Promise<string[]> {
    return this.availablePermissions;
  }

  /**
   * Accorde une permission contextuelle à un utilisateur
   *
   * @param {string} userId - ID de l'utilisateur
   * @param {string} permission - Permission à accorder
   * @param {string} adminId - ID de l'admin qui accorde
   * @param {string} context - Contexte optionnel
   * @param {string} contextId - ID du contexte
   * @returns {Promise<ContextualPermission>} Permission accordée
   */
  async grantUserPermission(
    userId: string,
    permission: string,
    adminId: string,
    context?: string,
    contextId?: string
  ): Promise<ContextualPermission> {
    // Vérifier que l'utilisateur existe
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
    }

    // Vérifier que la permission existe
    if (!this.availablePermissions.includes(permission)) {
      throw new BadRequestException(`Permission ${permission} non reconnue`);
    }

    // Vérifier que l'admin existe
    const admin = await this.userModel.findById(adminId).exec();
    if (!admin) {
      throw new NotFoundException(`Admin ${adminId} non trouvé`);
    }

    // Accorder la permission via le repository
    const grantedPermission =
      await this.userPermissionRepository.grantPermission(
        userId,
        permission,
        adminId,
        context,
        contextId,
        {
          grantedAt: new Date(),
          grantedByRole: admin.role,
        }
      );    return {
      permission: grantedPermission.permission,
      context: grantedPermission.context,
      contextId: grantedPermission.contextId,
      granted: grantedPermission.granted,
      grantedAt: grantedPermission.grantedAt,
      grantedBy: grantedPermission.grantedBy?.toString(),
    };
  }

  /**
   * Révoque une permission contextuelle d'un utilisateur
   *
   * @param {string} userId - ID de l'utilisateur
   * @param {string} permission - Permission à révoquer
   * @param {string} adminId - ID de l'admin qui révoque
   * @param {string} context - Contexte optionnel
   * @param {string} contextId - ID du contexte
   */
  async revokeUserPermission(
    userId: string,
    permission: string,
    adminId: string,
    context?: string,
    contextId?: string
  ): Promise<void> {
    // Vérifier que l'utilisateur existe
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
    }

    // Vérifier que l'admin existe
    const admin = await this.userModel.findById(adminId).exec();
    if (!admin) {
      throw new NotFoundException(`Admin ${adminId} non trouvé`);
    }

    // Révoquer la permission via le repository
    const revoked = await this.userPermissionRepository.revokePermission(
      userId,
      permission,
      adminId,
      context,
      contextId
    );

    if (revoked) {    } else {    }
  }

  /**
   * Vérifie si un utilisateur a une permission spécifique
   *
   * @param {string} userId - ID de l'utilisateur
   * @param {string} permission - Permission à vérifier
   * @param {string} context - Contexte optionnel
   * @param {string} contextId - ID du contexte
   * @returns {Promise<boolean>} True si l'utilisateur a la permission
   */
  async checkUserPermission(
    userId: string,
    permission: string,
    context?: string,
    contextId?: string
  ): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      return false;
    }

    // Vérifier d'abord les permissions stockées en base
    const hasStoredPermission =
      await this.userPermissionRepository.hasPermission(
        userId,
        permission,
        context,
        contextId
      );

    if (hasStoredPermission) {
      return true;
    }

    // Fallback vers les permissions basées sur le rôle
    const rolePermissions = this.getRoleBasedPermissions(user.role);
    return rolePermissions.includes(permission);
  }

  /**
   * Récupère l'historique des permissions d'un utilisateur
   *
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<PermissionHistory[]>} Historique des permissions
   */
  async getUserPermissionHistory(userId: string): Promise<PermissionHistory[]> {
    // Récupérer l'historique complet depuis la base de données
    const historyResult =
      await this.userPermissionRepository.getUserPermissionHistory(userId, {
        sortBy: "grantedAt",
        sortOrder: "desc",
      });

    // Convertir vers le format PermissionHistory
    const history: PermissionHistory[] = [];

    for (const perm of historyResult.permissions) {
      // Ajout de l'événement d'octroi
      history.push({
        permission: perm.permission,
        action: "granted",
        context: perm.context,
        contextId: perm.contextId,
        timestamp: perm.grantedAt,
        adminId: perm.grantedBy?.toString() || "system",
      });

      // Ajout de l'événement de révocation si applicable
      if (!perm.granted && perm.revokedAt && perm.revokedBy) {
        history.push({
          permission: perm.permission,
          action: "revoked",
          context: perm.context,
          contextId: perm.contextId,
          timestamp: perm.revokedAt,
          adminId: perm.revokedBy.toString(),
        });
      }
    }

    // Trier par timestamp décroissant
    return history.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Récupère les permissions basées sur le rôle
   *
   * @param {string} role - Rôle de l'utilisateur
   * @returns {string[]} Permissions du rôle
   */
  private getRoleBasedPermissions(role: string): string[] {
    switch (role) {
      case "superadmin":
        return this.availablePermissions; // Toutes les permissions

      case "admin":
        return [
          "VIEW_USERS",
          "EDIT_USERS",
          "SUSPEND_USERS",
          "VIEW_USER_DETAILS",
          "MODERATE_CONTENT",
          "APPROVE_WORDS",
          "REJECT_WORDS",
          "EDIT_WORDS",
          "MANAGE_CATEGORIES",
          "MANAGE_COMMUNITIES",
          "MODERATE_COMMUNITIES",
          "VIEW_ANALYTICS",
          "VIEW_DETAILED_ANALYTICS",
          "VIEW_SYSTEM_METRICS",
        ];

      case "contributor":
        return [
          "VIEW_USERS",
          "MODERATE_CONTENT",
          "APPROVE_WORDS",
          "REJECT_WORDS",
          "VIEW_ANALYTICS",
        ];

      default:
        return [];
    }
  }
}
