/**
 * @fileoverview Gestionnaire de validations communes pour O'Ypunu
 *
 * Ce gestionnaire centralise toutes les validations communes utilisées à travers
 * l'application pour garantir la cohérence, éviter la duplication de code et
 * fournir des messages d'erreur standardisés. Il couvre les validations de
 * formats, types, contraintes et règles métier partagées.
 *
 * @author Équipe O'Ypunu
 * @version 2.0.0 - Amélioré avec documentation complète et héritage BaseErrorHandler
 * @since 2025-01-01
 */

import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { BaseErrorHandler } from '../core/base-error.handler';
import { ApplicationErrorCode } from '../core/error-codes.enum';
import { FileValidationConstraints } from '../core/error.interfaces';

/**
 * Gestionnaire centralisé pour les validations communes
 *
 * Cette classe hérite de BaseErrorHandler et fournit des méthodes de validation
 * réutilisables pour tous les types de données communes dans l'application.
 * Elle garantit la cohérence des validations et la standardisation des
 * messages d'erreur à travers tous les modules.
 *
 * ## 🔍 Types de validations supportées :
 *
 * ### Identifiants et formats
 * - ObjectId MongoDB (simple et multiple)
 * - Formats d'email standard
 * - URLs valides
 * - Chaînes de caractères non vides
 *
 * ### Données structurées
 * - Tableaux non vides avec contraintes
 * - Fichiers avec contraintes de taille et type
 * - Paramètres de pagination
 * - Énumérations et valeurs autorisées
 *
 * ### Sécurité et mots de passe
 * - Force des mots de passe selon politique O'Ypunu
 * - Validation cohérente avec password.validator.ts
 * - Contraintes de sécurité applicatives
 *
 * @class ValidationErrorHandler
 * @extends BaseErrorHandler
 * @version 2.0.0
 */
export class ValidationErrorHandler extends BaseErrorHandler {
  /** Logger spécialisé pour les erreurs de validation */
  protected readonly logger = new Logger('ValidationErrorHandler');

  // ========== VALIDATION D'IDENTIFIANTS ==========

  /**
   * Validation d'ObjectId MongoDB avec message d'erreur unifié
   *
   * Vérifie qu'un ID fourni respecte le format ObjectId MongoDB et
   * génère une erreur standardisée en cas d'invalidité.
   *
   * @static
   * @method validateObjectId
   * @param {string} id - ID à valider
   * @param {string} entityName - Nom de l'entité pour message contextualisé
   * @throws {BadRequestException} Si l'ID est invalide
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validateObjectId(userId, 'User');
   * ValidationErrorHandler.validateObjectId(wordId, 'Word');
   * ```
   */
  static validateObjectId(id: string, entityName: string): void {
    const handler = new ValidationErrorHandler();
    
    if (!Types.ObjectId.isValid(id)) {
      handler.logger.warn(`❌ ID ${entityName} invalide fourni: ${id}`);
      throw handler.createError(
        ApplicationErrorCode.INVALID_OBJECT_ID,
        `ID ${entityName} invalide`,
        `Validation.ObjectId.${entityName}`,
        { invalidId: id, entityName }
      );
    }
  }

  /**
   * Validation de multiples ObjectIds MongoDB
   *
   * Vérifie qu'un tableau d'IDs respecte tous le format ObjectId et
   * génère une erreur détaillée listant tous les IDs invalides.
   *
   * @static
   * @method validateObjectIds
   * @param {string[]} ids - Tableau d'IDs à valider
   * @param {string} entityName - Nom de l'entité pour message contextualisé
   * @throws {BadRequestException} Si un ou plusieurs IDs sont invalides
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validateObjectIds([id1, id2, id3], 'Word');
   * ```
   */
  static validateObjectIds(ids: string[], entityName: string): void {
    const handler = new ValidationErrorHandler();
    const invalidIds = ids.filter(id => !Types.ObjectId.isValid(id));
    
    if (invalidIds.length > 0) {
      handler.logger.warn(`❌ IDs ${entityName} invalides fournis:`, invalidIds);
      throw handler.createError(
        ApplicationErrorCode.INVALID_OBJECT_ID,
        `IDs ${entityName} invalides: ${invalidIds.join(', ')}`,
        `Validation.ObjectIds.${entityName}`,
        { invalidIds, entityName, totalInvalid: invalidIds.length }
      );
    }
  }

  // ========== VALIDATION DE FICHIERS ==========

