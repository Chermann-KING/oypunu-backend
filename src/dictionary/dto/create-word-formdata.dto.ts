import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
// import { Transform } from 'class-transformer';
// import { MeaningDto } from './create-word.dto';

export class CreateWordFormDataDto {
  @ApiProperty({ description: 'Le mot à ajouter' })
  @IsString()
  @IsNotEmpty()
  word: string;

  @ApiProperty({
    description: 'ID de la langue du mot (référence à Language)',
    required: false,
  })
  @ValidateIf((o) => !o.language)
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  languageId?: string;

  @ApiProperty({
    description: 'Langue du mot (ISO 639-1) - Deprecated, utiliser languageId',
    required: false,
  })
  @ValidateIf((o) => !o.languageId)
  @IsString()
  @IsNotEmpty()
  language?: string;

  @ApiProperty({ description: 'Prononciation phonétique', required: false })
  @IsOptional()
  @IsString()
  pronunciation?: string;

  @ApiProperty({ description: 'Origine étymologique', required: false })
  @IsOptional()
  @IsString()
  etymology?: string;

  @ApiProperty({ description: 'ID de la catégorie', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: 'Significations du mot (JSON string)' })
  @IsString()
  @IsNotEmpty()
  // @Transform(({ value }) => {
  //   // Auto-parse JSON si c'est une string
  //   if (typeof value === 'string') {
  //     try {
  //       return JSON.parse(value) as MeaningDto[];
  //     } catch {
  //       return value; // Retourne la valeur originale si parsing échoue
  //     }
  //   }
  //   return value as MeaningDto[];
  // })
  // meanings: string | MeaningDto[];
  meanings: string;

  @ApiProperty({ 
    description: 'Traductions du mot (JSON string)', 
    required: false 
  })
  @IsOptional()
  @IsString()
  translations?: string;

  @ApiProperty({ description: 'Fichier audio', required: false })
  @IsOptional()
  audioFile?: Express.Multer.File;
}

// DTO spécialisé pour la modification avec audio (tous les champs optionnels)
export class UpdateWordFormDataDto {
  @ApiProperty({ description: 'Prononciation phonétique', required: false })
  @IsOptional()
  @IsString()
  pronunciation?: string;

  @ApiProperty({ description: 'Origine étymologique', required: false })
  @IsOptional()
  @IsString()
  etymology?: string;

  @ApiProperty({ description: 'ID de la catégorie', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: 'Significations du mot (JSON string)',
    required: false,
  })
  @IsOptional()
  @IsString()
  meanings?: string;

  @ApiProperty({
    description: 'Traductions du mot (JSON string)',
    required: false,
  })
  @IsOptional()
  @IsString()
  translations?: string;

  @ApiProperty({ description: 'Notes de révision', required: false })
  @IsOptional()
  @IsString()
  revisionNotes?: string;

  @ApiProperty({
    description: "Forcer la création d'une révision",
    required: false,
  })
  @IsOptional()
  @IsString()
  forceRevision?: string; // String car vient de FormData

  @ApiProperty({ description: 'Fichier audio', required: false })
  @IsOptional()
  audioFile?: Express.Multer.File;
}
