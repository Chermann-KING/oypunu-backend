/**
 * @fileoverview Stratégie d'authentification Twitter OAuth pour O'Ypunu
 * 
 * Cette stratégie implémente l'authentification sociale via Twitter OAuth 1.0a
 * avec gestion des profils incomplets, configuration dynamique sécurisée et
 * intégration robuste au système d'authentification O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-twitter';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

/**
 * Stratégie Twitter OAuth 1.0a pour authentification sociale
 * 
 * Cette stratégie Passport permet aux utilisateurs de s'authentifier
 * via leur compte Twitter avec gestion des particularités OAuth 1.0a
 * et fallback pour les données manquantes.
 * 
 * ## 🔐 Sécurité Twitter OAuth :
 * - Configuration OAuth 1.0a (Consumer Key/Secret)
 * - Demande d'email explicite (includeEmail: true)
 * - Gestion des profils sans email
 * - Validation des credentials au démarrage
 * 
 * ## 📊 Données collectées :
 * - Email (si autorisé par l'utilisateur)
 * - Username Twitter (@handle)
 * - Nom d'affichage (displayName)
 * - Photo de profil (optionnelle)
 * - ID unique Twitter (providerId)
 * 
 * ## ⚠️ Particularités Twitter :
 * - OAuth 1.0a (plus complexe que OAuth 2.0)
 * - Email optionnel selon permissions utilisateur
 * - Génération d'email factice si nécessaire
 * - Configuration dynamique des credentials
 * 
 * @class TwitterStrategy
 * @extends PassportStrategy
 * @version 1.0.0
 */
@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  private readonly logger = new Logger(TwitterStrategy.name);
  private isConfigured: boolean = false;

  /**
   * Constructeur de la stratégie Twitter OAuth
   * 
   * Initialise la stratégie avec configuration dynamique des credentials
   * Twitter et gestion gracieuse des configurations manquantes.
   * Utilise une approche défensive pour éviter les erreurs au démarrage.
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
    const consumerKey = configService.get<string>('TWITTER_CONSUMER_KEY');
    const consumerSecret = configService.get<string>('TWITTER_CONSUMER_SECRET');
    const appUrl = configService.get<string>('APP_URL');

    // Toujours appeler le super en premier avec les valeurs par défaut
    super({
      consumerKey: 'dummy-consumer-key',
      consumerSecret: 'dummy-consumer-secret',
      callbackURL: 'http://localhost:3000/api/auth/twitter/callback',
      includeEmail: true,
    });

    // Ne pas lancer d'erreur, mais marquer comme non configuré
    if (
      !consumerKey ||
      !consumerSecret ||
      !appUrl ||
      consumerKey === 'my_consumer_key' ||
      consumerSecret === 'my_consumer_secret'
    ) {
      this.logger.warn('⚠️ Twitter OAuth non configuré - Strategy désactivée');
      this.isConfigured = false;
      return;
    }

    // Configuration normale si les credentials sont présents
    this.isConfigured = true;

    // Mettre à jour la configuration de la stratégie si des informations d'identification valides existent
    Object.assign((this as any)._oauth, {
      consumerKey,
      consumerSecret,
      callbackURL: `${appUrl}/api/auth/twitter/callback`,
    });

    this.logger.log('✅ Twitter OAuth Strategy configurée et active');
  }

  /**
   * Valide et traite un profil utilisateur Twitter OAuth
   * 
   * Cette méthode est appelée automatiquement par Passport après une
   * authentification Twitter réussie. Elle normalise les données du profil
   * et gère les particularités Twitter (email optionnel, username unique).
   * 
   * @async
   * @method validate
   * @param {string} token - Token d'accès OAuth 1.0a
   * @param {string} tokenSecret - Secret du token OAuth 1.0a
   * @param {Profile} profile - Profil utilisateur Twitter
   * @param {Function} done - Callback Passport de validation
   * @returns {Promise<void>} Utilisateur validé ou erreur
   */
  async validate(
    token: string,
    tokenSecret: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ) {
    try {
      // Vérifier si la strategy est configurée
      if (!this.isConfigured) {
        return done(new Error('Twitter OAuth non configuré'), null);
      }

      const { id, username, displayName, emails, photos } = profile;

      const user = {
        provider: 'twitter',
        providerId: id,
        email: emails?.[0]?.value || `${id}@twitter.com`,
        firstName: displayName?.split(' ')[0] || '',
        lastName: displayName?.split(' ')[1] || '',
        username: username || `twitter_${id}`,
        profilePicture: photos?.[0]?.value || null,
      };

      const result = await this.authService.validateSocialLogin(user);
      done(null, result);
    } catch (error) {
      this.logger.error('Erreur lors de la validation Twitter:', error);
      done(error, null);
    }
  }
}
