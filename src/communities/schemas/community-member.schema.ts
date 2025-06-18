import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Community } from './community.schema';
import { User } from '../../users/schemas/user.schema';

export type CommunityMemberDocument = CommunityMember & Document;

@Schema({ timestamps: true })
export class CommunityMember {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Community',
    required: true,
  })
  communityId: Community;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: User;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;

  @Prop({
    type: String,
    enum: ['member', 'moderator', 'admin'],
    default: 'member',
  })
  role: string;
}

export const CommunityMemberSchema =
  SchemaFactory.createForClass(CommunityMember);

// Index composite pour éviter les doublons et accélérer les recherches
CommunityMemberSchema.index({ communityId: 1, userId: 1 }, { unique: true });
