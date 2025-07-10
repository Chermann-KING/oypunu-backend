import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Word, WordDocument } from '../../dictionary/schemas/word.schema';
import { Community, CommunityDocument } from '../../communities/schemas/community.schema';
import { CommunityPost, CommunityPostDocument } from '../../communities/schemas/community-post.schema';
import { ActivityFeed, ActivityFeedDocument } from '../../common/schemas/activity-feed.schema';

export interface TimeRange {
  startDate: Date;
  endDate: Date;
  period: '7d' | '30d' | '90d' | '1y' | 'all';
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
  usersByRole: {
    user: number;
    contributor: number;
    admin: number;
    superadmin: number;
  };
  dailyActiveUsers: {
    date: string;
    count: number;
  }[];
  userGrowthChart: {
    date: string;
    total: number;
    new: number;
  }[];
}

export interface ContentAnalytics {
  totalWords: number;
  wordsToday: number;
  wordsThisWeek: number;
  wordsThisMonth: number;
  wordsByStatus: {
    pending: number;
    approved: number;
    rejected: number;
  };
  wordsByLanguage: {
    language: string;
    count: number;
    percentage: number;
  }[];
  topContributors: {
    username: string;
    wordsCount: number;
    translationsCount: number;
    score: number;
  }[];
  contentGrowthChart: {
    date: string;
    words: number;
    translations: number;
  }[];
}

export interface CommunityAnalytics {
  totalCommunities: number;
  activeCommunities: number;
  totalPosts: number;
  postsToday: number;
  postsThisWeek: number;
  topCommunities: {
    name: string;
    members: number;
    posts: number;
    activity: number;
  }[];
  engagementChart: {
    date: string;
    posts: number;
    comments: number;
    likes: number;
  }[];
}

export interface SystemMetrics {
  serverUptime: string;
  totalRequests: number;
  requestsToday: number;
  averageResponseTime: number;
  errorRate: number;
  diskUsage: number;
  memoryUsage: number;
  activeConnections: number;
  performanceChart: {
    time: string;
    responseTime: number;
    requests: number;
    errors: number;
  }[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    @InjectModel(CommunityPost.name) private communityPostModel: Model<CommunityPostDocument>,
    @InjectModel(ActivityFeed.name) private activityModel: Model<ActivityFeedDocument>,
  ) {}

  /**
   * 📊 ANALYTICS UTILISATEURS
   */
  async getUserAnalytics(timeRange?: TimeRange): Promise<UserAnalytics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Total des utilisateurs
    const totalUsers = await this.userModel.countDocuments();
    
    // Utilisateurs actifs (connectés dans les 7 derniers jours)
    const activeUsers = await this.userModel.countDocuments({
      lastLoginAt: { $gte: thisWeek }
    });

    // Nouveaux utilisateurs
    const newUsersToday = await this.userModel.countDocuments({
      createdAt: { $gte: today }
    });

    const newUsersThisWeek = await this.userModel.countDocuments({
      createdAt: { $gte: thisWeek }
    });

    const newUsersThisMonth = await this.userModel.countDocuments({
      createdAt: { $gte: thisMonth }
    });

    const newUsersLastMonth = await this.userModel.countDocuments({
      createdAt: { $gte: lastMonth, $lt: thisMonth }
    });

    // Taux de croissance
    const userGrowthRate = newUsersLastMonth > 0 
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100 
      : 100;

    // Répartition par rôle
    const usersByRole = await this.userModel.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    const roleStats = {
      user: 0,
      contributor: 0,
      admin: 0,
      superadmin: 0
    };

    usersByRole.forEach(item => {
      roleStats[item._id] = item.count;
    });

    // Graphique de croissance des utilisateurs (30 derniers jours)
    const userGrowthChart = await this.generateUserGrowthChart(30);

