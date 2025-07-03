import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type LanguageDocument = Language & Document;

@Schema()
export class LanguageVariant {
  @Prop({ required: true })
  name: string; // Ex: "Fang du Nord", "Anglais américain"

  @Prop({ required: true })
  region: string; // Ex: "Gabon", "États-Unis"

  @Prop()
  countryCode?: string; // Ex: "GA", "US"

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  alternativeNames: string[]; // Autres noms pour cette variante
}

@Schema()
export class LanguageScript {
  @Prop({ required: true })
  name: string; // Ex: "Latin", "Arabe", "Tifinagh"

  @Prop({ required: true })
  code: string; // Ex: "Latn", "Arab", "Tfng"

  @Prop({ default: 'ltr', enum: ['ltr', 'rtl'] })
  direction: string; // Direction d'écriture

  @Prop({ default: true })
  isDefault: boolean; // Script principal pour cette langue
}

@Schema({ timestamps: true })
export class Language {
  @Prop({ required: true, unique: true, index: true })
  name: string; // Ex: "Fang", "English", "العربية"

  @Prop({ required: true })
  nativeName: string; // Nom dans la langue elle-même

  @Prop({ unique: true, sparse: true })
  iso639_1?: string; // Code ISO 2 lettres (si disponible) - Ex: "fr", "en"

  @Prop({ unique: true, sparse: true })
  iso639_2?: string; // Code ISO 3 lettres (si disponible) - Ex: "fra", "eng"

  @Prop({ unique: true, sparse: true })
  iso639_3?: string; // Code ISO 3 lettres étendu - Ex: "fan" pour Fang

  @Prop({ required: true, index: true })
  region: string; // Région principale - Ex: "Afrique Centrale", "Europe", "Amérique du Nord"

  @Prop({ type: [String], default: [], index: true })
  countries: string[]; // Pays où la langue est parlée - Ex: ["GA", "GQ", "CM"]

  @Prop({ type: [String], default: [] })
  alternativeNames: string[]; // Autres noms de la langue

  @Prop({ type: [LanguageVariant], default: [] })
  variants: LanguageVariant[]; // Variantes régionales/dialectes

  @Prop({ type: [LanguageScript], default: [] })
  scripts: LanguageScript[]; // Scripts d'écriture supportés

  @Prop({ 
    required: true, 
    enum: ['major', 'regional', 'local', 'liturgical', 'extinct'],
    default: 'local',
    index: true 
  })
  status: string; // Statut de la langue

  @Prop({ 
    required: true, 
    enum: ['active', 'proposed', 'deprecated'],
    default: 'proposed',
    index: true 
  })
  systemStatus: string; // Statut dans le système

  @Prop({ type: Number, default: 0 })
  speakerCount: number; // Nombre approximatif de locuteurs

  @Prop({ 
    enum: ['endangered', 'vulnerable', 'safe', 'unknown'],
    default: 'unknown' 
  })
  endangermentStatus?: string; // Statut d'endangement UNESCO

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Language' })
  parentLanguage?: Language; // Langue parent (pour dialectes)

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Language' }] })
  childLanguages?: Language[]; // Dialectes/variantes

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  proposedBy: User; // Utilisateur qui a proposé la langue

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  approvedBy?: User; // Admin qui a approuvé

  @Prop()
  approvedAt?: Date; // Date d'approbation

  @Prop({ type: String })
  rejectionReason?: string; // Raison du rejet si applicable

  @Prop({ type: String })
  description?: string; // Description de la langue

  @Prop({ type: String })
  wikipediaUrl?: string; // Lien Wikipedia

  @Prop({ type: String })
  ethnologueUrl?: string; // Lien Ethnologue

  @Prop({ type: [String], default: [] })
  sources: string[]; // Sources de référence

  // Statistiques d'usage dans l'application
  @Prop({ type: Number, default: 0 })
  wordCount: number; // Nombre de mots dans cette langue

  @Prop({ type: Number, default: 0 })
  userCount: number; // Nombre d'utilisateurs parlant cette langue

  @Prop({ type: Number, default: 0 })
  contributorCount: number; // Nombre de contributeurs actifs

  @Prop({ type: Number, default: 0 })
  translationCount: number; // Nombre de traductions vers/depuis cette langue

  // Métadonnées techniques
  @Prop({ type: String })
  flagEmoji?: string; // Emoji du drapeau principal

  @Prop({ type: [String], default: [] })
  flagEmojis: string[]; // Emojis des drapeaux des pays

  @Prop({ type: String, default: '#3B82F6' })
  primaryColor: string; // Couleur principale pour l'interface

  @Prop({ type: Boolean, default: true })
  isVisible: boolean; // Visible dans les listes publiques

  @Prop({ type: Boolean, default: false })
  isFeatured: boolean; // Mis en avant sur la plateforme

  @Prop({ type: Number, default: 0 })
  sortOrder: number; // Ordre d'affichage

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const LanguageSchema = SchemaFactory.createForClass(Language);

// Index composites pour les requêtes fréquentes
LanguageSchema.index({ region: 1, status: 1, systemStatus: 1 });
LanguageSchema.index({ countries: 1, systemStatus: 1 });
LanguageSchema.index({ speakerCount: -1, status: 1 });
LanguageSchema.index({ wordCount: -1, systemStatus: 1 });
LanguageSchema.index({ systemStatus: 1, isFeatured: -1, sortOrder: 1 });

// Index de recherche textuelle
LanguageSchema.index({ 
  name: 'text', 
  nativeName: 'text', 
  alternativeNames: 'text' 
});