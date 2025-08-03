/**
 * @fileoverview Stratégie d'authentification Google OAuth 2.0 pour O'Ypunu
 * 
 * Cette stratégie implémente l'authentification sociale via Google OAuth 2.0
 * avec validation des profils, gestion des erreurs et intégration sécurisée
 * au système d'authentification O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

/**
 * Stratégie Google OAuth 2.0 pour authentification sociale
 * 
 * Cette stratégie Passport permet aux utilisateurs de s'authentifier
 * via leur compte Google avec validation sécurisée des profils
 * et intégration automatique au système utilisateur O'Ypunu.
 * 
 * ## 🔐 Sécurité OAuth :
 * - Validation des scopes (email, profile)
 * - Vérification des tokens d'accès Google
 * - Validation des données de profil obligatoires
 * - Gestion des erreurs de configuration
 * 
 * ## 📊 Données collectées :
 * - Email principal (scope: email)
 * - Nom et prénom (scope: profile)
 * - Photo de profil (optionnelle)
 * - ID unique Google (providerId)
 * 
 * @class GoogleStrategy
 * @extends PassportStrategy
 * @version 1.0.0
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  private isConfigured: boolean = false;

  /**
   * Constructeur de la stratégie Google OAuth
   * 
   * Initialise la stratégie avec les credentials Google et configure
   * les scopes et URLs de callback. Vérifie la validité de la configuration.
   * 
   * @constructor
   * @param {ConfigService} configService - Service de configuration NestJS
   * @param {AuthService} authService - Service d'authentification O'Ypunu
   */
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    // Récupérer les variables d'environnement
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const appUrl = configService.get<string>('APP_URL');

    const options = {
      clientID: clientID || 'dummy-client-id',
      clientSecret: clientSecret || 'dummy-client-secret',
      callbackURL: appUrl
        ? `${appUrl}/api/auth/google/callback`
        : 'http://localhost:3000/api/auth/google/callback',
      scope: ['email', 'profile'],
      passReqToCallback: true as const,
    };

    super(options);

    if (
      !clientID ||
      !clientSecret ||
      !appUrl ||
      clientID === 'my_client_id' ||
      clientSecret === 'my_client_secret'
    ) {
      this.logger.warn('⚠️ Google OAuth non configuré - Strategy désactivée');
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    this.logger.log('✅ Google OAuth Strategy configurée et active');
  }

  /**
   * Valide et traite un profil utilisateur Google OAuth
   * 
   * Cette méthode est appelée automatiquement par Passport après une
   * authentification Google réussie. Elle valide les données du profil,
   * les normalise et les transmet au service d'authentification O'Ypunu.
   * 
   * @async
   * @method validate
   * @param {any} req - Objet de requête Express
   * @param {string} accessToken - Token d'accès Google OAuth
   * @param {string} refreshToken - Token de rafraîchissement Google
   * @param {Profile} profile - Profil utilisateur Google
   * @param {VerifyCallback} done - Callback Passport de validation
   * @returns {Promise<any>} Utilisateur validé ou erreur
   */
  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      // Vérifier si la strategy est configurée
      if (!this.isConfigured) {
        return done(new Error('Google OAuth non configuré'), undefined);
      }

      if (
        !profile.emails?.[0]?.value ||
        !profile.name?.givenName ||
        !profile.name?.familyName
      ) {
        return done(new Error('Profil Google incomplet'), undefined);
      }

      const user = {
        provider: 'google',
        providerId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        username: profile.emails[0].value.split('@')[0],
        profilePicture: profile.photos?.[0]?.value || null,
      };

      const result = await this.authService.validateSocialLogin(user);
      done(null, result);
    } catch (error) {
      this.logger.error('Erreur lors de la validation Google:', error);
      done(error, undefined);
    }
  }
}
