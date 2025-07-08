import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type RecommendationCacheDocument = RecommendationCache & Document;

@Schema()
export class RecommendationResult {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true })
  wordId: string;

  @Prop({ type: Number, required: true, min: 0, max: 1 })
  score: number; // Score de recommandation (0-1)

  @Prop({ type: [String], default: [] })
  reasons: string[]; // Raisons de la recommandation

  @Prop({
    type: String,
    enum: ['behavioral', 'semantic', 'community', 'linguistic', 'mixed'],
    required: true,
  })
  category: string;

  @Prop({ type: Object, default: () => ({}) })
  metadata: Record<string, any>; // Métadonnées supplémentaires
}

@Schema()
export class AlgorithmConfig {
  @Prop({ type: Number, default: 0.4 })
  behavioralWeight: number;

  @Prop({ type: Number, default: 0.3 })
  semanticWeight: number;

  @Prop({ type: Number, default: 0.2 })
  communityWeight: number;

  @Prop({ type: Number, default: 0.1 })
  linguisticWeight: number;
}

@Schema({ timestamps: true })
export class RecommendationCache {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: [RecommendationResult], default: [] })
  recommendations: RecommendationResult[];

  @Prop({ default: Date.now })
  generatedAt: Date;

  @Prop({ required: true })
  validUntil: Date; // Cache expiration

  @Prop({ type: String, default: 'mixed' })
  algorithm: string; // Type d'algorithme utilisé

  @Prop({ type: AlgorithmConfig, default: () => ({}) })
  config: AlgorithmConfig;

  @Prop({
    type: String,
    enum: ['personal', 'trending', 'linguistic', 'semantic'],
    default: 'personal',
  })
  recommendationType: string;

  // Métadonnées de performance
  @Prop({ type: Number, default: 0 })
  generationTimeMs: number; // Temps de génération en ms

  @Prop({ type: Number, default: 0 })
  totalCandidates: number; // Nombre total de candidats évalués

  @Prop({ type: Number, default: 0 })
  avgScore: number; // Score moyen des recommandations
}

export const RecommendationCacheSchema =
  SchemaFactory.createForClass(RecommendationCache);

// Index composites pour optimiser les requêtes
RecommendationCacheSchema.index({ userId: 1, recommendationType: 1 });
RecommendationCacheSchema.index({ validUntil: 1 }); // Pour le nettoyage automatique
RecommendationCacheSchema.index({ generatedAt: -1 });
RecommendationCacheSchema.index({ userId: 1, validUntil: 1 });
