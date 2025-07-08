import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type ContributorRequestDocument = ContributorRequest & Document;

export enum ContributorRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  UNDER_REVIEW = 'under_review',
}

export enum ContributorRequestPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({
  timestamps: true,
  collection: 'contributor_requests',
})
export class ContributorRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  username: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({
    required: true,
    minlength: 50,
    maxlength: 1000,
    trim: true,
  })
  motivation: string;

  @Prop({
    maxlength: 500,
    trim: true,
    default: '',
  })
  experience: string;

  @Prop({
    maxlength: 200,
    trim: true,
    default: '',
  })
  languages: string;

  @Prop({ required: true, default: true })
  commitment: boolean;

  @Prop({
    type: String,
    enum: ContributorRequestStatus,
    default: ContributorRequestStatus.PENDING,
    index: true,
  })
  status: ContributorRequestStatus;

  @Prop({
    type: String,
    enum: ContributorRequestPriority,
    default: ContributorRequestPriority.MEDIUM,
    index: true,
  })
  priority: ContributorRequestPriority;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop({
    maxlength: 500,
    trim: true,
  })
  reviewNotes?: string;

  @Prop({
    maxlength: 500,
    trim: true,
  })
  rejectionReason?: string;

  // Métadonnées pour le suivi
  @Prop({ default: 0 })
  reviewCount: number;

  @Prop([
    {
      action: { type: String, required: true },
      performedBy: { type: Types.ObjectId, ref: 'User', required: true },
      performedAt: { type: Date, default: Date.now },
      notes: { type: String, maxlength: 300 },
      oldStatus: { type: String, enum: ContributorRequestStatus },
      newStatus: { type: String, enum: ContributorRequestStatus },
    },
  ])
  activityLog: Array<{
    action: string;
    performedBy: Types.ObjectId;
    performedAt: Date;
    notes?: string;
    oldStatus?: ContributorRequestStatus;
    newStatus?: ContributorRequestStatus;
  }>;

  // Informations pour l'évaluation
  @Prop({ default: 0, min: 0, max: 100 })
  evaluationScore?: number;

  @Prop([String])
  evaluationCriteria?: string[];

  @Prop({ type: Map, of: Number })
  skillsAssessment?: Map<string, number>;

  // Données du profil utilisateur au moment de la demande (pour historique)
  @Prop({ default: 0 })
  userWordsCount: number;

  @Prop({ default: 0 })
  userCommunityPostsCount: number;

  @Prop()
  userJoinDate?: Date;

  @Prop([String])
  userNativeLanguages: string[];

  @Prop([String])
  userLearningLanguages: string[];

  // Flags pour l'administration
  @Prop({ default: false })
  isHighPriority: boolean;

  @Prop({ default: false })
  requiresSpecialReview: boolean;

  @Prop({ default: false })
  isRecommended: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  recommendedBy?: Types.ObjectId;

  @Prop({
    maxlength: 300,
    trim: true,
  })
  recommendationNotes?: string;

  // Informations de contact supplémentaires
  @Prop({
    maxlength: 100,
    trim: true,
  })
  linkedIn?: string;

  @Prop({
    maxlength: 100,
    trim: true,
  })
  github?: string;

  @Prop({
    maxlength: 200,
    trim: true,
  })
  portfolio?: string;

  // Date d'expiration de la demande
  @Prop()
  expiresAt?: Date;

  // Notification flags
  @Prop({ default: false })
  applicantNotified: boolean;

  @Prop()
  lastNotificationSent?: Date;
}

export const ContributorRequestSchema =
  SchemaFactory.createForClass(ContributorRequest);

// Indexes pour les performances
ContributorRequestSchema.index({ status: 1, createdAt: -1 });
ContributorRequestSchema.index({ userId: 1, status: 1 });
ContributorRequestSchema.index({ reviewedBy: 1, reviewedAt: -1 });
ContributorRequestSchema.index({ priority: 1, status: 1, createdAt: -1 });
ContributorRequestSchema.index({ isHighPriority: 1, status: 1 });
ContributorRequestSchema.index({ expiresAt: 1 });

// Index composé pour la pagination efficace
ContributorRequestSchema.index({
  status: 1,
  priority: -1,
  createdAt: -1,
});

// Index de recherche textuelle
ContributorRequestSchema.index({
  username: 'text',
  email: 'text',
  motivation: 'text',
  experience: 'text',
  languages: 'text',
});

// Middleware pour définir l'expiration automatique (30 jours)
ContributorRequestSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
  }
  next();
});

// Méthode pour ajouter une entrée au log d'activité
ContributorRequestSchema.methods.addActivityLog = function (
  action: string,
  performedBy: Types.ObjectId,
  notes?: string,
  oldStatus?: ContributorRequestStatus,
  newStatus?: ContributorRequestStatus,
) {
  this.activityLog.push({
    action,
    performedBy,
    performedAt: new Date(),
    notes,
    oldStatus,
    newStatus,
  });
};

// Méthode pour calculer l'ancienneté de la demande
ContributorRequestSchema.methods.getDaysOld = function (): number {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor(
    (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
  );
};

// Méthode pour vérifier si la demande va expirer bientôt
ContributorRequestSchema.methods.isExpiringSoon = function (
  days: number = 7,
): boolean {
  if (!this.expiresAt) return false;
  const now = new Date();
  const daysUntilExpiry = Math.floor(
    (this.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysUntilExpiry <= days && daysUntilExpiry > 0;
};

// Méthode pour vérifier si la demande est expirée
ContributorRequestSchema.methods.isExpired = function (): boolean {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};
