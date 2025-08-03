/**
 * @fileoverview Schéma Mongoose pour les communautés O'Ypunu
 * 
 * Ce schéma définit la structure des communautés avec support complet
 * pour la recherche textuelle, filtrage par langue et tags, et gestion
 * des permissions publiques/privées. Il inclut des index optimisés
 * pour les performances de recherche et découverte.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

/**
 * Type document Mongoose pour les communautés
 * @typedef {Community & Document} CommunityDocument
 */
export type CommunityDocument = Community & Document;

/**
 * Schéma de communauté O'Ypunu
 * 
 * Représente une communauté linguistique avec toutes ses métadonnées,
 * configuration de visibilité et informations de gestion. Les communautés
 * sont le cœur social de la plateforme pour organiser les discussions
 * par langue et thématique.
 * 
 * @class Community
 * @version 1.0.0
 */
@Schema({ timestamps: true })
export class Community {
  /**
   * Nom de la communauté (requis, unique par langue)
   * @type {string}
   * @example "Apprendre le Yipunu"
   */
  @Prop({ required: true })
  name: string;

  /**
   * Code de langue principale de la communauté (requis)
   * @type {string}
   * @example "yipunu", "fr", "en"
   */
  @Prop({ required: true })
  language: string;

  /**
   * Description détaillée de la communauté
   * @type {string}
   * @example "Communauté dédiée à l'apprentissage de la langue Yipunu..."
   */
  @Prop({ type: String })
  description: string;

  /**
   * Nombre de membres actifs (calculé automatiquement)
   * @type {number}
   * @default 0
   */
  @Prop({ default: 0 })
  memberCount: number;

  /**
   * Référence vers l'utilisateur créateur (admin initial)
   * @type {User}
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: User;

  /**
   * Tags thématiques pour catégorisation et recherche
   * @type {string[]}
   * @default []
   * @example ["débutant", "grammaire", "culture"]
   */
  @Prop({ type: [String], default: [] })
  tags: string[];

  /**
   * Indicateur de visibilité (publique ou privée)
   * @type {boolean}
   * @default false
   */
  @Prop({ default: false })
  isPrivate: boolean;

  /**
   * URL de l'image de couverture de la communauté
   * @type {string}
   * @example "https://cdn.oypunu.com/communities/cover_123.jpg"
   */
  @Prop({ type: String })
  coverImage: string;
}

/**
 * Schéma Mongoose généré pour les communautés
 * @constant {MongooseSchema}
 */
export const CommunitySchema = SchemaFactory.createForClass(Community);

/**
 * Index optimisés pour les performances de recherche et découverte
 * 
 * - Index textuel combiné sur nom et description pour recherche full-text
 * - Index simple sur langue pour filtrage par code linguistique
 * - Index sur tags pour recherche thématique rapide  
 * - Index sur visibilité pour filtrage public/privé efficace
 */
CommunitySchema.index({ name: 'text', description: 'text' });
CommunitySchema.index({ language: 1 });
CommunitySchema.index({ tags: 1 });
CommunitySchema.index({ isPrivate: 1 });
