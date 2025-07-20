import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  Matches,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../auth/validators/password.validator';

export class RegisterDto {
  @ApiProperty({
    description: "Nom d'utilisateur unique",
    example: 'johndoe_123',
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
    description: 'Mot de passe fort (12+ caractères, majuscules, minuscules, chiffres, caractères spéciaux)',
    example: 'MyStr0ng#P@ssw0rd2025!',
    format: 'password',
    minLength: 12,
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\|,.<>\\/?~`]).{12,}$',
  })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @IsString()
  @IsStrongPassword({
    message: 'Le mot de passe ne respecte pas les critères de sécurité requis'
  })
  password: string;

  @ApiProperty({
    description: "Langue maternelle de l'utilisateur (ID ou code ISO)",
    example: 'fr',
    required: false,
  })
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiProperty({
    description: "Langues que l'utilisateur apprend (IDs ou codes ISO)",
    example: ['en', 'es'],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningLanguages?: string[];

  @ApiProperty({
    description: "Acceptation des conditions d'utilisation",
    example: true,
    type: 'boolean',
  })
  @IsNotEmpty({ message: "Vous devez accepter les conditions d'utilisation" })
  @IsBoolean()
  hasAcceptedTerms: boolean;

  @ApiProperty({
    description: 'Acceptation de la politique de confidentialité',
    example: true,
    type: 'boolean',
  })
  @IsNotEmpty({
    message: 'Vous devez accepter la politique de confidentialité',
  })
  @IsBoolean()
  hasAcceptedPrivacyPolicy: boolean;
}
