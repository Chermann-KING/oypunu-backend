import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { JwtSecretValidatorService } from "../security/jwt-secret-validator.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject("IUserRepository")
    private readonly userRepository: IUserRepository,
    private readonly _jwtSecretValidator: JwtSecretValidatorService,
    private readonly configService: ConfigService
  ) {
    const jwtSecret =
      process.env.JWT_SECRET || configService.get<string>("JWT_SECRET");

    // Valider le secret JWT avant de passer à la classe parente
    const validationResult = _jwtSecretValidator.validateJwtSecret(jwtSecret);

    if (!validationResult.isValid) {
      throw new Error(
        `JWT_SECRET validation failed: ${validationResult.errors.join(", ")}`
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Méthode appelée automatiquement par Passport après validation du JWT
   */
  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Retourner l'utilisateur qui sera attaché à req.user
    return {
      _id: user._id || (user as any).id,
      userId: user._id || (user as any).id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
