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

// Clés de métadonnées pour les décorateurs
export const RATE_LIMIT_KEY = 'rateLimit';
export const QUOTA_KEY = 'quota';

// Interfaces pour les options
export interface RateLimitOptions {
  category: 'auth' | 'api' | 'sensitive' | 'upload';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (context: ExecutionContext) => string;
}

export interface QuotaOptions {
  action: 'dailyWordCreations' | 'dailyWordUpdates' | 'dailyTranslations' | 'dailyComments' | 'dailyMessages' | 'dailyReports' | 'hourlyApiCalls' | 'hourlyUploads' | 'monthlyWordsLimit' | 'monthlyStorageLimit';
  increment?: boolean; // Incrémenter après succès
  skipForRoles?: string[]; // Rôles à ignorer
}

/**
 * 🛡️ GUARD POUR RATE LIMITING ET QUOTAS
 * 
 * Guard NestJS qui combine rate limiting IP et quotas utilisateur.
 * Peut être utilisé avec des décorateurs pour une configuration fine.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rateLimiterService: RateLimiterService,
    private quotaService: QuotaService
  ) {}

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
   * Vérifie les limites de taux basées sur l'IP
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
   * Vérifie les quotas utilisateur
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
   * Génère la clé IP par défaut
   */
  private getDefaultIPKey(request: any): string {
    const clientIP = this.extractClientIP(request);
    return IpHasher.hashIp(clientIP);
  }

  /**
   * Extrait l'IP réelle du client
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
   * Ajoute les headers de rate limiting
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
 * 🚦 DÉCORATEUR POUR RATE LIMITING
 */
export const RateLimit = (options: RateLimitOptions) => 
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * 📊 DÉCORATEUR POUR QUOTAS
 */
export const EnforceQuota = (options: QuotaOptions) => 
  SetMetadata(QUOTA_KEY, options);

/**
 * 🔄 INTERCEPTEUR POUR INCRÉMENTER LES QUOTAS APRÈS SUCCÈS
 */
import { Injectable as InterceptorInjectable, NestInterceptor, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@InterceptorInjectable()
export class QuotaIncrementInterceptor implements NestInterceptor {
  constructor(private quotaService: QuotaService) {}

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