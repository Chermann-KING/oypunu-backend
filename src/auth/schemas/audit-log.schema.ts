/**
 * @fileoverview Schéma d'audit et logging de sécurité pour O'Ypunu
 * 
 * Ce schéma définit un système complet d'audit et de traçabilité
 * pour toutes les actions sensibles de la plateforme. Il permet
 * le monitoring, la détection d'intrusions, et la conformité à
 * la réglementation sur la protection des données.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Type document Mongoose pour les logs d'audit
 * 
 * @typedef {AuditLog & Document} AuditLogDocument
 */
export type AuditLogDocument = AuditLog & Document;

/**
 * Énumération des actions auditées dans le système
 * 
 * Cette énumération définit tous les types d'actions qui doivent
 * être traçées pour la sécurité, la conformité et le débogage.
 * 
 * @enum {string} AuditAction
 */
export enum AuditAction {
  // === AUTHENTIFICATION ET SÉCURITÉ ===
  /** Connexion utilisateur réussie */
  USER_LOGIN = 'user_login',
  /** Déconnexion utilisateur */
  USER_LOGOUT = 'user_logout',
  /** Inscription nouveau compte */
  USER_REGISTER = 'user_register',
  /** Rafraîchissement de token JWT */
  TOKEN_REFRESH = 'token_refresh',
  /** Réinitialisation de mot de passe */
  PASSWORD_RESET = 'password_reset',

  // === GESTION DES UTILISATEURS ===
  /** Création d'utilisateur par admin */
  USER_CREATE = 'user_create',
  /** Modification profil utilisateur */
  USER_UPDATE = 'user_update',
  /** Suppression compte utilisateur */
  USER_DELETE = 'user_delete',
  /** Changement de rôle utilisateur */
  USER_ROLE_CHANGE = 'user_role_change',
  /** Activation compte utilisateur */
  USER_ACTIVATE = 'user_activate',
  /** Désactivation compte utilisateur */
  USER_DEACTIVATE = 'user_deactivate',

  // === GESTION DU CONTENU ===
  /** Création nouveau mot */
  WORD_CREATE = 'word_create',
  /** Modification mot existant */
  WORD_UPDATE = 'word_update',
  /** Suppression mot */
  WORD_DELETE = 'word_delete',
  /** Approbation mot par modérateur */
  WORD_APPROVE = 'word_approve',
  /** Rejet mot par modérateur */
  WORD_REJECT = 'word_reject',

  // === ADMINISTRATION ET SÉCURITÉ ===
  /** Accès à l'interface admin */
  ADMIN_ACCESS = 'admin_access',
  /** Refus d'accès pour permissions insuffisantes */
  PERMISSION_DENIED = 'permission_denied',
  /** Violation de sécurité détectée */
  SECURITY_VIOLATION = 'security_violation',
  /** Export de données sensibles */
  DATA_EXPORT = 'data_export',

  // === SYSTÈME ET MAINTENANCE ===
  /** Modification configuration système */
  SYSTEM_CONFIG_CHANGE = 'system_config_change',
  /** Création sauvegarde */
  BACKUP_CREATE = 'backup_create',
  /** Activation mode maintenance */
  MAINTENANCE_MODE = 'maintenance_mode',
}

/**
 * Énumération des niveaux de sévérité pour classification des événements
 * 
 * Cette énumération permet de classer les événements d'audit selon
 * leur impact sur la sécurité et leur priorité de traitement.
 * 
 * @enum {string} AuditSeverity
 */
export enum AuditSeverity {
  /** Événements informatifs normaux */
  LOW = 'low',
  /** Événements nécessitant attention */
  MEDIUM = 'medium',
  /** Événements de sécurité importants */
  HIGH = 'high',
  /** Événements critiques nécessitant intervention immédiate */
  CRITICAL = 'critical',
}

/**
 * Schéma des logs d'audit pour traçabilité et sécurité
 * 
 * Cette classe définit un système complet de logging d'audit
 * conforme aux standards de sécurité entreprise :
 * 
 * ## Fonctionnalités d'audit :
 * - Traçabilité complète des actions utilisateur
 * - Capture des états avant/après modification
 * - Informations de contexte (IP, User-Agent, session)
 * - Classification par sévérité et type d'action
 * - Rétention configurable avec TTL automatique
 * 
 * ## Cas d'usage :
 * - Conformité réglementaire (RGPD, SOX, etc.)
 * - Investigation de sécurité et forensique
 * - Monitoring des activités suspectes
 * - Audit des accès et modifications
 * - Reporting et analytics de sécurité
 * 
 * @class AuditLog
 * @version 1.0.0
 */
