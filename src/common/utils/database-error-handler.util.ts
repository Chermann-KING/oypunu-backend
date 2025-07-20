import { 
  BadRequestException, 
  InternalServerErrorException, 
  NotFoundException,
  ConflictException,
  Logger
} from '@nestjs/common';
import { MongoError } from 'mongodb';

/**
 * Utilitaire centralisé pour la gestion des erreurs de base de données
 * PHASE 1 - ÉTAPE 4 : Stabilité application via gestion d'erreurs DB
 */

export class DatabaseErrorHandler {
  private static readonly logger = new Logger('DatabaseErrorHandler');

  /**
   * Wrapper générique pour les opérations de base de données avec gestion d'erreur complète
   */
  static async handleDatabaseOperation<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      entityName: string;
      entityId?: string;
      userId?: string;
    }
  ): Promise<T> {
    const { operationName, entityName, entityId, userId } = context;
    
    try {
      this.logger.debug(`🔍 [${operationName}] Début opération ${entityName}${entityId ? ` (ID: ${entityId})` : ''}`);
      
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.logger.debug(`✅ [${operationName}] ${entityName} - Succès en ${duration}ms`);
      
      return result;
    } catch (error) {
      this.logger.error(`❌ [${operationName}] Erreur ${entityName}:`, {
        error: error.message,
        entityId,
        userId,
        stack: error.stack
      });

      throw this.handleDatabaseError(error, context);
    }
  }

  /**
   * Gestion spécialisée des erreurs MongoDB avec messages utilisateur appropriés
   */
  private static handleDatabaseError(error: any, context: { operationName: string; entityName: string; entityId?: string }): Error {
    const { operationName, entityName, entityId } = context;

    // Erreurs MongoDB spécifiques
    if (error.name === 'MongoError' || error instanceof MongoError) {
      return this.handleMongoError(error, entityName);
    }

    // Erreurs Mongoose de validation
    if (error.name === 'ValidationError') {
      return this.handleValidationError(error, entityName);
    }

    // Erreurs Mongoose de cast (ID invalide)
    if (error.name === 'CastError') {
      return new BadRequestException(
        `ID ${entityName} invalide : ${entityId || 'non spécifié'}`
      );
    }

    // Erreurs de connexion MongoDB
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      this.logger.error(`🔴 [${operationName}] Problème de connexion base de données`, error);
      return new InternalServerErrorException(
        'Service temporairement indisponible. Veuillez réessayer dans quelques instants.'
      );
    }

    // Erreurs NestJS existantes (ne pas envelopper)
    if (error instanceof BadRequestException || 
        error instanceof NotFoundException || 
        error instanceof ConflictException) {
      return error;
    }

    // Erreur générique
    this.logger.error(`🔴 [${operationName}] Erreur inattendue ${entityName}:`, error);
    return new InternalServerErrorException(
      `Erreur lors de l'opération sur ${entityName}. Veuillez contacter le support si le problème persiste.`
    );
  }

  /**
   * Gestion des erreurs MongoDB spécifiques
   */
  private static handleMongoError(error: any, entityName: string): Error {
    // Erreur de duplication (clé unique)
    if (error.code === 11000) {
      const field = this.extractDuplicateField(error);
      return new ConflictException(
        `${entityName} avec ${field} existe déjà`
      );
    }

    // Erreur de taille de document
    if (error.code === 2) {
      return new BadRequestException(
        `${entityName} trop volumineux pour être enregistré`
      );
    }

    // Erreur d'index
    if (error.code === 85) {
      this.logger.error(`🔴 Erreur d'index MongoDB pour ${entityName}:`, error);
      return new InternalServerErrorException(
        'Erreur de base de données. Veuillez réessayer.'
      );
    }

    // Autres erreurs MongoDB
    return new InternalServerErrorException(
      `Erreur de base de données lors de l'opération sur ${entityName}`
    );
  }

  /**
   * Gestion des erreurs de validation Mongoose
   */
  private static handleValidationError(error: any, entityName: string): Error {
    const validationErrors = Object.values(error.errors || {})
      .map((err: any) => err.message)
      .join(', ');

    return new BadRequestException(
      `Données ${entityName} invalides : ${validationErrors}`
    );
  }

  /**
   * Extraction du champ dupliqué à partir de l'erreur MongoDB 11000
   */
  private static extractDuplicateField(error: any): string {
    const message = error.message || '';
    const match = message.match(/index: (\w+)/);
    return match ? match[1] : 'cette valeur';
  }

  /**
   * Wrapper spécialisé pour les opérations de lecture (findOne, findById, etc.)
   */
  static async handleFindOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    entityId?: string,
    shouldThrowIfNotFound: boolean = false
  ): Promise<T> {
    return this.handleDatabaseOperation(
      operation,
      {
        operationName: 'FIND',
        entityName,
        entityId
      }
    ).then(result => {
      if (shouldThrowIfNotFound && !result) {
        throw new NotFoundException(`${entityName} non trouvé${entityId ? ` (ID: ${entityId})` : ''}`);
      }
      return result;
    });
  }

  /**
   * Wrapper spécialisé pour les opérations de création
   */
  static async handleCreateOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    userId?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(
      operation,
      {
        operationName: 'CREATE',
        entityName,
        userId
      }
    );
  }

  /**
   * Wrapper spécialisé pour les opérations de mise à jour
   */
  static async handleUpdateOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    entityId: string,
    userId?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(
      operation,
      {
        operationName: 'UPDATE',
        entityName,
        entityId,
        userId
      }
    );
  }

  /**
   * Wrapper spécialisé pour les opérations de suppression
   */
  static async handleDeleteOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    entityId: string,
    userId?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(
      operation,
      {
        operationName: 'DELETE',
        entityName,
        entityId,
        userId
      }
    );
  }

  /**
   * Wrapper spécialisé pour les opérations de recherche/listing
   */
  static async handleSearchOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    query?: string
  ): Promise<T> {
    return this.handleDatabaseOperation(
      operation,
      {
        operationName: 'SEARCH',
        entityName: `${entityName}${query ? ` (query: ${query})` : ''}`
      }
    );
  }

  /**
   * Wrapper spécialisé pour les opérations d'agrégation
   */
  static async handleAggregationOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    aggregationType: string = 'stats'
  ): Promise<T> {
    return this.handleDatabaseOperation(
      operation,
      {
        operationName: 'AGGREGATION',
        entityName: `${entityName} (${aggregationType})`
      }
    );
  }
}

/**
 * Décorateur pour automatiser la gestion d'erreurs sur les méthodes de service
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