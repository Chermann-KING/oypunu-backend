/**
 * @fileoverview Schéma Mongoose pour les messages de messagerie O'Ypunu
 * 
 * Ce schéma définit la structure des messages avec support pour différents
 * types de contenu, métadonnées extensibles, statuts de lecture et
 * suppression soft. Il inclut des index optimisés pour les requêtes
 * fréquentes de récupération de messages par conversation.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Conversation } from './conversation.schema';

/**
 * Type document Mongoose pour les messages
 * @typedef {Message & Document} MessageDocument
 */
export type MessageDocument = Message & Document;

/**
 * Schéma de message O'Ypunu
 * 
 * Représente un message individuel dans une conversation avec support
 * complet pour différents types de contenu, suivi de lecture et
 * intégrations avec le système de dictionnaire O'Ypunu.
 * 
 * @class Message
 * @version 1.0.0
 */
@Schema({ timestamps: true })
export class Message {
  /**
   * Référence vers la conversation parente (requis)
   * @type {Conversation}
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Conversation;

  /**
   * Référence vers l'utilisateur expéditeur (requis)
   * @type {User}
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  senderId: User;

  /**
   * Référence vers l'utilisateur destinataire (requis)
   * @type {User}
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  receiverId: User;

  /**
   * Contenu textuel du message (max 1000 caractères)
   * @type {string}
   * @maxLength 1000
   */
  @Prop({ required: true, maxlength: 1000 })
  content: string;

  /**
   * Type de message pour différencier le contenu
   * @type {string}
   * @enum ['text', 'word_share']
   * @default 'text'
   */
  @Prop({
    type: String,
    enum: ['text', 'word_share'],
    default: 'text',
  })
  messageType: string;

  /**
   * Métadonnées extensibles pour enrichissements
   * - word_share: informations du mot partagé
   * - language: langue du message si spécifiée
   * - translation: traduction automatique si applicable
   * @type {Record<string, any>}
   * @default null
   */
  @Prop({ type: Object, default: null })
  metadata: Record<string, any>;

  /**
   * Indicateur de lecture du message
   * @type {boolean}
   * @default false
   */
  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  /**
   * Horodatage de lecture du message
   * @type {Date}
   * @default null
   */
  @Prop({ type: Date, default: null })
  readAt: Date;

  /**
   * Indicateur de suppression soft du message
   * @type {boolean}
   * @default false
   */
  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  /**
   * Horodatage de suppression du message
   * @type {Date}
   * @default null
   */
  @Prop({ type: Date, default: null })
  deletedAt: Date;

  /**
   * Date de création automatique (MongoDB timestamps)
   * @type {Date}
   */
  createdAt?: Date;

  /**
   * Date de mise à jour automatique (MongoDB timestamps)
   * @type {Date}
   */
  updatedAt?: Date;
}

/**
 * Schéma Mongoose généré pour les messages
 * @constant {MongooseSchema}
 */
export const MessageSchema = SchemaFactory.createForClass(Message);

/**
 * Index optimisés pour les performances de messagerie
 * 
 * - conversationId + createdAt : Récupération chronologique des messages par conversation
 * - senderId : Messages envoyés par un utilisateur spécifique
 * - receiverId + isRead : Messages non lus pour un utilisateur (notifications)
 */
MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ receiverId: 1, isRead: 1 });
