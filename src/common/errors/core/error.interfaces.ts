/**
 * @fileoverview Interfaces et types pour la gestion d'erreurs O'Ypunu
 *
 * Ce fichier définit les interfaces et types communs utilisés par tous
 * les gestionnaires d'erreurs pour garantir la cohérence et la type-safety
 * à travers l'application.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { HttpStatus } from '@nestjs/common';
import { ApplicationErrorCode } from './error-codes.enum';

/**
 * Interface pour une erreur d'application structurée
 *
 * Cette interface définit la structure standard de toutes les erreurs
 * dans l'application O'Ypunu, garantissant une réponse cohérente
 * pour les clients et une gestion uniforme côté serveur.
 *
 * @interface ApplicationError
 * @version 1.0.0
 */
export interface ApplicationError {
  /** Code d'erreur standardisé de l'application */
  code: ApplicationErrorCode;
  /** Message d'erreur lisible par l'utilisateur */
  message: string;
  /** Détails supplémentaires de l'erreur (logs, debug) */
  details?: any;
  /** Code de statut HTTP approprié */
  statusCode: HttpStatus;
  /** Horodatage de l'erreur au format ISO */
  timestamp: string;
  /** Contexte optionnel de l'erreur (module, opération) */
  context?: string;
}

/**
 * Interface pour le contexte d'opération de base de données
 *
 * Définit les informations contextuelles nécessaires pour le logging
 * et le debugging des opérations de base de données.
 *
 * @interface DatabaseOperationContext
 */
export interface DatabaseOperationContext {
  /** Nom de l'opération (CREATE, READ, UPDATE, DELETE, etc.) */
  operationName: string;
  /** Nom de l'entité concernée par l'opération */
  entityName: string;
  /** ID optionnel de l'entité */
  entityId?: string;
  /** ID optionnel de l'utilisateur pour audit */
  userId?: string;
}

/**
 * Interface pour le contexte d'opération de service externe
 *
 * Définit les informations contextuelles pour les appels aux services
 * externes (APIs, email, stockage, etc.).
 *
 * @interface ExternalServiceContext
 */
export interface ExternalServiceContext {
  /** Nom du service externe appelé */
  serviceName: string;
  /** Type d'opération effectuée */
  operationType: string;
  /** Gestionnaire d'erreur personnalisé optionnel */
  errorHandler?: (error: any) => never;
}

/**
 * Interface pour les contraintes de validation de fichier
 *
 * @interface FileValidationConstraints
 */
export interface FileValidationConstraints {
  /** Taille maximale autorisée en bytes */
  maxSize?: number;
  /** Taille minimale requise en bytes */
  minSize?: number;
  /** Types MIME autorisés */
  allowedMimeTypes?: string[];
}

/**
 * Type pour les opérations de base de données supportées
 *
 * @type DatabaseOperation
 */
export type DatabaseOperation = 
  | 'CREATE' 
  | 'READ' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'SEARCH' 
  | 'AGGREGATION'
  | 'FIND';

/**
 * Type pour les types d'email supportés
 *
 * @type EmailType
 */
export type EmailType = 
  | 'verification' 
  | 'reset' 
  | 'notification';

/**
 * Type pour les types de token JWT
 *
 * @type TokenType
 */
export type TokenType = 
  | 'access' 
  | 'refresh' 
  | 'reset' 
  | 'verification';

/**
 * Type pour les opérations Cloudinary
 *
 * @type CloudinaryOperation
 */
export type CloudinaryOperation = 
  | 'upload' 
  | 'delete';