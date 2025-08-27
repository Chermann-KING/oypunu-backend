/**
 * @fileoverview Service de gestion des utilisateurs O'Ypunu
 * 
 * Ce service implémente toute la logique métier pour la gestion des utilisateurs :
 * profils complets, authentification, gestion des favoris, préférences linguistiques
 * et tracking d'activité pour l'expérience personnalisée.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Inject } from "@nestjs/common";
import { User } from "../schemas/user.schema";
import { DatabaseErrorHandler } from "../../common/errors"
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { IActivityFeedRepository } from "../../repositories/interfaces/activity-feed.repository.interface";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IFavoriteWordRepository } from "../../repositories/interfaces/favorite-word.repository.interface";

/**
 * Service de gestion des utilisateurs O'Ypunu
 * 
 * Implémente la logique métier complète pour la gestion des utilisateurs
 * avec profils enrichis, gestion des préférences linguistiques, système
 * de favoris et tracking d'activité pour personnalisation avancée.
 * 
 * ## 🎯 Fonctionnalités principales :
 * 
 * ### 👤 Gestion des profils utilisateur
 * - **CRUD complet** : Création, lecture, mise à jour, suppression
 * - **Authentification** : Recherche par email, nom d'utilisateur, ID
 * - **Profils enrichis** : Informations personnelles et préférences
 * - **Validation des données** : Contrôles de cohérence et sécurité
 * 
 * ### 🌍 Préférences linguistiques
 * - **Langues natives** : Gestion de la langue maternelle
 * - **Apprentissage** : Liste des langues en cours d'étude
 * - **Personnalisation** : Adaptation de l'interface utilisateur
 * 
 * ### ⭐ Système de favoris
 * - **Mots favoris** : Gestion de la liste personnalisée
 * - **Ajout/suppression** : Opérations atomiques sécurisées
 * - **Synchronisation** : Cohérence avec les données du dictionnaire
 * 
 * ### 📊 Tracking d'activité
 * - **Historique complet** : Actions utilisateur pour analytics
 * - **Métriques d'engagement** : Statistiques d'usage personnel
 * - **Recommandations** : Base pour suggestions personnalisées
 * 
 * ## 🔄 Pattern Repository
 * - **Abstraction des données** : Interface découplée de la DB
 * - **Gestion d'erreurs** : Handling centralisé avec DatabaseErrorHandler
 * - **Performance optimisée** : Requêtes optimisées et mise en cache
 * 
 * @class UsersService
 * @version 1.0.0
 */
@Injectable()
export class UsersService {
  /**
   * Constructeur avec injection des repositories
   * 
   * @param {IUserRepository} userRepository - Repository des utilisateurs
   * @param {IActivityFeedRepository} activityFeedRepository - Repository d'activité
   * @param {IWordRepository} wordRepository - Repository des mots
   */
  constructor(
    @Inject("IUserRepository") private userRepository: IUserRepository,
    @Inject("IActivityFeedRepository")
    private activityFeedRepository: IActivityFeedRepository,
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @Inject("IFavoriteWordRepository") private favoriteWordRepository: IFavoriteWordRepository
  ) {}

