import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProposeCategoryDto {
  @ApiProperty({
    description: 'Nom de la catégorie proposée',
    example: 'Expressions courantes',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description détaillée de la catégorie',
    example: 'Expressions et mots utilisés fréquemment dans la langue quotidienne',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'ID de la langue (nouveau système)',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
    required: false,
  })
  @IsString()
  @IsOptional()
  languageId?: string;

  @ApiProperty({
    description: 'Code de la langue (compatibilité)',
    example: 'fr',
    required: false,
  })
  @IsString()
  @IsOptional()
  language?: string;
}

export class ModerateCategoryDto {
  @ApiProperty({
    description: 'Action de modération',
    enum: ['approve', 'reject'],
    example: 'approve',
  })
  @IsString()
  @IsNotEmpty()
  action: 'approve' | 'reject';

  @ApiProperty({
    description: 'Notes de modération',
    example: 'Catégorie approuvée, très utile pour les débutants',
    required: false,
  })
  @IsString()
  @IsOptional()
  moderationNotes?: string;
}