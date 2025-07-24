import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Word } from '../../dictionary/schemas/word.schema';

export type WordVoteDocument = WordVote & Document;

/**
 * 🗳️ SCHÉMA VOTE SUR MOT
 * 
 * Système de votes sophistiqué pour les mots du dictionnaire,
 * inspiré du système communauté mais adapté au contexte linguistique.
 * 
 * Fonctionnalités :
 * - Réactions variées (like, love, helpful, accurate, clear)
 * - Système de poids basé sur réputation utilisateur
 * - Contexte spécifique (définition, prononciation, exemple)
 * - Protection anti-spam et validation
 */
@Schema({
  timestamps: true,
  collection: 'word_votes',
})
export class WordVote {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true })
  wordId: Word;

  @Prop({
    type: String,
    required: true,
    enum: [
      'like',        // J'aime général
      'love',        // J'adore (engagement fort)
      'helpful',     // Utile/instructif
      'accurate',    // Précis/correct
      'clear',       // Clair/bien expliqué
      'funny',       // Amusant/drôle
      'insightful',  // Perspicace/éclairant
      'disagree',    // Pas d'accord (équivalent dislike constructif)
    ],
  })
  reactionType: string;

  @Prop({
    type: String,
    enum: [
      'word',           // Réaction sur le mot global
      'definition',     // Réaction sur une définition spécifique
      'pronunciation',  // Réaction sur la prononciation
      'etymology',      // Réaction sur l'étymologie
      'example',        // Réaction sur un exemple d'usage
      'translation',    // Réaction sur une traduction
    ],
    default: 'word',
  })
  context: string;

  @Prop({ type: String })
  contextId?: string; // ID spécifique (ex: ID d'une définition particulière)

  @Prop({ type: Number, default: 1, min: 0.1, max: 5 })
  weight: number; // Poids basé sur réputation utilisateur (0.1 = débutant, 5 = expert)

  @Prop({ type: String, maxlength: 500 })
  comment?: string; // Commentaire optionnel pour expliquer la réaction

  @Prop({ type: String })
  userAgent?: string; // Pour détecter les bots

  @Prop({ type: String })
  ipAddress?: string; // Pour anti-spam (hashé)

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

// Index pour optimiser les requêtes
export const WordVoteSchema = SchemaFactory.createForClass(WordVote);

// Index unique pour éviter votes multiples sur même contexte
WordVoteSchema.index({ userId: 1, wordId: 1, context: 1, contextId: 1 }, { unique: true });

// Index pour requêtes fréquentes
WordVoteSchema.index({ wordId: 1, reactionType: 1 });
WordVoteSchema.index({ userId: 1, createdAt: -1 });
WordVoteSchema.index({ wordId: 1, createdAt: -1 });
WordVoteSchema.index({ reactionType: 1, weight: -1 });

// Middleware pour mise à jour automatique
WordVoteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Méthodes statiques pour calculs
WordVoteSchema.statics.calculateWordScore = async function(wordId: string) {
  const pipeline = [
    { $match: { wordId: wordId } },
    {
      $group: {
        _id: '$reactionType',
        totalWeight: { $sum: '$weight' },
        count: { $sum: 1 },
      },
    },
  ];
  
  return this.aggregate(pipeline);
};

WordVoteSchema.statics.getTopReactedWords = async function(
  reactionType: string,
  limit: number = 10,
  timeframe?: Date
) {
  const matchStage: any = { reactionType };
  if (timeframe) {
    matchStage.createdAt = { $gte: timeframe };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$wordId',
        totalWeight: { $sum: '$weight' },
        count: { $sum: 1 },
        avgWeight: { $avg: '$weight' },
      },
    },
    { $sort: { totalWeight: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'words',
        localField: '_id',
        foreignField: '_id',
        as: 'word',
      },
    },
  ];

  return this.aggregate(pipeline);
};