  /**
   * Recherche un utilisateur par son identifiant unique
   * 
   * @method findById
   * @param {string} id - Identifiant unique de l'utilisateur
   * @returns {Promise<User | null>} Utilisateur trouvé ou null si inexistant
   * @throws {NotFoundException} Si utilisateur non trouvé
   * @throws {DatabaseException} Si erreur de base de données
   * 
   * @example
   * const user = await usersService.findById('60a1b2c3d4e5f6a7b8c9d0e1');
   * if (user) { console.log(`Utilisateur: ${user.username}`); }
   */
  async findById(id: string): Promise<User | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.userRepository.findById(id);
      },
      "User",
      id
    );
  }

  /**
   * Recherche un utilisateur avec ses préférences linguistiques populées
   * 
   * @method findByIdWithLanguages
   * @param {string} id - Identifiant unique de l'utilisateur
   * @returns {Promise<User | null>} Utilisateur avec langues populées ou null
   * @throws {NotFoundException} Si utilisateur non trouvé
   * @throws {DatabaseException} Si erreur de base de données
   * 
   * @example
   * const user = await usersService.findByIdWithLanguages('60a1b2c3d4e5f6a7b8c9d0e1');
   * console.log(`Langue native: ${user?.nativeLanguageId?.name}`);
   */
  async findByIdWithLanguages(id: string): Promise<User | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Note: Population will be handled in repository layer if needed
        return this.userRepository.findById(id);
      },
      "User",
      id
    );
  }

  /**
   * Recherche un utilisateur par son adresse email
   * 
   * Méthode principalement utilisée pour l'authentification et la
   * vérification d'unicité lors de l'inscription.
   * 
   * @method findByEmail
   * @param {string} email - Adresse email de l'utilisateur
   * @returns {Promise<User | null>} Utilisateur trouvé ou null si inexistant
   * @throws {DatabaseException} Si erreur de base de données
   * 
   * @example
   * const user = await usersService.findByEmail('user@example.com');
   * if (user && user.isEmailVerified) { // Authentification... }
   */
  async findByEmail(email: string): Promise<User | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.userRepository.findByEmail(email);
      },
      "User",
      email
    );
  }

  async findByUsername(username: string): Promise<User | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.userRepository.findByUsername(username);
      },
      "User",
      username
    );
  }

  async updateUser(
    id: string,
    updateData: Partial<User>
  ): Promise<User | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return this.userRepository.update(id, updateData);
      },
      "User",
      id
    );
  }

  async searchUsers(query: string, excludeUserId?: string): Promise<User[]> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      console.log("[UsersService] Recherche d'utilisateurs");
      console.log("[UsersService] Requête:", query);
      console.log("[UsersService] Utilisateur à exclure:", excludeUserId);

      const searchRegex = new RegExp(query, "i"); // Recherche insensible à la casse
      console.log("[UsersService] Regex de recherche:", searchRegex);

      const filter: any = {
        $or: [
          { username: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
        ],
      };

      // Exclure l'utilisateur connecté des résultats
      if (excludeUserId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        filter._id = { $ne: excludeUserId };
      }

      console.log(
        "[UsersService] Filtre de recherche:",
        JSON.stringify(filter, null, 2)
      );

      const users = await this.userRepository.search(query, {
        limit: 10,
        offset: excludeUserId ? 0 : undefined,
      });

      // Filter out excluded user if needed
      const filteredUsers = excludeUserId
        ? users.filter((user) => (user as any)._id.toString() !== excludeUserId)
        : users;

      console.log("[UsersService] Utilisateurs trouvés en base:", users.length);
      console.log(
        "[UsersService] Premier utilisateur (si existe):",
        users[0]
          ? {
              id: users[0]._id,
              username: users[0].username,
              email: users[0].email,
            }
          : "Aucun"
      );

      return filteredUsers;
    }, "User");
  }

  async getUserStats(userId: string): Promise<{
    totalWordsAdded: number;
    totalCommunityPosts: number;
    favoriteWordsCount: number;
    joinDate: Date;
    streak: number;
    languagesContributed: number;
    languagesExplored: number;
    contributionScore: number;
    activitiesThisWeek: number;
    lastActivityDate?: Date;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("Utilisateur non trouvé");
      }

      // Utiliser notre nouvelle méthode intelligente
      const personalStats = await this.getUserPersonalStats(userId);

      // Compter les vrais favoris de l'utilisateur
      const actualFavoritesCount = await this.favoriteWordRepository.countUserFavorites(userId);

      return {
        totalWordsAdded: personalStats.wordsAdded, // Utiliser le comptage réel
        totalCommunityPosts: user.totalCommunityPosts || 0,
        favoriteWordsCount: actualFavoritesCount,
        joinDate:
          (user as unknown as { createdAt?: Date }).createdAt || new Date(),
        // Nouvelles stats intelligentes
        streak: personalStats.streak,
        languagesContributed: personalStats.languagesContributed, // NOUVELLE MÉTRIQUE
        languagesExplored: personalStats.languagesExplored,
        contributionScore: personalStats.contributionScore,
        activitiesThisWeek: personalStats.activitiesThisWeek,
        lastActivityDate: personalStats.lastActivityDate,
      };
    }, "User");
  }

  async incrementWordCount(userId: string): Promise<void> {
    await this.userRepository.incrementWordCount(userId);
  }

  async incrementPostCount(userId: string): Promise<void> {
    // Note: Community posts increment should be in UserRepository
    // For now using update method
    await this.userRepository.update(userId, {
      totalCommunityPosts:
        (await this.userRepository.findById(userId))?.totalCommunityPosts + 1 ||
        1,
    });
  }

  async updateLastActive(userId: string): Promise<void> {
    await this.userRepository.updateLastActive(userId);
  }

  async findAll(): Promise<User[]> {
    const result = await this.userRepository.findAll();
    return result.users;
  }

  async activateSuperAdmins(): Promise<number> {
    // Note: This bulk operation should be implemented in UserRepository
    // For now, getting users and updating individually
    const adminUsers = await this.userRepository.findAll({
      role: "admin",
    });
    const superAdminUsers = await this.userRepository.findAll({
      role: "superadmin",
    });
    const contributorUsers = await this.userRepository.findAll({
      role: "contributor",
    });

    const allElevatedUsers = [
      ...adminUsers.users,
      ...superAdminUsers.users,
      ...contributorUsers.users,
    ];
    let modifiedCount = 0;

    for (const user of allElevatedUsers) {
      if (!user.isActive) {
        await this.userRepository.update((user as any)._id, { isActive: true });
        modifiedCount++;
      }
    }

    const result = { modifiedCount };

    console.log(
      "🔧 Activation des utilisateurs avec rôles élevés:",
      result.modifiedCount
    );
    return modifiedCount;
  }

  async getActiveUsersCount(): Promise<number> {
    // Utilisateurs actifs dans les 5 dernières minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Note: Active users count should be implemented in UserRepository
    // For now using findActiveUsers and counting
    const activeUsers = await this.userRepository.findActiveUsers(0.003); // ~5 minutes in days
    return activeUsers.length;
  }

  async getOnlineContributorsCount(): Promise<number> {
    // Contributeurs en ligne = utilisateurs actifs qui SOIT :
    // 1. Ont ajouté au moins un mot OU
    // 2. Ont un rôle contributor, admin ou superadmin
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    console.log("🔍 Recherche des contributeurs en ligne...");
    console.log("⏰ Seuil de temps (5 min ago):", fiveMinutesAgo.toISOString());

    // Note: Complex query should be in UserRepository
    // For now, getting active users and filtering
    const activeUsers = await this.userRepository.findActiveUsers(0.003);
    const onlineContributors = activeUsers.filter(
      (user) =>
        (user.totalWordsAdded && user.totalWordsAdded > 0) ||
        ["contributor", "admin", "superadmin"].includes(user.role)
    );
    const count = onlineContributors.length;

    console.log("📊 Contributeurs en ligne trouvés:", count);

    // Debug: afficher les utilisateurs qui matchent
    const users = onlineContributors;

    console.log(
      "👥 Utilisateurs actifs détaillés:",
      users.map((u) => ({
        username: u.username,
        role: u.role,
        totalWords: u.totalWordsAdded,
        lastActive: u.lastActive,
        isActive: u.isActive,
      }))
    );

    return count;
  }

  /**
   * Calcule le nombre de jours consécutifs d'activité pour un utilisateur
   * Basé sur les activités réelles enregistrées dans la base de données
   */
  async getUserActivityStreak(userId: string): Promise<number> {
    try {
      // Récupérer toutes les activités de l'utilisateur triées par date décroissante
      const activities = await this.activityFeedRepository.getUserActivities(
        userId,
        {
          sortBy: "createdAt",
          sortOrder: "desc",
          limit: 1000, // Large limit for streak calculation
        }
      );

      if (activities.length === 0) {
        return 0;
      }

      // Organiser les activités par jour
      const activitiesByDay = new Map<string, boolean>();

      activities.forEach((activity) => {
        const date = new Date(activity.createdAt);
        const dayKey = date.toISOString().split("T")[0]; // Format YYYY-MM-DD
        activitiesByDay.set(dayKey, true);
      });

      // Calculer la séquence consécutive à partir d'aujourd'hui
      let streakCount = 0;
      const today = new Date();
      const currentDate = new Date(today);

      // Commencer par aujourd'hui et remonter dans le temps
      while (true) {
        const dayKey = currentDate.toISOString().split("T")[0];

        if (activitiesByDay.has(dayKey)) {
          streakCount++;
          // Passer au jour précédent
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          // La séquence est rompue
          break;
        }
      }

      console.log(
        `📊 Streak calculé pour ${userId}: ${streakCount} jours consécutifs`
      );
      return streakCount;
    } catch (error) {
      console.error("❌ Erreur lors du calcul du streak:", error);
      return 0;
    }
  }

  /**
   * Obtient les statistiques personnelles complètes d'un utilisateur
   */
  async getUserPersonalStats(userId: string): Promise<{
    wordsAdded: number;
    favoritesCount: number;
    languagesContributed: number;
    languagesExplored: number;
    contributionScore: number;
    streak: number;
    lastActivityDate?: Date;
    activitiesThisWeek: number;
  }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("Utilisateur non trouvé");
      }

      // Calculer le streak de manière intelligente
      const streak = await this.getUserActivityStreak(userId);

      // Compter les mots RÉELLEMENT présents en base de données créés par cet utilisateur et approuvés
      const actualWordsAdded =
        await this.wordRepository.countByCreatorAndStatus(userId, "approved");

      console.log(
        `📊 Mots réels pour ${userId}: ${actualWordsAdded} (vs compteur: ${user.totalWordsAdded})`
      );

      // Compter les activités de cette semaine
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weeklyActivities =
        await this.activityFeedRepository.getActivitiesByPeriod(userId, "week");
      const activitiesThisWeek = Array.isArray(weeklyActivities)
        ? weeklyActivities.length
        : 0;

      // Obtenir la dernière activité
      const recentActivities =
        await this.activityFeedRepository.getUserActivities(userId, {
          sortBy: "createdAt",
          sortOrder: "desc",
          limit: 1,
        });
      const lastActivity = recentActivities[0] || null;

      // === LANGUES CONTRIBUÉES (Option A) ===
      // Langues où l'utilisateur a activement contribué (créé des mots, ajouté des traductions)
      const contributionActivities =
        await this.activityFeedRepository.getDistinctLanguagesByUser(userId, {
          activityTypes: ["word_created", "translation_added", "synonym_added"],
        });

      // === LANGUES EXPLORÉES (Option B) ===
      // Toutes les langues avec lesquelles l'utilisateur a interagi
      const [allActivityLanguages, wordsLanguages, communityLanguages] =
        await Promise.all([
          // 1. Langues des activités de l'utilisateur
          this.activityFeedRepository.getDistinctLanguagesByUser(userId),

          // 2. Langues des mots créés par l'utilisateur
          this.wordRepository.getDistinctLanguagesByCreator(userId),

          // 3. TODO: Langues des communautés rejointes (à implémenter avec CommunityMember)
          Promise.resolve([]),
        ]);

      // Combiner toutes les langues uniques
      const allExploredLanguages = new Set([
        ...(allActivityLanguages || []),
        ...(wordsLanguages || []),
        ...(communityLanguages || []),
      ]);

      // Compter les vrais favoris de l'utilisateur
      // Note: Should be implemented in FavoriteWordRepository
      const actualFavoritesCount = 0; // Placeholder

      const stats = {
        wordsAdded: actualWordsAdded,
        favoritesCount: actualFavoritesCount,
        languagesContributed: (contributionActivities || []).length, // NOUVELLE MÉTRIQUE
        languagesExplored: allExploredLanguages.size, // MÉTRIQUE ÉLARGIE
        contributionScore: actualWordsAdded * 10 + activitiesThisWeek * 5,
        streak,
        lastActivityDate: lastActivity?.createdAt,
        activitiesThisWeek,
      };

      console.log(`📈 Stats personnelles pour ${user.username}:`, stats);
      return stats;
    } catch (error) {
      console.error("❌ Erreur lors du calcul des stats personnelles:", error);
      return {
        wordsAdded: 0,
        favoritesCount: 0,
        languagesContributed: 0,
        languagesExplored: 0,
        contributionScore: 0,
        streak: 0,
        activitiesThisWeek: 0,
      };
    }
  }

  /**
   * Récupère les mots récemment créés par l'utilisateur
   */
  async getUserRecentContributions(
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    try {
      const recentWords = await this.wordRepository.findByCreator(userId, {
        status: "approved",
        limit,
      });

      return (recentWords || []).map((word) => ({
        id: (word as any)._id,
        word: word.word,
        language: word.language,
        definition:
          word.meanings?.[0]?.definitions?.[0]?.definition ||
          "Définition non disponible",
        createdAt: word.createdAt,
        isOwner: true, // Toujours true puisque c'est ses mots
      }));
    } catch (error) {
      console.error(
        "❌ Erreur lors de la récupération des contributions récentes:",
        error
      );
      return [];
    }
  }

  /**
   * Récupère les mots récemment consultés par l'utilisateur
   */
  async getUserRecentConsultations(
    userId: string,
    limit: number = 5
  ): Promise<any[]> {
    try {
      console.log("🔍 Recherche consultations pour utilisateur:", userId);

      // Note: WordView should also be moved to repository pattern
      // For now, returning empty array as placeholder
      // TODO: Implement WordViewRepository
      const recentConsultations: any[] = [];

      console.log("📊 Consultations trouvées:", recentConsultations.length);
      console.log(
        "📋 Détails consultations:",
        recentConsultations.map((c) => ({
          wordId: c.wordId ? (c.wordId as any)._id : "null",
          word: c.wordId ? (c.wordId as any).word : "null",
          status: c.wordId ? (c.wordId as any).status : "null",
          lastViewedAt: c.lastViewedAt,
        }))
      );

      const filteredConsultations = recentConsultations.filter(
        (consultation) =>
          consultation.wordId && consultation.wordId.status === "approved"
      );

      console.log(
        "✅ Consultations après filtrage (approved seulement):",
        filteredConsultations.length
      );

      return filteredConsultations.map((consultation) => {
        const wordData = consultation.wordId as any;
        return {
          id: wordData._id?.toString() || wordData.id?.toString() || "",
          word: wordData.word,
          language: wordData.language,
          definition:
            wordData.meanings?.[0]?.definitions?.[0]?.definition ||
            "Définition non disponible",
          lastViewedAt: consultation.lastViewedAt,
          viewCount: consultation.viewCount,
          viewType: consultation.viewType,
          isOwner: false, // Ce ne sont pas ses mots, mais des consultations
        };
      });
    } catch (error) {
      console.error(
        "❌ Erreur lors de la récupération des consultations récentes:",
        error
      );
      return [];
    }
  }
}