@Schema({
  timestamps: true,        // Ajoute createdAt et updatedAt automatiquement
  collection: 'audit_logs', // Collection MongoDB dédiée aux logs d'audit
})
export class AuditLog {
  // === CLASSIFICATION DE L'ACTION ===
  
  /** Type d'action auditée (login, update, delete, etc.) */
  @Prop({ required: true, enum: AuditAction, index: true })
  action: AuditAction;

  /** Niveau de sévérité de l'événement */
  @Prop({ required: true, enum: AuditSeverity, default: AuditSeverity.LOW })
  severity: AuditSeverity;

  // === IDENTIFICATION UTILISATEUR ===
  
  /** Référence vers l'utilisateur qui a effectué l'action */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  /** Nom d'utilisateur au moment de l'action (pour historique) */
  @Prop()
  username?: string;

  /** Rôle utilisateur au moment de l'action */
  @Prop()
  userRole?: string;

  // === CONTEXTE TECHNIQUE ===
  
  /** Adresse IP source de la requête */
  @Prop({ required: true })
  ipAddress: string;

  /** User-Agent du navigateur pour identification */
  @Prop()
  userAgent?: string;

  /** Ressource affectée (ex: "word:123", "user:456", "admin:dashboard") */
  @Prop()
  resource?: string;

  // === DÉTAILS ET ÉTATS ===
  
  /** Détails spécifiques à l'action (paramètres, contexte) */
  @Prop({ type: Object })
  details: Record<string, any>;

  /** État de la ressource avant modification (pour audit) */
  @Prop({ type: Object })
  beforeState?: Record<string, any>;

  /** État de la ressource après modification (pour audit) */
  @Prop({ type: Object })
  afterState?: Record<string, any>;

  // === SESSION ET TRACKING ===
  
  /** Identifiant de session pour corrélation des actions */
  @Prop()
  sessionId?: string;

  // === RÉSULTAT DE L'ACTION ===
  
  /** Indicateur de succès/échec de l'action */
  @Prop({ default: false })
  success: boolean;

  /** Message d'erreur en cas d'échec */
  @Prop()
  errorMessage?: string;

  // === CONTEXTE HTTP ===
  
  /** Chemin de la requête HTTP */
  @Prop()
  requestPath?: string;

  /** Méthode HTTP (GET, POST, PUT, DELETE) */
  @Prop()
  requestMethod?: string;

  /** Code de statut HTTP de la réponse */
  @Prop()
  responseStatus?: number;

  /** Durée de traitement en millisecondes */
  @Prop()
  duration?: number;

  // === MÉTADONNÉES ADDITIONNELLES ===
  
  /** Données contextuelles spécifiques à l'action */
  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

/**
 * Schéma Mongoose compilé avec index optimisés pour performances
 */
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// === INDEX OPTIMISÉS POUR REQUÊTES D'AUDIT ===

// Index par utilisateur et date pour historique personnel
AuditLogSchema.index({ userId: 1, createdAt: -1 });

// Index par type d'action pour recherche thématique
AuditLogSchema.index({ action: 1, createdAt: -1 });

// Index par niveau de sévérité pour alertes sécurité
AuditLogSchema.index({ severity: 1, createdAt: -1 });

// Index par adresse IP pour détection d'intrusions
AuditLogSchema.index({ ipAddress: 1, createdAt: -1 });

// Index composé pour recherche d'échecs critiques
AuditLogSchema.index({ success: 1, severity: 1, createdAt: -1 });

// Index par ressource pour audit spécifique
AuditLogSchema.index({ resource: 1, createdAt: -1 });

// Index par session pour corrélation d'actions
AuditLogSchema.index({ sessionId: 1, createdAt: -1 });

// === TTL POUR AUTO-NETTOYAGE ===
// Garde les logs pendant 1 an puis suppression automatique
// Configurable selon les exigences de conformité
AuditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }, // 1 an en secondes
);
