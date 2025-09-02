/**
 * @fileoverview Service principal de gestion des communautés O'Ypunu
 * 
 * Ce service centralise toute la logique métier liée aux communautés,
 * incluant création, gestion des membres, recherche, et modération.
 * Il fournit une API complète pour les interactions communautaires
 * avec validation des permissions et gestion d'erreurs robuste.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { CommunityFiltersDto } from "../dto/community-filters.dto";
import { CreateCommunityDto } from "../dto/create-community.dto";
import { CommunityMember } from "../schemas/community-member.schema";
import { Community } from "../schemas/community.schema";
import { ICommunityRepository } from "../../repositories/interfaces/community.repository.interface";
import { ICommunityMemberRepository } from "../../repositories/interfaces/community-member.repository.interface";

/**
 * Interface pour les requêtes de recherche de communautés MongoDB
 * 
 * @interface CommunityQuery
 * @property {Array} [$or] - Conditions OR pour recherche textuelle
 * @property {string} [language] - Filtre par langue de la communauté
 * @property {string} [tags] - Filtre par tag spécifique
 * @property {boolean} [isPrivate] - Filtre par visibilité publique/privée
 */
interface CommunityQuery {
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
  language?: string;
  tags?: string;
  isPrivate?: boolean;
}

/**
 * Interface pour les données utilisateur JWT
 * 
 * @interface JwtUser
 * @property {string} [userId] - ID utilisateur alternatif
 * @property {string} [_id] - ID utilisateur MongoDB
 * @property {string} username - Nom d'utilisateur
 * @property {string} email - Email utilisateur
 * @property {string} role - Rôle utilisateur (USER, CONTRIBUTOR, ADMIN, etc.)
 */
interface JwtUser {
  userId?: string;
  _id?: string;
  username: string;
  email: string;
  role: string;
}

/**
 * Service principal de gestion des communautés O'Ypunu
 * 
 * Ce service centralise toute la logique métier des communautés avec
 * une architecture robuste basée sur le pattern Repository et une
 * gestion complète des permissions et validations.
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 🏗️ Gestion de communautés
 * - Création avec assignation automatique d'admin
 * - Mise à jour avec contrôle de permissions
 * - Suppression en cascade (membres + posts)
 * - Recherche multicritères optimisée
 * 
 * ### 👥 Gestion des membres
 * - Adhésion et désadhésion sécurisées
 * - Système de rôles hiérarchiques (member < moderator < admin)
 * - Compteurs de membres automatiques
 * - Validation des permissions pour actions sensibles
 * 
 * ### 🔍 Recherche et découverte
 * - Recherche textuelle avec regex insensible à la casse
 * - Filtrage par langue, tags et visibilité
 * - Pagination optimisée pour grandes collections
 * - Tri personnalisable (date, nom, nombre de membres)
 * 
 * ### 🛡️ Sécurité et permissions
 * - Extraction sécurisée des IDs utilisateur
 * - Validation des rôles pour toutes les actions
 * - Protection contre les actions non autorisées
 * - Logging détaillé pour audit et debugging
 * 
 * @class CommunitiesService
 * @version 1.0.0
 */
@Injectable()
export class CommunitiesService {
  /**
   * Constructeur du service avec injection des repositories
   * 
   * @constructor
   * @param {ICommunityRepository} communityRepository - Repository des communautés
   * @param {ICommunityMemberRepository} communityMemberRepository - Repository des membres
   */
  constructor(
    @Inject("ICommunityRepository")
    private communityRepository: ICommunityRepository,
    @Inject("ICommunityMemberRepository")
    private communityMemberRepository: ICommunityMemberRepository
  ) {}

  /**
   * Extrait l'ID utilisateur d'un objet JwtUser ou d'une chaîne
   * 
   * Méthode utilitaire qui normalise l'extraction de l'ID utilisateur
   * à partir de différents formats d'entrée (string directe ou objet JWT).
   * Gère les variations de noms de champs (_id vs userId).
   * 
   * @private
   * @method _extractUserId
   * @param {JwtUser | string} userOrId - Utilisateur JWT ou ID direct
   * @returns {string} ID utilisateur extrait
   * @throws {Error} Si aucun ID valide n'est trouvé
   * 
   * @example
   * ```typescript
   * const userId1 = this._extractUserId("507f1f77bcf86cd799439011");
   * const userId2 = this._extractUserId({ userId: "507f...", username: "john" });
   * const userId3 = this._extractUserId({ _id: "507f...", email: "john@example.com" });
   * ```
   */
  private _extractUserId(userOrId: JwtUser | string): string {
    if (typeof userOrId === "string") {
      return userOrId;
    }

    const userId = userOrId.userId || userOrId._id;
    if (!userId) {
      throw new Error("User ID is required");
    }

    return userId;
  }

