/**
 * @fileoverview Gestionnaire d'erreurs de base de données consolidé pour O'Ypunu
 *
 * Ce gestionnaire unifie et centralise toute la gestion d'erreurs liées aux
 * opérations de base de données MongoDB/Mongoose. Il consolide les fonctionnalités
 * précédemment dupliquées et fournit des wrappers spécialisés pour toutes les
 * opérations CRUD avec monitoring des performances.
 *
 * @author Équipe O'Ypunu
 * @version 2.0.0
 * @since 2025-01-01
 */

import { 
  BadRequestException, 
  InternalServerErrorException, 
  NotFoundException,
  ConflictException,
  Logger
} from '@nestjs/common';
import { MongoError } from 'mongodb';
import { BaseErrorHandler } from '../core/base-error.handler';
import { ApplicationErrorCode } from '../core/error-codes.enum';
import { DatabaseOperationContext, DatabaseOperation } from '../core/error.interfaces';

/**
 * Gestionnaire centralisé et consolidé d'erreurs de base de données
 *
 * Cette classe hérite de BaseErrorHandler et centralise TOUTE la logique
 * de gestion d'erreurs MongoDB/Mongoose. Elle élimine les duplications
 * précédentes et fournit une API unifiée pour tous les types d'opérations
 * de base de données avec monitoring intégré.
 *
 * ## 🛡️ Fonctionnalités consolidées :
 *
 * ### Gestion d'erreurs MongoDB unifiée
 * - Classification automatique des erreurs (11000, CastError, ValidationError)
 * - Messages utilisateur contextualisés en français
 * - Logging structuré avec stack traces
 * - Préservation des erreurs NestJS existantes
 *
 * ### Wrappers spécialisés avec monitoring
 * - Opérations CRUD (Create, Read, Update, Delete)
 * - Recherches et filtres complexes
 * - Agrégations et statistiques
 * - Mesure automatique des performances
 *
 * ### Audit et debugging avancés
 * - Contexte enrichi (entité, utilisateur, opération)
 * - Temps d'exécution avec seuils d'alerte
 * - Logs différenciés par niveau de sévérité
 * - Intégration monitoring externe
 *
 * @class DatabaseErrorHandler
 * @extends BaseErrorHandler
 * @version 2.0.0
 */
export class DatabaseErrorHandler extends BaseErrorHandler {
  /** Logger spécialisé pour les erreurs de base de données */
  protected readonly logger = new Logger('DatabaseErrorHandler');

  /**
   * Wrapper générique pour opérations de base de données avec gestion complète
   *
   * Cette méthode encapsule toute opération de base de données avec :
   * - Logging automatique début/fin d'opération
   * - Mesure précise du temps d'exécution
   * - Gestion d'erreurs contextuelle unifiée
   * - Enrichissement des métadonnées de debug
   * - Alertes sur performances dégradées
   *
   * @static
   * @async
   * @method handleDatabaseOperation
   * @template T Type de retour de l'opération
   * @param {() => Promise<T>} operation - Opération async à exécuter
   * @param {DatabaseOperationContext} context - Contexte de l'opération
   * @returns {Promise<T>} Résultat de l'opération
   * @throws {BadRequestException|NotFoundException|ConflictException|InternalServerErrorException}
   *
   * @example
   * ```typescript
   * const user = await DatabaseErrorHandler.handleDatabaseOperation(
   *   () => userModel.findById(userId),
   *   {
   *     operationName: 'FIND',
   *     entityName: 'User',
   *     entityId: userId,
   *     userId: currentUserId
   *   }
   * );
   * ```
   */
  static async handleDatabaseOperation<T>(
    operation: () => Promise<T>,
    context: DatabaseOperationContext
  ): Promise<T> {
    const handler = new DatabaseErrorHandler();
    const { operationName, entityName, entityId, userId } = context;
    
    try {
      handler.logger.debug(
        `🔍 [${operationName}] Début opération ${entityName}${entityId ? ` (ID: ${entityId})` : ''}${userId ? ` par utilisateur ${userId}` : ''}`
      );
      
      const result = await handler.measureExecutionTime(
        operation,
        `${operationName} ${entityName}`
      );
      
      return result;
    } catch (error) {
      handler.logger.error(`❌ [${operationName}] Erreur ${entityName}:`, {
        error: error.message,
        entityId,
        userId,
        stack: error.stack,
        operationName
      });

      throw handler.handleDatabaseError(error, context);
    }
  }

