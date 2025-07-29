import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type RevisionHistoryDocument = RevisionHistory & Document;

/**
 * Schéma pour l'historique des révisions des mots
 * Suit les patterns de l'application pour le suivi des modifications
 */
@Schema({ timestamps: true })
export class RevisionHistory {
  /**
   * ID du mot modifié
   */
  @Prop({ required: true, type: Types.ObjectId, ref: "Word", index: true })
  wordId: Types.ObjectId;

  /**
   * Numéro de version de cette révision
   */
  @Prop({ required: true, type: Number, default: 1 })
  version: number;

  /**
   * Modifications proposées (format JSON)
   */
  @Prop({ required: true, type: Object })
  changes: Record<string, any>;

  /**
   * Utilisateur qui a proposé/effectué la modification
   */
  @Prop({ required: true, type: Types.ObjectId, ref: "User", index: true })
  modifiedBy: Types.ObjectId;

  /**
   * Date de création de la révision
   */
  @Prop({ required: true, type: Date, default: Date.now, index: true })
  modifiedAt: Date;

  /**
   * Statut de la révision
   */
  @Prop({
    required: true,
    type: String,
    enum: ["pending", "approved", "rejected", "cancelled"],
    default: "pending",
    index: true,
  })
  status: "pending" | "approved" | "rejected" | "cancelled";

  /**
   * Type d'action effectuée
   */
  @Prop({
    type: String,
    enum: ["create", "update", "delete", "restore"],
    default: "update",
    index: true,
  })
  action: "create" | "update" | "delete" | "restore";

  /**
   * Commentaire expliquant la révision
   */
  @Prop({ type: String, maxlength: 1000 })
  comment?: string;

  /**
   * Raison de la révision
   */
  @Prop({ type: String, maxlength: 500 })
  reason?: string;

  /**
   * Utilisateur qui a approuvé/rejeté la révision
   */
  @Prop({ type: Types.ObjectId, ref: "User" })
  reviewedBy?: Types.ObjectId;

  /**
   * Date de review
   */
  @Prop({ type: Date })
  reviewedAt?: Date;

  /**
   * Notes du reviewer
   */
  @Prop({ type: String, maxlength: 1000 })
  reviewNotes?: string;

  // Propriétés d'administration
  @Prop({ type: Types.ObjectId, ref: "User" })
  adminApprovedBy?: Types.ObjectId;

  @Prop()
  adminApprovedAt?: Date;

  @Prop()
  adminNotes?: string;

  // Métadonnées supplémentaires
  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  /**
   * Priorité de la révision
   */
  @Prop({
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  })
  priority: "low" | "medium" | "high" | "urgent";

  /**
   * Tags pour catégoriser les révisions
   */
  @Prop({ type: [String], default: [] })
  tags: string[];

  /**
   * Estimation du temps de traitement (en minutes)
   */
  @Prop({ type: Number, min: 0 })
  estimatedProcessingTime?: number;

  /**
   * Temps réel de traitement (en minutes)
   */
  @Prop({ type: Number, min: 0 })
  actualProcessingTime?: number;
}

export const RevisionHistorySchema =
  SchemaFactory.createForClass(RevisionHistory);

// Index composés pour optimiser les requêtes
RevisionHistorySchema.index({ wordId: 1, version: -1 });
RevisionHistorySchema.index({ modifiedBy: 1, modifiedAt: -1 });
RevisionHistorySchema.index({ status: 1, modifiedAt: -1 });
RevisionHistorySchema.index({ status: 1, priority: -1, modifiedAt: -1 });

// Index pour les recherches par texte
RevisionHistorySchema.index({
  comment: "text",
  reason: "text",
  reviewNotes: "text",
});
