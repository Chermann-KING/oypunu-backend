/**
 * @fileoverview DTO pour réinitialisation de mot de passe O'Ypunu
 * 
 * Ce DTO gère les opérations de réinitialisation de mot de passe via token
 * sécurisé envoyé par email, avec validation de force du nouveau mot de passe
 * et confirmation pour garantir la sécurité du processus de récupération.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../validators/password.validator';

/**
 * DTO pour réinitialisation sécurisée de mot de passe via token
 * 
 * Classe de validation pour les demandes de réinitialisation de mot de passe
 * utilisant un token sécurisé à usage unique envoyé par email. Garantit
 * l'authenticité de la demande et la force du nouveau mot de passe.
 * 
 * ## 🔐 Processus sécurisé :
 * - **Token unique** : Jeton sécurisé à durée limitée (15 minutes)
 * - **Validation email** : Seul le propriétaire de l'email peut réinitialiser
 * - **Force obligatoire** : Nouveau mot de passe complexe requis
 * - **Double confirmation** : Prévention des erreurs de saisie
 * 
 * ## 🛡️ Sécurité anti-attaque :
 * - Tokens à usage unique (invalidés après utilisation)
 * - Expiration automatique pour limiter fenêtre d'attaque
 * - Rate limiting sur les demandes de réinitialisation
 * 
 * @class ResetPasswordDto
 * @version 1.0.0
 */
export class ResetPasswordDto {
  /**
   * Token de réinitialisation sécurisé reçu par email
   * 
   * Jeton cryptographique unique généré côté serveur et envoyé par email
   * à l'utilisateur. Valide 15 minutes et à usage unique.
   * 
   * @property {string} resetToken - Token de réinitialisation sécurisé
   */
  @ApiProperty({
    description: 'Token de réinitialisation reçu par email',
    example: 'abc123-def456-ghi789',
  })
  @IsNotEmpty({ message: 'Le token de réinitialisation est requis' })
  @IsString()
  resetToken: string;

  /**
   * Nouveau mot de passe avec critères de sécurité renforcés
   * 
   * Doit respecter la politique de sécurité O'Ypunu identique au changement
   * de mot de passe pour maintenir la cohérence de sécurité.
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
   * Confirmation du nouveau mot de passe
   * 
   * Champ de vérification pour s'assurer que l'utilisateur a correctement
   * saisi son nouveau mot de passe sans erreur de frappe.
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