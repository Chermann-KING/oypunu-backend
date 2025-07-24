import { Module } from '@nestjs/common';
import { WordSocialController } from './controllers/word-social.controller';
import { WordSocialService } from './services/word-social.service';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DictionaryModule } from '../dictionary/dictionary.module';

/**
 * 👥 MODULE SOCIAL
 * 
 * Module NestJS pour les fonctionnalités sociales et interactives.
 * Transforme le dictionnaire en plateforme sociale avec interactions,
 * partages et engagement communautaire.
 * 
 * Fonctionnalités :
 * - Mot du jour avec challenge et statistiques
 * - Système de commentaires hiérarchiques sur les mots
 * - Likes et réactions sur mots et commentaires
 * - Partage sur réseaux sociaux (Facebook, Twitter, etc.)
 * - Système de notation et évaluation (1-5 étoiles)
 * - Mots tendances avec scoring dynamique
 * - Exemples d'usage contribués par la communauté
 * - Statistiques sociales et métriques d'engagement
 * - Discussions liées aux mots
 */
@Module({
  imports: [
    RepositoriesModule, // Pour accès aux repositories
    DictionaryModule,   // Pour intégration avec les services de mots
  ],
  controllers: [
    WordSocialController, // Controller avec tous les endpoints sociaux
  ],
  providers: [
    WordSocialService, // Service principal pour logique sociale
  ],
  exports: [
    WordSocialService, // Exporté pour utilisation par d'autres modules
  ],
})
export class SocialModule {}