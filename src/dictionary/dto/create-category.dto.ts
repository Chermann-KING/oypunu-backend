import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Nom de la catégorie',
    example: 'Expressions courantes',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description détaillée de la catégorie',
    example:
      'Expressions et mots utilisés fréquemment dans la langue quotidienne',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Code de la langue (ISO 639-1)',
    example: 'fr',
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
  })
  @IsString()
  @IsNotEmpty()
  language: string;
}
