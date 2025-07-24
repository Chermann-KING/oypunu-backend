import { Module } from '@nestjs/common';
import { AchievementsController } from './controllers/achievements.controller';
import { AchievementsService } from './services/achievements.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * 🏆 MODULE ACHIEVEMENTS
 * 
 * Module NestJS pour le système de badges et achievements (gamification).
 * Motive les utilisateurs avec un système de récompenses et classements
 * basé sur leurs contributions et activités.
 * 
 * Fonctionnalités :
 * - Système complet de badges (bronze, silver, gold, platinum, diamond)
 * - Achievements par catégories (contribution, social, learning, etc.)
 * - Classements et leaderboards dynamiques
 * - Suivi automatique des progrès utilisateur
 * - Achievements rares et exclusifs
 * - Système de points et niveaux
 * - Notifications de déblocage
 * - Analytics et statistiques globales
 */
@Module({
  imports: [
    RepositoriesModule, // Pour accès aux repositories (User, Word, WordView)
  ],
  controllers: [
    AchievementsController, // Controller avec tous les endpoints d'achievements
  ],
  providers: [
    AchievementsService, // Service principal pour logique de gamification
  ],
  exports: [
    AchievementsService, // Exporté pour utilisation par d'autres modules
  ],
})
export class AchievementsModule {}