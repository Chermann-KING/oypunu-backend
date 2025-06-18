import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Contenu du commentaire' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'ID du commentaire parent (pour les réponses)',
  })
  @IsMongoId()
  @IsOptional()
  parentCommentId?: string;
}
