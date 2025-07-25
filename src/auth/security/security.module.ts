import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokenStorageService } from './token-storage.service';
import { RateLimiterService } from './rate-limiter.service';
import { SecurityHeadersMiddleware } from './security-headers.middleware';
import { JwtSecretValidatorService } from './jwt-secret-validator.service';

/**
 * 🛡️ MODULE GLOBAL DE SÉCURITÉ
 * 
 * Module centralisé pour tous les services de sécurité :
 * - Gestion sécurisée des tokens et chiffrement
 * - Rate limiting et protection DDoS
 * - Headers de sécurité HTTP
 * - Validation sécurité JWT secrets
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
    JwtSecretValidatorService,
  ],
  exports: [
    TokenStorageService,
    RateLimiterService,
    SecurityHeadersMiddleware,
    JwtSecretValidatorService,
  ],
})
export class SecurityModule {
  constructor() {
    console.log('🛡️  Security Module - Services de sécurité initialisés');
  }
}