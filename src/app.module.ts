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
import { CommunityPostsController } from "./communities/controllers/community-posts.controller";
import { CommunitiesService } from "./communities/services/communities.service";
import {
  Community,
  CommunitySchema,
} from "./communities/schemas/community.schema";
import {
  CommunityMember,
  CommunityMemberSchema,
} from "./communities/schemas/community-member.schema";
import { User, UserSchema } from "./users/schemas/user.schema";
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
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: CommunityMember.name, schema: CommunityMemberSchema },
      { name: User.name, schema: UserSchema },
    ]),
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
    // LessonsModule,
  ],
  controllers: [AppController, CommunityPostsController],
  providers: [AppService, CommunitiesService],
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
