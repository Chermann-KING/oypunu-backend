import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Category } from './category.schema';
import { Language } from '../../languages/schemas/language.schema';

export type WordDocument = Word & Document;

@Schema()
export class Definition {
  @Prop({ required: true })
  definition: string;

  @Prop({ type: [String], default: [] })
  examples: string[];

  @Prop()
  sourceUrl?: string;
}

@Schema()
export class Phonetic {
  @Prop({ required: true })
  text: string;

  @Prop({
    type: {
      url: { type: String },
      cloudinaryId: { type: String },
      format: { type: String },
      duration: { type: Number },
    },
  })
  audio?: {
    url: string;
    cloudinaryId: string;
    format: string;
    duration: number;
  };

  @Prop()
  sourceUrl?: string;
}

@Schema()
export class Meaning {
  @Prop({ required: true })
  partOfSpeech: string;

  @Prop({ type: [Definition], default: [] })
  definitions: Definition[];

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  antonyms: string[];

  @Prop({ type: [String], default: [] })
  examples: string[];

  @Prop({ type: [Phonetic], default: [] })
  phonetics: Phonetic[];
}

@Schema()
export class Translation {
  // NOUVEAU: Référence vers la collection Languages
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Language', required: true })
  languageId: Language;

  // DURANT LA MIGRATION: Ancien champ pour compatibilité (à supprimer après migration)
  @Prop()
  language?: string;

  @Prop({ required: true })
  translatedWord: string;

  @Prop({ type: [String], default: [] })
  context: string[];

  @Prop({ type: Number, default: 0 })
  confidence: number;

  @Prop({ type: [String], default: [] })
  verifiedBy: string[];

  // ===== NOUVELLES PROPRIÉTÉS POUR LE SYSTÈME DE TRADUCTION INTELLIGENTE =====
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TranslationGroup', index: true })
  translationGroupId?: string; // Référence au groupe de traduction

  @Prop()
  senseId?: string; // ID du sens spécifique dans le groupe

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word' })
  targetWordId?: string; // Référence au mot cible

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy?: User; // Utilisateur qui a créé la traduction

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  validatedBy?: User; // Utilisateur qui a validé (null si auto-validé)

  @Prop({ 
    type: String, 
    enum: ['auto', 'manual', 'learned'], 
    default: 'manual' 
  })
  validationType: string; // Type de validation

  @Prop({ type: Number, default: 0 })
  votes: number; // Votes +1 pour valider la traduction

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  votedBy: User[]; // Utilisateurs qui ont voté

  @Prop({ default: Date.now })
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Word {
  @Prop({ required: true, index: true })
  word: string;

  // NOUVEAU: Référence vers la collection Languages
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Language', required: true, index: true })
  languageId: Language;

  // DURANT LA MIGRATION: Ancien champ pour compatibilité (à supprimer après migration)
  @Prop({ index: true })
  language?: string;

  @Prop()
  pronunciation?: string;

  @Prop()
  etymology?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  categoryId?: Category;

  @Prop({ type: [Meaning], default: [] })
  meanings: Meaning[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy?: User;

  @Prop({ default: 'pending', enum: ['approved', 'pending', 'rejected'] })
  status: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  // @Prop({ type: Map, of: String })
  @Prop({
    type: Map,
    of: new MongooseSchema(
      {
        url: { type: String },
        cloudinaryId: { type: String },
        language: { type: String },
        accent: { type: String },
      },
      { _id: false },
    ),
    default: {},
  })
  audioFiles: Map<
    string,
    {
      url: string;
      cloudinaryId: string;
      language: string;
      accent: string;
    }
  >;

  @Prop({ type: [Translation], default: [] })
  translations: Translation[];

  @Prop({ type: Map, of: String })
  languageVariants: Map<string, string>;

  // ===== NOUVELLES PROPRIÉTÉS POUR LE SYSTÈME DE TRADUCTION INTELLIGENTE =====
  @Prop({ type: [String], default: [] })
  extractedKeywords: string[]; // Mots-clés extraits des définitions (pour similarité)

  @Prop({ type: Number, default: 0 })
  translationCount: number; // Nombre de traductions liées

  @Prop({ type: [String], default: [] })
  availableLanguages: string[]; // Langues pour lesquelles ce mot a des traductions
}

export const WordSchema = SchemaFactory.createForClass(Word);
// Ajouter des index composites pour améliorer les performances de recherche
WordSchema.index({ word: 'text', language: 1 });

// ===== NOUVEAUX INDEX POUR LE SYSTÈME DE TRADUCTION =====
WordSchema.index({ extractedKeywords: 1, language: 1 }); // Pour recherche par mots-clés
WordSchema.index({ availableLanguages: 1, categoryId: 1 }); // Pour recherche de traductions
WordSchema.index({ 'translations.translationGroupId': 1 }); // Pour groupes de traduction
WordSchema.index({ 'translations.targetWordId': 1 }); // Pour relations bidirectionnelles
WordSchema.index({ translationCount: -1, language: 1 }); // Pour mots les plus traduits
