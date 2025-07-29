import { Injectable, Inject } from "@nestjs/common";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IWordViewRepository } from "../../repositories/interfaces/word-view.repository.interface";
import { DatabaseErrorHandler } from "../../common/utils/database-error-handler.util";

export interface SearchSuggestion {
  text: string;
  type: "word" | "category" | "recent" | "popular";
  language: string;
  frequency: number;
  metadata?: {
    wordId?: string;
    category?: string;
    partOfSpeech?: string;
  };
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters?: any;
  searchedAt: Date;
  resultsCount: number;
  clickedResults: string[];
  searchDuration?: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters?: any;
  savedAt: Date;
  lastUsed?: Date;
  useCount: number;
}

export interface TrendingSearch {
  query: string;
  searchCount: number;
  uniqueUsers: number;
  growth: number;
  category?: string;
  language: string;
}

export interface PopularTerm {
  term: string;
  frequency: number;
  language: string;
  category?: string;
  trending: boolean;
}

export interface SearchAnalytics {
  searchStats: {
    totalSearches: number;
    uniqueQueries: number;
    averageResultsPerSearch: number;
    mostSearchedTerms: Array<{
      term: string;
      count: number;
    }>;
  };
  languageDistribution: Array<{
    language: string;
    percentage: number;
    searchCount: number;
  }>;
  searchPatterns: {
    peakHours: number[];
    averageSessionLength: number;
    bounceRate: number;
  };
}

@Injectable()
export class SearchService {
  // Simuler des bases de données en mémoire pour cette démo
  private searchHistory: Map<string, SearchHistoryEntry[]> = new Map();
  private savedSearches: Map<string, SavedSearch[]> = new Map();
  private searchTracker: Array<{
    query: string;
    userId?: string;
    timestamp: Date;
    resultsCount: number;
    language?: string;
    clickedResults?: string[];
    searchDuration?: number;
  }> = [];
  private searchFeedback: Array<{
    query: string;
    userId?: string;
    rating: number;
    feedback?: string;
    timestamp: Date;
  }> = [];

  constructor(
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @Inject("IWordViewRepository")
    private wordViewRepository: IWordViewRepository
  ) {}

