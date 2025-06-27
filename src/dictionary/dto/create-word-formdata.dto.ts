import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
// import { Transform } from 'class-transformer';
// import { MeaningDto } from './create-word.dto';

export class CreateWordFormDataDto {
  @ApiProperty({ description: 'Le mot à ajouter' })
  @IsString()
  @IsNotEmpty()
  word: string;

  @ApiProperty({ description: 'Langue du mot (ISO 639-1)' })
  @IsString()
  @IsNotEmpty()
  language: string;

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

  @ApiProperty({ description: 'Fichier audio', required: false })
  @IsOptional()
  audioFile?: Express.Multer.File;
}
