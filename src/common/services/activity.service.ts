/**
 * @fileoverview Service de tracking d'activité utilisateur pour O'Ypunu
 * 
 * Ce service centralise le suivi et l'enregistrement de toutes les activités
 * utilisateur sur la plateforme. Il enrichit automatiquement les données
 * avec des informations contextuelles (langues, régions, métadonnées)
 * et émet des événements pour les notifications temps réel.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Inject } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ActivityType, EntityType } from "../schemas/activity-feed.schema";
import {
  IActivityFeedRepository,
  ActivityFeed,
} from "../../repositories/interfaces/activity-feed.repository.interface";
import { ILanguageRepository } from "../../repositories/interfaces/language.repository.interface";

/**
 * Interface pour la création d'une nouvelle activité
 * 
 * @interface CreateActivityData
 */
export interface CreateActivityData {
  /** ID de l'utilisateur effectuant l'action */
  userId: string;
  /** Nom d'utilisateur pour affichage */
  username: string;
  /** Type d'activité (create, update, view, etc.) */
  activityType: ActivityType;
  /** Type d'entité concernée (word, community, user, etc.) */
  entityType: EntityType;
  /** ID de l'entité concernée */
  entityId: string;
  /** Métadonnées spécifiques à l'activité */
  metadata?: {
    /** Nom du mot pour activités liées aux mots */
    wordName?: string;
    /** Code langue source */
    language?: string;
    /** Code langue format standard */
    languageCode?: string;
    /** Nom complet de la langue */
    languageName?: string;
    /** Emoji drapeau de la langue */
    languageFlag?: string;
    /** Mot traduit */
    translatedWord?: string;
    /** Langue cible pour traduction */
    targetLanguage?: string;
    /** Code langue cible */
    targetLanguageCode?: string;
    /** Nombre de synonymes ajoutés */
    synonymsCount?: number;
    /** Titre du post pour activités communautaires */
    postTitle?: string;
    /** Nom de la communauté */
    communityName?: string;
  };
  /** Région de l'utilisateur */
  userRegion?: string;
  /** Région linguistique */
  languageRegion?: string;
  /** Visibilité publique de l'activité */
  isPublic?: boolean;
}

/**
 * Mapping des codes de langues africaines vers informations contextuelles
 * 
 * Cette constante fournit des informations enrichies pour les langues
 * africaines principales, permettant l'affichage de drapeaux, régions
 * et noms natifs dans l'interface utilisateur.
 * 
 * @constant {Record<string, Object>} AFRICAN_LANGUAGES_MAP
 */
const AFRICAN_LANGUAGES_MAP: Record<
  string,
  { region: string; country: string; flag: string; name: string }
> = {
  // Langues principales d'Afrique de l'Ouest
  yo: { region: "africa", country: "NG", flag: "🇳🇬", name: "Yorùbá" }, // Yoruba (Nigeria)
  ha: { region: "africa", country: "NG", flag: "🇳🇬", name: "Hausa" }, // Hausa (Nigeria)
  ig: { region: "africa", country: "NG", flag: "🇳🇬", name: "Igbo" }, // Igbo (Nigeria)
  ff: { region: "africa", country: "SN", flag: "🇸🇳", name: "Fulfulde" }, // Fulfulde (Sénégal)
  wo: { region: "africa", country: "SN", flag: "🇸🇳", name: "Wolof" }, // Wolof (Sénégal)
  bm: { region: "africa", country: "ML", flag: "🇲🇱", name: "Bambara" }, // Bambara (Mali)

  // Langues d'Afrique Centrale
  ln: { region: "africa", country: "CD", flag: "🇨🇩", name: "Lingala" }, // Lingala (RDC)
  kg: { region: "africa", country: "CD", flag: "🇨🇩", name: "Kikongo" }, // Kikongo (RDC)
  sw: { region: "africa", country: "KE", flag: "🇰🇪", name: "Kiswahili" }, // Swahili (Kenya)
  rw: { region: "africa", country: "RW", flag: "🇷🇼", name: "Kinyarwanda" }, // Kinyarwanda (Rwanda)

  // Langues d'Afrique du Sud
  zu: { region: "africa", country: "ZA", flag: "🇿🇦", name: "isiZulu" }, // Zulu (Afrique du Sud)
  xh: { region: "africa", country: "ZA", flag: "🇿🇦", name: "isiXhosa" }, // Xhosa (Afrique du Sud)
  af: { region: "africa", country: "ZA", flag: "🇿🇦", name: "Afrikaans" }, // Afrikaans (Afrique du Sud)

  // Langues d'Afrique du Nord
  ar: { region: "africa", country: "EG", flag: "🇪🇬", name: "العربية" }, // Arabe (Égypte)
  ber: { region: "africa", country: "MA", flag: "🇲🇦", name: "Tamazight" }, // Berbère (Maroc)

  // Autres langues africaines importantes
  am: { region: "africa", country: "ET", flag: "🇪🇹", name: "አማርኛ" }, // Amharique (Éthiopie)
  om: { region: "africa", country: "ET", flag: "🇪🇹", name: "Afaan Oromoo" }, // Oromo (Éthiopie)
  so: { region: "africa", country: "SO", flag: "🇸🇴", name: "Soomaali" }, // Somali (Somalie)
  mg: { region: "africa", country: "MG", flag: "🇲🇬", name: "Malagasy" }, // Malgache (Madagascar)
};

