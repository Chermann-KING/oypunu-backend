import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { JwtSecretValidatorService } from '../security/jwt-secret-validator.service';

interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy as new (options: StrategyOptions) => Strategy,
) {
  constructor(
    private _configService: ConfigService,
    private _authService: AuthService,
    private _jwtSecretValidator: JwtSecretValidatorService,
  ) {
    const jwtSecret = _configService.get<string>('JWT_SECRET');

    // Validation de base de l'existence du secret
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in the configuration');
    }

    // Validation complète de la sécurité du secret JWT
    const validationResult = this._jwtSecretValidator.validateJwtSecret(jwtSecret);
    
    if (!validationResult.isValid) {
      const errorMessage = `JWT_SECRET validation failed:\n${validationResult.errors.join('\n')}`;
      throw new Error(errorMessage);
    }

    // Log des warnings si le secret est valide mais faible
    if (validationResult.warnings.length > 0) {
      console.warn('⚠️ JWT_SECRET security warnings:');
      validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
      
      if (validationResult.recommendations.length > 0) {
        console.warn('💡 Recommendations:');
        validationResult.recommendations.forEach(rec => console.warn(`  ${rec}`));
      }
    }

    // Log du niveau de sécurité pour audit
    console.log(`🔐 JWT Secret security level: ${validationResult.strength.toUpperCase()} (score: ${validationResult.score}/100)`);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this._authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    // Retourner l'utilisateur complet depuis la base de données
    return user;
  }
}
