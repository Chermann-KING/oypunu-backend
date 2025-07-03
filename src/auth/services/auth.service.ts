// Mise à jour de auth.service.ts avec les méthodes d'authentification sociale
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { RegisterDto } from '../../users/dto/register.dto';
import { LoginDto } from '../../users/dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../common/services/mail.service';

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

// Interface pour le token social stocké en mémoire temporairement
interface SocialAuthTokenData {
  token: string;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly _logger = new Logger(AuthService.name);
  // Stockage temporaire pour les tokens d'authentification sociale
  private readonly _socialAuthTokens: Map<string, SocialAuthTokenData> =
    new Map();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private _jwtService: JwtService,
    private configService: ConfigService,
    private _mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { email, username, password } = registerDto;

    // Vérifier si l'email existe déjà
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new BadRequestException('Cet email est déjà utilisé');
      }
      if (existingUser.username === username) {
        throw new BadRequestException("Ce nom d'utilisateur est déjà pris");
      }
    }

    // Hashage du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Création du token de vérification
    const verificationToken: string = uuidv4();
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 24); // 24h de validité

    // Création de l'utilisateur
    const newUser = new this.userModel({
      ...registerDto,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpires: tokenExpiration,
      isEmailVerified: false,
    });

    await newUser.save();

    try {
      // Envoi de l'email de vérification
      await this._mailService.sendVerificationEmail(
        email,
        verificationToken,
        username,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this._logger.error(
        `Erreur lors de l'envoi de l'email de vérification: ${errorMessage}`,
      );
      // On ne relance pas l'erreur pour éviter de bloquer le processus d'inscription
    }

    return {
      message:
        'Inscription réussie. Veuillez vérifier votre email pour activer votre compte.',
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = '';
    user.emailVerificationTokenExpires = new Date(0);

    await user.save();

    return {
      message:
        'Email vérifié avec succès. Vous pouvez maintenant vous connecter.',
    };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Cet email est déjà vérifié');
    }

    // Générer un nouveau token
    const verificationToken = uuidv4();
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 24);

    user.emailVerificationToken = verificationToken;
    user.emailVerificationTokenExpires = tokenExpiration;

    await user.save();

    try {
      // Envoi de l'email
      await this._mailService.sendVerificationEmail(
        email,
        verificationToken,
        user.username,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this._logger.error(
        `Erreur lors de l'envoi de l'email de vérification: ${errorMessage}`,
      );
      // On ne relance pas l'erreur pour éviter de bloquer le processus
    }

    return {
      message: 'Un nouvel email de vérification a été envoyé.',
    };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ tokens: { access_token: string }; user: any }> {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Veuillez vérifier votre email avant de vous connecter',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return {
      tokens: {
        access_token: this._jwtService.sign(payload),
      },
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        nativeLanguage: user.nativeLanguage,
        learningLanguages: user.learningLanguages,
        profilePicture: user.profilePicture,
      },
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new BadRequestException('Aucun compte associé à cet email');
    }

    const resetToken = uuidv4();
    const tokenExpiration = new Date();
    tokenExpiration.setHours(tokenExpiration.getHours() + 1); // 1h de validité

    user.passwordResetToken = resetToken;
    user.passwordResetTokenExpires = tokenExpiration;

    await user.save();

    try {
      // Envoi de l'email de réinitialisation
      await this._mailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.username,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this._logger.error(
        `Erreur lors de l'envoi de l'email de réinitialisation: ${errorMessage}`,
      );
      // On ne relance pas l'erreur pour éviter de bloquer le processus
    }

    return {
      message: 'Un email de réinitialisation de mot de passe a été envoyé.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findOne({
      passwordResetToken: token,
      passwordResetTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.passwordResetToken = '';
    user.passwordResetTokenExpires = new Date(0);

    await user.save();

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }
    return user;
  }

  /** Méthodes d'authentification sociale */

  /**
   * Valide l'authentification sociale et crée/met à jour l'utilisateur
   */
  async validateSocialLogin(socialUser: SocialUser) {
    // Recherche d'un utilisateur existant avec le même email ou la même combinaison provider/providerId
    let user = await this.userModel.findOne({
      $or: [
        { email: socialUser.email },
        {
          [`socialProviders.${socialUser.provider}`]: socialUser.providerId,
        },
      ],
    });

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
        user.emailVerificationToken = '';
        user.emailVerificationTokenExpires = new Date(0);
      }

      await user.save();
    } else {
      // Si l'utilisateur n'existe pas, le créer
      // Générer un nom d'utilisateur unique si nécessaire
      let username = socialUser.username;
      let isUsernameTaken = true;
      let count = 0;

      while (isUsernameTaken) {
        const existingUser = await this.userModel.findOne({ username });
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

      const newUser = new this.userModel({
        email: socialUser.email,
        username,
        password: hashedPassword,
        isEmailVerified: true, // L'authentification sociale vérifie l'email
        profilePicture: socialUser.profilePicture,
        socialProviders,
        // ? ajouter d'autres champs pertinents ici si nécessaire
      });

      user = await newUser.save();
    }

    // Créer un payload pour le JWT
    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    // Retourner les données utilisateur et le token
    return {
      tokens: {
        access_token: this._jwtService.sign(payload),
      },
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        nativeLanguage: user.nativeLanguage,
        learningLanguages: user.learningLanguages,
        profilePicture: user.profilePicture,
      },
    };
  }

  /**
   * Génère un token temporaire pour l'authentification sociale
   */
  generateSocialAuthToken(userData: { user: { id: string } }): string {
    const token = uuidv4();

    // Stockage du token avec une expiration de 5 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    this._socialAuthTokens.set(token, {
      token,
      userId: userData.user.id,
      expiresAt,
    });

    // Nettoyer les tokens expirés toutes les 5 minutes
    this._cleanupExpiredTokens();

    return token;
  }

  /**
   * Valide un token d'authentification sociale et retourne les données utilisateur
   */
  async validateSocialAuthToken(token: string) {
    const tokenData = this._socialAuthTokens.get(token);

    if (!tokenData) {
      throw new UnauthorizedException('Token social invalide ou expiré');
    }

    if (tokenData.expiresAt < new Date()) {
      this._socialAuthTokens.delete(token);
      throw new UnauthorizedException('Token social expiré');
    }

    // Supprimer le token après utilisation
    this._socialAuthTokens.delete(token);

    // Rechercher l'utilisateur
    const user = await this.userModel.findById(tokenData.userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    // Créer un nouveau JWT pour l'authentification
    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    return {
      tokens: {
        access_token: this._jwtService.sign(payload),
      },
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        nativeLanguage: user.nativeLanguage,
        learningLanguages: user.learningLanguages,
        profilePicture: user.profilePicture,
      },
    };
  }

  /**
   * Nettoie les tokens d'authentification sociale expirés
   */
  private _cleanupExpiredTokens() {
    const now = new Date();
    for (const [token, data] of this._socialAuthTokens.entries()) {
      if (data.expiresAt < now) {
        this._socialAuthTokens.delete(token);
      }
    }
  }
}
