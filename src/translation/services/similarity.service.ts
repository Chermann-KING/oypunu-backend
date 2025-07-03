import { Injectable } from '@nestjs/common';
import { Word } from '../../dictionary/schemas/word.schema';

export interface SimilarityResult {
  score: number;
  categoryMatch: boolean;
  sharedKeywords: string[];
  semanticScore: number;
  categoryScore: number;
  recommendation: 'merge' | 'separate' | 'uncertain';
}

@Injectable()
export class SimilarityService {
  // Mots vides en français, anglais, espagnol, allemand
  private readonly STOP_WORDS = new Set([
    // Français
    'le',
    'la',
    'les',
    'un',
    'une',
    'des',
    'de',
    'du',
    'dans',
    'pour',
    'avec',
    'sans',
    'sur',
    'sous',
    'entre',
    'par',
    'et',
    'ou',
    'mais',
    'donc',
    'car',
    'si',
    'que',
    'qui',
    'dont',
    'où',
    'ce',
    'cet',
    'cette',
    'ces',
    'son',
    'sa',
    'ses',
    'mon',
    'ma',
    'mes',
    'ton',
    'ta',
    'tes',
    'notre',
    'nos',
    'votre',
    'vos',
    'leur',
    'leurs',
    'je',
    'tu',
    'il',
    'elle',
    'nous',
    'vous',
    'ils',
    'elles',
    'me',
    'te',
    'se',
    'nous',
    'vous',
    'se',
    'moi',
    'toi',
    'lui',
    'elle',
    'nous',
    'vous',
    'eux',
    'elles',
    'être',
    'avoir',
    'faire',
    'aller',
    'venir',
    'voir',
    'savoir',
    'pouvoir',
    'vouloir',
    'dire',
    'prendre',
    'donner',
    'mettre',
    'tenir',
    'venir',
    'partir',
    'sortir',
    'entrer',
    'monter',
    'descendre',
    'rester',
    'tomber',
    'naître',
    'mourir',
    'est',
    'sont',
    'était',
    'étaient',
    'sera',
    'seront',
    'soit',
    'soient',
    'ai',
    'as',
    'a',
    'avons',
    'avez',
    'ont',
    'avais',
    'avait',
    'avions',
    'aviez',
    'avaient',
    'aura',
    'auras',
    'auront',
    'ait',
    'aient',

    // Anglais
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'up',
    'down',
    'out',
    'off',
    'over',
    'under',
    'again',
    'further',
    'then',
    'once',
    'is',
    'am',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'having',
    'do',
    'does',
    'did',
    'doing',
    'will',
    'would',
    'should',
    'could',
    'can',
    'may',
    'might',
    'must',
    'shall',
    'he',
    'she',
    'it',
    'they',
    'we',
    'you',
    'i',
    'me',
    'him',
    'her',
    'us',
    'them',
    'my',
    'your',
    'his',
    'her',
    'its',
    'our',
    'their',
    'this',
    'that',
    'these',
    'those',
    'what',
    'which',
    'who',
    'when',
    'where',
    'why',
    'how',
    'all',
    'any',
    'both',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',

    // Espagnol
    'el',
    'la',
    'los',
    'las',
    'un',
    'una',
    'unos',
    'unas',
    'de',
    'del',
    'en',
    'con',
    'por',
    'para',
    'sin',
    'sobre',
    'bajo',
    'entre',
    'desde',
    'hasta',
    'hacia',
    'según',
    'durante',
    'mediante',
    'y',
    'o',
    'pero',
    'sino',
    'aunque',
    'si',
    'que',
    'quien',
    'cual',
    'donde',
    'cuando',
    'como',
    'porque',
    'este',
    'esta',
    'estos',
    'estas',
    'ese',
    'esa',
    'esos',
    'esas',
    'aquel',
    'aquella',
    'aquellos',
    'aquellas',
    'mi',
    'tu',
    'su',
    'nuestro',
    'vuestro',
    'sus',
    'yo',
    'tú',
    'él',
    'ella',
    'nosotros',
    'vosotros',
    'ellos',
    'ellas',
    'me',
    'te',
    'se',
    'nos',
    'os',
    'le',
    'les',
    'lo',
    'la',
    'los',
    'las',
    'ser',
    'estar',
    'haber',
    'tener',
    'hacer',
    'ir',
    'venir',
    'ver',
    'saber',
    'poder',
    'querer',
    'decir',
    'dar',
    'poner',
    'llevar',
    'traer',
    'salir',
    'entrar',
    'subir',
    'bajar',
    'quedar',
    'caer',
    'nacer',
    'morir',

    // Allemand
    'der',
    'die',
    'das',
    'den',
    'dem',
    'des',
    'ein',
    'eine',
    'einer',
    'eines',
    'einem',
    'einen',
    'und',
    'oder',
    'aber',
    'in',
    'an',
    'auf',
    'zu',
    'für',
    'von',
    'mit',
    'bei',
    'nach',
    'vor',
    'über',
    'unter',
    'zwischen',
    'durch',
    'gegen',
    'ohne',
    'um',
    'während',
    'wegen',
    'trotz',
    'statt',
    'dieser',
    'diese',
    'dieses',
    'jener',
    'jene',
    'jenes',
    'welcher',
    'welche',
    'welches',
    'mein',
    'dein',
    'sein',
    'ihr',
    'unser',
    'euer',
    'ich',
    'du',
    'er',
    'sie',
    'es',
    'wir',
    'ihr',
    'sie',
    'mich',
    'dich',
    'sich',
    'uns',
    'euch',
    'mir',
    'dir',
    'ihm',
    'ihr',
    'ihnen',
    'sein',
    'haben',
    'werden',
    'können',
    'müssen',
    'dürfen',
    'sollen',
    'wollen',
    'mögen',
    'lassen',
    'gehen',
    'kommen',
    'sehen',
    'wissen',
    'machen',
    'geben',
    'nehmen',
    'bringen',
    'holen',
    'legen',
    'stellen',
    'setzen',
    'bleiben',
    'fallen',
    'steigen',
  ]);

