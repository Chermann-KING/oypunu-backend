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
