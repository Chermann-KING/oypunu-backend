import { Document } from 'mongoose';

export interface FavoriteWord extends Document {
  userId: string;
  wordId: string;
  createdAt: Date;
  notes?: string;
  tags?: string[];
  isPublic: boolean;
}

export interface FavoriteWordStats {
  totalFavorites: number;
  publicFavorites: number;
  privateFavorites: number;
  favoritesByLanguage: { [language: string]: number };
  favoritesByCategory: { [category: string]: number };
  recentActivity: {
    thisWeek: number;
    thisMonth: number;
  };
}

export interface UserFavoritesSummary {
  totalCount: number;
  languageDistribution: { [language: string]: number };
  categoryDistribution: { [category: string]: number };
  recentlyAdded: Array<{
    wordId: string;
    word: string;
    language: string;
    addedAt: Date;
  }>;
  mostViewedFavorites: Array<{
    wordId: string;
    word: string;
    viewCount: number;
  }>;
}

export interface IFavoriteWordRepository {
  /**
   * Ajouter un mot aux favoris d'un utilisateur
   */
  addToFavorites(
    userId: string,
    wordId: string,
    options?: {
      notes?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<FavoriteWord>;

  /**
   * Supprimer un mot des favoris d'un utilisateur
   */
  removeFromFavorites(userId: string, wordId: string): Promise<boolean>;

  /**
   * Vérifier si un mot est dans les favoris d'un utilisateur
   */
  isFavorite(userId: string, wordId: string): Promise<boolean>;

  /**
   * Obtenir tous les favoris d'un utilisateur avec pagination
   */
  getUserFavorites(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: 'createdAt' | 'word' | 'language';
      sortOrder?: 'asc' | 'desc';
      language?: string;
      category?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<{
    favorites: Array<FavoriteWord & {
      wordDetails: {
        id: string;
        word: string;
        language: string;
        definition: string;
        category?: string;
      };
    }>;
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Compter le nombre total de favoris d'un utilisateur
   */
  countUserFavorites(
    userId: string,
    filters?: {
      language?: string;
      category?: string;
      isPublic?: boolean;
    }
  ): Promise<number>;

  /**
   * Obtenir les statistiques des favoris d'un utilisateur
   */
  getUserFavoritesStats(userId: string): Promise<UserFavoritesSummary>;

  /**
   * Obtenir les mots les plus mis en favoris
   */
  getMostFavoritedWords(options?: {
    limit?: number;
    language?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
  }): Promise<Array<{
    wordId: string;
    word: string;
    language: string;
    favoriteCount: number;
    recentFavorites: number;
  }>>;

  /**
   * Obtenir les favoris publics d'un utilisateur
   */
  getPublicFavorites(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{
    favorites: Array<FavoriteWord & {
      wordDetails: {
        id: string;
        word: string;
        language: string;
        definition: string;
      };
    }>;
    total: number;
  }>;

  /**
   * Rechercher dans les favoris d'un utilisateur
   */
  searchUserFavorites(
    userId: string,
    query: string,
    options?: {
      page?: number;
      limit?: number;
      language?: string;
    }
  ): Promise<{
    favorites: Array<FavoriteWord & {
      wordDetails: {
        id: string;
        word: string;
        language: string;
        definition: string;
      };
    }>;
    total: number;
  }>;

  /**
   * Mettre à jour les métadonnées d'un favori
   */
  updateFavoriteMetadata(
    userId: string,
    wordId: string,
    updates: {
      notes?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<FavoriteWord | null>;

  /**
   * Obtenir les favoris par tags
   */
  getFavoritesByTags(
    userId: string,
    tags: string[],
    options?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{
    favorites: Array<FavoriteWord & {
      wordDetails: {
        id: string;
        word: string;
        language: string;
        definition: string;
      };
    }>;
    total: number;
  }>;

  /**
   * Obtenir tous les tags utilisés par un utilisateur
   */
  getUserFavoriteTags(userId: string): Promise<Array<{
    tag: string;
    count: number;
  }>>;

  /**
   * Exporter les favoris d'un utilisateur
   */
  exportUserFavorites(
    userId: string,
    format: 'json' | 'csv'
  ): Promise<string>;

  /**
   * Obtenir les statistiques globales des favoris
   */
  getGlobalFavoritesStats(): Promise<FavoriteWordStats>;

  /**
   * Alias pour getUserFavorites (pour compatibilité)
   */
  findByUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      page?: number;
      sortBy?: 'createdAt' | 'word' | 'language';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    favorites: Array<FavoriteWord & {
      wordDetails?: {
        id: string;
        word: string;
        language: string;
        definition: string;
      };
    }>;
    total: number;
  }>;

  /**
   * Compter les favoris pour un mot spécifique
   */
  countByWord(wordId: string): Promise<number>;

  /**
   * Alias pour isFavorite (pour compatibilité)
   */
  isFavorited(userId: string, wordId: string): Promise<boolean>;

  /**
   * Trouver les favoris d'un utilisateur pour une liste de mots spécifiques
   * Utilisé pour populer le statut de favori dans les listes de mots
   */
  findByUserAndWords(userId: string, wordIds: string[]): Promise<FavoriteWord[]>;
}