  /**
   * Calcule le score de similarité entre deux mots
   */
  calculateSimilarity(word1: Word, word2: Word): SimilarityResult {
    // 1. Score catégorie (50% du poids)
    const categoryMatch = this.isSameCategory(word1, word2);
    const categoryScore = categoryMatch ? 1.0 : 0.0;

    // 2. Score sémantique définition (50% du poids)
    const keywords1 = this.extractKeywords(word1);
    const keywords2 = this.extractKeywords(word2);
    const semanticResult = this.calculateSemanticSimilarity(
      keywords1,
      keywords2,
    );

    // 3. Score final
    const finalScore = categoryScore * 0.5 + semanticResult.similarity * 0.5;

    // 4. Recommandation basée sur le score
    let recommendation: 'merge' | 'separate' | 'uncertain';
    if (finalScore > 0.9) {
      recommendation = 'merge';
    } else if (finalScore > 0.6) {
      recommendation = 'uncertain';
    } else {
      recommendation = 'separate';
    }

    return {
      score: finalScore,
      categoryMatch,
      sharedKeywords: semanticResult.sharedKeywords,
      semanticScore: semanticResult.similarity,
      categoryScore,
      recommendation,
    };
  }

  /**
   * Extrait les mots-clés pertinents d'un mot
   */
  extractKeywords(word: Word): string[] {
    const keywords = new Set<string>();

    // 1. Utiliser les mots-clés déjà extraits si disponibles
    if (word.extractedKeywords && word.extractedKeywords.length > 0) {
      word.extractedKeywords.forEach((kw) => keywords.add(kw.toLowerCase()));
    }

    // 2. Extraire des définitions
    if (word.meanings && word.meanings.length > 0) {
      word.meanings.forEach((meaning) => {
        meaning.definitions.forEach((def) => {
          const extracted = this.extractFromText(def.definition);
          extracted.forEach((kw) => keywords.add(kw));
        });

        // Ajouter les synonymes
        if (meaning.synonyms) {
          meaning.synonyms.forEach((syn) => keywords.add(syn.toLowerCase()));
        }

        // Ajouter les exemples (avec poids moindre)
        if (meaning.examples) {
          meaning.examples.forEach((example) => {
            const extracted = this.extractFromText(example);
            extracted.slice(0, 3).forEach((kw) => keywords.add(kw)); // Limiter à 3 par exemple
          });
        }
      });
    }

    // 3. Ajouter l'étymologie si disponible
    if (word.etymology) {
      const extracted = this.extractFromText(word.etymology);
      extracted.forEach((kw) => keywords.add(kw));
    }

    return Array.from(keywords);
  }

