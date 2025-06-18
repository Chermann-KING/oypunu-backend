import { PartialType } from '@nestjs/swagger';
import { CreateWordDto } from './create-word.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class UpdateDefinitionDto {
  @ApiProperty({
    description: 'Définition du mot',
    example: 'État de calme, de tranquillité, de confiance sur le plan moral',
    required: true,
  })
  @IsString()
  definition: string;

  @ApiProperty({
    description: "Exemples d'utilisation",
    example: ['Elle affronte les difficultés avec sérénité'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  examples?: string[];

  @ApiProperty({
    description: 'URL de la source de la définition',
    example: 'https://www.larousse.fr/dictionnaires/francais/sérénité/72193',
    required: false,
  })
  @IsString()
  @IsOptional()
  sourceUrl?: string;
}

class UpdateMeaningDto {
  @ApiProperty({
    description: 'Partie du discours',
    example: 'noun',
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
    required: true,
  })
  @IsString()
  partOfSpeech: string;

  @ApiProperty({
    description: 'Définitions du mot',
    type: [UpdateDefinitionDto],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDefinitionDto)
  definitions: UpdateDefinitionDto[];

  @ApiProperty({
    description: 'Synonymes',
    example: ['calme', 'paix', 'quiétude'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  synonyms?: string[];

  @ApiProperty({
    description: 'Antonymes',
    example: ['agitation', 'anxiété', 'inquiétude'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  antonyms?: string[];

  @ApiProperty({
    description: "Exemples d'utilisation additionnels",
    example: ["La sérénité d'esprit est essentielle pour le bien-être"],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  examples?: string[];
}

export class UpdateWordDto extends PartialType(CreateWordDto) {
  @ApiProperty({
    description: 'Le mot à mettre à jour',
    example: 'sérénité',
    required: false,
  })
  @IsString()
  @IsOptional()
  word?: string;

  @ApiProperty({
    description: 'Langue du mot (ISO 639-1)',
    example: 'fr',
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
    required: false,
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({
    description: 'Prononciation du mot',
    example: 'se.ʁe.ni.te',
    required: false,
  })
  @IsString()
  @IsOptional()
  pronunciation?: string;

  @ApiProperty({
    description: 'Etymologie (origine du mot)',
    example: 'Du latin serenitas, désignant un état calme et paisible',
    required: false,
  })
  @IsString()
  @IsOptional()
  etymology?: string;

  @ApiProperty({
    description: 'ID de la catégorie',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'Liste des significations',
    type: [UpdateMeaningDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMeaningDto)
  @IsOptional()
  meanings?: UpdateMeaningDto[];

  @ApiProperty({
    description: 'Statut de soumission du mot',
    example: 'pending',
    enum: ['approved', 'pending', 'rejected'],
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: 'approved' | 'pending' | 'rejected';
}
