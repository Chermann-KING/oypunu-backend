/**
 * @fileoverview Interface du repository des permissions utilisateur
 *
 * Contrat abstrait pour la gestion des permissions contextuelles
 * avec support CRUD complet et requêtes optimisées.
 *
 * @author Équipe O'Ypunu Backend
 * @version 1.0.0
 * @since 2025-01-01
 */

import { UserPermission } from "../../admin/schemas/user-permission.schema";

/**
 * Options pour la recherche de permissions
 */
export interface PermissionSearchOptions {
  includeRevoked?: boolean;
  context?: string;
  contextId?: string;
  grantedBy?: string;
  limit?: number;
  skip?: number;
  sortBy?: "grantedAt" | "permission" | "context";
  sortOrder?: "asc" | "desc";
}

/**
 * Résultat paginé pour les permissions
 */
export interface PermissionSearchResult {
  permissions: UserPermission[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Statistiques des permissions
 */
export interface PermissionStats {
  totalPermissions: number;
  activePermissions: number;
  revokedPermissions: number;
  permissionsByType: Record<string, number>;
  permissionsByContext: Record<string, number>;
}

/**
 * Interface du repository pour les permissions utilisateur
 *
 * Définit toutes les opérations de persistance des permissions
 * avec support pour les requêtes complexes et l'audit.
 */
export interface IUserPermissionRepository {
  // ========== CRUD DE BASE ==========

  /**
   * Créer une nouvelle permission
   */
  create(permissionData: {
    userId: string;
    permission: string;
    context?: string;
    contextId?: string;
    grantedBy: string;
    metadata?: Record<string, any>;
  }): Promise<UserPermission>;

  /**
   * Trouver une permission par ID
   */
  findById(id: string): Promise<UserPermission | null>;

  /**
   * Mettre à jour une permission
   */
  update(
    id: string,
    updateData: Partial<UserPermission>
  ): Promise<UserPermission | null>;

  /**
   * Supprimer une permission
   */
  delete(id: string): Promise<boolean>;

  // ========== RECHERCHE DE PERMISSIONS ==========

  /**
   * Trouver toutes les permissions d'un utilisateur
   */
  findByUserId(
    userId: string,
    options?: PermissionSearchOptions
  ): Promise<PermissionSearchResult>;

  /**
   * Vérifier si un utilisateur a une permission spécifique
   */
  hasPermission(
    userId: string,
    permission: string,
    context?: string,
    contextId?: string
  ): Promise<boolean>;

  /**
   * Trouver une permission spécifique d'un utilisateur
   */
  findUserPermission(
    userId: string,
    permission: string,
    context?: string,
    contextId?: string
  ): Promise<UserPermission | null>;

  /**
   * Trouver toutes les permissions par type
   */
  findByPermission(
    permission: string,
    options?: PermissionSearchOptions
  ): Promise<PermissionSearchResult>;

  /**
   * Trouver toutes les permissions par contexte
   */
  findByContext(
    context: string,
    contextId?: string,
    options?: PermissionSearchOptions
  ): Promise<PermissionSearchResult>;

  // ========== GESTION DES PERMISSIONS ==========

  /**
   * Accorder une permission à un utilisateur
   */
  grantPermission(
    userId: string,
    permission: string,
    grantedBy: string,
    context?: string,
    contextId?: string,
    metadata?: Record<string, any>
  ): Promise<UserPermission>;

  /**
   * Révoquer une permission d'un utilisateur
   */
  revokePermission(
    userId: string,
    permission: string,
    revokedBy: string,
    context?: string,
    contextId?: string
  ): Promise<boolean>;

  /**
   * Révoquer toutes les permissions d'un utilisateur
   */
  revokeAllUserPermissions(userId: string, revokedBy: string): Promise<number>;

  /**
   * Révoquer toutes les permissions d'un contexte
   */
  revokeContextPermissions(
    context: string,
    contextId: string,
    revokedBy: string
  ): Promise<number>;

  // ========== HISTORIQUE ET AUDIT ==========

  /**
   * Obtenir l'historique des permissions d'un utilisateur
   */
  getUserPermissionHistory(
    userId: string,
    options?: PermissionSearchOptions
  ): Promise<PermissionSearchResult>;

  /**
   * Obtenir les permissions accordées par un admin
   */
  getPermissionsByAdmin(
    adminId: string,
    options?: PermissionSearchOptions
  ): Promise<PermissionSearchResult>;

  /**
   * Obtenir les statistiques des permissions
   */
  getPermissionStats(
    userId?: string,
    context?: string
  ): Promise<PermissionStats>;

  // ========== MAINTENANCE ==========

  /**
   * Nettoyer les permissions orphelines
   */
  cleanupOrphanedPermissions(): Promise<number>;

  /**
   * Archiver les permissions anciennes
   */
  archiveOldPermissions(olderThanDays: number): Promise<number>;

  /**
   * Valider la cohérence des permissions
   */
  validatePermissionIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }>;
}
