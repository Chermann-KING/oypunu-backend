import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from './user.schema';
import { Word } from '../../dictionary/schemas/word.schema';

export type WordViewDocument = WordView & Document;

@Schema({ timestamps: true })
export class WordView {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true, index: true })
  wordId: Word;

  @Prop({ type: String, required: true })
  word: string; // Cache du nom du mot pour éviter les lookups

  @Prop({ type: String, required: true })
  language: string; // Cache de la langue

  @Prop({ type: Date, default: Date.now, index: true })
  viewedAt: Date;

  @Prop({ type: String, enum: ['search', 'direct', 'favorite', 'recommendation'], default: 'direct' })
  viewType: string; // Comment l'utilisateur a trouvé ce mot

  @Prop({ type: Number, default: 1 })
  viewCount: number; // Nombre de fois que l'utilisateur a consulté ce mot

  @Prop({ type: Date, default: Date.now })
  lastViewedAt: Date; // Dernière consultation
}

export const WordViewSchema = SchemaFactory.createForClass(WordView);

// Index composites pour les requêtes fréquentes
WordViewSchema.index({ userId: 1, viewedAt: -1 }); // Récupérer les consultations récentes d'un utilisateur
WordViewSchema.index({ userId: 1, wordId: 1 }, { unique: true }); // Un seul enregistrement par utilisateur/mot
WordViewSchema.index({ wordId: 1, viewedAt: -1 }); // Mots les plus consultés