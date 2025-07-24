import { Injectable, Inject } from '@nestjs/common';
import { IWordRepository } from '../../repositories/interfaces/word.repository.interface';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { IWordViewRepository } from '../../repositories/interfaces/word-view.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

export interface DashboardMetrics {
  overview: {
    totalWords: number;
    totalUsers: number;
    totalViews: number;
    pendingWords: number;
  };
  wordsByLanguage: Array<{
    language: string;
    count: number;
    percentage: number;
  }>;
  recentActivity: {
    wordsAddedToday: number;
    wordsAddedThisWeek: number;
    wordsAddedThisMonth: number;
    usersJoinedToday: number;
  };
  topContributors: Array<{
    userId: string;
    username: string;
    contributionCount: number;
    lastContribution: Date;
  }>;
}

export interface UserActivityStats {
  user: {
    id: string;
    username: string;
    role: string;
    joinDate: Date;
  };
  contributions: {
    totalWords: number;
    approvedWords: number;
    pendingWords: number;
    rejectedWords: number;
  };
  activity: {
    totalViews: number;
    uniqueWordsViewed: number;
    averageViewsPerDay: number;
    lastActivity: Date;
  };
  languagePreferences: Array<{
    language: string;
    wordCount: number;
    viewCount: number;
  }>;
}

export interface LanguageTrends {
  trends: Array<{
    language: string;
    currentPeriod: number;
    previousPeriod: number;
    growth: number;
    growthPercentage: number;
  }>;
  timeframe: string;
  generatedAt: Date;
}

export interface MostSearchedWords {
  words: Array<{
    wordId: string;
    word: string;
    language: string;
    searchCount: number;
    uniqueUsers: number;
    lastSearched: Date;
  }>;
  totalSearches: number;
  timeframe: string;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  type: 'dashboard' | 'users' | 'words' | 'activity';
  startDate?: Date;
  endDate?: Date;
}

export interface PerformanceMetrics {
  database: {
    avgResponseTime: number;
    slowQueries: number;
    connectionCount: number;
  };
  api: {
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
  };
  storage: {
    totalAudioFiles: number;
    totalStorageUsed: string;
    avgFileSize: number;
  };
}

export interface UserEngagementMetrics {
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  engagement: {
    avgSessionDuration: number;
    avgWordsViewedPerSession: number;
    bounceRate: number;
    returnUserRate: number;
  };
  features: {
    searchUsage: number;
    favoriteUsage: number;
    audioPlaybacks: number;
    shareActions: number;
  };
}

export interface UserPersonalStats {
  profile: {
    username: string;
    joinDate: Date;
    role: string;
  };
  contributions: {
    totalWords: number;
    approvedWords: number;
    wordsThisMonth: number;
    rank: number;
  };
  activity: {
    totalViews: number;
    uniqueWords: number;
    streakDays: number;
    favoriteWords: number;
  };
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: Date;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject('IWordRepository') private wordRepository: IWordRepository,
    @Inject('IUserRepository') private userRepository: IUserRepository,
    @Inject('IWordViewRepository') private wordViewRepository: IWordViewRepository,
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Métriques overview
        const [totalWords, totalUsers, totalViews, pendingWords] = await Promise.all([
          this.wordRepository.countByStatus('approved'),
          this.userRepository.countTotal(),
          this.wordViewRepository.countTotal(),
          this.wordRepository.countByStatus('pending'),
        ]);

        // Répartition par langue
        const languageStats = await this.wordRepository.getAvailableLanguages();
        const totalApprovedWords = totalWords;
        const wordsByLanguage = languageStats.map(stat => ({
          language: stat.language,
          count: stat.count,
          percentage: Math.round((stat.count / totalApprovedWords) * 100 * 100) / 100,
        }));

        // Activité récente
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [wordsAddedToday, wordsAddedThisWeek, wordsAddedThisMonth, usersJoinedToday] = await Promise.all([
          this.wordRepository.countByDateRange(today, now),
          this.wordRepository.countByDateRange(weekAgo, now),
          this.wordRepository.countByDateRange(monthAgo, now),
          this.userRepository.countByDateRange(today, now),
        ]);

        // Top contributeurs
        const topContributors = await this.userRepository.getTopContributors(5);

