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

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' }, // 🔐 Access token plus court pour sécurité
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    ActivityModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    AuditService,
    RoleGuard,
    JwtStrategy,
    GoogleStrategy,
    FacebookStrategy,
    TwitterStrategy,
    MailService,
  ],
  exports: [AuthService, AuditService],
})
export class AuthModule {
  constructor(private configService: ConfigService) {
    // Log des configurations au démarrage
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
  }

  private isGoogleConfigured(): boolean {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const appUrl = this.configService.get<string>('APP_URL');
    return !!(
      clientId &&
      clientSecret &&
      appUrl &&
      clientId !== 'my_client_id' &&
      clientSecret !== 'my_client_secret'
    );
  }

  private isFacebookConfigured(): boolean {
    const appId = this.configService.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    const appUrl = this.configService.get<string>('APP_URL');
    return !!(
      appId &&
      appSecret &&
      appUrl &&
      appId !== 'my_app_id' &&
      appSecret !== 'my_app_secret'
    );
  }

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
      consumerKey !== 'my_consumer_key' &&
      consumerSecret !== 'my_consumer_secret'
    );
  }
}
