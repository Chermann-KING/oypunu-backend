import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsMongoId,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTranslationDto {
  @ApiProperty({
    description: 'ID du mot source',
    example: '64f5a123456789abcdef0123',
  })
  @IsMongoId()
  sourceWordId: string;

  @ApiProperty({
    description: 'Langue cible pour la traduction',
    example: 'es',
  })
  @IsString()
  targetLanguage: string;

  @ApiProperty({
    description: 'Mot traduit',
    example: 'solar',
  })
  @IsString()
  translatedWord: string;

  @ApiPropertyOptional({
    description: 'ID du mot cible existant (si disponible)',
    example: '64f5a123456789abcdef0124',
  })
  @IsOptional()
  @IsMongoId()
  targetWordId?: string;

  @ApiPropertyOptional({
    description: "Contexte d'usage de la traduction",
    example: ['astronomie', 'physique'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  context?: string[];

  @ApiPropertyOptional({
    description: 'Score de confiance (0-1)',
    example: 0.95,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @ApiPropertyOptional({
    description: 'ID du sens spécifique',
    example: 'CONCEPT_123_SENSE_1',
  })
  @IsOptional()
  @IsString()
  senseId?: string;

  @ApiPropertyOptional({
    description: 'Type de validation',
    enum: ['auto', 'manual', 'learned'],
    example: 'manual',
  })
  @IsOptional()
  @IsEnum(['auto', 'manual', 'learned'])
  validationType?: string;
}

export class ValidateTranslationDto {
  @ApiProperty({
    description: 'Action de validation',
    enum: ['merge', 'separate', 'uncertain'],
    example: 'merge',
  })
  @IsEnum(['merge', 'separate', 'uncertain'])
  action: string;

  @ApiPropertyOptional({
    description: 'Raison de la décision',
    example: "Mêmes domaines d'usage, contexte similaire",
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Score de confiance ajusté (0-1)',
    example: 0.85,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  adjustedConfidence?: number;
}

export class VoteTranslationDto {
  @ApiProperty({
    description: 'Type de vote (+1 ou -1)',
    example: 1,
  })
  @IsNumber()
  voteValue: number; // +1 ou -1

  @ApiPropertyOptional({
    description: 'Commentaire sur le vote',
    example: 'Traduction parfaite dans ce contexte',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class SearchTranslationDto {
  @ApiProperty({
    description: 'ID du mot source',
    example: '64f5a123456789abcdef0123',
  })
  @IsMongoId()
  wordId: string;

  @ApiProperty({
    description: 'Langue cible',
    example: 'es',
  })
  @IsString()
  targetLanguage: string;

  @ApiPropertyOptional({
    description: 'Recherche de mots suggérés',
    example: 'solar',
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({
    description: 'Score de similarité minimum',
    example: 0.6,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;
}
