import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { AudioFileDto } from './create-word.dto';

export class UpdateDefinitionDto {
  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: string[];

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

export class UpdatePhoneticDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  audio?: {
    url?: string;
    cloudinaryId?: string;
    format?: string;
    duration?: number;
  };

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

export class UpdateMeaningDto {
  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDefinitionDto)
  definitions?: UpdateDefinitionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antonyms?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePhoneticDto)
  phonetics?: UpdatePhoneticDto[];
}

export class UpdateTranslationDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  translatedWord?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  context?: string[];

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  verifiedBy?: string[];
}

export class UpdateWordDto {
  @ApiProperty({ description: 'Prononciation du mot', required: false })
  @IsOptional()
  @IsString()
  pronunciation?: string;

  @ApiProperty({ description: 'Étymologie du mot', required: false })
  @IsOptional()
  @IsString()
  etymology?: string;

  @ApiProperty({ description: 'Significations du mot', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMeaningDto)
  meanings?: UpdateMeaningDto[];

  @ApiProperty({ description: 'Traductions du mot', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateTranslationDto)
  translations?: UpdateTranslationDto[];

  @ApiProperty({ description: 'Variantes linguistiques', required: false })
  @IsOptional()
  languageVariants?: Map<string, string>;

  @ApiProperty({ description: 'Fichiers audio', required: false })
  @IsOptional()
  audioFiles?: Map<
    string,
    {
      url: string;
      cloudinaryId: string;
      language: string;
      accent: string;
    }
  >;

  @ApiProperty({
    description: 'Statut du mot (admin uniquement)',
    required: false,
  })
  @IsOptional()
  @IsEnum([
    'approved',
    'pending',
    'rejected',
    'pending_revision',
    'revision_approved',
  ])
  status?:
    | 'approved'
    | 'pending'
    | 'rejected'
    | 'pending_revision'
    | 'revision_approved';

  @ApiProperty({ description: 'Notes de révision', required: false })
  @IsOptional()
  @IsString()
  revisionNotes?: string;

  @ApiProperty({
    description: "Forcer la création d'une révision",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRevision?: boolean;
}

// DTO spécifique pour la mise à jour des fichiers audio
export class UpdateAudioFilesDto {
  @ApiProperty({
    description: 'Nouveau fichiers audio à ajouter ou mettre à jour',
    type: [AudioFileDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AudioFileDto)
  audioFiles: AudioFileDto[];

  @ApiProperty({
    description: 'Accents à supprimer',
    example: ['fr-ca', 'en-us'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removeAccents?: string[];
}
