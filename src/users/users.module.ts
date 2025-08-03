/**
 * @fileoverview Module de gestion des utilisateurs O'Ypunu
 * 
 * Ce module centralise toute la gestion des utilisateurs avec profils
 * personnalisés, système de contribution, demandes de statut contributeur,
 * historique d'activité et intégration complète avec le dictionnaire.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { User, UserSchema } from './schemas/user.schema';
import {
  ActivityFeed,
  ActivityFeedSchema,
} from '../common/schemas/activity-feed.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { WordView, WordViewSchema } from './schemas/word-view.schema';
import {
  ContributorRequest,
  ContributorRequestSchema,
} from './schemas/contributor-request.schema';
import {
  FavoriteWord,
  FavoriteWordSchema,
} from '../dictionary/schemas/favorite-word.schema';
import { UsersController } from './controllers/users.controller';
import { ContributorRequestController } from './controllers/contributor-request.controller';
import { UsersService } from './services/users.service';
import { ContributorRequestService } from './services/contributor-request.service';
import { ContributorRequestListener } from './listeners/contributor-request.listener';
import { MailService } from '../common/services/mail.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module de gestion des utilisateurs O'Ypunu
 * 
 * Ce module orchestre un écosystème utilisateur complet avec :
 * 
 * ## 👤 Gestion des profils utilisateur :
 * - **User** : Schéma utilisateur principal avec rôles et permissions
 * - **ActivityFeed** : Historique complet des actions utilisateur
 * - **WordView** : Tracking des consultations pour analytics
 * - **ContributorRequest** : Workflow de demandes de contribution
 * - **FavoriteWord** : Système de favoris personnalisé
 * 
 * ## 🎯 Contrôleurs spécialisés :
 * - **UsersController** : CRUD utilisateur et gestion profils
 * - **ContributorRequestController** : Workflow contribution
 * 
 * ## ⚙️ Services métier :
 * - **UsersService** : Logique métier principale utilisateurs
 * - **ContributorRequestService** : Gestion demandes contribution
 * - **ContributorRequestListener** : Events et notifications
 * - **MailService** : Notifications email automatisées
 * 
 * ## 🔄 Intégrations :
 * - **RepositoriesModule** : Pattern Repository pour abstraction données
 * - **Word/Dictionary** : Intégration complète avec le dictionnaire
 * - Architecture découplée pour réutilisabilité maximale
 * 
 * ## 📤 Exports :
 * - Services utilisateur pour autres modules
 * - Schémas Mongoose pour intégrations externes
 * - Services de contribution pour workflow global
 * 
 * @class UsersModule
 * @version 1.0.0
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
      { name: Word.name, schema: WordSchema },
      { name: WordView.name, schema: WordViewSchema },
      { name: ContributorRequest.name, schema: ContributorRequestSchema },
      { name: FavoriteWord.name, schema: FavoriteWordSchema },
    ]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    RepositoriesModule,
  ],
  controllers: [UsersController, ContributorRequestController],
  providers: [
    UsersService,
    ContributorRequestService,
    ContributorRequestListener,
    MailService,
  ],
  exports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UsersService,
    ContributorRequestService,
  ],
})
export class UsersModule {}