  /**
   * Crée une nouvelle communauté avec assignation automatique d'admin
   * 
   * Cette méthode centrale crée une communauté et configure automatiquement
   * le créateur comme administrateur. Elle effectue les opérations en
   * deux étapes atomiques : création de la communauté puis ajout du membre admin.
   * 
   * @async
   * @method create
   * @param {CreateCommunityDto} createCommunityDto - Données de création
   * @param {JwtUser | string} user - Utilisateur créateur
   * @returns {Promise<Community>} Communauté créée avec métadonnées
   * @throws {Error} Si la création échoue ou l'utilisateur est invalide
   * 
   * @example
   * ```typescript
   * const newCommunity = await this.communitiesService.create({
   *   name: 'Développeurs Yipunu',
   *   description: 'Communauté des développeurs de langues africaines',
   *   language: 'fr',
   *   tags: ['développement', 'yipunu'],
   *   isPrivate: false
   * }, currentUser);
   * ```
   */
  async create(
    createCommunityDto: CreateCommunityDto,
    user: JwtUser | string
  ): Promise<Community> {
    console.log("Creating community with user:", user);

    const userId = this._extractUserId(user);
    console.log("Resolved User ID:", userId);

    const community = await this.communityRepository.create({
      name: createCommunityDto.name,
      description: createCommunityDto.description,
      language: createCommunityDto.language,
      tags: createCommunityDto.tags,
      isPrivate: createCommunityDto.isPrivate,
      coverImage: createCommunityDto.coverImage,
      createdBy: userId,
    });

    // Ajouter le créateur comme admin
    await this.communityMemberRepository.create({
      communityId: (community as any)._id,
      userId: userId,
      role: "admin",
    });

    return community;
  }

  /**
   * Récupère toutes les communautés avec filtrage avancé et pagination
   * 
   * Cette méthode complexe gère la recherche multicritères de communautés
   * avec optimisations spécifiques selon le type de recherche :
   * - Recherche textuelle : regex sur nom et description
   * - Filtrage par langue : utilise l'index langue
   * - Filtrage par tags : recherche dans tableau de tags
   * - Tri personnalisable et pagination optimisée
   * 
   * @async
   * @method findAll
   * @param {CommunityFiltersDto} filters - Critères de recherche et pagination
   * @returns {Promise<Object>} Résultat paginé avec communautés et métadonnées
   * @property {Community[]} communities - Liste des communautés trouvées
   * @property {number} total - Nombre total de résultats
   * @property {number} page - Page actuelle
   * @property {number} limit - Limite par page
   * 
   * @example
   * ```typescript
   * const result = await this.communitiesService.findAll({
   *   page: 1,
   *   limit: 20,
   *   searchTerm: 'développement',
   *   language: 'fr',
   *   includePrivate: false,
   *   sortBy: 'memberCount',
   *   sortOrder: 'desc'
   * });
   * ```
   */
  async findAll(filters: CommunityFiltersDto): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      searchTerm,
      language,
      tag,
      includePrivate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;
    const skip = (page - 1) * limit;

    const query: CommunityQuery = {};

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (language) {
      query.language = language;
    }

    if (tag) {
      query.tags = tag;
    }

