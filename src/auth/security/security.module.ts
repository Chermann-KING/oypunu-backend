import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenStorageService } from './token-storage.service';
import { RateLimiterService } from './rate-limiter.service';
import { SecurityHeadersMiddleware } from './security-headers.middleware';

/**
 * 🛡️ MODULE GLOBAL DE SÉCURITÉ
 * 
 * Module centralisé pour tous les services de sécurité :
 * - Gestion sécurisée des tokens et chiffrement
 * - Rate limiting et protection DDoS
 * - Headers de sécurité HTTP
 * - Middleware de détection d'intrusion
 * 
 * Marqué @Global pour disponibilité dans toute l'application
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    TokenStorageService,
    RateLimiterService,
    SecurityHeadersMiddleware,
  ],
  exports: [
    TokenStorageService,
    RateLimiterService,
    SecurityHeadersMiddleware,
  ],
})
export class SecurityModule {
  constructor() {
    console.log('🛡️  Security Module - Services de sécurité initialisés');
  }
}