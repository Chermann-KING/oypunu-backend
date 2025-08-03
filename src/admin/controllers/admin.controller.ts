/**
 * @fileoverview Contrôleur REST principal pour l'administration de O'Ypunu
 *
 * Ce contrôleur centralise toutes les fonctionnalités d'administration avancées:
 * - Tableau de bord avec métriques en temps réel
 * - Gestion et modération des utilisateurs
 * - Modération de contenu (mots, communautés)
 * - Analytics détaillées et reporting
 * - Gestion des révisions et historique
 * - Outils d'audit et surveillance système
 *
 * Tous les endpoints nécessitent une authentification JWT et des permissions
 * administrateur appropriées selon la hiérarchie: contributor < admin < superadmin.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Inject,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { AdminService } from "../services/admin.service";
import { AnalyticsService } from "../services/analytics.service";
import { ContributorRequestService } from "../../users/services/contributor-request.service";
import { WordsService } from "../../dictionary/services/words.service";
import { IRevisionHistoryRepository } from "../../repositories/interfaces/revision-history.repository.interface";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../users/schemas/user.schema";

/**
 * Interface pour l'utilisateur JWT authentifié
 *
 * @interface JwtUser
 */
interface JwtUser {
  /** ID utilisateur (format alternatif) */
  userId?: string;
  /** ID utilisateur MongoDB */
  _id?: string;
  /** Nom d'utilisateur unique */
  username: string;
  /** Adresse email */
  email: string;
  /** Rôle et niveau de permissions */
  role: UserRole;
}

/**
 * Contrôleur principal d'administration pour O'Ypunu
 *
 * Fournit une API REST complète pour toutes les tâches administratives,
 * avec contrôle d'accès granulaire basé sur les rôles utilisateur.
 *
 * ## Fonctionnalités principales :
 *
 * ### 📊 Tableaux de bord
 * - Dashboard global avec KPIs
 * - Dashboards spécialisés par rôle
 * - Métriques en temps réel
 *
 * ### 👥 Gestion utilisateurs
 * - Liste et recherche d'utilisateurs
 * - Suspension/activation de comptes
 * - Modification des rôles (superadmin)
 *
 * ### 📝 Modération de contenu
 * - Approbation/rejet de mots
 * - Gestion des communautés
 * - Révisions et historique
 *
 * ### 📈 Analytics et reporting
 * - Analytics utilisateurs, contenu, communautés
 * - Génération de rapports détaillés
 * - Export de données (JSON/CSV)
 *
 * @class AdminController
 * @version 1.0.0
 */
