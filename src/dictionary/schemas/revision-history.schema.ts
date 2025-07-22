import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type RevisionHistoryDocument = RevisionHistory & Document;

@Schema()
export class ChangeLog {
  @Prop({ required: true })
  field: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  oldValue: any;

  @Prop({ type: MongooseSchema.Types.Mixed })
  newValue: any;

  @Prop({ required: true })
  changeType: 'added' | 'modified' | 'removed';
}

@Schema({ timestamps: true })
export class RevisionHistory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Word', required: true })
  wordId: string;

  @Prop({ required: true })
  version: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  previousVersion: any;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  modifiedBy: User;

  @Prop({ required: true })
  modifiedAt: Date;

  @Prop({ type: [ChangeLog], default: [] })
  changes: ChangeLog[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  newVersion: any;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  adminApprovedBy?: User;

  @Prop()
  adminApprovedAt?: Date;

  @Prop()
  adminNotes?: string;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop()
  rejectionReason?: string;
}

export const RevisionHistorySchema =
  SchemaFactory.createForClass(RevisionHistory);

RevisionHistorySchema.index({ wordId: 1, version: -1 });
RevisionHistorySchema.index({ modifiedBy: 1 });
RevisionHistorySchema.index({ status: 1 });
