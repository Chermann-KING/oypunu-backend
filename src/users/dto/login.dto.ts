import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
