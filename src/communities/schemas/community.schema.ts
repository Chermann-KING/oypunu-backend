import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type CommunityDocument = Community & Document;

@Schema({ timestamps: true })
export class Community {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  language: string;

  @Prop({ type: String })
  description: string;

  @Prop({ default: 0 })
  memberCount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: User;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ type: String })
  coverImage: string;
}

export const CommunitySchema = SchemaFactory.createForClass(Community);

// Ajouter des index pour améliorer les performances de recherche
CommunitySchema.index({ name: 'text', description: 'text' });
CommunitySchema.index({ language: 1 });
CommunitySchema.index({ tags: 1 });
CommunitySchema.index({ isPrivate: 1 });
