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
