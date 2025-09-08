/**
 * @fileoverview Service d'authentification - Gestion complète des utilisateurs
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { User } from "../../users/schemas/user.schema";
import { RegisterDto } from "../../users/dto/register.dto";
import { LoginDto } from "../../users/dto/login.dto";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../../common/services/mail.service";
import { ActivityService } from "../../common/services/activity.service";
import { RefreshTokenService, TokenMetadata } from "./refresh-token.service";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";

/**
 * Interface pour l'utilisateur provenant d'un provider social
 * @interface SocialUser
 */
interface SocialUser {
  provider: string;
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
}

/**
 * Service principal d'authentification pour O'Ypunu
 *
 * Gère l'inscription, connexion, vérification email, réinitialisation de mot de passe,
 * authentification sociale (Google, Facebook), gestion des tokens JWT et refresh tokens.
 *
 * @class AuthService
 */
@Injectable()
export class AuthService {
  private readonly _logger = new Logger(AuthService.name);

  /**
   * Constructeur du service d'authentification
   * @param {IUserRepository} userRepository - Repository pour opérations utilisateur
   * @param {JwtService} _jwtService - Service JWT pour génération et validation tokens
   * @param {ConfigService} configService - Service de configuration
   * @param {MailService} _mailService - Service d'envoi d'emails
   * @param {ActivityService} activityService - Service de logging d'activités
   * @param {RefreshTokenService} refreshTokenService - Service de gestion refresh tokens
   */
  constructor(
    @Inject("IUserRepository") private userRepository: IUserRepository,
    private _jwtService: JwtService,
    private configService: ConfigService,
    private _mailService: MailService,
    private activityService: ActivityService,
    private refreshTokenService: RefreshTokenService
  ) {}

  /**
   * Inscrit un nouvel utilisateur avec validation complète
   *
   * @async
   * @function register
   * @param {RegisterDto} registerDto - Données d'inscription utilisateur
   * @param {object} requestInfo - Informations de la requête (IP, User-Agent)
   * @param {string} requestInfo.ip - Adresse IP du client
   * @param {string} requestInfo.userAgent - User-Agent du navigateur
   * @returns {Promise<{message: string}>} Message de confirmation d'inscription
   * @throws {BadRequestException} Si email/username existe ou conditions non acceptées
   * @example
   * const result = await authService.register({
   *   email: 'user@example.com',
   *   username: 'newuser',
   *   password: 'SecurePass123!',
   *   hasAcceptedTerms: true,
   *   hasAcceptedPrivacyPolicy: true
   * }, { ip: '192.168.1.1', userAgent: 'Mozilla/5.0...' });
   */
  async register(
    registerDto: RegisterDto,
    requestInfo?: { ip: string; userAgent: string }
  ): Promise<{ message: string }> {
    const {
      email,
      username,
      password,
      hasAcceptedTerms,
      hasAcceptedPrivacyPolicy,
    } = registerDto;

    // Vérifier si l'email et le nom d'utilisateur existent déjà
    const [emailExists, usernameExists] = await Promise.all([
      this.userRepository.existsByEmail(email),
      this.userRepository.existsByUsername(username),
    ]);

    if (emailExists) {
      throw new BadRequestException("Cet email est déjà utilisé");
    }
    if (usernameExists) {
      throw new BadRequestException("Ce nom d'utilisateur est déjà pris");
    }

    // Vérifier que l'utilisateur a accepté les conditions
    if (!hasAcceptedTerms || !hasAcceptedPrivacyPolicy) {
      throw new BadRequestException(
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité"
      );
    }

    // Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Création du token de vérification
    const verificationToken: string = uuidv4();
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 24); // 24h de validité

    // Préparer les informations de consentement
    const consentTimestamp = new Date();
    const termsVersion = "v1.0"; // Version actuelle des CGU
    const privacyPolicyVersion = "v1.0"; // Version actuelle de la politique

