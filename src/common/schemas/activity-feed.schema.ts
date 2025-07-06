import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ActivityFeedDocument = ActivityFeed & Document;

export enum ActivityType {
  WORD_CREATED = 'word_created',
  TRANSLATION_ADDED = 'translation_added',
  SYNONYM_ADDED = 'synonym_added',
  ANTONYM_ADDED = 'antonym_added',
  WORD_APPROVED = 'word_approved',
  WORD_VERIFIED = 'word_verified',
  COMMUNITY_POST = 'community_post_created',
  COMMENT_ADDED = 'comment_added',
  WORD_FAVORITED = 'word_favorited',
  USER_REGISTERED = 'user_registered',
  USER_LOGGED_IN = 'user_logged_in',
  COMMUNITY_JOINED = 'community_joined',
  COMMUNITY_CREATED = 'community_created',
}

export enum EntityType {
  WORD = 'word',
  TRANSLATION = 'translation',
  COMMUNITY_POST = 'community_post',
  COMMENT = 'comment',
  USER = 'user',
  COMMUNITY = 'community',
}

@Schema({ timestamps: true })
export class ActivityFeed {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ required: true })
  username: string; // Dénormalisé pour performance

  @Prop({ type: String, enum: ActivityType, required: true })
  activityType: ActivityType;

  @Prop({ type: String, enum: EntityType, required: true })
  entityType: EntityType;

  @Prop({ required: true })
  entityId: string;

  // Métadonnées pour affichage riche
  @Prop({ type: Object })
  metadata: {
    wordName?: string;
    language?: string;
    languageCode?: string;
    languageName?: string;
    translatedWord?: string;
    targetLanguage?: string;
    targetLanguageCode?: string;
    synonymsCount?: number;
    postTitle?: string;
    communityName?: string;
  };

  @Prop({ default: true })
  isPublic: boolean;

  @Prop({ default: true })
  isVisible: boolean; // Pour masquer certaines activités si nécessaire

  // Champs pour la localisation/région (focus Afrique)
  @Prop()
  userRegion?: string; // 'africa', 'europe', 'asia', etc.

  @Prop()
  languageRegion?: string; // Région de la langue de l'activité

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const ActivityFeedSchema = SchemaFactory.createForClass(ActivityFeed);

// Index pour optimiser les requêtes
ActivityFeedSchema.index({ createdAt: -1 });
ActivityFeedSchema.index({ userId: 1, createdAt: -1 });
ActivityFeedSchema.index({ activityType: 1, createdAt: -1 });
ActivityFeedSchema.index({ isPublic: 1, isVisible: 1, createdAt: -1 });
ActivityFeedSchema.index({ languageRegion: 1, createdAt: -1 });
