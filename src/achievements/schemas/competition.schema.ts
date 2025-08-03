/**
 * @fileoverview Schéma Mongoose pour les compétitions et défis gamifiés
 *
 * Ce schéma définit la structure des compétitions temporaires qui motivent
 * les utilisateurs à participer activement à travers des défis et classements.
 * Supporte différents types de compétitions avec systèmes de prix et règles personnalisés.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

/**
 * Type document MongoDB pour les compétitions
 *
 * @typedef {Competition & Document} CompetitionDocument
 */
export type CompetitionDocument = Competition & Document;

/**
 * Schéma de données pour les compétitions et défis temporaires
 *
 * Une compétition est un événement gamifié limité dans le temps qui encourage
 * la participation des utilisateurs à travers des objectifs spécifiques,
 * des classements en temps réel et un système de récompenses.
 *
 * @class Competition
 * @version 1.0.0
 */
@Schema({
  timestamps: true,
  collection: "competitions",
})
export class Competition {
  /**
   * Identifiant unique de la compétition
   *
   * @property {string} competitionId - ID unique, généré automatiquement
   * @example "competition_2025_january_word_challenge"
   */
  @Prop({ required: true, unique: true })
  competitionId: string;

  /**
   * Nom affiché de la compétition
   *
   * @property {string} name - Nom descriptif pour l'interface utilisateur
   * @example "Défi des 100 Mots de Janvier"
   */
  @Prop({ required: true })
  name: string;

  /**
   * Description détaillée de la compétition
   *
   * @property {string} description - Explication des objectifs et règles
   * @example "Contribuez 100 nouveaux mots au dictionnaire ce mois-ci pour gagner des badges exclusifs!"
   */
  @Prop({ required: true })
  description: string;

  /**
   * Type de compétition selon la fréquence
   *
   * @property {'daily' | 'weekly' | 'monthly' | 'seasonal' | 'special'} type - Fréquence/durée
   * @example "monthly"
   */
  @Prop({
    required: true,
    enum: ["daily", "weekly", "monthly", "seasonal", "special"],
  })
  type: string;

  /**
   * Catégorie d'activité ciblée par la compétition
   *
   * @property {'contribution' | 'social' | 'learning' | 'mixed'} category - Type d'activité
   * @example "contribution"
   */
  @Prop({
    required: true,
    enum: ["contribution", "social", "learning", "mixed"],
  })
  category: string;

  /**
   * Date de début de la compétition
   *
   * @property {Date} startDate - Timestamp de démarrage officiel
   * @example new Date('2025-01-01T00:00:00Z')
   */
  @Prop({ required: true })
  startDate: Date;

  /**
   * Date de fin de la compétition
   *
   * @property {Date} endDate - Timestamp de clôture et calcul final
   * @example new Date('2025-01-31T23:59:59Z')
   */
  @Prop({ required: true })
  endDate: Date;

  /**
   * Nombre de participants inscrits
   *
   * @property {number} participants - Compteur mis à jour automatiquement
   * @default 0
   */
  @Prop({ default: 0 })
  participants: number;

  /**
   * Système de récompenses par rang de classement
   *
   * Définit les prix distribués aux gagnants selon leur position finale.
   * Supporte différents types de récompenses avec niveaux de rareté.
   *
   * @property {Array<Object>} prizes - Liste des prix par rang
   * @property {number} prizes[].rank - Position requise (1er, 2ème, etc.)
   * @property {'xp' | 'badge' | 'title' | 'currency' | 'item' | 'premium'} prizes[].type - Type de récompense
   * @property {string} prizes[].name - Nom affiché de la récompense
   * @property {string} prizes[].description - Description détaillée
   * @property {number} prizes[].value - Valeur numérique (points, durée, etc.)
   * @property {string} prizes[].icon - URL ou nom de l'icône
   * @property {'common' | 'rare' | 'epic' | 'legendary'} prizes[].rarity - Niveau de rareté
   *
   * @example
   * [
   *   {
   *     rank: 1,
   *     type: "badge",
   *     name: "Champion des Mots",
   *     description: "Badge exclusif du 1er place",
   *     value: 1000,
   *     icon: "trophy-gold",
   *     rarity: "legendary"
   *   }
   * ]
   */
  @Prop([
    {
      rank: { type: Number, required: true },
      type: {
        type: String,
        required: true,
        enum: ["xp", "badge", "title", "currency", "item", "premium"],
      },
      name: { type: String, required: true },
      description: { type: String, required: true },
      value: { type: Number, required: true },
      icon: { type: String, required: true },
      rarity: {
        type: String,
        required: true,
        enum: ["common", "rare", "epic", "legendary"],
      },
    },
  ])
  prizes: Array<{
    rank: number;
    type: string;
    name: string;
    description: string;
    value: number;
    icon: string;
    rarity: string;
  }>;

