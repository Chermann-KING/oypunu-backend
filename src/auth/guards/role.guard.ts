/**
 * @fileoverview Guard de contrôle d'accès par rôles pour O'Ypunu
 * 
 * Ce guard implémente un système de contrôle d'accès granulaire basé
 * sur les rôles utilisateur avec hiérarchie et validation en temps réel.
 * Il vérifie les permissions, l'activité des comptes et la validité
 * des utilisateurs directement en base de données.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

/**
 * Énumération des rôles utilisateur avec hiérarchie croissante
 * 
 * @enum {string} UserRole
 */
export enum UserRole {
  /** Utilisateur de base avec accès limité */
  USER = 'user',
  /** Contributeur avec droits de soumission */
  CONTRIBUTOR = 'contributor',
  /** Administrateur avec droits de modération */
  ADMIN = 'admin',
  /** Super-administrateur avec accès complet */
  SUPERADMIN = 'superadmin',
}

/**
 * Hiérarchie numérique des rôles pour validation des permissions
 * Les valeurs plus élevées incluent automatiquement les permissions inférieures
 * 
 * @constant {Object} ROLE_HIERARCHY
 */
const ROLE_HIERARCHY = {
  [UserRole.USER]: 1,        // Niveau de base
  [UserRole.CONTRIBUTOR]: 2, // Inclut USER
  [UserRole.ADMIN]: 3,       // Inclut USER + CONTRIBUTOR  
  [UserRole.SUPERADMIN]: 4,  // Inclut tous les rôles
};

