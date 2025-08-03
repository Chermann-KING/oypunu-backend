/**
 * @fileoverview Gestionnaire d'erreurs applicatives refactorisé pour O'Ypunu
 * 
 * Ce gestionnaire se concentre uniquement sur les erreurs de logique métier
 * et d'application, déléguant les erreurs techniques de base de données au
 * DatabaseErrorHandler consolidé. Il élimine les duplications et fournit
 * une API claire pour les erreurs business-level.
 * 
 * @author Équipe O'Ypunu
 * @version 2.0.0 - Refactorisé pour éliminer duplications
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseErrorHandler } from '../core/base-error.handler';
import { ApplicationErrorCode } from '../core/error-codes.enum';
import { DatabaseErrorHandler } from './database-error.handler';

/**
 * Gestionnaire d'erreurs applicatives avec responsabilités clarifiées
 * 
 * Cette classe Injectable se concentre exclusivement sur les erreurs de
 * logique métier et d'application, sans duplication avec la gestion
 * technique de base de données. Elle hérite de BaseErrorHandler pour
 * les fonctionnalités communes et délègue les erreurs DB au gestionnaire
 * spécialisé.
 * 
 * ## 🎯 Responsabilités spécifiques :
 * 
 * ### Erreurs d'authentification et autorisation
 * - Tokens manquants, invalides ou expirés
 * - Identifiants de connexion incorrects
 * - Permissions insuffisantes
 * 
 * ### Erreurs de validation applicative
 * - Validation de données métier
 * - Champs requis spécifiques à l'application
 * - Formats de données applicatifs
 * 
 * ### Erreurs de logique métier
 * - Règles business spécifiques (favoris, etc.)
 * - États d'objets métier invalides
 * - Contraintes applicatives
 * 
 * ### Erreurs de ressources et accès
 * - Ressources non trouvées
 * - Conflits de ressources
 * - Contrôle d'accès applicatif
 * 
 * @class ApplicationErrorHandler
 * @extends BaseErrorHandler
 * @version 2.0.0
 */
@Injectable()
export class ApplicationErrorHandler extends BaseErrorHandler {
  /** Logger spécialisé pour les erreurs applicatives */
  protected readonly logger = new Logger(ApplicationErrorHandler.name);

  // ========== ERREURS D'AUTHENTIFICATION ==========

  /**
   * Crée une erreur d'authentification spécialisée
   * 
   * Gère tous les cas d'erreurs liés à l'authentification avec
   * des messages utilisateur appropriés et un logging sécurisé.
   * 
   * @method createAuthError
   * @param {ApplicationErrorCode} code - Code d'erreur d'authentification
   * @param {string} [context] - Contexte de l'erreur (endpoint, service)
   * @param {any} [details] - Détails pour audit (pas de données sensibles)
   * @returns {HttpException} Exception d'authentification formatée
   * 
   * @example
   * ```typescript
   * throw this.applicationErrorHandler.createAuthError(
   *   ApplicationErrorCode.AUTH_TOKEN_EXPIRED,
   *   'AuthGuard.canActivate',
   *   { userId: user.id }
   * );
   * ```
   */
  createAuthError(
    code: ApplicationErrorCode.AUTH_TOKEN_MISSING | 
          ApplicationErrorCode.AUTH_TOKEN_INVALID | 
          ApplicationErrorCode.AUTH_TOKEN_EXPIRED | 
          ApplicationErrorCode.AUTH_CREDENTIALS_INVALID,
    context?: string,
    details?: any
  ) {
    const errorMessages = {
      [ApplicationErrorCode.AUTH_TOKEN_MISSING]: "Token d'authentification manquant",
      [ApplicationErrorCode.AUTH_TOKEN_INVALID]: "Token d'authentification invalide",
      [ApplicationErrorCode.AUTH_TOKEN_EXPIRED]: "Session expirée, veuillez vous reconnecter",
      [ApplicationErrorCode.AUTH_CREDENTIALS_INVALID]: "Identifiants invalides"
    };

    return this.createError(
      code,
      errorMessages[code],
      context,
      details
    );
  }

  // ========== ERREURS DE VALIDATION APPLICATIVE ==========

  /**
   * Crée une erreur de validation pour données applicatives
   * 
   * @method createValidationError
   * @param {string} message - Message de validation spécifique
   * @param {string} [context] - Contexte de validation
   * @param {any} [details] - Détails des champs en erreur
   * @returns {HttpException} Exception de validation
   */
  createValidationError(
    message: string,
    context?: string,
    details?: any
  ) {
    return this.createError(
      ApplicationErrorCode.VALIDATION_FAILED,
      message,
      context,
      details
    );
  }

  /**
   * Crée une erreur pour champ requis manquant
   * 
   * @method createRequiredFieldError
   * @param {string} fieldName - Nom du champ requis
   * @param {string} [context] - Contexte de validation
   * @returns {HttpException} Exception champ requis
   */
  createRequiredFieldError(
    fieldName: string,
    context?: string
  ) {
    return this.createError(
      ApplicationErrorCode.REQUIRED_FIELD_MISSING,
      `Le champ '${fieldName}' est requis`,
      context,
      { fieldName }
    );
  }

  // ========== ERREURS DE RESSOURCES ==========