        return {
          overview: {
            totalWords,
            totalUsers,
            totalViews,
            pendingWords,
          },
          wordsByLanguage,
          recentActivity: {
            wordsAddedToday,
            wordsAddedThisWeek,
            wordsAddedThisMonth,
            usersJoinedToday,
          },
          topContributors: topContributors.map(contributor => ({
            userId: contributor.userId,
            username: contributor.username,
            contributionCount: contributor.wordCount,
            lastContribution: contributor.lastContribution,
          })),
        };
      },
      'Analytics',
      'dashboard',
    );
  }

  async getUserActivityStats(userId: string): Promise<UserActivityStats> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Informations utilisateur
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        // Statistiques des contributions
        const [totalWords, approvedWords, pendingWords, rejectedWords] = await Promise.all([
          this.wordRepository.countByUser(userId),
          this.wordRepository.countByUserAndStatus(userId, 'approved'),
          this.wordRepository.countByUserAndStatus(userId, 'pending'),
          this.wordRepository.countByUserAndStatus(userId, 'rejected'),
        ]);

        // Statistiques d'activité
        const userActivityStats = await this.wordViewRepository.getUserActivityStats(userId);

        // Préférences linguistiques
        const languagePreferences = await this.wordRepository.getUserLanguageStats(userId);

        return {
          user: {
            id: userId,
            username: user.username,
            role: user.role,
            joinDate: user.createdAt,
          },
          contributions: {
            totalWords,
            approvedWords,
            pendingWords,
            rejectedWords,
          },
          activity: {
            totalViews: userActivityStats.totalViews,
            uniqueWordsViewed: userActivityStats.uniqueWords,
            averageViewsPerDay: userActivityStats.averageViewsPerDay,
            lastActivity: new Date(), // TODO: Implémenter le tracking de dernière activité
          },
          languagePreferences: languagePreferences.map(pref => ({
            language: pref.language,
            wordCount: pref.wordCount,
            viewCount: pref.viewCount || 0,
          })),
        };
      },
      'Analytics',
      userId,
    );
  }

  async getLanguageTrends(timeframe: 'week' | 'month' | 'quarter' | 'year'): Promise<LanguageTrends> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        let currentPeriodStart: Date;
        let previousPeriodStart: Date;

        switch (timeframe) {
          case 'week':
            currentPeriodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            previousPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            break;
          case 'quarter':
            currentPeriodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            previousPeriodStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            currentPeriodStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            previousPeriodStart = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
            break;
        }

        const [currentStats, previousStats] = await Promise.all([
          this.wordRepository.getLanguageStatsByDateRange(currentPeriodStart, now),
          this.wordRepository.getLanguageStatsByDateRange(previousPeriodStart, currentPeriodStart),
        ]);

        const trends = currentStats.map(current => {
          const previous = previousStats.find(p => p.language === current.language);
          const previousCount = previous?.count || 0;
          const growth = current.count - previousCount;
          const growthPercentage = previousCount > 0 ? (growth / previousCount) * 100 : 100;

          return {
            language: current.language,
            currentPeriod: current.count,
            previousPeriod: previousCount,
            growth,
            growthPercentage: Math.round(growthPercentage * 100) / 100,
          };
        });

        return {
          trends,
          timeframe,
          generatedAt: now,
        };
      },
      'Analytics',
      `trends-${timeframe}`,
    );
  }

  async getMostSearchedWords(options: {
    limit: number;
    language?: string;
    timeframe: 'day' | 'week' | 'month' | 'all';
  }): Promise<MostSearchedWords> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const mostViewed = await this.wordViewRepository.getMostViewedWords({
          language: options.language,
          timeframe: options.timeframe,
          limit: options.limit,
          viewType: 'search',
        });

        const totalSearches = await this.wordViewRepository.countTotal({
          language: options.language,
          viewType: 'search',
          ...(options.timeframe !== 'all' && {
            startDate: this.getDateByTimeframe(options.timeframe),
          }),
        });

        return {
          words: mostViewed.map(word => ({
            wordId: word.wordId,
            word: word.word,
            language: word.language,
            searchCount: word.viewCount,
            uniqueUsers: word.uniqueUsers,
            lastSearched: new Date(), // TODO: Ajouter timestamp de dernière recherche
          })),
          totalSearches,
          timeframe: options.timeframe,
        };
      },
      'Analytics',
      'most-searched',
    );
  }

  async exportData(options: ExportOptions): Promise<any> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        let data: any;

        switch (options.type) {
          case 'dashboard':
            data = await this.getDashboardMetrics();
            break;
          case 'users':
            data = await this.userRepository.exportData(options.startDate, options.endDate);
            break;
          case 'words':
            data = await this.wordRepository.exportData(options.startDate, options.endDate);
            break;
          case 'activity':
            data = await this.wordViewRepository.exportData(options.startDate, options.endDate);
            break;
        }

        if (options.format === 'csv') {
          return this.convertToCSV(data);
        }

        return data;
      },
      'Analytics',
      `export-${options.type}`,
    );
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // TODO: Implémenter la collecte de métriques de performance réelles
        // Pour l'instant, retourner des données mockées
        return {
          database: {
            avgResponseTime: 45.6,
            slowQueries: 3,
            connectionCount: 12,
          },
          api: {
            requestsPerMinute: 156,
            avgResponseTime: 234.5,
            errorRate: 0.8,
          },
          storage: {
            totalAudioFiles: 1250,
            totalStorageUsed: '2.4 GB',
            avgFileSize: 1.92,
          },
        };
      },
      'Analytics',
      'performance',
    );
  }

  async getUserEngagementMetrics(timeframe: 'day' | 'week' | 'month'): Promise<UserEngagementMetrics> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const startDate = this.getDateByTimeframe(timeframe);
        const now = new Date();

        // Utilisateurs actifs
        const [dailyActive, weeklyActive, monthlyActive] = await Promise.all([
          this.userRepository.countActiveUsers(1),
          this.userRepository.countActiveUsers(7),
          this.userRepository.countActiveUsers(30),
        ]);

        // Métriques d'engagement
        const globalStats = await this.wordViewRepository.getGlobalStats();

        // TODO: Implémenter le calcul des métriques d'engagement détaillées
        return {
          activeUsers: {
            daily: dailyActive,
            weekly: weeklyActive,
            monthly: monthlyActive,
          },
          engagement: {
            avgSessionDuration: 8.5, // minutes
            avgWordsViewedPerSession: globalStats.averageViewsPerUser,
            bounceRate: 34.2, // pourcentage
            returnUserRate: 67.8, // pourcentage
          },
          features: {
            searchUsage: 85.4, // pourcentage d'utilisateurs qui utilisent la recherche
            favoriteUsage: 42.7, // pourcentage d'utilisateurs qui utilisent les favoris
            audioPlaybacks: 28.9, // pourcentage de lectures audio
            shareActions: 15.6, // pourcentage d'actions de partage
          },
        };
      },
      'Analytics',
      `engagement-${timeframe}`,
    );
  }

  async getUserPersonalStats(userId: string): Promise<UserPersonalStats> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error('Utilisateur non trouvé');
        }

        const [totalWords, approvedWords, wordsThisMonth] = await Promise.all([
          this.wordRepository.countByUser(userId),
          this.wordRepository.countByUserAndStatus(userId, 'approved'),
          this.wordRepository.countByUserAndDateRange(
            userId,
            new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000),
            new Date(),
          ),
        ]);

        const userActivityStats = await this.wordViewRepository.getUserActivityStats(userId);
        const rank = await this.userRepository.getUserRank(userId);

        return {
          profile: {
            username: user.username,
            joinDate: user.createdAt,
            role: user.role,
          },
          contributions: {
            totalWords,
            approvedWords,
            wordsThisMonth,
            rank,
          },
          activity: {
            totalViews: userActivityStats.totalViews,
            uniqueWords: userActivityStats.uniqueWords,
            streakDays: 0, // TODO: Implémenter le calcul de streak
            favoriteWords: 0, // TODO: Compter les mots favoris
          },
          achievements: [], // TODO: Implémenter le système d'achievements
        };
      },
      'Analytics',
      userId,
    );
  }

  private getDateByTimeframe(timeframe: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private convertToCSV(data: any): string {
    // Implémentation basique de conversion CSV
    // TODO: Implémenter une conversion CSV plus robuste
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const csvHeaders = headers.join(',');
      const csvRows = data.map(row => 
        headers.map(header => JSON.stringify(row[header] || '')).join(',')
      );
      return [csvHeaders, ...csvRows].join('\n');
    }
    
    return JSON.stringify(data, null, 2);
  }
}