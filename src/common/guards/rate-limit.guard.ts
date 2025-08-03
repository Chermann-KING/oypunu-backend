/**
 * @fileoverview Guard de limitation de taux et gestion de quotas pour O'Ypunu
 *
 * Ce guard combine rate limiting basé sur IP et gestion de quotas utilisateur
 * pour fournir une protection complète contre l'abus et garantir une utilisation
 * équitable des ressources. Il utilise des décorateurs pour une configuration
 * fine des limites par endpoint et supporte différentes catégories de limitation.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { 
  CanActivate, 
  ExecutionContext, 
  Injectable, 
  HttpException, 
  HttpStatus, 
  SetMetadata 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../../auth/security/rate-limiter.service';
import { QuotaService } from '../services/quota.service';
import { IpHasher } from '../utils/ip-hasher.util';

/**
 * Clés de métadonnées pour les décorateurs de rate limiting et quotas
 * Ces constantes sont utilisées par les décorateurs pour stocker les options
 * de configuration dans les métadonnées des méthodes/classes.
 */
export const RATE_LIMIT_KEY = 'rateLimit';
export const QUOTA_KEY = 'quota';

/**
 * Interface de configuration pour les options de rate limiting IP
 * 
 * @interface RateLimitOptions
 */
export interface RateLimitOptions {
  /** Catégorie de rate limiting pour appliquer des limites spécifiques */
  category: 'auth' | 'api' | 'sensitive' | 'upload';
  /** Ignorer les requêtes réussies dans le comptage */
  skipSuccessfulRequests?: boolean;
  /** Ignorer les requêtes échouées dans le comptage */
  skipFailedRequests?: boolean;
  /** Générateur de clé personnalisé pour identifier les clients */
  keyGenerator?: (context: ExecutionContext) => string;
}

/**
 * Interface de configuration pour les options de quotas utilisateur
 * 
 * @interface QuotaOptions
 */
export interface QuotaOptions {
  /** Action soumise aux quotas */
  action: 'dailyWordCreations' | 'dailyWordUpdates' | 'dailyTranslations' | 'dailyComments' | 'dailyMessages' | 'dailyReports' | 'hourlyApiCalls' | 'hourlyUploads' | 'monthlyWordsLimit' | 'monthlyStorageLimit';
  /** Incrémenter le quota après succès de la requête */
  increment?: boolean;
  /** Rôles d'utilisateur à ignorer pour ce quota */
  skipForRoles?: string[];
}

