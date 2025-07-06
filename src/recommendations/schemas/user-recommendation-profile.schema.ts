import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type UserRecommendationProfileDocument = UserRecommendationProfile & Document;

@Schema()
export class InteractionPatterns {
  @Prop({ type: [Number], default: [] })
  peakHours: number[]; // Heures de consultation préférées (0-23)

  @Prop({ type: [String], default: [] })
  preferredContentTypes: string[]; // Types de contenu préférés

  @Prop({ type: Number, default: 0 })
  averageSessionDuration: number; // Durée moyenne de session en minutes
}

@Schema()
export class RecommendationFeedback {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true })
  wordId: string;

  @Prop({ type: String, enum: ['like', 'dislike', 'not_interested', 'view', 'favorite'], required: true })
  feedbackType: string;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ type: String })
  reason?: string; // Raison du feedback négatif
}

@Schema({ timestamps: true })
export class UserRecommendationProfile {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: User;

  @Prop({ type: [String], default: [] })
  preferredCategories: string[]; // Catégories préférées

  @Prop({ type: Map, of: Number, default: new Map() })
  languageProficiency: Map<string, number>; // langue -> niveau (1-5)

  @Prop({ type: InteractionPatterns, default: () => ({}) })
  interactionPatterns: InteractionPatterns;

  @Prop({ type: [String], default: [] })
  semanticInterests: string[]; // Tags de concepts préférés

  @Prop({ default: Date.now })
  lastRecommendationAt: Date;

  @Prop({ type: [RecommendationFeedback], default: [] })
  feedbackHistory: RecommendationFeedback[];

  // Compteurs de performance
  @Prop({ type: Number, default: 0 })
  totalRecommendationsSeen: number;

  @Prop({ type: Number, default: 0 })
  totalRecommendationsClicked: number;

  @Prop({ type: Number, default: 0 })
  totalRecommendationsFavorited: number;

  // Configuration personnalisée
  @Prop({ type: Object, default: () => ({
    behavioralWeight: 0.4,
    semanticWeight: 0.3,
    communityWeight: 0.2,
    linguisticWeight: 0.1
  }) })
  algorithmWeights: {
    behavioralWeight: number;
    semanticWeight: number;
    communityWeight: number;
    linguisticWeight: number;
  };
}

export const UserRecommendationProfileSchema = SchemaFactory.createForClass(UserRecommendationProfile);

// Index pour optimiser les requêtes
UserRecommendationProfileSchema.index({ userId: 1 });
UserRecommendationProfileSchema.index({ lastRecommendationAt: -1 });
UserRecommendationProfileSchema.index({ 'feedbackHistory.timestamp': -1 });