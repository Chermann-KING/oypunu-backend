import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

@Injectable()
export class ActivityTrackingMiddleware implements NestMiddleware {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Vérifier si l'utilisateur est authentifié
      const user = req.user as any;      console.log(
        '👤 User dans request:',
        user
          ? `${user.userId || user._id} (${user.username || 'unknown'})`
          : 'non authentifié',
      );

      if (user && (user.userId || user._id)) {
        const userId = user.userId || user._id;
        console.log('✅ Mise à jour lastActive pour:', userId);

        // Mettre à jour lastActive de manière asynchrone pour ne pas bloquer la requête
        this.updateUserActivity(userId).catch((error) => {
          console.error(
            "❌ Erreur lors de la mise à jour de l'activité utilisateur:",
            error,
          );
        });
      } else {
        console.log("⏭️ Pas d'utilisateur authentifié, pas de mise à jour");
      }
    } catch (error) {
      console.error('💥 Erreur dans ActivityTrackingMiddleware:', error);
    }

    next();
  }

  private async updateUserActivity(userId: string): Promise<void> {
    try {
      const result = await this.userModel.findByIdAndUpdate(
        userId,
        {
          lastActive: new Date(),
          // Marquer comme actif si ce n'était pas déjà le cas
          isActive: true,
        },
        { new: true },
      );

      if (result) {      } else {
        console.log('⚠️ Utilisateur non trouvé pour la mise à jour:', userId);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de lastActive:', error);
    }
  }
}
