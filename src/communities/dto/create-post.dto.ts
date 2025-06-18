import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: 'Titre de la publication' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Contenu de la publication' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Tags associés à la publication' })
  @IsArray()
  @IsOptional()
  tags?: string[];
}