  /**
   * Gestion consolidée et unifiée des erreurs MongoDB/Mongoose
   *
   * Cette méthode centrale analyse le type d'erreur et retourne une exception
   * NestJS appropriée. Elle consolide toute la logique précédemment dupliquée
   * entre les différents gestionnaires d'erreurs.
   *
   * @private
   * @method handleDatabaseError
   * @param {any} error - Erreur originale capturée
   * @param {DatabaseOperationContext} context - Contexte de l'opération
   * @returns {Error} Exception NestJS formatée
   */
  private handleDatabaseError(error: any, context: DatabaseOperationContext): Error {
    const { operationName, entityName, entityId } = context;

    // Préserver les erreurs NestJS existantes (ne pas envelopper)
    if (this.isNestJSException(error)) {
      return error;
    }

    // === ERREURS MONGODB SPÉCIFIQUES ===
    if (error.name === 'MongoError' || error instanceof MongoError) {
      return this.handleMongoError(error, entityName);
    }

    // === ERREURS MONGOOSE DE VALIDATION ===
    if (error.name === 'ValidationError') {
      return this.handleValidationError(error, entityName);
    }

    // === ERREURS MONGOOSE DE CAST (ID INVALIDE) ===
    if (error.name === 'CastError') {
      return this.createError(
        ApplicationErrorCode.INVALID_OBJECT_ID,
        `ID ${entityName} invalide : ${entityId || 'non spécifié'}`,
        `${operationName}.${entityName}`,
        { fieldName: error.path, value: error.value }
      );
    }

    // === ERREURS DE CONNEXION MONGODB ===
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      this.logger.error(`🔴 [${operationName}] Problème de connexion base de données`, error);
      return this.createError(
        ApplicationErrorCode.DATABASE_ERROR,
        'Service temporairement indisponible. Veuillez réessayer dans quelques instants.',
        `${operationName}.${entityName}.connection`,
        { errorType: error.name, originalMessage: error.message }
      );
    }

    // === ERREURS MONGODB DE TRANSACTION ===
    if (error.name === 'MongoWriteConcernError') {
      this.logger.error(`🔴 [${operationName}] Erreur de consistance MongoDB`, error);
      return this.createError(
        ApplicationErrorCode.DATABASE_ERROR,
        'Erreur de consistance de données. Veuillez réessayer.',
        `${operationName}.${entityName}.writeConcern`,
        { writeConcern: error.result }
      );
    }

