/**
 * @fileoverview Contrôleur de gestion des utilisateurs pour O'Ypunu
 * 
 * Ce contrôleur gère l'ensemble des opérations liées aux utilisateurs incluant
 * les profils, statistiques, recherche et analytics avec endpoints publics
 * et privés pour une gestion complète de la communauté O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { UsersService } from "../services/users.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { UserDocument } from "../schemas/user.schema";
import { UpdateProfileDto } from "../dto/update-profile.dto";

/**
 * Interface de réponse pour le profil utilisateur complet (privé)
 * 
 * @interface UserResponse
 */
interface UserResponse {
  /** Identifiant unique de l'utilisateur */
  id: string;
  /** Adresse email */
  email: string;
  /** Nom d'utilisateur unique */
  username: string;
  /** Statut de vérification de l'email */
  isEmailVerified: boolean;
  /** Rôle utilisateur dans la plateforme */
  role: string;
  /** Langue maternelle (code ISO) */
  nativeLanguage: string;
  /** Langues en apprentissage (codes ISO) */
  learningLanguages: string[];
  /** URL de la photo de profil */
  profilePicture?: string;
  /** Biographie utilisateur */
  bio?: string;
  /** Localisation géographique */
  location?: string;
  /** Site web personnel */
  website?: string;
  /** Visibilité du profil */
  isProfilePublic: boolean;
  /** Dernière activité */
  lastActive: Date;
}

/**
 * Interface de réponse pour le profil utilisateur public
 * 
 * @interface PublicUserResponse
 */
interface PublicUserResponse {
  /** Identifiant unique de l'utilisateur */
  id: string;
  /** Nom d'utilisateur unique */
  username: string;
  /** Langue maternelle (code ISO) */
  nativeLanguage: string;
  /** Langues en apprentissage (codes ISO) */
  learningLanguages: string[];
  /** URL de la photo de profil */
  profilePicture?: string;
  /** Biographie utilisateur */
  bio?: string;
  /** Localisation géographique */
  location?: string;
  /** Site web personnel */
  website?: string;
  /** Dernière activité */
  lastActive: Date;
}

/**
 * Interface des statistiques utilisateur
 * 
 * @interface UserStatsResponse
 */
interface UserStatsResponse {
  /** Nombre total de mots ajoutés */
  totalWordsAdded: number;
  /** Nombre total de posts communautaires */
  totalCommunityPosts: number;
  /** Nombre de mots favoris */
  favoriteWordsCount: number;
  /** Date d'inscription */
  joinDate: Date;
}

/**
 * Contrôleur de gestion des utilisateurs O'Ypunu
 * 
 * Ce contrôleur centralise toutes les opérations liées aux utilisateurs :
 * 
 * ## 👤 Endpoints de profil :
 * - **Profil privé** : GET /profile - Données complètes utilisateur connecté
 * - **Profil public** : GET /:username - Données publiques par username
 * - **Mise à jour** : PATCH /profile - Modification profil utilisateur
 * 
 * ## 📊 Endpoints de statistiques :
 * - **Stats personnelles** : GET /profile/stats - Métriques individuelles
 * - **Contributions récentes** : GET /profile/recent-contributions
 * - **Consultations récentes** : GET /profile/recent-consultations
 * - **Analytics** : GET /analytics/online-contributors - Métriques globales
 * 
 * ## 🔍 Endpoints de recherche :
 * - **Recherche utilisateurs** : GET /search - Recherche par nom/critères
 * 
 * ## 🛠️ Endpoints de debug :
 * - **Tous utilisateurs** : GET /allusers - Vue d'ensemble utilisateurs
 * - **Activation** : GET /activate-user - Utilitaires d'activation
 * - **Status debug** : GET /debug/all-users-status - Diagnostics détaillés
 * 
 * ## 🔐 Sécurité :
 * - **Authentification** : JWT requis pour endpoints privés
 * - **Données sensibles** : Email/info privées protégées
 * - **Profils publics** : Filtrage automatique des données sensibles
 * 
 * @class UsersController
 * @version 1.0.0
 */
