import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TranslationDto {
  @ApiProperty({ example: '64f5a123456789abcdef0123' })
  id: string;

  @ApiProperty({ example: 'es' })
  language: string;

  @ApiProperty({ example: 'solar' })
  translatedWord: string;

  @ApiPropertyOptional({ example: ['astronomie', 'physique'] })
  context?: string[];

  @ApiProperty({ example: 0.95 })
  confidence: number;

  @ApiProperty({ example: 5 })
  votes: number;

  @ApiProperty({ example: 'manual' })
  validationType: string;

  @ApiPropertyOptional({ example: '64f5a123456789abcdef0124' })
  targetWordId?: string;

  @ApiPropertyOptional({ example: 'CONCEPT_123_SENSE_1' })
  senseId?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiPropertyOptional()
  createdBy?: {
    id: string;
    username: string;
  };

  @ApiPropertyOptional()
  validatedBy?: {
    id: string;
    username: string;
  };
}

export class AvailableLanguageDto {
  @ApiProperty({ example: 'es' })
  code: string;

  @ApiProperty({ example: 'Español' })
  name: string;

  @ApiProperty({ example: 15 })
  translationCount: number;

  @ApiProperty({ example: 0.87 })
  averageQuality: number;
}

export class TranslationSuggestionDto {
  @ApiProperty({ example: '64f5a123456789abcdef0124' })
  wordId: string;

  @ApiProperty({ example: 'solar' })
  word: string;

  @ApiProperty({ example: 'es' })
  language: string;

  @ApiProperty({ example: 0.85 })
  similarityScore: number;

  @ApiProperty({ example: 'Relatif au Soleil et à son système' })
  definition: string;

  @ApiProperty({ example: 'merge' })
  suggestedAction: string; // 'merge', 'separate', 'uncertain'

  @ApiPropertyOptional({ example: ['astronomie', 'soleil', 'physique'] })
  sharedKeywords?: string[];

  @ApiProperty({ example: true })
  sameCategory: boolean;

  @ApiPropertyOptional({ example: 'Physique' })
  categoryName?: string;
}

export class TranslationGroupDto {
  @ApiProperty({ example: 'CONCEPT_SOLAR_PHYSICS' })
  conceptId: string;

  @ApiProperty({ example: 'solaire' })
  primaryWord: string;

  @ApiProperty({ example: 'fr' })
  primaryLanguage: string;

  @ApiProperty({ example: 8 })
  totalTranslations: number;

  @ApiProperty({ example: 0.92 })
  qualityScore: number;

  @ApiProperty({ example: ['es', 'en', 'de', 'it'] })
  availableLanguages: string[];

  @ApiProperty({ type: [TranslationDto] })
  translations: TranslationDto[];
}

export class ValidationResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'merge' })
  action: string;

  @ApiProperty({ example: 'Traduction fusionnée avec succès' })
  message: string;

  @ApiPropertyOptional({ example: 'CONCEPT_SOLAR_PHYSICS' })
  translationGroupId?: string;

  @ApiPropertyOptional({ example: 0.88 })
  finalConfidence?: number;

  @ApiPropertyOptional({ example: 3 })
  affectedTranslations?: number;
}

export class LanguageStatsDto {
  @ApiProperty({ example: 'es' })
  language: string;

  @ApiProperty({ example: 1250 })
  totalWords: number;

  @ApiProperty({ example: 890 })
  translatedWords: number;

  @ApiProperty({ example: 71.2 })
  coveragePercentage: number;

  @ApiProperty({ example: 0.85 })
  averageQuality: number;

  @ApiProperty({ example: 156 })
  pendingTranslations: number;

  @ApiProperty({ type: [String], example: ['fr', 'en', 'de'] })
  mostTranslatedFrom: string[];
}
