/**
 * @fileoverview Module racine de l'application O'Ypunu
 * 
 * Ce module centralise l'architecture complète de l'application avec
 * orchestration de tous les modules métier, configuration des services
 * globaux, middleware et intégrations pour un dictionnaire social multilingue.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
// import { RedisModule } from '@nestjs-modules/ioredis';
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SecurityModule } from "./auth/security/security.module";
import { AdminModule } from "./admin/admin.module";
import { DictionaryModule } from "./dictionary/dictionary.module";
import { HomeModule } from "./home/home.module";
import { CommunitiesModule } from "./communities/communities.module";
import { MessagingModule } from "./messaging/messaging.module";
import { TranslationModule } from "./translation/translation.module";
import { LanguagesModule } from "./languages/languages.module";
import { ActivityModule } from "./common/activity.module";
import { RecommendationsModule } from "./recommendations/recommendations.module";
// ✨ NOUVEAUX MODULES - Endpoints manquants ajoutés
import { AnalyticsModule } from "./analytics/analytics.module";
import { ModerationModule } from "./moderation/moderation.module";
import { SearchModule } from "./search/search.module";
import { AchievementsModule } from "./achievements/achievements.module";
import { SocialModule } from "./social/social.module";
import { ActivityTrackingMiddleware } from "./common/middleware/activity-tracking.middleware";
// import { LessonsModule } from './lessons/lessons.module';

/**
 * Module racine de l'application O'Ypunu
 * 
 * Architecture centrale orchestrant un écosystème complet de dictionnaire
 * social multilingue avec intelligence artificielle, communautés interactives
 * et fonctionnalités avancées d'apprentissage linguistique.
 * 
 * ## 🏗️ Architecture modulaire :
 * 
 * ### 🔧 Configuration et infrastructure
 * - **ConfigModule** : Configuration globale avec variables d'environnement
 * - **MongooseModule** : Connexion MongoDB avec gestion d'erreurs robuste
 * - **EventEmitterModule** : Système d'événements pour communication inter-modules
 * - **Redis (préparé)** : Cache distribué pour performances optimales
 * 
 * ### 🔐 Authentification et sécurité
 * - **SecurityModule** : Protection avancée JWT et validation sécurisée
 * - **AuthModule** : Authentification complète avec OAuth et 2FA
 * - **UsersModule** : Gestion des profils et préférences utilisateur
 * 
 * ### 📚 Dictionnaire et contenu
 * - **DictionaryModule** : Cœur du dictionnaire avec gestion complète des mots
 * - **LanguagesModule** : Support multilingue avec 50+ langues
 * - **TranslationModule** : Traductions intelligentes avec IA
 * 
 * ### 🤝 Fonctionnalités sociales
 * - **CommunitiesModule** : Communautés linguistiques avec forums
 * - **MessagingModule** : Système de messagerie temps réel avec WebSocket
 * - **SocialModule** : Interactions sociales (likes, partages, commentaires)
 * 
 * ### 🧠 Intelligence artificielle
 * - **RecommendationsModule** : Recommandations personnalisées avec ML
 * - **SearchModule** : Recherche avancée avec suggestions intelligentes
 * - **AnalyticsModule** : Analytics comportementaux et métriques avancées
 * 
 * ### 🎮 Engagement utilisateur
 * - **AchievementsModule** : Système de badges et gamification
 * - **ActivityModule** : Tracking d'activité pour personnalisation
 * - **ModerationModule** : Modération communautaire et signalements
 * 
 * ### 🏠 Interface et administration
 * - **HomeModule** : Tableau de bord et interface principale
 * - **AdminModule** : Interface d'administration complète
 * 
 * ## 🔄 Middleware et intégrations :
 * - **ActivityTrackingMiddleware** : Suivi d'activité pour analytics
 * - **Exclusions intelligentes** : Optimisation pour endpoints publics
 * - **Event-driven architecture** : Communication asynchrone entre modules
 * 
 * @class AppModule
 * @implements {NestModule}
 * @version 1.0.0
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: ".",
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const uri = await Promise.resolve(
          configService.get<string>("MONGODB_URI")
        );
        if (!uri) {
          throw new Error(
            "MONGODB_URI n'est pas définie dans les variables d'environnement"
          );
        }
        return { uri };
      },
      inject: [ConfigService],
    }),
    // RedisModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => {
    //     const redisUrl = configService.get<string>("REDIS_URL");
    //     if (!redisUrl) {
    //       // Fallback vers une configuration locale si REDIS_URL n'est pas définie
    //       return {
    //         type: 'single',
    //         options: {
    //           host: 'localhost',
    //           port: 6379,
    //         },
    //       };
    //     }
    //     return {
    //       type: 'single',
    //       options: {
    //         url: redisUrl,
    //       },
    //     };
    //   },
    //   inject: [ConfigService],
    // }),
    SecurityModule,
    AuthModule,
    UsersModule,
    DictionaryModule,
    HomeModule,
    CommunitiesModule,
    MessagingModule,
    AdminModule,
    TranslationModule,
    LanguagesModule,
    ActivityModule,
    RecommendationsModule,
    // ✨ NOUVEAUX MODULES - Fonctionnalités avancées
    AnalyticsModule,      // 📊 Dashboard et métriques admin
    ModerationModule,     // 🛡️ Signalements et modération
    SearchModule,         // 🔍 Recherche avancée avec suggestions
    AchievementsModule,   // 🏆 Système de badges et gamification
    SocialModule,         // 👥 Fonctionnalités sociales (likes, partages, commentaires)
    // LessonsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  /**
   * Configure les middleware globaux de l'application
   * 
   * Implémente une stratégie de middleware intelligente avec tracking
   * d'activité sélectif pour optimiser les performances tout en
   * maintenant une visibilité complète sur l'usage de l'API.
   * 
   * @method configure
   * @param {MiddlewareConsumer} consumer - Consumer NestJS pour configuration middleware
   * 
   * ## 🎯 Stratégie de middleware :
   * 
   * ### 📊 ActivityTrackingMiddleware appliqué globalement
   * - **Tracking intelligent** : Suivi d'activité pour analytics et personnalisation
   * - **Performance optimisée** : Exclusions sur endpoints non critiques
   * - **Données comportementales** : Base pour recommandations et métriques
   * 
   * ### 🚫 Exclusions stratégiques :
   * - **Page d'accueil (/)** : Endpoint public sans tracking nécessaire
   * - **Authentification** : /auth/login, /auth/register pour performance
   * - **Analytics publiques** : Endpoints de monitoring et statistiques
   * - **Données système** : /users/allusers pour éviter boucles infinies
   * 
   * @example
   * // Le middleware sera appliqué à tous ces endpoints :
   * // GET /api/words - ✅ Trackés
   * // POST /api/words/{id}/favorite - ✅ Trackés  
   * // GET /auth/login - ❌ Exclus pour performance
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ActivityTrackingMiddleware)
      .exclude(
        "/",
        "/auth/login",
        "/auth/register",
        "/users/analytics/online-contributors",
        "/users/allusers"
      )
      .forRoutes("*"); // Appliquer aux routes qui peuvent être authentifiées
  }
}