/**
 * Guard de limitation de taux et gestion de quotas pour O'Ypunu
 * 
 * Ce guard NestJS avancé combine la protection par rate limiting basée sur IP
 * et la gestion de quotas utilisateur pour offrir une sécurité complète contre
 * l'abus des ressources système. Il utilise des décorateurs pour permettre une
 * configuration fine des limites par endpoint.
 * 
 * ## 🛡️ Fonctionnalités principales :
 * 
 * ### Rate Limiting IP
 * - Limitation basée sur l'adresse IP hachée pour la confidentialité
 * - Catégories configurables (auth, api, sensitive, upload)
 * - Headers HTTP standard de rate limiting
 * - Générateurs de clés personnalisables
 * 
 * ### Quotas Utilisateur
 * - Limites par utilisateur authentifié et par rôle
 * - Actions granulaires (créations, mises à jour, etc.)
 * - Périodes flexibles (heure, jour, mois)
 * - Exclusions par rôle pour privilèges administrateurs
 * 
 * ## 📊 Utilisation avec décorateurs :
 * 
 * ```typescript
 * @UseGuards(RateLimitGuard)
 * @RateLimit({ category: 'auth' })
 * @EnforceQuota({ action: 'dailyWordCreations', increment: true })
 * @Post('create-word')
 * async createWord() {
 *   // Endpoint protégé par rate limiting et quotas
 * }
 * ```
 * 
 * @class RateLimitGuard
 * @implements CanActivate
 * @version 1.0.0
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  /**
   * Constructeur du guard de limitation de taux
   * 
   * @constructor
   * @param {Reflector} reflector - Service de réflexion pour métadonnées des décorateurs
   * @param {RateLimiterService} rateLimiterService - Service de rate limiting IP
   * @param {QuotaService} quotaService - Service de gestion des quotas utilisateur
   */
  constructor(
    private reflector: Reflector,
    private rateLimiterService: RateLimiterService,
    private quotaService: QuotaService
  ) {}

  /**
   * Méthode principale de validation d'accès avec rate limiting et quotas
   * 
   * Cette méthode effectue une double vérification :
   * 1. Rate limiting basé sur IP pour protection générale
   * 2. Quotas utilisateur pour limitation personnalisée
   * 
   * @async
   * @method canActivate
   * @param {ExecutionContext} context - Contexte d'exécution NestJS
   * @returns {Promise<boolean>} True si accès autorisé
   * @throws {HttpException} Si limites dépassées (429 ou 403)
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Vérifier le rate limiting IP
    await this.checkIPRateLimit(context, request, response);

    // Vérifier les quotas utilisateur
    await this.checkUserQuota(context, request);

    return true;
  }

  /**
   * Vérifie les limites de taux basées sur l'adresse IP
   * 
   * Cette méthode implémente la protection rate limiting en :
   * 1. Récupérant les options de configuration depuis les métadonnées
   * 2. Générant une clé d'identification (IP hachée par défaut)
   * 3. Vérfiant les limites avec le service RateLimiterService
   * 4. Ajoutant les headers HTTP standard de rate limiting
   * 5. Bloquant l'accès si les limites sont dépassées
   * 
   * @private
   * @async
   * @method checkIPRateLimit
   * @param {ExecutionContext} context - Contexte d'exécution pour métadonnées
   * @param {any} request - Objet de requête HTTP
   * @param {any} response - Objet de réponse HTTP
   * @throws {HttpException} 429 si rate limit dépassé
   */
  private async checkIPRateLimit(
    context: ExecutionContext, 
    request: any, 
    response: any
  ): Promise<void> {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!rateLimitOptions) {
      return; // Pas de rate limiting configuré
    }

    // Générer la clé d'identification
    const key = rateLimitOptions.keyGenerator 
      ? rateLimitOptions.keyGenerator(context)
      : this.getDefaultIPKey(request);

    // Vérifier les limites
    const result = await this.rateLimiterService.checkRateLimit(
      key,
      rateLimitOptions.category,
      true
    );

    // Ajouter les headers de rate limiting
    this.setRateLimitHeaders(response, result);

    if (!result.allowed) {
      throw new HttpException(
        {
          error: 'Rate Limit Exceeded',
          message: `Limite de taux dépassée. Réessayez dans ${Math.ceil(result.retryAfter / 1000)} secondes.`,
          retryAfter: result.retryAfter,
          resetTime: result.resetTime,
          category: rateLimitOptions.category
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  /**
   * Vérifie les quotas d'utilisation pour l'utilisateur authentifié
   * 
   * Cette méthode gère les quotas personnalisés par utilisateur :
   * 1. Récupération des options de quota depuis les métadonnées
   * 2. Validation de l'utilisateur authentifié
   * 3. Vérification des rôles exemptés
   * 4. Contrôle des limites d'usage avec QuotaService
   * 5. Préparation de l'incrémentation post-succès si configurée
   * 
   * @private
   * @async
   * @method checkUserQuota
   * @param {ExecutionContext} context - Contexte d'exécution pour métadonnées
   * @param {any} request - Objet de requête HTTP avec utilisateur
   * @throws {HttpException} 403 si quota utilisateur dépassé
   */
  private async checkUserQuota(context: ExecutionContext, request: any): Promise<void> {
    const quotaOptions = this.reflector.getAllAndOverride<QuotaOptions>(
      QUOTA_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!quotaOptions) {
      return; // Pas de quota configuré
    }

    // Récupérer l'utilisateur depuis la requête
    const user = request.user;
    if (!user) {
      return; // Pas d'utilisateur authentifié
    }

    // Vérifier si le rôle doit être ignoré
    if (quotaOptions.skipForRoles?.includes(user.role)) {
      return;
    }

    // Vérifier le quota
    const canPerform = await this.quotaService.canPerformAction(
      user._id.toString(),
      quotaOptions.action,
      user.role
    );

    if (!canPerform) {
      const stats = await this.quotaService.getUserQuotaStats(user._id.toString(), user.role);
      
      throw new HttpException(
        {
          error: 'Quota Exceeded',
          message: `Quota dépassé pour l'action '${quotaOptions.action}'.`,
          quota: {
            action: quotaOptions.action,
            limit: stats.limits[quotaOptions.action],
            used: stats.limits[quotaOptions.action] - stats.remaining[quotaOptions.action],
            remaining: stats.remaining[quotaOptions.action],
            resetTime: stats.resetTimes.daily
          }
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Incrémenter après vérification si demandé
    if (quotaOptions.increment) {
      // On stocke l'information pour l'incrémenter après le succès de la requête
      request.quotaToIncrement = {
        userId: user._id.toString(),
        action: quotaOptions.action
      };
    }
  }

  /**
   * Génère la clé d'identification par défaut basée sur l'IP
   * 
   * Utilise l'utilitaire IpHasher pour créer une clé anonymisée
   * respectant la confidentialité tout en permettant le rate limiting.
   * 
   * @private
   * @method getDefaultIPKey
   * @param {any} request - Objet de requête HTTP
   * @returns {string} Clé d'identification IP hachée
   */
  private getDefaultIPKey(request: any): string {
    const clientIP = this.extractClientIP(request);
    return IpHasher.hashIp(clientIP);
  }

  /**
   * Extrait l'adresse IP réelle du client depuis les headers
   * 
   * Gère les proxies et load balancers en vérifiant plusieurs headers
   * dans l'ordre de priorité pour obtenir l'IP originale.
   * 
   * @private
   * @method extractClientIP
   * @param {any} request - Objet de requête HTTP
   * @returns {string} Adresse IP du client
   */
  private extractClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      '127.0.0.1'
    ).split(',')[0].trim();
  }

  /**
   * Ajoute les headers HTTP standard de rate limiting à la réponse
   * 
   * Implémente les headers standard :
   * - X-RateLimit-Remaining : Requêtes restantes
   * - X-RateLimit-Reset : Timestamp de reset
   * - Retry-After : Délai avant nouvelle tentative (si bloqué)
   * 
   * @private
   * @method setRateLimitHeaders
   * @param {any} response - Objet de réponse HTTP
   * @param {any} result - Résultat du rate limiting
   */
  private setRateLimitHeaders(response: any, result: any): void {
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000));
    
    if (!result.allowed) {
      response.setHeader('Retry-After', Math.ceil(result.retryAfter / 1000));
    }
  }
}

/**
 * Décorateur pour configurer le rate limiting sur un endpoint
 * 
 * Ce décorateur permet de définir facilement les options de rate limiting
 * pour un endpoint spécifique en stockant la configuration dans les métadonnées.
 * 
 * @function RateLimit
 * @param {RateLimitOptions} options - Configuration du rate limiting
 * @returns {MethodDecorator} Décorateur de méthode NestJS
 * 
 * @example
 * ```typescript
 * @UseGuards(RateLimitGuard)
 * @RateLimit({ category: 'auth' })
 * @Post('login')
 * async login() {
 *   // Endpoint protégé par rate limiting d'authentification
 * }
 * ```
 */
export const RateLimit = (options: RateLimitOptions) => 
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Décorateur pour configurer les quotas utilisateur sur un endpoint
 * 
 * Ce décorateur permet de définir les quotas d'utilisation spécifiques
 * pour un endpoint avec gestion automatique de l'incrémentation.
 * 
 * @function EnforceQuota
 * @param {QuotaOptions} options - Configuration des quotas
 * @returns {MethodDecorator} Décorateur de méthode NestJS
 * 
 * @example
 * ```typescript
 * @UseGuards(RateLimitGuard)
 * @EnforceQuota({ action: 'dailyWordCreations', increment: true })
 * @Post('create-word')
 * async createWord() {
 *   // Endpoint soumis aux quotas de création quotidienne
 * }
 * ```
 */
export const EnforceQuota = (options: QuotaOptions) => 
  SetMetadata(QUOTA_KEY, options);

/**
 * Intercepteur pour l'incrémentation automatique des quotas après succès
 * 
 * Cet intercepteur NestJS se charge d'incrémenter automatiquement les quotas
 * d'utilisation après l'exécution réussie d'un endpoint protégé. Il fonctionne
 * en tandem avec le RateLimitGuard pour une gestion transparente des quotas.
 * 
 * ## Fonctionnement :
 * 1. Le guard prépare les informations d'incrémentation dans request.quotaToIncrement
 * 2. L'intercepteur surveille la completion réussie de la requête
 * 3. Si succès, il incrémente automatiquement le quota utilisateur
 * 4. En cas d'erreur d'incrémentation, la requête n'est pas affectée
 * 
 * @class QuotaIncrementInterceptor
 * @implements NestInterceptor
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * @UseInterceptors(QuotaIncrementInterceptor)
 * @UseGuards(RateLimitGuard)
 * @EnforceQuota({ action: 'dailyWordCreations', increment: true })
 * @Post('create-word')
 * async createWord() {
 *   // Le quota sera automatiquement incrémenté après succès
 * }
 * ```
 */
import { Injectable as InterceptorInjectable, NestInterceptor, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@InterceptorInjectable()
export class QuotaIncrementInterceptor implements NestInterceptor {
  /**
   * Constructeur de l'intercepteur d'incrémentation de quotas
   * 
   * @constructor
   * @param {QuotaService} quotaService - Service de gestion des quotas utilisateur
   */
  constructor(private quotaService: QuotaService) {}

  /**
   * Méthode d'interception avec incrémentation post-succès
   * 
   * Intercepte l'exécution de la requête et incrémente automatiquement
   * les quotas utilisateur après une completion réussie.
   * 
   * @method intercept
   * @param {ExecutionContext} context - Contexte d'exécution NestJS
   * @param {CallHandler} next - Gestionnaire de la suite du pipeline
   * @returns {Observable<any>} Observable de la réponse avec incrémentation
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(async () => {
        // Incrémenter le quota après succès
        if (request.quotaToIncrement) {
          try {
            await this.quotaService.incrementUsage(
              request.quotaToIncrement.userId,
              request.quotaToIncrement.action
            );
          } catch (error) {
            console.error('Erreur incrémentation quota:', error);
            // Ne pas faire échouer la requête pour une erreur de quota
          }
        }
      })
    );
  }
}