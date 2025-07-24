import { WordView } from '../../users/schemas/word-view.schema';

export interface CreateWordViewData {
  userId: string;
  wordId: string;
  word: string;
  language: string;
  viewType?: 'search' | 'detail' | 'favorite';
  sessionId?: string;
  metadata?: {
    searchQuery?: string;
    category?: string;
    referrer?: string;
  };
}

export interface UpdateWordViewData {
  viewCount?: number;
  lastViewedAt?: Date;
  viewType?: 'search' | 'detail' | 'favorite';
  metadata?: {
    searchQuery?: string;
    category?: string;
    referrer?: string;
  };
}

/**
 * 👁️ INTERFACE WORD VIEW REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des vues de mots.
 * Gestion du tracking des consultations et analytics utilisateurs.
 */
export interface IWordViewRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle vue de mot
   */
  create(viewData: CreateWordViewData): Promise<WordView>;
  
  /**
   * Récupérer une vue par ID
   */
  findById(id: string): Promise<WordView | null>;
  
  /**
   * Mettre à jour une vue
   */
  update(id: string, updateData: UpdateWordViewData): Promise<WordView | null>;
  
  /**
   * Supprimer une vue
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Récupérer les vues d'un utilisateur
   */
  findByUser(userId: string, options?: {
    page?: number;
    limit?: number;
    sortBy?: 'viewedAt' | 'viewCount' | 'word';
    sortOrder?: 'asc' | 'desc';
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
  }): Promise<{
    views: WordView[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Récupérer les vues d'un mot
   */
  findByWord(wordId: string, options?: {
    page?: number;
    limit?: number;
    userId?: string;
    viewType?: 'search' | 'detail' | 'favorite';
  }): Promise<{
    views: WordView[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Récupérer une vue spécifique utilisateur-mot
   */
  findByUserAndWord(userId: string, wordId: string): Promise<WordView | null>;
  
  /**
   * Récupérer les vues récentes d'un utilisateur
   */
  findRecentByUser(userId: string, limit?: number): Promise<WordView[]>;
  
  /**
   * Rechercher des vues par mot
   */
  searchByWord(wordQuery: string, options?: {
    userId?: string;
    language?: string;
    limit?: number;
  }): Promise<WordView[]>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les vues d'un utilisateur
   */
  countByUser(userId: string, options?: {
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;
  
  /**
   * Compter les vues d'un mot
   */
  countByWord(wordId: string, options?: {
    uniqueUsers?: boolean;
    viewType?: 'search' | 'detail' | 'favorite';
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;
  
  /**
   * Compter les vues totales
   */
  countTotal(options?: {
    uniqueUsers?: boolean;
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
    startDate?: Date;
    endDate?: Date;
  }): Promise<number>;
  
  /**
   * Obtenir les mots les plus vus
   */
  getMostViewedWords(options?: {
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  }): Promise<Array<{
    wordId: string;
    word: string;
    language: string;
    viewCount: number;
    uniqueUsers: number;
  }>>;
  
  /**
   * Obtenir les utilisateurs les plus actifs
   */
  getMostActiveUsers(options?: {
    language?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  }): Promise<Array<{
    userId: string;
    viewCount: number;
    uniqueWords: number;
    lastActivity: Date;
  }>>;
  
  // ========== ANALYTICS ==========
  
  /**
   * Obtenir les statistiques d'activité d'un utilisateur
   */
  getUserActivityStats(userId: string): Promise<{
    totalViews: number;
    uniqueWords: number;
    languagesViewed: string[];
    favoriteLanguage: string;
    averageViewsPerDay: number;
    mostViewedWords: Array<{
      wordId: string;
      word: string;
      viewCount: number;
    }>;
    activityByType: {
      search: number;
      detail: number;
      favorite: number;
    };
  }>;
  
  /**
   * Obtenir les statistiques globales des vues
   */
  getGlobalStats(): Promise<{
    totalViews: number;
    uniqueUsers: number;
    uniqueWords: number;
    averageViewsPerUser: number;
    averageViewsPerWord: number;
    topLanguages: Array<{
      language: string;
      viewCount: number;
      uniqueUsers: number;
    }>;
    viewsByType: {
      search: number;
      detail: number;
      favorite: number;
    };
  }>;
  
  // ========== NETTOYAGE ==========
  
  /**
   * Supprimer les anciennes vues (plus de X jours)
   */
  deleteOldViews(daysOld: number): Promise<{ deletedCount: number }>;
  
  /**
   * Nettoyer les vues orphelines (mots ou utilisateurs supprimés)
   */
  cleanupOrphanedViews(): Promise<{ deletedCount: number }>;
  
  /**
   * Archiver les vues anciennes (marquer comme archivées)
   */
  archiveOldViews(daysOld: number): Promise<{ archivedCount: number }>;
}