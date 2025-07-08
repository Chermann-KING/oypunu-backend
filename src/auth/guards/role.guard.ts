import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

export enum UserRole {
  USER = 'user',
  CONTRIBUTOR = 'contributor',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
}

// Hiérarchie des rôles pour validation
const ROLE_HIERARCHY = {
  [UserRole.USER]: 1,
  [UserRole.CONTRIBUTOR]: 2,
  [UserRole.ADMIN]: 3,
  [UserRole.SUPERADMIN]: 4,
};

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Récupérer les rôles requis depuis les métadonnées du décorateur
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // Si aucun rôle n'est spécifié, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn("Tentative d'accès sans utilisateur authentifié");
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // 🔒 VALIDATION CRITIQUE : Vérifier l'utilisateur en base de données
    const dbUser = await this.validateUserInDatabase(user.id || user._id);

    if (!dbUser) {
      this.logger.error(
        `Utilisateur ${user.id} introuvable en base de données`,
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

    // Vérifier la hiérarchie des rôles
    const hasPermission = this.checkRolePermission(dbUser.role, requiredRoles);

    if (!hasPermission) {
      this.logger.warn(
        `Accès refusé pour ${dbUser.username} (${dbUser.role}). Rôles requis: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException('Permissions insuffisantes');
    }

    // ✅ Mettre à jour le request avec les données fraîches de l'utilisateur
    request.user = {
      ...request.user,
      role: dbUser.role,
      isActive: dbUser.isActive,
      username: dbUser.username,
    };

    this.logger.log(`Accès autorisé pour ${dbUser.username} (${dbUser.role})`);
    return true;
  }

  /**
   * Valide que l'utilisateur existe toujours en base de données
   */
  private async validateUserInDatabase(
    userId: string,
  ): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findById(userId)
        .select('role isActive username isEmailVerified')
        .exec();
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation de l'utilisateur ${userId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Vérifie si le rôle de l'utilisateur satisfait les exigences
   */
  private checkRolePermission(
    userRole: string,
    requiredRoles: UserRole[],
  ): boolean {
    const userLevel = ROLE_HIERARCHY[userRole as UserRole] || 0;

    // Vérifier si l'utilisateur a au moins un des rôles requis
    return requiredRoles.some((requiredRole) => {
      const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
      return userLevel >= requiredLevel;
    });
  }
}

/**
 * Décorateur pour spécifier les rôles requis
 */
import { SetMetadata } from '@nestjs/common';

export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata('roles', roles);
