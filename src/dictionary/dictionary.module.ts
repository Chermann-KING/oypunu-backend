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

// Contrôleurs
import { WordsController } from './controllers/words.controller';
import { CategoriesController } from './controllers/categories.controller';
import { FavoriteWordsController } from './controllers/favorite-words.controller';
import { UsersModule } from 'src/users/users.module';
// ✨ NOUVEL IMPORT pour l'intégration de la détection automatique
import { TranslationModule } from '../translation/translation.module';
import { ActivityModule } from '../common/activity.module';

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
  ],
  controllers: [WordsController, CategoriesController, FavoriteWordsController],
  providers: [WordsService, CategoriesService, AudioService],
  exports: [WordsService, CategoriesService],
})
export class DictionaryModule {}
