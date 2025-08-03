/**
 * @fileoverview Gestionnaire d'erreurs pour services externes O'Ypunu
 *
 * Ce gestionnaire centralise la gestion d'erreurs pour tous les services
 * externes utilisés par l'application : Cloudinary, email SMTP, APIs tierces,
 * tokens JWT, etc. Il fournit une gestion spécialisée par type de service
 * avec messages utilisateur appropriés et logging détaillé.
 *
 * @author Équipe O'Ypunu
 * @version 2.0.0 - Amélioré avec documentation complète
 * @since 2025-01-01
 */

import { 
  BadRequestException, 
  InternalServerErrorException,
  Logger 
} from '@nestjs/common';
import { BaseErrorHandler } from '../core/base-error.handler';
import { ApplicationErrorCode } from '../core/error-codes.enum';
import { 
  ExternalServiceContext,
  EmailType,
  TokenType,
  CloudinaryOperation
} from '../core/error.interfaces';

/**
 * Gestionnaire centralisé d'erreurs pour services externes
 *
 * Cette classe hérite de BaseErrorHandler et spécialise la gestion d'erreurs
 * pour tous les services externes utilisés par O'Ypunu. Elle fournit des
 * méthodes dédiées par type de service avec gestion appropriée des codes
 * d'erreur spécifiques et messages utilisateur contextualisés.
 *
 * ## 🌐 Services externes supportés :
 *
 * ### Cloudinary (Stockage d'images)
 * - Upload et suppression d'images
 * - Gestion des erreurs de quota et format
 * - Messages d'erreur contextualisés
 *
 * ### Services Email (SMTP)
 * - Envoi d'emails de vérification, reset, notification
 * - Gestion des erreurs SMTP et de livraison
 * - Validation des adresses et formats
 *
 * ### JWT et Tokens
 * - Validation et décodage de tokens
 * - Gestion des expirations et invalidités
 * - Support multi-types de tokens
 *
 * ### APIs Externes
 * - Appels HTTP vers services tiers
 * - Gestion des codes de statut standard
 * - Timeouts et erreurs de réseau
 *
 * @class ExternalServiceErrorHandler
 * @extends BaseErrorHandler
 * @version 2.0.0
 */
export class ExternalServiceErrorHandler extends BaseErrorHandler {
  /** Logger spécialisé pour les erreurs de services externes */
  protected readonly logger = new Logger('ExternalServiceErrorHandler');

  // ========== ERREURS CLOUDINARY ==========

  /**
   * Gestion centralisée des erreurs Cloudinary
   *
   * Cette méthode traite toutes les erreurs liées aux opérations Cloudinary
   * (upload, suppression d'images) avec des messages utilisateur appropriés
   * selon le type d'erreur et l'opération en cours.
   *
   * @static
   * @method handleCloudinaryError
   * @param {any} error - Erreur Cloudinary originale
   * @param {CloudinaryOperation} operation - Type d'opération ('upload' | 'delete')
   * @throws {BadRequestException|InternalServerErrorException} Exception appropriée
   *
   * @example
   * ```typescript
   * try {
   *   await cloudinary.uploader.upload(file);
   * } catch (error) {
   *   ExternalServiceErrorHandler.handleCloudinaryError(error, 'upload');
   * }
   * ```
   */
  static handleCloudinaryError(error: any, operation: CloudinaryOperation): never {
    const handler = new ExternalServiceErrorHandler();
    
    handler.logger.error(`❌ Erreur Cloudinary (${operation}):`, {
      message: error.message,
      code: error.http_code,
      stack: error.stack
    });

    const operationText = operation === 'upload' ? 'upload' : 'suppression';

    // Erreurs Cloudinary spécifiques par code HTTP
    switch (error.http_code) {
      case 400:
        throw handler.createError(
          ApplicationErrorCode.VALIDATION_FAILED,
          `Fichier invalide pour l'${operationText}. Vérifiez le format et la taille.`,
          `Cloudinary.${operation}.InvalidFile`,
          { httpCode: error.http_code, cloudinaryError: error.message }
        );

      case 401:
        handler.logger.error('🔴 Configuration Cloudinary invalide');
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          'Configuration du service de stockage invalide',
          `Cloudinary.${operation}.Unauthorized`,
          { httpCode: error.http_code }
        );

      case 413:
        throw handler.createError(
          ApplicationErrorCode.VALIDATION_FAILED,
          'Fichier trop volumineux pour être traité',
          `Cloudinary.${operation}.FileTooLarge`,
          { httpCode: error.http_code }
        );

      case 420:
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          'Limite de traitement dépassée. Réessayez dans quelques minutes.',
          `Cloudinary.${operation}.RateLimit`,
          { httpCode: error.http_code }
        );

