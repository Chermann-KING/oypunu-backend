/**
 * @fileoverview Décorateurs d'authentification O'Ypunu pour extraction utilisateur
 * 
 * Ce fichier fournit des décorateurs NestJS sécurisés pour extraire les données
 * de l'utilisateur authentifié depuis le contexte de requête, avec validation
 * complète et gestion d'erreurs robuste pour l'écosystème O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Interface définissant la structure des données utilisateur courantes
 * 
 * Structure standardisée pour les informations utilisateur extraites
 * du contexte d'authentification, garantissant la cohérence à travers
 * tous les endpoints de l'API O'Ypunu.
 * 
 * @interface CurrentUserData
 */
export interface CurrentUserData {
  /** Identifiant unique de l'utilisateur */
  id: string;
  /** Adresse email vérifiée */
  email: string;
  /** Nom d'utilisateur unique */
  username: string;
  /** Rôle avec permissions associées (user, contributor, admin, superadmin) */
  role: string;
  /** Statut d'activation du compte */
  isActive: boolean;
  /** Statut de vérification email */
  isEmailVerified: boolean;
}

/**
 * Décorateur pour extraction sécurisée de l'utilisateur authentifié
 * 
 * Décorateur de paramètre NestJS qui extrait et valide les données de
 * l'utilisateur courant depuis le contexte JWT. Fournit une interface
 * type-safe avec validation complète et gestion d'erreurs robuste.
 * 
 * @function CurrentUser
 * @param {keyof CurrentUserData | undefined} data - Champ spécifique à extraire (optionnel)
 * @param {ExecutionContext} ctx - Contexte d'exécution NestJS
 * @returns {CurrentUserData | any} Données utilisateur complètes ou champ spécifique
 * @throws {UnauthorizedException} Si utilisateur non authentifié ou données invalides
 * 
 * @example
 * // Extraction complète de l'utilisateur
 * async getProfile(@CurrentUser() user: CurrentUserData) {
 *   return { profile: user };
 * }
 * 
 * @example
 * // Extraction d'un champ spécifique
 * async getUserPosts(@CurrentUser('id') userId: string) {
 *   return this.postsService.findByUserId(userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserData | undefined,
    ctx: ExecutionContext,
  ): CurrentUserData | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    // Validation supplémentaire des données utilisateur
    const userData: CurrentUserData = {
      id: user.id || user._id?.toString(),
      email: user.email,
      username: user.username,
      role: user.role || 'user',
      isActive: user.isActive !== false, // Par défaut true si non défini
      isEmailVerified: user.isEmailVerified || false,
    };

    // Validation des champs obligatoires
    if (!userData.id || !userData.email || !userData.username) {
      throw new UnauthorizedException('Données utilisateur incomplètes');
    }

    // Si un champ spécifique est demandé, le retourner
    if (data) {
      return userData[data];
    }

    // Sinon, retourner l'objet complet
    return userData;
  },
);

/**
 * Décorateur optimisé pour extraction rapide de l'ID utilisateur
 * 
 * Version allégée du décorateur CurrentUser spécialement conçue pour
 * extraire uniquement l'identifiant utilisateur. Optimisée pour les
 * endpoints nécessitant seulement l'ID sans validation complète.
 * 
 * @function UserId
 * @param {unknown} data - Paramètre non utilisé (conformité NestJS)
 * @param {ExecutionContext} ctx - Contexte d'exécution NestJS
 * @returns {string} ID unique de l'utilisateur authentifié
 * @throws {UnauthorizedException} Si utilisateur non authentifié ou ID manquant
 * 
 * @example
 * // Usage optimisé pour ID uniquement
 * async deletePost(@UserId() userId: string, @Param('id') postId: string) {
 *   return this.postsService.deleteByUserAndId(userId, postId);
 * }
 * 
 * @example
 * // Préférer CurrentUser('id') pour consistency, UserId pour performance
 * async getStats(@UserId() userId: string) {
 *   return this.analyticsService.getUserStats(userId);
 * }
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const userId = user.id || user._id?.toString();

    if (!userId) {
      throw new UnauthorizedException('ID utilisateur manquant');
    }

    return userId;
  },
);