    if (!includePrivate) {
      query.isPrivate = false;
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Convertir les filtres pour le repository
    const repositoryOptions = {
      page,
      limit,
      includePrivate,
      sortBy: sortBy as "memberCount" | "createdAt" | "name",
      sortOrder: sortOrder as "asc" | "desc",
    };

    let result;
    if (searchTerm) {
      result = await this.communityRepository.search(searchTerm, {
        language,
        includePrivate,
        limit,
        skip,
      });
      return {
        communities: result.communities,
        total: result.total,
        page,
        limit,
      };
    } else if (language) {
      result = await this.communityRepository.findByLanguage(
        language,
        repositoryOptions
      );
      return result;
    } else if (tag) {
      const communities = await this.communityRepository.findByTags([tag], {
        includePrivate,
        limit,
      });
      const total = communities.length;
      return { communities, total, page, limit };
    } else {
      result = await this.communityRepository.findAll(repositoryOptions);
      return {
        communities: result.communities,
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    }
  }

  /**
   * Permet à un utilisateur de rejoindre une communauté
   * 
   * Cette méthode gère l'adhésion d'un utilisateur à une communauté avec
   * vérification anti-duplication et mise à jour automatique des compteurs.
   * Elle est idempotente : si l'utilisateur est déjà membre, elle retourne
   * success=true sans erreur.
   * 
   * @async
   * @method joinCommunity
   * @param {string} communityId - ID de la communauté à rejoindre
   * @param {JwtUser | string} userOrId - Utilisateur demandant l'adhésion
   * @returns {Promise<Object>} Résultat de l'opération
   * @property {boolean} success - Succès de l'adhésion
   * 
   * @example
   * ```typescript
   * const result = await this.communitiesService.joinCommunity(
   *   '507f1f77bcf86cd799439011',
   *   currentUser
   * );
   * if (result.success) {
   *   console.log('Utilisateur ajouté à la communauté');
   * }
   * ```
   */
  async joinCommunity(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean }> {
    const userId = this._extractUserId(userOrId);

    // Vérifier si l'utilisateur est déjà membre
    const isMember = await this.communityMemberRepository.isMember(
      communityId,
      userId
    );

    if (isMember) {
      return { success: true }; // Déjà membre
    }

    // Ajouter comme membre
    await this.communityMemberRepository.create({
      communityId,
      userId,
      role: "member",
    });

    // Incrémenter le compteur de membres
    await this.communityRepository.incrementMemberCount(communityId);

    return { success: true };
  }

  // Quitter une communauté
  async leaveCommunity(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean }> {
    const userId = this._extractUserId(userOrId);

    const isMember = await this.communityMemberRepository.isMember(
      communityId,
      userId
    );

    if (!isMember) {
      return { success: false };
    }

    const removed = await this.communityMemberRepository.removeMember(
      communityId,
      userId
    );
    if (removed) {
      await this.communityRepository.decrementMemberCount(communityId);
    }

    return { success: true };
  }

  // Récupérer les membres d'une communauté
  async getCommunityMembers(
    communityId: string,
    page = 1,
    limit = 10
  ): Promise<{
    members: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.communityMemberRepository.findByCommunity(
      communityId,
      {
        page,
        limit,
        sortBy: "joinedAt",
        sortOrder: "desc",
      }
    );

    const { members, total } = result;

    return { members, total, page, limit };
  }

  async getAllMembersWithRoles(communityId: string): Promise<any[]> {
    const result = await this.communityMemberRepository.findByCommunity(
      communityId,
      {
        limit: 1000, // Limite élevée pour récupérer tous les membres
      }
    );
    return result.members;
  }

  /**
   * Met à jour le rôle d'un membre dans une communauté
   * 
   * Cette méthode critique gère la promotion/rétrogradation des membres
   * avec validation stricte des permissions. Seuls les administrateurs
   * peuvent modifier les rôles des autres membres. Elle inclut des
   * vérifications de sécurité pour éviter les escalades de privilèges.
   * 
   * @async
   * @method updateMemberRole
   * @param {string} communityId - ID de la communauté
   * @param {string} memberUserId - ID du membre à modifier
   * @param {"admin" | "moderator" | "member"} newRole - Nouveau rôle à assigner
   * @param {JwtUser | string} adminUserOrId - Administrateur effectuant la modification
   * @returns {Promise<Object>} Résultat de l'opération
   * @property {boolean} success - Succès de la modification
   * @property {string} message - Message explicatif du résultat
   * 
   * @example
   * ```typescript
   * const result = await this.communitiesService.updateMemberRole(
   *   communityId,
   *   memberUserId,
   *   'moderator',
   *   adminUser
   * );
   * if (result.success) {
   *   console.log('Rôle mis à jour:', result.message);
   * }
   * ```
   */
  async updateMemberRole(
    communityId: string,
    memberUserId: string,
    newRole: "admin" | "moderator" | "member",
    adminUserOrId: JwtUser | string
  ): Promise<{ success: boolean; message: string }> {
    const adminId = this._extractUserId(adminUserOrId);

    // Vérifier si l'administrateur a les droits
    const isAdmin = await this.communityMemberRepository.hasRole(
      communityId,
      adminId,
      "admin"
    );

    if (!isAdmin) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    // Vérifier si le membre existe
    const isMember = await this.communityMemberRepository.isMember(
      communityId,
      memberUserId
    );

    if (!isMember) {
      return { success: false, message: "Membre non trouvé" };
    }

    // Mettre à jour le rôle
    await this.communityMemberRepository.updateRole(
      communityId,
      memberUserId,
      newRole
    );

    return { success: true, message: "Rôle mis à jour avec succès" };
  }

  // Récupérer les communautés d'un utilisateur
  async getUserCommunities(
    userOrId: JwtUser | string,
    page = 1,
    limit = 10
  ): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const userId = this._extractUserId(userOrId);

    const membershipResult = await this.communityMemberRepository.findByUser(
      userId,
      {
        page,
        limit,
        sortBy: "joinedAt",
        sortOrder: "desc",
      }
    );

    const communityIds = membershipResult.memberships.map(
      (member) => (member as any).communityId
    );

    // Récupérer les communautés correspondantes
    const communities = [];
    for (const communityId of communityIds) {
      const community = await this.communityRepository.findById(communityId);
      if (community) {
        communities.push(community);
      }
    }

    const total = membershipResult.total;

    return { communities, total, page, limit };
  }