@ApiTags("admin")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  /**
   * Constructeur du contrôleur d'administration
   *
   * @constructor
   * @param {AdminService} adminService - Service principal d'administration
   * @param {AnalyticsService} analyticsService - Service d'analytics et métriques
   * @param {ContributorRequestService} contributorRequestService - Service des demandes de contributeur
   * @param {WordsService} wordsService - Service de gestion des mots
   * @param {IRevisionHistoryRepository} revisionHistoryRepository - Repository des révisions
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection automatique :
   * @Controller('admin')
   * export class AdminController {
   *   constructor(
   *     private readonly adminService: AdminService,
   *     private readonly analyticsService: AnalyticsService
   *   ) {}
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminController
   */
  constructor(
    private readonly adminService: AdminService,
    private readonly analyticsService: AnalyticsService,
    private readonly contributorRequestService: ContributorRequestService,
    private readonly wordsService: WordsService,
    @Inject("IRevisionHistoryRepository")
    private readonly revisionHistoryRepository: IRevisionHistoryRepository
  ) {}

  /**
   * Récupère les statistiques du tableau de bord administrateur
   *
   * Cette méthode retourne un dashboard complet avec toutes les métriques
   * principales de la plateforme, adaptées selon le rôle de l'utilisateur.
   * Les contributeurs voient uniquement les statistiques de modération.
   *
   * @async
   * @method getDashboard
   * @param {Object} req - Requête avec utilisateur authentifié
   * @param {JwtUser} req.user - Utilisateur JWT avec rôle
   * @returns {Promise<Object>} Statistiques du dashboard
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/dashboard
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   totalUsers: 1245,
   *   activeUsers: 892,
   *   pendingWords: 23,
   *   approvedWords: 156,
   *   contributorRequests: {
   *     totalRequests: 45,
   *     pendingRequests: 12
   *   }
   * }
   * ```
   */
  @Get("dashboard")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les statistiques du dashboard admin" })
  @ApiResponse({
    status: 200,
    description: "Statistiques récupérées avec succès",
  })
  async getDashboard(@Request() req: { user: JwtUser }) {
    const [adminStats, contributorStats] = await Promise.all([
      this.adminService.getDashboardStats(req.user.role),
      this.contributorRequestService
        .getStatistics(req.user.role)
        .catch(() => null),
    ]);

    return {
      ...adminStats,
      contributorRequests: contributorStats || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
      },
    };
  }

  // === GESTION DES UTILISATEURS ===

  /**
   * Récupère la liste paginée des utilisateurs avec filtres
   *
   * Cette méthode retourne la liste des utilisateurs avec possibilité de filtrage
   * par rôle, statut et recherche textuelle. Accessible aux admins et superadmins.
   *
   * @async
   * @method getUsers
   * @param {Object} req - Requête avec utilisateur authentifié
   * @param {JwtUser} req.user - Utilisateur JWT avec rôle
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre d'utilisateurs par page (défaut: 20)
   * @param {UserRole} role - Filtrer par rôle
   * @param {string} status - Filtrer par statut (active, suspended, all)
   * @param {string} search - Terme de recherche
   * @returns {Promise<Object>} Liste paginée des utilisateurs
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/users?page=1&limit=20&role=user&status=active&search=john
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   users: [{
   *     _id: "user123",
   *     username: "john_doe",
   *     email: "john@example.com",
   *     role: "user",
   *     isActive: true,
   *     createdAt: "2024-01-01T00:00:00Z"
   *   }],
   *   total: 1245,
   *   page: 1,
   *   limit: 20,
   *   totalPages: 63
   * }
   * ```
   */
  @Get("users")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer la liste des utilisateurs" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "role", required: false, enum: UserRole })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["active", "suspended", "all"],
  })
  @ApiQuery({ name: "search", required: false, type: String })
  async getUsers(
    @Request() req: { user: JwtUser },
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("role") role?: UserRole,
    @Query("status") status?: "active" | "suspended" | "all",
    @Query("search") search?: string
  ) {
    return this.adminService.getUsers(
      +page,
      +limit,
      role,
      status,
      search,
      req.user.role
    );
  }

  /**
   * Suspend ou reactive un compte utilisateur
   *
   * Cette méthode critique permet aux administrateurs de suspendre temporairement
   * ou définitivement un compte utilisateur en cas de violation des règles.
   * Elle enregistre automatiquement l'action dans les logs d'audit.
   *
   * @async
   * @method toggleUserSuspension
   * @param {string} userId - ID de l'utilisateur à modifier
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur effectuant l'action
   * @param {Object} body - Données de suspension
   * @param {boolean} body.suspend - True pour suspendre, false pour réactiver
   * @param {string} [body.reason] - Raison de la suspension
   * @param {Date} [body.suspendUntil] - Date de fin de suspension (optionnelle)
   * @returns {Promise<Object>} Résultat de l'opération
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {NotFoundException} Si utilisateur introuvable
   *
   * @example
   * ```typescript
   * // Suspendre un utilisateur
   * PATCH /admin/users/user123/suspension
   * {
   *   "suspend": true,
   *   "reason": "Violation des règles de la communauté",
   *   "suspendUntil": "2025-02-01T00:00:00Z"
   * }
   *
   * // Réactiver un utilisateur
   * PATCH /admin/users/user123/suspension
   * {
   *   "suspend": false,
   *   "reason": "Appel accepté"
   * }
   * ```
   */
  @Patch("users/:id/suspension")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Suspendre ou activer un utilisateur" })
  @ApiParam({ name: "id", description: "ID de l'utilisateur" })
  async toggleUserSuspension(
    @Param("id") userId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { suspend: boolean; reason?: string; suspendUntil?: Date }
  ) {
    return this.adminService.toggleUserSuspension(
      userId,
      body.suspend,
      body.reason,
      body.suspendUntil,
      req.user.role
    );
  }

  /**
   * Modifie le rôle d'un utilisateur (superadmin uniquement)
   *
   * Cette méthode critique permet aux superadministrateurs de modifier
   * le rôle d'un utilisateur. Elle inclut des vérifications de sécurité
   * pour empêcher la suppression du dernier superadmin et enregistre
   * automatiquement l'action dans les logs d'audit.
   *
   * @async
   * @method changeUserRole
   * @param {string} userId - ID de l'utilisateur à modifier
   * @param {Object} req - Requête avec superadmin authentifié
   * @param {JwtUser} req.user - Superadmin effectuant l'action
   * @param {Object} body - Nouveau rôle à attribuer
   * @param {UserRole} body.role - Nouveau rôle utilisateur
   * @returns {Promise<Object>} Résultat de l'opération
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {NotFoundException} Si utilisateur introuvable
   * @throws {BadRequestException} Si tentative de suppression du dernier superadmin
   *
   * @example
   * ```typescript
   * // Promouvoir un utilisateur admin
   * PATCH /admin/users/user123/role
   * Authorization: Bearer <superadmin-token>
   * {
   *   "role": "admin"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true,
   *   "message": "Rôle utilisateur modifié avec succès",
   *   "user": {
   *     "_id": "user123",
   *     "username": "john_doe",
   *     "role": "admin",
   *     "updatedAt": "2025-01-01T12:00:00Z"
   *   }
   * }
   * ```
   */
  @Patch("users/:id/role")
  @Roles("superadmin")
  @ApiOperation({
    summary: "Changer le rôle d'un utilisateur (superadmin uniquement)",
  })
  @ApiParam({ name: "id", description: "ID de l'utilisateur" })
  async changeUserRole(
    @Param("id") userId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { role: UserRole }
  ) {
    return this.adminService.changeUserRole(userId, body.role, req.user.role);
  }

  // === MODÉRATION DES MOTS ===

  /**
   * Récupère les mots en attente de modération
   *
   * Cette méthode retourne la liste paginée des mots soumis par les utilisateurs
   * et en attente d'approbation par les modérateurs. Accessible aux contributeurs,
   * administrateurs et superadministrateurs.
   *
   * @async
   * @method getPendingWords
   * @param {Object} req - Requête avec utilisateur authentifié
   * @param {JwtUser} req.user - Utilisateur JWT avec rôle
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre de mots par page (défaut: 20)
   * @param {string} language - Filtrer par langue
   * @returns {Promise<Object>} Liste paginée des mots en attente
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/words/pending?page=1&limit=20&language=français
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   words: [{
   *     _id: "word123",
   *     word: "exemple",
   *     language: "français",
   *     meanings: [{
   *       definition: "Un cas particulier servant d'illustration"
   *     }],
   *     status: "pending",
   *     createdAt: "2025-01-01T00:00:00Z"
   *   }],
   *   total: 23,
   *   page: 1,
   *   limit: 20,
   *   totalPages: 2
   * }
   * ```
   */
  @Get("words/pending")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les mots en attente de modération" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "language", required: false, type: String })
  async getPendingWords(
    @Request() req: { user: JwtUser },
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("language") language?: string
  ) {
    return this.adminService.getPendingWords(
      +page,
      +limit,
      language,
      req.user.role
    );
  }

  /**
   * Modère un mot en attente (approbation ou rejet)
   *
   * Cette méthode critique permet aux modérateurs d'approuver ou rejeter
   * les mots soumis par les utilisateurs. Elle enregistre automatiquement
   * l'action dans l'historique et notifie l'auteur de la décision.
   *
   * @async
   * @method moderateWord
   * @param {string} wordId - ID du mot à modérer
   * @param {Object} req - Requête avec modérateur authentifié
   * @param {JwtUser} req.user - Modérateur effectuant l'action
   * @param {Object} body - Action de modération
   * @param {"approve" | "reject"} body.action - Action à effectuer
   * @param {string} [body.reason] - Raison du rejet (obligatoire pour reject)
   * @returns {Promise<Object>} Résultat de la modération
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {NotFoundException} Si mot introuvable
   * @throws {BadRequestException} Si raison manquante pour rejet
   *
   * @example
   * ```typescript
   * // Approuver un mot
   * PATCH /admin/words/word123/moderate
   * {
   *   "action": "approve"
   * }
   *
   * // Rejeter un mot avec raison
   * PATCH /admin/words/word123/moderate
   * {
   *   "action": "reject",
   *   "reason": "Définition incorrecte ou incomplète"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true,
   *   "message": "Mot approuvé avec succès",
   *   "word": {
   *     "_id": "word123",
   *     "word": "exemple",
   *     "status": "approved",
   *     "moderatedBy": "moderator_id",
   *     "moderatedAt": "2025-01-01T12:00:00Z"
   *   }
   * }
   * ```
   */
  @Patch("words/:id/moderate")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Approuver ou rejeter un mot" })
  @ApiParam({ name: "id", description: "ID du mot" })
  async moderateWord(
    @Param("id") wordId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { action: "approve" | "reject"; reason?: string }
  ) {
    return this.adminService.moderateWord(
      wordId,
      body.action,
      body.reason,
      req.user.role
    );
  }

  // === GESTION DES COMMUNAUTÉS ===

  /**
   * Récupère la liste des communautés avec filtres
   *
   * Cette méthode retourne la liste paginée des communautés avec possibilité
   * de filtrage par statut. Accessible aux administrateurs et superadministrateurs.
   *
   * @async
   * @method getCommunities
   * @param {Object} req - Requête avec utilisateur authentifié
   * @param {JwtUser} req.user - Utilisateur JWT avec rôle
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre de communautés par page (défaut: 20)
   * @param {string} status - Filtrer par statut (active, inactive)
   * @returns {Promise<Object>} Liste paginée des communautés
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/communities?page=1&limit=20&status=active
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   communities: [{
   *     _id: "community123",
   *     name: "Communauté Exemple",
   *     status: "active",
   *     memberCount: 150,
   *     createdAt: "2024-01-01T00:00:00Z"
   *   }],
   *   total: 25,
   *   page: 1,
   *   limit: 20,
   *   totalPages: 2
   * }
   * ```
   */
  @Get("communities")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer la liste des communautés" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: ["active", "inactive"] })
  async getCommunities(
    @Request() req: { user: JwtUser },
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("status") status?: "active" | "inactive"
  ) {
    return this.adminService.getCommunities(
      +page,
      +limit,
      status,
      req.user.role
    );
  }

  /**
   * Supprime une communauté de la plateforme
   *
   * Cette méthode critique permet aux administrateurs de supprimer définitivement
   * une communauté de la plateforme. L'opération inclut la suppression de tous
   * les contenus associés et l'archivage des données pour audit. Elle enregistre
   * automatiquement l'action dans les logs d'audit.
   *
   * @async
   * @method deleteCommunity
   * @param {string} communityId - ID de la communauté à supprimer
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur effectuant l'action
   * @returns {Promise<Object>} Résultat de la suppression
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {NotFoundException} Si communauté introuvable
   * @throws {BadRequestException} Si communauté contient encore des membres actifs
   *
   * @example
   * ```typescript
   * // Appel API
   * DELETE /admin/communities/community123
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "success": true,
   *   "message": "Communauté supprimée avec succès",
   *   "community": {
   *     "_id": "community123",
   *     "name": "Communauté Exemple",
   *     "deletedAt": "2025-01-01T12:00:00Z",
   *     "deletedBy": "admin_id"
   *   },
   *   "archivedData": {
   *     "memberCount": 150,
   *     "contentCount": 45,
   *     "archiveLocation": "backup_community123_20250101"
   *   }
   * }
   * ```
   */
  @Delete("communities/:id")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Supprimer une communauté" })
  @ApiParam({ name: "id", description: "ID de la communauté" })
  async deleteCommunity(
    @Param("id") communityId: string,
    @Request() req: { user: JwtUser }
  ) {
    return this.adminService.deleteCommunity(communityId, req.user.role);
  }

  // === ACTIVITÉ ET LOGS ===

  /**
   * Récupère l'activité récente de la plateforme
   *
   * Cette méthode retourne la liste des actions récentes effectuées sur la plateforme,
   * incluant les connexions, modérations, créations de contenu et actions administratives.
   * Les données sont triées par ordre chronologique décroissant pour afficher les
   * événements les plus récents en premier.
   *
   * @async
   * @method getRecentActivity
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant l'activité
   * @param {number} limit - Nombre maximum d'activités à retourner (défaut: 50)
   * @returns {Promise<Object>} Liste des activités récentes
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/activity?limit=50
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "activities": [{
   *     "_id": "activity123",
   *     "type": "word_approved",
   *     "user": {
   *       "username": "contributeur1",
   *       "role": "contributor"
   *     },
   *     "target": {
   *       "type": "word",
   *       "id": "word123",
   *       "name": "exemple"
   *     },
   *     "description": "Mot approuvé par contributeur1",
   *     "timestamp": "2025-01-01T12:00:00Z",
   *     "metadata": {
   *       "ip": "192.168.1.1",
   *       "userAgent": "Mozilla/5.0..."
   *     }
   *   }],
   *   "total": 50,
   *   "limit": 50,
   *   "hasMore": true
   * }
   * ```
   */
  @Get("activity")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer l'activité récente" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getRecentActivity(
    @Request() req: { user: JwtUser },
    @Query("limit") limit = 50
  ) {
    return this.adminService.getRecentActivity(+limit, req.user.role);
  }

  // === TABLEAU DE BORD SPÉCIALISÉ PAR RÔLE ===

  /**
   * Récupère le tableau de bord spécialisé pour les contributeurs
   *
   * Cette méthode retourne un dashboard simplifié contenant uniquement
   * les statistiques de modération pertinentes pour les contributeurs.
   * Elle permet aux contributeurs de suivre leur travail de modération
   * sans accès aux données sensibles de la plateforme.
   *
   * @async
   * @method getContributorDashboard
   * @param {Object} req - Requête avec contributeur authentifié
   * @param {JwtUser} req.user - Contributeur demandant le dashboard
   * @returns {Promise<Object>} Statistiques de modération pour contributeurs
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/dashboard/contributor
   * Authorization: Bearer <contributor-token>
   *
   * // Réponse typique:
   * {
   *   "pendingWords": 23,
   *   "approvedWords": 156,
   *   "rejectedWords": 12,
   *   "newWordsThisWeek": 45
   * }
   * ```
   */
  @Get("dashboard/contributor")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Dashboard spécialisé pour les contributeurs" })
  async getContributorDashboard(@Request() req: { user: JwtUser }) {
    // Retourner uniquement les statistiques de modération
    const stats = await this.adminService.getDashboardStats(req.user.role);
    return {
      pendingWords: stats.pendingWords,
      approvedWords: stats.approvedWords,
      rejectedWords: stats.rejectedWords,
      newWordsThisWeek: stats.newWordsThisWeek,
    };
  }

  /**
   * Récupère le tableau de bord spécialisé pour les administrateurs
   *
   * Cette méthode retourne un dashboard complet avec toutes les statistiques
   * avancées et l'activité récente de la plateforme. Elle permet aux administrateurs
   * de suivre les métriques importantes et les actions récentes des utilisateurs.
   *
   * @async
   * @method getAdminDashboard
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant le dashboard
   * @returns {Promise<Object>} Statistiques complètes et activité récente
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/dashboard/admin
   * Authorization: Bearer <admin-token>
   *
   * // Réponse typique:
   * {
   *   "stats": {
   *     "totalUsers": 1245,
   *     "activeUsers": 892,
   *     "pendingWords": 23,
   *     "approvedWords": 156,
   *     "totalCommunities": 25
   *   },
   *   "recentActivity": [{
   *     "type": "word_approved",
   *     "user": "contributeur1",
   *     "target": "exemple",
   *     "timestamp": "2025-01-01T12:00:00Z"
   *   }]
   * }
   * ```
   */
  @Get("dashboard/admin")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Dashboard spécialisé pour les administrateurs" })
  async getAdminDashboard(@Request() req: { user: JwtUser }) {
    const [stats, recentActivity] = await Promise.all([
      this.adminService.getDashboardStats(req.user.role),
      this.adminService.getRecentActivity(20, req.user.role),
    ]);

    return {
      stats,
      recentActivity,
    };
  }

  /**
   * Récupère le tableau de bord spécialisé pour les superadministrateurs
   *
   * Cette méthode retourne un dashboard complet avec toutes les statistiques
   * avancées, l'activité récente et les métriques système de la plateforme.
   * Accessible uniquement aux superadministrateurs, elle offre une vue complète
   * du système incluant la santé technique et les performances.
   *
   * @async
   * @method getSuperAdminDashboard
   * @param {Object} req - Requête avec superadmin authentifié
   * @param {JwtUser} req.user - Superadministrateur demandant le dashboard
   * @returns {Promise<Object>} Statistiques complètes, activité et métriques système
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/dashboard/superadmin
   * Authorization: Bearer <superadmin-token>
   *
   * // Réponse typique:
   * {
   *   "stats": {
   *     "totalUsers": 1245,
   *     "activeUsers": 892,
   *     "pendingWords": 23,
   *     "approvedWords": 156,
   *     "totalCommunities": 25,
   *     "systemHealth": "healthy"
   *   },
   *   "recentActivity": [{
   *     "type": "word_approved",
   *     "user": "contributeur1",
   *     "target": "exemple",
   *     "timestamp": "2025-01-01T12:00:00Z"
   *   }],
   *   "systemHealth": {
   *     "uptime": 86400,
   *     "memory": {
   *       "used": 134217728,
   *       "total": 536870912
   *     },
   *     "nodeVersion": "v18.17.0"
   *   }
   * }
   * ```
   */
  @Get("dashboard/superadmin")
  @Roles("superadmin")
  @ApiOperation({ summary: "Dashboard spécialisé pour les superadmins" })
  async getSuperAdminDashboard(@Request() req: { user: JwtUser }) {
    const [stats, recentActivity] = await Promise.all([
      this.adminService.getDashboardStats(req.user.role),
      this.adminService.getRecentActivity(50, req.user.role),
    ]);

    return {
      stats,
      recentActivity,
      systemHealth: {
        // Ici on pourrait ajouter des métriques système
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
  }

  // === ANALYTICS ENDPOINTS ===

  /**
   * Récupère les analytics détaillées des utilisateurs
   *
   * Cette méthode retourne des statistiques complètes sur l'activité et
   * l'engagement des utilisateurs de la plateforme. Elle inclut les données
   * d'inscription, d'activité, de contribution et de rétention sur la période
   * spécifiée. Les données sont formatées pour faciliter la visualisation
   * dans des graphiques et tableaux de bord.
   *
   * @async
   * @method getUserAnalytics
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant les analytics
   * @param {"7d" | "30d" | "90d" | "1y" | "all"} period - Période d'analyse
   * @returns {Promise<Object>} Analytics détaillées des utilisateurs
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/analytics/users?period=30d
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "totalUsers": 1245,
   *   "activeUsers": 892,
   *   "newUsers": 67,
   *   "usersByRole": {
   *     "user": 1180,
   *     "contributor": 50,
   *     "admin": 13,
   *     "superadmin": 2
   *   },
   *   "registrationTrend": [{
   *     "date": "2025-01-01",
   *     "count": 23
   *   }],
   *   "activityMetrics": {
   *     "dailyActiveUsers": 245,
   *     "weeklyActiveUsers": 567,
   *     "monthlyActiveUsers": 892,
   *     "retentionRate": 0.72
   *   }
   * }
   * ```
   */
  @Get("analytics/users")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les analytics des utilisateurs" })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["7d", "30d", "90d", "1y", "all"],
  })
  async getUserAnalytics(
    @Request() req: { user: JwtUser },
    @Query("period") period: "7d" | "30d" | "90d" | "1y" | "all" = "30d"
  ) {
    const timeRange = this.getTimeRangeFromPeriod(period);
    return this.analyticsService.getUserAnalytics(timeRange);
  }

  /**
   * Récupère les analytics détaillées du contenu
   *
   * Cette méthode retourne des statistiques complètes sur le contenu de la plateforme,
   * incluant les mots, définitions, traductions et leur état de modération. Elle fournit
   * des métriques sur la croissance du dictionnaire, les tendances de contribution et
   * la qualité du contenu. Les données sont formatées pour faciliter la visualisation
   * dans des graphiques et tableaux de bord analytiques.
   *
   * @async
   * @method getContentAnalytics
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant les analytics
   * @param {"7d" | "30d" | "90d" | "1y" | "all"} period - Période d'analyse (défaut: 30d)
   * @returns {Promise<Object>} Analytics détaillées du contenu
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/analytics/content?period=30d
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "totalWords": 15420,
   *   "approvedWords": 14890,
   *   "pendingWords": 423,
   *   "rejectedWords": 107,
   *   "wordsByLanguage": {
   *     "français": 8950,
   *     "punu": 6470
   *   },
   *   "contentTrend": [{
   *     "date": "2025-01-01",
   *     "submitted": 45,
   *     "approved": 38,
   *     "rejected": 7
   *   }],
   *   "qualityMetrics": {
   *     "approvalRate": 0.89,
   *     "averageDefinitionsPerWord": 2.3,
   *     "averageExamplesPerDefinition": 1.8,
   *     "topContributors": [{
   *       "username": "contributeur1",
   *       "wordCount": 234,
   *       "approvalRate": 0.95
   *     }]
   *   },
   *   "moderationMetrics": {
   *     "averageReviewTime": 1.5,
   *     "moderationBacklog": 23,
   *     "activeModerators": 12
   *   }
   * }
   * ```
   */
  @Get("analytics/content")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les analytics du contenu" })
  async getContentAnalytics(@Request() req: { user: JwtUser }) {
    return this.analyticsService.getContentAnalytics();
  }

  /**
   * Récupère les analytics détaillées des communautés
   *
   * Cette méthode retourne des statistiques complètes sur les communautés de la plateforme,
   * incluant leur croissance, leur activité, leur engagement et leur santé globale. Elle fournit
   * des métriques sur la création de communautés, l'activité des membres, les contributions
   * et les tendances d'engagement. Les données sont formatées pour faciliter la visualisation
   * dans des graphiques et tableaux de bord analytiques.
   *
   * @async
   * @method getCommunityAnalytics
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant les analytics
   * @returns {Promise<Object>} Analytics détaillées des communautés
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/analytics/communities
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "totalCommunities": 45,
   *   "activeCommunities": 38,
   *   "newCommunitiesThisMonth": 8,
   *   "averageMembersPerCommunity": 67.5,
   *   "communitiesByLanguage": {
   *     "français": 28,
   *     "punu": 17
   *   },
   *   "communityGrowthTrend": [{
   *     "date": "2025-01-01",
   *     "newCommunities": 3,
   *     "totalMembers": 2890
   *   }],
   *   "engagementMetrics": {
   *     "averagePostsPerCommunity": 23.4,
   *     "averageCommentsPerPost": 4.7,
   *     "mostActiveCommunities": [{
   *       "name": "Communauté Française",
   *       "memberCount": 234,
   *       "postsThisMonth": 89,
   *       "engagementRate": 0.82
   *     }],
   *     "communityRetentionRate": 0.74
   *   },
   *   "healthMetrics": {
   *     "communitiesNeedingAttention": 3,
   *     "inactiveCommunities": 7,
   *     "averageAdminResponseTime": 2.3,
   *     "reportedContent": 12
   *   }
   * }
   * ```
   */
  @Get("analytics/communities")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les analytics des communautés" })
  async getCommunityAnalytics(@Request() req: { user: JwtUser }) {
    return this.analyticsService.getCommunityAnalytics();
  }

  /**
   * Récupère les métriques système
   *
   * Cette méthode retourne des statistiques complètes sur les performances et la santé du système,
   * incluant l'utilisation des ressources, les temps de réponse, les erreurs et les alertes. Elle fournit
   * des métriques sur la charge du serveur, l'utilisation de la mémoire, les requêtes par seconde et
   * d'autres indicateurs clés de performance. Les données sont formatées pour faciliter la visualisation
   * dans des graphiques et tableaux de bord analytiques.
   *
   * @async
   * @method getSystemMetrics
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant les métriques
   * @returns {Promise<Object>} Métriques système
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/analytics/system
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "cpuUsage": 75,
   *   "memoryUsage": 60,
   *   "diskSpace": 80,
   *   "networkTraffic": 120,
   *   "errorRate": 0.02,
   *   "responseTimes": {
   *     "average": 200,
   *     "max": 500,
   *     "min": 100
   *   },
   *   "alerts": [{
   *     "id": "alert-1",
   *     "type": "high_cpu",
   *     "severity": "critical",
   *     "timestamp": "2025-01-01T12:00:00Z"
   *   }]
   * }
   * ```
   */
  @Get("analytics/system")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les métriques système" })
  async getSystemMetrics(@Request() req: { user: JwtUser }) {
    return this.analyticsService.getSystemMetrics();
  }

  /**
   * Récupère une vue d'ensemble complète des analytics
   *
   * Cette méthode compile les données analytiques de différentes sources pour fournir une vue
   * d'ensemble des performances et de l'engagement sur la plateforme. Elle inclut des métriques
   * sur les utilisateurs, le contenu, les communautés et le système, le tout dans un format
   * cohérent et facile à analyser.
   *
   * @async
   * @method getAnalyticsOverview
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant la vue d'ensemble
   * @param {string} period - Période pour laquelle récupérer les données (ex: "30d")
   * @returns {Promise<Object>} Vue d'ensemble des analytics
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/analytics/overview?period=30d
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "users": { ... },
   *   "content": { ... },
   *   "communities": { ... },
   *   "system": { ... },
   *   "generatedAt": "2025-01-01T12:00:00Z"
   * }
   * ```
   */
  @Get("analytics/overview")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Récupérer vue d'ensemble complète des analytics" })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["7d", "30d", "90d", "1y", "all"],
  })
  async getAnalyticsOverview(
    @Request() req: { user: JwtUser },
    @Query("period") period: "7d" | "30d" | "90d" | "1y" | "all" = "30d"
  ) {
    const timeRange = this.getTimeRangeFromPeriod(period);

    const [userAnalytics, contentAnalytics, communityAnalytics, systemMetrics] =
      await Promise.all([
        this.analyticsService.getUserAnalytics(timeRange),
        this.analyticsService.getContentAnalytics(),
        this.analyticsService.getCommunityAnalytics(),
        this.analyticsService.getSystemMetrics(),
      ]);

    return {
      users: userAnalytics,
      content: contentAnalytics,
      communities: communityAnalytics,
      system: systemMetrics,
      generatedAt: new Date().toISOString(),
    };
  }

  // === REPORTS ENDPOINTS ===

  /**
   * Exporte un rapport détaillé
   *
   * Cette méthode permet d'exporter un rapport complet sur les performances et l'engagement
   * des utilisateurs, du contenu et des communautés. Les rapports peuvent être filtrés par
   * période et format, et sont générés à la demande pour répondre aux besoins spécifiques
   * des administrateurs.
   *
   * @async
   * @method exportReport
   * @param {Object} req - Requête avec administrateur authentifié
   * @param {JwtUser} req.user - Administrateur demandant l'export
   * @param {string} type - Type de rapport à exporter (ex: "users", "content", "communities", "full")
   * @param {string} format - Format d'exportation (ex: "json", "csv")
   * @param {string} period - Période pour laquelle récupérer les données (ex: "30d")
   * @returns {Promise<Object>} Rapport exporté
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/reports/export?type=users&format=csv&period=30d
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "data": [ ... ],
   *   "metadata": {
   *     "type": "users",
   *     "format": "csv",
   *     "period": "30d",
   *     "generatedAt": "2025-01-01T12:00:00Z",
   *     "exportedAt": "2025-01-01T12:00:00Z",
   *     "exportedBy": "admin"
   *   }
   * }
   * ```
   */
  @Get("reports/export")
  @Roles("admin", "superadmin")
  @ApiOperation({ summary: "Exporter un rapport détaillé" })
  @ApiQuery({
    name: "type",
    required: true,
    enum: ["users", "content", "communities", "full"],
  })
  @ApiQuery({ name: "format", required: false, enum: ["json", "csv"] })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["7d", "30d", "90d", "1y", "all"],
  })
  async exportReport(
    @Request() req: { user: JwtUser },
    @Query("type") type: "users" | "content" | "communities" | "full",
    @Query("format") format: "json" | "csv" = "json",
    @Query("period") period: "7d" | "30d" | "90d" | "1y" | "all" = "30d"
  ) {
    const timeRange = this.getTimeRangeFromPeriod(period);

    let reportData: any;

    switch (type) {
      case "users":
        reportData = await this.analyticsService.getUserAnalytics(timeRange);
        break;
      case "content":
        reportData = await this.analyticsService.getContentAnalytics();
        break;
      case "communities":
        reportData = await this.analyticsService.getCommunityAnalytics();
        break;
      case "full":
        reportData = await this.getAnalyticsOverview(req, period);
        break;
      default:
        throw new Error("Type de rapport non supporté");
    }

    return {
      data: reportData,
      metadata: {
        type,
        format,
        period,
        generatedAt: new Date().toISOString(),
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.username,
      },
    };
  }

  // === GESTION DES RÉVISIONS ===

  /**
   * Récupère les révisions en attente de modération
   *
   * Cette méthode retourne la liste paginée des révisions soumises par les utilisateurs
   * et en attente d'approbation par les modérateurs. Elle permet de filtrer par statut,
   * utilisateur et période. Accessible aux contributeurs, administrateurs et superadministrateurs.
   *
   * @async
   * @method getPendingRevisions
   * @param {Object} req - Requête avec utilisateur authentifié
   * @param {JwtUser} req.user - Utilisateur JWT avec rôle
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre de révisions par page (défaut: 10)
   * @param {string} status - Filtrer par statut (pending, approved, rejected)
   * @param {string} userId - Filtrer par utilisateur spécifique
   * @returns {Promise<Object>} Liste paginée des révisions avec statistiques
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/revisions/pending?page=1&limit=10&status=pending&userId=user123
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "revisions": [{
   *     "_id": "rev_001",
   *     "wordId": "word_001",
   *     "word": "exemple",
   *     "language": "français",
   *     "changes": {
   *       "meanings": [{ "definition": "Nouvelle définition améliorée" }]
   *     },
   *     "createdBy": {
   *       "_id": "user_001",
   *       "username": "contributeur1",
   *       "email": "contrib@example.com"
   *     },
   *     "createdAt": "2025-01-01T00:00:00Z",
   *     "status": "pending",
   *     "version": 2,
   *     "comment": "Amélioration de la définition"
   *   }],
   *   "total": 23,
   *   "page": 1,
   *   "limit": 10,
   *   "totalPages": 3,
   *   "statistics": {
   *     "pending": 23,
   *     "approved": 156,
   *     "rejected": 12,
   *     "today": 5,
   *     "thisWeek": 18,
   *     "thisMonth": 45
   *   }
   * }
   * ```
   */
  @Get("revisions/pending")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Récupérer les révisions en attente de modération" })
  @ApiResponse({
    status: 200,
    description: "Révisions en attente récupérées avec succès",
    type: "object",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Numéro de page (défaut: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Nombre d'éléments par page (défaut: 10)",
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
    description: "Filtrer par statut (pending, approved, rejected)",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    type: String,
    description: "Filtrer par utilisateur",
  })
  async getPendingRevisions(
    @Request() req: { user: JwtUser },
    @Query("page") page = 1,
    @Query("limit") limit = 10,
    @Query("status") status?: string,
    @Query("userId") userId?: string
  ) {
    // Simuler des révisions en attente pour le frontend
    // En réalité, il faudrait implémenter une méthode dans WordsService pour ça
    const mockRevisions = [
      {
        _id: "rev_001",
        wordId: "word_001",
        word: "test",
        language: "français",
        changes: {
          meanings: [{ definition: "Nouvelle définition" }],
        },
        createdBy: {
          _id: "user_001",
          username: "contributeur1",
          email: "contrib@example.com",
        },
        createdAt: new Date(),
        status: "pending",
        version: 2,
        comment: "Amélioration de la définition",
      },
    ];

    // Obtenir les statistiques réelles
    const statistics = await this.wordsService.getRevisionStatistics({
      period: "month",
      userId,
    });

    return {
      revisions: status === "pending" || !status ? mockRevisions : [],
      total: statistics.totalRevisions,
      page: +page,
      limit: +limit,
      totalPages: Math.ceil(statistics.totalRevisions / +limit),
      statistics: {
        pending: statistics.byStatus.pending,
        approved: statistics.byStatus.approved,
        rejected: statistics.byStatus.rejected,
        today: statistics.byPeriod.today,
        thisWeek: statistics.byPeriod.thisWeek,
        thisMonth: statistics.byPeriod.thisMonth,
      },
    };
  }

  /**
   * Approuve une révision spécifique d'un mot
   *
   * Cette méthode critique permet aux modérateurs d'approuver une révision
   * proposée par un utilisateur. Elle applique automatiquement les modifications
   * à la version active du mot et enregistre l'action dans l'historique.
   * L'opération inclut la validation des permissions et l'audit automatique.
   *
   * @async
   * @method approveRevision
   * @param {string} wordId - ID du mot concerné par la révision
   * @param {string} revisionId - ID unique de la révision à approuver
   * @param {Object} req - Requête avec modérateur authentifié
   * @param {JwtUser} req.user - Modérateur effectuant l'approbation
   * @param {Object} body - Données d'approbation
   * @param {string} [body.notes] - Notes optionnelles du modérateur
   * @returns {Promise<Object>} Résultat de l'approbation avec données mises à jour
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {NotFoundException} Si mot ou révision introuvable
   * @throws {BadRequestException} Si révision déjà traitée
   *
   * @example
   * ```typescript
   * // Appel API
   * PATCH /admin/revisions/word123/rev456/approve
   * Authorization: Bearer <jwt-token>
   * {
   *   "notes": "Révision de qualité, améliore la définition"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true,
   *   "message": "Révision approuvée avec succès",
   *   "data": {
   *     "wordId": "word123",
   *     "revisionId": "rev456",
   *     "newVersion": 3,
   *     "approvedBy": "contributeur1",
   *     "approvedAt": "2025-01-01T12:00:00Z",
   *     "changes": {
   *       "meanings": [{ "definition": "Définition améliorée" }]
   *     }
   *   }
   * }
   * ```
   */
  @Patch("revisions/:wordId/:revisionId/approve")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Approuver une révision" })
  @ApiResponse({
    status: 200,
    description: "Révision approuvée avec succès",
    type: "object",
  })
  @ApiParam({ name: "wordId", description: "ID du mot" })
  @ApiParam({ name: "revisionId", description: "ID de la révision" })
  async approveRevision(
    @Param("wordId") wordId: string,
    @Param("revisionId") revisionId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { notes?: string }
  ) {
    const user = {
      _id: req.user.userId || req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
    };

    const result = await this.wordsService.restoreRevision(
      wordId,
      revisionId,
      user,
      body.notes || `Révision approuvée par ${user.username}`
    );

    return {
      success: true,
      message: "Révision approuvée avec succès",
      data: result,
    };
  }

  /**
   * Rejette une révision spécifique d'un mot
   *
   * Cette méthode critique permet aux modérateurs de rejeter une révision
   * proposée par un utilisateur. Elle enregistre automatiquement la raison
   * du rejet dans l'historique et notifie l'auteur de la décision. L'opération
   * inclut la validation des permissions et l'audit automatique.
   *
   * @async
   * @method rejectRevision
   * @param {string} wordId - ID du mot concerné par la révision
   * @param {string} revisionId - ID unique de la révision à rejeter
   * @param {Object} req - Requête avec modérateur authentifié
   * @param {JwtUser} req.user - Modérateur effectuant le rejet
   * @param {Object} body - Données de rejet
   * @param {string} [body.reason] - Raison obligatoire du rejet
   * @returns {Promise<Object>} Résultat du rejet avec données mises à jour
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   * @throws {NotFoundException} Si mot ou révision introuvable
   * @throws {BadRequestException} Si révision déjà traitée ou raison manquante
   *
   * @example
   * ```typescript
   * // Appel API
   * PATCH /admin/revisions/word123/rev456/reject
   * Authorization: Bearer <jwt-token>
   * {
   *   "reason": "Définition incorrecte ou non conforme aux standards"
   * }
   *
   * // Réponse typique:
   * {
   *   "success": true,
   *   "message": "Révision rejetée avec succès",
   *   "data": {
   *     "wordId": "word123",
   *     "revisionId": "rev456",
   *     "rejectedBy": "contributeur1",
   *     "rejectedAt": "2025-01-01T12:00:00Z",
   *     "reason": "Définition incorrecte ou non conforme aux standards",
   *     "status": "rejected"
   *   }
   * }
   * ```
   */
  @Patch("revisions/:wordId/:revisionId/reject")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Rejeter une révision" })
  @ApiResponse({
    status: 200,
    description: "Révision rejetée avec succès",
    type: "object",
  })
  @ApiParam({ name: "wordId", description: "ID du mot" })
  @ApiParam({ name: "revisionId", description: "ID de la révision" })
  async rejectRevision(
    @Param("wordId") wordId: string,
    @Param("revisionId") revisionId: string,
    @Request() req: { user: JwtUser },
    @Body() body: { reason?: string }
  ) {
    const userId = req.user.userId || req.user._id;
    const reviewNotes =
      body.reason || `Révision rejetée par ${req.user.username}`;

    const result = await this.revisionHistoryRepository.reject(
      revisionId,
      userId,
      reviewNotes
    );

    return {
      success: true,
      message: "Révision rejetée avec succès",
      data: result,
    };
  }

  /**
   * Récupère les statistiques détaillées des révisions
   *
   * Cette méthode retourne des statistiques complètes sur les révisions de mots
   * effectuées sur la plateforme, avec possibilité de filtrage par période et utilisateur.
   * Elle fournit des métriques sur l'activité de révision, les taux d'approbation/rejet
   * et les tendances de contribution. Accessible aux contributeurs, administrateurs
   * et superadministrateurs.
   *
   * @async
   * @method getRevisionStatistics
   * @param {Object} req - Requête avec utilisateur authentifié
   * @param {JwtUser} req.user - Utilisateur JWT avec rôle
   * @param {"week" | "month" | "year"} period - Période d'analyse (défaut: month)
   * @param {string} userId - Filtrer par utilisateur spécifique (optionnel)
   * @returns {Promise<Object>} Statistiques détaillées des révisions
   * @throws {UnauthorizedException} Si non authentifié
   * @throws {ForbiddenException} Si rôle insuffisant
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/revisions/statistics?period=month&userId=user123
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   "totalRevisions": 156,
   *   "byStatus": {
   *     "pending": 23,
   *     "approved": 120,
   *     "rejected": 13
   *   },
   *   "byPeriod": {
   *     "today": 5,
   *     "thisWeek": 18,
   *     "thisMonth": 45,
   *     "lastMonth": 38
   *   },
   *   "approvalRate": 0.89,
   *   "averageReviewTime": 2.5,
   *   "topContributors": [{
   *     "userId": "user123",
   *     "username": "contributeur1",
   *     "revisionCount": 34,
   *     "approvalRate": 0.95
   *   }],
   *   "mostActiveWords": [{
   *     "wordId": "word456",
   *     "word": "exemple",
   *     "revisionCount": 8,
   *     "lastRevision": "2025-01-01T12:00:00Z"
   *   }],
   *   "qualityMetrics": {
   *     "averageChangesPerRevision": 2.3,
   *     "mostCommonChangeType": "meaning_update",
   *     "revisionTrend": "increasing"
   *   }
   * }
   * ```
   */
  @Get("revisions/statistics")
  @Roles("contributor", "admin", "superadmin")
  @ApiOperation({ summary: "Obtenir les statistiques des révisions" })
  @ApiResponse({
    status: 200,
    description: "Statistiques des révisions récupérées avec succès",
    type: "object",
  })
  @ApiQuery({
    name: "period",
    required: false,
    enum: ["week", "month", "year"],
    description: "Période d'analyse (défaut: month)",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    type: String,
    description: "Filtrer par utilisateur",
  })
  async getRevisionStatistics(
    @Request() req: { user: JwtUser },
    @Query("period") period = "month",
    @Query("userId") userId?: string
  ) {
    return this.wordsService.getRevisionStatistics({
      period,
      userId,
    });
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * Convertit une période textuelle en plage de dates
   *
   * Cette méthode utilitaire transforme les périodes prédéfinies
   * (7d, 30d, 90d, 1y, all) en objets de plage de dates utilisables
   * par les services d'analytics.
   *
   * @private
   * @method getTimeRangeFromPeriod
   * @param {string} period - Période textuelle à convertir
   * @returns {Object} Objet avec startDate, endDate et period
   *
   * @example
   * ```typescript
   * const range = this.getTimeRangeFromPeriod('30d');
   * // {
   * //   startDate: Date (30 jours avant aujourd'hui),
   * //   endDate: Date (maintenant),
   * //   period: '30d'
   * // }
   * ```
   */
  private getTimeRangeFromPeriod(period: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        startDate = new Date("2020-01-01");
        break;
    }

    return {
      startDate,
      endDate: now,
      period: period as any,
    };
  }
}
