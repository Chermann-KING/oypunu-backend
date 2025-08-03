/**
 * @fileoverview Contrôleur REST pour la gestion des migrations de base de données
 *
 * Ce contrôleur spécialisé gère toutes les opérations de migration de base de données:
 * - Exécution et rollback des migrations
 * - Gestion des indexes critiques
 * - Monitoring et statut des migrations
 * - Opérations de forçage en cas d'urgence
 * - Statistiques et métriques de performance
 *
 * Tous les endpoints nécessitent une authentification JWT et des permissions
 * superadmin pour des raisons de sécurité critique et d'impact système.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RoleGuard } from "../../auth/guards/role.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { DatabaseMigrationService } from "../../database/database-migration.service";

/**
 * Contrôleur de gestion des migrations de base de données pour O'Ypunu
 *
 * Fournit une API REST sécurisée pour toutes les opérations de migration,
 * avec contrôle d'accès granulaire réservé aux superadministrateurs.
 *
 * ## Fonctionnalités principales :
 *
 * ### 🚀 Exécution de migrations
 * - Migration complète de la base de données
 * - Migration spécialisée des indexes critiques
 * - Forçage d'exécution en cas d'urgence
 *
 * ### 🔄 Opérations de rollback
 * - Rollback des indexes critiques
 * - Rollback complet de toutes les migrations
 * - Restauration sécurisée de l'état antérieur
 *
 * ### 📊 Monitoring et statut
 * - Vérification du statut des migrations
 * - Statistiques détaillées et métriques
 * - Historique des opérations exécutées
 *
 * ### ⚠️ Opérations critiques
 * - Toutes les méthodes nécessitent le rôle superadmin
 * - Logging détaillé de toutes les opérations
 * - Gestion d'erreurs avec métriques de performance
 *
 * @class DatabaseMigrationController
 * @version 1.0.0
 */
