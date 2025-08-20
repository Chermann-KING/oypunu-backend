/**
 * @fileoverview Schéma Mongoose pour les catégories du dictionnaire O'Ypunu
 * 
 * Ce schéma définit la structure des catégories pour l'organisation
 * hiérarchique des mots avec support multilingue, statut d'activation
 * et ordre d'affichage personnalisable avec migration progressive.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { Language } from "../../languages/schemas/language.schema";
import { User } from "../../users/schemas/user.schema";

/**
 * Type document Mongoose pour les catégories
 * @typedef {Category & Document} CategoryDocument
 */
export type CategoryDocument = Category & Document;

/**
 * Schéma de catégorie O'Ypunu
 * 
 * Représente une catégorie thématique pour l'organisation des mots
 * avec support multilingue, activation conditionnelle et ordre
 * d'affichage personnalisable pour interface utilisateur optimisée.
 * 
 * @class Category
 * @version 1.0.0
 */
@Schema({ timestamps: true })
export class Category {
  /**
   * Nom de la catégorie (requis)
   * @type {string}
   * @example "Greetings" ou "Salutations"
   */
  @Prop({ required: true })
  name: string;

  /**
   * Description optionnelle de la catégorie
   * @type {string}
   * @optional
   * @example "Mots et expressions pour saluer et prendre congé"
   */
  @Prop()
  description?: string;

  /**
   * Référence vers la langue de la catégorie (nouveau système)
   * @type {Language}
   * @optional
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Language", index: true })
  languageId?: Language;

  /**
   * Langue de la catégorie (ancien système, compatibilité migration)
   * @type {string}
   * @optional
   * @deprecated À supprimer après migration complète vers languageId
   */
  @Prop({ index: true })
  language?: string;

  /**
   * Statut d'activation de la catégorie
   * @type {boolean}
   * @default true
   */
  @Prop({ default: true })
  isActive?: boolean;

  /**
   * Ordre d'affichage pour interface utilisateur
   * @type {number}
   * @default 0
   */
  @Prop({ default: 0 })
  order?: number;

  /**
   * Statut système de la catégorie (workflow d'approbation)
   * @type {string}
   * @enum {string} 'pending' | 'active' | 'rejected'
   * @default 'active'
   */
  @Prop({ 
    type: String, 
    enum: ['pending', 'active', 'rejected'], 
    default: 'active',
    index: true 
  })
  systemStatus?: string;

  /**
   * Utilisateur qui a proposé la catégorie
   * @type {User}
   * @optional
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  proposedBy?: User;

  /**
   * Utilisateur qui a approuvé/rejeté la catégorie
   * @type {User}
   * @optional
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  moderatedBy?: User;

  /**
   * Date d'approbation/rejet
   * @type {Date}
   * @optional
   */
  @Prop()
  moderatedAt?: Date;

  /**
   * Notes d'approbation/rejet
   * @type {string}
   * @optional
   */
  @Prop()
  moderationNotes?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
