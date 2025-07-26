import { BadRequestException, Logger } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Utilitaire centralisé pour les validations communes
 * PHASE 2-4: Extension de DatabaseErrorHandler pour les patterns de validation répétés
 */
export class ValidationErrorHandler {
  private static readonly logger = new Logger('ValidationErrorHandler');

  /**
   * Validation d'ObjectId MongoDB avec message d'erreur unifié
   */
  static validateObjectId(id: string, entityName: string): void {
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`❌ ID ${entityName} invalide fourni: ${id}`);
      throw new BadRequestException(`ID ${entityName} invalide`);
    }
  }

  /**
   * Validation de multiples ObjectIds
   */
  static validateObjectIds(ids: string[], entityName: string): void {
    const invalidIds = ids.filter(id => !Types.ObjectId.isValid(id));
    
    if (invalidIds.length > 0) {
      this.logger.warn(`❌ IDs ${entityName} invalides fournis:`, invalidIds);
      throw new BadRequestException(
        `IDs ${entityName} invalides: ${invalidIds.join(', ')}`
      );
    }
  }

  /**
   * Validation de fichier avec contraintes
   */
  static validateFile(
    file: Buffer | null | undefined,
    constraints: {
      maxSize?: number;
      allowedMimeTypes?: string[];
      minSize?: number;
    },
    fileType: string = 'fichier'
  ): void {
    if (!file || file.length === 0) {
      throw new BadRequestException(`${fileType} requis`);
    }

    if (constraints.minSize && file.length < constraints.minSize) {
      throw new BadRequestException(
        `${fileType} trop petit (minimum: ${constraints.minSize} bytes)`
      );
    }

    if (constraints.maxSize && file.length > constraints.maxSize) {
      throw new BadRequestException(
        `${fileType} trop volumineux (maximum: ${this.formatBytes(constraints.maxSize)})`
      );
    }
  }

  /**
   * Validation d'email format
   */
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || !emailRegex.test(email)) {
      this.logger.warn(`❌ Format email invalide: ${email}`);
      throw new BadRequestException('Format email invalide');
    }
  }

  /**
   * Validation de password strength (cohérent avec password-strength.service.ts)
   */
  static validatePassword(password: string): void {
    if (!password) {
      throw new BadRequestException('Mot de passe requis');
    }

    if (password.length < 12) {
      throw new BadRequestException('Mot de passe trop court (minimum 12 caractères)');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`])/.test(password)) {
      throw new BadRequestException(
        'Mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial'
      );
    }
  }

  /**
   * Validation de pagination parameters
   */
  static validatePagination(page: number, limit: number): { page: number; limit: number } {
    const validatedPage = Math.max(1, Math.floor(page) || 1);
    const validatedLimit = Math.min(100, Math.max(1, Math.floor(limit) || 10));

    if (page !== validatedPage || limit !== validatedLimit) {
      this.logger.warn(`⚠️ Paramètres de pagination ajustés: page=${validatedPage}, limit=${validatedLimit}`);
    }

    return { page: validatedPage, limit: validatedLimit };
  }

  /**
   * Validation d'un enum value
   */
  static validateEnum<T extends Record<string, string | number>>(
    value: string,
    enumObject: T,
    fieldName: string
  ): void {
    const validValues = Object.values(enumObject);
    
    if (!validValues.includes(value as any)) {
      throw new BadRequestException(
        `${fieldName} invalide. Valeurs acceptées: ${validValues.join(', ')}`
      );
    }
  }

  /**
   * Format bytes pour messages d'erreur
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validation d'une URL
   */
  static validateUrl(url: string, fieldName: string = 'URL'): void {
    try {
      new URL(url);
    } catch {
      throw new BadRequestException(`${fieldName} invalide`);
    }
  }

  /**
   * Validation de string non vide avec trim
   */
  static validateNonEmptyString(value: string, fieldName: string, minLength: number = 1): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} doit être une chaîne de caractères`);
    }

    const trimmed = value.trim();
    
    if (trimmed.length < minLength) {
      throw new BadRequestException(
        `${fieldName} doit contenir au moins ${minLength} caractère(s)`
      );
    }

    return trimmed;
  }

  /**
   * Validation d'array non vide
   */
  static validateNonEmptyArray<T>(
    array: T[],
    fieldName: string,
    maxLength?: number
  ): void {
    if (!Array.isArray(array) || array.length === 0) {
      throw new BadRequestException(`${fieldName} ne peut pas être vide`);
    }

    if (maxLength && array.length > maxLength) {
      throw new BadRequestException(
        `${fieldName} ne peut pas contenir plus de ${maxLength} éléments`
      );
    }
  }
}