/**
 * @fileoverview Contrôleur REST d'authentification pour O'Ypunu
 *
 * Ce contrôleur gère toutes les opérations d'authentification et de gestion
 * des utilisateurs via une API REST complète. Il inclut l'inscription,
 * la connexion, l'authentification sociale, la gestion des tokens,
 * et la réinitialisation de mot de passe avec sécurité renforcée.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

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
import { TokenMetadata } from "../services/refresh-token.service";

/**
 * Interface pour les requêtes d'authentification sociale
 *
 * @interface SocialAuthRequest
 * @extends ExpressRequest
 */
interface SocialAuthRequest extends ExpressRequest {
  /** Données utilisateur retournées par le provider social */
  user: {
    /** Objet utilisateur avec identifiant */
    user: {
      /** ID unique de l'utilisateur */
      id: string;
    };
  };
}

/**
 * DTO pour demande par email (vérification, réinitialisation)
 *
 * @class EmailDto
 */
class EmailDto {
  /** Adresse email de l'utilisateur */
  email: string;
}

/**
 * DTO pour réinitialisation de mot de passe
 *
 * @class ResetPasswordDto
 */
class ResetPasswordDto {
  /** Token de réinitialisation sécurisé */
  token: string;
  /** Nouveau mot de passe */
  password: string;
}

/**
 * DTO de réponse d'authentification avec tokens
 *
 * @class AuthResponseDto
 */
class AuthResponseDto {
  /** Token d'accès JWT */
  access_token: string;
  /** Token de rafraîchissement */
  refresh_token: string;
  /** Données utilisateur authentifié */
  user: {
    /** ID unique utilisateur */
    id: string;
    /** Adresse email */
    email: string;
    /** Nom d'utilisateur */
    username: string;
    /** Rôle et permissions */
    role: string;
  };
}

/**
 * DTO pour rafraîchissement de token
 *
 * @class RefreshTokenDto
 */
class RefreshTokenDto {
  /** Token de rafraîchissement valide */
  refresh_token: string;
}

/**
 * DTO pour déconnexion sécurisée
 *
 * @class LogoutDto
 */
class LogoutDto {
  /** Token de rafraîchissement à révoquer */
  refresh_token: string;
}

/**
 * Contrôleur REST d'authentification pour O'Ypunu
 *
 * Ce contrôleur centralise toutes les opérations d'authentification de la plateforme
 * avec support complet des fonctionnalités modernes : JWT, OAuth social, gestion
 * sécurisée des tokens, et vérification d'identité.
 *
 * ## Fonctionnalités principales :
 *
 * ### 🔐 Authentification de base
 * - Inscription avec validation email
 * - Connexion sécurisée avec JWT
 * - Réinitialisation de mot de passe
 * - Vérification d'email automatique
 *
 * ### 🌍 Authentification sociale
 * - Google OAuth 2.0
 * - Facebook Login
 * - Twitter OAuth 1.0a
 * - Synchronisation profils sociaux
 *
 * ### 🛡️ Gestion sécurisée des tokens
 * - Tokens JWT à durée limitée
 * - Refresh tokens avec rotation
 * - Révocation et blacklisting
 * - Protection contre les attaques
 *
 * ### 📊 Métadatas et audit
 * - Logging des connexions
 * - Tracking des appareils
 * - Audit des actions sensibles
 * - Géolocalisation optionnelle
 *
 * @class AuthController
 * @version 1.0.0
 */
