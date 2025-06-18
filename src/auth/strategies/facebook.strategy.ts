import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('FACEBOOK_APP_ID');
    const clientSecret = configService.get<string>('FACEBOOK_APP_SECRET');
    const appUrl = configService.get<string>('APP_URL');

    if (!clientID || !clientSecret || !appUrl) {
      throw new Error('Configuration Facebook OAuth manquante');
    }

    super({
      clientID,
      clientSecret,
      callbackURL: `${appUrl}/api/auth/facebook/callback`,
      profileFields: ['id', 'displayName', 'photos', 'email'],
      scope: ['email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ) {
    const { id, displayName, emails, photos } = profile;

    const user = {
      provider: 'facebook',
      providerId: id,
      email: emails?.[0]?.value || `${id}@facebook.com`, // ? Certains comptes FB n'ont pas d'email
      firstName: displayName?.split(' ')[0] || '',
      lastName: displayName?.split(' ')[1] || '',
      username: emails?.[0]?.value?.split('@')[0] || `fb_${id}`,
      profilePicture: photos?.[0]?.value || null,
    };

    const result = await this.authService.validateSocialLogin(user);
    done(null, result);
  }
}
