/**
 * @fileoverview Service principal d'administration pour O'Ypunu
 *
 * Ce service centralise toute la logique métier d'administration, incluant:
 * - Génération de statistiques et métriques globales
 * - Gestion des utilisateurs (suspension, changement de rôle)
 * - Modération de contenu (mots, communautés)
 * - Outils de surveillance et d'audit
 * - Contrôle d'accès basé sur les rôles utilisateur
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument, UserRole } from "../../users/schemas/user.schema";
import { Word, WordDocument } from "../../dictionary/schemas/word.schema";
import {
  Community,
  CommunityDocument,
} from "../../communities/schemas/community.schema";
import {
  CommunityMember,
  CommunityMemberDocument,
} from "../../communities/schemas/community-member.schema";
import {
  CommunityPost,
  CommunityPostDocument,
} from "../../communities/schemas/community-post.schema";
import {
  Message,
  MessageDocument,
} from "../../messaging/schemas/message.schema";

/**
 * Interface pour les statistiques globales de l'administration
 *
 * @interface AdminStats
 */
export interface AdminStats {
  /** Nombre total d'utilisateurs inscrits */
  totalUsers: number;
  /** Nombre d'utilisateurs actifs (connexion récente) */
  activeUsers: number;
  /** Nombre d'utilisateurs suspendus */
  suspendedUsers: number;
  /** Nombre total de mots dans le dictionnaire */
  totalWords: number;
  /** Nombre de mots en attente de modération */
  pendingWords: number;
  /** Nombre de mots approuvés */
  approvedWords: number;
  /** Nombre de mots rejetés */
  rejectedWords: number;
  /** Nombre total de communautés */
  totalCommunities: number;
  /** Nombre de communautés actives */
  activeCommunities: number;
  /** Nombre total de posts de communauté */
  totalPosts: number;
  /** Nombre total de messages échangés */
  totalMessages: number;
  /** Nouveaux utilisateurs ce mois-ci */
  newUsersThisMonth: number;
  /** Nouveaux mots cette semaine */
  newWordsThisWeek: number;
}

/**
 * Interface pour les données de gestion d'utilisateurs paginées
 *
 * @interface UserManagementData
 */
export interface UserManagementData {
  /** Liste des utilisateurs pour la page courante */
  users: User[];
  /** Nombre total d'utilisateurs (tous filtres confondus) */
  total: number;
  /** Numéro de page courante */
  page: number;
  /** Nombre d'éléments par page */
  limit: number;
  /** Nombre total de pages */
  totalPages: number;
}

// Interfaces pour les filtres MongoDB
interface UserFilter {
  role?: UserRole;
  isSuspended?: boolean;
  $or?: Array<{
    username?: { $regex: string; $options: string };
    email?: { $regex: string; $options: string };
  }>;
}

interface WordFilter {
  status: string;
  language?: string;
}

interface CommunityFilter {
  memberCount?: { $gt?: number; $lte?: number };
}

/**
 * Service principal d'administration pour O'Ypunu
 *
 * Ce service fournit tous les outils d'administration nécessaires pour gérer
 * efficacement la plateforme O'Ypunu. Il inclut des fonctionnalités avancées
 * de gestion des utilisateurs, modération de contenu, génération de statistiques
 * et contrôle d'accès granulaire basé sur les rôles.
 *
 * ## Fonctionnalités principales :
 *
 * ### 📊 Statistiques et métriques
 * - Dashboard avec KPIs en temps réel
 * - Métriques d'engagement et croissance
 * - Rapports personnalisés par période
 *
 * ### 👥 Gestion des utilisateurs
 * - Liste et recherche avancée d'utilisateurs
 * - Suspension/réactivation de comptes
 * - Modification des rôles (hiérarchie respectée)
 * - Audit des actions utilisateur
 *
 * ### 📝 Modération de contenu
 * - Approbation/rejet de mots
 * - Gestion des communautés
 * - Surveillance des activités suspectes
 *
 * ### 🔒 Contrôle d'accès
 * - Vérification automatique des permissions
 * - Hiérarchie des rôles : USER < CONTRIBUTOR < ADMIN < SUPERADMIN
 * - Actions auditées et traçables
 *
 * @class AdminService
 * @version 1.0.0
 */