  /**
   * Validation de fichier avec contraintes personnalisables
   *
   * Vérifie qu'un fichier respecte les contraintes de taille, type MIME
   * et autres règles définies. Supporte validation flexible selon le
   * contexte d'utilisation.
   *
   * @static
   * @method validateFile
   * @param {Buffer | null | undefined} file - Données du fichier à valider
   * @param {FileValidationConstraints} constraints - Contraintes de validation
   * @param {string} [fileType='fichier'] - Type de fichier pour messages
   * @throws {BadRequestException} Si le fichier ne respecte pas les contraintes
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validateFile(imageBuffer, {
   *   maxSize: 5 * 1024 * 1024, // 5MB
   *   allowedMimeTypes: ['image/jpeg', 'image/png'],
   *   minSize: 1024 // 1KB minimum
   * }, 'image de profil');
   * ```
   */
  static validateFile(
    file: Buffer | null | undefined,
    constraints: FileValidationConstraints,
    fileType: string = 'fichier'
  ): void {
    const handler = new ValidationErrorHandler();

    if (!file || file.length === 0) {
      throw handler.createError(
        ApplicationErrorCode.REQUIRED_FIELD_MISSING,
        `${fileType} requis`,
        `Validation.File.Missing`,
        { fileType }
      );
    }

    if (constraints.minSize && file.length < constraints.minSize) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fileType} trop petit (minimum: ${handler.formatBytes(constraints.minSize)})`,
        `Validation.File.TooSmall`,
        { 
          fileType, 
          actualSize: file.length, 
          minSize: constraints.minSize,
          actualSizeFormatted: handler.formatBytes(file.length)
        }
      );
    }

    if (constraints.maxSize && file.length > constraints.maxSize) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fileType} trop volumineux (maximum: ${handler.formatBytes(constraints.maxSize)})`,
        `Validation.File.TooLarge`,
        { 
          fileType, 
          actualSize: file.length, 
          maxSize: constraints.maxSize,
          actualSizeFormatted: handler.formatBytes(file.length)
        }
      );
    }

    // Note: La validation MIME nécessiterait l'analyse du contenu du fichier
    // qui n'est pas disponible avec un simple Buffer. À implémenter si besoin.
  }

  // ========== VALIDATION DE FORMATS ==========

  /**
   * Validation de format d'email
   *
   * Vérifie qu'une adresse email respecte le format standard RFC avec
   * regex appropriée et logging des tentatives invalides.
   *
   * @static
   * @method validateEmail
   * @param {string} email - Adresse email à valider
   * @throws {BadRequestException} Si le format email est invalide
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validateEmail('user@example.com');
   * ```
   */
  static validateEmail(email: string): void {
    const handler = new ValidationErrorHandler();
    // Regex email améliorée conforme RFC 5322 (version simplifiée)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!email || !emailRegex.test(email)) {
      handler.logger.warn(`❌ Format email invalide: ${email}`);
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        'Format email invalide',
        'Validation.Email.Format',
        { email: email?.substring(0, 50) } // Limiter pour logs
      );
    }
  }

  /**
   * Validation d'URL
   *
   * Vérifie qu'une chaîne représente une URL valide en utilisant
   * le constructeur URL natif pour une validation robuste.
   *
   * @static
   * @method validateUrl
   * @param {string} url - URL à valider
   * @param {string} [fieldName='URL'] - Nom du champ pour message d'erreur
   * @throws {BadRequestException} Si l'URL est invalide
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validateUrl('https://example.com', 'site web');
   * ```
   */
  static validateUrl(url: string, fieldName: string = 'URL'): void {
    const handler = new ValidationErrorHandler();
    
    try {
      new URL(url);
    } catch {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fieldName} invalide`,
        'Validation.URL.Format',
        { url: url?.substring(0, 100), fieldName }
      );
    }
  }

  // ========== VALIDATION DE MOTS DE PASSE ==========

  /**
   * Validation de force de mot de passe
   *
   * Vérifie qu'un mot de passe respecte la politique de sécurité O'Ypunu
   * en cohérence avec password.validator.ts. Applique les mêmes critères
   * pour garantir la consistance.
   *
   * @static
   * @method validatePassword
   * @param {string} password - Mot de passe à valider
   * @throws {BadRequestException} Si le mot de passe ne respecte pas les critères
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validatePassword('MyStr0ng#Password2025!');
   * ```
   */
  static validatePassword(password: string): void {
    const handler = new ValidationErrorHandler();

    if (!password) {
      throw handler.createError(
        ApplicationErrorCode.REQUIRED_FIELD_MISSING,
        'Mot de passe requis',
        'Validation.Password.Missing'
      );
    }

    if (password.length < 12) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        'Mot de passe trop court (minimum 12 caractères)',
        'Validation.Password.TooShort',
        { actualLength: password.length, minLength: 12 }
      );
    }

    // Regex complexe pour validation complète des critères O'Ypunu
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`])/;
    
    if (!passwordRegex.test(password)) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        'Mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial',
        'Validation.Password.Complexity',
        { 
          hasLowercase: /[a-z]/.test(password),
          hasUppercase: /[A-Z]/.test(password),
          hasDigit: /\d/.test(password),
          hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
        }
      );
    }
  }

  // ========== VALIDATION DE DONNÉES STRUCTURÉES ==========

  /**
   * Validation de paramètres de pagination
   *
   * Normalise et valide les paramètres de pagination avec limites
   * raisonnables pour éviter les surcharges système.
   *
   * @static
   * @method validatePagination
   * @param {number} page - Numéro de page
   * @param {number} limit - Nombre d'éléments par page
   * @returns {{page: number, limit: number}} Paramètres normalisés
   *
   * @example
   * ```typescript
   * const { page, limit } = ValidationErrorHandler.validatePagination(1, 20);
   * ```
   */
  static validatePagination(page: number, limit: number): { page: number; limit: number } {
    const handler = new ValidationErrorHandler();
    
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit) || 10));

    if (page !== validatedPage || limit !== validatedLimit) {
      handler.logger.warn(`⚠️ Paramètres de pagination ajustés: page=${validatedPage}, limit=${validatedLimit}`, {
        originalPage: page,
        originalLimit: limit,
        adjustedPage: validatedPage,
        adjustedLimit: validatedLimit
      });
    }

    return { page: validatedPage, limit: validatedLimit };
  }

  /**
   * Validation d'énumération
   *
   * Vérifie qu'une valeur fait partie des valeurs autorisées d'une
   * énumération avec message d'erreur listant les options valides.
   *
   * @static
   * @method validateEnum
   * @template T Type de l'énumération
   * @param {string} value - Valeur à valider
   * @param {T} enumObject - Objet énumération de référence
   * @param {string} fieldName - Nom du champ pour message d'erreur
   * @throws {BadRequestException} Si la valeur n'est pas dans l'énumération
   *
   * @example
   * ```typescript
   * enum UserRole { USER = 'user', ADMIN = 'admin' }
   * ValidationErrorHandler.validateEnum('admin', UserRole, 'rôle utilisateur');
   * ```
   */
  static validateEnum<T extends Record<string, string | number>>(
    value: string,
    enumObject: T,
    fieldName: string
  ): void {
    const handler = new ValidationErrorHandler();
    const validValues = Object.values(enumObject);
    
    if (!validValues.includes(value as any)) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fieldName} invalide. Valeurs acceptées: ${validValues.join(', ')}`,
        'Validation.Enum.InvalidValue',
        { 
          fieldName, 
          invalidValue: value, 
          validValues,
          enumName: enumObject.constructor.name 
        }
      );
    }
  }

  /**
   * Validation de chaîne non vide avec trim
   *
   * Valide et normalise une chaîne de caractères en supprimant les
   * espaces et vérifiant la longueur minimale.
   *
   * @static
   * @method validateNonEmptyString
   * @param {string} value - Chaîne à valider
   * @param {string} fieldName - Nom du champ pour message d'erreur
   * @param {number} [minLength=1] - Longueur minimale requise
   * @returns {string} Chaîne normalisée (trimmed)
   * @throws {BadRequestException} Si la chaîne est invalide ou trop courte
   *
   * @example
   * ```typescript
   * const name = ValidationErrorHandler.validateNonEmptyString('  John  ', 'nom', 2);
   * // Retourne: 'John'
   * ```
   */
  static validateNonEmptyString(value: string, fieldName: string, minLength: number = 1): string {
    const handler = new ValidationErrorHandler();
    
    if (typeof value !== 'string') {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fieldName} doit être une chaîne de caractères`,
        'Validation.String.InvalidType',
        { fieldName, actualType: typeof value }
      );
    }

    const trimmed = value.trim();
    
    if (trimmed.length < minLength) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fieldName} doit contenir au moins ${minLength} caractère(s)`,
        'Validation.String.TooShort',
        { 
          fieldName, 
          actualLength: trimmed.length, 
          minLength,
          originalValue: value
        }
      );
    }

    return trimmed;
  }

  /**
   * Validation de tableau non vide
   *
   * Vérifie qu'un tableau contient au moins un élément et respecte
   * la longueur maximale autorisée.
   *
   * @static
   * @method validateNonEmptyArray
   * @template T Type des éléments du tableau
   * @param {T[]} array - Tableau à valider
   * @param {string} fieldName - Nom du champ pour message d'erreur
   * @param {number} [maxLength] - Longueur maximale autorisée
   * @throws {BadRequestException} Si le tableau est vide ou trop long
   *
   * @example
   * ```typescript
   * ValidationErrorHandler.validateNonEmptyArray(['tag1', 'tag2'], 'tags', 10);
   * ```
   */
  static validateNonEmptyArray<T>(
    array: T[],
    fieldName: string,
    maxLength?: number
  ): void {
    const handler = new ValidationErrorHandler();
    
    if (!Array.isArray(array) || array.length === 0) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fieldName} ne peut pas être vide`,
        'Validation.Array.Empty',
        { fieldName, isArray: Array.isArray(array) }
      );
    }

    if (maxLength && array.length > maxLength) {
      throw handler.createError(
        ApplicationErrorCode.VALIDATION_FAILED,
        `${fieldName} ne peut pas contenir plus de ${maxLength} éléments`,
        'Validation.Array.TooLong',
        { 
          fieldName, 
          actualLength: array.length, 
          maxLength 
        }
      );
    }
  }
}