@ApiTags("authentication")
@Controller("auth")
export class AuthController {
  /**
   * Constructeur du contrôleur d'authentification
   *
   * @constructor
   * @param {AuthService} authService - Service principal d'authentification et gestion utilisateurs
   * @param {ConfigService} configService - Service de configuration pour les variables d'environnement
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection automatique :
   * @Controller('auth')
   * export class AuthController {
   *   constructor(
   *     private readonly authService: AuthService,
   *     private readonly configService: ConfigService
   *   ) {}
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  constructor(
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  /**
   * Inscription d'un nouvel utilisateur sur la plateforme O'Ypunu
   *
   * Cette méthode gère l'inscription complète d'un nouvel utilisateur avec validation
   * des données, vérification de l'unicité, et envoi automatique d'un email de
   * vérification. Collecte également les métadonnées de connexion pour la sécurité.
   *
   * @async
   * @method register
   * @param {RegisterDto} registerDto - Données complètes d'inscription utilisateur
   * @param {ExpressRequest} req - Objet de requête Express pour métadonnées
   * @returns {Promise<AuthResponseDto>} Réponse avec tokens et données utilisateur
   * @throws {BadRequestException} Si données d'inscription invalides
   * @throws {ConflictException} Si email ou nom d'utilisateur déjà utilisé
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/register
   * Content-Type: application/json
   *
   * {
   *   "email": "user@example.com",
   *   "username": "newuser",
   *   "password": "SecurePass123!",
   *   "hasAcceptedTerms": true,
   *   "hasAcceptedPrivacyPolicy": true
   * }
   *
   * // Réponse typique:
   * {
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "user": {
   *     "id": "60a1b2c3d4e5f6a7b8c9d0e1",
   *     "email": "user@example.com",
   *     "username": "newuser",
   *     "role": "user"
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req: ExpressRequest
  ) {
    console.log("🔍 DEBUG - Données reçues dans register:", registerDto);
    console.log(
      "🔍 DEBUG - Champs hasAcceptedTerms:",
      registerDto.hasAcceptedTerms
    );
    console.log(
      "🔍 DEBUG - Champs hasAcceptedPrivacyPolicy:",
      registerDto.hasAcceptedPrivacyPolicy
    );

    const clientIP = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    return this.authService.register(registerDto, {
      ip: clientIP,
      userAgent: userAgent,
    });
  }

  /**
   * Connexion d'un utilisateur existant sur la plateforme O'Ypunu
   *
   * Cette méthode gère la connexion d'un utilisateur avec validation des données
   * et génération de tokens JWT. Collecte également les métadonnées de connexion
   * pour la sécurité.
   *
   * @async
   * @method login
   * @param {LoginDto} loginDto - Données de connexion utilisateur
   * @param {ExpressRequest} req - Objet de requête Express pour métadonnées
   * @returns {Promise<AuthResponseDto>} Réponse avec tokens et données utilisateur
   * @throws {BadRequestException} Si données de connexion invalides
   * @throws {UnauthorizedException} Si identifiants incorrects
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/login
   * Content-Type: application/json
   *
   * {
   *   "email": "user@example.com",
   *   "password": "SecurePass123!"
   * }
   *
   * // Réponse typique:
   * {
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "user": {
   *     "id": "60a1b2c3d4e5f6a7b8c9d0e1",
   *     "email": "user@example.com",
   *     "username": "user123",
   *     "role": "user"
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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
  async login(@Body() loginDto: LoginDto, @Request() req: ExpressRequest) {
    const metadata: TokenMetadata = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };
    return this.authService.login(loginDto, metadata);
  }

  /**
   * Vérification de l'adresse email via un token
   *
   * Cette méthode permet de vérifier l'adresse email d'un utilisateur en utilisant
   * un token de vérification. Elle est généralement appelée après l'inscription
   * d'un nouvel utilisateur.
   *
   * @async
   * @method verifyEmail
   * @param {string} token - Token de vérification d'email
   * @returns {Promise<boolean>} Résultat de la vérification
   * @throws {BadRequestException} Si le token est invalide ou expiré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/verify-email/:token
   *
   * // Réponse typique:
   * {
   *   "success": true
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Renvoyer l'email de vérification à un utilisateur
   *
   * Cette méthode permet de renvoyer un email de vérification à un utilisateur
   * qui n'a pas encore confirmé son adresse email.
   *
   * @async
   * @method resendVerificationEmail
   * @param {string} email - Adresse email de l'utilisateur
   * @returns {Promise<boolean>} Résultat de l'envoi
   * @throws {BadRequestException} Si l'email est invalide
   * @throws {NotFoundException} Si l'utilisateur n'est pas trouvé
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/resend-verification
   * Content-Type: application/json
   *
   * {
   *   "email": "user@example.com"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Demander un lien de réinitialisation de mot de passe
   *
   * Cette méthode permet à un utilisateur de demander un lien de réinitialisation
   * de mot de passe en fournissant son adresse email. Un email sera envoyé
   * avec un lien pour réinitialiser le mot de passe.
   *
   * @async
   * @method forgotPassword
   * @param {string} email - Adresse email de l'utilisateur
   * @returns {Promise<boolean>} Résultat de l'envoi
   * @throws {BadRequestException} Si l'email est invalide
   * @throws {NotFoundException} Si l'utilisateur n'est pas trouvé
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/forgot-password
   * Content-Type: application/json
   *
   * {
   *   "email": "user@example.com"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Réinitialiser le mot de passe avec un token
   *
   * Cette méthode permet à un utilisateur de réinitialiser son mot de passe
   * en utilisant un token de réinitialisation. Le token est généralement envoyé
   * par email lors de la demande de réinitialisation.
   *
   * @async
   * @method resetPassword
   * @param {string} token - Token de réinitialisation
   * @param {string} password - Nouveau mot de passe
   * @returns {Promise<boolean>} Résultat de la réinitialisation
   * @throws {BadRequestException} Si le token est invalide ou expiré
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/reset-password
   * Content-Type: application/json
   *
   * {
   *   "token": "abc123",
   *   "password": "newpassword"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Récupérer les informations de profil de l'utilisateur connecté
   *
   * Cette méthode permet de récupérer les informations de profil de l'utilisateur
   * actuellement connecté. Elle nécessite une authentification valide.
   *
   * @async
   * @method getProfile
   * @returns {Promise<User>} Informations de profil de l'utilisateur
   * @throws {UnauthorizedException} Si l'utilisateur n'est pas authentifié
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/profile
   * Authorization: Bearer <token>
   *
   * // Réponse typique:
   * {
   *   "id": "user-id",
   *   "email": "user@example.com",
   *   "name": "John Doe"
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Obtenir la liste des stratégies d'authentification disponibles
   *
   * Cette méthode permet de récupérer la liste des stratégies d'authentification
   * configurées et disponibles sur la plateforme O'Ypunu. Elle indique quelles
   * méthodes de connexion sont opérationnelles (Google, Facebook, Twitter, etc.).
   *
   * @async
   * @method getAvailableStrategies
   * @returns {Promise<Object>} Liste des stratégies disponibles et leur statut
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/available-strategies
   *
   * // Réponse typique:
   * {
   *   "strategies": {
   *     "local": true,
   *     "google": true,
   *     "facebook": false,
   *     "twitter": true
   *   },
   *   "configured": {
   *     "jwt": true,
   *     "email": true,
   *     "database": true
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Redirection Google OAuth - Point d'entrée pour l'authentification
   *
   * Cette méthode gère la redirection vers le service d'authentification Google OAuth.
   * Elle vérifie d'abord si Google OAuth est configuré avant d'initier le processus
   * d'authentification. Si non configuré, elle retourne une erreur appropriée.
   *
   * @async
   * @method googleAuthRedirect
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers Google OAuth ou page d'erreur
   * @throws {ServiceUnavailableException} Si Google OAuth n'est pas configuré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/google/redirect
   *
   * // Succès: Redirection vers Google OAuth
   * // Échec: Redirection vers frontend avec erreur
   * // http://localhost:4200/auth/login?error=google_not_configured
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Get("google/redirect")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Res() res: Response) {
    if (!this.isGoogleConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=google_not_configured`
      );
    }
  }

  /**
   * Point d'entrée pour l'authentification Google
   *
   * Cette méthode gère la redirection vers le service d'authentification Google.
   * Elle vérifie d'abord si Google est configuré avant d'initier le processus
   * d'authentification. Si non configuré, elle retourne une erreur appropriée.
   *
   * @async
   * @method googleAuthCallback
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers Google ou page d'erreur
   * @throws {ServiceUnavailableException} Si Google n'est pas configuré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/google/callback
   *
   * // Succès: Redirection vers Google
   * // Échec: Redirection vers frontend avec erreur
   * // http://localhost:4200/auth/login?error=google_not_configured
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Get("google/callback")
  @ApiOperation({ summary: "Callback pour l'authentification Google" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers le frontend avec token",
  })
  @UseGuards(AuthGuard("google"))
  async googleAuthCallback(
    @Request() req: SocialAuthRequest,
    @Res() res: Response
  ) {
    if (!this.isGoogleConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=google_not_configured`
      );
    }

    try {
      const { user } = req;
      const socialAuthToken =
        await this.authService.generateSocialAuthToken(user);
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/social-auth-success?token=${socialAuthToken}`
      );
    } catch (error) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=social_auth_failed`
      );
    }
  }

  /**
   * Point d'entrée pour l'authentification Facebook
   *
   * Cette méthode gère la redirection vers le service d'authentification Facebook.
   * Elle vérifie d'abord si Facebook est configuré avant d'initier le processus
   * d'authentification. Si non configuré, elle retourne une erreur appropriée.
   *
   * @async
   * @method facebookAuth
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers Facebook ou page d'erreur
   * @throws {ServiceUnavailableException} Si Facebook n'est pas configuré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/facebook
   *
   * // Succès: Redirection vers Facebook OAuth
   * // Échec: Redirection vers frontend avec erreur
   * // http://localhost:4200/auth/login?error=facebook_not_configured
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Redirection Facebook OAuth - Point d'entrée pour l'authentification
   *
   * Cette méthode gère la redirection vers le service d'authentification Facebook OAuth.
   * Elle vérifie d'abord si Facebook OAuth est configuré avant d'initier le processus
   * d'authentification. Si non configuré, elle retourne une erreur appropriée.
   *
   * @async
   * @method facebookAuthRedirect
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers Facebook OAuth ou page d'erreur
   * @throws {ServiceUnavailableException} Si Facebook OAuth n'est pas configuré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/facebook/redirect
   *
   * // Succès: Redirection vers Facebook OAuth
   * // Échec: Redirection vers frontend avec erreur
   * // http://localhost:4200/auth/login?error=facebook_not_configured
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Get("facebook/redirect")
  @UseGuards(AuthGuard("facebook"))
  async facebookAuthRedirect(@Res() res: Response) {
    if (!this.isFacebookConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=facebook_not_configured`
      );
    }
  }

  /**
   * Callback pour l'authentification Facebook
   *
   * Cette méthode gère le callback de retour après l'authentification Facebook OAuth.
   * Elle traite la réponse de Facebook, génère les tokens d'authentification pour
   * l'utilisateur et redirige vers le frontend avec les informations nécessaires.
   *
   * @async
   * @method facebookAuthCallback
   * @param {SocialAuthRequest} req - Requête contenant les données utilisateur Facebook
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers le frontend avec token ou erreur
   * @throws {ServiceUnavailableException} Si Facebook OAuth n'est pas configuré
   * @throws {InternalServerErrorException} Si la génération du token échoue
   *
   * @example
   * ```typescript
   * // Appelé automatiquement par Facebook après authentification
   * GET /auth/facebook/callback?code=...
   *
   * // Succès: Redirection vers frontend avec token
   * // http://localhost:4200/social-auth-success?token=eyJhbGciOiJIUzI1NiIs...
   *
   * // Échec: Redirection vers login avec erreur
   * // http://localhost:4200/auth/login?error=social_auth_failed
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Get("facebook/callback")
  @ApiOperation({ summary: "Callback pour l'authentification Facebook" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers le frontend avec token",
  })
  @UseGuards(AuthGuard("facebook"))
  async facebookAuthCallback(
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
      const socialAuthToken =
        await this.authService.generateSocialAuthToken(user);
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/social-auth-success?token=${socialAuthToken}`
      );
    } catch (error) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=social_auth_failed`
      );
    }
  }

  /**
   * Point d'entrée pour l'authentification Twitter
   *
   * Cette méthode gère la redirection vers le service d'authentification Twitter.
   * Elle vérifie d'abord si Twitter OAuth est configuré avant d'initier le processus
   * d'authentification. Si non configuré, elle retourne une erreur appropriée.
   *
   * @async
   * @method twitterAuth
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers Twitter OAuth ou page d'erreur
   * @throws {ServiceUnavailableException} Si Twitter OAuth n'est pas configuré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/twitter
   *
   * // Succès: Redirection vers Twitter OAuth
   * // Échec: Redirection vers frontend avec erreur
   * // http://localhost:4200/auth/login?error=twitter_not_configured
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Redirection Twitter OAuth - Point d'entrée pour l'authentification
   *
   * Cette méthode gère la redirection vers le service d'authentification Twitter OAuth.
   * Elle vérifie d'abord si Twitter OAuth est configuré avant d'initier le processus
   * d'authentification. Si non configuré, elle retourne une erreur appropriée.
   *
   * @async
   * @method twitterAuthRedirect
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers Twitter OAuth ou page d'erreur
   * @throws {ServiceUnavailableException} Si Twitter OAuth n'est pas configuré
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/twitter/redirect
   *
   * // Succès: Redirection vers Twitter OAuth
   * // Échec: Redirection vers frontend avec erreur
   * // http://localhost:4200/auth/login?error=twitter_not_configured
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Get("twitter/redirect")
  @UseGuards(AuthGuard("twitter"))
  async twitterAuthRedirect(@Res() res: Response) {
    if (!this.isTwitterConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=twitter_not_configured`
      );
    }
  }

  /**
   * Callback pour l'authentification Twitter
   *
   * Cette méthode gère le callback de retour après l'authentification Twitter OAuth.
   * Elle traite la réponse de Twitter, génère les tokens d'authentification pour
   * l'utilisateur et redirige vers le frontend avec les informations nécessaires.
   *
   * @async
   * @method twitterAuthCallback
   * @param {SocialAuthRequest} req - Requête contenant les données utilisateur Twitter
   * @param {Response} res - Objet de réponse Express pour la redirection
   * @returns {Promise<void>} Redirection vers le frontend avec token ou erreur
   * @throws {ServiceUnavailableException} Si Twitter OAuth n'est pas configuré
   * @throws {InternalServerErrorException} Si la génération du token échoue
   *
   * @example
   * ```typescript
   * // Appelé automatiquement par Twitter après authentification
   * GET /auth/twitter/callback?code=...
   *
   * // Succès: Redirection vers frontend avec token
   * // http://localhost:4200/social-auth-success?token=eyJhbGciOiJIUzI1NiIs...
   *
   * // Échec: Redirection vers login avec erreur
   * // http://localhost:4200/auth/login?error=social_auth_failed
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Get("twitter/callback")
  @ApiOperation({ summary: "Callback pour l'authentification Twitter" })
  @ApiResponse({
    status: 302,
    description: "Redirection vers le frontend avec token",
  })
  @UseGuards(AuthGuard("twitter"))
  async twitterAuthCallback(
    @Request() req: SocialAuthRequest,
    @Res() res: Response
  ) {
    if (!this.isTwitterConfigured()) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=twitter_not_configured`
      );
    }

    try {
      const { user } = req;
      const socialAuthToken =
        await this.authService.generateSocialAuthToken(user);
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/social-auth-success?token=${socialAuthToken}`
      );
    } catch (error) {
      return res.redirect(
        `${this.configService.get("FRONTEND_URL") || "http://localhost:4200"}/auth/login?error=social_auth_failed`
      );
    }
  }

  /**
   * Récupérer les données utilisateur après authentification sociale
   *
   * Cette méthode permet de récupérer les données utilisateur après une
   * authentification sociale réussie en utilisant un token temporaire.
   * Le token est généré lors du callback d'authentification sociale et
   * doit être utilisé pour obtenir les informations finales de l'utilisateur.
   *
   * @async
   * @method getSocialAuthData
   * @param {string} token - Token d'authentification sociale temporaire
   * @returns {Promise<AuthResponseDto>} Données utilisateur et tokens d'authentification
   * @throws {BadRequestException} Si le token est invalide ou expiré
   * @throws {UnauthorizedException} Si l'authentification sociale échoue
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/social-auth-callback?token=eyJhbGciOiJIUzI1NiIs...
   *
   * // Réponse typique:
   * {
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "user": {
   *     "id": "60a1b2c3d4e5f6a7b8c9d0e1",
   *     "email": "user@example.com",
   *     "username": "socialuser",
   *     "role": "user"
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Obtenir la liste des stratégies d'authentification disponibles
   *
   * Cette méthode permet de récupérer la liste des stratégies d'authentification
   * configurées et disponibles sur la plateforme O'Ypunu. Elle indique quelles
   * méthodes de connexion sont opérationnelles (Google, Facebook, Twitter, etc.).
   *
   * @method getAvailableStrategies
   * @returns {Object} Liste des stratégies disponibles et leur statut
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /auth/available-strategies
   *
   * // Réponse typique:
   * {
   *   "strategies": {
   *     "local": true,
   *     "google": true,
   *     "facebook": false,
   *     "twitter": true
   *   },
   *   "configured": {
   *     "jwt": true,
   *     "email": true,
   *     "database": true
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Vérifier si Google OAuth est correctement configuré
   *
   * Cette méthode privée vérifie si les variables d'environnement nécessaires
   * pour l'authentification Google sont correctement configurées.
   * Elle s'assure que les clés ne sont pas vides ou contiennent des valeurs par défaut.
   *
   * @private
   * @method isGoogleConfigured
   * @returns {boolean} True si Google OAuth est correctement configuré
   *
   * @example
   * ```typescript
   * // Variables d'environnement requises pour Google:
   * // GOOGLE_CLIENT_ID=your_actual_client_id
   * // GOOGLE_CLIENT_SECRET=your_actual_client_secret
   * // APP_URL=http://localhost:3000
   *
   * if (this.isGoogleConfigured()) {
   *   // Google OAuth est disponible
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Vérifier si Facebook OAuth est correctement configuré
   *
   * Cette méthode privée vérifie si les variables d'environnement nécessaires
   * pour l'authentification Facebook sont correctement configurées.
   * Elle s'assure que les clés ne sont pas vides ou contiennent des valeurs par défaut.
   *
   * @private
   * @method isFacebookConfigured
   * @returns {boolean} True si Facebook OAuth est correctement configuré
   *
   * @example
   * ```typescript
   * // Variables d'environnement requises pour Facebook:
   * // FACEBOOK_APP_ID=your_actual_app_id
   * // FACEBOOK_APP_SECRET=your_actual_app_secret
   * // APP_URL=http://localhost:3000
   *
   * if (this.isFacebookConfigured()) {
   *   // Facebook OAuth est disponible
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  /**
   * Vérifier si Twitter OAuth est correctement configuré
   *
   * Cette méthode privée vérifie si les variables d'environnement nécessaires
   * pour l'authentification Twitter sont correctement configurées.
   * Elle s'assure que les clés ne sont pas vides ou contiennent des valeurs par défaut.
   *
   * @private
   * @method isTwitterConfigured
   * @returns {boolean} True si Twitter OAuth est correctement configuré
   *
   * @example
   * ```typescript
   * // Variables d'environnement requises pour Twitter:
   * // TWITTER_CONSUMER_KEY=your_actual_consumer_key
   * // TWITTER_CONSUMER_SECRET=your_actual_consumer_secret
   * // APP_URL=http://localhost:3000
   *
   * if (this.isTwitterConfigured()) {
   *   // Twitter OAuth est disponible
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
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

  // 🔄 NOUVELLES ROUTES POUR REFRESH TOKENS

  /**
   * Rafraîchir les tokens d'accès avec un refresh token valide
   *
   * Cette méthode permet de renouveler les tokens d'accès JWT en utilisant
   * un refresh token valide. Elle génère de nouveaux tokens d'accès et de
   * rafraîchissement tout en révoquant l'ancien refresh token pour la sécurité.
   * Collecte également les métadonnées de la requête pour l'audit de sécurité.
   *
   * @async
   * @method refreshTokens
   * @param {RefreshTokenDto} body - Objet contenant le refresh token à utiliser
   * @param {ExpressRequest} req - Objet de requête Express pour métadonnées
   * @returns {Promise<AuthResponseDto>} Nouveaux tokens et données utilisateur
   * @throws {UnauthorizedException} Si le refresh token est invalide ou expiré
   * @throws {BadRequestException} Si le format du refresh token est incorrect
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/refresh
   * Content-Type: application/json
   *
   * {
   *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   *
   * // Réponse typique:
   * {
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
   *   "user": {
   *     "id": "60a1b2c3d4e5f6a7b8c9d0e1",
   *     "email": "user@example.com",
   *     "username": "user123",
   *     "role": "user"
   *   }
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Post("refresh")
  @ApiOperation({ summary: "Rafraîchir les tokens d'accès" })
  @ApiResponse({
    status: 200,
    description: "Tokens rafraîchis avec succès",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Refresh token invalide ou expiré" })
  @ApiBody({ type: RefreshTokenDto })
  async refreshTokens(
    @Body() body: RefreshTokenDto,
    @Request() req: ExpressRequest
  ) {
    const metadata: TokenMetadata = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    return this.authService.refreshTokens(body.refresh_token, metadata);
  }

  /**
   * Déconnexion sécurisée avec révocation du refresh token
   *
   * Cette méthode permet de déconnecter un utilisateur de manière sécurisée
   * en révoquant son refresh token. Elle invalide le token spécifié pour
   * empêcher son utilisation future et assure une déconnexion propre.
   *
   * @async
   * @method logout
   * @param {LogoutDto} body - Objet contenant le refresh token à révoquer
   * @returns {Promise<Object>} Confirmation de la déconnexion réussie
   * @throws {BadRequestException} Si le refresh token est invalide ou manquant
   * @throws {NotFoundException} Si le refresh token n'est pas trouvé en base
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/logout
   * Content-Type: application/json
   *
   * {
   *   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   *
   * // Réponse typique:
   * {
   *   "message": "Déconnexion réussie"
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Post("logout")
  @ApiOperation({ summary: "Déconnexion avec révocation du refresh token" })
  @ApiResponse({
    status: 200,
    description: "Déconnexion réussie",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Déconnexion réussie" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Refresh token invalide" })
  @ApiBody({ type: LogoutDto })
  async logout(@Body() body: LogoutDto) {
    return this.authService.logout(body.refresh_token);
  }

  /**
   * Déconnexion globale - Révoque tous les refresh tokens d'un utilisateur
   *
   * Cette méthode permet de déconnecter un utilisateur de tous ses appareils
   * en révoquant simultanément tous les refresh tokens associés à son compte.
   * Utile en cas de compromission de compte ou pour forcer une déconnexion
   * globale pour des raisons de sécurité.
   *
   * @async
   * @method logoutAllDevices
   * @param {any} req - Objet de requête contenant les informations utilisateur
   * @returns {Promise<Object>} Confirmation de la déconnexion globale
   * @throws {UnauthorizedException} Si l'utilisateur n'est pas authentifié
   * @throws {NotFoundException} Si l'utilisateur n'est pas trouvé
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /auth/logout-all
   * Authorization: Bearer <access_token>
   *
   * // Réponse typique:
   * {
   *   "message": "Déconnexion effectuée sur tous les appareils"
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AuthController
   */
  @Post("logout-all")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Déconnexion globale - révoque tous les tokens" })
  @ApiResponse({
    status: 200,
    description: "Déconnexion globale réussie",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Déconnexion effectuée sur tous les appareils",
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  async logoutAllDevices(@Request() req: any) {
    const userId = req.user.id || req.user._id;
    return this.authService.logoutAllDevices(userId.toString());
  }
}
