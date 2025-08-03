/**
 * @fileoverview Module de messagerie temps réel pour O'Ypunu
 * 
 * Ce module fournit un système de messagerie complet avec communication
 * temps réel via WebSockets, gestion des conversations privées et de groupe,
 * et intégration avec le système de dictionnaire pour traductions contextuelles.
 * Il propose deux niveaux de service : basique et avancé.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from "@nestjs/common";
import { MessagingService } from "./services/messaging.service";
import { MessagingController } from "./controllers/messaging.controller";
import { MessagingEnhancedService } from "./services/messaging-enhanced.service";
import { MessagingEnhancedController } from "./controllers/messaging-enhanced.controller";
import { MessagingGateway } from "./gateways/messaging.gateway";
import { RepositoriesModule } from "../repositories/repositories.module";
import { DictionaryModule } from "../dictionary/dictionary.module";
import { JwtModule } from "@nestjs/jwt";

/**
 * Module de messagerie temps réel O'Ypunu
 * 
 * Ce module implémente un système de messagerie sophistiqué avec
 * architecture hybride REST/WebSocket pour maximum de flexibilité :
 * 
 * ## Architecture en couches :
 * 
 * ### 🔌 Couche Transport
 * - REST API pour opérations CRUD standard
 * - WebSocket Gateway pour communications temps réel
 * - Support authentification JWT pour les deux couches
 * 
 * ### 🛠️ Services Duaux
 * - MessagingService : API basique pour compatibilité
 * - MessagingEnhancedService : API avancée avec features complètes
 * - Transition progressive sans rupture de compatibilité
 * 
 * ### 🔗 Intégrations
 * - RepositoriesModule : Accès données optimisé
 * - DictionaryModule : Traductions contextuelles dans messages
 * - JwtModule : Authentification sécurisée des connexions
 * 
 * ### 📡 Fonctionnalités temps réel
 * - Messages instantanés avec accusés de réception
 * - Indicateurs de frappe (typing indicators)
 * - Présence utilisateur (online/offline)
 * - Notifications push intégrées
 * 
 * @module MessagingModule
 * @version 1.0.0
 */
@Module({
  imports: [
    /** Accès aux repositories pour persistance des données */
    RepositoriesModule,
    /** Intégration dictionnaire pour traductions contextuelles */
    DictionaryModule,
    /** Configuration JWT pour authentification WebSocket */
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  controllers: [
    /** Contrôleur basique pour compatibilité ascendante */
    MessagingController,
    /** Contrôleur avancé avec fonctionnalités complètes */
    MessagingEnhancedController,
  ],
  providers: [
    /** Service de messagerie basique */
    MessagingService,
    /** Service de messagerie avancé avec features étendues */
    MessagingEnhancedService,
    /** Gateway WebSocket pour communications temps réel */
    MessagingGateway,
  ],
  exports: [
    /** Services exportés pour utilisation par autres modules */
    MessagingService, 
    MessagingEnhancedService, 
    MessagingGateway
  ],
})
export class MessagingModule {}
