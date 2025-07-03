import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Word } from '../../dictionary/schemas/word.schema';
import { Category } from '../../dictionary/schemas/category.schema';

export type TrainingDataDocument = TrainingData & Document;

@Schema()
export class ValidationContext {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  category: Category;

  @Prop({ type: [String], default: [] })
  sourceKeywords: string[];

  @Prop({ type: [String], default: [] })
  targetKeywords: string[];

  @Prop({ type: [String], default: [] })
  sharedKeywords: string[]; // Mots-clés en commun

  @Prop()
  categoryMatch: boolean; // Si les catégories correspondent

  @Prop({ type: Number, default: 0 })
  semanticDistance: number; // Distance sémantique calculée
}

@Schema({ timestamps: true })
export class TrainingData {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true, index: true })
  sourceWordId: Word;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true, index: true })
  targetWordId: Word;

  @Prop({ type: Number, required: true, min: 0, max: 1 })
  similarityScore: number; // Score calculé par l'algorithme

  @Prop({ 
    type: String, 
    required: true, 
    enum: ['merge', 'separate', 'uncertain'],
    index: true 
  })
  humanDecision: string; // Décision humaine

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  validatedBy: User; // CONTRIBUTOR/ADMIN/SUPERADMIN qui a validé

  @Prop({ type: ValidationContext })
  context: ValidationContext; // Contexte de la validation

  @Prop({ type: String, enum: ['auto', 'manual', 'learned'], default: 'manual' })
  validationType: string; // Type de validation

  @Prop({ type: String })
  reason?: string; // Raison de la décision (optionnelle)

  @Prop({ type: Boolean, default: false })
  wasCorrectPrediction: boolean; // Si la prédiction auto était correcte

  @Prop()
  createdAt: Date;
}

export const TrainingDataSchema = SchemaFactory.createForClass(TrainingData);

// Index composites pour performance et apprentissage
TrainingDataSchema.index({ sourceWordId: 1, targetWordId: 1 }, { unique: true });
TrainingDataSchema.index({ humanDecision: 1, similarityScore: -1 });
TrainingDataSchema.index({ validatedBy: 1, createdAt: -1 });
TrainingDataSchema.index({ 'context.categoryMatch': 1, humanDecision: 1 });
TrainingDataSchema.index({ validationType: 1, wasCorrectPrediction: 1 });