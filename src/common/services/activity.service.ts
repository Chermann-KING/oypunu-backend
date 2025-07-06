import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActivityFeed,
  ActivityFeedDocument,
  ActivityType,
  EntityType,
} from '../schemas/activity-feed.schema';
import {
  Language,
  LanguageDocument,
} from '../../languages/schemas/language.schema';

export interface CreateActivityData {
  userId: string;
  username: string;
  activityType: ActivityType;
  entityType: EntityType;
  entityId: string;
  metadata?: {
    wordName?: string;
    language?: string;
    languageCode?: string;
    languageName?: string;
    languageFlag?: string;
    translatedWord?: string;
    targetLanguage?: string;
    targetLanguageCode?: string;
    synonymsCount?: number;
    postTitle?: string;
    communityName?: string;
  };
  userRegion?: string;
  languageRegion?: string;
  isPublic?: boolean;
}

// Mapping des codes de langues africaines vers régions/drapeaux
const AFRICAN_LANGUAGES_MAP = {
  // Langues principales d'Afrique de l'Ouest
  yo: { region: 'africa', country: 'NG', flag: '🇳🇬', name: 'Yorùbá' }, // Yoruba (Nigeria)
  ha: { region: 'africa', country: 'NG', flag: '🇳🇬', name: 'Hausa' }, // Hausa (Nigeria)
  ig: { region: 'africa', country: 'NG', flag: '🇳🇬', name: 'Igbo' }, // Igbo (Nigeria)
  ff: { region: 'africa', country: 'SN', flag: '🇸🇳', name: 'Fulfulde' }, // Fulfulde (Sénégal)
  wo: { region: 'africa', country: 'SN', flag: '🇸🇳', name: 'Wolof' }, // Wolof (Sénégal)
  bm: { region: 'africa', country: 'ML', flag: '🇲🇱', name: 'Bambara' }, // Bambara (Mali)

  // Langues d'Afrique Centrale
  ln: { region: 'africa', country: 'CD', flag: '🇨🇩', name: 'Lingala' }, // Lingala (RDC)
  kg: { region: 'africa', country: 'CD', flag: '🇨🇩', name: 'Kikongo' }, // Kikongo (RDC)
  sw: { region: 'africa', country: 'KE', flag: '🇰🇪', name: 'Kiswahili' }, // Swahili (Kenya)
  rw: { region: 'africa', country: 'RW', flag: '🇷🇼', name: 'Kinyarwanda' }, // Kinyarwanda (Rwanda)

  // Langues d'Afrique du Sud
  zu: { region: 'africa', country: 'ZA', flag: '🇿🇦', name: 'isiZulu' }, // Zulu (Afrique du Sud)
  xh: { region: 'africa', country: 'ZA', flag: '🇿🇦', name: 'isiXhosa' }, // Xhosa (Afrique du Sud)
  af: { region: 'africa', country: 'ZA', flag: '🇿🇦', name: 'Afrikaans' }, // Afrikaans (Afrique du Sud)

  // Langues d'Afrique du Nord
  ar: { region: 'africa', country: 'EG', flag: '🇪🇬', name: 'العربية' }, // Arabe (Égypte)
  ber: { region: 'africa', country: 'MA', flag: '🇲🇦', name: 'Tamazight' }, // Berbère (Maroc)

  // Autres langues africaines importantes
  am: { region: 'africa', country: 'ET', flag: '🇪🇹', name: 'አማርኛ' }, // Amharique (Éthiopie)
  om: { region: 'africa', country: 'ET', flag: '🇪🇹', name: 'Afaan Oromoo' }, // Oromo (Éthiopie)
  so: { region: 'africa', country: 'SO', flag: '🇸🇴', name: 'Soomaali' }, // Somali (Somalie)
  mg: { region: 'africa', country: 'MG', flag: '🇲🇬', name: 'Malagasy' }, // Malgache (Madagascar)
};