/**
 * Mapping des langues mondiales principales
 * 
 * Cette constante complète AFRICAN_LANGUAGES_MAP avec les langues
 * internationales courantes pour support global de la plateforme.
 * 
 * @constant {Record<string, Object>} WORLD_LANGUAGES_MAP
 */
const WORLD_LANGUAGES_MAP: Record<
  string,
  { region: string; country: string; flag: string; name: string }
> = {
  fr: { region: "europe", country: "FR", flag: "🇫🇷", name: "Français" },
  en: { region: "europe", country: "GB", flag: "🇬🇧", name: "English" },
  es: { region: "europe", country: "ES", flag: "🇪🇸", name: "Español" },
  de: { region: "europe", country: "DE", flag: "🇩🇪", name: "Deutsch" },
  it: { region: "europe", country: "IT", flag: "🇮🇹", name: "Italiano" },
  pt: { region: "europe", country: "PT", flag: "🇵🇹", name: "Português" },
  ja: { region: "asia", country: "JP", flag: "🇯🇵", name: "日本語" },
  ko: { region: "asia", country: "KR", flag: "🇰🇷", name: "한국어" },
  zh: { region: "asia", country: "CN", flag: "🇨🇳", name: "中文" },
  hi: { region: "asia", country: "IN", flag: "🇮🇳", name: "हिन्दी" },
  ru: { region: "europe", country: "RU", flag: "🇷🇺", name: "Русский" },
};

/**
 * Service de tracking d'activité utilisateur pour O'Ypunu
 * 
 * Ce service est le cœur du système de suivi d'activité de la plateforme.
 * Il enregistre, enrichit et diffuse toutes les actions utilisateur avec
 * des métadonnées contextuelles pour les analytics et notifications.
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 📊 Tracking d'activité
 * - Enregistrement de toutes les actions utilisateur
 * - Enrichissement automatique avec données contextuelles
 * - Support multi-langues avec drapeaux et régions
 * - Métadonnées spécifiques par type d'activité
 * 
 * ### 🔄 Événements temps réel
 * - Émission d'événements pour WebSocket
 * - Notifications push automatiques
 * - Synchronisation multi-instance
 * - Cache intelligent pour performances
 * 
 * ### 🌍 Contextualisation
 * - Mapping automatique des langues africaines
 * - Résolution des drapeaux et régions
 * - Enrichissement des métadonnées linguistiques
 * - Support international étendu
 * 
 * @class ActivityService
 * @version 1.0.0
 */
