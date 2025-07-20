import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../validators/password.validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de réinitialisation reçu par email',
    example: 'abc123-def456-ghi789',
  })
  @IsNotEmpty({ message: 'Le token de réinitialisation est requis' })
  @IsString()
  resetToken: string;

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

  @ApiProperty({
    description: 'Confirmation du nouveau mot de passe',
    example: 'NewStr0ng#P@ssw0rd2025!',
    format: 'password',
  })
  @IsNotEmpty({ message: 'La confirmation du mot de passe est requise' })
  @IsString()
  confirmPassword: string;
}