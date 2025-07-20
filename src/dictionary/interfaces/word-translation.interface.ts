import { User } from '../../users/schemas/user.schema';
import { Word } from '../schemas/word.schema';

/**
 * Interface pour la gestion centralisée des traductions bidirectionnelles
 * PHASE 1 - ÉTAPE 3 : Extraction responsabilités traductions
 */
export interface IWordTranslationService {
  /**
   * Crée des traductions bidirectionnelles pour un mot
   * Génère automatiquement les liens de traduction dans les deux sens
   */
  createBidirectionalTranslations(word: Word, userId: string): Promise<void>;

  /**
   * Ajoute une traduction manuelle entre deux mots existants
   */
  addTranslationLink(
    sourceWordId: string,
    targetWordId: string,
    userId: string
  ): Promise<void>;

  /**
   * Supprime un lien de traduction bidirectionnel
   */
  removeTranslationLink(
    sourceWordId: string,
    targetWordId: string,
    userId: string
  ): Promise<void>;

  /**
   * Récupère toutes les traductions d'un mot dans toutes les langues
   */
  getAllWordTranslations(wordId: string): Promise<{
    word: Word;
    translations: Array<{
      language: string;
      words: Word[];
      translationCount: number;
    }>;
    totalTranslations: number;
  }>;

  /**
   * Récupère les traductions d'un mot vers une langue spécifique
   */
  getTranslationsToLanguage(
    wordId: string,
    targetLanguage: string
  ): Promise<Word[]>;

  /**
   * Valide qu'une traduction proposée est appropriée
   */
  validateTranslation(
    sourceWord: Word,
    targetWord: Word,
    user: User
  ): Promise<{
    isValid: boolean;
    reason?: string;
    suggestions?: string[];
  }>;

  /**
   * Trouve des traductions potentielles basées sur des similarités
   */
  findPotentialTranslations(
    word: Word,
    targetLanguage: string
  ): Promise<Array<{
    word: Word;
    confidence: number;
    reason: string;
  }>>;

  /**
   * Met à jour les statistiques de traduction pour un mot
   */
  updateTranslationStats(wordId: string): Promise<void>;

  /**
   * Synchronise les traductions bidirectionnelles manquantes
   */
  synchronizeBidirectionalTranslations(wordId: string): Promise<{
    added: number;
    removed: number;
    errors: string[];
  }>;

  /**
   * Exporte les traductions d'un mot au format structuré
   */
  exportWordTranslations(wordId: string): Promise<{
    sourceWord: Word;
    translationMatrix: Record<string, Word[]>;
    metadata: {
      totalLanguages: number;
      totalTranslations: number;
      completenessScore: number;
    };
  }>;
}