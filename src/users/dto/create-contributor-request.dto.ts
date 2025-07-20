import {
  IsString,
  IsEmail,
  IsBoolean,
  Length,
  IsOptional,
  IsUrl,
  MaxLength,
  MinLength,
  IsNotEmpty,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { USER_LIMITS, VALIDATION_LIMITS, VALIDATION_MESSAGES } from "../../common/constants/validation-limits.constants";

export class CreateContributorRequestDto {
  @ApiProperty({
    description: "Motivation pour devenir contributeur",
    example:
      "Je suis passionné par les langues africaines et je souhaite contribuer à la préservation du patrimoine linguistique...",
    minLength: USER_LIMITS.CONTRIBUTION_REASON.MIN,
    maxLength: USER_LIMITS.CONTRIBUTION_REASON.MAX,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(USER_LIMITS.CONTRIBUTION_REASON.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT("La motivation", USER_LIMITS.CONTRIBUTION_REASON.MIN),
  })
  @MaxLength(USER_LIMITS.CONTRIBUTION_REASON.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("La motivation", USER_LIMITS.CONTRIBUTION_REASON.MAX),
  })
  motivation: string;

  @ApiPropertyOptional({
    description: "Expérience linguistique du candidat",
    example:
      "Diplômé en linguistique, 5 ans d'enseignement du français, traducteur freelance...",
    maxLength: VALIDATION_LIMITS.MEDIUM_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MEDIUM_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("L'expérience", VALIDATION_LIMITS.MEDIUM_TEXT.MAX),
  })
  experience?: string;

  @ApiPropertyOptional({
    description: "Langues maîtrisées par le candidat",
    example:
      "Ypunu (natif), Français (courant), Anglais (intermédiaire), Arabe (débutant)",
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("Les langues", VALIDATION_LIMITS.SHORT_TEXT.MAX),
  })
  languages?: string;

  @ApiProperty({
    description:
      "Engagement du candidat à respecter les règles de la communauté",
    example: true,
  })
  @IsBoolean()
  commitment: boolean;

  @ApiPropertyOptional({
    description: "Profil LinkedIn du candidat",
    example: "https://linkedin.com/in/username",
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.URL.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("Le lien LinkedIn", VALIDATION_LIMITS.URL.MAX),
  })
  @Matches(/^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/, {
    message: "Le lien LinkedIn doit être valide",
  })
  linkedIn?: string;

  @ApiPropertyOptional({
    description: "Profil GitHub du candidat",
    example: "https://github.com/username",
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.URL.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("Le lien GitHub", VALIDATION_LIMITS.URL.MAX),
  })
  @Matches(/^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/, {
    message: "Le lien GitHub doit être valide",
  })
  github?: string;

  @ApiPropertyOptional({
    description: "Portfolio ou site web du candidat",
    example: "https://monportfolio.com",
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.URL.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("Le portfolio", VALIDATION_LIMITS.URL.MAX),
  })
  @IsUrl({}, { message: "Le portfolio doit être une URL valide" })
  portfolio?: string;
}
