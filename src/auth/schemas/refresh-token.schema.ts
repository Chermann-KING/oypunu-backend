/**
 * @fileoverview Schéma Mongoose pour les tokens de rafraîchissement sécurisés
 * 
 * Ce schéma définit la structure des refresh tokens avec fonctionnalités
 * avancées de sécurité : rotation, révocation, tracking, et expiration
 * automatique pour une gestion robuste des sessions utilisateur.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Type document Mongoose pour les refresh tokens
 * 
 * @typedef {RefreshToken & Document} RefreshTokenDocument
 */
export type RefreshTokenDocument = RefreshToken & Document;

/**
 * Schéma des tokens de rafraîchissement avec sécurité avancée
 * 
 * Cette classe définit un système complet de gestion des refresh tokens
 * avec fonctionnalités de sécurité entreprise :
 * 
 * ## Fonctionnalités de sécurité :
 * - Hachage sécurisé des tokens
 * - Rotation automatique pour prévenir les attaques
 * - Révocation granulaire avec traçabilité
 * - Tracking des adresses IP et user agents
 * - Expiration automatique avec TTL MongoDB
 * 
 * ## Cas d'usage :
 * - Renouvellement transparent des tokens JWT
 * - Gestion des sessions longue durée
 * - Déconnexion sécurisée de tous les appareils
 * - Audit de sécurité et détection d'intrusions
 * 
 * @class RefreshToken
 * @version 1.0.0
 */
@Schema({
  timestamps: true,           // Ajoute createdAt et updatedAt automatiquement
  collection: 'refresh_tokens', // Nom de collection MongoDB explicite
})
export class RefreshToken {
  /** Référence vers l'utilisateur propriétaire du token */
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  /** Token hashé de manière sécurisée (jamais en clair) */
  @Prop({ required: true, unique: true, index: true })
  token: string;

  /** Date d'expiration du token */
  @Prop({ required: true })
  expiresAt: Date;

  /** Indicateur de révocation manuelle du token */
  @Prop({ default: false })
  isRevoked: boolean;

  /** Date de révocation si applicable */
  @Prop()
  revokedAt?: Date;

  /** Raison de la révocation (logout, security, etc.) */
  @Prop()
  revokedReason?: string;

  // === INFORMATIONS DE SÉCURITÉ ET TRACKING ===
  
  /** Adresse IP d'origine du token pour détection d'anomalies */
  @Prop()
  ipAddress?: string;

  /** User-Agent du navigateur pour identification d'appareil */
  @Prop()
  userAgent?: string;

  /** Date de dernière utilisation pour audit et nettoyage */
  @Prop()
  lastUsedAt?: Date;

  // === ROTATION DE TOKENS POUR SÉCURITÉ ACCRUE ===
  
  /** Référence vers le nouveau token qui remplace celui-ci */
  @Prop({ type: Types.ObjectId, ref: 'RefreshToken' })
  replacedByToken?: Types.ObjectId;

  /** Référence vers l'ancien token remplacé par celui-ci */
  @Prop({ type: Types.ObjectId, ref: 'RefreshToken' })
  replacesToken?: Types.ObjectId;
}

/**
 * Schéma Mongoose compilé avec index optimisés
 */
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// === INDEX OPTIMISÉS POUR PERFORMANCES ===

// Index composé pour recherche par utilisateur et statut de révocation
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });

// Index TTL pour suppression automatique des tokens expirés
// MongoDB supprime automatiquement les documents expirés
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index pour recherche par token hash (unique déjà défini via @Prop)
// Index pour audit et tracking par IP
RefreshTokenSchema.index({ ipAddress: 1, createdAt: -1 });

// Index pour nettoyage par date de dernière utilisation
RefreshTokenSchema.index({ lastUsedAt: 1 });
