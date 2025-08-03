/**
 * @fileoverview Interface de repository pour la gestion des mots du dictionnaire O'Ypunu
 *
 * Cette interface définit le contrat d'accès aux données pour les mots du dictionnaire
 * multilingue. Elle découple complètement la logique métier de la couche de persistance
 * en fournissant une abstraction claire pour toutes les opérations CRUD, recherches
 * avancées, statistiques et opérations en masse sur les mots.
 *
 * @author Équipe O'Ypunu  
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Types } from "mongoose";
import { Word } from "../../dictionary/schemas/word.schema";
import { CreateWordDto } from "../../dictionary/dto/create-word.dto";
import { UpdateWordDto } from "../../dictionary/dto/update-word.dto";
import { SearchWordsDto } from "../../dictionary/dto/search-words.dto";

/**
 * Interface de repository pour la gestion des mots du dictionnaire
 *
 * Cette interface abstraite définit tous les contrats d'accès aux données pour
 * les mots du dictionnaire multilingue O'Ypunu. Elle applique le pattern Repository
 * pour découpler la logique métier de la couche de persistance.
 *
 * ## 🏗️ Architecture et avantages :
 *
 * ### Testabilité maximale
 * - Mock facile pour les tests unitaires et d'intégration
 * - Isolation complète de la logique métier des détails d'implémentation
 * - Tests rapides sans dépendance base de données
 *
 * ### Flexibilité d'implémentation
 * - Changement de base de données sans impact sur les services
 * - Support multi-base (MongoDB, PostgreSQL, etc.) transparent
 * - Migration et évolution facilitées
 *
 * ### Séparation des responsabilités
 * - Services = logique métier et règles business
 * - Repository = accès données et opérations de persistance
 * - Controllers = gestion HTTP et validation
 *
 * ### Évolutivité système
 * - Ajout de cache transparent (Redis, Memcached)
 * - Sharding et réplication sans modification des services
 * - Monitoring et métriques centralisées
 *
 * ## 📋 Fonctionnalités couvertes :
 * - **CRUD de base** : Créer, lire, modifier, supprimer
 * - **Recherche avancée** : Filtres complexes, texte intégral
 * - **Statistiques** : Compteurs, analytics, exports
 * - **Relations** : Utilisateurs, catégories, traductions
 * - **Opérations masse** : Modifications groupées efficaces
 *
 * @interface IWordRepository
 * @version 1.0.0
 */
export interface IWordRepository {
  // ========== CRUD DE BASE ==========

  /**
   * Crée un nouveau mot dans le dictionnaire
   * 
   * @method create
   * @param {CreateWordDto} wordData - Données du mot à créer
   * @param {string} userId - ID de l'utilisateur créateur
   * @param {string} [status='pending'] - Statut initial du mot
   * @returns {Promise<Word>} Mot créé avec son ID généré
   * @throws {ValidationError} Si les données sont invalides
   * @throws {DuplicationError} Si le mot existe déjà dans cette langue
   */
  create(
    wordData: CreateWordDto,
    userId: string,
    status?: string
  ): Promise<Word>;

  /**
   * Récupère un mot par son identifiant unique
   * 
   * @method findById
   * @param {string} id - Identifiant MongoDB du mot
   * @returns {Promise<Word | null>} Mot trouvé ou null si inexistant
   * @throws {InvalidObjectIdError} Si l'ID a un format invalide
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
   * Recherche avancée de mots avec filtres et pagination
   * 
   * @method search
   * @param {SearchWordsDto} searchParams - Paramètres de recherche avancée
   * @returns {Promise<{words: Word[], total: number, page: number, limit: number}>} Résultats paginés
   * @example
   * ```typescript
   * const results = await repository.search({
   *   query: 'bonjour',
   *   languages: ['fr', 'en'],
   *   status: 'approved',
   *   page: 1,
   *   limit: 20
   * });
   * ```
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
   * Vérifie l'existence d'un mot dans une langue spécifique
   * 
   * @method existsByWordAndLanguage
   * @param {string} word - Terme à vérifier
   * @param {string} language - Code de langue (ex: 'fr', 'en')
   * @param {string} [languageId] - ID optionnel de la langue pour validation croisée
   * @returns {Promise<boolean>} True si le mot existe déjà
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
   * Compte le nombre de mots par statut
   * 
   * @method countByStatus
   * @param {string} status - Statut à compter ('pending', 'approved', 'rejected')
   * @returns {Promise<number>} Nombre de mots avec ce statut
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
   * Obtient les statistiques de contribution par langue pour un utilisateur
   * 
   * @method getUserLanguageStats
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array<{language: string, languageId: string, count: number, percentage: number}>>} Statistiques par langue
   * @example
   * ```typescript
   * const stats = await repository.getUserLanguageStats('user123');
   * // Résultat: [{ language: 'fr', languageId: 'lang456', count: 150, percentage: 75.0 }]
   * ```
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

  /**
   * Compter les mots avec filtres
   */
  count(filters?: {
    status?: string;
    hasAudio?: boolean;
    language?: string;
    categoryId?: string;
  }): Promise<number>;
}