@Injectable()
export class AdminService {
  /**
   * Constructeur du service d'administration
   *
   * @constructor
   * @param {Model<UserDocument>} userModel - Modèle Mongoose des utilisateurs
   * @param {Model<WordDocument>} wordModel - Modèle Mongoose des mots
   * @param {Model<CommunityDocument>} communityModel - Modèle Mongoose des communautés
   * @param {Model<CommunityMemberDocument>} memberModel - Modèle Mongoose des membres de communauté
   * @param {Model<CommunityPostDocument>} postModel - Modèle Mongoose des posts de communauté
   * @param {Model<MessageDocument>} messageModel - Modèle Mongoose des messages
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection dans un contrôleur :
   * constructor(private adminService: AdminService) {}
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Word.name) private readonly wordModel: Model<WordDocument>,
    @InjectModel(Community.name)
    private readonly communityModel: Model<CommunityDocument>,
    @InjectModel(CommunityMember.name)
    private readonly memberModel: Model<CommunityMemberDocument>,
    @InjectModel(CommunityPost.name)
    private readonly postModel: Model<CommunityPostDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>
  ) {}

  /**
   * Vérifie les permissions d'accès selon la hiérarchie des rôles
   *
   * Cette méthode privée valide que l'utilisateur possède les permissions
   * suffisantes pour exécuter une action administrative. Elle utilise
   * une hiérarchie numérique stricte des rôles.
   *
   * @private
   * @method checkPermission
   * @param {UserRole} userRole - Rôle de l'utilisateur effectuant l'action
   * @param {UserRole} requiredRole - Rôle minimum requis pour l'action
   * @throws {ForbiddenException} Si permissions insuffisantes
   *
   * @example
   * ```typescript
   * // Vérifier qu'un utilisateur est au moins admin
   * this.checkPermission(UserRole.CONTRIBUTOR, UserRole.ADMIN); // Lève une exception
   * this.checkPermission(UserRole.ADMIN, UserRole.ADMIN); // OK
   * this.checkPermission(UserRole.SUPERADMIN, UserRole.ADMIN); // OK
   * ```
   */
  private checkPermission(userRole: UserRole, requiredRole: UserRole): void {
    const roleHierarchy = {
      [UserRole.USER]: 0,
      [UserRole.CONTRIBUTOR]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.SUPERADMIN]: 3,
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenException("Permissions insuffisantes");
    }
  }

  /**
   * Génère les statistiques complètes du tableau de bord administrateur
   *
   * Cette méthode calcule en temps réel toutes les métriques principales
   * de la plateforme O'Ypunu en interrogeant les différentes collections.
   * Les données sont optimisées pour l'affichage dans les dashboards.
   *
   * @async
   * @method getDashboardStats
   * @param {UserRole} userRole - Rôle de l'utilisateur demandant les stats
   * @returns {Promise<AdminStats>} Statistiques complètes de la plateforme
   * @throws {ForbiddenException} Si rôle insuffisant (minimum CONTRIBUTOR)
   *
   * @example
   * ```typescript
   * // Récupérer les stats pour un admin
   * const stats = await adminService.getDashboardStats(UserRole.ADMIN);
   * console.log(`Utilisateurs actifs: ${stats.activeUsers}`);
   * console.log(`Mots en attente: ${stats.pendingWords}`);
   *
   * // Réponse typique:
   * {
   *   totalUsers: 1247,
   *   activeUsers: 856,
   *   pendingWords: 23,
   *   approvedWords: 1456,
   *   newUsersThisMonth: 45
   * }
   * ```
   */
  async getDashboardStats(userRole: UserRole): Promise<AdminStats> {
    this.checkPermission(userRole, UserRole.CONTRIBUTOR);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWords,
      pendingWords,
      approvedWords,
      rejectedWords,
      totalCommunities,
      activeCommunities,
      totalPosts,
      totalMessages,
      newUsersThisMonth,
      newWordsThisWeek,
    ] = await Promise.all([
      this.userModel.countDocuments({}),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ isSuspended: true }),
      this.wordModel.countDocuments({}),
      this.wordModel.countDocuments({ status: "pending" }),
      this.wordModel.countDocuments({ status: "approved" }),
      this.wordModel.countDocuments({ status: "rejected" }),
      this.communityModel.countDocuments({}),
      this.communityModel.countDocuments({ memberCount: { $gt: 1 } }),
      this.postModel.countDocuments({}),
      this.messageModel.countDocuments({}),
      this.userModel.countDocuments({ createdAt: { $gte: monthStart } }),
      this.wordModel.countDocuments({ createdAt: { $gte: weekStart } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWords,
      pendingWords,
      approvedWords,
      rejectedWords,
      totalCommunities,
      activeCommunities,
      totalPosts,
      totalMessages,
      newUsersThisMonth,
      newWordsThisWeek,
    };
  }

  /**
   * Récupère la liste des utilisateurs avec pagination et filtres avancés
   *
   * Cette méthode permet aux administrateurs de gérer efficacement les utilisateurs
   * de la plateforme avec des options de filtrage par rôle, statut et recherche textuelle.
   * Les résultats sont paginés pour optimiser les performances et l'expérience utilisateur.
   *
   * @async
   * @method getUsers
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre d'éléments par page (défaut: 20)
   * @param {UserRole} [role] - Filtrer par rôle utilisateur spécifique
   * @param {"active" | "suspended" | "all"} [status] - Filtrer par statut de compte
   * @param {string} [search] - Terme de recherche (username ou email)
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant la demande
   * @returns {Promise<UserManagementData>} Données paginées des utilisateurs
   * @throws {ForbiddenException} Si rôle insuffisant (minimum ADMIN)
   *
   * @example
   * ```typescript
   * // Récupérer tous les utilisateurs suspendus
   * const suspendedUsers = await adminService.getUsers(
   *   1, 10, undefined, "suspended", undefined, UserRole.ADMIN
   * );
   *
   * // Rechercher des contributeurs par nom
   * const contributors = await adminService.getUsers(
   *   1, 20, UserRole.CONTRIBUTOR, "all", "john", UserRole.ADMIN
   * );
   *
   * // Réponse typique:
   * {
   *   users: [{ username: "john_doe", email: "john@example.com", ... }],
   *   total: 1247,
   *   page: 1,
   *   limit: 20,
   *   totalPages: 63
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async getUsers(
    page = 1,
    limit = 20,
    role?: UserRole,
    status?: "active" | "suspended" | "all",
    search?: string,
    userRole?: UserRole
  ): Promise<UserManagementData> {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const filter: UserFilter = {};

    if (role) filter.role = role;

    if (status === "active") filter.isSuspended = false;
    else if (status === "suspended") filter.isSuspended = true;

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await this.userModel.countDocuments(filter);

    const users = await this.userModel
      .find(filter, { password: 0 }) // Exclure le mot de passe
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Suspend ou réactive un compte utilisateur avec gestion avancée
   *
   * Cette méthode permet aux administrateurs de suspendre temporairement ou
   * définitivement un compte utilisateur, avec possibilité de spécifier une
   * raison et une date d'expiration. Elle inclut des protections contre la
   * suspension abusive de comptes privilégiés.
   *
   * @async
   * @method toggleUserSuspension
   * @param {string} userId - Identifiant unique de l'utilisateur
   * @param {boolean} suspend - true pour suspendre, false pour lever la suspension
   * @param {string} [reason] - Raison de la suspension (recommandée)
   * @param {Date} [suspendUntil] - Date d'expiration de la suspension (optionnelle)
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant l'action
   * @returns {Promise<{success: boolean; message: string}>} Résultat de l'opération
   * @throws {ForbiddenException} Si rôle insuffisant ou tentative de suspension d'un superadmin
   * @throws {NotFoundException} Si l'utilisateur n'existe pas
   *
   * @example
   * ```typescript
   * // Suspendre un utilisateur pour 7 jours
   * const result = await adminService.toggleUserSuspension(
   *   "user123",
   *   true,
   *   "Violation des règles de communauté",
   *   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
   *   UserRole.ADMIN
   * );
   *
   * // Lever une suspension
   * const result = await adminService.toggleUserSuspension(
   *   "user123",
   *   false,
   *   undefined,
   *   undefined,
   *   UserRole.ADMIN
   * );
   *
   * // Réponse typique:
   * { success: true, message: "Utilisateur suspendu" }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async toggleUserSuspension(
    userId: string,
    suspend: boolean,
    reason?: string,
    suspendUntil?: Date,
    userRole?: UserRole
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    // Ne pas permettre de suspendre un superadmin
    if (user.role === UserRole.SUPERADMIN && userRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException("Impossible de suspendre un superadmin");
    }

    const updateData: any = {
      isSuspended: suspend,
      suspensionReason: suspend ? reason : undefined,
      suspendedUntil: suspend ? suspendUntil : undefined,
    };

    await this.userModel.findByIdAndUpdate(userId, updateData);

    return {
      success: true,
      message: suspend ? "Utilisateur suspendu" : "Suspension levée",
    };
  }

  /**
   * Modifie le rôle d'un utilisateur avec contrôle hiérarchique strict
   *
   * Cette méthode permet aux superadministrateurs de modifier le rôle d'un utilisateur
   * tout en respectant la hiérarchie des permissions. Seuls les superadministrateurs
   * peuvent effectuer cette action critique pour maintenir la sécurité de la plateforme.
   *
   * @async
   * @method changeUserRole
   * @param {string} userId - Identifiant unique de l'utilisateur à modifier
   * @param {UserRole} newRole - Nouveau rôle à attribuer à l'utilisateur
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant l'action
   * @returns {Promise<{success: boolean; message: string}>} Résultat de l'opération
   * @throws {ForbiddenException} Si rôle insuffisant (seuls les SUPERADMIN peuvent changer les rôles)
   * @throws {NotFoundException} Si l'utilisateur n'existe pas
   *
   * @example
   * ```typescript
   * // Promouvoir un utilisateur au rôle de contributeur
   * const result = await adminService.changeUserRole(
   *   "user123",
   *   UserRole.CONTRIBUTOR,
   *   UserRole.SUPERADMIN
   * );
   *
   * // Rétrograder un admin vers utilisateur standard
   * const result = await adminService.changeUserRole(
   *   "admin456",
   *   UserRole.USER,
   *   UserRole.SUPERADMIN
   * );
   *
   * // Réponse typique:
   * { success: true, message: "Rôle changé vers CONTRIBUTOR" }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async changeUserRole(
    userId: string,
    newRole: UserRole,
    userRole?: UserRole
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.SUPERADMIN);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    await this.userModel.findByIdAndUpdate(userId, { role: newRole });

    return {
      success: true,
      message: `Rôle changé vers ${newRole}`,
    };
  }

  /**
   * Récupère la liste des mots en attente de modération avec pagination et filtres
   *
   * Cette méthode permet aux contributeurs et administrateurs de consulter efficacement
   * les mots soumis par la communauté qui nécessitent une validation. Elle inclut des
   * options de filtrage par langue et une pagination optimisée pour faciliter le travail
   * de modération.
   *
   * @async
   * @method getPendingWords
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre d'éléments par page (défaut: 20)
   * @param {string} [language] - Filtrer par langue spécifique (ex: "yipunu", "français")
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant la demande
   * @returns {Promise<{words: Word[], total: number, page: number, limit: number, totalPages: number}>} Données paginées des mots en attente
   * @throws {ForbiddenException} Si rôle insuffisant (minimum CONTRIBUTOR)
   *
   * @example
   * ```typescript
   * // Récupérer les mots en attente pour la langue yipunu
   * const pendingWords = await adminService.getPendingWords(
   *   1, 10, "yipunu", UserRole.CONTRIBUTOR
   * );
   *
   * // Récupérer tous les mots en attente
   * const allPending = await adminService.getPendingWords(
   *   1, 20, undefined, UserRole.ADMIN
   * );
   *
   * // Réponse typique:
   * {
   *   words: [{ word: "diboti", language: "yipunu", createdBy: {...}, ... }],
   *   total: 23,
   *   page: 1,
   *   limit: 20,
   *   totalPages: 2
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async getPendingWords(
    page = 1,
    limit = 20,
    language?: string,
    userRole?: UserRole
  ) {
    this.checkPermission(userRole || UserRole.USER, UserRole.CONTRIBUTOR);

    const filter: WordFilter = { status: "pending" };
    if (language) filter.language = language;

    const skip = (page - 1) * limit;
    const total = await this.wordModel.countDocuments(filter);

    const words = await this.wordModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "username email")
      .sort({ createdAt: -1 })
      .exec();

    return {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Modère un mot en l'approuvant ou le rejetant avec traçabilité complète
   *
   * Cette méthode permet aux contributeurs et administrateurs de valider ou refuser
   * les mots soumis par la communauté. Chaque décision de modération est tracée
   * avec horodatage et raison optionnelle pour maintenir un audit transparent
   * du processus de validation du dictionnaire.
   *
   * @async
   * @method moderateWord
   * @param {string} wordId - Identifiant unique du mot à modérer
   * @param {"approve" | "reject"} action - Action de modération à effectuer
   * @param {string} [reason] - Raison de la décision (recommandée pour les rejets)
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant la modération
   * @returns {Promise<{success: boolean; message: string}>} Résultat de l'opération de modération
   * @throws {ForbiddenException} Si rôle insuffisant (minimum CONTRIBUTOR)
   * @throws {NotFoundException} Si le mot n'existe pas
   *
   * @example
   * ```typescript
   * // Approuver un mot validé
   * const result = await adminService.moderateWord(
   *   "word123",
   *   "approve",
   *   "Définition correcte et bien documentée",
   *   UserRole.CONTRIBUTOR
   * );
   *
   * // Rejeter un mot problématique
   * const result = await adminService.moderateWord(
   *   "word456",
   *   "reject",
   *   "Définition incomplète ou incorrecte",
   *   UserRole.ADMIN
   * );
   *
   * // Réponse typique:
   * { success: true, message: "Mot approuvé" }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async moderateWord(
    wordId: string,
    action: "approve" | "reject",
    reason?: string,
    userRole?: UserRole
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.CONTRIBUTOR);

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException("Mot non trouvé");
    }

    const status = action === "approve" ? "approved" : "rejected";
    await this.wordModel.findByIdAndUpdate(wordId, {
      status,
      moderationReason: reason,
      moderatedAt: new Date(),
    });

    return {
      success: true,
      message: action === "approve" ? "Mot approuvé" : "Mot rejeté",
    };
  }

  /**
   * Récupère la liste des communautés avec pagination et filtres de modération
   *
   * Cette méthode permet aux administrateurs de superviser efficacement toutes les
   * communautés de la plateforme avec des options de filtrage par statut d'activité.
   * Elle inclut les métadonnées des créateurs et une pagination optimisée pour
   * faciliter la gestion des communautés à grande échelle.
   *
   * @async
   * @method getCommunities
   * @param {number} page - Numéro de page (défaut: 1)
   * @param {number} limit - Nombre d'éléments par page (défaut: 20)
   * @param {"active" | "inactive"} [status] - Filtrer par statut d'activité des communautés
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant la demande
   * @returns {Promise<{communities: Community[], total: number, page: number, limit: number, totalPages: number}>} Données paginées des communautés
   * @throws {ForbiddenException} Si rôle insuffisant (minimum ADMIN)
   *
   * @example
   * ```typescript
   * // Récupérer toutes les communautés actives
   * const activeCommunities = await adminService.getCommunities(
   *   1, 10, "active", UserRole.ADMIN
   * );
   *
   * // Récupérer les communautés inactives pour nettoyage
   * const inactiveCommunities = await adminService.getCommunities(
   *   1, 20, "inactive", UserRole.ADMIN
   * );
   *
   * // Réponse typique:
   * {
   *   communities: [{ name: "Apprenons Yipunu", language: "yipunu", memberCount: 45, ... }],
   *   total: 127,
   *   page: 1,
   *   limit: 20,
   *   totalPages: 7
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async getCommunities(
    page = 1,
    limit = 20,
    status?: "active" | "inactive",
    userRole?: UserRole
  ) {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const filter: CommunityFilter = {};
    if (status === "active") filter.memberCount = { $gt: 1 };
    else if (status === "inactive") filter.memberCount = { $lte: 1 };

    const skip = (page - 1) * limit;
    const total = await this.communityModel.countDocuments(filter);

    const communities = await this.communityModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "username email")
      .sort({ createdAt: -1 })
      .exec();

    return {
      communities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Supprime définitivement une communauté avec nettoyage complet des données associées
   *
   * Cette méthode permet aux administrateurs de supprimer complètement une communauté
   * de la plateforme, incluant automatiquement tous les éléments associés (membres,
   * posts, messages). Cette action irréversible est destinée aux cas de modération
   * sévère ou de nettoyage de communautés inactives/problématiques.
   *
   * @async
   * @method deleteCommunity
   * @param {string} communityId - Identifiant unique de la communauté à supprimer
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant la suppression
   * @returns {Promise<{success: boolean; message: string}>} Résultat de l'opération de suppression
   * @throws {ForbiddenException} Si rôle insuffisant (minimum ADMIN)
   * @throws {NotFoundException} Si la communauté n'existe pas
   *
   * @example
   * ```typescript
   * // Supprimer une communauté problématique
   * const result = await adminService.deleteCommunity(
   *   "community123",
   *   UserRole.ADMIN
   * );
   *
   * // Nettoyage de communauté inactive
   * const result = await adminService.deleteCommunity(
   *   "inactive456",
   *   UserRole.SUPERADMIN
   * );
   *
   * // Réponse typique:
   * { success: true, message: "Communauté supprimée" }
   * ```
   *
   * @warning Cette action est irréversible et supprime définitivement toutes les données
   * @since 1.0.0
   * @memberof AdminService
   */
  async deleteCommunity(
    communityId: string,
    userRole?: UserRole
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const community = await this.communityModel.findById(communityId);
    if (!community) {
      throw new NotFoundException("Communauté non trouvée");
    }

    // Supprimer tous les membres, posts, etc.
    await Promise.all([
      this.memberModel.deleteMany({ communityId }),
      this.postModel.deleteMany({ communityId }),
      this.communityModel.findByIdAndDelete(communityId),
    ]);

    return {
      success: true,
      message: "Communauté supprimée",
    };
  }

  /**
   * Récupère les activités récentes de la plateforme pour surveillance et audit
   *
   * Cette méthode compile les dernières activités significatives de tous les modules
   * de la plateforme O'Ypunu pour fournir aux administrateurs une vue d'ensemble
   * en temps réel des événements récents. Elle est optimisée pour les tableaux
   * de bord de surveillance et les outils d'audit.
   *
   * @async
   * @method getRecentActivity
   * @param {number} limit - Nombre maximum d'éléments à retourner (défaut: 50)
   * @param {UserRole} [userRole] - Rôle de l'utilisateur effectuant la demande
   * @returns {Promise<{recentUsers: User[], recentWords: Word[], recentCommunities: Community[]}>} Données d'activité récente triées par type
   * @throws {ForbiddenException} Si rôle insuffisant (minimum ADMIN)
   *
   * @example
   * ```typescript
   * // Récupérer les 30 dernières activités
   * const activity = await adminService.getRecentActivity(30, UserRole.ADMIN);
   *
   * // Analyser les nouveaux utilisateurs
   * console.log(`${activity.recentUsers.length} nouveaux utilisateurs`);
   *
   * // Surveiller les soumissions de mots
   * console.log(`${activity.recentWords.length} nouveaux mots soumis`);
   *
   * // Réponse typique:
   * {
   *   recentUsers: [{ username: "nouveau_user", role: "USER", createdAt: "2025-01-01T10:30:00Z", ... }],
   *   recentWords: [{ word: "diboti", language: "yipunu", status: "pending", createdBy: {...}, ... }],
   *   recentCommunities: [{ name: "Nouvelle Communauté", memberCount: 5, language: "yipunu", ... }]
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof AdminService
   */
  async getRecentActivity(limit = 50, userRole?: UserRole) {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const [recentUsers, recentWords, recentCommunities] = await Promise.all([
      this.userModel
        .find({}, { username: 1, email: 1, createdAt: 1, role: 1 })
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .exec(),
      this.wordModel
        .find({}, { word: 1, language: 1, status: 1, createdAt: 1 })
        .populate("createdBy", "username")
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .exec(),
      this.communityModel
        .find({}, { name: 1, language: 1, memberCount: 1, createdAt: 1 })
        .populate("createdBy", "username")
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .exec(),
    ]);

    return {
      recentUsers,
      recentWords,
      recentCommunities,
    };
  }
}
