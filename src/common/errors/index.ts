/**
 * @fileoverview Point d'entrée centralisé pour la gestion d'erreurs O'Ypunu
 *
 * Ce fichier exporte tous les gestionnaires d'erreurs, interfaces, énumérations
 * et utilitaires pour fournir un point d'accès unique et simplifié à l'ensemble
 * du système de gestion d'erreurs consolidé et refactorisé.
 *
 * @author Équipe O'Ypunu
 * @version 2.0.0 - Architecture consolidée
 * @since 2025-01-01
 */

// ========== CORE - FONDATIONS ==========
export * from './core/error-codes.enum';
export * from './core/error.interfaces';
export * from './core/base-error.handler';

// ========== HANDLERS - GESTIONNAIRES SPÉCIALISÉS ==========
export * from './handlers/application-error.handler';
export * from './handlers/database-error.handler';
export * from './handlers/external-service-error.handler';
export * from './handlers/validation-error.handler';

// ========== EXPORTS SPÉCIFIQUES POUR COMPATIBILITÉ ==========

// Énumérations et types principaux
export { ApplicationErrorCode, ERROR_STATUS_MAPPING } from './core/error-codes.enum';
export type { 
  ApplicationError,
  DatabaseOperationContext,
  ExternalServiceContext,
  FileValidationConstraints,
  DatabaseOperation,
  EmailType,
  TokenType,
  CloudinaryOperation
} from './core/error.interfaces';

// Gestionnaires principaux
export { ApplicationErrorHandler } from './handlers/application-error.handler';
export { DatabaseErrorHandler, HandleDatabaseErrors } from './handlers/database-error.handler';
export { ExternalServiceErrorHandler } from './handlers/external-service-error.handler';
export { ValidationErrorHandler } from './handlers/validation-error.handler';

// Classes de base
export { BaseErrorHandler } from './core/base-error.handler';

// Imports pour les aliases de compatibilité
import { DatabaseErrorHandler } from './handlers/database-error.handler';
import { ExternalServiceErrorHandler } from './handlers/external-service-error.handler';

/**
 * @deprecated Utiliser DatabaseErrorHandler.handleDatabaseOperation à la place
 * Alias pour compatibilité avec l'ancien code
 */
export const handleDatabaseOperation = DatabaseErrorHandler.handleDatabaseOperation;

/**
 * @deprecated Utiliser DatabaseErrorHandler.handleFindOperation à la place  
 * Alias pour compatibilité avec l'ancien code
 */
export const handleFindOperation = DatabaseErrorHandler.handleFindOperation;

/**
 * @deprecated Utiliser ExternalServiceErrorHandler.handleExternalOperation à la place
 * Alias pour compatibilité avec l'ancien code
 */
export const handleExternalOperation = ExternalServiceErrorHandler.handleExternalOperation;