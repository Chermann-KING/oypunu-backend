import { Module } from '@nestjs/common';
import { SearchController } from './controllers/search.controller';
import { SearchService } from './services/search.service';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DictionaryModule } from '../dictionary/dictionary.module';

/**
 * 🔍 MODULE SEARCH
 * 
 * Module NestJS pour les fonctionnalités de recherche avancée.
 * Améliore l'expérience de recherche avec suggestions intelligentes,
 * historique personnel et analytics de recherche.
 * 
 * Fonctionnalités :
 * - Suggestions de recherche en temps réel
 * - Historique de recherche personnel avec filtres
 * - Sauvegarde et gestion des recherches favorites
 * - Recherches tendances et populaires
 * - Analytics de recherche personnalisées
 * - Feedback sur la qualité des résultats
 * - Tracking pour amélioration continue
 */
@Module({
  imports: [
    RepositoriesModule, // Pour accès aux repositories (Word, WordView)
    DictionaryModule,   // Pour intégration avec WordsService
  ],
  controllers: [
    SearchController, // Controller avec tous les endpoints de recherche
  ],
  providers: [
    SearchService, // Service principal pour logique de recherche avancée
  ],
  exports: [
    SearchService, // Exporté pour utilisation par d'autres modules
  ],
})
export class SearchModule {}