import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CompetitionDocument = Competition & Document;

@Schema({ 
  timestamps: true,
  collection: 'competitions'
})
export class Competition {
  @Prop({ required: true, unique: true })
  competitionId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ 
    required: true, 
    enum: ['daily', 'weekly', 'monthly', 'seasonal', 'special'] 
  })
  type: string;

  @Prop({ 
    required: true, 
    enum: ['contribution', 'social', 'learning', 'mixed'] 
  })
  category: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: 0 })
  participants: number;

  @Prop([{
    rank: { type: Number, required: true },
    type: { 
      type: String, 
      required: true, 
      enum: ['xp', 'badge', 'title', 'currency', 'item', 'premium'] 
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    value: { type: Number, required: true },
    icon: { type: String, required: true },
    rarity: { 
      type: String, 
      required: true, 
      enum: ['common', 'rare', 'epic', 'legendary'] 
    }
  }])
  prizes: Array<{
    rank: number;
    type: string;
    name: string;
    description: string;
    value: number;
    icon: string;
    rarity: string;
  }>;

  @Prop([{
    id: { type: String, required: true },
    description: { type: String, required: true },
    type: { 
      type: String, 
      required: true, 
      enum: ['scoring', 'eligibility', 'behavior'] 
    },
    value: { type: Object, required: true }
  }])
  rules: Array<{
    id: string;
    description: string;
    type: string;
    value: any;
  }>;

  @Prop({ 
    required: true, 
    enum: ['upcoming', 'active', 'ended', 'cancelled'],
    default: 'upcoming'
  })
  status: string;

  @Prop([{
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    profilePicture: { type: String },
    rank: { type: Number, required: true },
    score: { type: Number, required: true },
    metrics: { type: Object, default: {} },
    lastUpdate: { type: Date, default: Date.now },
    streak: { type: Number, default: 0 },
    isQualified: { type: Boolean, default: true }
  }])
  leaderboard: Array<{
    userId: Types.ObjectId;
    username: string;
    profilePicture?: string;
    rank: number;
    score: number;
    metrics: { [key: string]: number };
    lastUpdate: Date;
    streak: number;
    isQualified: boolean;
  }>;

  @Prop({ type: Object, default: {} })
  metadata: {
    minLevel?: number;
    maxParticipants?: number;
    entryFee?: number;
    language?: string;
    difficulty?: string;
  };

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CompetitionSchema = SchemaFactory.createForClass(Competition);

// Index pour les requêtes fréquentes
CompetitionSchema.index({ status: 1, type: 1 });
CompetitionSchema.index({ startDate: 1, endDate: 1 });
CompetitionSchema.index({ category: 1, status: 1 });
CompetitionSchema.index({ 'leaderboard.userId': 1 });