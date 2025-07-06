import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecommendationsController } from './controllers/recommendations.controller';
import { RecommendationsService } from './services/recommendations.service';
import { UserRecommendationProfile, UserRecommendationProfileSchema } from './schemas/user-recommendation-profile.schema';
import { RecommendationCache, RecommendationCacheSchema } from './schemas/recommendation-cache.schema';

// Import des modules existants nécessaires
import { UsersModule } from '../users/users.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { TranslationModule } from '../translation/translation.module';
import { LanguagesModule } from '../languages/languages.module';

// Import des schémas nécessaires
import { WordView, WordViewSchema } from '../users/schemas/word-view.schema';
import { FavoriteWord, FavoriteWordSchema } from '../dictionary/schemas/favorite-word.schema';
import { ActivityFeed, ActivityFeedSchema } from '../common/schemas/activity-feed.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      // Nouveaux schémas pour les recommandations
      { name: UserRecommendationProfile.name, schema: UserRecommendationProfileSchema },
      { name: RecommendationCache.name, schema: RecommendationCacheSchema },
      
      // Schémas existants nécessaires
      { name: WordView.name, schema: WordViewSchema },
      { name: FavoriteWord.name, schema: FavoriteWordSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
      { name: Language.name, schema: LanguageSchema },
    ]),
    
    // Modules existants (sans imports circulaires)
    TranslationModule,
    LanguagesModule,
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}