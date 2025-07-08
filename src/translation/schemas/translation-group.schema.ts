import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Category } from '../../dictionary/schemas/category.schema';

export type TranslationGroupDocument = TranslationGroup & Document;

@Schema()
export class Sense {
  @Prop({ required: true })
  senseId: string; // Format: "GROUP_ID_SENSE_1"

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  partOfSpeech: string;

  @Prop({ type: [String], default: [] })
  keywords: string[]; // Mots-clés extraits automatiquement

  @Prop({ type: [String], default: [] })
  context: string[]; // Contexte d'usage
}

@Schema({ timestamps: true })
export class TranslationGroup {
  @Prop({ required: true, unique: true, index: true })
  conceptId: string; // Identifiant unique du concept (généré automatiquement)

  @Prop({ required: true })
  primaryWord: string; // Mot principal du groupe

  @Prop({ required: true, index: true })
  primaryLanguage: string; // Langue principale

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', index: true })
  categoryId: Category; // Référence à la catégorie principale

  @Prop({ type: [Sense], default: [] })
  senses: Sense[]; // Différents sens du concept

  @Prop({ type: [String], default: [] })
  relatedConcepts: string[]; // Concepts liés (pour l'apprentissage)

  @Prop({ type: Number, default: 1 })
  totalTranslations: number; // Nombre total de traductions

  @Prop({ type: Number, default: 0 })
  qualityScore: number; // Score de qualité basé sur les validations

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TranslationGroupSchema =
  SchemaFactory.createForClass(TranslationGroup);

// Index composites pour performance
TranslationGroupSchema.index({ conceptId: 1, primaryLanguage: 1 });
TranslationGroupSchema.index({ categoryId: 1, primaryLanguage: 1 });
TranslationGroupSchema.index({ 'senses.keywords': 1 });
TranslationGroupSchema.index({ qualityScore: -1, totalTranslations: -1 });
