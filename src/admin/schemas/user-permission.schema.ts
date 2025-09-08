/**
 * @fileoverview Schéma Mongoose pour les permissions utilisateur
 *
 * Ce schéma définit la structure des permissions contextuelles accordées
 * aux utilisateurs avec traçabilité complète des actions d'administration.
 * Il supporte les permissions globales et contextuelles avec historique.
 *
 * @author Équipe O'Ypunu Backend
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { User } from "../../users/schemas/user.schema";

/**
 * Type document Mongoose pour les permissions utilisateur
 * @typedef {UserPermission & Document} UserPermissionDocument
 */
export type UserPermissionDocument = UserPermission & Document;

/**
 * Schéma de permission utilisateur avec traçabilité complète
 *
 * Représente une permission accordée ou révoquée à un utilisateur
 * avec support pour les permissions contextuelles et l'audit complet.
 *
 * @class UserPermission
 * @version 1.0.0
 */
@Schema({ timestamps: true })
export class UserPermission {
  /**
   * Référence vers l'utilisateur qui possède la permission
   * @type {User}
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  })
  userId: User;

  /**
   * Nom de la permission accordée
   * @type {string}
   * @example "MODERATE_CONTENT", "VIEW_USERS", "MANAGE_COMMUNITIES"
   */
  @Prop({
    required: true,
    index: true,
  })
  permission: string;

  /**
   * Contexte optionnel de la permission
   * @type {string}
   * @example "community", "global", "language"
   */
  @Prop({
    type: String,
    index: true,
  })
  context?: string;

  /**
   * ID du contexte spécifique (si applicable)
   * @type {string}
   * @example "communityId123", "languageId456"
   */
  @Prop({ type: String })
  contextId?: string;

  /**
   * Statut actuel de la permission
   * @type {boolean}
   * @default true
   */
  @Prop({
    default: true,
    index: true,
  })
  granted: boolean;

  /**
   * Date d'octroi de la permission
   * @type {Date}
   */
  @Prop({
    required: true,
    default: Date.now,
  })
  grantedAt: Date;

  /**
   * Référence vers l'admin qui a accordé la permission
   * @type {User}
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true,
  })
  grantedBy: User;

  /**
   * Date de révocation de la permission (si applicable)
   * @type {Date}
   */
  @Prop({ type: Date })
  revokedAt?: Date;

  /**
   * Référence vers l'admin qui a révoqué la permission
   * @type {User}
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
  })
  revokedBy?: User;

  /**
   * Métadonnées additionnelles de la permission
   * @type {object}
   */
  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: {},
  })
  metadata: Record<string, any>;
}

/**
 * Schéma Mongoose généré pour les permissions utilisateur
 * @constant {MongooseSchema}
 */
export const UserPermissionSchema =
  SchemaFactory.createForClass(UserPermission);

/**
 * Index composés pour optimiser les requêtes fréquentes
 *
 * - Index sur userId + permission pour vérifications rapides
 * - Index sur userId + granted pour récupérer permissions actives
 * - Index sur permission + context pour recherche par type
 * - Index sur grantedAt pour tri temporel
 */
UserPermissionSchema.index({ userId: 1, permission: 1 });
UserPermissionSchema.index({ userId: 1, granted: 1 });
UserPermissionSchema.index({ permission: 1, context: 1 });
UserPermissionSchema.index({ grantedAt: -1 });
UserPermissionSchema.index({ userId: 1, granted: 1, permission: 1 });
