/**
 * @fileoverview Schéma des mots favoris utilisateur pour O'Ypunu
 * 
 * Ce schéma définit la relation entre utilisateurs et leurs mots favoris
 * avec contraintes d'unicité, optimisations de performance et gestion
 * automatique des timestamps pour la plateforme O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Word } from './word.schema';

/**
 * Type document Mongoose pour les mots favoris
 * 
 * @typedef {FavoriteWord & Document} FavoriteWordDocument
 */
export type FavoriteWordDocument = FavoriteWord & Document;

/**
 * Schéma des mots favoris utilisateur
 * 
 * Cette classe définit la structure de données pour les mots favoris
 * des utilisateurs, permettant de créer des collections personnalisées
 * et des listes de références linguistiques.
 * 
 * ## 🎯 Fonctionnalités :
 * - **Collections personnelles** : Chaque utilisateur peut marquer ses mots préférés
 * - **Prévention doublons** : Index unique composite (utilisateur + mot)
 * - **Traçabilité temporelle** : Horodatage automatique de l'ajout
 * - **Relations optimisées** : Références vers User et Word avec population
 * 
 * ## 📊 Cas d'usage :
 * - Listes de mots personnalisées
 * - Bookmarks linguistiques
 * - Révision et apprentissage
 * - Recommendations personnalisées
 * - Analytics préférences utilisateur
 * 
 * ## 🔗 Relations :
 * - **userId** : Référence vers l'utilisateur propriétaire
 * - **wordId** : Référence vers le mot favorisé
 * 
 * @class FavoriteWord
 * @version 1.0.0
 */
@Schema({ 
  timestamps: true,
  collection: 'favorite_words'
})
export class FavoriteWord {
  /** Référence vers l'utilisateur propriétaire du favori */
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  })
  userId: User;

  /** Référence vers le mot marqué comme favori */
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'Word', 
    required: true,
    index: true
  })
  wordId: Word;

  /** Date d'ajout aux favoris */
  @Prop({ 
    type: Date, 
    default: Date.now,
    index: true
  })
  addedAt: Date;
}

/**
 * Schéma Mongoose compilé avec index optimisés
 */
export const FavoriteWordSchema = SchemaFactory.createForClass(FavoriteWord);

// === INDEX OPTIMISÉS POUR PERFORMANCES ===

// Index composite unique pour éviter les doublons (utilisateur + mot)
FavoriteWordSchema.index({ userId: 1, wordId: 1 }, { unique: true });

// Index par utilisateur pour récupération rapide des favoris
FavoriteWordSchema.index({ userId: 1, addedAt: -1 });

// Index par mot pour statistiques et analytics
FavoriteWordSchema.index({ wordId: 1, addedAt: -1 });

// Index pour les requêtes de recherche récentes
FavoriteWordSchema.index({ addedAt: -1 });
