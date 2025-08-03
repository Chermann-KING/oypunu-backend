/**
 * @fileoverview DTO pour changement de mot de passe O'Ypunu
 * 
 * Ce DTO gère les opérations de changement de mot de passe avec validation
 * de sécurité renforcée, vérification de l'ancien mot de passe et confirmation
 * du nouveau pour garantir l'intégrité de la sécurité utilisateur.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../validators/password.validator';

/**
 * DTO pour changement sécurisé de mot de passe utilisateur
 * 
 * Classe de validation pour les demandes de changement de mot de passe,
 * incluant la vérification de l'ancien mot de passe, validation de force
 * du nouveau et confirmation pour éviter les erreurs de saisie.
 * 
 * ## 🔐 Sécurité implémentée :
 * - **Vérification actuelle** : Validation de l'ancien mot de passe
 * - **Force obligatoire** : Nouveau mot de passe complexe requis
 * - **Double confirmation** : Prévention erreurs de frappe
 * - **Validation temps réel** : Feedback immédiat à l'utilisateur
 * 
 * @class ChangePasswordDto
 * @version 1.0.0
 */
export class ChangePasswordDto {
  /**
   * Mot de passe actuel pour vérification sécurisée
   * 
   * @property {string} currentPassword - Mot de passe actuel de l'utilisateur
   */
  @ApiProperty({
    description: 'Mot de passe actuel',
    example: 'OldP@ssw0rd123',
    format: 'password',
  })
  @IsNotEmpty({ message: 'Le mot de passe actuel est requis' })
  @IsString()
  currentPassword: string;

  /**
   * Nouveau mot de passe avec critères de sécurité renforcés
   * 
   * Doit respecter la politique de sécurité O'Ypunu :
   * - Minimum 12 caractères
   * - Au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
   * - Pas de mots du dictionnaire communs
   * 
   * @property {string} newPassword - Nouveau mot de passe sécurisé
   */
  @ApiProperty({
    description: 'Nouveau mot de passe fort (12+ caractères, majuscules, minuscules, chiffres, caractères spéciaux)',
    example: 'NewStr0ng#P@ssw0rd2025!',
    format: 'password',
    minLength: 12,
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\|,.<>\\/?~`]).{12,}$',
  })
  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @IsString()
  @IsStrongPassword({
    message: 'Le nouveau mot de passe ne respecte pas les critères de sécurité requis'
  })
  newPassword: string;

  /**
   * Confirmation du nouveau mot de passe pour prévenir les erreurs
   * 
   * @property {string} confirmPassword - Confirmation identique au nouveau mot de passe
   */
  @ApiProperty({
    description: 'Confirmation du nouveau mot de passe',
    example: 'NewStr0ng#P@ssw0rd2025!',
    format: 'password',
  })
  @IsNotEmpty({ message: 'La confirmation du mot de passe est requise' })
  @IsString()
  confirmPassword: string;
}