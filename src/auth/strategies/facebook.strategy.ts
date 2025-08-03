/**
 * @fileoverview Stratégie d'authentification Facebook OAuth pour O'Ypunu
 * 
 * Cette stratégie implémente l'authentification sociale via Facebook OAuth
 * avec gestion des profils incomplets, validation sécurisée et intégration
 * robuste au système d'authentification O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

/**
 * Stratégie Facebook OAuth pour authentification sociale
 * 
 * Cette stratégie Passport permet aux utilisateurs de s'authentifier
 * via leur compte Facebook avec gestion des cas particuliers
 * (emails manquants, profils incomplets) et intégration sécurisée.
 * 
 * ## 🔐 Sécurité Facebook OAuth :
 * - Validation des scopes (email)
 * - Gestion des profils sans email
 * - Vérification des tokens d'accès
 * - Fallback pour données manquantes
 * 
 * ## 📊 Données collectées :
 * - Email (si disponible, sinon email factice)
 * - Nom d'affichage (displayName)
 * - Photo de profil (optionnelle)
 * - ID unique Facebook (providerId)
 * 
 * ## ⚠️ Particularités Facebook :
 * - Certains comptes n'ont pas d'email public
 * - Génération d'email factice si nécessaire
 * - Parsing du nom d'affichage en prénom/nom
 * - Gestion gracieuse des erreurs de configuration
 * 
 * @class FacebookStrategy
 * @extends PassportStrategy
 * @version 1.0.0
 */
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookStrategy.name);
  private isConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET');
    const appUrl = configService.get<string>('APP_URL');

    const isInvalidConfig =
      !clientID ||
      !clientSecret ||
      !appUrl ||
      clientID === 'my_app_id' ||
      clientSecret === 'my_app_secret';

    super({
      clientID: isInvalidConfig ? 'dummy-app-id' : clientID,
      clientSecret: isInvalidConfig ? 'dummy-app-secret' : clientSecret,
      callbackURL: `${appUrl}/api/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'photos', 'email'],
      scope: ['email'],
    });

    if (isInvalidConfig) {
      this.isConfigured = false;
      this.logger.warn('⚠️ Facebook OAuth non configuré - Strategy désactivée');
      return;
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ) {
    try {
      // Vérifier si la strategy est configurée
      if (!this.isConfigured) {
        return done(new Error('Facebook OAuth non configuré'), null);
      }

      const { id, displayName, emails, photos } = profile;

      const user = {
        provider: 'facebook',
        providerId: id,
        email: emails?.[0]?.value || `${id}@facebook.com`, // Certains comptes FB n'ont pas d'email
        firstName: displayName?.split(' ')[0] || '',
        lastName: displayName?.split(' ')[1] || '',
        username: emails?.[0]?.value?.split('@')[0] || `fb_${id}`,
        profilePicture: photos?.[0]?.value || null,
      };

      const result = await this.authService.validateSocialLogin(user);
      done(null, result);
    } catch (error) {
      this.logger.error('Erreur lors de la validation Facebook:', error);
      done(error, null);
    }
  }
}
