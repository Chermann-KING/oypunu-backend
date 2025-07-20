import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength, MinLength, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { COMMUNITY_LIMITS, ARRAY_LIMITS, createValidationMessage } from '../../common/constants/validation-limits.constants';

export class CreatePostDto {
  @ApiProperty({ 
    description: 'Titre de la publication',
    minLength: COMMUNITY_LIMITS.TITLE.MIN,
    maxLength: COMMUNITY_LIMITS.TITLE.MAX,
    example: 'Découverte de nouveaux mots en langue Fang'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(COMMUNITY_LIMITS.TITLE.MIN, createValidationMessage('Le titre', COMMUNITY_LIMITS.TITLE).minLength)
  @MaxLength(COMMUNITY_LIMITS.TITLE.MAX, createValidationMessage('Le titre', COMMUNITY_LIMITS.TITLE).maxLength)
  title: string;

  @ApiProperty({ 
    description: 'Contenu de la publication',
    minLength: COMMUNITY_LIMITS.POST_CONTENT.MIN,
    maxLength: COMMUNITY_LIMITS.POST_CONTENT.MAX,
    example: 'Je viens de découvrir de magnifiques expressions en langue Fang qui expriment des concepts uniques...'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(COMMUNITY_LIMITS.POST_CONTENT.MIN, createValidationMessage('Le contenu', COMMUNITY_LIMITS.POST_CONTENT).minLength)
  @MaxLength(COMMUNITY_LIMITS.POST_CONTENT.MAX, createValidationMessage('Le contenu', COMMUNITY_LIMITS.POST_CONTENT).maxLength)
  content: string;

  @ApiPropertyOptional({ 
    description: 'Tags associés à la publication',
    maxItems: ARRAY_LIMITS.TAGS,
    example: ['fang', 'linguistique', 'culture']
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(ARRAY_LIMITS.TAGS, { message: `Maximum ${ARRAY_LIMITS.TAGS} tags autorisés` })
  @IsString({ each: true })
  @MaxLength(COMMUNITY_LIMITS.TAG.MAX, { each: true, message: `Chaque tag ne peut dépasser ${COMMUNITY_LIMITS.TAG.MAX} caractères` })
  tags?: string[];
}
