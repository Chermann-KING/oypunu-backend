import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class DefinitionDto {
  @ApiProperty({
    description: 'Définition du mot',
    example: 'État de calme, de tranquillité, de confiance sur le plan moral',
  })
  @IsString()
  @IsNotEmpty()
  definition: string;

  @ApiProperty({
    description: "Exemples d'utilisation",
    example: [
      'Elle affronte les difficultés avec sérénité',
      'Retrouver la sérénité après une période tumultueuse',
    ],
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

class MeaningDto {
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
  })
  @IsString()
  @IsNotEmpty()
  partOfSpeech: string;

  @ApiProperty({
    description: 'Définitions du mot',
    type: [DefinitionDto],
    example: [
      {
        definition:
          'État de calme, de tranquillité, de confiance sur le plan moral',
        examples: ['Elle affronte les difficultés avec sérénité'],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DefinitionDto)
  definitions: DefinitionDto[];

  @ApiProperty({
    description: 'Synonymes',
    example: ['calme', 'paix', 'quiétude', 'tranquillité'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  synonyms?: string[];

  @ApiProperty({
    description: 'Antonymes',
    example: ['agitation', 'angoisse', 'anxiété', 'inquiétude'],
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

export class CreateWordDto {
  @ApiProperty({
    description: 'Le mot à ajouter',
    example: 'sérénité',
  })
  @IsString()
  @IsNotEmpty()
  word: string;

  @ApiProperty({
    description: 'Langue du mot (ISO 639-1)',
    example: 'fr',
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
  })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiProperty({
    description: 'Prononciation phonétique',
    example: 'se.ʁe.ni.te',
    required: false,
  })
  @IsString()
  @IsOptional()
  pronunciation?: string;

  @ApiProperty({
    description: 'Origine étymologique du mot',
    example: 'Du latin serenitas, désignant un état calme et paisible',
    required: false,
  })
  @IsString()
  @IsOptional()
  etymology?: string;

  @ApiProperty({
    description: 'ID de la catégorie à laquelle le mot appartient',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'Liste des significations et définitions du mot',
    type: [MeaningDto],
    example: [
      {
        partOfSpeech: 'noun',
        definitions: [
          {
            definition:
              'État de calme, de tranquillité, de confiance sur le plan moral',
            examples: ['Elle affronte les difficultés avec sérénité'],
          },
        ],
        synonyms: ['calme', 'paix'],
        antonyms: ['agitation', 'anxiété'],
        examples: ["La sérénité d'esprit est essentielle"],
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeaningDto)
  meanings: MeaningDto[];

  @ApiProperty({
    description: 'Statut de soumission du mot',
    example: 'pending',
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending',
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: 'approved' | 'pending' | 'rejected';
}
