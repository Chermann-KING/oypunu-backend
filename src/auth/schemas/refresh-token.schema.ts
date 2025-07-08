import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({
  timestamps: true,
  collection: 'refresh_tokens',
})
export class RefreshToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isRevoked: boolean;

  @Prop()
  revokedAt?: Date;

  @Prop()
  revokedReason?: string;

  // Informations de sécurité
  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  lastUsedAt?: Date;

  // Rotation de tokens pour sécurité accrue
  @Prop({ type: Types.ObjectId, ref: 'RefreshToken' })
  replacedByToken?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RefreshToken' })
  replacesToken?: Types.ObjectId;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Index composé pour optimiser les requêtes
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
