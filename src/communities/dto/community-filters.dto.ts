import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CommunityFiltersDto {
  @ApiPropertyOptional({ description: 'Terme de recherche' })
  @IsString()
  @IsOptional()
  searchTerm?: string;

  @ApiPropertyOptional({ description: 'Filtrer par langue' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ description: 'Filtrer par tag' })
  @IsString()
  @IsOptional()
  tag?: string;

  @ApiPropertyOptional({ description: 'Inclure les communautés privées' })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includePrivate?: boolean;

  @ApiPropertyOptional({
    description: 'Trier par',
    enum: ['name', 'memberCount', 'createdAt'],
  })
  @IsEnum(['name', 'memberCount', 'createdAt'])
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Ordre de tri', enum: ['asc', 'desc'] })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: string = 'desc';

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
