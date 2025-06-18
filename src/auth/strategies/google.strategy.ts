import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback, Profile } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../services/auth.service";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  private readonly logger = new Logger(GoogleStrategy.name);
  private isConfigured: boolean = false;

  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    // Récupérer les variables d'environnement
    const clientID = configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = configService.get<string>("GOOGLE_CLIENT_SECRET");
    const appUrl = configService.get<string>("APP_URL");

    const options = {
      clientID: clientID || "dummy-client-id",
      clientSecret: clientSecret || "dummy-client-secret",
      callbackURL: appUrl
        ? `${appUrl}/api/auth/google/callback`
        : "http://localhost:3000/api/auth/google/callback",
      scope: ["email", "profile"],
      passReqToCallback: true as true,
    };

    super(options);

    if (
      !clientID ||
      !clientSecret ||
      !appUrl ||
      clientID === "my_client_id" ||
      clientSecret === "my_client_secret"
    ) {
      this.logger.warn("⚠️ Google OAuth non configuré - Strategy désactivée");
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    this.logger.log("✅ Google OAuth Strategy configurée et active");
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ): Promise<any> {
    try {
      // Vérifier si la strategy est configurée
      if (!this.isConfigured) {
        return done(new Error("Google OAuth non configuré"), null);
      }

      if (
        !profile.emails?.[0]?.value ||
        !profile.name?.givenName ||
        !profile.name?.familyName
      ) {
        return done(new Error("Profil Google incomplet"), null);
      }

      const user = {
        provider: "google",
        providerId: profile.id,
        email: profile.emails[0].value,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        username: profile.emails[0].value.split("@")[0],
        profilePicture: profile.photos?.[0]?.value || null,
      };

      const result = await this.authService.validateSocialLogin(user);
      done(null, result);
    } catch (error) {
      this.logger.error("Erreur lors de la validation Google:", error);
      done(error, null);
    }
  }
}
