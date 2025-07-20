import { IsString, IsNotEmpty, IsOptional, IsMongoId, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COMMUNITY_LIMITS, VALIDATION_MESSAGES } from '../../common/constants/validation-limits.constants';

export class CreateCommentDto {
  @ApiProperty({ 
    description: 'Contenu du commentaire',
    minLength: COMMUNITY_LIMITS.COMMENT_CONTENT.MIN,
    maxLength: COMMUNITY_LIMITS.COMMENT_CONTENT.MAX
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(COMMUNITY_LIMITS.COMMENT_CONTENT.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT('Le contenu du commentaire', COMMUNITY_LIMITS.COMMENT_CONTENT.MIN)
  })
  @MaxLength(COMMUNITY_LIMITS.COMMENT_CONTENT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG('Le contenu du commentaire', COMMUNITY_LIMITS.COMMENT_CONTENT.MAX)
  })
  content: string;

  @ApiPropertyOptional({
    description: 'ID du commentaire parent (pour les réponses)',
  })
  @IsMongoId()
  @IsOptional()
  parentCommentId?: string;
}
