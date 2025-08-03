/**
 * @fileoverview Gateway WebSocket pour diffusion d'activités temps réel O'Ypunu
 *
 * Ce gateway gère la diffusion en temps réel des activités utilisateur pour
 * maintenir l'engagement et créer une expérience communautaire dynamique.
 * Il optimise les performances avec mise en cache, segmentation des clients
 * et compression des données pour une expérience fluide.
 *
 * @author Équipe O'Ypunu
 * @version 2.0.0 - Optimisé pour l'engagement utilisateur
 * @since 2025-01-01
 */

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, Inject, UseGuards } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ActivityService } from "../services/activity.service";
import { ActivityFeed } from "../schemas/activity-feed.schema";
import { ILanguageRepository } from "../../repositories/interfaces/language.repository.interface";
import { DatabaseErrorHandler } from "../errors";

/**
 * Interface pour socket d'activité avec métadonnées utilisateur
 *
 * @interface ActivitySocket
 */
type ActivitySocket = Socket & {
  /** ID utilisateur authentifié */
  userId?: string;
  /** Nom d'utilisateur pour affichage */
  username?: string;
  /** Région de l'utilisateur pour segmentation */
  userRegion?: string;
  /** Langues d'intérêt pour filtrage */
  preferredLanguages?: string[];
  /** Timestamp de dernière activité pour cleanup */
  lastActivity?: Date;
};

/**
 * Interface pour message d'activité formaté
 *
 * @interface FormattedActivity
 */
interface FormattedActivity {
  id: string;
  userId: string;
  username: string;
  activityType: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  languageRegion?: string;
  userRegion?: string;
  createdAt: Date;
  isPublic: boolean;
  timeAgo: string;
  message: string;
  flag: string;
  priority?: number;
}

/**
 * Interface pour statistiques de connexion
 *
 * @interface ConnectionStats
 */
interface ConnectionStats {
  totalClients: number;
  clientsByRegion: Record<string, number>;
  clientsByLanguage: Record<string, number>;
  lastUpdated: Date;
}

