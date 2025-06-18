import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const appUrl = configService.get<string>('APP_URL');

    if (!clientID || !clientSecret || !appUrl) {
      throw new Error('Configuration Google OAuth manquante');
    }

    super({
      clientID,
      clientSecret,
      callbackURL: `${appUrl}/api/auth/google/callback`,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    if (
      !profile.emails?.[0]?.value ||
      !profile.name?.givenName ||
      !profile.name?.familyName
    ) {
      return done(new Error('Profil Google incomplet'));
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
  }
}
