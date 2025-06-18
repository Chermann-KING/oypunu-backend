import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchWordsDto {
  @ApiProperty({
    description: 'Terme de recherche',
    example: 'serenité',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Filtrer par langues',
    example: ['fr', 'en'],
    required: false,
    isArray: true,
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @ApiProperty({
    description: 'Filtrer par catégories (IDs)',
    example: ['60a1b2c3d4e5f6a7b8c9d0e1', '60a1b2c3d4e5f6a7b8c9d0e2'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @ApiProperty({
    description: 'Filtrer par parties du discours',
    example: ['noun', 'verb', 'adjective'],
    required: false,
    isArray: true,
    enum: [
      'noun',
      'verb',
      'adjective',
      'adverb',
      'pronoun',
      'preposition',
      'conjunction',
      'interjection',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  partsOfSpeech?: string[];

  @ApiProperty({
    description: 'Numéro de page',
    example: 1,
    default: 1,
    required: false,
    minimum: 1,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Nombre de résultats par page',
    example: 10,
    default: 10,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