  /**
   * Règles de la compétition
   *
   * @property {Array<Object>} rules - Liste des règles à respecter
   * @property {string} rules[].id - Identifiant unique de la règle
   * @property {string} rules[].description - Description détaillée de la règle
   * @property {'scoring' | 'eligibility' | 'behavior'} rules[].type - Type de la règle
   * @property {Object} rules[].value - Valeur ou critère associé à la règle
   * @example
   * [{
   *   id: "min-words",
   *   description: "Minimum de mots à contribuer",
   *   type: "eligibility",
   *   value: { min: 100 }
   * }]
   */
  @Prop([
    {
      id: { type: String, required: true },
      description: { type: String, required: true },
      type: {
        type: String,
        required: true,
        enum: ["scoring", "eligibility", "behavior"],
      },
      value: { type: Object, required: true },
    },
  ])
  rules: Array<{
    id: string;
    description: string;
    type: string;
    value: any;
  }>;

  /**
   * Statut actuel de la compétition
   *
   * @property {string} status - État de la compétition
   * @enum {string} status - Valeurs possibles: 'upcoming', 'active', 'ended', 'cancelled'
   * @default 'upcoming'
   */
  @Prop({
    required: true,
    enum: ["upcoming", "active", "ended", "cancelled"],
    default: "upcoming",
  })
  status: string;

  /**
   * Liste des participants à la compétition
   *
   * @property {Array<Object>} participants - Liste des utilisateurs inscrits
   * @property {string} participants[].userId - ID de l'utilisateur
   * @property {string} participants[].username - Nom d'utilisateur
   * @property {string} participants[].profilePicture - URL de la photo de profil
   * @property {number} participants[].rank - Rang actuel de l'utilisateur
   */
  @Prop([
    {
      userId: { type: Types.ObjectId, ref: "User", required: true },
      username: { type: String, required: true },
      profilePicture: { type: String },
      rank: { type: Number, required: true },
      score: { type: Number, required: true },
      metrics: { type: Object, default: {} },
      lastUpdate: { type: Date, default: Date.now },
      streak: { type: Number, default: 0 },
      isQualified: { type: Boolean, default: true },
    },
  ])
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

  /**
   * Métadonnées supplémentaires sur la compétition
   *
   * @property {number} minLevel - Niveau minimum requis pour participer
   * @property {number} maxParticipants - Nombre maximum de participants
   * @property {number} entryFee - Frais d'inscription à la compétition
   */
  @Prop({ type: Object, default: {} })
  metadata: {
    minLevel?: number;
    maxParticipants?: number;
    entryFee?: number;
    language?: string;
    difficulty?: string;
  };

  /**
   * Identifiant de l'utilisateur ayant créé la compétition
   */
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  createdBy: Types.ObjectId;

  /**
   * Date de création de la compétition
   */
  @Prop({ default: Date.now })
  createdAt: Date;

  /**
   * Date de dernière mise à jour de la compétition
   */
  @Prop({ default: Date.now })
  updatedAt: Date;
}

/**
 * Schéma de la compétition
 */
export const CompetitionSchema = SchemaFactory.createForClass(Competition);

/**
 * Index pour les requêtes fréquentes
 */
CompetitionSchema.index({ status: 1, type: 1 });
CompetitionSchema.index({ startDate: 1, endDate: 1 });
CompetitionSchema.index({ category: 1, status: 1 });
CompetitionSchema.index({ "leaderboard.userId": 1 });
