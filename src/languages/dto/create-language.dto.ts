import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLanguageVariantDto {
  @ApiProperty({ description: 'Nom de la variante', example: 'Fang du Nord' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Région de la variante', example: 'Gabon' })
  @IsString()
  region: string;

  @ApiProperty({ description: 'Code pays ISO', example: 'GA', required: false })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiProperty({
    description: 'Autres noms pour cette variante',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternativeNames?: string[];
}

export class CreateLanguageScriptDto {
  @ApiProperty({ description: 'Nom du script', example: 'Latin' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Code du script', example: 'Latn' })
  @IsString()
  code: string;

  @ApiProperty({
    description: "Direction d'écriture",
    enum: ['ltr', 'rtl'],
    default: 'ltr',
  })
  @IsOptional()
  @IsEnum(['ltr', 'rtl'])
  direction?: string;

  @ApiProperty({ description: 'Script par défaut', default: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateLanguageDto {
  @ApiProperty({ description: 'Nom de la langue', example: 'Fang' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Nom natif de la langue', example: 'Faŋ' })
  @IsString()
  nativeName: string;

  @ApiProperty({
    description: 'Code ISO 639-1',
    example: 'fan',
    required: false,
  })
  @IsOptional()
  @IsString()
  iso639_1?: string;

  @ApiProperty({
    description: 'Code ISO 639-2',
    example: 'fan',
    required: false,
  })
  @IsOptional()
  @IsString()
  iso639_2?: string;

  @ApiProperty({
    description: 'Code ISO 639-3',
    example: 'fan',
    required: false,
  })
  @IsOptional()
  @IsString()
  iso639_3?: string;

  @ApiProperty({
    description: 'Région principale',
    example: 'Afrique Centrale',
  })
  @IsString()
  region: string;

  @ApiProperty({
    description: 'Pays où la langue est parlée',
    example: ['GA', 'GQ', 'CM'],
  })
  @IsArray()
  @IsString({ each: true })
  countries: string[];

  @ApiProperty({ description: 'Autres noms de la langue', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alternativeNames?: string[];

  @ApiProperty({
    description: 'Variantes de la langue',
    type: [CreateLanguageVariantDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLanguageVariantDto)
  variants?: CreateLanguageVariantDto[];

  @ApiProperty({
    description: "Scripts d'écriture",
    type: [CreateLanguageScriptDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLanguageScriptDto)
  scripts?: CreateLanguageScriptDto[];

  @ApiProperty({
    description: 'Statut de la langue',
    enum: ['major', 'regional', 'local', 'liturgical', 'extinct'],
    default: 'local',
  })
  @IsOptional()
  @IsEnum(['major', 'regional', 'local', 'liturgical', 'extinct'])
  status?: string;

  @ApiProperty({ description: 'Nombre de locuteurs', required: false })
  @IsOptional()
  @IsNumber()
  speakerCount?: number;

  @ApiProperty({
    description: "Statut d'endangement",
    enum: ['endangered', 'vulnerable', 'safe', 'unknown'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['endangered', 'vulnerable', 'safe', 'unknown'])
  endangermentStatus?: string;

  @ApiProperty({
    description: 'ID de la langue parent (pour dialectes)',
    required: false,
  })
  @IsOptional()
  @IsString()
  parentLanguageId?: string;

  @ApiProperty({ description: 'Description de la langue', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Lien Wikipedia', required: false })
  @IsOptional()
  @IsUrl()
  wikipediaUrl?: string;

  @ApiProperty({ description: 'Lien Ethnologue', required: false })
  @IsOptional()
  @IsUrl()
  ethnologueUrl?: string;

  @ApiProperty({ description: 'Sources de référence', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @ApiProperty({ description: 'Emoji du drapeau principal', required: false })
  @IsOptional()
  @IsString()
  flagEmoji?: string;

  @ApiProperty({ description: 'Emojis des drapeaux des pays', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  flagEmojis?: string[];

  @ApiProperty({
    description: 'Couleur principale',
    default: '#3B82F6',
    required: false,
  })
  @IsOptional()
  @IsString()
  primaryColor?: string;
}

export class ApproveLanguageDto {
  @ApiProperty({ description: "Notes d'approbation", required: false })
  @IsOptional()
  @IsString()
  approvalNotes?: string;

  @ApiProperty({ description: 'Mettre en avant la langue', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ description: "Ordre d'affichage", required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class RejectLanguageDto {
  @ApiProperty({ description: 'Raison du rejet' })
  @IsString()
  rejectionReason: string;

  @ApiProperty({
    description: 'Suggestions pour améliorer la proposition',
    required: false,
  })
  @IsOptional()
  @IsString()
  suggestions?: string;
}
