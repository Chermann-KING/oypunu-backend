import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type LikeDocument = Like & Document;

@Schema({ timestamps: true })
export class Like {
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
}

export const LikeSchema = SchemaFactory.createForClass(Like);

// Index composite pour éviter les doublons (un utilisateur ne peut liker qu'une fois)
LikeSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
