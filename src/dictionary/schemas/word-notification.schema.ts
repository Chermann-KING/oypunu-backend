import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type WordNotificationDocument = WordNotification & Document;

@Schema({ timestamps: true })
export class WordNotification {
  @Prop({ required: true })
  type:
    | 'word_revision'
    | 'word_approved'
    | 'word_rejected'
    | 'revision_approved'
    | 'revision_rejected';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true })
  wordId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  targetUserId: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  triggeredBy?: User;

  @Prop({ required: true })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ type: Object })
  metadata?: {
    wordName?: string;
    revisionVersion?: number;
    changes?: string[];
  };
}

export const WordNotificationSchema =
  SchemaFactory.createForClass(WordNotification);

// Index pour améliorer les performances
WordNotificationSchema.index({ targetUserId: 1, isRead: 1 });
WordNotificationSchema.index({ wordId: 1 });
WordNotificationSchema.index({ type: 1 });
WordNotificationSchema.index({ createdAt: -1 });
