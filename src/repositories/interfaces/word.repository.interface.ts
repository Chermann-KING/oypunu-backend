import { Types } from 'mongoose';
import { Word } from '../../dictionary/schemas/word.schema';
import { CreateWordDto } from '../../dictionary/dto/create-word.dto';
import { UpdateWordDto } from '../../dictionary/dto/update-word.dto';
import { SearchWordsDto } from '../../dictionary/dto/search-words.dto';

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
  create(wordData: CreateWordDto, userId: string, status?: string): Promise<Word>;
  
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
   * Vérifier si un mot existe déjà
   */
  existsByWordAndLanguage(word: string, language: string, languageId?: string): Promise<boolean>;
  
  /**
   * Récupérer mots par statut
   */
  findByStatus(status: string, options?: { limit?: number; offset?: number }): Promise<Word[]>;
  
  /**
   * Récupérer mots vedettes
   */
  findFeatured(limit?: number): Promise<Word[]>;
  
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
   * Langues disponibles avec compteurs
   */
  getAvailableLanguages(): Promise<Array<{ 
    language: string; 
    count: number; 
    languageId?: string 
  }>>;
  
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
  findByUserId(userId: string, options?: { 
    status?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<Word[]>;
  
  /**
   * Récupérer mots d'une catégorie
   */
  findByCategoryId(categoryId: string, options?: { 
    limit?: number; 
    offset?: number 
  }): Promise<Word[]>;
  
  /**
   * Mettre à jour le statut d'un mot
   */
  updateStatus(id: string, status: string, adminId?: string): Promise<Word | null>;
  
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
  updateManyStatus(ids: string[], status: string, adminId?: string): Promise<number>;
  
  /**
   * Recherche textuelle full-text
   */
  searchByText(query: string, options?: {
    languages?: string[];
    limit?: number;
    offset?: number;
  }): Promise<Word[]>;
}