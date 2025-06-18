import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type VoteDocument = Vote & Document;

@Schema({ timestamps: true })
export class Vote {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({
    type: String,
    required: true,
    enum: ['community_post', 'post_comment'],
  })
  targetType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  targetId: any; // ID du post ou du commentaire

  @Prop({
    type: String,
    required: true,
    enum: ['up', 'down'],
  })
  voteType: 'up' | 'down';

  @Prop({ type: String, maxlength: 500 })
  reason?: string; // Raison optionnelle pour les downvotes

  @Prop({ type: Number, default: 1 })
  weight: number; // Poids du vote basé sur la réputation (futur)
}

export const VoteSchema = SchemaFactory.createForClass(Vote);

// Index composé pour éviter les votes multiples du même utilisateur sur le même contenu
VoteSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

// Index pour les requêtes de recherche par type et cible
VoteSchema.index({ targetType: 1, targetId: 1 });
VoteSchema.index({ voteType: 1 });
