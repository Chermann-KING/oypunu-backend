import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    required: true,
    validate: {
      validator: function (v: any[]) {
        return v.length === 2; // Conversation entre 2 utilisateurs uniquement
      },
      message: 'Une conversation doit avoir exactement 2 participants',
    },
  })
  participants: User[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Message',
    default: null,
  })
  lastMessage: any; // Référence au dernier message

  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Index pour optimiser les recherches de conversations
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastActivity: -1 });