      default:
        // Erreur générique Cloudinary
        if (error instanceof Error) {
          throw handler.createError(
            ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
            `Erreur lors de l'${operationText}: ${error.message}`,
            `Cloudinary.${operation}.Generic`,
            { originalError: error.message }
          );
        }

        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          `Erreur inconnue lors de l'${operationText}`,
          `Cloudinary.${operation}.Unknown`
        );
    }
  }

  // ========== ERREURS EMAIL ==========

  /**
   * Gestion centralisée des erreurs d'envoi d'email
   *
   * Cette méthode traite les erreurs SMTP et de livraison d'emails avec
   * classification par type d'email et gestion appropriée des codes d'erreur.
   *
   * @static
   * @method handleEmailError
   * @param {any} error - Erreur SMTP/email originale
   * @param {EmailType} emailType - Type d'email ('verification' | 'reset' | 'notification')
   * @throws {BadRequestException|InternalServerErrorException} Exception appropriée
   *
   * @example
   * ```typescript
   * try {
   *   await this.mailService.sendVerificationEmail(email);
   * } catch (error) {
   *   ExternalServiceErrorHandler.handleEmailError(error, 'verification');
   * }
   * ```
   */
  static handleEmailError(error: any, emailType: EmailType): never {
    const handler = new ExternalServiceErrorHandler();
    
    const emailTypeText = {
      verification: "vérification",
      reset: "réinitialisation",
      notification: "notification"
    }[emailType];

    handler.logger.error(`❌ Erreur envoi email ${emailTypeText}:`, {
      message: error.message,
      code: error.code,
      stack: error.stack,
      responseCode: error.responseCode
    });

    // Erreurs SMTP spécifiques par code
    if (error.code === 'EAUTH') {
      handler.logger.error('🔴 Authentification SMTP échouée');
      throw handler.createError(
        ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
        'Configuration email invalide',
        `Email.${emailType}.AuthFailed`,
        { smtpCode: error.code }
      );
    }

    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw handler.createError(
        ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
        'Service email temporairement indisponible. Réessayez plus tard.',
        `Email.${emailType}.ConnectionFailed`,
        { smtpCode: error.code }
      );
    }

    if (error.code === 'EMESSAGE') {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        'Format du message email invalide',
        `Email.${emailType}.InvalidMessage`,
        { smtpCode: error.code }
      );
    }

    // Erreurs de réponse SMTP par code de statut
    if (error.responseCode >= 500 && error.responseCode < 600) {
      throw handler.createError(
        ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
        'Adresse email temporairement indisponible',
        `Email.${emailType}.TemporaryFailure`,
        { responseCode: error.responseCode }
      );
    }

    if (error.responseCode >= 400 && error.responseCode < 500) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        'Adresse email invalide ou inexistante',
        `Email.${emailType}.InvalidAddress`,
        { responseCode: error.responseCode }
      );
    }

    // Erreur générique email
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    
    handler.logger.error(
      `Erreur lors de l'envoi de l'email de ${emailTypeText}: ${errorMessage}`
    );

    throw handler.createError(
      ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
      `Impossible d'envoyer l'email de ${emailTypeText}. Veuillez réessayer.`,
      `Email.${emailType}.Generic`,
      { originalError: errorMessage }
    );
  }

  // ========== ERREURS TOKEN JWT ==========

  /**
   * Gestion centralisée des erreurs de token JWT
   *
   * Cette méthode traite les erreurs de validation, décodage et vérification
   * des tokens JWT avec gestion spécialisée par type de token.
   *
   * @static
   * @method handleTokenError
   * @param {any} error - Erreur JWT originale
   * @param {TokenType} tokenType - Type de token ('access' | 'refresh' | 'reset' | 'verification')
   * @throws {BadRequestException} Exception token invalide
   *
   * @example
   * ```typescript
   * try {
   *   const decoded = jwt.verify(token, secret);
   * } catch (error) {
   *   ExternalServiceErrorHandler.handleTokenError(error, 'access');
   * }
   * ```
   */
  static handleTokenError(error: any, tokenType: TokenType): never {
    const handler = new ExternalServiceErrorHandler();
    
    handler.logger.warn(`⚠️ Erreur token ${tokenType}:`, {
      message: error.message,
      name: error.name
    });

    const tokenTypeText = {
      access: "d'accès",
      refresh: "de rafraîchissement", 
      reset: "de réinitialisation",
      verification: "de vérification"
    }[tokenType];

    // Erreurs JWT spécifiques par nom d'erreur
    switch (error.name) {
      case 'TokenExpiredError':
        throw handler.createError(
          ApplicationErrorCode.AUTH_TOKEN_EXPIRED,
          `Token ${tokenTypeText} expiré`,
          `JWT.${tokenType}.Expired`,
          { expiredAt: error.expiredAt }
        );

      case 'JsonWebTokenError':
        throw handler.createError(
          ApplicationErrorCode.AUTH_TOKEN_INVALID,
          `Token ${tokenTypeText} invalide`,
          `JWT.${tokenType}.Invalid`,
          { jwtError: error.message }
        );

      case 'NotBeforeError':
        throw handler.createError(
          ApplicationErrorCode.AUTH_TOKEN_INVALID,
          `Token ${tokenTypeText} pas encore valide`,
          `JWT.${tokenType}.NotBefore`,
          { date: error.date }
        );

      default:
        // Erreur générique token
        throw handler.createError(
          ApplicationErrorCode.AUTH_TOKEN_INVALID,
          `Token ${tokenTypeText} invalide ou expiré`,
          `JWT.${tokenType}.Generic`,
          { originalError: error.message }
        );
    }
  }

  // ========== ERREURS API EXTERNES ==========

  /**
   * Gestion centralisée des erreurs d'API externes
   *
   * Cette méthode traite les erreurs HTTP standard lors d'appels vers
   * des APIs externes avec gestion appropriée des codes de statut.
   *
   * @static
   * @method handleExternalApiError
   * @param {any} error - Erreur API originale
   * @param {string} serviceName - Nom du service externe
   * @param {string} operation - Nom de l'opération
   * @throws {BadRequestException|InternalServerErrorException} Exception appropriée
   *
   * @example
   * ```typescript
   * try {
   *   const response = await axios.get('https://api.service.com/data');
   * } catch (error) {
   *   ExternalServiceErrorHandler.handleExternalApiError(error, 'ServiceAPI', 'getData');
   * }
   * ```
   */
  static handleExternalApiError(
    error: any, 
    serviceName: string, 
    operation: string
  ): never {
    const handler = new ExternalServiceErrorHandler();
    
    handler.logger.error(`❌ Erreur API ${serviceName} (${operation}):`, {
      message: error.message,
      status: error.status || error.statusCode,
      response: error.response?.data || error.response
    });

    const status = error.status || error.statusCode;

    // Gestion des erreurs HTTP standard
    switch (true) {
      case status === 400:
        throw handler.createError(
          ApplicationErrorCode.VALIDATION_FAILED,
          `Requête invalide vers ${serviceName}`,
          `${serviceName}.${operation}.BadRequest`,
          { status, response: error.response?.data }
        );

      case status === 401:
        handler.logger.error(`🔴 Authentification ${serviceName} échouée`);
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          `Configuration ${serviceName} invalide`,
          `${serviceName}.${operation}.Unauthorized`,
          { status }
        );

      case status === 403:
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          `Accès refusé par ${serviceName}`,
          `${serviceName}.${operation}.Forbidden`,
          { status }
        );

      case status === 404:
        throw handler.createError(
          ApplicationErrorCode.RESOURCE_NOT_FOUND,
          `Ressource non trouvée sur ${serviceName}`,
          `${serviceName}.${operation}.NotFound`,
          { status }
        );

      case status === 429:
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          `Limite de requêtes ${serviceName} dépassée. Réessayez plus tard.`,
          `${serviceName}.${operation}.RateLimit`,
          { status }
        );

      case status >= 500:
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          `${serviceName} temporairement indisponible`,
          `${serviceName}.${operation}.ServerError`,
          { status }
        );

      default:
        // Erreurs de réseau
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw handler.createError(
            ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
            `Impossible de contacter ${serviceName}`,
            `${serviceName}.${operation}.NetworkError`,
            { networkError: error.code }
          );
        }

        // Erreur générique API
        throw handler.createError(
          ApplicationErrorCode.EXTERNAL_SERVICE_ERROR,
          `Erreur lors de la communication avec ${serviceName}`,
          `${serviceName}.${operation}.Generic`,
          { originalError: error.message }
        );
    }
  }

  // ========== WRAPPER GÉNÉRIQUE ==========

  /**
   * Wrapper générique pour opérations de services externes
   *
   * Cette méthode encapsule les appels aux services externes avec gestion
   * d'erreurs, logging et monitoring des performances automatiques.
   *
   * @static
   * @async
   * @method handleExternalOperation
   * @template T Type de retour de l'opération
   * @param {() => Promise<T>} operation - Opération async à exécuter
   * @param {ExternalServiceContext} context - Contexte du service externe
   * @returns {Promise<T>} Résultat de l'opération
   * @throws {HttpException} Exception appropriée selon le type d'erreur
   *
   * @example
   * ```typescript
   * const result = await ExternalServiceErrorHandler.handleExternalOperation(
   *   () => this.httpService.get('https://api.service.com/data').toPromise(),
   *   {
   *     serviceName: 'ExternalAPI',
   *     operationType: 'fetchUserData',
   *     errorHandler: (error) => this.handleSpecificError(error)
   *   }
   * );
   * ```
   */
  static async handleExternalOperation<T>(
    operation: () => Promise<T>,
    context: ExternalServiceContext
  ): Promise<T> {
    const handler = new ExternalServiceErrorHandler();
    const { serviceName, operationType, errorHandler } = context;
    
    try {
      handler.logger.debug(`🔍 [${operationType}] Appel ${serviceName}...`);
      
      const result = await handler.measureExecutionTime(
        operation,
        `${operationType} ${serviceName}`
      );
      
      return result;
    } catch (error) {
      if (errorHandler) {
        errorHandler(error);
      } else {
        this.handleExternalApiError(error, serviceName, operationType);
      }
    }
  }
}