/**
 * @fileoverview Module du dictionnaire O'Ypunu - Cœur du système linguistique
 * 
 * Ce module constitue le cœur du système de dictionnaire multilingue O'Ypunu
 * avec architecture modulaire avancée, services spécialisés et contrôleurs
 * découplés pour une maintenabilité optimale. Il intègre gestion complète
 * des mots, catégories, favoris, révisions et fonctionnalités avancées.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
// import { RedisModule } from '@nestjs-modules/ioredis';

// Schémas
import { Word, WordSchema } from './schemas/word.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import {
  FavoriteWord,
  FavoriteWordSchema,
} from './schemas/favorite-word.schema';
import {
  RevisionHistory,
  RevisionHistorySchema,
} from './schemas/revision-history.schema';
import {
  WordNotification,
  WordNotificationSchema,
} from './schemas/word-notification.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';
import { WordView, WordViewSchema } from '../users/schemas/word-view.schema';

// Services
import { WordsService } from './services/words.service';
import { CategoriesService } from './services/categories.service';
import { AudioService } from './services/audio.service';
// import { AudioCacheService } from './services/audio-cache.service';

// PHASE 1 - Services utilitaires pour refactoring
import { WordValidationService } from './services/word-services/word-validation.service';
import { WordPermissionService } from './services/word-services/word-permission.service';
import { WordNotificationService } from './services/word-services/word-notification.service';
import { WordTranslationService } from './services/word-services/word-translation.service';

// PHASE 2-7 - Services spécialisés
import { WordAudioService } from './services/word-services/word-audio.service';
import { WordFavoriteService } from './services/word-services/word-favorite.service';
import { WordAnalyticsService } from './services/word-services/word-analytics.service';
import { WordRevisionService } from './services/word-services/word-revision.service';
import { WordCoreService } from './services/word-services/word-core.service';

// Contrôleurs
import { WordsController } from './controllers/words.controller';
import { CategoriesController } from './controllers/categories.controller';
import { FavoriteWordsController } from './controllers/favorite-words.controller';

// PHASE 3-1: Contrôleurs spécialisés (split du WordsController god class)
import { WordsCoreController } from './controllers/words-core.controller';
import { WordsAdminController } from './controllers/words-admin.controller';
import { WordsAnalyticsController } from './controllers/words-analytics.controller';
import { WordsRevisionController } from './controllers/words-revision.controller';
import { WordsPermissionController } from './controllers/words-permission.controller';
import { WordsTranslationController } from './controllers/words-translation.controller';
import { UsersModule } from 'src/users/users.module';
// ✨ NOUVEL IMPORT pour l'intégration de la détection automatique
import { TranslationModule } from '../translation/translation.module';
import { ActivityModule } from '../common/activity.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { LanguagesModule } from '../languages/languages.module';

/**
 * Module du dictionnaire O'Ypunu - Architecture avancée
 * 
 * Ce module implémente une architecture modulaire sophistiquée pour
 * le système de dictionnaire multilingue avec services découplés,
 * contrôleurs spécialisés et intégrations externes optimisées.
 * 
 * ## 🏗️ Architecture modulaire :
 * 
 * ### 📊 Schémas MongoDB
 * - Word : Schéma principal des mots avec métadonnées complètes
 * - Category : Organisation hiérarchique des mots par catégories
 * - FavoriteWord : Gestion des favoris utilisateur
 * - RevisionHistory : Historique complet des modifications
 * - WordNotification : Système de notifications linguistiques
 * - Language : Support multilingue avec métadonnées
 * - WordView : Tracking des consultations pour analytics
 * 
 * ### 🎯 Services spécialisés (Pattern de découplage)
 * - **Phase 1** : Services utilitaires (validation, permissions, notifications, traductions)
 * - **Phase 2-7** : Services métier (audio, favoris, analytics, révisions, core)
 * - **Intégrations** : Translation, Activity, Repositories modules
 * 
 * ### 🎮 Contrôleurs découplés
 * - **Existants** : Words, Categories, FavoriteWords (legacy)
 * - **Spécialisés** : Core, Admin, Analytics, Revision, Permission, Translation
 * - **Bénéfices** : Single Responsibility, testabilité, maintenabilité
 * 
 * ## 🔗 Dépendances externes :
 * - **UsersModule** : Intégration utilisateurs et permissions
 * - **TranslationModule** : Détection automatique et traductions
 * - **ActivityModule** : Logging d'activités et auditabilité
 * - **RepositoriesModule** : Pattern Repository pour abstraction données
 * 
 * @class DictionaryModule
 * @version 1.0.0
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: Category.name, schema: CategorySchema },
      { name: FavoriteWord.name, schema: FavoriteWordSchema },
      { name: RevisionHistory.name, schema: RevisionHistorySchema },
      { name: WordNotification.name, schema: WordNotificationSchema },
      { name: Language.name, schema: LanguageSchema },
      { name: WordView.name, schema: WordViewSchema },
    ]),
    // RedisModule,
    UsersModule,
    // ✨ NOUVEAU: Import du module de traduction pour la détection automatique
    TranslationModule,
    ActivityModule,
    RepositoriesModule, // Already imported - Repository Pattern support
    LanguagesModule, // Pour le mapping dynamique des accents audio
  ],
  controllers: [
    // Contrôleurs existants
    WordsController, 
    CategoriesController, 
    FavoriteWordsController,
    // PHASE 3-1: Contrôleurs spécialisés (split du WordsController god class)
    WordsCoreController,
    WordsAdminController,
    WordsAnalyticsController,
    WordsRevisionController,
    WordsPermissionController,
    WordsTranslationController,
  ],
  providers: [
    WordsService, 
    CategoriesService, 
    AudioService,
    // PHASE 1 - Services utilitaires pour refactoring
    WordValidationService,
    WordPermissionService,
    WordNotificationService,
    WordTranslationService,
    // PHASE 2-7 - Services spécialisés  
    WordAudioService,
    WordFavoriteService,
    WordAnalyticsService,
    WordRevisionService,
    WordCoreService,
  ],
  exports: [
    WordsService, 
    CategoriesService,
    AudioService,
    // PHASE 1 - Export des services utilitaires
    WordValidationService,
    WordPermissionService,
    WordNotificationService,
    WordTranslationService,
    // PHASE 2-7 - Export des services spécialisés
    WordAudioService,
    WordFavoriteService,
    WordAnalyticsService,
    WordRevisionService,
    WordCoreService,
  ],
})
export class DictionaryModule {}
