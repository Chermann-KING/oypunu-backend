import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiProperty({
    description: 'Nom de la catégorie',
    example: 'Expressions courantes',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Description détaillée de la catégorie',
    example:
      'Expressions et mots utilisés fréquemment dans la langue quotidienne',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Code de la langue (ISO 639-1)',
    example: 'fr',
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
    required: false,
  })
  language?: string;
}
