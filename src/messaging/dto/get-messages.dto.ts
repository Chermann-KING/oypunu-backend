/**
 * @fileoverview DTO pour la récupération paginée des messages O'Ypunu
 * 
 * Ce DTO définit et valide les paramètres de pagination et filtrage
 * pour la récupération des messages d'une conversation avec
 * contrôles de limites, transformation automatique des types
 * et validation stricte des paramètres de requête.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour la récupération paginée de messages O'Ypunu
 * 
 * Classe de validation des paramètres de récupération de messages
 * avec support complet de la pagination, transformation automatique
 * des types de données et limites configurables pour optimiser
 * les performances et l'expérience utilisateur.
 * 
 * ## Fonctionnalités incluses :
 * - Pagination avancée avec limites configurables
 * - Transformation automatique string->number pour query params
 * - Validation stricte des plages de valeurs acceptées
 * - Support filtrage par conversation spécifique
 * - Messages d'erreur contextualisés en français
 * 
 * @class GetMessagesDto
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * // Utilisation dans un contrôleur
 * @Get('messages')
 * async getMessages(@Query() dto: GetMessagesDto) {
 *   return this.messagingService.getMessages(userId, dto);
 * }
 * 
 * // Exemple de requête HTTP
 * GET /messaging/messages?conversationId=123&page=2&limit=10
 * ```
 */
export class GetMessagesDto {
  /**
   * Numéro de page pour la pagination (commence à 1)
   * @type {number}
   * @optional
   * @min 1
   * @default 1
   * @example 2 pour récupérer la 2ème page de résultats
   */
  @ApiPropertyOptional({ 
    description: 'Numéro de page (commence à 1)',
    minimum: 1,
    default: 1,
    example: 1
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'La page doit être un nombre' })
  @Min(1, { message: 'La page doit être supérieure à 0' })
  page?: number = 1;

  /**
   * Nombre maximum de messages à récupérer par page
   * @type {number}
   * @optional
   * @min 1
   * @max 50
   * @default 20
   * @example 10 pour récupérer 10 messages par page
   */
  @ApiPropertyOptional({ 
    description: 'Nombre de messages par page',
    minimum: 1,
    maximum: 50,
    default: 20,
    example: 20
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'La limite doit être un nombre' })
  @Min(1, { message: 'La limite doit être supérieure à 0' })
  @Max(50, { message: 'La limite ne peut pas dépasser 50' })
  limit?: number = 20;

  /**
   * ID de la conversation pour filtrer les messages
   * @type {string}
   * @optional
   * @example "507f1f77bcf86cd799439011"
   */
  @ApiPropertyOptional({ 
    description: 'ID de la conversation à récupérer',
    example: "507f1f77bcf86cd799439011"
  })
  @IsOptional()
  @IsString({ message: "L'ID de conversation doit être une chaîne" })
  conversationId?: string;
}