@Injectable()
export class ActivityService {
  /**
   * Constructeur du service d'activité
   * 
   * @constructor
   * @param {IActivityFeedRepository} activityFeedRepository - Repository pour persistance
   * @param {ILanguageRepository} languageRepository - Repository des langues
   * @param {EventEmitter2} eventEmitter - Émetteur d'événements pour temps réel
   */
  constructor(
    @Inject("IActivityFeedRepository")
    private activityFeedRepository: IActivityFeedRepository,
    @Inject("ILanguageRepository")
    private languageRepository: ILanguageRepository,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * Crée une nouvelle activité utilisateur avec enrichissement automatique
   * 
   * Cette méthode enregistre une nouvelle activité, l'enrichit avec des
   * informations contextuelles (langues, régions, métadonnées) et émet
   * un événement pour les notifications temps réel.
   * 
   * @async
   * @method createActivity
   * @param {CreateActivityData} data - Données de l'activité à créer
   * @returns {Promise<ActivityFeed>} Activité créée avec enrichissements
   * @throws {Error} En cas d'échec de création ou d'enrichissement
   * 
   * @example
   * ```typescript
   * const activity = await activityService.createActivity({
   *   userId: "user123",
   *   username: "contributeur1",
   *   activityType: ActivityType.CREATE,
   *   entityType: EntityType.WORD,
   *   entityId: "word456",
   *   metadata: {
   *     wordName: "mbolo",
   *     language: "punu",
   *     languageCode: "pun"
   *   }
   * });
   * ```
   */
  async createActivity(data: CreateActivityData): Promise<ActivityFeed> {
    try {
      // Enrichir avec les informations de langue/région
      const enrichedData = await this.enrichWithLanguageInfo(data);

      // Créer l'activité en base
      const activity = await this.activityFeedRepository.create({
        ...enrichedData,
        isPublic: data.isPublic !== false, // Par défaut public
      });

      console.log("📊 Nouvelle activité créée:", {
        type: data.activityType,
        user: data.username,
        language: enrichedData.metadata?.languageName,
        region: enrichedData.languageRegion,
      });

      // Émettre l'événement pour diffusion temps réel
      this.eventEmitter.emit("activity.created", {
        activity,
        userId: data.userId,
      });

      return activity;
    } catch (error) {
      console.error("❌ Erreur lors de la création d'activité:", error);
      throw error;
    }
  }

  private async enrichWithLanguageInfo(
    data: CreateActivityData
  ): Promise<CreateActivityData> {
    const languageCode = data.metadata?.languageCode || data.metadata?.language;

    if (!languageCode) {
      return data;
    }

    try {
      // Chercher dans la vraie collection Language
      const language = await this.languageRepository.findByCode(languageCode);

      if (language) {
        return {
          ...data,
          languageRegion: language.region,
          metadata: {
            ...data.metadata,
            languageName: language.nativeName || language.name,
            languageFlag:
              language.flagEmoji || this.getFallbackFlag(languageCode),
          },
        };
      }
    } catch (error) {
      console.error("Erreur lors de la recherche de langue:", error);
    }

    // Fallback vers les mappings statiques
    let languageInfo = AFRICAN_LANGUAGES_MAP[languageCode];
    if (!languageInfo) {
      languageInfo = WORLD_LANGUAGES_MAP[languageCode];
    }

    if (languageInfo) {
      return {
        ...data,
        languageRegion: languageInfo.region,
        metadata: {
          ...data.metadata,
          languageName: languageInfo.name,
          languageFlag: languageInfo.flag,
        },
      };
    }

    return data;
  }

  private getFallbackFlag(languageCode: string): string {
    // Mapping des codes vers drapeaux principaux
    const flagMap: { [key: string]: string } = {
      // Langues africaines (priorité)
      yo: "🇳🇬",
      ha: "🇳🇬",
      ig: "🇳🇬", // Nigeria
      ff: "🇸🇳",
      wo: "🇸🇳", // Sénégal
      bm: "🇲🇱", // Mali
      ln: "🇨🇩",
      kg: "🇨🇩", // RDC
      sw: "🇰🇪", // Kenya
      rw: "🇷🇼", // Rwanda
      zu: "🇿🇦",
      xh: "🇿🇦",
      af: "🇿🇦", // Afrique du Sud
      ar: "🇪🇬", // Égypte
      ber: "🇲🇦", // Maroc
      am: "🇪🇹",
      om: "🇪🇹", // Éthiopie
      so: "🇸🇴", // Somalie
      mg: "🇲🇬", // Madagascar

      // Autres langues du monde
      fr: "🇫🇷",
      en: "🇬🇧",
      es: "🇪🇸",
      de: "🇩🇪",
      it: "🇮🇹",
      pt: "🇵🇹",
      ja: "🇯🇵",
      ko: "🇰🇷",
      zh: "🇨🇳",
      hi: "🇮🇳",
      ru: "🇷🇺",
    };

    return flagMap[languageCode] || "🌍";
  }

  async getRecentActivities(
    limit: number = 10,
    prioritizeAfrican: boolean = true
  ): Promise<ActivityFeed[]> {
    const sortBy = prioritizeAfrican ? "languageRegion" : "createdAt";
    const sortOrder = prioritizeAfrican ? "asc" : "desc";

    const result = await this.activityFeedRepository.findRecent({
      limit,
      isPublic: true,
      isVisible: true,
      sortBy,
      sortOrder,
      secondarySortBy: "createdAt",
      secondarySortOrder: "desc",
    });

    return result.activities;
  }

  async getActivitiesByType(
    activityType: ActivityType,
    limit: number = 5
  ): Promise<ActivityFeed[]> {
    return await this.activityFeedRepository.findByType(activityType, {
      limit,
      isPublic: true,
      isVisible: true,
    });
  }

  // ====== Méthodes de convenance pour les types d'activités courantes ======

  // === Activités liées aux mots ===
  async logWordCreated(
    userId: string,
    username: string,
    wordId: string,
    wordName: string,
    languageCode: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.WORD_CREATED,
      entityType: EntityType.WORD,
      entityId: wordId,
      metadata: {
        wordName,
        languageCode,
        language: languageCode,
      },
    });
  }

  async logTranslationAdded(
    userId: string,
    username: string,
    wordId: string,
    wordName: string,
    translatedWord: string,
    sourceLanguageCode: string,
    targetLanguageCode: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.TRANSLATION_ADDED,
      entityType: EntityType.TRANSLATION,
      entityId: wordId,
      metadata: {
        wordName,
        translatedWord,
        languageCode: sourceLanguageCode,
        targetLanguageCode,
      },
    });
  }

  async logSynonymAdded(
    userId: string,
    username: string,
    wordId: string,
    wordName: string,
    synonymsCount: number,
    languageCode: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.SYNONYM_ADDED,
      entityType: EntityType.WORD,
      entityId: wordId,
      metadata: {
        wordName,
        synonymsCount,
        languageCode,
      },
    });
  }

  async logWordApproved(
    userId: string,
    username: string,
    wordId: string,
    wordName: string,
    languageCode: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.WORD_APPROVED,
      entityType: EntityType.WORD,
      entityId: wordId,
      metadata: {
        wordName,
        languageCode,
      },
    });
  }

  async logWordVerified(
    userId: string,
    username: string,
    wordId: string,
    wordName: string,
    languageCode: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.WORD_VERIFIED,
      entityType: EntityType.WORD,
      entityId: wordId,
      metadata: {
        wordName,
        languageCode,
      },
    });
  }

  // === Activités liées aux utilisateurs ===
  async logUserRegistered(
    userId: string,
    username: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.USER_REGISTERED,
      entityType: EntityType.USER,
      entityId: userId,
      metadata: {},
    });
  }

  async logUserLoggedIn(
    userId: string,
    username: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.USER_LOGGED_IN,
      entityType: EntityType.USER,
      entityId: userId,
      metadata: {},
    });
  }

  // === Activités liées aux communautés ===
  async logCommunityJoined(
    userId: string,
    username: string,
    communityId: string,
    communityName: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.COMMUNITY_JOINED,
      entityType: EntityType.COMMUNITY,
      entityId: communityId,
      metadata: {
        communityName,
      },
    });
  }

  async logCommunityCreated(
    userId: string,
    username: string,
    communityId: string,
    communityName: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.COMMUNITY_CREATED,
      entityType: EntityType.COMMUNITY,
      entityId: communityId,
      metadata: {
        communityName,
      },
    });
  }

  async logCommunityPost(
    userId: string,
    username: string,
    postId: string,
    postTitle: string,
    communityId: string,
    communityName: string
  ): Promise<ActivityFeed> {
    return this.createActivity({
      userId,
      username,
      activityType: ActivityType.COMMUNITY_POST,
      entityType: EntityType.COMMUNITY_POST,
      entityId: postId,
      metadata: {
        postTitle,
        communityName,
      },
    });
  }

  /**
   * Méthode de compatibilité pour les services refactorisés
   * Adapte l'ancienne interface vers la nouvelle interface createActivity
   */
  async recordActivity(data: {
    userId: string;
    activityType: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityFeed> {
    // Obtenir le username depuis le userId
    // Pour l'instant, on utilise une valeur par défaut car l'interface originale ne fournit pas le username
    // Récupérer le username depuis UserService si possible
    let username = "Unknown User";
    try {
      // Note: Injection du UserService serait nécessaire pour récupérer le username
      // Pour l'instant, on utilise une valeur par défaut
      username = `User-${data.userId.slice(-6)}`;
    } catch (error) {
      console.warn('Could not fetch username for activity logging:', error);
    }

    // Mapper les types vers les enums ActivityType et EntityType
    const mappedActivityType = this.mapActivityType(data.activityType);
    const mappedEntityType = this.mapEntityType(data.targetType);

    return this.createActivity({
      userId: data.userId,
      username,
      activityType: mappedActivityType,
      entityType: mappedEntityType,
      entityId: data.targetId,
      metadata: data.metadata,
    });
  }

  // ========== MÉTHODES SPÉCIALISÉES D'ACTIVITY LOGGING ==========

  /**
   * Enregistrer la mise à jour d'un mot
   */
  async logWordUpdated(
    userId: string,
    wordId: string,
    changes: string[],
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'word_updated',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        changes,
        timestamp: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer la suppression d'un mot
   */
  async logWordDeleted(
    userId: string,
    wordId: string,
    wordTitle: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'word_deleted',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        wordTitle,
        deletedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer l'ajout d'un fichier audio
   */
  async logAudioAdded(
    userId: string,
    wordId: string,
    audioUrl: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'audio_added',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        audioUrl,
        addedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer la suppression d'un fichier audio
   */
  async logAudioDeleted(
    userId: string,
    wordId: string,
    audioUrl: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'audio_deleted',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        audioUrl,
        deletedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer une mise à jour en bulk des fichiers audio
   */
  async logAudioBulkUpdated(
    userId: string,
    wordId: string,
    operation: 'added' | 'deleted' | 'updated',
    count: number,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'audio_bulk_updated',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        operation,
        count,
        bulkUpdatedAt: new Date(),
        ...metadata
      }
    });
  }


  /**
   * Enregistrer une action de vote
   */
  async logVoteAction(
    userId: string,
    targetType: 'word' | 'translation' | 'comment',
    targetId: string,
    voteType: 'like' | 'dislike' | 'helpful' | 'accurate',
    action: 'created' | 'updated' | 'removed',
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'vote_action',
      targetType,
      targetId,
      metadata: {
        voteType,
        action,
        votedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer l'ajout aux favoris
   */
  async logFavoriteAdded(
    userId: string,
    wordId: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'word_favorited',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        favoritedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer la suppression des favoris
   */
  async logFavoriteRemoved(
    userId: string,
    wordId: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'word_unfavorited',
      targetType: 'word',
      targetId: wordId,
      metadata: {
        unfavoritedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer l'activation d'un achievement
   */
  async logAchievementUnlocked(
    userId: string,
    achievementId: string,
    achievementName: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'achievement_unlocked',
      targetType: 'achievement',
      targetId: achievementId,
      metadata: {
        achievementName,
        unlockedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * ⭐ Logger le gain d'XP
   */
  async logXPGained(
    userId: string,
    action: string,
    xpGained: number,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId,
      activityType: 'xp_gained',
      targetType: 'user',
      targetId: userId,
      metadata: {
        action,
        xpGained,
        gainedAt: new Date(),
        ...metadata
      }
    });
  }

  /**
   * Enregistrer une action de modération
   */
  async logModerationAction(
    moderatorId: string,
    targetType: 'word' | 'user' | 'comment',
    targetId: string,
    action: 'approved' | 'rejected' | 'banned' | 'warned',
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<ActivityFeed> {
    return this.recordActivity({
      userId: moderatorId,
      activityType: 'moderation_action',
      targetType,
      targetId,
      metadata: {
        action,
        reason,
        moderatedAt: new Date(),
        ...metadata
      }
    });
  }

  private mapActivityType(activityType: string): ActivityType {
    const typeMap: Record<string, ActivityType> = {
      word_favorited: ActivityType.WORD_FAVORITED,
      word_unfavorited: ActivityType.WORD_UNFAVORITED,
      translation_added: ActivityType.TRANSLATION_ADDED,
      vote_action: ActivityType.WORD_VOTED,
      achievement_unlocked: ActivityType.ACHIEVEMENT_UNLOCKED,
      moderation_action: ActivityType.WORD_CREATED, // Utiliser le plus proche existant
      word_shared: ActivityType.WORD_SHARED,
      word_received: ActivityType.WORD_RECEIVED,
      favorites_cleared: ActivityType.FAVORITES_CLEARED,
      word_created: ActivityType.WORD_CREATED,
      word_updated: ActivityType.WORD_UPDATED,
      word_deleted: ActivityType.WORD_DELETED,
      audio_added: ActivityType.AUDIO_ADDED,
      audio_deleted: ActivityType.AUDIO_DELETED,
      audio_bulk_updated: ActivityType.AUDIO_UPDATED,
      xp_gained: ActivityType.XP_GAINED,
    };

    return typeMap[activityType] || ActivityType.WORD_CREATED; // Fallback par défaut
  }

  private mapEntityType(targetType: string): EntityType {
    const typeMap: Record<string, EntityType> = {
      word: EntityType.WORD,
      user: EntityType.USER,
      audio: EntityType.AUDIO,
    };

    return typeMap[targetType] || EntityType.WORD; // Fallback par défaut
  }
}