@ApiTags("Administration - Database Migration")
@Controller("admin/database")
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class DatabaseMigrationController {
  constructor(private databaseMigrationService: DatabaseMigrationService) {}

  /**
   * 📊 MÉTHODE STATISTIQUES DES MIGRATIONS
   *
   * Récupère les statistiques détaillées des migrations de base de données.
   * Cette méthode retourne des métriques complètes sur l'état et l'historique
   * des migrations exécutées sur la plateforme. Accessible uniquement aux
   * administrateurs et superadministrateurs pour des raisons de sécurité.
   *
   * @async
   * @method getMigrationStatistics
   * @returns {Promise<Object>} Statistiques détaillées des migrations
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/database/migrate/statistics
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "totalMigrations": 12,
   *   "executedMigrations": 10,
   *   "pendingMigrations": 2,
   *   "lastMigrationDate": "2025-01-01T12:00:00Z",
   *   "indexesStatus": {
   *     "total": 45,
   *     "active": 43,
   *     "failed": 2
   *   },
   *   "performanceMetrics": {
   *     "averageExecutionTime": 3.2,
   *     "totalExecutionTime": 32.5,
   *     "slowestMigration": "critical-indexes-migration"
   *   },
   *   "migrationHistory": [{
   *     "name": "critical-indexes-migration",
   *     "status": "completed",
   *     "executionTime": 5.8,
   *     "executedAt": "2025-01-01T10:30:00Z"
   *   }]
   * }
   * ```
   */
  @Post("migrate")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Exécuter toutes les migrations de base de données",
  })
  @ApiResponse({
    status: 200,
    description: "Migrations exécutées avec succès",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        timestamp: { type: "string" },
        migrationsExecuted: { type: "array", items: { type: "string" } },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Erreur lors de l'exécution des migrations",
  })
  async runAllMigrations() {
    const startTime = new Date();

    await this.databaseMigrationService.runAllMigrations();

    return {
      message: "Toutes les migrations ont été exécutées avec succès",
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      migrationsExecuted: ["critical-indexes-migration"],
    };
  }

  /**
   * 🔧 MÉTHODE MIGRATION DES INDEXES CRITIQUES
   *
   * Exécute la migration spécifique des indexes critiques de la base de données.
   * Cette méthode créé tous les indexes essentiels pour optimiser les performances
   * des requêtes sur les collections principales de la plateforme. Réservée aux
   * superadministrateurs pour des raisons de sécurité et d'impact système.
   *
   * @async
   * @method runIndexesMigration
   * @returns {Promise<Object>} Résultat détaillé de la migration avec métriques
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {InternalServerErrorException} Si erreur lors de la création des indexes
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /admin/database/migrate/indexes
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "message": "Migration des indexes critiques exécutée avec succès",
   *   "timestamp": "2025-01-01T12:00:00Z",
   *   "executionTime": 3200,
   *   "indexesCreated": [
   *     "Users: email, username, role, isEmailVerified",
   *     "Words: word, status, language, category, compound indexes",
   *     "Communities: language, name, createdBy, membersCount"
   *   ]
   * }
   * ```
   */
  @Post("migrate/indexes")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exécuter la migration des indexes critiques" })
  @ApiResponse({
    status: 200,
    description: "Migration des indexes exécutée avec succès",
  })
  async runIndexesMigration() {
    const startTime = new Date();

    await this.databaseMigrationService.runCriticalIndexesMigration();

    return {
      message: "Migration des indexes critiques exécutée avec succès",
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      indexesCreated: [
        "Users: email, username, role, isEmailVerified",
        "Words: word, status, language, category, compound indexes",
        "Communities: language, name, createdBy, membersCount",
        "Messages: conversation+timestamp, sender, readBy",
        "ActivityFeed: user+timestamp, type, type+timestamp",
        "RefreshTokens: token, user, TTL expiration",
      ],
    };
  }

  /**
   * 🔄 MÉTHODE ROLLBACK DES INDEXES CRITIQUES
   *
   * Exécute le rollback de la migration des indexes critiques de la base de données.
   * Cette méthode supprime tous les indexes créés par la migration des indexes
   * critiques, permettant de revenir à l'état antérieur en cas de problème.
   * Réservée aux superadministrateurs pour des raisons de sécurité et d'impact système.
   *
   * @async
   * @method rollbackIndexesMigration
   * @returns {Promise<Object>} Résultat détaillé du rollback avec métriques
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {InternalServerErrorException} Si erreur lors du rollback des indexes
   *
   * @example
   * ```typescript
   * // Appel API
   * DELETE /admin/database/migrate/indexes
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "message": "Rollback de la migration des indexes exécuté avec succès",
   *   "timestamp": "2025-01-01T12:00:00Z",
   *   "executionTime": 1800,
   *   "indexesRemoved": [
   *     "Users: email, username, role, isEmailVerified",
   *     "Words: word, status, language, category, compound indexes",
   *     "Communities: language, name, createdBy, membersCount"
   *   ]
   * }
   * ```
   */
  @Delete("migrate/indexes")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rollback de la migration des indexes critiques" })
  @ApiResponse({
    status: 200,
    description: "Rollback de la migration des indexes exécuté avec succès",
  })
  async rollbackIndexesMigration() {
    const startTime = new Date();

    await this.databaseMigrationService.rollbackCriticalIndexesMigration();

    return {
      message: "Rollback de la migration des indexes exécuté avec succès",
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      indexesRemoved: [
        "Tous les indexes créés par la migration ont été supprimés",
      ],
    };
  }

  /**
   * 📊 MÉTHODE VÉRIFICATION STATUT DES MIGRATIONS
   *
   * Vérifie et récupère le statut détaillé de toutes les migrations de base de données.
   * Cette méthode analyse l'état actuel des migrations, identifie celles qui sont
   * en attente, exécutées ou échouées, et fournit des métriques de performance.
   * Accessible aux administrateurs et superadministrateurs pour le monitoring.
   *
   * @async
   * @method getMigrationStatus
   * @returns {Promise<Object>} Statut détaillé et métriques des migrations
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {InternalServerErrorException} Si erreur lors de la vérification
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/database/migrate/status
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "message": "Statut des migrations récupéré avec succès",
   *   "timestamp": "2025-01-01T12:00:00Z",
   *   "migrations": {
   *     "total": 12,
   *     "executed": 10,
   *     "pending": 2,
   *     "failed": 0,
   *     "lastExecuted": "critical-indexes-migration",
   *     "lastExecutionDate": "2025-01-01T10:30:00Z",
   *     "pendingList": ["new-collections-migration", "performance-optimization"]
   *   }
   * }
   * ```
   */
  @Get("migrate/status")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Vérifier le statut des migrations" })
  @ApiResponse({
    status: 200,
    description: "Statut des migrations récupéré avec succès",
  })
  async getMigrationStatus() {
    const status = await this.databaseMigrationService.checkMigrationStatus();

    return {
      message: "Statut des migrations récupéré avec succès",
      timestamp: new Date().toISOString(),
      migrations: status,
    };
  }

  /**
   * ⚠️ MÉTHODE FORÇAGE D'EXÉCUTION DES MIGRATIONS
   *
   * Force l'exécution de toutes les migrations en ignorant les vérifications de sécurité.
   * Cette méthode dangereuse permet de passer outre les contrôles de validation et
   * d'exécuter les migrations même en cas d'erreurs détectées. À utiliser uniquement
   * en dernier recours lors de situations critiques. Réservée exclusivement aux
   * superadministrateurs pour des raisons de sécurité maximale.
   *
   * @async
   * @method forceMigrations
   * @returns {Promise<Object>} Résultat détaillé de l'opération forcée avec avertissements
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {InternalServerErrorException} Si erreur critique lors du forçage
   *
   * @warning ⚠️ OPÉRATION DANGEREUSE - Ignore les vérifications de sécurité
   * @warning ⚠️ À utiliser uniquement en cas d'urgence absolue
   * @warning ⚠️ Peut causer des corruptions de données si mal utilisée
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /admin/database/migrate/force
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "message": "⚠️ Migrations forcées exécutées avec succès",
   *   "timestamp": "2025-01-01T12:00:00Z",
   *   "executionTime": 5400,
   *   "warning": "Cette opération a ignoré les vérifications de sécurité",
   *   "forcedOperations": [
   *     "Validation des données ignorée",
   *     "Vérification des dépendances contournée",
   *     "Contrôles d'intégrité désactivés"
   *   ]
   * }
   * ```
   */
  @Post("migrate/force")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Forcer l'exécution des migrations (ignorer les vérifications)",
    description:
      "⚠️ ATTENTION: Cette opération force l'exécution même si des erreurs sont détectées",
  })
  @ApiResponse({
    status: 200,
    description: "Migrations forcées exécutées avec succès",
  })
  async forceMigrations() {
    const startTime = new Date();

    await this.databaseMigrationService.forceMigrations();

    return {
      message: "⚠️ Migrations forcées exécutées avec succès",
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      warning: "Cette opération a ignoré les vérifications de sécurité",
    };
  }

  /**
   * 🔄 MÉTHODE ROLLBACK DE TOUTES LES MIGRATIONS
   *
   * Exécute le rollback complet de toutes les migrations de base de données.
   * Cette méthode dangereuse supprime tous les indexes et modifications créés
   * par l'ensemble des migrations, permettant de revenir à l'état initial de
   * la base de données. Réservée exclusivement aux superadministrateurs pour
   * des raisons de sécurité critique et d'impact système majeur.
   *
   * @async
   * @method rollbackAllMigrations
   * @returns {Promise<Object>} Résultat détaillé de l'opération de rollback complet
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {InternalServerErrorException} Si erreur lors du rollback global
   *
   * @warning ⚠️ OPÉRATION EXTRÊMEMENT DANGEREUSE - Supprime tous les indexes
   * @warning ⚠️ Peut affecter gravement les performances de la base de données
   * @warning ⚠️ À utiliser uniquement en cas d'urgence absolue
   *
   * @example
   * ```typescript
   * // Appel API
   * DELETE /admin/database/migrate/all
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "message": "⚠️ Rollback de toutes les migrations exécuté avec succès",
   *   "timestamp": "2025-01-01T12:00:00Z",
   *   "executionTime": 8500,
   *   "warning": "Tous les indexes créés par les migrations ont été supprimés",
   *   "operations": [
   *     "Suppression des indexes critiques",
   *     "Rollback des collections optimisées",
   *     "Restauration de l'état initial"
   *   ]
   * }
   * ```
   */
  @Delete("migrate/all")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rollback de toutes les migrations",
    description:
      "⚠️ ATTENTION: Cette opération supprime tous les indexes créés par les migrations",
  })
  @ApiResponse({
    status: 200,
    description: "Rollback de toutes les migrations exécuté avec succès",
  })
  async rollbackAllMigrations() {
    const startTime = new Date();

    await this.databaseMigrationService.rollbackAllMigrations();

    return {
      message: "⚠️ Rollback de toutes les migrations exécuté avec succès",
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      warning: "Tous les indexes créés par les migrations ont été supprimés",
    };
  }
}
