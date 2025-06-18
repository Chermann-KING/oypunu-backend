import {
  IsString,
  IsOptional,
  IsArray,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    description: "Nom d'utilisateur",
    example: 'jean_dupont',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username?: string;

  @ApiProperty({
    description: "Langue native de l'utilisateur",
    example: 'fr',
    required: false,
  })
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiProperty({
    description: "Langues que l'utilisateur apprend",
    example: ['en', 'es'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningLanguages?: string[];

  @ApiProperty({
    description: 'URL de la photo de profil',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  profilePicture?: string;

  @ApiProperty({
    description: "Biographie de l'utilisateur",
    example: 'Passionné par les langues et les cultures...',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