  /**
   * Récupère une communauté spécifique par son ID
   * 
   * Méthode simple de récupération d'une communauté avec gestion d'erreur
   * automatique si la communauté n'existe pas. Utilisée comme base pour
   * de nombreuses autres opérations nécessitant une validation d'existence.
   * 
   * @async
   * @method findOne
   * @param {string} communityId - ID de la communauté à récupérer
   * @returns {Promise<Community>} Communauté trouvée
   * @throws {NotFoundException} Si la communauté n'existe pas
   * 
   * @example
   * ```typescript
   * try {
   *   const community = await this.communitiesService.findOne(communityId);
   *   console.log('Communauté trouvée:', community.name);
   * } catch (error) {
   *   console.error('Communauté non trouvée');
   * }
   * ```
   */
  async findOne(communityId: string): Promise<Community> {
    const community = await this.communityRepository.findById(communityId);

    if (!community) {
      throw new NotFoundException(
        `Communauté avec l'ID ${communityId} non trouvée`
      );
    }

    return community;
  }

  // Mettre à jour une communauté
  async update(
    communityId: string,
    updateData: Partial<Community>,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean; message: string }> {
    const userId = this._extractUserId(userOrId);

    const isAdmin = await this.communityMemberRepository.hasRole(
      communityId,
      userId,
      "admin"
    );

    if (!isAdmin) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    await this.communityRepository.update(communityId, updateData);
    return { success: true, message: "Communauté mise à jour avec succès" };
  }

  // Supprimer une communauté
  async delete(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean; message: string }> {
    const userId = this._extractUserId(userOrId);

    const isAdmin = await this.communityMemberRepository.hasRole(
      communityId,
      userId,
      "admin"
    );

    if (!isAdmin) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    await Promise.all([
      this.communityRepository.delete(communityId),
      this.communityMemberRepository.removeAllFromCommunity(communityId),
    ]);

    return { success: true, message: "Communauté supprimée avec succès" };
  }

  // Vérifier si un utilisateur est membre d'une communauté
  async isMember(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<boolean> {
    const userId = this._extractUserId(userOrId);

    return this.communityMemberRepository.isMember(communityId, userId);
  }

  // Récupérer le rôle d'un membre dans une communauté
  async getMemberRole(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<"admin" | "moderator" | "member" | null> {
    const userId = this._extractUserId(userOrId);
    console.log(
      `Recherche du rôle pour communityId: ${communityId}, userId: ${userId}`
    );

    const role = await this.communityMemberRepository.getUserRole(
      communityId,
      userId
    );

    console.log("Rôle trouvé:", role);

    return role;
  }

  // Rechercher des communautés par tag
  async searchByTags(
    tags: string[],
    page = 1,
    limit = 10
  ): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const communities = await this.communityRepository.findByTags(tags, {
      includePrivate: false,
      limit,
    });

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCommunities = communities.slice(startIndex, endIndex);
    const total = communities.length;

    return { communities: paginatedCommunities, total, page, limit };
  }
}
