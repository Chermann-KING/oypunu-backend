/**
 * @fileoverview DTOs pour la création de mots dans le dictionnaire O'Ypunu
 * 
 * Ce fichier définit les Data Transfer Objects pour la création de mots
 * avec validation complète des données, limites configurables et
 * messages d'erreur contextualisés en français. Il inclut les DTOs
 * pour définitions, phonétiques, significations et traductions.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsUrl,
  IsNumber,
  Min,
  Max,
  Matches,
  IsMongoId,
  ValidateIf,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { DICTIONARY_LIMITS, VALIDATION_LIMITS, ARRAY_LIMITS, createValidationMessage } from '../../common/constants/validation-limits.constants';

/**
 * DTO pour les définitions de mots
 * 
 * Classe de validation pour une définition individuelle avec
 * exemples d'usage et référence source optionnelle.
 * 
 * @class DefinitionDto
 * @version 1.0.0
 */
class DefinitionDto {
  /**
   * Texte de la définition avec validation de longueur
   * @type {string}
   * @required
   * @example "État de calme, de tranquillité, de confiance sur le plan moral"
   */
  @ApiProperty({
    description: 'Définition du mot',
    example: 'État de calme, de tranquillité, de confiance sur le plan moral',
    minLength: DICTIONARY_LIMITS.DEFINITION.MIN,
    maxLength: DICTIONARY_LIMITS.DEFINITION.MAX,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(DICTIONARY_LIMITS.DEFINITION.MIN, createValidationMessage('La définition', DICTIONARY_LIMITS.DEFINITION).minLength)
  @MaxLength(DICTIONARY_LIMITS.DEFINITION.MAX, createValidationMessage('La définition', DICTIONARY_LIMITS.DEFINITION).maxLength)
  definition: string;

  @ApiProperty({
    description: "Exemples d'utilisation",
    example: [
      'Elle affronte les difficultés avec sérénité',
      'Retrouver la sérénité après une période tumultueuse',
    ],
    required: false,
    isArray: true,
    maxItems: ARRAY_LIMITS.EXAMPLES,
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(ARRAY_LIMITS.EXAMPLES, { message: `Maximum ${ARRAY_LIMITS.EXAMPLES} exemples autorisés` })
  @IsString({ each: true })
  @MaxLength(DICTIONARY_LIMITS.EXAMPLE.MAX, { each: true, message: `Chaque exemple ne peut dépasser ${DICTIONARY_LIMITS.EXAMPLE.MAX} caractères` })
  examples?: string[];

  @ApiProperty({
    description: 'URL de la source de la définition',
    example: 'https://www.larousse.fr/dictionnaires/francais/sérénité/72193',
    required: false,
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'URL invalide' })
  @MaxLength(VALIDATION_LIMITS.URL.MAX, createValidationMessage('L\'URL source', VALIDATION_LIMITS.URL).maxLength)
  sourceUrl?: string;
}

class PhoneticDto {
  @ApiProperty({
    description: 'Transcription phonétique',
    example: '/se.ʁe.ni.te/',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    description: 'URL du fichier audio pour cette phonétique',
    example:
      'https://res.cloudinary.com/demo/video/upload/phonetics/fr/serenite.mp3',
    required: false,
  })
  @IsString()
  @IsUrl()
  @IsOptional()
  audioUrl?: string;

  @ApiProperty({
    description: 'URL de la source de la phonétique',
    required: false,
  })
  @IsString()
  @IsUrl()
  @IsOptional()
  sourceUrl?: string;
}

export class MeaningDto {
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

  @ApiProperty({
    description: 'Phonétiques pour ce sens',
    type: [PhoneticDto],
    required: false,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneticDto)
  @IsOptional()
  phonetics?: PhoneticDto[];
}

class WordTranslationDto {
  @ApiProperty({
    description: 'ID de la langue de la traduction (référence à Language)',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsMongoId()
  languageId?: string;

  // DURANT LA MIGRATION: Ancien champ pour compatibilité (à supprimer après migration)
  @ApiProperty({
    description: 'Code de langue de la traduction (ISO 639-1) - Deprecated',
    example: 'en',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z]{2}$/, {
    message: 'Le code de langue doit être au format ISO 639-1 (ex: en, fr, es)',
  })
  language?: string;

  @ApiProperty({
    description: 'Mot traduit',
    example: 'serenity',
  })
  @IsString()
  @IsNotEmpty()
  translatedWord: string;

  @ApiProperty({
    description: "Contextes d'utilisation de la traduction",
    example: ['formal', 'literary'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  context?: string[];

  @ApiProperty({
    description: 'Niveau de confiance dans la traduction (0-100)',
    example: 95,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  confidence?: number;

  @ApiProperty({
    description: 'Utilisateurs ayant vérifié cette traduction',
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  verifiedBy?: string[];
}

export class AudioFileDto {
  @ApiProperty({
    description: 'Accent ou dialecte pour ce fichier audio',
    example: 'fr-fr',
    pattern: '^[a-z]{2}(-[a-z]{2})?$',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z]{2}(-[a-z]{2})?$/, {
    message: "L'accent doit être au format langue-région (ex: fr-fr, en-us)",
  })
  accent: string;

  @ApiProperty({
    description: 'URL du fichier audio',
    example:
      'https://res.cloudinary.com/demo/video/upload/phonetics/fr/fr-fr/serenite.mp3',
  })
  @IsString()
  @IsUrl()
  audioUrl: string;

  @ApiProperty({
    description: 'ID Cloudinary du fichier',
    example: 'phonetics/fr/fr-fr/serenite_fr-fr',
    required: false,
  })
  @IsString()
  @IsOptional()
  cloudinaryId?: string;

  @ApiProperty({
    description: 'Durée du fichier audio en secondes',
    example: 2.5,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(30) // Maximum 30 secondes pour une prononciation
  @IsOptional()
  duration?: number;
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
    description: 'ID de la langue du mot (référence à Language)',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
    required: false,
  })
  @ValidateIf((o) => !o.language)
  @IsString()
  @IsMongoId()
  languageId?: string;

  // DURANT LA MIGRATION: Ancien champ pour compatibilité (à supprimer après migration)
  @ApiProperty({
    description: 'Langue du mot (ISO 639-1) - Deprecated',
    example: 'fr',
    required: false,
  })
  @ValidateIf((o) => !o.languageId)
  @IsString()
  @Matches(/^[a-z]{2}$/, {
    message: 'Le code de langue doit être au format ISO 639-1 (ex: fr, en, es)',
  })
  language?: string;

  @ApiProperty({
    description: 'Prononciation phonétique principale',
    example: '/se.ʁe.ni.te/',
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
    description: "Traductions du mot dans d'autres langues",
    type: [WordTranslationDto],
    required: false,
    example: [
      {
        language: 'en',
        translatedWord: 'serenity',
        context: ['formal', 'literary'],
        confidence: 95,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordTranslationDto)
  @IsOptional()
  translations?: WordTranslationDto[];

  @ApiProperty({
    description: 'Fichiers audio de prononciation par accent',
    type: [AudioFileDto],
    required: false,
    example: [
      {
        accent: 'fr-fr',
        audioUrl:
          'https://res.cloudinary.com/demo/video/upload/phonetics/fr/fr-fr/serenite.mp3',
        cloudinaryId: 'phonetics/fr/fr-fr/serenite_fr-fr',
        duration: 2.5,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AudioFileDto)
  @IsOptional()
  audioFiles?: AudioFileDto[];

  @ApiProperty({
    description: 'Variantes linguistiques du mot',
    example: {
      'fr-ca': 'sérénité',
      'fr-be': 'sérénité',
    },
    required: false,
  })
  @IsOptional()
  languageVariants?: Record<string, string>;

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

  @ApiProperty({
    description: 'Notes pour les modérateurs',
    example: 'Mot soumis avec prononciation native française',
    required: false,
  })
  @IsString()
  @IsOptional()
  moderatorNotes?: string;

  @ApiProperty({
    description: 'Sources utilisées pour ce mot',
    example: [
      'https://www.larousse.fr/dictionnaires/francais/sérénité/72193',
      'https://www.cnrtl.fr/definition/sérénité',
    ],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  @IsOptional()
  sources?: string[];
}

// DTO pour la validation des uploads audio en masse
export class BulkAudioUploadDto {
  @ApiProperty({
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @IsString()
  @IsNotEmpty()
  wordId: string;

  @ApiProperty({
    description: 'Fichiers audio avec leurs accents',
    type: [AudioFileDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AudioFileDto)
  audioFiles: AudioFileDto[];

  @ApiProperty({
    description: 'Remplacer les fichiers existants si ils existent',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  replaceExisting?: boolean;
}
