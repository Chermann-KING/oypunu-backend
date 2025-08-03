/**
 * @fileoverview Guard d'authentification JWT optionnelle pour O'Ypunu
 * 
 * Ce guard étend JwtAuthGuard pour fournir une authentification optionnelle
 * qui n'interrompt pas le traitement si aucun token n'est fourni. Idéal
 * pour les endpoints publics qui adaptent leur comportement selon l'authentification.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Guard d'authentification JWT optionnelle pour endpoints hybrides
 * 
 * Extension du JwtAuthGuard qui permet un accès aux endpoints même sans
 * authentification, tout en injectant les données utilisateur si un token
 * valide est fourni. Parfait pour les fonctionnalités qui s'adaptent selon
 * le statut d'authentification (ex: contenu personnalisé vs public).
 * 
 * ## 🎯 Cas d'usage typiques :
 * - **Contenu adaptatif** : Personnalisé si connecté, générique sinon
 * - **API publiques enrichies** : Fonctionnalités bonus pour utilisateurs connectés
 * - **Analytics optionnelles** : Tracking anonyme vs utilisateur identifié
 * - **Recommandations hybrides** : Personnalisées vs populaires
 * 
 * ## 💡 Comportement :
 * - **Token valide** → req.user peuplé avec données utilisateur
 * - **Token invalide/absent** → req.user = null, endpoint accessible
 * - **Pas d'exception** → Contrairement à JwtAuthGuard standard
 * 
 * @example
 * ```typescript
 * @UseGuards(OptionalJwtAuthGuard)
 * @Get('recommendations')
 * async getRecommendations(@CurrentUser() user?: CurrentUserData) {
 *   if (user) {
 *     return this.getPersonalizedRecommendations(user.id);
 *   }
 *   return this.getPublicRecommendations();
 * }
 * ```
 * 
 * @class OptionalJwtAuthGuard
 * @extends JwtAuthGuard
 * @version 1.0.0
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  /**
   * Gère la requête d'authentification de manière permissive
   * 
   * Override de la méthode handleRequest pour permettre l'accès même
   * en cas d'échec d'authentification, contrairement au comportement
   * standard qui lancerait une UnauthorizedException.
   * 
   * @method handleRequest
   * @param {any} err - Erreur éventuelle lors de l'authentification
   * @param {any} user - Données utilisateur décodées du JWT (si valide)
   * @param {any} info - Informations additionnelles sur l'authentification
   * @param {ExecutionContext} context - Contexte d'exécution NestJS
   * @returns {any} Utilisateur si authentifié, null sinon (pas d'exception)
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Si une erreur ou pas d'utilisateur, on continue sans authentification
    // (contrairement au JwtAuthGuard qui lance une exception)
    if (err || !user) {
      return null;
    }
    return user;
  }

  /**
   * Détermine si la requête peut être activée (toujours true)
   * 
   * Override de canActivate pour s'assurer que l'endpoint reste accessible
   * même si l'authentification JWT échoue. Capture les exceptions et
   * permet la continuation du traitement.
   * 
   * @method canActivate
   * @param {ExecutionContext} context - Contexte d'exécution NestJS
   * @returns {boolean} Toujours true pour permettre l'accès
   */
  canActivate(context: ExecutionContext) {
    try {
      return super.canActivate(context);
    } catch (error) {
      // En cas d'erreur d'authentification, on continue sans utilisateur
      return true;
    }
  }
}
