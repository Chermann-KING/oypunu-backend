import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { CommunityPost } from './community-post.schema';
import { User } from '../../users/schemas/user.schema';

export type PostCommentDocument = PostComment & Document;

@Schema({ timestamps: true })
export class PostComment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'CommunityPost',
    required: true,
  })
  postId: CommunityPost;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  authorId: User;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  content: string;

  // Système de score StackOverflow
  @Prop({ default: 0 })
  score: number; // Score total (upvotes - downvotes)

  @Prop({ default: 0 })
  upvotes: number; // Nombre de votes positifs

  @Prop({ default: 0 })
  downvotes: number; // Nombre de votes négatifs

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'PostComment' })
  parentCommentId: PostComment; // Pour les réponses à un commentaire

  @Prop({ default: 0 })
  repliesCount: number; // Nombre de réponses à ce commentaire

  // Champs de qualité et modération
  @Prop({
    type: String,
    enum: ['active', 'deleted', 'hidden'],
    default: 'active',
  })
  status: string;

  @Prop({ type: Boolean, default: false })
  isAccepted: boolean; // Commentaire accepté comme réponse (pour les questions)

  @Prop({ type: Boolean, default: false })
  isHighQuality: boolean; // Marqué comme commentaire de haute qualité

  @Prop({ type: Boolean, default: false })
  isPinned: boolean; // Commentaire épinglé par les modérateurs

  // Métadonnées pour l'apprentissage linguistique
  @Prop({
    type: String,
    enum: ['correction', 'explanation', 'example', 'translation', 'general'],
    default: 'general',
  })
  commentType: string; // Type de commentaire linguistique

  @Prop({ type: [String], default: [] })
  mentionedWords: string[]; // Mots mentionnés dans le commentaire (pour indexation)

  @Prop({ type: Boolean, default: false })
  containsCorrection: boolean; // Le commentaire contient des corrections linguistiques
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);

// Middleware pour mettre à jour le post parent lors de la création/suppression
PostCommentSchema.post('save', async function () {
  if (this.isNew && this.status === 'active') {
    // Incrémenter le compteur de commentaires du post parent
    await this.model('CommunityPost').findByIdAndUpdate(this.postId, {
      $inc: { commentsCount: 1 },
      $set: { lastActivityAt: new Date() },
    });

    // Si c'est une réponse à un commentaire, incrémenter le compteur de réponses
    if (this.parentCommentId) {
      await this.model('PostComment').findByIdAndUpdate(this.parentCommentId, {
        $inc: { repliesCount: 1 },
      });
    }
  }
});

// Index pour la recherche et le tri
PostCommentSchema.index({ postId: 1, score: -1 }); // Tri par score
PostCommentSchema.index({ postId: 1, createdAt: -1 }); // Tri par date
PostCommentSchema.index({ postId: 1, isAccepted: -1, score: -1 }); // Réponses acceptées en premier
PostCommentSchema.index({ parentCommentId: 1, createdAt: 1 }); // Réponses triées par date
PostCommentSchema.index({ authorId: 1, createdAt: -1 }); // Commentaires par utilisateur
PostCommentSchema.index({ status: 1 });
PostCommentSchema.index({ commentType: 1 });
PostCommentSchema.index({ mentionedWords: 1 });
