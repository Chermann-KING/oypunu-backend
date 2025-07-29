import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Conversation } from './conversation.schema';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Conversation;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  senderId: User;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  receiverId: User;

  @Prop({ required: true, maxlength: 1000 })
  content: string;

  @Prop({
    type: String,
    enum: ['text', 'word_share'],
    default: 'text',
  })
  messageType: string;

  @Prop({ type: Object, default: null })
  metadata: Record<string, any>; // Pour les mots partagés, etc.

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date;

  // Timestamps automatiques ajoutés par MongoDB
  createdAt?: Date;
  updatedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Index pour optimiser les requêtes
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });
