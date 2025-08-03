/**
 * @fileoverview DTO pour l'inscription des nouveaux utilisateurs O'Ypunu
 * 
 * Ce fichier définit la structure de données pour l'inscription avec validation
 * complète des champs, sécurité des mots de passe et conformité RGPD
 * pour assurer une création de compte sécurisée et conforme.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

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

/**
 * DTO pour l'inscription des nouveaux utilisateurs
 * 
 * Structure de données complète pour la création de compte avec validation
 * stricte des champs et exigences de sécurité renforcées.
 * 
 * ## 🔐 Sécurité renforcée :
 * - **Nom d'utilisateur** : Alphanumériques, tirets, underscores uniquement
 * - **Email** : Format valide et unique dans le système
 * - **Mot de passe** : 12+ caractères avec complexité obligatoire
 * - **Langues** : Validation des codes ISO pour les préférences
 * 
 * ## ⚖️ Conformité légale :
 * - **Conditions d'utilisation** : Acceptation obligatoire
 * - **Politique de confidentialité** : Acceptation obligatoire
 * - **RGPD** : Consentement explicite pour le traitement des données
 * 
 * ## 🌍 Support multilingue :
 * - **Langue maternelle** : Code ISO ou ID de langue
 * - **Langues d'apprentissage** : Tableau de codes/IDs
 * - **Personnalisation** : Préférences linguistiques dès l'inscription
 * 
 * @class RegisterDto
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * const registerData: RegisterDto = {
 *   username: "john_doe",
 *   email: "john@oypunu.com",
 *   password: "MonMotDePasse123!",
 *   nativeLanguage: "fr",
 *   learningLanguages: ["en", "es"],
 *   hasAcceptedTerms: true,
 *   hasAcceptedPrivacyPolicy: true
 * };
 * ```
 */
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