    // Création de l'utilisateur avec informations de consentement
    const newUser = await this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpires: tokenExpiration,
      isEmailVerified: false,
      // Informations de consentement légal
      hasAcceptedTerms: true,
      hasAcceptedPrivacyPolicy: true,
      termsAcceptedAt: consentTimestamp,
      privacyPolicyAcceptedAt: consentTimestamp,
      termsAcceptedVersion: termsVersion,
      privacyPolicyAcceptedVersion: privacyPolicyVersion,
      consentIP: requestInfo?.ip || "unknown",
      consentUserAgent: requestInfo?.userAgent || "unknown",
      registrationIP: requestInfo?.ip || "unknown",
    } as any); // Cast temporaire pour compatibilité RegisterDto

    // 📊 Logger l'activité d'inscription
    try {
      await this.activityService.logUserRegistered(
        (newUser as any)._id.toString(),
        newUser.username
      );
      console.log(
        '✅ Activité "user_registered" enregistrée pour:',
        newUser.username
      );
    } catch (error) {
      console.error(
        "❌ Erreur lors du logging d'activité d'inscription:",
        error
      );
    }

    try {
      // Envoi de l'email de vérification
      await this._mailService.sendVerificationEmail(
        email,
        verificationToken,
        username
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(
        `Erreur lors de l'envoi de l'email de vérification: ${errorMessage}`
      );
      // On ne relance pas l'erreur pour éviter de bloquer le processus d'inscription
    }

    return {
      message:
        "Inscription réussie. Veuillez vérifier votre email pour activer votre compte.",
    };
  }

  /**
   * Vérifie l'adresse email d'un utilisateur via token
   *
   * @async
   * @function verifyEmail
   * @param {string} token - Token de vérification email
   * @returns {Promise<{message: string}>} Message de confirmation de vérification
   * @throws {BadRequestException} Si le token est invalide ou expiré
   * @example
   * const result = await authService.verifyEmail('uuid-token-here');
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmailVerificationToken(token);

    if (!user) {
      throw new BadRequestException("Token invalide ou expiré");
    }

    // Marquer l'email comme vérifié et vider le token
    await this.userRepository.markEmailAsVerified((user as any)._id);
    await this.userRepository.updateEmailVerificationToken(
      (user as any)._id,
      ""
    );

    return {
      message:
        "Email vérifié avec succès. Vous pouvez maintenant vous connecter.",
    };
  }

  /**
   * Renvoie un nouvel email de vérification
   *
   * @async
   * @function resendVerificationEmail
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<{ message: string }>} Message de confirmation
   * @throws {BadRequestException} Si l'utilisateur n'est pas trouvé
   * @example
   * const result = await authService.resendVerificationEmail('user@example.com');
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new BadRequestException("Utilisateur non trouvé");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException("Cet email est déjà vérifié");
    }

    // Générer un nouveau token
    const verificationToken = uuidv4();

    // Mettre à jour le token de vérification
    await this.userRepository.updateEmailVerificationToken(
      (user as any)._id,
      verificationToken
    );

    try {
      // Envoi de l'email
      await this._mailService.sendVerificationEmail(
        email,
        verificationToken,
        user.username
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(
        `Erreur lors de l'envoi de l'email de vérification: ${errorMessage}`
      );
      // On ne relance pas l'erreur pour éviter de bloquer le processus
    }

    return {
      message: "Un nouvel email de vérification a été envoyé.",
    };
  }

  /**
   * Authentifie un utilisateur et génère les tokens d'accès
   *
   * @async
   * @function login
   * @param {LoginDto} loginDto - Données de connexion (email/password)
   * @param {TokenMetadata} metadata - Métadonnées optionnelles pour le token
   * @returns {Promise<{tokens: {access_token: string, refresh_token: string}, user: any}>} Tokens et données utilisateur
   * @throws {UnauthorizedException} Si email/password incorrect ou email non vérifié
   * @example
   * const result = await authService.login({
   *   email: 'user@example.com',
   *   password: 'userpassword'
   * });
   */
  async login(
    loginDto: LoginDto,
    metadata?: TokenMetadata
  ): Promise<{
    tokens: { access_token: string; refresh_token: string };
    user: any;
  }> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        "Veuillez vérifier votre email avant de vous connecter"
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Email ou mot de passe incorrect");
    }

    // ✅ AUTOMATIQUEMENT activer l'utilisateur et mettre à jour sa dernière activité lors du login
    await this.userRepository.update((user as any)._id, {
      isActive: true,
      lastActive: new Date(),
      lastLogin: new Date(),
    });

    console.log("🔐 Connexion réussie - utilisateur activé:", user.username);

    // 📊 Logger l'activité de connexion
    try {
      await this.activityService.logUserLoggedIn(
        user._id.toString(),
        user.username
      );
      console.log(
        '✅ Activité "user_logged_in" enregistrée pour:',
        user.username
      );
    } catch (error) {
      console.error(
        "❌ Erreur lors du logging d'activité de connexion:",
        error
      );
    }

    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    // 🔐 Générer une paire de tokens (access + refresh)
    const tokenPair = await this.refreshTokenService.generateTokenPair(
      user._id.toString(),
      payload,
      metadata
    );

    return {
      tokens: {
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
      },
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        nativeLanguage: user.nativeLanguageId,
        learningLanguages: user.learningLanguageIds,
        profilePicture: user.profilePicture,
      },
    };
  }

  /**
   * Demande de réinitialisation du mot de passe
   *
   * @async
   * @function forgotPassword
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<{ message: string }>} Message de confirmation
   * @throws {BadRequestException} Si aucun compte n'est associé à cet email
   * @example
   * const result = await authService.forgotPassword('user@example.com');
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new BadRequestException("Aucun compte associé à cet email");
    }

    const resetToken = uuidv4();
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 1); // 1h de validité

    // Mise à jour du token de reset via le repository
    await this.userRepository.updatePasswordResetToken(
      (user as any)._id,
      resetToken,
      tokenExpiration
    );

    try {
      // Envoi de l'email de réinitialisation
      await this._mailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.username
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      this._logger.error(
        `Erreur lors de l'envoi de l'email de réinitialisation: ${errorMessage}`
      );
      // On ne relance pas l'erreur pour éviter de bloquer le processus
    }

    return {
      message: "Un email de réinitialisation de mot de passe a été envoyé.",
    };
  }

  /**
   * Réinitialisation du mot de passe
   *
   * @async
   * @function resetPassword
   * @param {string} token - Token de réinitialisation
   * @param {string} newPassword - Nouveau mot de passe
   * @returns {Promise<{ message: string }>} Message de confirmation
   * @throws {BadRequestException} Si le token est invalide ou expiré
   * @example
   * const result = await authService.resetPassword('reset-token-here', 'new-password');
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findByPasswordResetToken(token);

    if (!user) {
      throw new BadRequestException("Token invalide ou expiré");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mise à jour du mot de passe et réinitialisation du token
    await this.userRepository.updatePassword((user as any)._id, hashedPassword);
    await this.userRepository.updatePasswordResetToken(
      (user as any)._id,
      "",
      new Date(0)
    );

    return { message: "Mot de passe réinitialisé avec succès" };
  }

  /**
   * Valide un utilisateur pour les requêtes authentifiées JWT
   *
   * @async
   * @function validateUser
   * @param {string} userId - ID de l'utilisateur à valider
   * @returns {Promise<User>} Données utilisateur validées
   * @throws {UnauthorizedException} Si l'utilisateur n'existe pas
   * @example
   * const user = await authService.validateUser('60f7b3b3b3b3b3b3b3b3b3b3');
   */
  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Utilisateur non trouvé");
    }

    // ✅ Mettre à jour lastActive à chaque validation JWT (requête authentifiée)
    await this.userRepository.updateLastActive(userId);    return user;
  }

  /**
   * Rafraîchit les tokens d'accès via refresh token
   *
   * @async
   * @function refreshTokens
   * @param {string} refreshToken - Token de rafraîchissement
   * @param {TokenMetadata} metadata - Métadonnées optionnelles pour le nouveau token
   * @returns {Promise<{tokens: {access_token: string, refresh_token: string}}>} Nouveaux tokens
   * @throws {UnauthorizedException} Si le refresh token est invalide
   * @example
   * const newTokens = await authService.refreshTokens('refresh-token-here');
   */
  async refreshTokens(
    refreshToken: string,
    metadata?: TokenMetadata
  ): Promise<{ tokens: { access_token: string; refresh_token: string } }> {
    try {
      const tokenPair = await this.refreshTokenService.refreshTokens(
        refreshToken,
        metadata
      );

      return {
        tokens: {
          access_token: tokenPair.accessToken,
          refresh_token: tokenPair.refreshToken,
        },
      };
    } catch (error) {
      this._logger.error("Erreur lors du refresh des tokens:", error);
      throw new UnauthorizedException("Refresh token invalide");
    }
  }

  /**
   * Déconnexion sécurisée avec révocation du refresh token
   *
   * @async
   * @function logout
   * @param {string} refreshToken - Token de rafraîchissement à révoquer
   * @returns {Promise<{message: string}>} Message de confirmation de déconnexion
   * @example
   * const result = await authService.logout('refresh-token-here');
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      await this.refreshTokenService.revokeRefreshToken(
        refreshToken,
        "User logout"
      );
      this._logger.log("Déconnexion réussie avec révocation du refresh token");

      return { message: "Déconnexion réussie" };
    } catch (error) {
      this._logger.error("Erreur lors de la déconnexion:", error);
      // Ne pas faire échouer la déconnexion même si la révocation échoue
      return { message: "Déconnexion effectuée" };
    }
  }

  /**
   * Déconnexion globale - révoque tous les tokens de l'utilisateur
   *
   * @async
   * @function logoutAllDevices
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<{message: string}>} Message de confirmation
   * @throws {BadRequestException} Si erreur lors de la déconnexion globale
   * @example
   * const result = await authService.logoutAllDevices('60f7b3b3b3b3b3b3b3b3b3b3');
   */
  async logoutAllDevices(userId: string): Promise<{ message: string }> {
    try {
      await this.refreshTokenService.revokeAllUserTokens(
        userId,
        "Logout all devices"
      );
      this._logger.log(
        `Déconnexion globale effectuée pour l'utilisateur ${userId}`
      );

      return { message: "Déconnexion effectuée sur tous les appareils" };
    } catch (error) {
      this._logger.error("Erreur lors de la déconnexion globale:", error);
      throw new BadRequestException("Erreur lors de la déconnexion globale");
    }
  }

  // ========================
  // MÉTHODES AUTHENTIFICATION SOCIALE
  // ========================

  /**
   * Valide l'authentification sociale et crée/met à jour l'utilisateur
   *
   * @async
   * @function validateSocialLogin
   * @param {SocialUser} socialUser - Données utilisateur du provider social
   * @returns {Promise<{tokens: {access_token: string, refresh_token: string}, user: any}>} Tokens et données utilisateur
   * @throws {UnauthorizedException} Si erreur lors de la validation
   * @example
   * const result = await authService.validateSocialLogin({
   *   provider: 'google',
   *   providerId: '123456789',
   *   email: 'user@gmail.com',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   username: 'johndoe',
   *   profilePicture: 'https://...'
   * });
   */
  async validateSocialLogin(socialUser: SocialUser) {
    // Recherche d'un utilisateur existant avec le même email ou la même combinaison provider/providerId
    let user = await this.userRepository.findByEmail(socialUser.email);

    // Si pas trouvé par email, chercher par social provider
    if (!user) {
      user = await this.userRepository.findBySocialProvider(
        socialUser.provider,
        socialUser.providerId
      );
    }

    if (user) {
      // Si l'utilisateur existe, mettre à jour les informations sociales
      if (!user.socialProviders) {
        user.socialProviders = {};
      }

      // Stocker l'ID du provider dans les informations sociales
      user.socialProviders[socialUser.provider] = socialUser.providerId;

      // Si l'utilisateur n'a pas d'image de profil mais que le provider en fournit une
      if (!user.profilePicture && socialUser.profilePicture) {
        user.profilePicture = socialUser.profilePicture;
      }

      // L'utilisateur se connecte via réseau social, son email est donc vérifié
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        user.emailVerificationToken = "";
        user.emailVerificationTokenExpires = new Date(0);
      }

      // Mettre à jour l'utilisateur via le repository
      await this.userRepository.update((user as any)._id, {
        socialProviders: user.socialProviders,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified,
        emailVerificationToken: user.emailVerificationToken,
        emailVerificationTokenExpires: user.emailVerificationTokenExpires,
      });
    } else {
      // Si l'utilisateur n'existe pas, le créer
      // Générer un nom d'utilisateur unique si nécessaire
      let username = socialUser.username;
      let isUsernameTaken = true;
      let count = 0;

      while (isUsernameTaken) {
        const existingUser = await this.userRepository.findByUsername(username);
        if (!existingUser) {
          isUsernameTaken = false;
        } else {
          count++;
          username = `${socialUser.username}${count}`;
        }
      }

      // Créer un mot de passe aléatoire (l'utilisateur n'aura jamais besoin de le connaître)
      const randomPassword = Math.random().toString(36).slice(-12);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Créer le nouvel utilisateur
      const socialProviders = {};
      socialProviders[socialUser.provider] = socialUser.providerId;

      // Créer l'utilisateur social via le repository
      user = await this.userRepository.createSocialUser({
        email: socialUser.email,
        username: socialUser.username,
        fullName: socialUser.firstName,
        profilePicture: socialUser.profilePicture,
        provider: socialUser.provider,
        providerId: socialUser.providerId,
      });
    }

    // Créer un payload pour le JWT
    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    // 🔐 Générer une paire de tokens (access + refresh) COMME le système standard
    const tokenPair = await this.refreshTokenService.generateTokenPair(
      user._id.toString(),
      payload
    );

    // Retourner les données utilisateur et les tokens STANDARD
    return {
      tokens: {
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
      },
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        nativeLanguage: user.nativeLanguageId,
        learningLanguages: user.learningLanguageIds,
        profilePicture: user.profilePicture,
      },
    };
  }

  /**
   * Génère un token d'authentification sociale standardisé
   *
   * @async
   * @function generateSocialAuthToken
   * @param {object} userData - Données utilisateur
   * @param {object} userData.user - Objet utilisateur
   * @param {string} userData.user.id - ID de l'utilisateur
   * @returns {Promise<string>} Token d'accès JWT
   * @throws {UnauthorizedException} Si l'utilisateur n'existe pas
   * @example
   * const token = await authService.generateSocialAuthToken({
   *   user: { id: '60f7b3b3b3b3b3b3b3b3b3b3' }
   * });
   */
  async generateSocialAuthToken(userData: {
    user: { id: string };
  }): Promise<string> {
    // 🔍 Rechercher l'utilisateur pour obtenir les infos complètes
    const user = await this.userRepository.findById(userData.user.id);
    if (!user) {
      throw new UnauthorizedException("Utilisateur non trouvé");
    }

    // 🔐 Créer payload JWT standard
    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    // 🔑 Générer une paire de tokens STANDARD (access + refresh)
    const tokenPair = await this.refreshTokenService.generateTokenPair(
      user._id.toString(),
      payload
    );

    // ⚙️ Retourner seulement l'access_token pour l'URL (plus court)
    // Le refresh_token sera fourni lors de la validation
    return tokenPair.accessToken;
  }

  /**
   * Valide un token d'authentification sociale et génère une session complète
   *
   * @async
   * @function validateSocialAuthToken
   * @param {string} token - Token d'authentification sociale à valider
   * @returns {Promise<{tokens: {access_token: string, refresh_token: string}, user: any}>} Session complète avec tokens et données utilisateur
   * @throws {UnauthorizedException} Si le token est invalide ou expiré
   * @example
   * const session = await authService.validateSocialAuthToken('jwt-token-here');
   */
  async validateSocialAuthToken(token: string): Promise<{
    tokens: { access_token: string; refresh_token: string };
    user: any;
  }> {
    try {
      // 🔐 Décoder le token JWT STANDARD (access_token)
      const decoded = this._jwtService.verify(token);
      const userId = decoded.sub;

      // 🔍 Rechercher l'utilisateur
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UnauthorizedException("Utilisateur non trouvé");
      }

      // 🔑 Créer payload JWT standard
      const payload = {
        sub: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      };

      // 🔄 Générer une NOUVELLE paire de tokens (access + refresh) pour la session
      const tokenPair = await this.refreshTokenService.generateTokenPair(
        user._id.toString(),
        payload
      );

      return {
        tokens: {
          access_token: tokenPair.accessToken,
          refresh_token: tokenPair.refreshToken,
        },
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          isEmailVerified: user.isEmailVerified,
          role: user.role,
          nativeLanguage: user.nativeLanguageId,
          learningLanguages: user.learningLanguageIds,
          profilePicture: user.profilePicture,
        },
      };
    } catch (error) {
      this._logger.error("Erreur validation token social:", error);
      throw new UnauthorizedException("Token social invalide ou expiré");
    }
  }
}
