import { Module } from '@nestjs/common';
import { ModerationController } from './controllers/moderation.controller';
import { ModerationService } from './services/moderation.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * 🛡️ MODULE MODERATION
 * 
 * Module NestJS pour les fonctionnalités de modération et contrôle qualité.
 * Permet aux administrateurs et modérateurs de gérer le contenu
 * et maintenir la qualité de la plateforme.
 * 
 * Fonctionnalités :
 * - Système de signalements (mots, commentaires, utilisateurs)
 * - Approbation/rejet en masse de contenu
 * - File d'attente de modération prioritaire
 * - Historique des contributions par utilisateur
 * - Statistiques de modération et performance
 * - Configuration de modération automatique
 * - Gestion des rapports et actions
 */
@Module({
  imports: [
    RepositoriesModule, // Pour accès aux repositories (Word, User, etc.)
  ],
  controllers: [
    ModerationController, // Controller avec tous les endpoints de modération
  ],
  providers: [
    ModerationService, // Service principal pour logique de modération
  ],
  exports: [
    ModerationService, // Exporté pour utilisation par d'autres modules
  ],
})
export class ModerationModule {}