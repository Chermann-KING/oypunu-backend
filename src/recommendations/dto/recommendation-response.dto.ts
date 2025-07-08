import { ApiProperty } from '@nestjs/swagger';

export class RecommendationItemDto {
  @ApiProperty({ description: 'ID du mot recommandé' })
  id: string;

  @ApiProperty({ description: 'Mot recommandé' })
  word: string;

  @ApiProperty({ description: 'Code de langue' })
  language: string;

  @ApiProperty({ description: 'Nom de la langue' })
  languageName: string;

  @ApiProperty({ description: 'Drapeau de la langue' })
  languageFlag: string;

  @ApiProperty({ description: 'Définition principale' })
  definition: string;

  @ApiProperty({ description: 'Score de recommandation (0-1)' })
  score: number;

  @ApiProperty({ description: 'Raisons de la recommandation', type: [String] })
  reasons: string[];

  @ApiProperty({ description: 'Catégorie de recommandation' })
  category: string;

  @ApiProperty({ description: 'Prononciation (optionnel)', required: false })
  pronunciation?: string;

  @ApiProperty({ description: "Exemples d'usage", type: [String] })
  examples: string[];

  @ApiProperty({ description: 'URL audio (optionnel)', required: false })
  audioUrl?: string;

  @ApiProperty({ description: 'Métadonnées supplémentaires' })
  metadata: Record<string, any>;
}

export class RecommendationsResponseDto {
  @ApiProperty({
    description: 'Liste des recommandations',
    type: [RecommendationItemDto],
  })
  recommendations: RecommendationItemDto[];

  @ApiProperty({ description: 'Nombre total de recommandations' })
  count: number;

  @ApiProperty({ description: 'Type de recommandations' })
  type: string;

  @ApiProperty({ description: 'Timestamp de génération' })
  timestamp: string;

  @ApiProperty({ description: 'Indique si les données viennent du cache' })
  fromCache: boolean;

  @ApiProperty({ description: 'Temps de génération en millisecondes' })
  generationTimeMs: number;

  @ApiProperty({ description: 'Score moyen des recommandations' })
  avgScore: number;

  @ApiProperty({ description: "Configuration de l'algorithme utilisé" })
  algorithm: {
    type: string;
    weights: {
      behavioral: number;
      semantic: number;
      community: number;
      linguistic: number;
    };
  };
}

export class RecommendationExplanationDto {
  @ApiProperty({ description: 'ID du mot' })
  wordId: string;

  @ApiProperty({ description: 'Score de recommandation' })
  score: number;

  @ApiProperty({ description: 'Facteurs de recommandation détaillés' })
  factors: {
    behavioral: {
      score: number;
      details: string[];
    };
    semantic: {
      score: number;
      details: string[];
    };
    community: {
      score: number;
      details: string[];
    };
    linguistic: {
      score: number;
      details: string[];
    };
  };

  @ApiProperty({
    description: 'Mots similaires qui ont influencé la recommandation',
  })
  relatedWords: {
    id: string;
    word: string;
    language: string;
    similarity: number;
    reason: string;
  }[];

  @ApiProperty({ description: 'Recommandations alternatives' })
  alternatives: RecommendationItemDto[];
}

export class FeedbackResponseDto {
  @ApiProperty({
    description: 'Indique si le feedback a été enregistré avec succès',
  })
  success: boolean;

  @ApiProperty({ description: 'Message de confirmation' })
  message: string;

  @ApiProperty({
    description: 'Impact du feedback sur les futures recommandations',
  })
  impact: string;

  @ApiProperty({ description: "Timestamp de l'enregistrement" })
  timestamp: string;
}
