/**
 * @fileoverview Module de recommandations intelligentes pour O'Ypunu
 * 
 * Ce module implémente un système de recommandations personnalisées
 * basé sur l'apprentissage automatique, l'analyse comportementale
 * et les préférences utilisateur pour améliorer l'expérience
 * d'apprentissage linguistique et la découverte de contenu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecommendationsController } from './controllers/recommendations.controller';
import { RecommendationsService } from './services/recommendations.service';
import {
  UserRecommendationProfile,
  UserRecommendationProfileSchema,
} from './schemas/user-recommendation-profile.schema';
import {
  RecommendationCache,
  RecommendationCacheSchema,
} from './schemas/recommendation-cache.schema';

// Import des modules existants nécessaires
import { UsersModule } from '../users/users.module';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { TranslationModule } from '../translation/translation.module';
import { LanguagesModule } from '../languages/languages.module';

// Import des schémas nécessaires
import { WordView, WordViewSchema } from '../users/schemas/word-view.schema';
import {
  FavoriteWord,
  FavoriteWordSchema,
} from '../dictionary/schemas/favorite-word.schema';
import {
  ActivityFeed,
  ActivityFeedSchema,
} from '../common/schemas/activity-feed.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';

/**
 * Module de recommandations intelligentes O'Ypunu
 * 
 * Ce module orchestre un système de recommandations sophistiqué qui :
 * 
 * ## 🧠 Intelligence artificielle :
 * - Profils utilisateur comportementaux avec UserRecommendationProfile
 * - Cache de recommandations optimisé pour performances
 * - Algorithmes d'apprentissage automatique adaptatifs
 * - Analyse des patterns d'usage et préférences linguistiques
 * 
 * ## 📊 Sources de données :
 * - **WordView** : Historique de consultation des mots
 * - **FavoriteWord** : Mots marqués comme favoris
 * - **ActivityFeed** : Activités et interactions utilisateur
 * - **Word, User, Language** : Données de base du dictionnaire
 * 
 * ## 🔄 Intégrations :
 * - **TranslationModule** : Recommandations de traductions intelligentes
 * - **LanguagesModule** : Suggestions de langues à apprendre
 * - Architecture sans dépendances circulaires pour stabilité
 * 
 * ## 🎯 Fonctionnalités :
 * - Recommandations de mots personnalisées
 * - Suggestions de langues basées sur les intérêts
 * - Contenu adaptatif selon le niveau d'apprentissage
 * - Cache intelligent pour performance optimale
 * 
 * @class RecommendationsModule
 * @version 1.0.0
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      // Nouveaux schémas pour les recommandations
      {
        name: UserRecommendationProfile.name,
        schema: UserRecommendationProfileSchema,
      },
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