  /**
   * Extrait les mots-clés d'un texte
   */
  private extractFromText(text: string): string[] {
    if (!text) return [];

    return text
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ') // Garder seulement lettres et espaces (Unicode)
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 2 && !this.STOP_WORDS.has(word) && !word.match(/^\d+$/), // Exclure les nombres
      )
      .filter((word) => this.isSignificantWord(word));
  }

  /**
   * Vérifie si un mot est significatif (nom, adjectif, verbe principal)
   */
  private isSignificantWord(word: string): boolean {
    // Liste de préfixes/suffixes qui indiquent des mots significatifs
    const significantPatterns = [
      // Suffixes français
      /.*tion$/,
      /.*sion$/,
      /.*ment$/,
      /.*ité$/,
      /.*eur$/,
      /.*ique$/,
      /.*aire$/,
      /.*able$/,
      /.*ible$/,
      // Suffixes anglais
      /.*tion$/,
      /.*sion$/,
      /.*ment$/,
      /.*ity$/,
      /.*ness$/,
      /.*ful$/,
      /.*less$/,
      /.*able$/,
      /.*ible$/,
      // Suffixes espagnols
      /.*ción$/,
      /.*sión$/,
      /.*miento$/,
      /.*dad$/,
      /.*idad$/,
      /.*ador$/,
      /.*ivo$/,
      /.*able$/,
      // Suffixes allemands
      /.*ung$/,
      /.*keit$/,
      /.*heit$/,
      /.*schaft$/,
      /.*lich$/,
      /.*bar$/,
      /.*sam$/,
    ];

    // Le mot est significatif s'il correspond à un pattern ou s'il est assez long
    return (
      word.length >= 4 &&
      (significantPatterns.some((pattern) => pattern.test(word)) ||
        word.length >= 6)
    );
  }

  /**
   * Calcule la similarité sémantique entre deux ensembles de mots-clés
   */
  private calculateSemanticSimilarity(
    keywords1: string[],
    keywords2: string[],
  ): {
    similarity: number;
    sharedKeywords: string[];
  } {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return { similarity: 0, sharedKeywords: [] };
    }

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    // Intersection
    const intersection = Array.from(set1).filter((x) => set2.has(x));

    // Union
    const union = new Set([...set1, ...set2]);

    // Similarité de Jaccard
    const jaccardSimilarity = intersection.length / union.size;

    // Bonus pour les mots-clés très spécifiques (longueur > 6)
    const specificMatches = intersection.filter(
      (word) => word.length > 6,
    ).length;
    const specificBonus = specificMatches * 0.1; // Bonus de 10% par mot spécifique

    const finalSimilarity = Math.min(1.0, jaccardSimilarity + specificBonus);

    return {
      similarity: finalSimilarity,
      sharedKeywords: intersection,
    };
  }

  /**
   * Vérifie si deux mots appartiennent à la même catégorie
   */
  private isSameCategory(word1: Word, word2: Word): boolean {
    if (!word1.categoryId || !word2.categoryId) {
      return false;
    }
    return word1.categoryId.toString() === word2.categoryId.toString();
  }

  /**
   * Met à jour les mots-clés extraits d'un mot (pour optimisation future)
   */
  updateExtractedKeywords(word: Word): string[] {
    const keywords = this.extractKeywords(word);
    // Cette méthode sera appelée lors de la création/mise à jour des mots
    return keywords;
  }

  /**
   * Calcule un score de confiance ajusté basé sur l'historique d'apprentissage
   */
  adjustConfidenceBasedOnHistory(
    baseScore: number,
    categoryMatch: boolean,
    sharedKeywordsCount: number,
    historicalAccuracy?: number,
  ): number {
    let adjustedScore = baseScore;

    // Ajustement basé sur l'historique (si disponible)
    if (historicalAccuracy !== undefined) {
      // Si l'historique montre une bonne précision, on peut être plus confiant
      const historyFactor = (historicalAccuracy - 0.5) * 0.2; // -0.1 à +0.1
      adjustedScore += historyFactor;
    }

    // Bonus pour les correspondances de catégorie
    if (categoryMatch) {
      adjustedScore += 0.1;
    }

    // Bonus pour les mots-clés partagés
    if (sharedKeywordsCount >= 3) {
      adjustedScore += 0.05;
    }

    return Math.min(1.0, Math.max(0.0, adjustedScore));
  }
}
