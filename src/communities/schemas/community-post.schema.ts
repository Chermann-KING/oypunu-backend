import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Community } from './community.schema';
import { User } from '../../users/schemas/user.schema';

export type CommunityPostDocument = CommunityPost & Document;

@Schema({ timestamps: true })
export class CommunityPost {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Community',
    required: true,
  })
  communityId: Community;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  authorId: User;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, maxlength: 5000 })
  content: string;

  // Système de score StackOverflow
  @Prop({ default: 0 })
  score: number; // Score total (upvotes - downvotes)

  @Prop({ default: 0 })
  upvotes: number; // Nombre de votes positifs

  @Prop({ default: 0 })
  downvotes: number; // Nombre de votes négatifs

  @Prop({ default: 0 })
  views: number; // Nombre de vues

  @Prop({ default: 0 })
  commentsCount: number;

  // Système anti-triche pour les vues
  @Prop({ type: [String], default: [] })
  viewersToday: string[]; // IDs des utilisateurs qui ont vu le post aujourd'hui

  @Prop({ type: Date })
  lastViewersReset: Date; // Dernière fois que la liste viewersToday a été réinitialisée

  @Prop({
    type: [String],
    default: [],
    validate: [(val) => val.length <= 5, 'Maximum 5 tags allowed'],
  })
  tags: string[];

  // Champs de qualité et modération
  @Prop({
    type: String,
    enum: ['active', 'locked', 'archived', 'deleted'],
    default: 'active',
  })
  status: string;

  @Prop({ type: Boolean, default: false })
  isPinned: boolean; // Post épinglé par les modérateurs

  @Prop({ type: Boolean, default: false })
  isHighQuality: boolean; // Marqué comme contenu de haute qualité

  @Prop({ type: Date })
  lastActivityAt: Date; // Dernière activité (post, commentaire)

  // Informations linguistiques spécifiques
  @Prop({
    type: String,
    enum: [
      'question',
      'explanation',
      'etymology',
      'usage',
      'translation',
      'discussion',
    ],
    required: true,
  })
  postType: string; // Type de post linguistique

  @Prop({ type: [String], default: [] })
  languages: string[]; // Langues concernées par le post

  @Prop({ type: String, maxlength: 100 })
  targetWord?: string; // Mot principal du post (pour les questions/explications)

  @Prop({
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  })
  difficulty: string; // Niveau de difficulté
}

export const CommunityPostSchema = SchemaFactory.createForClass(CommunityPost);

// Middleware pour mettre à jour lastActivityAt
CommunityPostSchema.pre('save', function (next) {
  this.lastActivityAt = new Date();
  next();
});

// Index pour la recherche et le tri
CommunityPostSchema.index({ communityId: 1, score: -1 }); // Tri par score
CommunityPostSchema.index({ communityId: 1, createdAt: -1 }); // Tri par date
CommunityPostSchema.index({ communityId: 1, lastActivityAt: -1 }); // Tri par activité
CommunityPostSchema.index({
  title: 'text',
  content: 'text',
  targetWord: 'text',
}); // Recherche textuelle
CommunityPostSchema.index({ tags: 1 });
CommunityPostSchema.index({ postType: 1 });
CommunityPostSchema.index({ languages: 1 });
CommunityPostSchema.index({ status: 1 });
CommunityPostSchema.index({ isPinned: -1, score: -1 }); // Posts épinglés en premier
