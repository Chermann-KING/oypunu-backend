/**
 * @fileoverview Codes d'erreur standardisés pour l'application O'Ypunu
 *
 * Ce fichier centralise tous les codes d'erreur utilisés dans l'application
 * pour garantir la cohérence, faciliter la maintenance et permettre une
 * gestion unifiée des erreurs à travers tous les modules.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

/**
 * Énumération des codes d'erreur standardisés pour O'Ypunu
 *
 * Cette énumération centralise tous les codes d'erreur utilisés dans l'application
 * pour garantir la cohérence des messages d'erreur et faciliter le debugging.
 * Les codes sont organisés par catégorie pour une maintenance aisée.
 *
 * ## 📋 Catégories d'erreurs :
 * - **AUTH_** : Erreurs d'authentification et autorisation
 * - **VALIDATION_** : Erreurs de validation des données
 * - **RESOURCE_** : Erreurs liées aux ressources (CRUD)
 * - **BUSINESS_** : Erreurs de logique métier spécifique
 * - **SYSTEM_** : Erreurs système et techniques
 *
 * @enum {string} ApplicationErrorCode
 * @version 1.0.0
 */
export enum ApplicationErrorCode {
  // ========== ERREURS D'AUTHENTIFICATION ==========
  /** Token d'authentification manquant dans la requête */
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  /** Token d'authentification invalide ou malformé */
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  /** Token d'authentification expiré */
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  /** Identifiants de connexion invalides */
  AUTH_CREDENTIALS_INVALID = 'AUTH_CREDENTIALS_INVALID',

  // ========== ERREURS DE VALIDATION ==========
  /** Échec de validation des données d'entrée */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  /** Format d'ObjectId MongoDB invalide */
  INVALID_OBJECT_ID = 'INVALID_OBJECT_ID',
  /** Champ requis manquant */
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',

  // ========== ERREURS DE RESSOURCES ==========
  /** Ressource demandée non trouvée */
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  /** Tentative de création d'une ressource existante */
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  /** Accès refusé à la ressource demandée */
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // ========== ERREURS DE LOGIQUE MÉTIER ==========
  /** Mot déjà présent dans les favoris de l'utilisateur */
  WORD_ALREADY_IN_FAVORITES = 'WORD_ALREADY_IN_FAVORITES',
  /** Mot non présent dans les favoris de l'utilisateur */
  WORD_NOT_IN_FAVORITES = 'WORD_NOT_IN_FAVORITES',
  /** Permissions insuffisantes pour l'opération */
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // ========== ERREURS SYSTÈME ==========
  /** Erreur de base de données MongoDB */
  DATABASE_ERROR = 'DATABASE_ERROR',
  /** Erreur de service externe (API, email, etc.) */
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  /** Erreur serveur interne générique */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/**
 * Mapping des codes d'erreur vers les codes de statut HTTP
 *
 * Cette constante associe chaque code d'erreur applicatif à son
 * code de statut HTTP approprié pour une réponse cohérente.
 *
 * @constant {Object} ERROR_STATUS_MAPPING
 */
export const ERROR_STATUS_MAPPING = {
  // Erreurs 401 - Non autorisé
  [ApplicationErrorCode.AUTH_TOKEN_MISSING]: 401,
  [ApplicationErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ApplicationErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ApplicationErrorCode.AUTH_CREDENTIALS_INVALID]: 401,

  // Erreurs 400 - Requête invalide
  [ApplicationErrorCode.VALIDATION_FAILED]: 400,
  [ApplicationErrorCode.INVALID_OBJECT_ID]: 400,
  [ApplicationErrorCode.REQUIRED_FIELD_MISSING]: 400,

  // Erreurs 404 - Non trouvé
  [ApplicationErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ApplicationErrorCode.WORD_NOT_IN_FAVORITES]: 404,

  // Erreurs 409 - Conflit
  [ApplicationErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ApplicationErrorCode.WORD_ALREADY_IN_FAVORITES]: 409,

  // Erreurs 403 - Interdit
  [ApplicationErrorCode.RESOURCE_ACCESS_DENIED]: 403,
  [ApplicationErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // Erreurs 500 - Erreur serveur
  [ApplicationErrorCode.DATABASE_ERROR]: 500,
  [ApplicationErrorCode.EXTERNAL_SERVICE_ERROR]: 503,
  [ApplicationErrorCode.INTERNAL_SERVER_ERROR]: 500,
} as const;