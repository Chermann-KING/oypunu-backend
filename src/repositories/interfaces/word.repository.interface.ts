import { Types } from "mongoose";
import { Word } from "../../dictionary/schemas/word.schema";
import { CreateWordDto } from "../../dictionary/dto/create-word.dto";
import { UpdateWordDto } from "../../dictionary/dto/update-word.dto";
import { SearchWordsDto } from "../../dictionary/dto/search-words.dto";

/**
 * 📚 INTERFACE WORD REPOSITORY
 *
 * Contrat abstrait pour l'accès aux données des mots.
 * Découple complètement les services de la couche de persistance.
 *
 * Avantages :
 * ✅ Testabilité : Mock facile pour les tests unitaires
 * ✅ Flexibilité : Changer de DB sans impact sur les services
 * ✅ Séparation responsabilités : Services = logique métier, Repository = accès données
 * ✅ Évolutivité : Ajouter cache, multi-DB, etc. sans casser les services
 */
export interface IWordRepository {
  // ========== CRUD DE BASE ==========

  /**
   * Créer un nouveau mot
   */
  create(
    wordData: CreateWordDto,
    userId: string,
    status?: string
  ): Promise<Word>;

  /**
   * Récupérer un mot par ID
   */
  findById(id: string): Promise<Word | null>;

  /**
   * Récupérer tous les mots avec pagination
   */
  findAll(options: {
    page?: number;
    limit?: number;
    status?: string;
    language?: string;
    categoryId?: string;
  }): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Mettre à jour un mot
   */
  update(id: string, updateData: UpdateWordDto): Promise<Word | null>;

  /**
   * Supprimer un mot
   */
  delete(id: string): Promise<boolean>;

  // ========== RECHERCHE AVANCÉE ==========

  /**
   * Rechercher des mots avec filtres complexes
   */
  search(searchParams: SearchWordsDto): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Trouver un mot par ID de traduction
   */
  findByTranslationId(translationId: string): Promise<Word | null>;

  /**
   * Vérifier si un mot existe déjà
   */
  existsByWordAndLanguage(
    word: string,
    language: string,
    languageId?: string
  ): Promise<boolean>;

  /**
   * Récupérer mots par statut
   */
  findByStatus(
    status: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Word[]>;

  /**
   * Récupérer mots vedettes
   */
  findFeatured(limit?: number): Promise<Word[]>;

  /**
   * Récupérer mots aléatoires avec utilisateur populé
   */
  findRandomWithCreatedBy(limit?: number): Promise<Word[]>;

  // ========== STATISTIQUES ==========

  /**
   * Compter mots par statut
   */
  countByStatus(status: string): Promise<number>;

  /**
   * Compter mots ajoutés aujourd'hui
   */
  countAddedToday(): Promise<number>;

  /**
   * Compter les mots créés par un utilisateur
   */
  countByUser(userId: string): Promise<number>;

  /**
   * Compter les mots par utilisateur et statut
   */
  countByUserAndStatus(userId: string, status: string): Promise<number>;

  /**
   * Compter les mots par plage de dates
   */
  countByDateRange(startDate: Date, endDate: Date): Promise<number>;

  /**
   * Compter les mots par utilisateur et plage de dates
   */
  countByUserAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number>;

  /**
   * Compter les mots par créateur et statut (alias pour compatibilité)
   */
  countByCreatorAndStatus(creatorId: string, status: string): Promise<number>;

  /**
   * Obtenir les statistiques linguistiques d'un utilisateur
   */
  getUserLanguageStats(userId: string): Promise<
    Array<{
      language: string;
      languageId: string;
      count: number;
      percentage: number;
    }>
  >;

  /**
   * Obtenir les statistiques linguistiques par plage de dates
   */
  getLanguageStatsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      language: string;
      languageId: string;
      currentCount: number;
      previousCount: number;
      growth: number;
      growthPercentage: number;
    }>
  >;

  /**
   * Exporter les données des mots
   */
  exportData(
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      _id: string;
      word: string;
      language: string;
      languageId: string;
      status: string;
      createdBy: string;
      createdAt: Date;
      meanings: any[];
      pronunciations: any[];
      categoryId: string;
      viewCount: number;
      translationCount: number;
    }>
  >;

  /**
   * Langues disponibles avec compteurs
   */
  getAvailableLanguages(): Promise<
    Array<{
      language: string;
      count: number;
      languageId?: string;
    }>
  >;

  /**
   * Statistiques générales des mots
   */
  getWordsStatistics(): Promise<{
    totalWords: number;
    approvedWords: number;
    pendingWords: number;
    rejectedWords: number;
    wordsByLanguage: Array<{ language: string; count: number }>;
  }>;

  // ========== RELATIONS ==========

  /**
   * Récupérer mots d'un utilisateur
   */
  findByUserId(
    userId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Word[]>;

  /**
   * Récupérer mots créés par un utilisateur (alias pour compatibilité)
   */
  findByCreator(
    creatorId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Word[]>;

  /**
   * Obtenir les langues distinctes utilisées par un créateur
   */
  getDistinctLanguagesByCreator(creatorId: string): Promise<string[]>;

  /**
   * Récupérer mots d'une catégorie
   */
  findByCategoryId(
    categoryId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<Word[]>;

  /**
   * Mettre à jour le statut d'un mot
   */
  updateStatus(
    id: string,
    status: string,
    adminId?: string
  ): Promise<Word | null>;

  /**
   * Incrémenter le compteur de vues
   */
  incrementViewCount(id: string): Promise<void>;

  /**
   * Mettre à jour le compteur de traductions
   */
  updateTranslationCount(id: string, count: number): Promise<void>;

  // ========== OPÉRATIONS EN MASSE ==========

  /**
   * Supprimer plusieurs mots par IDs
   */
  deleteMany(ids: string[]): Promise<number>;

  /**
   * Mettre à jour le statut de plusieurs mots
   */
  updateManyStatus(
    ids: string[],
    status: string,
    adminId?: string
  ): Promise<number>;

  /**
   * Recherche textuelle full-text
   */
  searchByText(
    query: string,
    options?: {
      languages?: string[];
      limit?: number;
      offset?: number;
    }
  ): Promise<Word[]>;

  // ========== MÉTHODES POUR TRANSLATIONS ==========

  /**
   * Trouver un mot par l'ID d'une de ses traductions
   */
  findByTranslationId(translationId: string): Promise<Word | null>;

  /**
   * Trouver des mots par ID de groupe de traduction
   */
  findByTranslationGroupId(groupId: string): Promise<Word[]>;

  /**
   * Récupérer un mot avec ses traductions populées (utilisateurs)
   */
  findByIdWithTranslations(wordId: string): Promise<Word | null>;

  /**
   * Trouver des mots par catégorie et langue pour suggestions de traduction
   */
  findByCategoryAndLanguage(
    categoryId: string,
    language: string,
    status: string,
    excludeIds: string[],
    limit: number
  ): Promise<Word[]>;

  // ========== MÉTHODES POUR STATISTIQUES SOCIALES ==========

  /**
   * Compter le nombre de traductions d'un mot
   */
  countTranslations(wordId: string): Promise<number>;

  /**
   * Compter le nombre de références d'un mot
   */
  countReferences(wordId: string): Promise<number>;
}