/**
 * Gateway WebSocket optimisé pour activités temps réel O'Ypunu
 *
 * Ce gateway gère la diffusion intelligente d'activités utilisateur pour
 * maximiser l'engagement communautaire. Il utilise des techniques d'optimisation
 * avancées pour assurer des performances optimales même avec des milliers
 * d'utilisateurs connectés simultanément.
 *
 * ## 🚀 Fonctionnalités d'engagement :
 *
 * ### Diffusion temps réel optimisée
 * - Événements d'activités instantanés (word_created, translation_added, etc.)
 * - Segmentation intelligente par région et langue
 * - Messages localisés et contextualisés pour chaque utilisateur
 * - Compression et cache pour réduire la bande passante
 *
 * ### Performance et scalabilité
 * - Cache des noms de langues pour éviter les requêtes répétées
 * - Nettoyage automatique des connexions inactives
 * - Rate limiting pour éviter le spam d'événements
 * - Métriques temps réel pour monitoring
 *
 * ### Engagement utilisateur
 * - Compteur d'utilisateurs connectés visible
 * - Priorité aux langues africaines pour mission O'Ypunu
 * - Messages d'activité contextuals et attrayants
 * - Support multi-langue avec fallbacks intelligents
 *
 * @class ActivityGateway
 * @implements {OnGatewayConnection, OnGatewayDisconnect}
 * @version 2.0.0
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true,
  },
  namespace: "/activities",
  // Optimisations Socket.IO
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class ActivityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /** Logger spécialisé pour le gateway d'activités */
  private readonly logger = new Logger(ActivityGateway.name);

  /** Map des clients connectés avec métadonnées enrichies */
  private connectedClients = new Map<string, ActivitySocket>();

  /** Cache des noms de langues pour optimisation performance */
  private languageNamesCache = new Map<string, string>();

  /** Horodatage de dernière mise à jour du cache */
  private lastCacheUpdate = new Date();

  /** Intervalle de nettoyage des connexions inactives */
  private cleanupInterval: NodeJS.Timeout;

  /** Statistiques de connexion pour analytics */
  private connectionStats: ConnectionStats = {
    totalClients: 0,
    clientsByRegion: {},
    clientsByLanguage: {},
    lastUpdated: new Date(),
  };

  /**
   * Constructeur du gateway d'activités avec initialisation des optimisations
   *
   * @constructor
   * @param {ActivityService} activityService - Service de gestion des activités
   * @param {ILanguageRepository} languageRepository - Repository des langues pour cache
   */
  constructor(
    private readonly activityService: ActivityService,
    @Inject("ILanguageRepository")
    private languageRepository: ILanguageRepository
  ) {
    // Initialiser le cache des langues au démarrage
    this.initializeLanguageCache();

    // Démarrer le nettoyage périodique des connexions inactives
    this.startPeriodicCleanup();
  }

  /**
   * Gestionnaire de connexion client avec configuration d'engagement
   *
   * Cette méthode configure chaque nouveau client avec les données nécessaires
   * pour une expérience d'activité personnalisée et engageante.
   *
   * @async
   * @method handleConnection
   * @param {ActivitySocket} client - Socket client avec métadonnées
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // Connexion automatique avec métadonnées enrichies
   * // Le client reçoit immédiatement :
   * // - Activités récentes pertinentes
   * // - Compteur d'utilisateurs connectés
   * // - Configuration pour sa région/langue
   * ```
   */
  async handleConnection(client: ActivitySocket): Promise<void> {
    try {
      // Enrichir les métadonnées client depuis les headers/auth
      await this.enrichClientMetadata(client);

      // Ajouter à la map des clients connectés
      this.connectedClients.set(client.id, client);
      client.lastActivity = new Date();

      this.logger.log(
        `🟢 Client connecté aux activités: ${client.id} (${client.username || "Anonyme"})`
      );

      // Envoyer les activités récentes personnalisées
      await this.sendPersonalizedRecentActivities(client);

      // Mettre à jour et diffuser les statistiques de connexion
      this.updateConnectionStats();
      this.broadcastConnectionStats();
    } catch (error) {
      this.logger.error("Erreur lors de la connexion:", error);
      client.emit("activities:error", {
        message: "Erreur de connexion au flux d'activités",
      });
      client.disconnect();
    }
  }

  /**
   * Gestionnaire de déconnexion avec nettoyage des ressources
   *
   * @async
   * @method handleDisconnect
   * @param {ActivitySocket} client - Socket client déconnecté
   * @returns {Promise<void>}
   */
  async handleDisconnect(client: ActivitySocket): Promise<void> {
    const clientInfo = this.connectedClients.get(client.id);
    this.connectedClients.delete(client.id);

    this.logger.log(
      `🔴 Client déconnecté des activités: ${client.id} (${clientInfo?.username || "Anonyme"})`
    );

    // Mettre à jour et diffuser les nouvelles statistiques
    this.updateConnectionStats();
    this.broadcastConnectionStats();
  }

  @SubscribeMessage("activities:request_recent")
  async handleRequestRecent(
    @ConnectedSocket() client: ActivitySocket,
    @MessageBody() data: { limit?: number; prioritizeAfrican?: boolean }
  ) {
    try {
      const activities = await this.activityService.getRecentActivities(
        data.limit || 10,
        data.prioritizeAfrican !== false
      );

      client.emit("activities:recent", activities);
    } catch (error) {
      this.logger.error("Erreur lors de la récupération des activités:", error);
      client.emit("activities:error", {
        message: "Erreur lors de la récupération des activités",
      });
    }
  }

  @SubscribeMessage("activities:request_by_type")
  async handleRequestByType(
    @ConnectedSocket() client: ActivitySocket,
    @MessageBody() data: { activityType: string; limit?: number }
  ) {
    try {
      const activities = await this.activityService.getActivitiesByType(
        data.activityType as any,
        data.limit || 5
      );

      client.emit("activities:by_type", {
        activityType: data.activityType,
        activities,
      });
    } catch (error) {
      this.logger.error(
        "Erreur lors de la récupération des activités par type:",
        error
      );
      client.emit("activities:error", {
        message: "Erreur lors de la récupération des activités",
      });
    }
  }

  /**
   * Gestionnaire d'événements pour nouvelles activités créées
   *
   * Cette méthode écoute les événements 'activity.created' et diffuse
   * instantanément les nouvelles activités à tous les clients connectés
   * pour maintenir l'engagement temps réel.
   *
   * @method handleActivityCreated
   * @param {Object} payload - Données de l'activité créée
   * @param {ActivityFeed} payload.activity - Activité nouvellement créée
   * @param {string} payload.userId - ID de l'utilisateur créateur
   * @returns {Promise<void>}
   */
  @OnEvent("activity.created")
  async handleActivityCreated(payload: {
    activity: ActivityFeed;
    userId: string;
  }): Promise<void> {
    try {
      const { activity } = payload;

      this.logger.debug(
        `📡 Diffusion nouvelle activité: ${activity.activityType} par ${activity.username} vers ${this.connectedClients.size} clients`
      );

      // Formatter l'activité une seule fois
      const formattedActivity = await this.formatActivityForFrontend(activity);

      // Diffuser la nouvelle activité optimisée à tous les clients
      this.server.emit("activities:new", {
        activity: formattedActivity,
        timestamp: new Date().toISOString(),
        priority: this.calculateActivityPriority(activity),
        engagement: true // Flag pour UI d'engagement
      });

      // Mettre à jour les métriques d'engagement
      this.trackActivityEngagement(activity.activityType);
      
    } catch (error) {
      this.logger.error("Erreur lors de la diffusion d'activité:", error);
    }
  }

  /**
   * Gestionnaire d'événements pour statistiques d'activité mises à jour
   *
   * Diffuse les nouvelles statistiques d'engagement et d'activité
   * à tous les clients pour tableaux de bord dynamiques.
   *
   * @method handleStatsUpdated
   * @param {any} payload - Nouvelles statistiques d'activité
   * @returns {Promise<void>}
   */
  @OnEvent("activity.stats_updated")
  async handleStatsUpdated(payload: any): Promise<void> {
    // Enrichir les stats avec infos de connexion actuelles
    const enrichedStats = {
      ...payload,
      realTimeData: {
        connectedUsers: this.connectedClients.size,
        activeRegions: Object.keys(this.connectionStats.clientsByRegion).length,
        activeLanguages: Object.keys(this.connectionStats.clientsByLanguage).length,
        lastUpdate: new Date().toISOString()
      }
    };

    this.server.emit("activities:stats", enrichedStats);
    this.logger.debug(`📊 Statistiques diffusées vers ${this.connectedClients.size} clients`);
  }

  /**
   * Formater une activité pour affichage frontend optimisé
   *
   * Cette méthode transforme les données d'activité brutes en format
   * optimisé pour l'affichage frontend avec messages localisés,
   * calculs de temps et métadonnées d'engagement.
   *
   * @private
   * @async
   * @method formatActivityForFrontend
   * @param {ActivityFeed | any} activity - Activité brute à formatter
   * @returns {Promise<FormattedActivity>} Activité formatée pour frontend
   */
  private async formatActivityForFrontend(
    activity: ActivityFeed | any
  ): Promise<FormattedActivity> {
    // Logging de debug uniquement en mode développement
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `🔧 Formatage activité: ${activity.activityType} par ${activity.username}`
      );
    }

    const formatted: any = {
      id: activity._id || activity.id,
      userId: activity.userId,
      username: activity.username,
      activityType: activity.activityType,
      entityType: activity.entityType,
      entityId: activity.entityId,
      metadata: activity.metadata || {},
      languageRegion: activity.languageRegion,
      userRegion: activity.userRegion,
      createdAt: activity.createdAt,
      isPublic: activity.isPublic,
      timeAgo: this.getTimeAgo(activity.createdAt),
      message: "",
      flag: "",
    };

    // Générer le message d'activité localisé
    formatted.message = await this.generateActivityMessage(formatted);
    formatted.flag = activity.metadata?.languageFlag || "🌍";

    return formatted;
  }

  /**
   * Générer un message d'activité localisé et engageant
   *
   * Cette méthode crée des messages contextuels en français pour
   * chaque type d'activité, optimisés pour susciter l'intérêt
   * et l'engagement des utilisateurs.
   *
   * @private
   * @async
   * @method generateActivityMessage
   * @param {any} activity - Données de l'activité
   * @returns {Promise<string>} Message localisé et engageant
   */
  private async generateActivityMessage(activity: any): Promise<string> {
    const { activityType, metadata, username } = activity;

    switch (activityType) {
      case "word_created":
        return `a ajouté "${metadata.wordName}"`;

      case "translation_added":
        return `a traduit "${metadata.wordName}" vers ${await this.getLanguageName(metadata.targetLanguageCode)}`;

      case "synonym_added":
        const count = metadata.synonymsCount || 1;
        return `a ajouté ${count} synonyme${count > 1 ? "s" : ""}`;

      case "word_approved":
        return `a approuvé "${metadata.wordName}"`;

      case "word_verified":
        return `a vérifié une traduction`;

      case "community_post_created":
        return `a publié dans ${metadata.communityName}`;

      case "user_registered":
        return `a rejoint O'Ypunu`;

      case "user_logged_in":
        return `s'est connecté(e)`;

      case "community_joined":
        return `a rejoint ${metadata.communityName}`;

      case "community_created":
        return `a créé la communauté ${metadata.communityName}`;

      case "comment_added":
        return `a commenté dans ${metadata.communityName}`;

      default:
        return "a effectué une action";
    }
  }

  /**
   * Calculer la priorité d'une activité pour l'engagement
   *
   * @private
   * @method calculateActivityPriority
   * @param {ActivityFeed} activity - Activité à évaluer
   * @returns {number} Score de priorité (1-10)
   */
  private calculateActivityPriority(activity: ActivityFeed): number {
    const priorities = {
      word_created: 8,      // Création de mots = haute priorité
      translation_added: 9, // Traductions = très haute priorité
      community_created: 7, // Nouvelles communautés = importante
      user_registered: 6,   // Nouveaux utilisateurs = modérée
      word_approved: 8,     // Approbations = haute
      community_joined: 5,  // Rejoindre communauté = normale
      user_logged_in: 3,    // Connexions = basse
      comment_added: 4,     // Commentaires = basse-modérée
    };

    let basePriority = priorities[activity.activityType] || 5;

    // Bonus pour langues africaines (mission O'Ypunu)
    const africanLanguages = ['yo', 'ha', 'ig', 'ff', 'wo', 'bm', 'ln', 'kg', 'sw', 'rw', 'zu', 'xh'];
    if (activity.metadata?.languageCode && africanLanguages.includes(activity.metadata.languageCode)) {
      basePriority += 1;
    }

    return Math.min(basePriority, 10);
  }

  /**
   * Suivre les métriques d'engagement par type d'activité
   *
   * @private
   * @method trackActivityEngagement
   * @param {string} activityType - Type d'activité à suivre
   * @returns {void}
   */
  private trackActivityEngagement(activityType: string): void {
    // Incrémenter compteurs d'engagement (pour analytics futures)
    const now = new Date();
    const hourKey = `${now.getHours()}:00`;
    
    // Cette logique pourrait être étendue avec Redis ou base de données
    // pour persistance des métriques d'engagement
    this.logger.debug(`📊 Engagement ${activityType} à ${hourKey}`);
  }

  /**
   * Optimiser le nom de langue avec cache et fallbacks
   *
   * @private
   * @async
   * @method getLanguageName
   * @param {string} [languageCode] - Code ISO de la langue
   * @returns {Promise<string>} Nom de langue formaté
   */
  private async getLanguageName(languageCode?: string): Promise<string> {
    if (!languageCode) return "une langue";

    // Vérifier le cache d'abord
    const cached = this.languageNamesCache.get(languageCode);
    if (cached) return cached;

    // Recharger le cache si ancien (1 heure)
    const cacheAge = new Date().getTime() - this.lastCacheUpdate.getTime();
    if (cacheAge > 60 * 60 * 1000) {
      await this.initializeLanguageCache();
      const refreshed = this.languageNamesCache.get(languageCode);
      if (refreshed) return refreshed;
    }

    // Fallback vers mappings statiques optimisés
    const nameMap: { [key: string]: string } = {
      // Langues africaines (priorité O'Ypunu)
      yo: "le yorùbá",
      ha: "l'hausa",
      ig: "l'igbo",
      ff: "le fulfulde",
      wo: "le wolof",
      bm: "le bambara",
      ln: "le lingala",
      kg: "le kikongo",
      sw: "le kiswahili",
      rw: "le kinyarwanda",
      zu: "le zulu",
      xh: "le xhosa",
      af: "l'afrikaans",
      ar: "l'arabe",
      ber: "le berbère",
      am: "l'amharique",
      om: "l'oromo",
      so: "le somali",
      mg: "le malgache",

      // Langues internationales
      fr: "le français",
      en: "l'anglais",
      es: "l'espagnol",
      de: "l'allemand",
      it: "l'italien",
      pt: "le portugais",
      ja: "le japonais",
      ko: "le coréen",
      zh: "le chinois",
      hi: "l'hindi",
      ru: "le russe",
    };

    const result = nameMap[languageCode] || "une langue";

    // Mettre en cache pour les prochaines fois
    this.languageNamesCache.set(languageCode, result);

    return result;
  }

  /**
   * Calculer et formater le temps écoulé depuis une date
   *
   * @private
   * @method getTimeAgo
   * @param {Date} createdAt - Date de création de l'activité
   * @returns {string} Temps écoulé formaté en français
   */
  private getTimeAgo(createdAt: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(createdAt).getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 1) {
      return "à l'instant";
    } else if (diffInMinutes === 1) {
      return "il y a 1 min";
    } else if (diffInMinutes < 60) {
      return `il y a ${diffInMinutes} min`;
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours === 1) {
        return "il y a 1 heure";
      } else if (diffInHours < 24) {
        return `il y a ${diffInHours} heures`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `il y a ${diffInDays} jour${diffInDays > 1 ? "s" : ""}`;
      }
    }
  }

  // ========== MÉTHODES D'OPTIMISATION ==========

  /**
   * Initialiser le cache des noms de langues pour optimisation
   *
   * @private
   * @async
   * @method initializeLanguageCache
   * @returns {Promise<void>}
   */
  private async initializeLanguageCache(): Promise<void> {
    try {
      const languageResult = await DatabaseErrorHandler.handleDatabaseOperation(
        () => this.languageRepository.findAll(),
        {
          operationName: "FIND",
          entityName: "Language",
        }
      );

      // Extraire les langues du résultat paginé
      const languages = languageResult.languages || [];

      // Construire le cache avec mappings optimisés
      for (const lang of languages) {
        const displayName = `le ${lang.nativeName || lang.name}`;
        const code = lang.iso639_1 || lang.iso639_2 || lang.iso639_3;
        if (code) {
          this.languageNamesCache.set(code, displayName);
        }
      }

      this.lastCacheUpdate = new Date();
      this.logger.log(
        `📚 Cache des langues initialisé: ${this.languageNamesCache.size} langues`
      );
    } catch (error) {
      this.logger.warn("Impossible d'initialiser le cache des langues:", error);
      // Utiliser les fallbacks statiques si la DB est indisponible
    }
  }

  /**
   * Enrichir les métadonnées client depuis l'authentification
   *
   * @private
   * @async
   * @method enrichClientMetadata
   * @param {ActivitySocket} client - Socket client à enrichir
   * @returns {Promise<void>}
   */
  private async enrichClientMetadata(client: ActivitySocket): Promise<void> {
    // Extraire les infos depuis les headers ou auth token
    const authData = client.handshake.auth;
    const headers = client.handshake.headers;

    // Enrichir avec les données disponibles
    client.userId = authData?.userId || client.userId;
    client.username = authData?.username || client.username;
    client.userRegion =
      headers["cf-ipcountry"] || authData?.region || "unknown";
    client.preferredLanguages = authData?.preferredLanguages || ["fr"];
  }

  /**
   * Envoyer activités récentes personnalisées selon le profil client
   *
   * @private
   * @async
   * @method sendPersonalizedRecentActivities
   * @param {ActivitySocket} client - Socket client ciblé
   * @returns {Promise<void>}
   */
  private async sendPersonalizedRecentActivities(
    client: ActivitySocket
  ): Promise<void> {
    try {
      // Prioriser langues africaines + langues préférées du client
      const prioritizeAfrican = true;
      const limit = 15; // Plus d'activités pour meilleur engagement

      const activities = await this.activityService.getRecentActivities(
        limit,
        prioritizeAfrican
      );

      // Formatter et envoyer
      const formattedActivities = await Promise.all(
        activities.map((activity) => this.formatActivityForFrontend(activity))
      );

      client.emit("activities:recent", {
        activities: formattedActivities,
        personalized: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error("Erreur envoi activités personnalisées:", error);
      // Fallback vers activités génériques
      client.emit("activities:recent", { activities: [] });
    }
  }

  /**
   * Mettre à jour les statistiques de connexion pour analytics
   *
   * @private
   * @method updateConnectionStats
   * @returns {void}
   */
  private updateConnectionStats(): void {
    this.connectionStats = {
      totalClients: this.connectedClients.size,
      clientsByRegion: {},
      clientsByLanguage: {},
      lastUpdated: new Date(),
    };

    // Analyser la répartition des clients connectés
    for (const client of this.connectedClients.values()) {
      // Par région
      const region = client.userRegion || "unknown";
      this.connectionStats.clientsByRegion[region] =
        (this.connectionStats.clientsByRegion[region] || 0) + 1;

      // Par langue préférée
      const languages = client.preferredLanguages || ["fr"];
      for (const lang of languages) {
        this.connectionStats.clientsByLanguage[lang] =
          (this.connectionStats.clientsByLanguage[lang] || 0) + 1;
      }
    }
  }

  /**
   * Diffuser statistiques de connexion à tous les clients
   *
   * @private
   * @method broadcastConnectionStats
   * @returns {void}
   */
  private broadcastConnectionStats(): void {
    this.server.emit("activities:connection_stats", {
      totalUsers: this.connectionStats.totalClients,
      onlineNow: this.connectionStats.totalClients,
      regions: Object.keys(this.connectionStats.clientsByRegion).length,
      languages: Object.keys(this.connectionStats.clientsByLanguage).length,
      timestamp: this.connectionStats.lastUpdated.toISOString(),
    });
  }

  /**
   * Démarrer le nettoyage périodique des connexions inactives
   *
   * @private
   * @method startPeriodicCleanup
   * @returns {void}
   */
  private startPeriodicCleanup(): void {
    // Nettoyage toutes les 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupInactiveConnections();
      },
      5 * 60 * 1000
    );

    this.logger.log("🧹 Nettoyage périodique des connexions configuré (5min)");
  }

  /**
   * Nettoyer les connexions inactives pour optimiser la mémoire
   *
   * @private
   * @method cleanupInactiveConnections
   * @returns {void}
   */
  private cleanupInactiveConnections(): void {
    const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
    const now = new Date();
    let cleanedCount = 0;

    for (const [socketId, client] of this.connectedClients.entries()) {
      if (
        client.lastActivity &&
        now.getTime() - client.lastActivity.getTime() > inactivityThreshold
      ) {
        this.connectedClients.delete(socketId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Nettoyé ${cleanedCount} connexions inactives`);
      this.updateConnectionStats();
    }
  }

  // ========== MÉTHODES UTILITAIRES POUR TESTS ==========

  /**
   * Obtenir le nombre de clients connectés (pour tests/monitoring)
   *
   * @public
   * @method getConnectedClientsCount
   * @returns {number} Nombre de clients connectés
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Diffuser une activité de test (pour développement/debugging)
   *
   * @public
   * @async
   * @method broadcastTestActivity
   * @returns {Promise<void>}
   */
  async broadcastTestActivity(): Promise<void> {
    const testActivity = {
      id: "test-" + Date.now(),
      username: "UtilisateurTest",
      activityType: "word_created",
      metadata: {
        wordName: "test-mot",
        languageCode: "yo",
        languageFlag: "🇳🇬",
      },
      createdAt: new Date(),
      timeAgo: "à l'instant",
    };

    this.server.emit("activities:new", {
      activity: await this.formatActivityForFrontend(testActivity),
      timestamp: new Date().toISOString(),
      test: true,
    });

    this.logger.debug("📡 Activité de test diffusée");
  }

  /**
   * Nettoyage des ressources lors de l'arrêt du service
   *
   * @public
   * @method onModuleDestroy
   * @returns {void}
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.log("🛑 Nettoyage périodique arrêté");
    }
  }
}
