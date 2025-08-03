/**
 * @fileoverview Module de gestion des langues pour O'Ypunu
 * 
 * Ce module centralise toute la logique de gestion des langues de la plateforme
 * avec proposition, modération, validation et intégration complète des standards
 * internationaux ISO pour enrichir l'écosystème linguistique africain.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Language, LanguageSchema } from './schemas/language.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LanguagesService } from './services/languages.service';
import { LanguagesController } from './controllers/languages.controller';
import { LanguageMigrationService } from './migration/language-migration.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module de gestion complète des langues O'Ypunu
 * 
 * Ce module orchestre l'ensemble du système de gestion des langues :\n * 
 * ## 🌍 Fonctionnalités principales :
 * - **Proposition langues** : Interface utilisateur pour proposer de nouvelles langues
 * - **Workflow modération** : Processus d'approbation/rejet par les administrateurs
 * - **Standards internationaux** : Support complet des codes ISO 639-1/2/3
 * - **Migration données** : Outils de migration et synchronisation
 * - **API REST** : Endpoints pour la gestion CRUD des langues
 * 
 * ## 📊 Architecture modulaire :
 * - **Controller** : LanguagesController - Endpoints API publics
 * - **Service** : LanguagesService - Logique métier et validation
 * - **Migration** : LanguageMigrationService - Outils de migration
 * - **Repository** : Via RepositoriesModule - Couche d'accès aux données
 * 
 * ## 🗄️ Modèles de données :
 * - **Language** : Schéma principal des langues avec métadonnées
 * - **Word** : Référence pour validation des langues actives
 * - **User** : Référence pour traçabilité des propositions
 * 
 * ## 🔐 Sécurité et permissions :
 * - **Proposition** : Utilisateurs authentifiés uniquement
 * - **Modération** : Admins et super-admins uniquement
 * - **Consultation** : Public pour langues approuvées
 * 
 * ## 🌐 Support multilingue :
 * - **Scripts** : Support de multiples systèmes d'écriture
 * - **Variantes** : Gestion des dialectes et variantes régionales
 * - **Localisation** : Adaptation aux spécificités géographiques
 * 
 * @module LanguagesModule
 * @version 1.0.0
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Language.name, schema: LanguageSchema },
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
    ]),
    RepositoriesModule,
  ],
  controllers: [LanguagesController],
  providers: [LanguagesService, LanguageMigrationService],
  exports: [LanguagesService, LanguageMigrationService],
})
export class LanguagesModule {}
