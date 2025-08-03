/**
 * @fileoverview DTO pour l'authentification des utilisateurs O'Ypunu
 * 
 * Ce fichier définit la structure de données pour la connexion utilisateur
 * avec validation des champs email et mot de passe selon les standards
 * de sécurité et les exigences de la plateforme O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour l'authentification utilisateur
 * 
 * Structure de données pour la connexion avec validation des champs
 * obligatoires et formats requis pour l'authentification sécurisée.
 * 
 * ## 🔐 Validation de sécurité :
 * - **Email** : Format email valide obligatoire
 * - **Mot de passe** : Chaîne non vide obligatoire
 * - **Protection** : Pas de stockage du mot de passe en clair
 * 
 * ## 📝 Utilisation :
 * - Endpoint de connexion POST /auth/login
 * - Validation automatique par class-validator
 * - Documentation Swagger intégrée
 * 
 * @class LoginDto
 * @version 1.0.0
 * 
 * @example
 * ```typescript
 * const loginData: LoginDto = {
 *   email: "user@oypunu.com",
 *   password: "motDePasse123"
 * };
 * ```
 */
export class LoginDto {
  @ApiProperty({
    description: 'Adresse email pour se connecter',
    example: 'utilisateur@exemple.com',
    format: 'email',
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'motDePasse123',
    format: 'password',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  password: string;
}
