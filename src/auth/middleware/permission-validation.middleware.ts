import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

export interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    _id?: string;
    email?: string;
    username?: string;
    role?: string;
    isActive?: boolean;
  };
}

@Injectable()
export class PermissionValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PermissionValidationMiddleware.name);

  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // Ignorer si pas d'utilisateur (route publique)
    if (!req.user) {
      return next();
    }

    try {
      // 🔒 VALIDATION CRITIQUE : Vérifier que l'utilisateur existe toujours
      const userId = req.user.id || req.user._id;

      if (!userId) {
        throw new ForbiddenException('ID utilisateur manquant');
      }

      const dbUser = await this.userModel
        .findById(userId)
        .select('role isActive isEmailVerified username email')
        .exec();

      if (!dbUser) {
        this.logger.error(
          `Utilisateur ${userId} introuvable en base de données`,
        );
        throw new ForbiddenException('Utilisateur invalide');
      }

      // Vérifier si l'utilisateur est actif
      if (!dbUser.isActive) {
        this.logger.warn(
          `Tentative d'accès par utilisateur inactif: ${dbUser.username}`,
        );
        throw new ForbiddenException('Compte utilisateur désactivé');
      }

      // Vérifier si l'email est vérifié pour les actions sensibles
      if (!dbUser.isEmailVerified && this.requiresEmailVerification(req)) {
        this.logger.warn(
          `Tentative d'accès avec email non vérifié: ${dbUser.username}`,
        );
        throw new ForbiddenException('Email non vérifié');
      }

      // ✅ Mettre à jour les données utilisateur dans la requête
      req.user = {
        ...req.user,
        id: dbUser._id.toString(),
        email: dbUser.email,
        username: dbUser.username,
        role: dbUser.role,
        isActive: dbUser.isActive,
        isEmailVerified: dbUser.isEmailVerified || false,
      } as any;

      // 📊 Logger l'accès autorisé
      this.logger.log(
        `Accès autorisé: ${dbUser.username} (${dbUser.role}) -> ${req.method} ${req.path}`,
      );

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('Erreur lors de la validation des permissions:', error);
      throw new ForbiddenException('Erreur de validation des permissions');
    }
  }

  /**
   * Détermine si la route nécessite une vérification d'email
   */
  private requiresEmailVerification(req: AuthenticatedRequest): boolean {
    const sensitiveRoutes = [
      '/admin/',
      '/users/contributor',
      '/dictionary/words',
      '/communities/create',
    ];

    return sensitiveRoutes.some((route) => req.path.includes(route));
  }
}
