import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export interface CurrentUserData {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
}

/**
 * Décorateur pour récupérer l'utilisateur actuel de manière sécurisée
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof CurrentUserData | undefined,
    ctx: ExecutionContext,
  ): CurrentUserData | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    // Validation supplémentaire des données utilisateur
    const userData: CurrentUserData = {
      id: user.id || user._id?.toString(),
      email: user.email,
      username: user.username,
      role: user.role || 'user',
      isActive: user.isActive !== false, // Par défaut true si non défini
      isEmailVerified: user.isEmailVerified || false,
    };

    // Validation des champs obligatoires
    if (!userData.id || !userData.email || !userData.username) {
      throw new UnauthorizedException('Données utilisateur incomplètes');
    }

    // Si un champ spécifique est demandé, le retourner
    if (data) {
      return userData[data];
    }

    // Sinon, retourner l'objet complet
    return userData;
  },
);

/**
 * Décorateur pour récupérer uniquement l'ID utilisateur
 */
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const userId = user.id || user._id?.toString();

    if (!userId) {
      throw new UnauthorizedException('ID utilisateur manquant');
    }

    return userId;
  },
);
