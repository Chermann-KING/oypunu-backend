/**
 * @fileoverview Module d'activité et tracking utilisateur pour O'Ypunu
 * 
 * Ce module centralise toutes les fonctionnalités de suivi d'activité,
 * gestion de quotas, limitation de taux et tracking en temps réel
 * des actions utilisateur. Il fournit une infrastructure complète
 * pour l'audit, les analytics et la protection contre les abus.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { ActivityService } from './services/activity.service';
import { QuotaService } from './services/quota.service';
import { ActivityGateway } from './gateways/activity.gateway';
import { ActivityController } from './controllers/activity.controller';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { RateLimitGuard, QuotaIncrementInterceptor } from './guards/rate-limit.guard';
import { RepositoriesModule } from '../repositories/repositories.module';
import { SecurityModule } from '../auth/security/security.module';

/**
 * Module d'activité et tracking utilisateur pour O'Ypunu
 * 
 * Ce module fournit une infrastructure complète de suivi d'activité
 * et de gestion des quotas avec des fonctionnalités avancées :
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 📊 Tracking d'activité
 * - Suivi en temps réel des actions utilisateur
 * - Feed d'activité personnalisé et global
 * - Métadonnées enrichies par action
 * - WebSocket pour notifications temps réel
 * 
 * ### 🚦 Gestion des quotas
 * - Quotas personnalisables par type d'action
 * - Limitations par période (heure/jour/mois)
 * - Quotas différenciés par rôle utilisateur
 * - Réinitialisation automatique
 * 
 * ### 🛡️ Protection contre les abus
 * - Rate limiting configurable
 * - Détection d'activité suspecte
 * - Blocage automatique temporaire
 * - Audit des violations de quota
 * 
 * ### 🔄 Communication temps réel
 * - WebSocket Gateway pour notifications
 * - Events système distribués
 * - Synchronisation multi-instance
 * - Cache distribué pour performances
 * 
 * @module ActivityModule
 * @version 1.0.0
 */
@Module({
  imports: [
    RepositoriesModule, // Accès aux repositories pour persistance
    SecurityModule,     // Services de sécurité et rate limiting
  ],
  controllers: [
    ActivityController, // API REST pour gestion d'activité
  ],
  providers: [
    ActivityService,             // Service principal de tracking
    QuotaService,               // Gestion des quotas utilisateur
    ActivityGateway,            // WebSocket pour temps réel
    RateLimitMiddleware,        // Middleware de limitation de taux
    RateLimitGuard,            // Guard de protection contre spam
    QuotaIncrementInterceptor  // Intercepteur pour comptage automatique
  ],
  exports: [
    ActivityService,             // Exporté pour autres modules
    QuotaService,               // Service de quotas réutilisable
    RateLimitMiddleware,        // Middleware exporté
    RateLimitGuard,            // Guard exporté
    QuotaIncrementInterceptor  // Intercepteur exporté
  ],
})
export class ActivityModule {}