  async getSuggestions(
    query: string,
    options: {
      language?: string;
      limit: number;
      userId?: string;
    }
  ): Promise<{
    suggestions: SearchSuggestion[];
    query: string;
    hasMore: boolean;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const suggestions: SearchSuggestion[] = [];

        if (query.length < 2) {
          return {
            suggestions: [],
            query,
            hasMore: false,
          };
        }

        // 1. Suggestions basées sur les mots existants
        const wordSuggestions = await this.wordRepository.search({
          query,
          languages: options.language ? [options.language] : undefined,
          page: 1,
          limit: Math.floor(options.limit * 0.6),
        });

        for (const word of wordSuggestions.words) {
          suggestions.push({
            text: word.word,
            type: "word",
            language: word.language,
            frequency: word.translationCount || 0,
            metadata: {
              wordId: word._id,
              category: word.categoryId?.toString(),
              partOfSpeech: word.meanings?.[0]?.partOfSpeech,
            },
          });
        }

        // 2. Suggestions basées sur l'historique personnel (si utilisateur connecté)
        if (options.userId) {
          const userHistory = this.searchHistory.get(options.userId) || [];
          const recentQueries = userHistory
            .filter((entry) =>
              entry.query.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, Math.floor(options.limit * 0.2))
            .map((entry) => ({
              text: entry.query,
              type: "recent" as const,
              language: options.language || "all",
              frequency: entry.resultsCount,
            }));

          suggestions.push(...recentQueries);
        }

        // 3. Suggestions populaires basées sur les recherches tendances
        const popularSuggestions = this.getPopularSuggestionsFor(query, {
          limit: Math.floor(options.limit * 0.2),
          language: options.language,
        });

        suggestions.push(...popularSuggestions);

        // Trier par pertinence et fréquence
        const sortedSuggestions = suggestions
          .sort((a, b) => {
            // Priorité : correspondance exacte > début de mot > contient > fréquence
            const aExact =
              a.text.toLowerCase() === query.toLowerCase() ? 1000 : 0;
            const bExact =
              b.text.toLowerCase() === query.toLowerCase() ? 1000 : 0;

            const aStartsWith = a.text
              .toLowerCase()
              .startsWith(query.toLowerCase())
              ? 100
              : 0;
            const bStartsWith = b.text
              .toLowerCase()
              .startsWith(query.toLowerCase())
              ? 100
              : 0;

            const scoreA = aExact + aStartsWith + a.frequency;
            const scoreB = bExact + bStartsWith + b.frequency;

            return scoreB - scoreA;
          })
          .slice(0, options.limit);

        return {
          suggestions: sortedSuggestions,
          query,
          hasMore: suggestions.length > options.limit,
        };
      },
      "Search",
      `suggestions-${query}`
    );
  }

  async getSearchHistory(
    userId: string,
    options: {
      limit: number;
      language?: string;
    }
  ): Promise<{
    history: SearchHistoryEntry[];
    total: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let userHistory = this.searchHistory.get(userId) || [];

        if (options.language) {
          userHistory = userHistory.filter(
            (entry) => entry.filters?.language === options.language
          );
        }

        const sortedHistory = userHistory
          .sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime())
          .slice(0, options.limit);

        return {
          history: sortedHistory,
          total: userHistory.length,
        };
      },
      "Search",
      userId
    );
  }

  async saveSearch(
    userId: string,
    query: string,
    filters?: any,
    name?: string
  ): Promise<SavedSearch> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const savedSearch: SavedSearch = {
          id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: name || query,
          query,
          filters,
          savedAt: new Date(),
          useCount: 0,
        };

        const userSavedSearches = this.savedSearches.get(userId) || [];
        userSavedSearches.push(savedSearch);
        this.savedSearches.set(userId, userSavedSearches);

        return savedSearch;
      },
      "Search",
      userId
    );
  }

  async getSavedSearches(userId: string): Promise<{
    savedSearches: SavedSearch[];
    total: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const userSavedSearches = this.savedSearches.get(userId) || [];
        const sortedSearches = userSavedSearches.sort(
          (a, b) => b.savedAt.getTime() - a.savedAt.getTime()
        );

        return {
          savedSearches: sortedSearches,
          total: sortedSearches.length,
        };
      },
      "Search",
      userId
    );
  }

  async deleteHistoryEntry(
    userId: string,
    historyId: string
  ): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const userHistory = this.searchHistory.get(userId) || [];
        const filteredHistory = userHistory.filter(
          (entry) => entry.id !== historyId
        );
        this.searchHistory.set(userId, filteredHistory);

        return { success: true };
      },
      "Search",
      userId,
      historyId
    );
  }

  async clearSearchHistory(userId: string): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        this.searchHistory.set(userId, []);
        return { success: true };
      },
      "Search",
      userId
    );
  }

  async deleteSavedSearch(
    userId: string,
    savedSearchId: string
  ): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const userSavedSearches = this.savedSearches.get(userId) || [];
        const filteredSavedSearches = userSavedSearches.filter(
          (search) => search.id !== savedSearchId
        );
        this.savedSearches.set(userId, filteredSavedSearches);

        return { success: true };
      },
      "Search",
      userId,
      savedSearchId
    );
  }

  async getTrendingSearches(options: {
    timeframe: "hour" | "day" | "week" | "month";
    language?: string;
    limit: number;
  }): Promise<{
    trending: TrendingSearch[];
    timeframe: string;
    generatedAt: Date;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        let cutoffDate: Date;

        switch (options.timeframe) {
          case "hour":
            cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case "day":
            cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case "week":
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        // Analyser les recherches récentes
        const recentSearches = this.searchTracker.filter(
          (search) =>
            search.timestamp >= cutoffDate &&
            (!options.language || search.language === options.language)
        );

        // Grouper par requête et calculer les statistiques
        const searchGroups = new Map<
          string,
          {
            count: number;
            uniqueUsers: Set<string>;
            languages: Set<string>;
          }
        >();

        recentSearches.forEach((search) => {
          const key = search.query.toLowerCase();
          if (!searchGroups.has(key)) {
            searchGroups.set(key, {
              count: 0,
              uniqueUsers: new Set(),
              languages: new Set(),
            });
          }

          const group = searchGroups.get(key)!;
          group.count++;
          if (search.userId) {
            group.uniqueUsers.add(search.userId);
          }
          if (search.language) {
            group.languages.add(search.language);
          }
        });

        // Convertir en format de sortie et trier
        const trending: TrendingSearch[] = Array.from(searchGroups.entries())
          .map(([query, stats]) => ({
            query,
            searchCount: stats.count,
            uniqueUsers: stats.uniqueUsers.size,
            growth: this.calculateGrowth(query, options.timeframe), // Calculer la croissance
            language:
              options.language || Array.from(stats.languages)[0] || "all",
          }))
          .sort((a, b) => b.searchCount - a.searchCount)
          .slice(0, options.limit);

        return {
          trending,
          timeframe: options.timeframe,
          generatedAt: now,
        };
      },
      "Search",
      "trending"
    );
  }

  async trackSearch(
    query: string,
    resultsCount: number,
    userId?: string,
    filters?: any,
    clickedResults?: string[],
    searchDuration?: number
  ): Promise<{ tracked: boolean }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Enregistrer pour les analytics globaux
        this.searchTracker.push({
          query,
          userId,
          timestamp: new Date(),
          resultsCount,
          language: filters?.language,
          clickedResults,
          searchDuration,
        });

        // Ajouter à l'historique utilisateur si connecté
        if (userId) {
          const historyEntry: SearchHistoryEntry = {
            id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            query,
            filters,
            searchedAt: new Date(),
            resultsCount,
            clickedResults: clickedResults || [],
            searchDuration,
          };

          const userHistory = this.searchHistory.get(userId) || [];
          userHistory.unshift(historyEntry);

          // Garder seulement les 100 dernières recherches
          if (userHistory.length > 100) {
            userHistory.splice(100);
          }

          this.searchHistory.set(userId, userHistory);
        }

        return { tracked: true };
      },
      "Search",
      userId || "anonymous"
    );
  }

  async getPopularTerms(options: {
    language?: string;
    category?: string;
    limit: number;
  }): Promise<{
    popularTerms: PopularTerm[];
    total: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Analyser les recherches pour identifier les termes populaires
        const termCounts = new Map<
          string,
          {
            count: number;
            languages: Set<string>;
            recent: boolean;
          }
        >();

        this.searchTracker.forEach((search) => {
          const query = search.query.toLowerCase();
          if (!options.language || search.language === options.language) {
            if (!termCounts.has(query)) {
              termCounts.set(query, {
                count: 0,
                languages: new Set(),
                recent: false,
              });
            }

            const term = termCounts.get(query)!;
            term.count++;
            if (search.language) {
              term.languages.add(search.language);
            }

            // Marquer comme récent si dans les dernières 24h
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            if (search.timestamp >= dayAgo) {
              term.recent = true;
            }
          }
        });

        const popularTerms: PopularTerm[] = Array.from(termCounts.entries())
          .map(([term, stats]) => ({
            term,
            frequency: stats.count,
            language:
              options.language || Array.from(stats.languages)[0] || "all",
            trending: stats.recent && stats.count > 1,
          }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, options.limit);

        return {
          popularTerms,
          total: termCounts.size,
        };
      },
      "Search",
      "popular-terms"
    );
  }

  async getSearchAnalytics(
    userId: string,
    timeframe: "week" | "month" | "quarter" | "year"
  ): Promise<SearchAnalytics> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const userHistory = this.searchHistory.get(userId) || [];
        const cutoffDate = this.getCutoffDate(timeframe);

        const relevantHistory = userHistory.filter(
          (entry) => entry.searchedAt >= cutoffDate
        );

        // Calculer les statistiques
        const totalSearches = relevantHistory.length;
        const uniqueQueries = new Set(
          relevantHistory.map((h) => h.query.toLowerCase())
        ).size;
        const averageResultsPerSearch =
          relevantHistory.length > 0
            ? relevantHistory.reduce((sum, h) => sum + h.resultsCount, 0) /
              relevantHistory.length
            : 0;

        // Termes les plus recherchés
        const termCounts = new Map<string, number>();
        relevantHistory.forEach((entry) => {
          const term = entry.query.toLowerCase();
          termCounts.set(term, (termCounts.get(term) || 0) + 1);
        });

        const mostSearchedTerms = Array.from(termCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([term, count]) => ({ term, count }));

        // Distribution par langue
        const languageCounts = new Map<string, number>();
        relevantHistory.forEach((entry) => {
          const lang = entry.filters?.language || "all";
          languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
        });

        const languageDistribution = Array.from(languageCounts.entries()).map(
          ([language, count]) => ({
            language,
            searchCount: count,
            percentage: Math.round((count / totalSearches) * 100 * 100) / 100,
          })
        );

        // Patterns de recherche
        const hourCounts = new Array(24).fill(0);
        relevantHistory.forEach((entry) => {
          const hour = entry.searchedAt.getHours();
          hourCounts[hour]++;
        });

        const peakHours = hourCounts
          .map((count, hour) => ({ hour, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((item) => item.hour);

        return {
          searchStats: {
            totalSearches,
            uniqueQueries,
            averageResultsPerSearch:
              Math.round(averageResultsPerSearch * 100) / 100,
            mostSearchedTerms,
          },
          languageDistribution,
          searchPatterns: {
            peakHours,
            averageSessionLength: 8.5, // TODO: Calculer réellement
            bounceRate: 0.34, // TODO: Calculer réellement
          },
        };
      },
      "Search",
      userId
    );
  }

  async submitSearchFeedback(
    query: string,
    rating: number,
    userId?: string,
    searchId?: string,
    feedback?: string,
    relevantResults?: string[],
    irrelevantResults?: string[]
  ): Promise<{ success: boolean; message: string }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        this.searchFeedback.push({
          query,
          userId,
          rating,
          feedback,
          timestamp: new Date(),
        });

        // TODO: Utiliser le feedback pour améliorer l'algorithme de recherche

        return {
          success: true,
          message:
            "Thank you for your feedback! It helps us improve search results.",
        };
      },
      "Search",
      userId || "anonymous"
    );
  }

  private getPopularSuggestionsFor(
    query: string,
    options: {
      limit: number;
      language?: string;
    }
  ): SearchSuggestion[] {
    // Analyser les recherches récentes pour des suggestions populaires
    const recentSearches = this.searchTracker
      .filter(
        (search) =>
          search.query.toLowerCase().includes(query.toLowerCase()) &&
          (!options.language || search.language === options.language)
      )
      .slice(0, options.limit);

    return recentSearches.map((search) => ({
      text: search.query,
      type: "popular" as const,
      language: search.language || "all",
      frequency: search.resultsCount,
    }));
  }

  private calculateGrowth(query: string, timeframe: string): number {
    // Calculer la croissance par rapport à la période précédente
    // Implémentation simplifiée - retourner une valeur aléatoire pour la démo
    return Math.round((Math.random() - 0.5) * 100 * 100) / 100;
  }

  private getCutoffDate(
    timeframe: "week" | "month" | "quarter" | "year"
  ): Date {
    const now = new Date();
    switch (timeframe) {
      case "week":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "month":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "quarter":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case "year":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
  }
}
