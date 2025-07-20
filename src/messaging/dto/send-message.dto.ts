import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MESSAGING_LIMITS, VALIDATION_MESSAGES } from '../../common/constants/validation-limits.constants';

export class SendMessageDto {
  @ApiProperty({ description: 'ID du destinataire du message' })
  @IsMongoId({ message: 'ID du destinataire invalide' })
  @IsNotEmpty({ message: 'Le destinataire est requis' })
  receiverId: string;

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

  @ApiPropertyOptional({ 
    description: 'Type de message',
    enum: ['text', 'word_share'],
    default: 'text'
  })
  @IsOptional()
  @IsEnum(['text', 'word_share'], { message: 'Type de message invalide' })
  messageType?: string = 'text';

  @ApiPropertyOptional({ description: 'Métadonnées additionnelles pour le message' })
  @IsOptional()
  metadata?: Record<string, any>;
}
