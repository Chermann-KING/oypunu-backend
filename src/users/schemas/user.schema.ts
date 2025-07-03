import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Language } from '../../languages/schemas/language.schema';

export type UserDocument = User & Document;

// Enum pour les rôles avec hiérarchie
export enum UserRole {
  USER = 'user',
  CONTRIBUTOR = 'contributor',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin',
}

@Schema({ timestamps: true })
export class User {
  _id: string;
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ type: String, required: false, default: null })
  emailVerificationToken: string;

  @Prop({ type: Date, required: false, default: null })
  emailVerificationTokenExpires: Date;

  @Prop({ type: String, required: false, default: null })
  passwordResetToken: string;

  @Prop({ type: Date, required: false, default: null })
  passwordResetTokenExpires: Date;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
  })
  role: UserRole;

  @Prop()
  profilePicture: string;

  @Prop({ type: Date, default: Date.now })
  lastActive: Date;

  @Prop({ type: [String], default: [] })
  favoriteWords: string[];

  // NOUVEAU: Références vers la collection Languages
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Language' })
  nativeLanguageId?: Language;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Language' }], default: [] })
  learningLanguageIds: Language[];

  // DURANT LA MIGRATION: Anciens champs pour compatibilité (à supprimer après migration)
  @Prop()
  nativeLanguage?: string;

  @Prop({ type: [String], default: [] })
  learningLanguages?: string[];

  @Prop({ type: Object, default: {} })
  socialProviders: Record<string, string>;

  @Prop({ type: String, maxlength: 500 })
  bio: string;

  @Prop({ type: Date })
  dateOfBirth: Date;

  @Prop({ type: String })
  location: string;

  @Prop({ type: String })
  website: string;

  @Prop({ type: Boolean, default: true })
  isProfilePublic: boolean;

  @Prop({ type: Number, default: 0 })
  totalWordsAdded: number;

  @Prop({ type: Number, default: 0 })
  totalCommunityPosts: number;

  // Nouveaux champs pour l'administration
  @Prop({ type: Boolean, default: false })
  isActive: boolean;

  @Prop({ type: Boolean, default: false })
  isSuspended: boolean;

  @Prop({ type: Date })
  suspendedUntil?: Date;

  @Prop({ type: String })
  suspensionReason?: string;

  @Prop({ type: String })
  notes?: string; // Notes internes pour les admins

  @Prop({ type: Date })
  lastLogin?: Date;

  @Prop({ type: String })
  registrationIP?: string;

  @Prop({ type: String })
  lastIP?: string;

  // Permissions spéciales (pour les contributeurs)
  @Prop({ type: [String], default: [] })
  permissions: string[]; // ex: ['moderate_words', 'moderate_communities']
}

export const UserSchema = SchemaFactory.createForClass(User);
