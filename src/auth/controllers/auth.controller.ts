import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Res,
  Query,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthService } from "../services/auth.service";
import { RegisterDto } from "../../users/dto/register.dto";
import { LoginDto } from "../../users/dto/login.dto";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { AuthGuard } from "@nestjs/passport";
import { Request as ExpressRequest, Response } from "express";
import { ConfigService } from "@nestjs/config";

interface SocialAuthRequest extends ExpressRequest {
  user: {
    user: {
      id: string;
    };
  };
}

// Classes pour la documentation Swagger
class EmailDto {
  email: string;
}

class ResetPasswordDto {
  token: string;
  password: string;
}

class AuthResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

@ApiTags("authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Inscription d'un nouvel utilisateur" })
  @ApiResponse({
    status: 201,
    description: "Utilisateur inscrit avec succès",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: "Données d'inscription invalides" })
  @ApiResponse({
    status: 409,
    description: "Email ou nom d'utilisateur déjà utilisé",
  })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @ApiOperation({ summary: "Connexion utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Connexion réussie",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: "Données de connexion invalides" })
  @ApiResponse({ status: 401, description: "Identifiants incorrects" })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("verify-email/:token")
  @ApiOperation({ summary: "Vérifier l'adresse email via un token" })
  @ApiResponse({
    status: 200,
    description: "Email vérifié avec succès",
  })
  @ApiResponse({ status: 400, description: "Token invalide ou expiré" })
  @ApiParam({
    name: "token",
    description: "Token de vérification d'email",
  })
  async verifyEmail(@Param("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post("resend-verification")
  @ApiOperation({ summary: "Renvoyer l'email de vérification" })
  @ApiResponse({
    status: 200,
    description: "Email de vérification renvoyé avec succès",
  })
  @ApiResponse({ status: 400, description: "Email invalide" })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  @ApiBody({ type: EmailDto })
  async resendVerificationEmail(@Body() body: { email: string }) {
    return this.authService.resendVerificationEmail(body.email);
  }

  @Post("forgot-password")
  @ApiOperation({
    summary: "Demander un lien de réinitialisation de mot de passe",
  })
  @ApiResponse({
    status: 200,
    description: "Email de réinitialisation envoyé avec succès",
  })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  @ApiBody({ type: EmailDto })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Réinitialiser le mot de passe avec un token" })
  @ApiResponse({
    status: 200,
    description: "Mot de passe réinitialisé avec succès",
  })
  @ApiResponse({ status: 400, description: "Token invalide ou expiré" })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  @ApiOperation({
    summary: "Récupérer les informations de profil de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Profil récupéré avec succès",
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiBearerAuth()
  getProfile(@Request() req: ExpressRequest) {
    return req.user;
  }

  /* Routes d'authentification sociale - CONDITIONNELLES */

  // Google Authentication
  @Get("google")
  @ApiOperation({ summary: "Authentification via Google" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers l'authentification Google",
  })
  async googleAuth(@Res() res: Response) {
    if (!this.isGoogleConfigured()) {
      return res.status(503).json({
        error: "Google OAuth non configuré",
        message: "Cette méthode d'authentification n'est pas disponible",
      });
    }
    return res.redirect("/api/auth/google/redirect");
  }

  @Get("google/redirect")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Res() res: Response) {
    if (!this.isGoogleConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=google_not_configured`
      );
    }
  }

  @Get("google/callback")
  @ApiOperation({ summary: "Callback pour l'authentification Google" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers le frontend avec token",
  })
  @UseGuards(AuthGuard("google"))
  googleAuthCallback(@Request() req: SocialAuthRequest, @Res() res: Response) {
    if (!this.isGoogleConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=google_not_configured`
      );
    }

    try {
      const { user } = req;
      const socialAuthToken = this.authService.generateSocialAuthToken(user);
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/social-auth-success?token=${socialAuthToken}`
      );
    } catch (error) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=social_auth_failed`
      );
    }
  }

  // Facebook Authentication
  @Get("facebook")
  @ApiOperation({ summary: "Authentification via Facebook" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers l'authentification Facebook",
  })
  async facebookAuth(@Res() res: Response) {
    if (!this.isFacebookConfigured()) {
      return res.status(503).json({
        error: "Facebook OAuth non configuré",
        message: "Cette méthode d'authentification n'est pas disponible",
      });
    }
    return res.redirect("/api/auth/facebook/redirect");
  }

  @Get("facebook/redirect")
  @UseGuards(AuthGuard("facebook"))
  async facebookAuthRedirect(@Res() res: Response) {
    if (!this.isFacebookConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=facebook_not_configured`
      );
    }
  }

  @Get("facebook/callback")
  @ApiOperation({ summary: "Callback pour l'authentification Facebook" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers le frontend avec token",
  })
  @UseGuards(AuthGuard("facebook"))
  facebookAuthCallback(
    @Request() req: SocialAuthRequest,
    @Res() res: Response
  ) {
    if (!this.isFacebookConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=facebook_not_configured`
      );
    }

    try {
      const { user } = req;
      const socialAuthToken = this.authService.generateSocialAuthToken(user);
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/social-auth-success?token=${socialAuthToken}`
      );
    } catch (error) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=social_auth_failed`
      );
    }
  }

  // Twitter Authentication
  @Get("twitter")
  @ApiOperation({ summary: "Authentification via Twitter" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers l'authentification Twitter",
  })
  async twitterAuth(@Res() res: Response) {
    if (!this.isTwitterConfigured()) {
      return res.status(503).json({
        error: "Twitter OAuth non configuré",
        message: "Cette méthode d'authentification n'est pas disponible",
      });
    }
    return res.redirect("/api/auth/twitter/redirect");
  }

  @Get("twitter/redirect")
  @UseGuards(AuthGuard("twitter"))
  async twitterAuthRedirect(@Res() res: Response) {
    if (!this.isTwitterConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=twitter_not_configured`
      );
    }
  }

  @Get("twitter/callback")
  @ApiOperation({ summary: "Callback pour l'authentification Twitter" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers le frontend avec token",
  })
  @UseGuards(AuthGuard("twitter"))
  twitterAuthCallback(@Request() req: SocialAuthRequest, @Res() res: Response) {
    if (!this.isTwitterConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=twitter_not_configured`
      );
    }

    try {
      const { user } = req;
      const socialAuthToken = this.authService.generateSocialAuthToken(user);
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/social-auth-success?token=${socialAuthToken}`
      );
    } catch (error) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=social_auth_failed`
      );
    }
  }

  // Endpoint pour récupérer les données utilisateur après authentification sociale
  @Get("social-auth-callback")
  @ApiOperation({
    summary: "Récupérer les données utilisateur après authentification sociale",
  })
  @ApiResponse({
    status: 200,
    description: "Données utilisateur récupérées avec succès",
  })
  @ApiResponse({ status: 400, description: "Token invalide ou expiré" })
  @ApiQuery({
    name: "token",
    description: "Token d'authentification sociale temporaire",
    required: true,
  })
  async getSocialAuthData(@Query("token") token: string) {
    return this.authService.validateSocialAuthToken(token);
  }

  // Endpoint pour connaître les strategies disponibles
  @Get("available-strategies")
  @ApiOperation({
    summary: "Obtenir la liste des strategies d'authentification disponibles",
  })
  getAvailableStrategies() {
    return {
      strategies: {
        local: true,
        google: this.isGoogleConfigured(),
        facebook: this.isFacebookConfigured(),
        twitter: this.isTwitterConfigured(),
      },
      configured: {
        jwt: !!this.configService.get("JWT_SECRET"),
        email: !!this.configService.get("MAIL_USER"),
        database: !!this.configService.get("MONGODB_URI"),
      },
    };
  }

  // Méthodes utilitaires privées
  private isGoogleConfigured(): boolean {
    const clientId = this.configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = this.configService.get<string>("GOOGLE_CLIENT_SECRET");
    const appUrl = this.configService.get<string>("APP_URL");
    return !!(
      clientId &&
      clientSecret &&
      appUrl &&
      clientId !== "my_client_id" &&
      clientSecret !== "my_client_secret" &&
      clientId.trim() !== "" &&
      clientSecret.trim() !== ""
    );
  }

  private isFacebookConfigured(): boolean {
    const appId = this.configService.get<string>("FACEBOOK_APP_ID");
    const appSecret = this.configService.get<string>("FACEBOOK_APP_SECRET");
    const appUrl = this.configService.get<string>("APP_URL");
    return !!(
      appId &&
      appSecret &&
      appUrl &&
      appId !== "my_app_id" &&
      appSecret !== "my_app_secret" &&
      appId.trim() !== "" &&
      appSecret.trim() !== ""
    );
  }

  private isTwitterConfigured(): boolean {
    const consumerKey = this.configService.get<string>("TWITTER_CONSUMER_KEY");
    const consumerSecret = this.configService.get<string>(
      "TWITTER_CONSUMER_SECRET"
    );
    const appUrl = this.configService.get<string>("APP_URL");
    return !!(
      consumerKey &&
      consumerSecret &&
      appUrl &&
      consumerKey !== "my_consumer_key" &&
      consumerSecret !== "my_consumer_secret" &&
      consumerKey.trim() !== "" &&
      consumerSecret.trim() !== ""
    );
  }
}
