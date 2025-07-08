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

export class CreateContributorRequestDto {
  @ApiProperty({
    description: "Motivation pour devenir contributeur",
    example:
      "Je suis passionné par les langues africaines et je souhaite contribuer à la préservation du patrimoine linguistique...",
    minLength: 50,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(50, {
    message: "La motivation doit contenir au moins 50 caractères",
  })
  @MaxLength(1000, {
    message: "La motivation ne peut pas dépasser 1000 caractères",
  })
  motivation: string;

  @ApiPropertyOptional({
    description: "Expérience linguistique du candidat",
    example:
      "Diplômé en linguistique, 5 ans d'enseignement du français, traducteur freelance...",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: "L'expérience ne peut pas dépasser 500 caractères",
  })
  experience?: string;

  @ApiPropertyOptional({
    description: "Langues maîtrisées par le candidat",
    example:
      "Ypunu (natif), Français (courant), Anglais (intermédiaire), Arabe (débutant)",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: "Les langues ne peuvent pas dépasser 200 caractères",
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
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/, {
    message: "Le lien LinkedIn doit être valide",
  })
  linkedIn?: string;

  @ApiPropertyOptional({
    description: "Profil GitHub du candidat",
    example: "https://github.com/username",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/, {
    message: "Le lien GitHub doit être valide",
  })
  github?: string;

  @ApiPropertyOptional({
    description: "Portfolio ou site web du candidat",
    example: "https://monportfolio.com",
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @IsUrl({}, { message: "Le portfolio doit être une URL valide" })
  portfolio?: string;
}
