import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SearchWordsDto {
  @ApiProperty({
    description: 'Terme de recherche',
    example: 'serenité',
  })
  @IsString()
  query: string;

  @ApiProperty({
    description:
      'Filtrer par langues (string séparée par des virgules ou tableau)',
    example: 'fr,en',
    required: false,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((lang) => lang.trim())
        .filter((lang) => lang.length > 0);
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiProperty({
    description:
      'Filtrer par catégories (string séparée par des virgules ou tableau)',
    example: '60a1b2c3d4e5f6a7b8c9d0e1,60a1b2c3d4e5f6a7b8c9d0e2',
    required: false,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((cat) => cat.trim())
        .filter((cat) => cat.length > 0);
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiProperty({
    description:
      'Filtrer par parties du discours (string séparée par des virgules ou tableau)',
    example: 'noun,verb,adjective',
    required: false,
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((pos) => pos.trim())
        .filter((pos) => pos.length > 0);
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray()
  @IsString({ each: true })
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
