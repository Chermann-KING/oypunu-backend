/**
 * @fileoverview Schéma des notifications de mots pour O'Ypunu
 * 
 * Ce schéma définit le système de notifications lié aux mots du dictionnaire
 * avec types d'événements, métadonnées contextuelles et gestion du statut
 * de lecture pour informer les utilisateurs des activités pertinentes.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

/**
 * Type document Mongoose pour les notifications de mots
 * 
 * @typedef {WordNotification & Document} WordNotificationDocument
 */
export type WordNotificationDocument = WordNotification & Document;

/**
 * Schéma des notifications système liées aux mots
 * 
 * Cette classe définit le système de notifications pour informer les utilisateurs
 * des événements importants concernant les mots du dictionnaire, leurs révisions
 * et les actions de modération.
 * 
 * ## 📢 Types de notifications :
 * - **word_revision** : Révision proposée sur un mot
 * - **word_approved** : Mot approuvé par modération
 * - **word_rejected** : Mot rejeté par modération
 * - **revision_approved** : Révision acceptée
 * - **revision_rejected** : Révision refusée
 * 
 * ## 🎯 Fonctionnalités :
 * - **Notifications ciblées** : Envoi aux utilisateurs concernés
 * - **Traçabilité actions** : Qui a déclenché la notification
 * - **Statut de lecture** : Gestion lu/non-lu avec horodatage
 * - **Métadonnées riches** : Contexte détaillé de l'événement
 * 
 * ## 📊 Cas d'usage :
 * - Notifications de modération
 * - Alertes de révisions
 * - Feedback aux contributeurs
 * - Historique des actions
 * 
 * @class WordNotification
 * @version 1.0.0
 */
@Schema({ 
  timestamps: true,
  collection: 'word_notifications'
})
export class WordNotification {
  /** Type de notification d'événement */
  @Prop({ 
    required: true,
    enum: [
      'word_revision',
      'word_approved', 
      'word_rejected',
      'revision_approved',
      'revision_rejected'
    ],
    index: true
  })
  type:
    | 'word_revision'
    | 'word_approved'
    | 'word_rejected'
    | 'revision_approved'
    | 'revision_rejected';

  /** Référence vers le mot concerné par la notification */
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'Word', 
    required: true,
    index: true
  })
  wordId: string;

  /** Utilisateur destinataire de la notification */
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  })
  targetUserId: User;

  /** Utilisateur qui a déclenché l'événement (optionnel) */
  @Prop({ 
    type: MongooseSchema.Types.ObjectId, 
    ref: 'User',
    index: true
  })
  triggeredBy?: User;

  /** Message descriptif de la notification */
  @Prop({ required: true })
  message: string;

  /** Statut de lecture de la notification */
  @Prop({ 
    default: false,
    index: true
  })
  isRead: boolean;

  /** Horodatage de la lecture (si applicable) */
  @Prop()
  readAt?: Date;

  /** Métadonnées contextuelles de la notification */
  @Prop({ type: Object })
  metadata?: {
    /** Nom du mot concerné */
    wordName?: string;
    /** Numéro de version de révision */
    revisionVersion?: number;
    /** Liste des modifications apportées */
    changes?: string[];
    /** Raison du rejet/approbation */
    reason?: string;
    /** Données additionnelles spécifiques */
    additional?: Record<string, any>;
  };
}

/**
 * Schéma Mongoose compilé avec index optimisés
 */
export const WordNotificationSchema =
  SchemaFactory.createForClass(WordNotification);

// === INDEX OPTIMISÉS POUR PERFORMANCES ===

// Index composite pour récupération rapide des notifications non lues par utilisateur
WordNotificationSchema.index({ targetUserId: 1, isRead: 1, createdAt: -1 });

// Index par mot pour traçabilité des notifications liées à un mot spécifique
WordNotificationSchema.index({ wordId: 1, createdAt: -1 });

// Index par type pour analytics et filtrage par catégorie d'événement
WordNotificationSchema.index({ type: 1, createdAt: -1 });

// Index par déclencheur pour traçabilité des actions utilisateur
WordNotificationSchema.index({ triggeredBy: 1, createdAt: -1 });

// Index général par date pour pagination et archivage
WordNotificationSchema.index({ createdAt: -1 });

// Index composite pour notifications récentes non lues
WordNotificationSchema.index({ isRead: 1, createdAt: -1 });