// Mapping pour les autres langues du monde
const WORLD_LANGUAGES_MAP = {
  fr: { region: 'europe', country: 'FR', flag: '🇫🇷', name: 'Français' },
  en: { region: 'europe', country: 'GB', flag: '🇬🇧', name: 'English' },
  es: { region: 'europe', country: 'ES', flag: '🇪🇸', name: 'Español' },
  de: { region: 'europe', country: 'DE', flag: '🇩🇪', name: 'Deutsch' },
  it: { region: 'europe', country: 'IT', flag: '🇮🇹', name: 'Italiano' },
  pt: { region: 'europe', country: 'PT', flag: '🇵🇹', name: 'Português' },
  ja: { region: 'asia', country: 'JP', flag: '🇯🇵', name: '日本語' },
  ko: { region: 'asia', country: 'KR', flag: '🇰🇷', name: '한국어' },
  zh: { region: 'asia', country: 'CN', flag: '🇨🇳', name: '中文' },
  hi: { region: 'asia', country: 'IN', flag: '🇮🇳', name: 'हिन्दी' },
  ru: { region: 'europe', country: 'RU', flag: '🇷🇺', name: 'Русский' },
};

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(ActivityFeed.name)
    private activityFeedModel: Model<ActivityFeedDocument>,
    @InjectModel(Language.name)
    private languageModel: Model<LanguageDocument>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createActivity(data: CreateActivityData): Promise<ActivityFeed> {
    try {
      // Enrichir avec les informations de langue/région
      const enrichedData = await this.enrichWithLanguageInfo(data);

      // Créer l'activité en base
      const activity = new this.activityFeedModel({
        ...enrichedData,
        isPublic: data.isPublic !== false, // Par défaut public
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await activity.save();

      console.log('📊 Nouvelle activité créée:', {
        type: data.activityType,
        user: data.username,
        language: enrichedData.metadata?.languageName,
        region: enrichedData.languageRegion,
      });

      // Émettre l'événement pour diffusion temps réel
      this.eventEmitter.emit('activity.created', {
        activity: activity.toObject(),
        userId: data.userId,
      });

      return activity;
    } catch (error) {
      console.error("❌ Erreur lors de la création d'activité:", error);
      throw error;
    }
  }

  private async enrichWithLanguageInfo(
    data: CreateActivityData,
  ): Promise<CreateActivityData> {
    const languageCode = data.metadata?.languageCode || data.metadata?.language;

    if (!languageCode) {
      return data;
    }

    try {
      // Chercher dans la vraie collection Language
      const language = await this.languageModel
        .findOne({
          $or: [
            { iso639_1: languageCode },
            { iso639_2: languageCode },
            { iso639_3: languageCode },
          ],
        })
        .exec();

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
      console.error('Erreur lors de la recherche de langue:', error);
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
      yo: '🇳🇬',
      ha: '🇳🇬',
      ig: '🇳🇬', // Nigeria
      ff: '🇸🇳',
      wo: '🇸🇳', // Sénégal
      bm: '🇲🇱', // Mali
      ln: '🇨🇩',
      kg: '🇨🇩', // RDC
      sw: '🇰🇪', // Kenya
      rw: '🇷🇼', // Rwanda
      zu: '🇿🇦',
      xh: '🇿🇦',
      af: '🇿🇦', // Afrique du Sud
      ar: '🇪🇬', // Égypte
      ber: '🇲🇦', // Maroc
      am: '🇪🇹',
      om: '🇪🇹', // Éthiopie
      so: '🇸🇴', // Somalie
      mg: '🇲🇬', // Madagascar

      // Autres langues du monde
      fr: '🇫🇷',
      en: '🇬🇧',
      es: '🇪🇸',
      de: '🇩🇪',
      it: '🇮🇹',
      pt: '🇵🇹',
      ja: '🇯🇵',
      ko: '🇰🇷',
      zh: '🇨🇳',
      hi: '🇮🇳',
      ru: '🇷🇺',
    };

    return flagMap[languageCode] || '🌍';
  }

  async getRecentActivities(
    limit: number = 10,
    prioritizeAfrican: boolean = true,
  ): Promise<ActivityFeed[]> {
    let query = this.activityFeedModel
      .find({
        isPublic: true,
        isVisible: true,
      })
      .limit(limit)
      .lean();

    if (prioritizeAfrican) {
      // Prioriser les activités sur les langues africaines
      query = query.sort({
        languageRegion: 1, // africa = 1, autres = 2+
        createdAt: -1,
      });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    return await query.exec();
  }

  async getActivitiesByType(
    activityType: ActivityType,
    limit: number = 5,
  ): Promise<ActivityFeed[]> {
    return await this.activityFeedModel
      .find({
        activityType,
        isPublic: true,
        isVisible: true,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  // ====== Méthodes de convenance pour les types d'activités courantes ======

  // === Activités liées aux mots ===
  async logWordCreated(
    userId: string,
    username: string,
    wordId: string,
    wordName: string,
    languageCode: string,
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
    targetLanguageCode: string,
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
    languageCode: string,
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
    languageCode: string,
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
    languageCode: string,
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
    username: string,
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
    username: string,
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
    communityName: string,
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
    communityName: string,
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
    communityName: string,
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
}
