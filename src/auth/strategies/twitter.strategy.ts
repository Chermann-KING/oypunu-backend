import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-twitter';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  private readonly logger = new Logger(TwitterStrategy.name);
  private isConfigured: boolean = false;

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
