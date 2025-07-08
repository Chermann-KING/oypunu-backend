import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schémas existants (réutilisés)
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Category,
  CategorySchema,
} from '../dictionary/schemas/category.schema';

// Nouveaux schémas pour le système de traduction
import {
  TranslationGroup,
  TranslationGroupSchema,
} from './schemas/translation-group.schema';
import {
  TrainingData,
  TrainingDataSchema,
} from './schemas/training-data.schema';

// Services
import { TranslationService } from './services/translation.service';
import { SimilarityService } from './services/similarity.service';
import { LearningService } from './services/learning.service';

// Contrôleurs
import { TranslationController } from './controllers/translation.controller';

// Modules existants
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Importer les schémas nécessaires
    MongooseModule.forFeature([
      // Schémas existants (pas de modification)
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
      { name: Category.name, schema: CategorySchema },

      // Nouveaux schémas pour les traductions intelligentes
      { name: TranslationGroup.name, schema: TranslationGroupSchema },
      { name: TrainingData.name, schema: TrainingDataSchema },
    ]),

    // Importer le module Users pour accéder aux services utilisateur
    UsersModule,
  ],
  controllers: [TranslationController],
  providers: [
    // Services principaux
    TranslationService,
    SimilarityService,
    LearningService,
  ],
  exports: [
    // Exporter les services pour utilisation dans d'autres modules
    TranslationService,
    SimilarityService,
    LearningService,
  ],
})
export class TranslationModule {
  constructor() {
    console.log(
      '🌐 Translation Module - Système de traduction intelligente initialisé',
    );
    console.log('   ✅ Algorithme de similarité sémantique');
    console.log('   ✅ Apprentissage adaptatif');
    console.log('   ✅ Détection automatique de doublons');
    console.log('   ✅ API RESTful complète');
  }
}
