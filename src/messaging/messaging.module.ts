import { Module } from "@nestjs/common";
import { MessagingService } from "./services/messaging.service";
import { MessagingController } from "./controllers/messaging.controller";
import { MessagingEnhancedService } from "./services/messaging-enhanced.service";
import { MessagingEnhancedController } from "./controllers/messaging-enhanced.controller";
import { MessagingGateway } from "./gateways/messaging.gateway";
import { RepositoriesModule } from "../repositories/repositories.module";
import { DictionaryModule } from "../dictionary/dictionary.module";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    RepositoriesModule,
    DictionaryModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  controllers: [
    MessagingController, // 👈 GARDE l'ancien pour compatibilité (/messaging)
    MessagingEnhancedController, // 👈 AJOUTE le nouveau (/messaging/enhanced)
  ],
  providers: [
    MessagingService, // 👈 Service basique
    MessagingEnhancedService, // 👈 Service avancé
    MessagingGateway,
  ],
  exports: [MessagingService, MessagingEnhancedService, MessagingGateway],
})
export class MessagingModule {}
