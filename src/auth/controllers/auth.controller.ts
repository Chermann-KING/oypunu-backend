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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../../users/dto/register.dto';
import { LoginDto } from '../../users/dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest, Response } from 'express';
import { ConfigService } from '@nestjs/config';

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

class SocialAuthResponseDto {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    provider: string;
  };
}

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private _authService: AuthService,
    private _configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: "Inscription d'un nouvel utilisateur" })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur inscrit avec succès',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: "Données d'inscription invalides" })
  @ApiResponse({
    status: 409,
    description: "Email ou nom d'utilisateur déjà utilisé",
  })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    return this._authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Données de connexion invalides' })
  @ApiResponse({ status: 401, description: 'Identifiants incorrects' })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto) {
    return this._authService.login(loginDto);
  }

  @Get('verify-email/:token')
  @ApiOperation({ summary: "Vérifier l'adresse email via un token" })
  @ApiResponse({
    status: 200,
    description: 'Email vérifié avec succès',
  })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  @ApiParam({
    name: 'token',
    description: "Token de vérification d'email",
  })
  async verifyEmail(@Param('token') token: string) {
    return this._authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: "Renvoyer l'email de vérification" })
  @ApiResponse({
    status: 200,
    description: 'Email de vérification renvoyé avec succès',
  })
  @ApiResponse({ status: 400, description: 'Email invalide' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiBody({ type: EmailDto })
  async resendVerificationEmail(@Body() body: { email: string }) {
    return this._authService.resendVerificationEmail(body.email);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Demander un lien de réinitialisation de mot de passe',
  })
  @ApiResponse({
    status: 200,
    description: 'Email de réinitialisation envoyé avec succès',
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiBody({ type: EmailDto })
  async forgotPassword(@Body() body: { email: string }) {
    return this._authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec un token' })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe réinitialisé avec succès',
  })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this._authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({
    summary: "Récupérer les informations de profil de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Profil récupéré avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiBearerAuth()
  getProfile(@Request() req: ExpressRequest) {
    return req.user;
  }

  /* Routes d'authentification sociale */

  // Google Authentication
  @Get('google')
  @ApiOperation({ summary: 'Authentification via Google' })
  @ApiResponse({
    status: 302,
    description: "Redirection vers l'authentification Google",
  })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Cette route sert de point d'entrée pour l'auth Google
    // Le middleware AuthGuard redirige vers Google
  }

  @Get('google/callback')
  @ApiOperation({ summary: "Callback pour l'authentification Google" })
  @ApiResponse({
    status: 302,
    description: 'Redirection vers le frontend avec token',
  })
  @UseGuards(AuthGuard('google'))
  googleAuthCallback(@Request() req: SocialAuthRequest, @Res() res: Response) {
    const { user } = req;
    // Génère un token temporaire pour stocker dans le localStorage
    const socialAuthToken = this._authService.generateSocialAuthToken(user);

    // Redirige vers le frontend avec le token
    return res.redirect(
      `${this._configService.get('CLIENT_URL')}/social-auth-success?token=${socialAuthToken}`,
    );
  }

  // Facebook Authentication
  @Get('facebook')
  @ApiOperation({ summary: 'Authentification via Facebook' })
  @ApiResponse({
    status: 302,
    description: "Redirection vers l'authentification Facebook",
  })
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {
    // Cette route sert de point d'entrée pour l'auth Facebook
    // Le middleware AuthGuard redirige vers Facebook
  }

  @Get('facebook/callback')
  @ApiOperation({ summary: "Callback pour l'authentification Facebook" })
  @ApiResponse({
    status: 302,
    description: 'Redirection vers le frontend avec token',
  })
  @UseGuards(AuthGuard('facebook'))
  facebookAuthCallback(
    @Request() req: SocialAuthRequest,
    @Res() res: Response,
  ) {
    const { user } = req;
    // Génère un token temporaire pour stocker dans le localStorage
    const socialAuthToken = this._authService.generateSocialAuthToken(user);

    // Redirige vers le frontend avec le token
    return res.redirect(
      `${this._configService.get('CLIENT_URL')}/social-auth-success?token=${socialAuthToken}`,
    );
  }

  // Twitter Authentication
  @Get('twitter')
  @ApiOperation({ summary: 'Authentification via Twitter' })
  @ApiResponse({
    status: 302,
    description: "Redirection vers l'authentification Twitter",
  })
  @UseGuards(AuthGuard('twitter'))
  async twitterAuth() {
    // Cette route sert de point d'entrée pour l'auth Twitter
    // Le middleware AuthGuard redirige vers Twitter
  }

  @Get('twitter/callback')
  @ApiOperation({ summary: "Callback pour l'authentification Twitter" })
  @ApiResponse({
    status: 302,
    description: 'Redirection vers le frontend avec token',
  })
  @UseGuards(AuthGuard('twitter'))
  twitterAuthCallback(@Request() req: SocialAuthRequest, @Res() res: Response) {
    const { user } = req;
    // Génère un token temporaire pour stocker dans le localStorage
    const socialAuthToken = this._authService.generateSocialAuthToken(user);

    // Redirige vers le frontend avec le token
    return res.redirect(
      `${this._configService.get('CLIENT_URL')}/social-auth-success?token=${socialAuthToken}`,
    );
  }

  // Endpoint pour récupérer les données utilisateur après authentification sociale
  @Get('social-auth-callback')
  @ApiOperation({
    summary: 'Récupérer les données utilisateur après authentification sociale',
  })
  @ApiResponse({
    status: 200,
    description: 'Données utilisateur récupérées avec succès',
    type: SocialAuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  @ApiQuery({
    name: 'token',
    description: "Token d'authentification sociale temporaire",
    required: true,
  })
  async getSocialAuthData(@Query('token') token: string) {
    return this._authService.validateSocialAuthToken(token);
  }
}
