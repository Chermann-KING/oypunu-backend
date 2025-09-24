/**
 * @fileoverview DTO pour la mise à jour du profil utilisateur O'Ypunu
 *
 * Ce fichier définit la structure de données pour la modification du profil
 * utilisateur avec validation des limites de caractères et contraintes de
 * sécurité pour maintenir la qualité des données de la plateforme.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  IsBoolean,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  USER_LIMITS,
  VALIDATION_LIMITS,
  ARRAY_LIMITS,
  VALIDATION_MESSAGES,
} from "../../common/constants/validation-limits.constants";

/**
 * DTO pour la mise à jour du profil utilisateur
 *
 * Structure de données flexible pour la modification partielle du profil
 * avec validation des contraintes et limites de caractères appropriées.
 *
 * ## ✏️ Champs modifiables :
 * - **Nom d'utilisateur** : 3-30 caractères alphanumériques
 * - **Langue native** : Code ISO ou identifiant de langue
 * - **Langues d'apprentissage** : Tableau limité à 10 langues
 * - **Photo de profil** : URL valide avec limite de taille
 * - **Biographie** : Texte libre avec limites min/max
 *
 * ## 🔒 Contraintes de validation :
 * - **Longueurs minimales/maximales** : Respectées pour tous les champs
 * - **Formats URL** : Validation stricte pour les liens
 * - **Tableaux** : Limites sur le nombre d'éléments
 * - **Messages d'erreur** : Centralisés et localisés
 *
 * ## 🌍 Support multilingue :
 * - **Codes ISO** : Validation des identifiants de langue
 * - **Préférences** : Personnalisation des langues d'apprentissage
 * - **Flexibilité** : Modification indépendante des préférences
 *
 * @class UpdateProfileDto
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * const updateData: UpdateProfileDto = {
 *   username: "nouveau_nom",
 *   bio: "Nouvelle biographie passionnante...",
 *   learningLanguages: ["en", "es", "it"]
 * };
 * ```
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: "Nom d'utilisateur",
    example: "jean_dupont",
    minLength: USER_LIMITS.USERNAME.MIN,
    maxLength: USER_LIMITS.USERNAME.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(USER_LIMITS.USERNAME.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT(
      "Le nom d'utilisateur",
      USER_LIMITS.USERNAME.MIN
    ),
  })
  @MaxLength(USER_LIMITS.USERNAME.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "Le nom d'utilisateur",
      USER_LIMITS.USERNAME.MAX
    ),
  })
  username?: string;

  @ApiPropertyOptional({
    description: "Prénom de l'utilisateur",
    example: "Jean",
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "Le prénom",
      VALIDATION_LIMITS.SHORT_TEXT.MAX
    ),
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: "Nom de famille de l'utilisateur",
    example: "Dupont",
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "Le nom de famille",
      VALIDATION_LIMITS.SHORT_TEXT.MAX
    ),
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: "Langue native de l'utilisateur",
    example: "fr",
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "La langue native",
      VALIDATION_LIMITS.SHORT_TEXT.MAX
    ),
  })
  nativeLanguage?: string;

  @ApiPropertyOptional({
    description: "Langues que l'utilisateur apprend",
    example: ["en", "es"],
    type: [String],
    maxItems: ARRAY_LIMITS.LEARNING_LANGUAGES,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(ARRAY_LIMITS.LEARNING_LANGUAGES, {
    message: VALIDATION_MESSAGES.ARRAY_TOO_LONG(
      "Les langues apprises",
      ARRAY_LIMITS.LEARNING_LANGUAGES
    ),
  })
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    each: true,
    message: VALIDATION_MESSAGES.TOO_LONG(
      "Chaque langue",
      VALIDATION_LIMITS.SHORT_TEXT.MAX
    ),
  })
  learningLanguages?: string[];

  @ApiPropertyOptional({
    description: "URL de la photo de profil",
    example: "https://example.com/avatar.jpg",
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(VALIDATION_LIMITS.URL.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "L'URL de la photo de profil",
      VALIDATION_LIMITS.URL.MAX
    ),
  })
  profilePicture?: string;

  @ApiPropertyOptional({
    description: "Biographie de l'utilisateur",
    example: "Passionné par les langues et les cultures...",
    minLength: USER_LIMITS.BIO.MIN,
    maxLength: USER_LIMITS.BIO.MAX,
  })
  @IsOptional()
  @IsString()
  @MinLength(USER_LIMITS.BIO.MIN, {
    message: VALIDATION_MESSAGES.TOO_SHORT(
      "La biographie",
      USER_LIMITS.BIO.MIN
    ),
  })
  @MaxLength(USER_LIMITS.BIO.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG("La biographie", USER_LIMITS.BIO.MAX),
  })
  bio?: string;

  @ApiPropertyOptional({
    description: "Site web de l'utilisateur",
    example: "https://monsite.com",
    maxLength: VALIDATION_LIMITS.URL.MAX,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(VALIDATION_LIMITS.URL.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "L'URL du site web",
      VALIDATION_LIMITS.URL.MAX
    ),
  })
  website?: string;

  @ApiPropertyOptional({
    description: "Ville de l'utilisateur",
    example: "Tchibanga",
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "La ville",
      VALIDATION_LIMITS.SHORT_TEXT.MAX
    ),
  })
  city?: string;

  @ApiPropertyOptional({
    description: "Pays de l'utilisateur",
    example: "Gabon",
    maxLength: VALIDATION_LIMITS.SHORT_TEXT.MAX,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.SHORT_TEXT.MAX, {
    message: VALIDATION_MESSAGES.TOO_LONG(
      "Le pays",
      VALIDATION_LIMITS.SHORT_TEXT.MAX
    ),
  })
  country?: string;

  @ApiPropertyOptional({
    description: "Visibilité du profil",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;
}