/**
 * Guard de contrôle d'accès par rôles avec validation en temps réel
 * 
 * Ce guard implémente un système de sécurité avancé qui :
 * - Vérifie les rôles requis via les métadonnées de décorateurs
 * - Valide l'utilisateur en temps réel en base de données
 * - Contrôle l'activité et la validité des comptes
 * - Applique une hiérarchie de permissions granulaire
 * 
 * ## Utilisation avec décorateur :
 * 
 * ```typescript
 * @UseGuards(JwtAuthGuard, RoleGuard)
 * @RequireRoles(UserRole.ADMIN, UserRole.SUPERADMIN)
 * @Post('admin-action')
 * async adminAction() {
 *   // Seuls les admins et superadmins peuvent accéder
 * }
 * ```
 * 
 * ## Sécurité :
 * - Validation en temps réel contre la base de données
 * - Vérification de l'activité des comptes
 * - Logging détaillé des tentatives d'accès
 * - Protection contre les tokens compromis
 * 
 * @class RoleGuard
 * @implements CanActivate
 * @version 1.0.0
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  /**
   * Constructeur du guard de rôles
   * 
   * @constructor
   * @param {Reflector} reflector - Service de réflexion pour métadonnées
   * @param {Model<UserDocument>} userModel - Modèle Mongoose des utilisateurs
   */
  constructor(
    private reflector: Reflector,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Méthode principale de validation d'accès
   * 
   * Cette méthode effectue une validation complète en plusieurs étapes :
   * 1. Extraction des rôles requis depuis les métadonnées
   * 2. Validation de l'utilisateur authentifié
   * 3. Vérification en temps réel en base de données
   * 4. Contrôle d'activité du compte
   * 5. Vérification des permissions hiérarchiques
   * 
   * @async
   * @method canActivate
   * @param {ExecutionContext} context - Contexte d'exécution NestJS
   * @returns {Promise<boolean>} True si accès autorisé, false ou exception sinon
   * @throws {ForbiddenException} Si permissions insuffisantes ou compte invalide
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Récupérer les rôles requis depuis les métadonnées du décorateur @RequireRoles
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // Si aucun rôle n'est spécifié, autoriser l'accès (endpoint public)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Vérifier la présence d'un utilisateur authentifié
    if (!user) {
      this.logger.warn("Tentative d'accès sans utilisateur authentifié");
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // 🔒 VALIDATION CRITIQUE : Vérifier l'utilisateur en base de données
    // Ceci protège contre les tokens compromis ou les utilisateurs supprimés
    const dbUser = await this.validateUserInDatabase(user.id || user._id);

    if (!dbUser) {
      this.logger.error(
        `Utilisateur ${user.id} introuvable en base de données`,
      );
      throw new ForbiddenException('Utilisateur invalide');
    }

    // Vérifier si l'utilisateur est actif
    if (!dbUser.isActive) {
      this.logger.warn(
        `Tentative d'accès par utilisateur inactif: ${dbUser.username}`,
      );
      throw new ForbiddenException('Compte utilisateur désactivé');
    }

    // Vérifier la hiérarchie des rôles avec les permissions requises
    const hasPermission = this.checkRolePermission(dbUser.role, requiredRoles);

    if (!hasPermission) {
      this.logger.warn(
        `Accès refusé pour ${dbUser.username} (${dbUser.role}). Rôles requis: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException('Permissions insuffisantes');
    }

    // ✅ Mettre à jour le request avec les données fraîches de l'utilisateur
    // Ceci garantit que les contrôleurs ont accès aux données les plus récentes
    request.user = {
      ...request.user,
      role: dbUser.role,
      isActive: dbUser.isActive,
      username: dbUser.username,
    };

    this.logger.log(`Accès autorisé pour ${dbUser.username} (${dbUser.role})`);
    return true;
  }

  /**
   * Valide que l'utilisateur existe toujours en base de données
   * 
   * Cette méthode effectue une requête en temps réel pour s'assurer
   * que l'utilisateur existe toujours, est actif, et récupère ses
   * informations de rôle à jour. Ceci protège contre l'utilisation
   * de tokens JWT validés mais pour des comptes supprimés ou désactivés.
   * 
   * @private
   * @async
   * @method validateUserInDatabase
   * @param {string} userId - ID de l'utilisateur à valider
   * @returns {Promise<UserDocument | null>} Document utilisateur ou null si introuvable
   */
  private async validateUserInDatabase(
    userId: string,
  ): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findById(userId)
        .select('role isActive username isEmailVerified') // Sélection sécurisée des champs nécessaires
        .exec();
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation de l'utilisateur ${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Vérifie si le rôle de l'utilisateur satisfait les exigences
   * 
   * Cette méthode implémente la logique de hiérarchie des rôles :
   * - Un rôle supérieur inclut automatiquement les permissions inférieures
   * - La vérification se fait sur la base de niveaux numériques croissants
   * - L'utilisateur doit avoir au moins un des rôles requis
   * 
   * @private
   * @method checkRolePermission
   * @param {string} userRole - Rôle actuel de l'utilisateur
   * @param {UserRole[]} requiredRoles - Liste des rôles autorisés
   * @returns {boolean} True si l'utilisateur a les permissions suffisantes
   * 
   * @example
   * ```typescript
   * // Un ADMIN (niveau 3) peut accéder aux endpoints CONTRIBUTOR (niveau 2)
   * checkRolePermission('admin', [UserRole.CONTRIBUTOR]) // returns true
   * 
   * // Un USER (niveau 1) ne peut pas accéder aux endpoints ADMIN (niveau 3) 
   * checkRolePermission('user', [UserRole.ADMIN]) // returns false
   * ```
   */
  private checkRolePermission(
    userRole: string,
    requiredRoles: UserRole[],
  ): boolean {
    const userLevel = ROLE_HIERARCHY[userRole as UserRole] || 0;

    // Vérifier si l'utilisateur a au moins un des rôles requis
    // Un niveau supérieur ou égal satisfait l'exigence
    return requiredRoles.some((requiredRole) => {
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
      return userLevel >= requiredLevel;
    });
  }
}

/**
 * Décorateur pour spécifier les rôles requis sur les endpoints
 * 
 * Ce décorateur permet de définir facilement les rôles autorisés
 * pour accéder à un endpoint spécifique. Il stocke les rôles dans
 * les métadonnées qui seront lues par le RoleGuard.
 * 
 * @function RequireRoles
 * @param {...UserRole[]} roles - Rôles autorisés (un ou plusieurs)
 * @returns {MethodDecorator} Décorateur de méthode NestJS
 * 
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, RoleGuard)
 * @RequireRoles(UserRole.ADMIN, UserRole.SUPERADMIN)
 * @Post('admin-action')
 * async adminAction() {
 *   // Seuls les admins et superadmins peuvent accéder
 * }
 * 
 * @RequireRoles(UserRole.CONTRIBUTOR)
 * @Post('contribute')
 * async contribute() {
 *   // Contributors, admins et superadmins peuvent accéder
 * }
 * ```
 */
import { SetMetadata } from '@nestjs/common';

export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata('roles', roles);