@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private _usersService: UsersService) {}

  /**
   * [DEBUG] Récupérer la liste de tous les utilisateurs avec statuts
   * 
   * Endpoint de debug pour visualiser l'état de tous les utilisateurs
   * avec calcul des statuts d'activité et de contribution en temps réel.
   * 
   * @returns Promise<any[]> Liste enrichie des utilisateurs avec statuts
   * 
   * @example
   * GET /users/allusers
   * Response: [{ username: "john", role: "user", isContributor: true, ... }]
   */
  @Get("allusers")
  @ApiOperation({
    summary: "Debug - Voir tous les utilisateurs",
  })
  async getAllUsers(): Promise<any[]> {
    const users = await this._usersService.findAll();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return users.map((user) => ({
      username: user.username,
      role: user.role,
      totalWordsAdded: user.totalWordsAdded || 0,
      lastActive: user.lastActive,
      isActive: user.isActive,
      isRecentlyActive: user.lastActive && user.lastActive >= fiveMinutesAgo,
      isContributor:
        (user.totalWordsAdded && user.totalWordsAdded > 0) ||
        ["contributor", "admin", "superadmin"].includes(user.role),
      qualifiesAsOnlineContributor:
        user.isActive &&
        user.lastActive &&
        user.lastActive >= fiveMinutesAgo &&
        ((user.totalWordsAdded && user.totalWordsAdded > 0) ||
          ["contributor", "admin", "superadmin"].includes(user.role)),
    }));
  }

  @Get("activate-user")
  @ApiOperation({
    summary: "Debug - Activer tous les utilisateurs superadmin",
  })
  async activateUsers(): Promise<{ message: string; count: number }> {
    const result = await this._usersService.activateSuperAdmins();
    return {
      message: "Utilisateurs superadmin activés",
      count: result,
    };
  }

  /**
   * Récupérer le profil complet de l'utilisateur connecté
   * 
   * Retourne toutes les informations du profil utilisateur incluant
   * les données sensibles (email) et les préférences de langues.
   * 
   * @param req - Requête contenant l'utilisateur JWT authentifié
   * @returns Promise<UserResponse> Profil complet avec données privées
   * 
   * @throws {NotFoundException} Si l'utilisateur n'est pas trouvé
   * 
   * @example
   * GET /users/profile
   * Authorization: Bearer <token>
   * Response: { id: "123", email: "user@example.com", username: "john", ... }
   */
  @UseGuards(JwtAuthGuard)
  @Get("profile")
  @ApiOperation({ summary: "Récupérer le profil de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: "Profil récupéré avec succès",
    type: Object,
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  @ApiBearerAuth()
  async getProfile(
    @Req() req: { user: { _id: string } }
  ): Promise<UserResponse> {
    const user = await this._usersService.findByIdWithLanguages(req.user._id);
    if (!user || !user._id) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      nativeLanguage:
        user.nativeLanguageId?.iso639_1 ||
        user.nativeLanguageId?.iso639_2 ||
        user.nativeLanguageId?.iso639_3 ||
        "fr",
      learningLanguages:
        user.learningLanguageIds
          ?.map((lang) => lang.iso639_1 || lang.iso639_2 || lang.iso639_3)
          .filter(Boolean) || [],
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      isProfilePublic: user.isProfilePublic,
      lastActive: user.lastActive,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch("profile")
  @ApiOperation({
    summary: "Mettre à jour le profil de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Profil mis à jour avec succès",
    type: Object,
  })
  @ApiResponse({ status: 400, description: "Requête invalide" })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  @ApiBody({
    type: UpdateProfileDto,
    description: "Données du profil à mettre à jour",
  })
  @ApiBearerAuth()
  async updateProfile(
    @Req() req: { user: { _id: string } },
    @Body() updateData: UpdateProfileDto
  ): Promise<UserResponse> {
    await this._usersService.updateUser(req.user._id, updateData);

    const updatedUser = await this._usersService.findByIdWithLanguages(
      req.user._id
    );

    if (!updatedUser || !updatedUser._id) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    return {
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      username: updatedUser.username,
      isEmailVerified: updatedUser.isEmailVerified,
      role: updatedUser.role,
      nativeLanguage:
        updatedUser.nativeLanguageId?.iso639_1 ||
        updatedUser.nativeLanguageId?.iso639_2 ||
        updatedUser.nativeLanguageId?.iso639_3 ||
        "fr",
      learningLanguages:
        updatedUser.learningLanguageIds
          ?.map((lang) => lang.iso639_1 || lang.iso639_2 || lang.iso639_3)
          .filter(Boolean) || [],
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      location: updatedUser.location,
      website: updatedUser.website,
      isProfilePublic: updatedUser.isProfilePublic,
      lastActive: updatedUser.lastActive,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile/stats")
  @ApiOperation({
    summary: "Récupérer les statistiques de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques récupérées avec succès",
    type: Object,
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  @ApiBearerAuth()
  async getUserStats(
    @Req() req: { user: { _id: string } }
  ): Promise<UserStatsResponse> {
    console.log("getUserStats - req.user:", req.user);
    console.log("getUserStats - userId:", req.user._id);
    return this._usersService.getUserStats(req.user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile/recent-contributions")
  @ApiOperation({
    summary: "Récupérer les contributions récentes de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Contributions récentes récupérées avec succès",
    type: [Object],
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiBearerAuth()
  async getUserRecentContributions(
    @Req() req: { user: { _id: string } },
    @Query("limit") limit: string = "5"
  ) {
    const contributions = await this._usersService.getUserRecentContributions(
      req.user._id,
      parseInt(limit)
    );

    return {
      contributions,
      count: contributions.length,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile/recent-consultations")
  @ApiOperation({
    summary: "Récupérer les consultations récentes de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: "Consultations récentes récupérées avec succès",
    type: [Object],
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiBearerAuth()
  async getUserRecentConsultations(
    @Req() req: { user: { _id: string } },
    @Query("limit") limit: string = "5"
  ) {
    console.log(
      "🎯 API call getUserRecentConsultations pour:",
      req.user._id,
      "limit:",
      limit
    );

    const consultations = await this._usersService.getUserRecentConsultations(
      req.user._id,
      parseInt(limit)
    );

    const response = {
      consultations,
      count: consultations.length,
      timestamp: new Date().toISOString(),
    };

    console.log("📤 Réponse API consultations:", response);

    return response;
  }

  @Get("search")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Rechercher des utilisateurs" })
  @ApiResponse({
    status: 200,
    description: "Utilisateurs trouvés",
    type: [Object],
  })
  @ApiResponse({ status: 401, description: "Non autorisé" })
  @ApiBearerAuth()
  async searchUsers(
    @Query("search") searchQuery: string,
    @Req() req: { user: { _id: string } }
  ): Promise<PublicUserResponse[]> {
    console.log("[UsersController] Requête de recherche reçue");
    console.log("[UsersController] Requête utilisateur:", req.user);
    console.log("[UsersController] Paramètre de recherche:", searchQuery);

    if (!searchQuery || searchQuery.trim().length < 2) {
      console.log("[UsersController] Requête trop courte, retour tableau vide");
      return [];
    }

    console.log("[UsersController] Appel du service de recherche...");
    const users = await this._usersService.searchUsers(
      searchQuery,
      req.user._id
    );

    console.log(
      "[UsersController] Utilisateurs trouvés par le service:",
      users.length
    );

    const result = users.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      nativeLanguage:
        user.nativeLanguageId?.iso639_1 ||
        user.nativeLanguageId?.iso639_2 ||
        user.nativeLanguageId?.iso639_3 ||
        "fr",
      learningLanguages:
        user.learningLanguageIds
          ?.map((lang) => lang.iso639_1 || lang.iso639_2 || lang.iso639_3)
          .filter(Boolean) || [],
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      lastActive: user.lastActive,
    }));

    console.log(
      "[UsersController] Résultat transformé:",
      result.length,
      "utilisateurs"
    );
    return result;
  }

  @Get("analytics/online-contributors")
  @ApiOperation({
    summary: "Obtenir le nombre de contributeurs en ligne",
  })
  @ApiResponse({
    status: 200,
    description: "Nombre de contributeurs en ligne récupéré avec succès",
    schema: {
      type: "object",
      properties: {
        onlineContributors: { type: "number" },
        activeUsers: { type: "number" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  async getOnlineContributorsCount(): Promise<{
    onlineContributors: number;
    activeUsers: number;
    timestamp: string;
  }> {
    const [onlineContributors, activeUsers] = await Promise.all([
      this._usersService.getOnlineContributorsCount(),
      this._usersService.getActiveUsersCount(),
    ]);

    return {
      onlineContributors,
      activeUsers,
      timestamp: new Date().toISOString(),
    };
  }

  @Get("debug/all-users-status")
  @ApiOperation({
    summary: "Debug - Voir le statut de tous les utilisateurs",
  })
  async debugAllUsersStatus(): Promise<any[]> {
    const users = await this._usersService.findAll();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return users.map((user) => ({
      username: user.username,
      role: user.role,
      totalWordsAdded: user.totalWordsAdded || 0,
      lastActive: user.lastActive,
      isActive: user.isActive,
      isRecentlyActive: user.lastActive && user.lastActive >= fiveMinutesAgo,
      isContributor:
        (user.totalWordsAdded && user.totalWordsAdded > 0) ||
        ["contributor", "admin", "superadmin"].includes(user.role),
      qualifiesAsOnlineContributor:
        user.isActive &&
        user.lastActive &&
        user.lastActive >= fiveMinutesAgo &&
        ((user.totalWordsAdded && user.totalWordsAdded > 0) ||
          ["contributor", "admin", "superadmin"].includes(user.role)),
    }));
  }

  @Get(":username")
  @ApiOperation({
    summary:
      "Récupérer le profil public d'un utilisateur par son nom d'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: "Profil public récupéré avec succès",
    type: Object,
  })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  @ApiParam({
    name: "username",
    description: "Nom d'utilisateur",
    example: "johndoe",
  })
  async getUserByUsername(
    @Param("username") username: string
  ): Promise<PublicUserResponse> {
    const user = (await this._usersService.findByUsername(
      username
    )) as UserDocument;
    if (!user || !user._id) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    return {
      id: user._id.toString(),
      username: user.username,
      nativeLanguage:
        user.nativeLanguageId?.iso639_1 ||
        user.nativeLanguageId?.iso639_2 ||
        user.nativeLanguageId?.iso639_3 ||
        "fr",
      learningLanguages:
        user.learningLanguageIds
          ?.map((lang) => lang.iso639_1 || lang.iso639_2 || lang.iso639_3)
          .filter(Boolean) || [],
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      lastActive: user.lastActive,
    };
  }
}