  /**
   * Crée une erreur de ressource non trouvée
   * 
   * @method createNotFoundError
   * @param {string} resourceType - Type de ressource
   * @param {string} [resourceId] - ID de la ressource
   * @param {string} [context] - Contexte de recherche
   * @returns {HttpException} Exception ressource non trouvée
   */
  createNotFoundError(
    resourceType: string,
    resourceId?: string,
    context?: string
  ) {
    const message = resourceId 
      ? `${resourceType} avec l'ID '${resourceId}' non trouvé`
      : `${resourceType} non trouvé`;

    return this.createError(
      ApplicationErrorCode.RESOURCE_NOT_FOUND,
      message,
      context,
      { resourceType, resourceId }
    );
  }

  /**
   * Crée une erreur de conflit de ressource
   * 
   * @method createConflictError
   * @param {string} message - Message de conflit spécifique
   * @param {string} [context] - Contexte du conflit
   * @param {any} [details] - Détails du conflit
   * @returns {HttpException} Exception de conflit
   */
  createConflictError(
    message: string,
    context?: string,
    details?: any
  ) {
    return this.createError(
      ApplicationErrorCode.RESOURCE_ALREADY_EXISTS,
      message,
      context,
      details
    );
  }

  /**
   * Crée une erreur d'accès refusé
   * 
   * @method createForbiddenError
   * @param {string} [message] - Message d'accès refusé personnalisé
   * @param {string} [context] - Contexte de l'accès
   * @param {any} [details] - Détails pour audit
   * @returns {HttpException} Exception d'accès refusé
   */
  createForbiddenError(
    message: string = "Accès refusé à cette ressource",
    context?: string,
    details?: any
  ) {
    return this.createError(
      ApplicationErrorCode.RESOURCE_ACCESS_DENIED,
      message,
      context,
      details
    );
  }

  /**
   * Crée une erreur de permissions insuffisantes
   * 
   * @method createInsufficientPermissionsError
   * @param {string} [requiredPermission] - Permission requise
   * @param {string} [context] - Contexte de vérification
   * @returns {HttpException} Exception permissions insuffisantes
   */
  createInsufficientPermissionsError(
    requiredPermission?: string,
    context?: string
  ) {
    const message = requiredPermission
      ? `Permission '${requiredPermission}' requise`
      : "Permissions insuffisantes pour cette opération";

    return this.createError(
      ApplicationErrorCode.INSUFFICIENT_PERMISSIONS,
      message,
      context,
      { requiredPermission }
    );
  }

  // ========== ERREURS DE LOGIQUE MÉTIER ==========

  /**
   * Crée une erreur de logique métier pour les favoris
   * 
   * @method createFavoriteError
   * @param {boolean} isAlreadyInFavorites - Si déjà en favoris
   * @param {string} wordId - ID du mot concerné
   * @param {string} [context] - Contexte de l'opération
   * @returns {HttpException} Exception favoris
   */
  createFavoriteError(
    isAlreadyInFavorites: boolean,
    wordId: string,
    context?: string
  ) {
    if (isAlreadyInFavorites) {
      return this.createError(
        ApplicationErrorCode.WORD_ALREADY_IN_FAVORITES,
        "Ce mot est déjà dans vos favoris",
        context,
        { wordId }
      );
    } else {
      return this.createError(
        ApplicationErrorCode.WORD_NOT_IN_FAVORITES,
        "Ce mot n'est pas dans vos favoris",
        context,
        { wordId }
      );
    }
  }

  // ========== ERREURS DE SERVICES EXTERNES ==========

  /**
   * Crée une erreur de service externe
   * 
   * @method createExternalServiceError
   * @param {string} serviceName - Nom du service externe
   * @param {Error} originalError - Erreur originale
   * @param {string} [context] - Contexte de l'appel
   * @returns {HttpException} Exception service externe
   */
  createExternalServiceError(
    serviceName: string,
    originalError: Error,
    context?: string
  ) {
    this.logger.error(`External service error (${serviceName}):`, originalError.stack);
    
    return this.createError(
      ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
      `Service ${serviceName} temporairement indisponible`,
      context,
      { serviceName, originalMessage: originalError.message }
    );
  }

  // ========== DÉLÉGATION ERREURS BASE DE DONNÉES ==========

  /**
   * Délègue la gestion des erreurs MongoDB au gestionnaire spécialisé
   * 
   * Cette méthode redirige vers DatabaseErrorHandler pour éviter
   * la duplication de code et centraliser la logique technique.
   * 
   * @method handleMongoError
   * @param {any} error - Erreur MongoDB
   * @param {string} operation - Nom de l'opération
   * @param {string} [context] - Contexte applicatif
   * @throws {HttpException} Exception appropriée via DatabaseErrorHandler
   */
  handleMongoError(error: any, operation: string, context?: string): never {
    // Déléguer au gestionnaire spécialisé consolidé
    throw DatabaseErrorHandler.handleDatabaseOperation(
      () => { throw error; },
      {
        operationName: operation,
        entityName: context || 'Resource'
      }
    );
  }

  /**
   * Crée une erreur d'ObjectId MongoDB invalide
   * 
   * @method createInvalidObjectIdError
   * @param {string} fieldName - Nom du champ avec ID invalide
   * @param {string} value - Valeur invalide fournie
   * @param {string} [context] - Contexte de validation
   * @returns {HttpException} Exception ObjectId invalide
   */
  createInvalidObjectIdError(
    fieldName: string,
    value: string,
    context?: string
  ) {
    return this.createError(
      ApplicationErrorCode.INVALID_OBJECT_ID,
      `Format d'ID invalide pour le champ '${fieldName}': '${value}'`,
      context,
      { fieldName, value }
    );
  }
}