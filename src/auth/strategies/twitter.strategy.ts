import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-twitter';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const consumerKey = configService.get<string>('TWITTER_CONSUMER_KEY');
    const consumerSecret = configService.get<string>('TWITTER_CONSUMER_SECRET');
    const appUrl = configService.get<string>('APP_URL');

    if (!consumerKey || !consumerSecret || !appUrl) {
      throw new Error('Configuration Twitter OAuth manquante');
    }

    super({
      consumerKey,
      consumerSecret,
      callbackURL: `${appUrl}/api/auth/twitter/callback`,
      includeEmail: true,
    });
  }

  async validate(
    token: string,
    tokenSecret: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ) {
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
  }
}
