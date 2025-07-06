import { IsOptional, IsNumber, IsString, IsEnum, IsArray, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetRecommendationsDto {
  @ApiProperty({ 
    description: 'Nombre de recommandations à retourner',
    minimum: 1,
    maximum: 20,
    default: 5,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number = 5;

  @ApiProperty({ 
    description: 'Type de recommandations',
    enum: ['personal', 'trending', 'linguistic', 'semantic', 'mixed'],
    default: 'mixed',
    required: false
  })
  @IsOptional()
  @IsEnum(['personal', 'trending', 'linguistic', 'semantic', 'mixed'])
  type?: string = 'mixed';

  @ApiProperty({ 
    description: 'Langues spécifiques pour les recommandations',
    type: [String],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiProperty({ 
    description: 'Catégories spécifiques pour les recommandations',
    type: [String],
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiProperty({ 
    description: 'Forcer la régénération du cache',
    default: false,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  refresh?: boolean = false;
}

export class RecommendationFeedbackDto {
  @ApiProperty({ 
    description: 'ID du mot recommandé',
    example: '60a1b2c3d4e5f6a7b8c9d0e1'
  })
  @IsString()
  wordId: string;

  @ApiProperty({ 
    description: 'Type de feedback',
    enum: ['like', 'dislike', 'not_interested', 'view', 'favorite']
  })
  @IsEnum(['like', 'dislike', 'not_interested', 'view', 'favorite'])
  feedbackType: string;

  @ApiProperty({ 
    description: 'Raison du feedback (optionnel)',
    required: false
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TrendingRecommendationsDto {
  @ApiProperty({ 
    description: 'Région pour les tendances (africa, europe, etc.)',
    required: false
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ 
    description: 'Nombre de recommandations',
    minimum: 1,
    maximum: 10,
    default: 5,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number = 5;

  @ApiProperty({ 
    description: 'Période pour les tendances (24h, 7d, 30d)',
    enum: ['24h', '7d', '30d'],
    default: '7d',
    required: false
  })
  @IsOptional()
  @IsEnum(['24h', '7d', '30d'])
  period?: string = '7d';
}

export class LinguisticRecommendationsDto {
  @ApiProperty({ 
    description: 'Code de langue',
    example: 'fr'
  })
  @IsString()
  language: string;

  @ApiProperty({ 
    description: 'Niveau de difficulté (1-5)',
    minimum: 1,
    maximum: 5,
    default: 3,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(5)
  level?: number = 3;

  @ApiProperty({ 
    description: 'Nombre de recommandations',
    minimum: 1,
    maximum: 15,
    default: 5,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(15)
  limit?: number = 5;
}