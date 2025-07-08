import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

export enum AuditAction {
  // Authentification
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_REGISTER = 'user_register',
  TOKEN_REFRESH = 'token_refresh',
  PASSWORD_RESET = 'password_reset',

  // Gestion des utilisateurs
  USER_CREATE = 'user_create',
  USER_UPDATE = 'user_update',
  USER_DELETE = 'user_delete',
  USER_ROLE_CHANGE = 'user_role_change',
  USER_ACTIVATE = 'user_activate',
  USER_DEACTIVATE = 'user_deactivate',

  // Contenu
  WORD_CREATE = 'word_create',
  WORD_UPDATE = 'word_update',
  WORD_DELETE = 'word_delete',
  WORD_APPROVE = 'word_approve',
  WORD_REJECT = 'word_reject',

  // Administration
  ADMIN_ACCESS = 'admin_access',
  PERMISSION_DENIED = 'permission_denied',
  SECURITY_VIOLATION = 'security_violation',
  DATA_EXPORT = 'data_export',

  // Système
  SYSTEM_CONFIG_CHANGE = 'system_config_change',
  BACKUP_CREATE = 'backup_create',
  MAINTENANCE_MODE = 'maintenance_mode',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Schema({
  timestamps: true,
  collection: 'audit_logs',
})
export class AuditLog {
  @Prop({ required: true, enum: AuditAction, index: true })
  action: AuditAction;

  @Prop({ required: true, enum: AuditSeverity, default: AuditSeverity.LOW })
  severity: AuditSeverity;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop()
  username?: string;

  @Prop()
  userRole?: string;

  @Prop({ required: true })
  ipAddress: string;

  @Prop()
  userAgent?: string;

  @Prop()
  resource?: string; // Ressource affectée (ex: "word:123", "user:456")

  @Prop({ type: Object })
  details: Record<string, any>; // Détails spécifiques à l'action

  @Prop({ type: Object })
  beforeState?: Record<string, any>; // État avant modification

  @Prop({ type: Object })
  afterState?: Record<string, any>; // État après modification

  @Prop()
  sessionId?: string;

  @Prop({ default: false })
  success: boolean;

  @Prop()
  errorMessage?: string;

  @Prop()
  requestPath?: string;

  @Prop()
  requestMethod?: string;

  @Prop()
  responseStatus?: number;

  @Prop()
  duration?: number; // Durée en millisecondes

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Métadonnées additionnelles
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Index composés pour optimiser les requêtes d'audit
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ severity: 1, createdAt: -1 });
AuditLogSchema.index({ ipAddress: 1, createdAt: -1 });
AuditLogSchema.index({ success: 1, severity: 1, createdAt: -1 });

// TTL Index pour auto-nettoyage (garder les logs pendant 1 an)
AuditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 },
);
