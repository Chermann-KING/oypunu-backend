/**
 * @fileoverview Module NestJS pour l'administration et la gestion système
 * 
 * Ce module centralise toutes les fonctionnalités d'administration de O'Ypunu,
 * incluant la gestion des utilisateurs, modération de contenu, analytics avancées,
 * migrations de base de données et sécurité JWT. Il fournit des outils complets
 * pour les administrateurs et super-administrateurs.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminController } from "./controllers/admin.controller";
import { DatabaseMigrationController } from "./controllers/database-migration.controller";
import { JwtSecurityController } from "./controllers/jwt-security.controller";
import { AdminService } from "./services/admin.service";
import { AnalyticsService } from "./services/analytics.service";
import { DatabaseModule } from "../database/database.module";
import { UsersModule } from "../users/users.module";
import { DictionaryModule } from "../dictionary/dictionary.module";
import { RepositoriesModule } from "../repositories/repositories.module";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Word, WordSchema } from "../dictionary/schemas/word.schema";
import {
  Community,
  CommunitySchema,
} from "../communities/schemas/community.schema";
import {
  CommunityMember,
  CommunityMemberSchema,
} from "../communities/schemas/community-member.schema";
import {
  CommunityPost,
  CommunityPostSchema,
} from "../communities/schemas/community-post.schema";
import { Message, MessageSchema } from "../messaging/schemas/message.schema";
import {
  ActivityFeed,
  ActivityFeedSchema,
} from "../common/schemas/activity-feed.schema";

/**
 * Module d'administration centrale pour O'Ypunu
 * 
 * Ce module fournit une interface d'administration complète avec des outils
 * avancés pour la gestion de la plateforme, la modération de contenu,
 * l'analytics en temps réel et la maintenance système.
 * 
 * ## Fonctionnalités d'administration :
 * 
 * ### 👥 Gestion des utilisateurs
 * - Modération et suspension de comptes
 * - Gestion des rôles et permissions
 * - Analytics utilisateur détaillées
 * - Audit des activités suspectes
 * 
 * ### 📚 Modération de contenu
 * - Approbation/rejet de mots
 * - Modération des communautés
 * - Gestion des signalements
 * - Filtrage automatique de contenu
 * 
 * ### 🔧 Outils système
 * - Migrations de base de données
 * - Gestion de la sécurité JWT
 * - Monitoring des performances
 * - Configuration système
 * 
 * ### 📊 Analytics avancées
 * - Métriques en temps réel
 * - Rapports personnalisés
 * - Tendances d'usage
 * - KPIs et tableaux de bord
 * 
 * @module AdminModule
 * @version 1.0.0
 */
@Module({
  imports: [
    // Schémas Mongoose pour accès direct aux données
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Word.name, schema: WordSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: CommunityMember.name, schema: CommunityMemberSchema },
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
    ]),
    
    // Modules fonctionnels
    DatabaseModule,     // Outils de base de données et migrations
    UsersModule,        // Gestion des utilisateurs
    DictionaryModule,   // Modération du dictionnaire
    RepositoriesModule, // Repositories pour accès aux données
  ],
  controllers: [
    AdminController,              // API principale d'administration
    DatabaseMigrationController, // Gestion des migrations DB
    JwtSecurityController,        // Sécurité et rotation JWT
  ],
  providers: [
    AdminService,     // Logique métier d'administration
    AnalyticsService, // Analytics et rapports avancés
  ],
  exports: [
    AdminService,     // Service disponible pour d'autres modules
    AnalyticsService, // Analytics réutilisables
  ],
})
export class AdminModule {}
