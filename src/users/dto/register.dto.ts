import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  Matches,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: "Nom d'utilisateur unique",
    example: 'johndoe',
    pattern: '^[a-zA-Z0-9_-]+$',
    minLength: 3,
    maxLength: 30,
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores",
  })
  username: string;

  @ApiProperty({
    description: 'Adresse email valide',
    example: 'john.doe@exemple.com',
    format: 'email',
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'P@ssw0rd123',
    format: 'password',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  password: string;

  @ApiProperty({
    description: "Langue maternelle de l'utilisateur (ISO 639-1)",
    example: 'fr',
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
    required: false,
  })
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiProperty({
    description: "Langues que l'utilisateur apprend (ISO 639-1)",
    example: ['en', 'es'],
    isArray: true,
    enum: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningLanguages?: string[];
}
