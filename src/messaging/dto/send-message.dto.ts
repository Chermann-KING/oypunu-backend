import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsMongoId,
} from 'class-validator';

export class SendMessageDto {
  @IsMongoId({ message: 'ID du destinataire invalide' })
  @IsNotEmpty({ message: 'Le destinataire est requis' })
  receiverId: string;

  @IsString({ message: 'Le contenu doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le contenu du message ne peut pas être vide' })
  @MaxLength(1000, {
    message: 'Le message ne peut pas dépasser 1000 caractères',
  })
  content: string;

  @IsOptional()
  @IsEnum(['text', 'word_share'], { message: 'Type de message invalide' })
  messageType?: string = 'text';

  @IsOptional()
  metadata?: Record<string, any>;
}
