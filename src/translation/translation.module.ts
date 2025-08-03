/**
 * @fileoverview Module de traduction intelligente O'Ypunu avec IA
 * 
 * Ce module implémente un système de traduction sophistiqué avec
 * intelligence artificielle, apprentissage automatique et validation
 * communautaire pour garantir la qualité et la cohérence des traductions.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

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

/**
 * Module de traduction intelligente O'Ypunu
 * 
 * Orchestration complète d'un système de traduction avancé avec
 * intelligence artificielle, apprentissage adaptatif et validation
 * communautaire pour l'excellence multilingue du dictionnaire.
 * 
 * ## 🧠 Intelligence artificielle :
 * 
 * ### 🔍 Détection intelligente des doublons
 * - **SimilarityService** : Algorithmes de similarité sémantique avancés
 * - **Fuzzy matching** : Détection de traductions quasi-identiques
 * - **Analyse contextuelle** : Comparaison des nuances linguistiques
 * 
 * ### 📊 Apprentissage automatique
 * - **LearningService** : Système d'apprentissage adaptatif
 * - **Seuils dynamiques** : Auto-ajustement des critères de validation
 * - **Feedback utilisateur** : Amélioration continue par les interactions
 * 
 * ### 🎯 Validation communautaire
 * - **TranslationGroup** : Groupement de traductions similaires
 * - **Votes pondérés** : Système de validation par la communauté
 * - **Fusion intelligente** : Combinaison optimale des traductions
 * 
 * ## 📋 Schémas de données :
 * - **TranslationGroup** : Groupes de traductions similaires avec scoring
 * - **TrainingData** : Données d'entraînement pour l'IA et métriques
 * 
 * ## 🔄 Services spécialisés :
 * - **TranslationService** : Logique métier principale des traductions
 * - **SimilarityService** : Algorithmes de comparaison et scoring
 * - **LearningService** : Machine learning et optimisation continue
 * 
 * ## 🌐 Intégrations :
 * - **UsersModule** : Gestion des contributeurs et réputation
 * - **RepositoriesModule** : Accès aux données avec pattern Repository
 * - **Architecture modulaire** : Extensibilité et maintenance facilitée
 * 
 * @class TranslationModule
 * @version 1.0.0
 */
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
  /**
   * Constructeur du module de traduction avec initialisation des logs
   */
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