    // === ERREUR GÉNÉRIQUE ===
    this.logger.error(`🔴 [${operationName}] Erreur inattendue ${entityName}:`, error);
    return this.createError(
      ApplicationErrorCode.INTERNAL_SERVER_ERROR,
      `Erreur lors de l'opération sur ${entityName}. Veuillez contacter le support si le problème persiste.`,
      `${operationName}.${entityName}.unexpected`,
      { originalMessage: error.message, stack: error.stack }
    );
  }

  /**
   * Gestion spécialisée des erreurs MongoDB natives
   *
   * @private
   * @method handleMongoError
   * @param {any} error - Erreur MongoDB
   * @param {string} entityName - Nom de l'entité
   * @returns {Error} Exception NestJS appropriée
   */
  private handleMongoError(error: any, entityName: string): Error {
    // Erreur de duplication (clé unique violée)
    if (error.code === 11000) {
      const field = this.extractDuplicateField(error);
      return this.createError(
        ApplicationErrorCode.RESOURCE_ALREADY_EXISTS,
        `${entityName} avec ${field} existe déjà`,
        'MongoDB.DuplicateKey',
        { mongoError: error.code, field, keyPattern: error.keyPattern }
      );
    }

    // Erreur de taille de document (16MB limit)
    if (error.code === 2) {
      return this.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${entityName} trop volumineux pour être enregistré`,
        'MongoDB.DocumentTooLarge',
        { mongoError: error.code, maxSize: '16MB' }
      );
    }

    // Erreur d'index invalide
    if (error.code === 85) {
      this.logger.error(`🔴 Erreur d'index MongoDB pour ${entityName}:`, error);
      return this.createError(
        ApplicationErrorCode.DATABASE_ERROR,
        'Erreur de base de données. Veuillez réessayer.',
        'MongoDB.IndexError',
        { mongoError: error.code }
      );
    }

    // Erreur de limite de connexions
    if (error.code === 18) {
      return this.createError(
        ApplicationErrorCode.DATABASE_ERROR,
        'Service surchargé. Veuillez réessayer dans quelques instants.',
        'MongoDB.TooManyConnections',
        { mongoError: error.code }
      );
    }

    // Autres erreurs MongoDB
    return this.createError(
      ApplicationErrorCode.DATABASE_ERROR,
      `Erreur de base de données lors de l'opération sur ${entityName}`,
      'MongoDB.Generic',
      { mongoError: error.code, message: error.message }
    );
  }

  /**
   * Gestion spécialisée des erreurs de validation Mongoose
   *
   * @private
   * @method handleValidationError
   * @param {any} error - Erreur de validation Mongoose
   * @param {string} entityName - Nom de l'entité
   * @returns {Error} Exception NestJS appropriée
   */
  private handleValidationError(error: any, entityName: string): Error {
    const validationErrors = Object.values(error.errors || {})
      .map((err: any) => err.message)
      .join(', ');

    return this.createError(
      ApplicationErrorCode.VALIDATION_FAILED,
      `Données ${entityName} invalides : ${validationErrors}`,
      'Mongoose.Validation',
      { validationErrors: error.errors }
    );
  }

  // ========== WRAPPERS SPÉCIALISÉS POUR OPÉRATIONS CRUD ==========

  /**
   * Wrapper spécialisé pour opérations de lecture avec option NotFound
   *
   * @static
   * @async
   * @method handleFindOperation
   * @template T
   * @param {() => Promise<T>} operation - Opération de lecture
   * @param {string} entityName - Nom de l'entité
   * @param {string} [entityId] - ID de l'entité recherchée
   * @param {boolean} [shouldThrowIfNotFound=false] - Lancer erreur si non trouvé
   * @returns {Promise<T>} Résultat de la recherche
   */
  static async handleFindOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    entityId?: string,
    shouldThrowIfNotFound: boolean = false
  ): Promise<T> {
    const result = await this.handleDatabaseOperation(operation, {
      operationName: 'FIND',
      entityName,
      entityId
    });

    if (shouldThrowIfNotFound && !result) {
      const handler = new DatabaseErrorHandler();
      throw handler.createError(
        ApplicationErrorCode.RESOURCE_NOT_FOUND,
        `${entityName} non trouvé${entityId ? ` (ID: ${entityId})` : ''}`,
        `FIND.${entityName}.NotFound`,
        { entityId }
      );
    }

    return result;
  }

  /**
   * Wrapper spécialisé pour opérations de création
   */
  static async handleCreateOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    userId?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(operation, {
      operationName: 'CREATE',
      entityName,
      userId
    });
  }

  /**
   * Wrapper spécialisé pour opérations de mise à jour
   */
  static async handleUpdateOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    entityId: string,
    userId?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(operation, {
      operationName: 'UPDATE',
      entityName,
      entityId,
      userId
    });
  }

  /**
   * Wrapper spécialisé pour opérations de suppression
   */
  static async handleDeleteOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    entityId: string,
    userId?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(operation, {
      operationName: 'DELETE',
      entityName,
      entityId,
      userId
    });
  }

  /**
   * Wrapper spécialisé pour opérations de recherche/listing
   */
  static async handleSearchOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    query?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(operation, {
      operationName: 'SEARCH',
      entityName: `${entityName}${query ? ` (query: ${query})` : ''}`
    });
  }

  /**
   * Wrapper spécialisé pour opérations d'agrégation
   */
  static async handleAggregationOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    aggregationType: string = 'stats'
  ): Promise<T> {
    return this.handleDatabaseOperation(operation, {
      operationName: 'AGGREGATION',
      entityName: `${entityName} (${aggregationType})`
    });
  }
}

/**
 * Décorateur pour gestion automatique d'erreurs sur méthodes de service
 *
 * Ce décorateur applique automatiquement la gestion d'erreurs de base de données
 * sur les méthodes de service sans code répétitif. Il utilise le nom de la méthode
 * comme nom d'opération pour le logging et le contexte.
 *
 * @function HandleDatabaseErrors
 * @param {string} entityName - Nom de l'entité pour messages d'erreur
 * @returns {MethodDecorator} Décorateur de méthode
 *
 * @example
 * ```typescript
 * class UserService {
 *   @HandleDatabaseErrors('User')
 *   async createUser(userData: CreateUserDto) {
 *     return this.userModel.create(userData);
 *   }
 *
 *   @HandleDatabaseErrors('User')
 *   async findUserById(userId: string) {
 *     return this.userModel.findById(userId);
 *   }
 * }
 * ```
 */
export function HandleDatabaseErrors(entityName: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return DatabaseErrorHandler.handleDatabaseOperation(
        () => method.apply(this, args),
        {
          operationName: propertyName.toUpperCase(),
          entityName
        }
      );
    };

    return descriptor;
  };
}