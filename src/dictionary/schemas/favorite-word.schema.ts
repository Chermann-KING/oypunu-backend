import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Word } from './word.schema';

export type FavoriteWordDocument = FavoriteWord & Document;

@Schema({ timestamps: true })
export class FavoriteWord {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true })
  wordId: Word;

  @Prop({ type: Date, default: Date.now })
  addedAt: Date;
}

export const FavoriteWordSchema = SchemaFactory.createForClass(FavoriteWord);
// Index composite unique pour éviter les doublons
FavoriteWordSchema.index({ userId: 1, wordId: 1 }, { unique: true });
