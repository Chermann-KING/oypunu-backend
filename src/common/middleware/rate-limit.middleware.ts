import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterService } from '../../auth/security/rate-limiter.service';
import { IpHasher } from '../utils/ip-hasher.util';

/**
 * 🚦 MIDDLEWARE DE RATE LIMITING
 * 
 * Applique les limites de taux automatiquement sur les routes sensibles.
 * Utilise l'IP hachée pour la conformité RGPD.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private rateLimiterService: RateLimiterService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Extraction de l'IP réelle
      const clientIP = this.extractClientIP(req);
      const hashedIP = IpHasher.hashIp(clientIP);
      
      // Déterminer la catégorie de rate limiting basée sur la route
      const category = this.determineRateLimitCategory(req.path, req.method);
      
      // Vérifier les limites
      const result = await this.rateLimiterService.checkRateLimit(
        hashedIP,
        category,
        true // IP-based
      );

      // Ajouter les headers de rate limiting
      this.setRateLimitHeaders(res, result);

      if (!result.allowed) {
        throw new HttpException(
          {
            error: 'Rate Limit Exceeded',
            message: `Trop de requêtes. Réessayez dans ${Math.ceil(result.retryAfter / 1000)} secondes.`,
            retryAfter: result.retryAfter,
            resetTime: result.resetTime
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // En cas d'erreur interne, on laisse passer pour ne pas bloquer le service
      console.error('Rate limit middleware error:', error);
      next();
    }
  }

  /**
   * Extrait l'IP réelle du client en tenant compte des proxies
   */
  private extractClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    ).split(',')[0].trim();
  }

  /**
   * Détermine la catégorie de rate limiting selon la route
   */
  private determineRateLimitCategory(
    path: string, 
    method: string
  ): 'auth' | 'api' | 'sensitive' | 'upload' {
    // Routes d'authentification
    if (path.includes('/auth/') || path.includes('/login') || path.includes('/register')) {
      return 'auth';
    }
    
    // Routes d'upload
    if (path.includes('/upload') || method === 'POST' && path.includes('/audio')) {
      return 'upload';
    }
    
    // Routes sensibles (admin, modération, etc.)
    if (path.includes('/admin/') || 
        path.includes('/moderate') || 
        path.includes('/report') ||
        path.includes('/delete')) {
      return 'sensitive';
    }
    
    // API générale par défaut
    return 'api';
  }

  /**
   * Ajoute les headers standard de rate limiting
   */
  private setRateLimitHeaders(res: Response, result: any): void {
    res.setHeader('X-RateLimit-Limit', result.limit || 'N/A');
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000));
    
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfter / 1000));
    }
  }
}

/**
 * 🎯 DECORATOR POUR RATE LIMITING SPÉCIALISÉ
 * 
 * Permet d'appliquer des limites spécifiques sur des endpoints particuliers.
 */
export const RateLimit = (category: 'auth' | 'api' | 'sensitive' | 'upload') => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const req = args.find(arg => arg && arg.ip !== undefined);
      if (req) {
        // Marquer la catégorie pour le middleware
        req.rateLimitCategory = category;
      }
      return method.apply(this, args);
    };
  };
};

/**
 * 📊 DECORATOR POUR QUOTA UTILISATEUR
 * 
 * Vérifie les quotas utilisateur avant l'exécution d'une méthode.
 */
export const EnforceQuota = (action: 'dailyWordCreations' | 'dailyWordUpdates' | 'dailyTranslations' | 'dailyComments' | 'dailyMessages' | 'dailyReports' | 'hourlyApiCalls' | 'hourlyUploads' | 'monthlyWordsLimit' | 'monthlyStorageLimit') => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      // Trouver l'utilisateur dans les arguments
      const user = args.find(arg => arg && arg.role !== undefined);
      if (user && this.quotaService) {
        await this.quotaService.enforceQuota(user._id.toString(), action, user.role);
      }
      
      const result = await method.apply(this, args);
      
      // Incrémenter le quota après succès
      if (user && this.quotaService) {
        await this.quotaService.incrementUsage(user._id.toString(), action);
      }
      
      return result;
    };
  };
};