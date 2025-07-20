import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USER_LIMITS, VALIDATION_LIMITS, ARRAY_LIMITS, VALIDATION_MESSAGES } from '../../common/constants/validation-limits.constants';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: "Nom d'utilisateur",
    example: 'jean_dupont',
    minLength: USER_LIMITS.USERNAME.MIN,
    maxLength: USER_LIMITS.USERNAME.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(USER_LIMITS.USERNAME.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT("Le nom d'utilisateur", USER_LIMITS.USERNAME.MIN)
  })
  @MaxLength(USER_LIMITS.USERNAME.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("Le nom d'utilisateur", USER_LIMITS.USERNAME.MAX)
  })
  username?: string;

  @ApiPropertyOptional({
    description: "Langue native de l'utilisateur",
    example: 'fr',
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG('La langue native', VALIDATION_LIMITS.SHORT_TEXT.MAX)
  })
  nativeLanguage?: string;

  @ApiPropertyOptional({
    description: "Langues que l'utilisateur apprend",
    example: ['en', 'es'],
    type: [String],
    maxItems: ARRAY_LIMITS.LEARNING_LANGUAGES,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(ARRAY_LIMITS.LEARNING_LANGUAGES, {
    message: VALIDATION_MESSAGES.ARRAY_TOO_LONG('Les langues apprises', ARRAY_LIMITS.LEARNING_LANGUAGES)
  })
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    each: true,
    message: VALIDATION_MESSAGES.TOO_LONG('Chaque langue', VALIDATION_LIMITS.SHORT_TEXT.MAX)
  })
  learningLanguages?: string[];

  @ApiPropertyOptional({
    description: 'URL de la photo de profil',
    example: 'https://example.com/avatar.jpg',
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(VALIDATION_LIMITS.URL.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("L'URL de la photo de profil", VALIDATION_LIMITS.URL.MAX)
  })
  profilePicture?: string;

  @ApiPropertyOptional({
    description: "Biographie de l'utilisateur",
    example: 'Passionné par les langues et les cultures...',
    minLength: USER_LIMITS.BIO.MIN,
    maxLength: USER_LIMITS.BIO.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(USER_LIMITS.BIO.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT('La biographie', USER_LIMITS.BIO.MIN)
  })
  @MaxLength(USER_LIMITS.BIO.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG('La biographie', USER_LIMITS.BIO.MAX)
  })
  bio?: string;
}
