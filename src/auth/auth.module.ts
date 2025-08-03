/**
 * @fileoverview Module d'authentification et sécurité pour O'Ypunu
 * 
 * Ce module centralise toutes les fonctionnalités d'authentification,
 * sécurité et gestion des utilisateurs de la plateforme O'Ypunu.
 * Il intègre JWT, OAuth social, audit de sécurité et gestion des
 * refresh tokens avec validation et configuration automatique.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RoleGuard } from './guards/role.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { TwitterStrategy } from './strategies/twitter.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { RefreshTokenService } from './services/refresh-token.service';
import { AuditService } from './services/audit.service';
import { MailService } from '../common/services/mail.service';
import { ActivityModule } from '../common/activity.module';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module d'authentification et sécurité pour O'Ypunu
 * 
 * Ce module fournit un système d'authentification complet et sécurisé
 * avec support multi-provider, gestion avancée des tokens, audit de
 * sécurité et validation automatique des configurations.
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 🔐 Authentification JWT
 * - Tokens d'accès à durée de vie courte (15min)
 * - Refresh tokens sécurisés avec rotation
 * - Validation cryptographique robuste
 * - Révocation et blacklisting de tokens
 * 
 * ### 🌍 Authentification sociale
 * - Google OAuth 2.0 avec validation
 * - Facebook Login intégré
 * - Twitter OAuth 1.0a support
 * - Configuration automatique des providers
 * 
 * ### 🛡️ Sécurité et audit
 * - Logging complet des actions d'auth
 * - Guards de rôles granulaires
 * - Audit trail des connexions
 * - Protection contre les attaques communes
 * 
 * ### 📧 Gestion utilisateur
 * - Inscription avec vérification email
 * - Réinitialisation sécurisée de mot de passe
 * - Gestion des profils sociaux
 * - Validation des conditions d'utilisation
 * 
 * @module AuthModule
 * @version 1.0.0
 */
@Module({
  imports: [
    PassportModule, // Support Passport.js pour stratégies multiples
    
    // Configuration JWT avec factory asynchrone sécurisée
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' }, // Access token court pour sécurité optimale
      }),
    }),
    
    // Schémas Mongoose pour persistance sécurisée
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },           // Utilisateurs de base
      { name: RefreshToken.name, schema: RefreshTokenSchema }, // Tokens de rafraîchissement
      { name: AuditLog.name, schema: AuditLogSchema },    // Logs d'audit sécurité
    ]),
    
    ActivityModule,      // Module d'activité utilisateur
    RepositoriesModule,  // Repositories pour accès données
  ],
  controllers: [
    AuthController, // API REST complète d'authentification
  ],
  providers: [
    // Services core d'authentification
    AuthService,         // Service principal d'auth
    RefreshTokenService, // Gestion des refresh tokens
    AuditService,        // Service d'audit sécurité
    
    // Guards et middlewares de sécurité
    RoleGuard,          // Protection par rôles
    
    // Stratégies d'authentification
    JwtStrategy,        // Stratégie JWT principale
    GoogleStrategy,     // OAuth Google
    FacebookStrategy,   // OAuth Facebook
    TwitterStrategy,    // OAuth Twitter
    
    // Services utilitaires
    MailService,        // Envoi d'emails d'authentification
  ],
  exports: [
    AuthService,   // Service exporté pour autres modules
    AuditService,  // Service d'audit réutilisable
  ],
})
export class AuthModule {
  /**
   * Constructeur du module d'authentification
   * 
   * Initialise et valide automatiquement toutes les configurations
   * d'authentification (JWT, OAuth providers, email) au démarrage
   * de l'application avec logging détaillé pour diagnostic.
   * 
   * @constructor
   * @param {ConfigService} configService - Service de configuration NestJS
   */
  constructor(private configService: ConfigService) {
    // Validation et logging des configurations au démarrage
    const configurations = {
      JWT: !!this.configService.get('JWT_SECRET'),
      Google: this.isGoogleConfigured(),
      Facebook: this.isFacebookConfigured(),
      Twitter: this.isTwitterConfigured(),
      Mail: !!this.configService.get('MAIL_USER'),
    };

    console.log('🔐 Auth Module - Configurations actives:');
    Object.entries(configurations).forEach(([service, isConfigured]) => {
      console.log(`   ${isConfigured ? '✅' : '❌'} ${service}`);
    });
    
    // Avertissement si configurations critiques manquantes
    if (!configurations.JWT) {
      console.warn('⚠️  JWT_SECRET manquant - authentification désactivée');
    }
    if (!configurations.Mail) {
      console.warn('⚠️  Configuration mail manquante - emails désactivés');
    }
  }

  /**
   * Vérifie la configuration Google OAuth
   * 
   * Valide que toutes les variables d'environnement nécessaires
   * pour l'authentification Google sont présentes et ne sont
   * pas des valeurs par défaut de développement.
   * 
   * @private
   * @method isGoogleConfigured
   * @returns {boolean} True si Google OAuth est correctement configuré
   */
  private isGoogleConfigured(): boolean {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const appUrl = this.configService.get<string>('APP_URL');
    
    return !!(
      clientId &&
      clientSecret &&
      appUrl &&
      clientId !== 'my_client_id' &&         // Valeur par défaut à exclure
      clientSecret !== 'my_client_secret'    // Valeur par défaut à exclure
    );
  }

  /**
   * Vérifie la configuration Facebook OAuth
   * 
   * Valide que toutes les variables d'environnement nécessaires
   * pour l'authentification Facebook sont présentes et ne sont
   * pas des valeurs par défaut de développement.
   * 
   * @private
   * @method isFacebookConfigured
   * @returns {boolean} True si Facebook OAuth est correctement configuré
   */
  private isFacebookConfigured(): boolean {
    const appId = this.configService.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    const appUrl = this.configService.get<string>('APP_URL');
    
    return !!(
      appId &&
      appSecret &&
      appUrl &&
      appId !== 'my_app_id' &&              // Valeur par défaut à exclure
      appSecret !== 'my_app_secret'         // Valeur par défaut à exclure
    );
  }

  /**
   * Vérifie la configuration Twitter OAuth
   * 
   * Valide que toutes les variables d'environnement nécessaires
   * pour l'authentification Twitter sont présentes et ne sont
   * pas des valeurs par défaut de développement.
   * 
   * @private
   * @method isTwitterConfigured
   * @returns {boolean} True si Twitter OAuth est correctement configuré
   */
  private isTwitterConfigured(): boolean {
    const consumerKey = this.configService.get<string>('TWITTER_CONSUMER_KEY');
    const consumerSecret = this.configService.get<string>(
      'TWITTER_CONSUMER_SECRET',
    );
    const appUrl = this.configService.get<string>('APP_URL');
    
    return !!(
      consumerKey &&
      consumerSecret &&
      appUrl &&
      consumerKey !== 'my_consumer_key' &&      // Valeur par défaut à exclure
      consumerSecret !== 'my_consumer_secret'   // Valeur par défaut à exclure
    );
  }
}