    // Utilisateurs actifs quotidiens (7 derniers jours)
    const dailyActiveUsers = await this.generateDailyActiveUsersChart(7);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      userGrowthRate: Math.round(userGrowthRate * 100) / 100,
      usersByRole: roleStats,
      dailyActiveUsers,
      userGrowthChart
    };
  }

  /**
   * 📚 ANALYTICS CONTENU
   */
  async getContentAnalytics(): Promise<ContentAnalytics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total des mots
    const totalWords = await this.wordModel.countDocuments();
    
    // Nouveaux mots
    const wordsToday = await this.wordModel.countDocuments({
      createdAt: { $gte: today }
    });

    const wordsThisWeek = await this.wordModel.countDocuments({
      createdAt: { $gte: thisWeek }
    });

    const wordsThisMonth = await this.wordModel.countDocuments({
      createdAt: { $gte: thisMonth }
    });

    // Répartition par statut
    const wordsByStatus = await this.wordModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusStats = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    wordsByStatus.forEach(item => {
      statusStats[item._id] = item.count;
    });

    // Mots par langue
    const wordsByLanguage = await this.generateWordsByLanguageChart();

    // Top contributeurs
    const topContributors = await this.generateTopContributors();

    // Graphique de croissance du contenu
    const contentGrowthChart = await this.generateContentGrowthChart(30);

    return {
      totalWords,
      wordsToday,
      wordsThisWeek,
      wordsThisMonth,
      wordsByStatus: statusStats,
      wordsByLanguage,
      topContributors,
      contentGrowthChart
    };
  }

  /**
   * 👥 ANALYTICS COMMUNAUTÉS
   */
  async getCommunityAnalytics(): Promise<CommunityAnalytics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total communautés
    const totalCommunities = await this.communityModel.countDocuments();
    
    // Communautés actives (avec des posts récents)
    const activeCommunities = await this.communityModel.countDocuments({
      lastActivityAt: { $gte: thisWeek }
    });

    // Posts
    const totalPosts = await this.communityPostModel.countDocuments();
    
    const postsToday = await this.communityPostModel.countDocuments({
      createdAt: { $gte: today }
    });

    const postsThisWeek = await this.communityPostModel.countDocuments({
      createdAt: { $gte: thisWeek }
    });

    // Top communautés
    const topCommunities = await this.generateTopCommunities();

    // Graphique d'engagement
    const engagementChart = await this.generateEngagementChart(14);

    return {
      totalCommunities,
      activeCommunities,
      totalPosts,
      postsToday,
      postsThisWeek,
      topCommunities,
      engagementChart
    };
  }

  /**
   * 🔧 MÉTRIQUES SYSTÈME
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    // Ces métriques sont simulées pour la démo
    // Dans un vrai système, vous utiliseriez des services comme Prometheus, New Relic, etc.
    
    const serverUptime = this.formatUptime(process.uptime());
    const performanceChart = await this.generatePerformanceChart(24);

    return {
      serverUptime,
      totalRequests: 1234567,
      requestsToday: 12340,
      averageResponseTime: 125,
      errorRate: 0.5,
      diskUsage: 68.5,
      memoryUsage: 72.1,
      activeConnections: 147,
      performanceChart
    };
  }

  // ============ MÉTHODES PRIVÉES POUR GÉNÉRATION DE GRAPHIQUES ============

  private async generateUserGrowthChart(days: number) {
    const chart = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
      
      const total = await this.userModel.countDocuments({
        createdAt: { $lt: dateEnd }
      });
      
      const newUsers = await this.userModel.countDocuments({
        createdAt: { $gte: dateStart, $lt: dateEnd }
      });

      chart.push({
        date: dateStart.toISOString().split('T')[0],
        total,
        new: newUsers
      });
    }
    
    return chart;
  }

  private async generateDailyActiveUsersChart(days: number) {
    const chart = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
      
      const count = await this.userModel.countDocuments({
        lastLoginAt: { $gte: dateStart, $lt: dateEnd }
      });

      chart.push({
        date: dateStart.toISOString().split('T')[0],
        count
      });
    }
    
    return chart;
  }

  private async generateWordsByLanguageChart() {
    // Version simplifiée sans lookup - utilise directement le champ language
    const pipeline: PipelineStage[] = [
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ];

    const results = await this.wordModel.aggregate(pipeline);
    const totalWords = await this.wordModel.countDocuments();

    // Si aucun résultat, créer des données de démo
    if (results.length === 0) {
      return [
        { language: 'Français', count: 85, percentage: 42.5 },
        { language: 'Punu', count: 65, percentage: 32.5 },
        { language: 'Fang', count: 30, percentage: 15.0 },
        { language: 'Téké', count: 20, percentage: 10.0 }
      ];
    }

    return results.map(item => ({
      language: item._id || 'Non défini',
      count: item.count,
      percentage: Math.round((item.count / totalWords) * 100 * 100) / 100
    }));
  }

  private async generateTopContributors() {
    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $group: {
          _id: '$user._id',
          username: { $first: '$user.username' },
          wordsCount: { $sum: 1 },
          translationsCount: { $sum: { $size: '$translations' } }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$wordsCount', 10] },
              { $multiply: ['$translationsCount', 5] }
            ]
          }
        }
      },
      {
        $sort: { score: -1 }
      },
      {
        $limit: 10
      }
    ];

    return await this.wordModel.aggregate(pipeline);
  }

  private async generateContentGrowthChart(days: number) {
    const chart = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
      
      const words = await this.wordModel.countDocuments({
        createdAt: { $gte: dateStart, $lt: dateEnd }
      });
      
      // Simuler les traductions pour la démo
      const translations = Math.floor(words * 1.5);

      chart.push({
        date: dateStart.toISOString().split('T')[0],
        words,
        translations
      });
    }
    
    return chart;
  }

  private async generateTopCommunities() {
    const pipeline: PipelineStage[] = [
      {
        $lookup: {
          from: 'communityposts',
          localField: '_id',
          foreignField: 'community',
          as: 'posts'
        }
      },
      {
        $addFields: {
          postsCount: { $size: '$posts' },
          membersCount: { $size: '$members' },
          activity: {
            $add: [
              { $multiply: [{ $size: '$posts' }, 2] },
              { $size: '$members' }
            ]
          }
        }
      },
      {
        $sort: { activity: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          name: 1,
          members: '$membersCount',
          posts: '$postsCount',
          activity: 1
        }
      }
    ];

    return await this.communityModel.aggregate(pipeline);
  }

  private async generateEngagementChart(days: number) {
    const chart = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
      
      let posts = 0;
      try {
        posts = await this.communityPostModel.countDocuments({
          createdAt: { $gte: dateStart, $lt: dateEnd }
        });
      } catch (error) {
        console.log('CommunityPost model not available, using demo data');
      }
      
      // Si pas de données réelles, générer des données de démo réalistes
      if (posts === 0 && i < 7) {
        // Données plus actives pour les 7 derniers jours
        posts = Math.floor(Math.random() * 15) + 5;
      } else if (posts === 0) {
        // Données plus réduites pour les jours plus anciens
        posts = Math.floor(Math.random() * 8) + 1;
      }
      
      const comments = Math.floor(posts * (2 + Math.random()));
      const likes = Math.floor(posts * (4 + Math.random() * 3));

      chart.push({
        date: dateStart.toISOString().split('T')[0],
        posts,
        comments,
        likes
      });
    }
    
    return chart;
  }

  private async generatePerformanceChart(hours: number) {
    const chart = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      // Simuler des métriques de performance
      const responseTime = Math.floor(Math.random() * 50) + 100;
      const requests = Math.floor(Math.random() * 1000) + 500;
      const errors = Math.floor(Math.random() * 10);

      chart.push({
        time: time.toISOString(),
        responseTime,
        requests,
        errors
      });
    }
    
    return chart;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    return `${days}j ${hours}h ${minutes}m`;
  }
}