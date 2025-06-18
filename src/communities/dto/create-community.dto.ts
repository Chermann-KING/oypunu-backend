import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommunityDto {
  @ApiProperty({ description: 'Nom de la communauté' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Code de langue (ex: fr, en)' })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiPropertyOptional({ description: 'Description de la communauté' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Tags associés à la communauté' })
  @IsArray()
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Si la communauté est privée' })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiPropertyOptional({ description: "URL de l'image de couverture" })
  @IsString()
  @IsOptional()
  coverImage?: string;
}
