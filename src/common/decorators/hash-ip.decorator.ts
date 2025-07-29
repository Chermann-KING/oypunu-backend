import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IpHasher, HashedIpMetadata } from '../utils/ip-hasher.util';

/**
 * 🔧 DÉCORATEUR HASH IP
 * 
 * Décorateur personnalisé pour extraire et hacher automatiquement 
 * l'adresse IP de la requête entrante.
 * 
 * Usage:
 * @Get('/endpoint')
 * async someMethod(@HashIp() ipData: HashedIpMetadata) {
 *   // ipData contient l'IP hachée et les métadonnées
 * }
 */
export const HashIp = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): HashedIpMetadata => {
    const request = ctx.switchToHttp().getRequest();
    return hashIpMiddleware(request);
  },
);

/**
 * Décorateur pour obtenir seulement l'IP hachée (string)
 */
export const HashIpOnly = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const realIp = IpHasher.extractRealIp(request);
    return IpHasher.hashIp(realIp);
  },
);

/**
 * Décorateur pour obtenir l'IP hachée pour analytics
 */
export const HashIpAnalytics = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const realIp = IpHasher.extractRealIp(request);
    return IpHasher.hashIpForAnalytics(realIp);
  },
);

/**
 * Helper function pour middleware manual
 */
function hashIpMiddleware(request: any): HashedIpMetadata {
  const realIp = IpHasher.extractRealIp(request);
  const hashedIp = IpHasher.hashIp(realIp);
  const geoHash = IpHasher.anonymizeIpForGeo(realIp);
  
  return {
    hashedIp,
    timestamp: new Date(),
    userAgent: request.headers?.['user-agent'] || 'unknown',
    geoHash: IpHasher.hashIpForAnalytics(geoHash),
    sessionId: request.session?.id || request.headers?.['x-session-id']
  };
}