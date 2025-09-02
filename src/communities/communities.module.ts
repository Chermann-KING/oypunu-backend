/**
 * @fileoverview Module des communautés et interactions sociales pour O'Ypunu
 * 
 * Ce module gère toute la dimension sociale de la plateforme O'Ypunu
 * incluant la création de communautés, gestion des membres, publications,
 * commentaires, système de votes et modération communautaire.
 * Il fournit une infrastructure complète pour les interactions sociales.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Community, CommunitySchema } from './schemas/community.schema';
import { CommunityMember, CommunityMemberSchema } from './schemas/community-member.schema';
import { CommunityPost, CommunityPostSchema } from './schemas/community-post.schema';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';
import { CommunitiesController } from './controllers/communities.controller';
import { CommunityPostsController } from './controllers/community-posts.controller';
import { CommunitiesService } from './services/communities.service';
import { CommunityPostsService } from './services/community-posts.service';
import { VotingService } from './services/voting.service';
import { UsersModule } from '../users/users.module';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module des communautés et interactions sociales pour O'Ypunu
 * 
 * Ce module centralise toutes les fonctionnalités sociales de la plateforme
 * avec un écosystème complet de communautés interactives :
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 🏠 Gestion de communautés
 * - Création et configuration de communautés
 * - Communautés publiques et privées
 * - Système de tags et catégorisation
 * - Modération et administration
 * 
 * ### 👥 Gestion des membres
 * - Adhésion et désAdhésion
 * - Rôles et permissions dans les communautés
 * - Système d'invitations
 * - Moderation et exclusions
 * 
 * ### 📝 Publications et contenu
 * - Création et édition de posts
 * - Support multimédia (images, liens)
 * - Système de commentaires imbriqués
 * - Partage et mentions d'utilisateurs
 * 
 * ### 🗣️ Interactions sociales
 * - Système de votes (upvotes/downvotes)
 * - Likes et réactions
 * - Notifications en temps réel
 * - Threads de discussion avancés
 * 
 * ### 🔍 Découverte et recherche
 * - Recherche multicritères de communautés
 * - Filtrage par langue et thématiques
 * - Recommandations personnalisées
 * - Trending et communautés populaires
 * 
 * @module CommunitiesModule
 * @version 1.0.0
 */
@Module({
  imports: [
    // Schémas Mongoose pour toutes les entités communautaires
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },           // Communautés principales
      { name: CommunityMember.name, schema: CommunityMemberSchema }, // Membres et rôles
      { name: CommunityPost.name, schema: CommunityPostSchema },     // Publications
      { name: PostComment.name, schema: PostCommentSchema },        // Commentaires
      { name: Vote.name, schema: VoteSchema },                      // Système de votes
      { name: Language.name, schema: LanguageSchema },             // Langues pour population
    ]),
    RepositoriesModule, // Accès aux repositories pour persistance
    UsersModule,        // Intégration avec le système utilisateur
  ],
  controllers: [
    CommunitiesController,     // API REST des communautés
    CommunityPostsController, // API REST des publications
  ],
  providers: [
    CommunitiesService,     // Logique métier des communautés
    CommunityPostsService, // Gestion des publications
    VotingService,         // Système de votes et réactions
  ],
  exports: [
    CommunitiesService,     // Service exporté pour autres modules
    CommunityPostsService, // Service de posts réutilisable
    VotingService,         // Système de votes réutilisable
  ],
})
export class CommunitiesModule {}
