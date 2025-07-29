// Mise à jour de auth.service.ts avec les méthodes d'authentification sociale
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

// Type pour l'utilisateur social
interface SocialUser {
  provider: string;
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
}

@Injectable()
export class AuthService {
  private readonly _logger = new Logger(AuthService.name);

  constructor(
    @Inject("IUserRepository") private userRepository: IUserRepository,
    private _jwtService: JwtService,
    private configService: ConfigService,
    private _mailService: MailService,
    private activityService: ActivityService,
    private refreshTokenService: RefreshTokenService
  ) {}

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

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("Utilisateur non trouvé");
    }

    // ✅ Mettre à jour lastActive à chaque validation JWT (requête authentifiée)
    await this.userRepository.updateLastActive(userId);

    console.log(
      "🔄 JWT validation - lastActive mis à jour pour:",
      user.username
    );

    return user;
  }

  /**
   * 🔄 Rafraîchit les tokens d'accès
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
   * 🚪 Déconnexion sécurisée avec révocation du refresh token
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
   * 🔒 Déconnexion globale - révoque tous les tokens de l'utilisateur
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

  /** Méthodes d'authentification sociale */

  /**
   * Valide l'authentification sociale et crée/met à jour l'utilisateur
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
   * Génère un token STANDARD pour l'authentification sociale
   * PHASE 1 - STANDARDISATION: Utilise le même système que login/register
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
   * Valide un token d'authentification sociale et retourne les données utilisateur
   * PHASE 1 - STANDARDISATION: Utilise le système JWT standard au lieu du Map temporaire
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
