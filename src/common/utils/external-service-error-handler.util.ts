import { 
  BadRequestException, 
  InternalServerErrorException,
  Logger 
} from '@nestjs/common';

/**
 * Utilitaire centralisé pour la gestion des erreurs de services externes
 * PHASE 2-4: Centralisation des patterns d'erreurs répétés pour services tiers
 */
export class ExternalServiceErrorHandler {
  private static readonly logger = new Logger('ExternalServiceErrorHandler');

  /**
   * Gestion centralisée des erreurs Cloudinary
   */
  static handleCloudinaryError(error: any, operation: 'upload' | 'delete'): never {
    this.logger.error(`❌ Erreur Cloudinary (${operation}):`, {
      message: error.message,
      code: error.http_code,
      stack: error.stack
    });

    const operationText = operation === 'upload' ? 'upload' : 'suppression';

    // Erreurs Cloudinary spécifiques
    if (error.http_code === 400) {
      throw new BadRequestException(
        `Fichier invalide pour l'${operationText}. Vérifiez le format et la taille.`
      );
    }

    if (error.http_code === 401) {
      this.logger.error('🔴 Configuration Cloudinary invalide');
      throw new InternalServerErrorException(
        'Configuration du service de stockage invalide'
      );
    }

    if (error.http_code === 413) {
      throw new BadRequestException(
        'Fichier trop volumineux pour être traité'
      );
    }

    if (error.http_code === 420) {
      throw new BadRequestException(
        'Limite de traitement dépassée. Réessayez dans quelques minutes.'
      );
    }

    // Erreur générique Cloudinary
    if (error instanceof Error) {
      throw new BadRequestException(
        `Erreur lors de l'${operationText}: ${error.message}`
      );
    }

    throw new BadRequestException(
      `Erreur inconnue lors de l'${operationText}`
    );
  }

  /**
   * Gestion centralisée des erreurs d'email
   */
  static handleEmailError(error: any, emailType: 'verification' | 'reset' | 'notification'): never {
    const emailTypeText = {
      verification: "vérification",
      reset: "réinitialisation",
      notification: "notification"
    }[emailType];

    this.logger.error(`❌ Erreur envoi email ${emailTypeText}:`, {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Erreurs SMTP spécifiques
    if (error.code === 'EAUTH') {
      this.logger.error('🔴 Authentification SMTP échouée');
      throw new InternalServerErrorException(
        'Configuration email invalide'
      );
    }

    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      throw new InternalServerErrorException(
        'Service email temporairement indisponible. Réessayez plus tard.'
      );
    }

    if (error.code === 'EMESSAGE') {
      throw new BadRequestException(
        'Format du message email invalide'
      );
    }

    // Email rejeté par le destinataire
    if (error.responseCode >= 500 && error.responseCode < 600) {
      throw new BadRequestException(
        'Adresse email temporairement indisponible'
      );
    }

    if (error.responseCode >= 400 && error.responseCode < 500) {
      throw new BadRequestException(
        'Adresse email invalide ou inexistante'
      );
    }

    // Erreur générique email
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    
    this.logger.error(
      `Erreur lors de l'envoi de l'email de ${emailTypeText}: ${errorMessage}`
    );

    throw new InternalServerErrorException(
      `Impossible d'envoyer l'email de ${emailTypeText}. Veuillez réessayer.`
    );
  }

  /**
   * Gestion centralisée des erreurs de token JWT/Auth
   */
  static handleTokenError(error: any, tokenType: 'access' | 'refresh' | 'reset' | 'verification'): never {
    this.logger.warn(`⚠️ Erreur token ${tokenType}:`, {
      message: error.message,
      name: error.name
    });

    const tokenTypeText = {
      access: "d'accès",
      refresh: "de rafraîchissement", 
      reset: "de réinitialisation",
      verification: "de vérification"
    }[tokenType];

    // Erreurs JWT spécifiques
    if (error.name === 'TokenExpiredError') {
      throw new BadRequestException(`Token ${tokenTypeText} expiré`);
    }

    if (error.name === 'JsonWebTokenError') {
      throw new BadRequestException(`Token ${tokenTypeText} invalide`);
    }

    if (error.name === 'NotBeforeError') {
      throw new BadRequestException(`Token ${tokenTypeText} pas encore valide`);
    }

    // Erreur générique token
    throw new BadRequestException(`Token ${tokenTypeText} invalide ou expiré`);
  }

  /**
   * Gestion centralisée des erreurs d'API externes
   */
  static handleExternalApiError(
    error: any, 
    serviceName: string, 
    operation: string
  ): never {
    this.logger.error(`❌ Erreur API ${serviceName} (${operation}):`, {
      message: error.message,
      status: error.status || error.statusCode,
      response: error.response?.data || error.response
    });

    const status = error.status || error.statusCode;

    // Erreurs HTTP standard
    if (status === 400) {
      throw new BadRequestException(
        `Requête invalide vers ${serviceName}`
      );
    }

    if (status === 401) {
      this.logger.error(`🔴 Authentification ${serviceName} échouée`);
      throw new InternalServerErrorException(
        `Configuration ${serviceName} invalide`
      );
    }

    if (status === 403) {
      throw new BadRequestException(
        `Accès refusé par ${serviceName}`
      );
    }

    if (status === 404) {
      throw new BadRequestException(
        `Ressource non trouvée sur ${serviceName}`
      );
    }

    if (status === 429) {
      throw new BadRequestException(
        `Limite de requêtes ${serviceName} dépassée. Réessayez plus tard.`
      );
    }

    if (status >= 500) {
      throw new InternalServerErrorException(
        `${serviceName} temporairement indisponible`
      );
    }

    // Erreur de réseau
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new InternalServerErrorException(
        `Impossible de contacter ${serviceName}`
      );
    }

    // Erreur générique API
    throw new InternalServerErrorException(
      `Erreur lors de la communication avec ${serviceName}`
    );
  }

  /**
   * Helper pour wrapper les opérations de services externes
   */
  static async handleExternalOperation<T>(
    operation: () => Promise<T>,
    context: {
      serviceName: string;
      operationType: string;
      errorHandler?: (error: any) => never;
    }
  ): Promise<T> {
    const { serviceName, operationType, errorHandler } = context;
    
    try {
      this.logger.debug(`🔍 [${operationType}] Appel ${serviceName}...`);
      
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.logger.debug(`✅ [${operationType}] ${serviceName} - Succès en ${duration}ms`);
      
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