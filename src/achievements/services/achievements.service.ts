import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { IWordRepository } from '../../repositories/interfaces/word.repository.interface';
import { IWordViewRepository } from '../../repositories/interfaces/word-view.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: 'contribution' | 'social' | 'learning' | 'milestone' | 'special';
  difficulty: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  icon: string;
  points: number;
  requirements: {
    type: string;
    target: number;
    conditions?: string[];
  };
  rarity: number; // Pourcentage d'utilisateurs qui l'ont (0-100)
}

export interface UserAchievement extends Achievement {
  isUnlocked: boolean;
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
  unlockedAt?: Date;
}

@Injectable()
export class AchievementsService {
  // Base de données des achievements en mémoire pour cette démo
  private achievements: Map<string, Achievement> = new Map();
  private userAchievements: Map<string, Map<string, { unlockedAt: Date; progress: number }>> = new Map();

  constructor(
    @Inject('IUserRepository') private userRepository: IUserRepository,
    @Inject('IWordRepository') private wordRepository: IWordRepository,
    @Inject('IWordViewRepository') private wordViewRepository: IWordViewRepository,
  ) {
    this.initializeAchievements();
  }

  private initializeAchievements() {
    // Achievements de contribution
    this.achievements.set('first-word', {
      id: 'first-word',
      name: 'Premier Pas',
      description: 'Ajouter votre premier mot au dictionnaire',
      category: 'contribution',
      difficulty: 'bronze',
      icon: '🎯',
      points: 10,
      requirements: { type: 'words_created', target: 1 },
      rarity: 85.2,
    });

    this.achievements.set('word-master', {
      id: 'word-master',
      name: 'Maître des Mots',
      description: 'Créer 100 mots approuvés',
      category: 'contribution',
      difficulty: 'gold',
      icon: '👑',
      points: 500,
      requirements: { type: 'approved_words', target: 100 },
      rarity: 2.1,
    });

    this.achievements.set('linguist', {
      id: 'linguist',
      name: 'Polyglotte',
      description: 'Contribuer dans 5 langues différentes',
      category: 'contribution',
      difficulty: 'platinum',
      icon: '🌍',
      points: 750,
      requirements: { type: 'languages_contributed', target: 5 },
      rarity: 0.8,
    });

    // Achievements sociaux
    this.achievements.set('social-butterfly', {
      id: 'social-butterfly',
      name: 'Papillon Social',
      description: 'Recevoir 50 likes sur vos mots',
      category: 'social',
      difficulty: 'silver',
      icon: '🦋',
      points: 100,
      requirements: { type: 'likes_received', target: 50 },
      rarity: 15.7,
    });

    this.achievements.set('helpful', {
      id: 'helpful',
      name: 'Aide Précieuse',
      description: 'Écrire 25 commentaires utiles',
      category: 'social',
      difficulty: 'silver',
      icon: '🤝',
      points: 75,
      requirements: { type: 'helpful_comments', target: 25 },
      rarity: 12.3,
    });

    // Achievements d'apprentissage
    this.achievements.set('curious', {
      id: 'curious',
      name: 'Curieux',
      description: 'Consulter 500 mots différents',
      category: 'learning',
      difficulty: 'bronze',
      icon: '🔍',
      points: 50,
      requirements: { type: 'words_viewed', target: 500 },
      rarity: 35.4,
    });

    this.achievements.set('scholar', {
      id: 'scholar',
      name: 'Érudit',
      description: 'Consulter 5000 mots différents',
      category: 'learning',
      difficulty: 'diamond',
      icon: '📚',
      points: 1000,
      requirements: { type: 'words_viewed', target: 5000 },
      rarity: 0.3,
    });

    // Achievements jalons
    this.achievements.set('veteran', {
      id: 'veteran',
      name: 'Vétéran',
      description: 'Membre depuis 1 an',
      category: 'milestone',
      difficulty: 'gold',
      icon: '🏆',
      points: 200,
      requirements: { type: 'days_active', target: 365 },
      rarity: 8.9,
    });

    // Achievements spéciaux
    this.achievements.set('early-bird', {
      id: 'early-bird',
      name: 'Lève-tôt',
      description: 'Parmi les 100 premiers utilisateurs',
      category: 'special',
      difficulty: 'diamond',
      icon: '🌅',
      points: 1500,
      requirements: { type: 'early_adopter', target: 100 },
      rarity: 0.1,
    });
  }

