/**
 * @fileoverview DTO pour l'envoi de messages dans le système de messagerie O'Ypunu
 * 
 * Ce DTO définit et valide la structure des données requises pour
 * l'envoi d'un message avec validation stricte des champs, limites
 * de longueur configurables et support pour différents types de
 * messages et métadonnées extensibles.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
  IsMongoId,
  IsObject,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MESSAGING_LIMITS, VALIDATION_MESSAGES } from '../../common/constants/validation-limits.constants';

/**
 * DTO pour les métadonnées de message avec validation stricte
 * @class MessageMetadata
 */
export class MessageMetadata {
  /**
   * ID du mot partagé (pour messageType: 'word_share')
   */
  @IsOptional()
  @IsMongoId({ message: 'ID du mot invalide' })
  wordId?: string;

  /**
   * Langue du contenu (code ISO 639-1)
   */
  @IsOptional()
  @IsString({ message: 'La langue doit être une chaîne de caractères' })
  @MaxLength(10, { message: 'Code langue trop long' })
  language?: string;

  /**
   * Demande de traduction pour ce message
   */
  @IsOptional()
  @IsBoolean({ message: 'translationRequested doit être un booléen' })
  translationRequested?: boolean;

  /**
   * Contexte du partage de mot
   */
  @IsOptional()
  @IsString({ message: 'Le contexte doit être une chaîne de caractères' })
  @MaxLength(200, { message: 'Contexte trop long (max 200 caractères)' })
  context?: string;
}

/**
 * DTO pour l'envoi de messages O'Ypunu
 * 
 * Classe de validation des données d'envoi de message avec
 * contraintes strictes et support multitype pour différents
 * scénarios d'usage (texte simple, partage de mots, etc.).
 * 
 * ## Validation incluse :
 * - ID destinataire : Format MongoDB ObjectId valide
 * - Contenu : Longueur configurable avec limites strictes
 * - Type message : Énumération fermée pour types supportés
 * - Métadonnées : Structure ouverte pour extensions
 * 
 * @class SendMessageDto
 * @version 1.0.0
 */
export class SendMessageDto {
  /**
   * ID du destinataire du message (MongoDB ObjectId)
   * @type {string}
   * @required
   * @example "507f1f77bcf86cd799439011"
   */
  @ApiProperty({ description: 'ID du destinataire du message' })
  @IsMongoId({ message: 'ID du destinataire invalide' })
  @IsNotEmpty({ message: 'Le destinataire est requis' })
  receiverId: string;

  /**
   * Contenu textuel du message avec limites configurables
   * @type {string}
   * @required
   * @minLength Défini par MESSAGING_LIMITS.MESSAGE_CONTENT.MIN
   * @maxLength Défini par MESSAGING_LIMITS.MESSAGE_CONTENT.MAX
   * @example "Bonjour! Comment dit-on 'merci' en Yipunu?"
   */
  @ApiProperty({ 
    description: 'Contenu du message',
    minLength: MESSAGING_LIMITS.MESSAGE_CONTENT.MIN,
    maxLength: MESSAGING_LIMITS.MESSAGE_CONTENT.MAX
  })
  @IsString({ message: 'Le contenu doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le contenu du message ne peut pas être vide' })
  @MinLength(MESSAGING_LIMITS.MESSAGE_CONTENT.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT('Le contenu du message', MESSAGING_LIMITS.MESSAGE_CONTENT.MIN)
  })
  @MaxLength(MESSAGING_LIMITS.MESSAGE_CONTENT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG('Le contenu du message', MESSAGING_LIMITS.MESSAGE_CONTENT.MAX)
  })
  content: string;

  /**
   * Type de message pour différencier le contenu
   * @type {string}
   * @optional
   * @enum ['text', 'word_share']
   * @default 'text'
   * @example "word_share" pour partager un mot du dictionnaire
   */
  @ApiPropertyOptional({ 
    description: 'Type de message',
    enum: ['text', 'word_share'],
    default: 'text'
  })
  @IsOptional()
  @IsEnum(['text', 'word_share'], { message: 'Type de message invalide' })
  messageType?: string = 'text';

  /**
   * Métadonnées validées pour enrichir le message
   * @type {MessageMetadata}
   * @optional
   * @example 
   * ```json
   * {
   *   "wordId": "507f1f77bcf86cd799439011",
   *   "language": "yipunu", 
   *   "translationRequested": true,
   *   "context": "Demande d'aide pour comprendre ce mot"
   * }
   * ```
   */
  @ApiPropertyOptional({ 
    description: 'Métadonnées validées pour le message',
    type: MessageMetadata
  })
  @IsOptional()
  @IsObject({ message: 'Les métadonnées doivent être un objet valide' })
  @ValidateNested({ message: 'Structure des métadonnées invalide' })
  @Type(() => MessageMetadata)
  metadata?: MessageMetadata;
}
