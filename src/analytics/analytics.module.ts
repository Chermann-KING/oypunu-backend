import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * 📊 MODULE ANALYTICS
 * 
 * Module NestJS pour les fonctionnalités d'analytics et de métriques.
 * Fournit des tableaux de bord, statistiques et exports de données
 * pour les administrateurs et utilisateurs.
 * 
 * Fonctionnalités :
 * - Dashboard administrateur avec métriques temps réel
 * - Statistiques détaillées par utilisateur
 * - Tendances par langue et évolution
 * - Export de données (JSON/CSV)
 * - Métriques de performance système
 * - Analytics d'engagement utilisateur
 */
@Module({
  imports: [
    RepositoriesModule, // Pour accès aux repositories (Word, User, WordView)
  ],
  controllers: [
    AnalyticsController, // Controller avec tous les endpoints analytics
  ],
  providers: [
    AnalyticsService, // Service principal pour calculs et agrégations
  ],
  exports: [
    AnalyticsService, // Exporté pour utilisation par d'autres modules
  ],
})
export class AnalyticsModule {}