import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

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
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    // Importer seulement les schémas spécifiques au module translation
    MongooseModule.forFeature([
      // Nouveaux schémas pour les traductions intelligentes
      { name: TranslationGroup.name, schema: TranslationGroupSchema },
      { name: TrainingData.name, schema: TrainingDataSchema },
    ]),

    // Importer les repositories pour accéder aux données
    RepositoriesModule,
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
