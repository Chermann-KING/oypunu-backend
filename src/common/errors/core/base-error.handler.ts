/**
 * @fileoverview Gestionnaire d'erreurs de base pour O'Ypunu
 *
 * Cette classe abstraite fournit les fonctionnalités communes à tous
 * les gestionnaires d'erreurs spécialisés. Elle centralise le logging,
 * la création d'exceptions standardisées et les utilitaires partagés.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { HttpException, Logger, HttpStatus } from '@nestjs/common';
import { ApplicationErrorCode, ERROR_STATUS_MAPPING } from './error-codes.enum';
import { ApplicationError } from './error.interfaces';

/**
 * Gestionnaire d'erreurs de base avec fonctionnalités communes
 *
 * Cette classe abstraite fournit les méthodes et utilitaires communs
 * à tous les gestionnaires d'erreurs spécialisés. Elle garantit une
 * approche cohérente pour le logging, la création d'exceptions et
 * la gestion des erreurs à travers toute l'application.
 *
 * ## 🛠️ Fonctionnalités fournies :
 * - **Logging standardisé** avec contexte enrichi
 * - **Création d'exceptions** avec structure uniforme
 * - **Mapping automatique** codes erreur → statuts HTTP
 * - **Utilitaires** de formatage et validation
 *
 * @abstract
 * @class BaseErrorHandler
 * @version 1.0.0
 */
export abstract class BaseErrorHandler {
  /**
   * Logger spécifique à chaque gestionnaire d'erreur
   * Doit être initialisé par les classes dérivées
   */
  protected abstract readonly logger: Logger;

  /**
   * Crée une erreur structurée standardisée
   *
   * Cette méthode centrale crée toutes les erreurs de l'application
   * avec une structure cohérente, un logging automatique et un
   * mapping approprié vers les codes de statut HTTP.
   *
   * @protected
   * @method createError
   * @param {ApplicationErrorCode} code - Code d'erreur standardisé
   * @param {string} message - Message d'erreur lisible
   * @param {string} [context] - Contexte optionnel (module, opération)
   * @param {any} [details] - Détails supplémentaires pour debug
   * @returns {HttpException} Exception NestJS formatée
   *
   * @example
   * ```typescript
   * const error = this.createError(
   *   ApplicationErrorCode.RESOURCE_NOT_FOUND,
   *   'Utilisateur non trouvé',
   *   'UserService.findById',
   *   { userId: '123' }
   * );
   * ```
   */
  protected createError(
    code: ApplicationErrorCode,
    message: string,
    context?: string,
    details?: any
  ): HttpException {
    const statusCode = ERROR_STATUS_MAPPING[code] || HttpStatus.INTERNAL_SERVER_ERROR;

    const applicationError: ApplicationError = {
      code,
      message,
      details,
      statusCode,
      timestamp: new Date().toISOString(),
      context,
    };

    // Logging avec niveau approprié selon la sévérité
    this.logError(code, message, context, details, statusCode);

    return new HttpException(applicationError, statusCode);
  }

  /**
   * Logging intelligent selon le niveau de sévérité
   *
   * @private
   * @method logError
   * @param {ApplicationErrorCode} code - Code d'erreur
   * @param {string} message - Message d'erreur
   * @param {string} [context] - Contexte
   * @param {any} [details] - Détails
   * @param {number} statusCode - Code de statut HTTP
   */
  private logError(
    code: ApplicationErrorCode,
    message: string,
    context?: string,
    details?: any,
    statusCode?: number
  ): void {
    const logData = {
      code,
      context,
      details,
      statusCode,
    };

    // Niveau de log selon la sévérité
    if (statusCode >= 500) {
      // Erreurs serveur = ERROR
      this.logger.error(`🔴 [${code}] ${message}`, logData);
    } else if (statusCode >= 400) {
      // Erreurs client = WARN
      this.logger.warn(`⚠️ [${code}] ${message}`, logData);
    } else {
      // Autres = DEBUG
      this.logger.debug(`ℹ️ [${code}] ${message}`, logData);
    }
  }

  /**
   * Formate les bytes en unités lisibles
   *
   * @protected
   * @method formatBytes
   * @param {number} bytes - Nombre de bytes
   * @returns {string} Taille formatée (ex: "1.5 MB")
   */
  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extrait le champ dupliqué depuis une erreur MongoDB 11000
   *
   * @protected
   * @method extractDuplicateField
   * @param {any} error - Erreur MongoDB
   * @returns {string} Nom du champ dupliqué ou message générique
   */
  protected extractDuplicateField(error: any): string {
    const message = error.message || '';
    const match = message.match(/index: (\w+)/);
    return match ? match[1] : 'cette valeur';
  }

  /**
   * Vérifie si une erreur est déjà une exception NestJS
   *
   * @protected
   * @method isNestJSException
   * @param {any} error - Erreur à vérifier
   * @returns {boolean} True si c'est déjà une exception NestJS
   */
  protected isNestJSException(error: any): boolean {
    return error instanceof HttpException;
  }

  /**
   * Mesure et log le temps d'exécution d'une opération
   *
   * @protected
   * @method measureExecutionTime
   * @template T
   * @param {() => Promise<T>} operation - Opération à mesurer
   * @param {string} operationName - Nom de l'opération pour le log
   * @returns {Promise<T>} Résultat de l'opération
   */
  protected async measureExecutionTime<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.logger.debug(`⏱️ ${operationName} - Succès en ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`⏱️ ${operationName} - Échec en ${duration}ms`);
      throw error;
    }
  }
}