import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetMessagesDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'La page doit être un nombre' })
  @Min(1, { message: 'La page doit être supérieure à 0' })
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'La limite doit être un nombre' })
  @Min(1, { message: 'La limite doit être supérieure à 0' })
  @Max(50, { message: 'La limite ne peut pas dépasser 50' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: "L'ID de conversation doit être une chaîne" })
  conversationId?: string;
}