  async getAllAchievements(
    userId?: string,
    filters?: {
      category?: 'contribution' | 'social' | 'learning' | 'milestone' | 'special';
      difficulty?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    }
  ): Promise<{
    achievements: UserAchievement[];
    userStats?: {
      totalAchievements: number;
      unlockedAchievements: number;
      totalPoints: number;
      level: number;
      nextLevelPoints: number;
    };
    categories: Array<{
      name: string;
      total: number;
      unlocked: number;
      points: number;
    }>;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let filteredAchievements = Array.from(this.achievements.values());

        // Appliquer les filtres
        if (filters?.category) {
          filteredAchievements = filteredAchievements.filter(a => a.category === filters.category);
        }
        if (filters?.difficulty) {
          filteredAchievements = filteredAchievements.filter(a => a.difficulty === filters.difficulty);
        }

        let userStats;
        const userAchievementData = userId ? this.userAchievements.get(userId) : null;

        // Enrichir avec les données utilisateur si connecté
        const enrichedAchievements: UserAchievement[] = await Promise.all(
          filteredAchievements.map(async (achievement) => {
            let isUnlocked = false;
            let unlockedAt: Date | undefined;
            let progress: { current: number; target: number; percentage: number } | undefined;

            if (userId) {
              const userAchievement = userAchievementData?.get(achievement.id);
              isUnlocked = !!userAchievement;
              unlockedAt = userAchievement?.unlockedAt;

              if (!isUnlocked) {
                // Calculer le progrès actuel
                const current = await this.calculateProgress(userId, achievement);
                progress = {
                  current,
                  target: achievement.requirements.target,
                  percentage: Math.min(100, Math.round((current / achievement.requirements.target) * 100)),
                };
              }
            }

            return {
              ...achievement,
              isUnlocked,
              unlockedAt,
              progress,
            };
          })
        );

        // Calculer les stats utilisateur
        if (userId) {
          const unlockedCount = enrichedAchievements.filter(a => a.isUnlocked).length;
          const totalPoints = enrichedAchievements
            .filter(a => a.isUnlocked)
            .reduce((sum, a) => sum + a.points, 0);
          
          const level = Math.floor(totalPoints / 1000) + 1;
          const nextLevelPoints = (level * 1000) - totalPoints;

          userStats = {
            totalAchievements: filteredAchievements.length,
            unlockedAchievements: unlockedCount,
            totalPoints,
            level,
            nextLevelPoints: nextLevelPoints > 0 ? nextLevelPoints : 0,
          };
        }

        // Calculer les stats par catégorie
        const categories = ['contribution', 'social', 'learning', 'milestone', 'special'].map(cat => {
          const categoryAchievements = enrichedAchievements.filter(a => a.category === cat);
          const unlocked = categoryAchievements.filter(a => a.isUnlocked).length;
          const points = categoryAchievements
            .filter(a => a.isUnlocked)
            .reduce((sum, a) => sum + a.points, 0);

          return {
            name: cat,
            total: categoryAchievements.length,
            unlocked,
            points,
          };
        });

        return {
          achievements: enrichedAchievements,
          userStats,
          categories,
        };
      },
      'Achievements',
      userId || 'anonymous',
    );
  }

  async getUserAchievements(
    userId: string,
    options?: {
      category?: 'contribution' | 'social' | 'learning' | 'milestone' | 'special';
      unlocked?: boolean;
    }
  ): Promise<{
    user: {
      id: string;
      username: string;
      profilePicture?: string;
      level: number;
      totalPoints: number;
    };
    achievements: UserAchievement[];
    stats: {
      totalAchievements: number;
      unlockedCount: number;
      completionRate: number;
      recentUnlocks: number;
      rareAchievements: number;
    };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new Error('Utilisateur introuvable');
        }

        const allAchievements = await this.getAllAchievements(userId, {
          category: options?.category,
        });

        let achievements = allAchievements.achievements;
        if (options?.unlocked !== undefined) {
          achievements = achievements.filter(a => a.isUnlocked === options.unlocked);
        }

        // Calculer les stats
        const unlockedCount = allAchievements.achievements.filter(a => a.isUnlocked).length;
        const totalAchievements = allAchievements.achievements.length;
        const completionRate = Math.round((unlockedCount / totalAchievements) * 100 * 100) / 100;

        // Achievements récents (derniers 7 jours)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentUnlocks = achievements.filter(
          a => a.isUnlocked && a.unlockedAt && a.unlockedAt >= weekAgo
        ).length;

        // Achievements rares (moins de 5% des utilisateurs)
        const rareAchievements = achievements.filter(
          a => a.isUnlocked && a.rarity < 5
        ).length;

        return {
          user: {
            id: userId,
            username: user.username,
            profilePicture: user.profilePicture,
            level: allAchievements.userStats?.level || 1,
            totalPoints: allAchievements.userStats?.totalPoints || 0,
          },
          achievements,
          stats: {
            totalAchievements,
            unlockedCount,
            completionRate,
            recentUnlocks,
            rareAchievements,
          },
        };
      },
      'Achievements',
      userId,
    );
  }

  async checkAndUpdateProgress(userId: string): Promise<{
    newAchievements: Array<{
      id: string;
      name: string;
      description: string;
      points: number;
      difficulty: string;
      category: string;
      unlockedAt: Date;
    }>;
    updatedProgress: Array<{
      achievementId: string;
      name: string;
      previousProgress: number;
      currentProgress: number;
      target: number;
      percentage: number;
    }>;
    levelUp?: {
      previousLevel: number;
      newLevel: number;
      pointsRequired: number;
      bonusAchievements: string[];
    };
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const newAchievements: any[] = [];
        const updatedProgress: any[] = [];

        const userAchievementData = this.userAchievements.get(userId) || new Map();
        const previousLevel = await this.getUserLevel(userId);

        for (const achievement of this.achievements.values()) {
          const isAlreadyUnlocked = userAchievementData.has(achievement.id);
          
          if (!isAlreadyUnlocked) {
            const previousProgress = userAchievementData.get(achievement.id)?.progress || 0;
            const currentProgress = await this.calculateProgress(userId, achievement);

            // Vérifier si l'achievement est maintenant débloqué
            if (currentProgress >= achievement.requirements.target) {
              const unlockedAt = new Date();
              userAchievementData.set(achievement.id, { unlockedAt, progress: currentProgress });
              
              newAchievements.push({
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                points: achievement.points,
                difficulty: achievement.difficulty,
                category: achievement.category,
                unlockedAt,
              });
            } else if (currentProgress !== previousProgress) {
              // Progrès mis à jour mais pas encore débloqué
              updatedProgress.push({
                achievementId: achievement.id,
                name: achievement.name,
                previousProgress,
                currentProgress,
                target: achievement.requirements.target,
                percentage: Math.round((currentProgress / achievement.requirements.target) * 100),
              });
            }
          }
        }

        // Sauvegarder les données utilisateur
        this.userAchievements.set(userId, userAchievementData);

        // Vérifier s'il y a un level up
        const newLevel = await this.getUserLevel(userId);
        let levelUp;
        if (newLevel > previousLevel) {
          levelUp = {
            previousLevel,
            newLevel,
            pointsRequired: newLevel * 1000,
            bonusAchievements: [], // TODO: Achievements bonus pour level up
          };
        }

        return {
          newAchievements,
          updatedProgress,
          levelUp,
        };
      },
      'Achievements',
      userId,
    );
  }

  async getLeaderboard(options: {
    period: 'week' | 'month' | 'quarter' | 'year' | 'all';
    category?: 'contribution' | 'social' | 'learning' | 'milestone' | 'special';
    limit: number;
  }): Promise<{
    leaderboard: Array<{
      rank: number;
      userId: string;
      username: string;
      profilePicture?: string;
      level: number;
      totalPoints: number;
      achievementsCount: number;
      recentActivity: Date;
      badges: Array<{
        id: string;
        name: string;
        icon: string;
        rarity: number;
      }>;
    }>;
    period: string;
    totalUsers: number;
    userRank?: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Simuler un classement basé sur les points
        // Dans une vraie implémentation, cela viendrait de la base de données
        const mockLeaderboard = [
          {
            rank: 1,
            userId: 'user1',
            username: 'LanguageMaster',
            profilePicture: '/avatars/user1.jpg',
            level: 15,
            totalPoints: 15250,
            achievementsCount: 42,
            recentActivity: new Date(),
            badges: [
              { id: 'linguist', name: 'Polyglotte', icon: '🌍', rarity: 0.8 },
              { id: 'word-master', name: 'Maître des Mots', icon: '👑', rarity: 2.1 },
            ],
          },
          {
            rank: 2,
            userId: 'user2',
            username: 'DictionaryPro',
            profilePicture: '/avatars/user2.jpg',
            level: 12,
            totalPoints: 12890,
            achievementsCount: 38,
            recentActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
            badges: [
              { id: 'scholar', name: 'Érudit', icon: '📚', rarity: 0.3 },
              { id: 'veteran', name: 'Vétéran', icon: '🏆', rarity: 8.9 },
            ],
          },
          // ... plus d'utilisateurs
        ].slice(0, options.limit);

        return {
          leaderboard: mockLeaderboard,
          period: options.period,
          totalUsers: 1250, // Nombre total d'utilisateurs
          userRank: undefined, // TODO: Calculer le rang de l'utilisateur actuel
        };
      },
      'Achievements',
      'leaderboard',
    );
  }

  async getRecentCommunityAchievements(options: {
    limit: number;
    hours: number;
  }): Promise<{
    recentAchievements: Array<{
      userId: string;
      username: string;
      profilePicture?: string;
      achievement: {
        id: string;
        name: string;
        description: string;
        icon: string;
        difficulty: string;
        points: number;
        rarity: number;
      };
      unlockedAt: Date;
      isRare: boolean;
    }>;
    stats: {
      totalUnlocked: number;
      uniqueUsers: number;
      rareUnlocks: number;
    };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Simuler des achievements récents de la communauté
        const mockRecentAchievements = [
          {
            userId: 'user3',
            username: 'NewLearner',
            profilePicture: '/avatars/user3.jpg',
            achievement: this.achievements.get('first-word')!,
            unlockedAt: new Date(Date.now() - 30 * 60 * 1000),
            isRare: false,
          },
          {
            userId: 'user4',
            username: 'RareCollector',
            profilePicture: '/avatars/user4.jpg',
            achievement: this.achievements.get('linguist')!,
            unlockedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            isRare: true,
          },
        ].slice(0, options.limit);

        return {
          recentAchievements: mockRecentAchievements,
          stats: {
            totalUnlocked: mockRecentAchievements.length,
            uniqueUsers: new Set(mockRecentAchievements.map(a => a.userId)).size,
            rareUnlocks: mockRecentAchievements.filter(a => a.isRare).length,
          },
        };
      },
      'Achievements',
      'recent',
    );
  }

  async getGlobalStatistics(): Promise<any> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Simuler des statistiques globales
        return {
          overview: {
            totalAchievements: this.achievements.size,
            totalUnlocks: 15420,
            activeUsers: 850,
            averageCompletionRate: 28.5,
          },
          byCategory: [
            {
              category: 'contribution',
              totalAchievements: 8,
              totalUnlocks: 8500,
              completionRate: 45.2,
              popularAchievements: ['first-word', 'word-master'],
            },
            // ... autres catégories
          ],
          byDifficulty: [
            {
              difficulty: 'bronze',
              totalAchievements: 3,
              totalUnlocks: 12000,
              averageTimeToUnlock: 2.5, // jours
            },
            // ... autres difficultés
          ],
          trends: {
            dailyUnlocks: [120, 135, 98, 142, 156, 189, 201],
            popularCategories: ['contribution', 'learning', 'social'],
            engagementMetrics: {
              averageAchievementsPerUser: 8.2,
              retentionWithAchievements: 78.5,
            },
          },
        };
      },
      'Achievements',
      'global-stats',
    );
  }

  async getRareAchievements(threshold: number): Promise<any> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const rareAchievements = Array.from(this.achievements.values())
          .filter(a => a.rarity <= threshold)
          .map(achievement => ({
            ...achievement,
            unlockCount: Math.floor((achievement.rarity / 100) * 1250), // Simulé
            firstUnlockedBy: 'EarlyAdopter',
            firstUnlockedAt: new Date('2024-01-15'),
            holders: [], // TODO: Récupérer les vrais détenteurs
          }));

        return {
          rareAchievements,
          totalUsers: 1250,
          threshold,
        };
      },
      'Achievements',
      'rare',
    );
  }

  async getAchievementProgress(achievementId: string, userId: string): Promise<any> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const achievement = this.achievements.get(achievementId);
        if (!achievement) {
          throw new Error('Achievement introuvable');
        }

        const userAchievementData = this.userAchievements.get(userId);
        const userAchievement = userAchievementData?.get(achievementId);
        const isUnlocked = !!userAchievement;

        let current = 0;
        if (!isUnlocked) {
          current = await this.calculateProgress(userId, achievement);
        }

        return {
          achievement,
          progress: {
            current: isUnlocked ? achievement.requirements.target : current,
            target: achievement.requirements.target,
            percentage: isUnlocked ? 100 : Math.round((current / achievement.requirements.target) * 100),
            isUnlocked,
            unlockedAt: userAchievement?.unlockedAt,
          },
          breakdown: [], // TODO: Détail des critères
          tips: [
            "Continuez à contribuer régulièrement",
            "Explorez différentes langues",
            "Interagissez avec la communauté",
          ],
          similarUsers: [], // TODO: Utilisateurs avec progrès similaire
        };
      },
      'Achievements',
      achievementId,
      userId,
    );
  }

  private async calculateProgress(userId: string, achievement: Achievement): Promise<number> {
    switch (achievement.requirements.type) {
      case 'words_created':
        return this.wordRepository.countByUser(userId);
      case 'approved_words':
        return this.wordRepository.countByUserAndStatus(userId, 'approved');
      case 'words_viewed':
        const stats = await this.wordViewRepository.getUserActivityStats(userId);
        return stats.uniqueWords;
      case 'languages_contributed':
        const langStats = await this.wordRepository.getUserLanguageStats(userId);
        return langStats.length;
      default:
        return 0;
    }
  }

  private async getUserLevel(userId: string): Promise<number> {
    const userAchievementData = this.userAchievements.get(userId);
    if (!userAchievementData) return 1;

    let totalPoints = 0;
    for (const [achievementId] of userAchievementData) {
      const achievement = this.achievements.get(achievementId);
      if (achievement) {
        totalPoints += achievement.points;
      }
    }

    return Math.floor(totalPoints / 1000) + 1;
  }
}