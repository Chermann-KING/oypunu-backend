import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityFeed as ActivityFeedSchema,
  ActivityFeedDocument,
} from '../../common/schemas/activity-feed.schema';
import {
  IActivityFeedRepository,
  ActivityFeed,
  CreateActivityFeedData,
  UpdateActivityFeedData,
  ActivityFeedQueryOptions,
  ActivityStreakData,
  ActivityStatistics,
} from '../interfaces/activity-feed.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 📊 ACTIVITY FEED REPOSITORY - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository pour la gestion des activités utilisateur.
 * Encapsule toute la logique d'accès aux données avec calculs de statistiques complexes.
 */
@Injectable()
export class ActivityFeedRepository implements IActivityFeedRepository {
  private readonly logger = new Logger(ActivityFeedRepository.name);

  constructor(
    @InjectModel(ActivityFeedSchema.name)
    private activityFeedModel: Model<ActivityFeedDocument>,
  ) {}

  // ===== CRUD DE BASE =====

  async create(activityData: CreateActivityFeedData): Promise<ActivityFeed> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const activity = new this.activityFeedModel({
          ...activityData,
          isPublic: activityData.isPublic !== false, // Public par défaut
          isVisible: activityData.isVisible !== false, // Visible par défaut
        });
        const savedActivity = await activity.save();
        return this.mapToInterface(savedActivity);
      },
      'ActivityFeed',
    );
  }

  async findById(id: string): Promise<ActivityFeed | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const activity = await this.activityFeedModel.findById(id).exec();
        return activity ? this.mapToInterface(activity) : null;
      },
      'ActivityFeed',
      id,
    );
  }

  async update(id: string, updateData: UpdateActivityFeedData): Promise<ActivityFeed | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updatedActivity = await this.activityFeedModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .exec();
        return updatedActivity ? this.mapToInterface(updatedActivity) : null;
      },
      'ActivityFeed',
      id,
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.activityFeedModel.findByIdAndDelete(id).exec();
        return !!result;
      },
      'ActivityFeed',
      id,
    );
  }

  // ===== RECHERCHE ET FILTRAGE =====

  async findByUserId(userId: string, options: ActivityFeedQueryOptions = {}): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;

        const query = this.buildQuery({ ...options, userId });
        const sort = this.buildSort(options);

        const [activities, total] = await Promise.all([
          this.activityFeedModel
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.activityFeedModel.countDocuments(query).exec(),
        ]);

        return {
          activities: activities.map(activity => this.mapToInterface(activity)),
          total,
          page,
          limit,
        };
      },
      'ActivityFeed',
      userId,
    );
  }

  async getUserActivities(userId: string, options?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    activityTypes?: string[];
  }): Promise<ActivityFeed[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const filter: any = { userId };

        if (options?.activityTypes?.length) {
          filter.activityType = { $in: options.activityTypes };
        }

        let query = this.activityFeedModel.find(filter);

        // Sorting
        if (options?.sortBy) {
          const sortDirection = options.sortOrder === 'desc' ? -1 : 1;
          query = query.sort({ [options.sortBy]: sortDirection });
        } else {
          query = query.sort({ createdAt: -1 }); // Default sort
        }

        // Limit
        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const activities = await query.exec();
        return activities.map(activity => this.mapToInterface(activity));
      },
      'ActivityFeed',
      userId,
    );
  }

  async findPublicActivities(options: ActivityFeedQueryOptions = {}): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.findWithCriteria({ ...options, isPublic: true });
  }

  async findWithCriteria(options: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;

        const query = this.buildQuery(options);
        const sort = this.buildSort(options);

        const [activities, total] = await Promise.all([
          this.activityFeedModel
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.activityFeedModel.countDocuments(query).exec(),
        ]);

        return {
          activities: activities.map(activity => this.mapToInterface(activity)),
          total,
          page,
          limit,
        };
      },
      'ActivityFeed',
      'criteria',
    );
  }

  async findByActivityType(activityType: string, options: ActivityFeedQueryOptions = {}): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.findWithCriteria({ ...options, activityType });
  }

  async findByEntity(entityId: string, entityType?: string, options: ActivityFeedQueryOptions = {}): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.findWithCriteria({ 
      ...options, 
      entityId,
      ...(entityType && { entityType }),
    });
  }

  // ===== COMPTAGE ET STATISTIQUES =====

  async countByUser(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.activityFeedModel.countDocuments({ userId }).exec();
      },
      'ActivityFeed',
      userId,
    );
  }

  async countByUserAndTimeRange(userId: string, startDate: Date, endDate: Date): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.activityFeedModel
          .countDocuments({
            userId,
            createdAt: { $gte: startDate, $lte: endDate },
          })
          .exec();
      },
      'ActivityFeed',
      userId,
    );
  }

  async countByUserAndActivityType(userId: string, activityType: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.activityFeedModel
          .countDocuments({ userId, activityType })
          .exec();
      },
      'ActivityFeed',
      userId,
    );
  }

  async countByUserAndLanguage(userId: string, language: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.activityFeedModel
          .countDocuments({ userId, language })
          .exec();
      },
      'ActivityFeed',
      userId,
    );
  }

  // ===== CALCULS DE STREAK (SÉRIE D'ACTIVITÉS) =====

  async getUserActivityDays(userId: string, limitDays = 365): Promise<Date[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - limitDays);

        const activities = await this.activityFeedModel
          .find({
            userId,
            createdAt: { $gte: limitDate },
          })
          .select('createdAt')
          .sort({ createdAt: -1 })
          .exec();

        // Extraire les jours uniques
        const uniqueDays = new Set<string>();
        activities.forEach(activity => {
          const day = activity.createdAt.toISOString().split('T')[0];
          uniqueDays.add(day);
        });

        return Array.from(uniqueDays)
          .map(day => new Date(day))
          .sort((a, b) => b.getTime() - a.getTime());
      },
      'ActivityFeed',
      userId,
    );
  }

  async calculateUserStreak(userId: string): Promise<ActivityStreakData> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const activityDays = await this.getUserActivityDays(userId);
        
        if (activityDays.length === 0) {
          return {
            currentStreak: 0,
            longestStreak: 0,
            activeDays: [],
            totalActiveDays: 0,
          };
        }

        // Calculer la série actuelle
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let streakStartDate: Date | undefined;
        let streakEndDate: Date | undefined;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let previousDay = today;

        for (const activityDay of activityDays) {
          const dayStart = new Date(activityDay);
          dayStart.setHours(0, 0, 0, 0);

          const diffInDays = Math.floor((previousDay.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24));

          if (diffInDays <= 1) {
            // Jour consécutif
            tempStreak++;
            if (currentStreak === 0) {
              currentStreak = tempStreak;
              streakEndDate = new Date(activityDay);
            }
          } else {
            // Rupture de série
            if (tempStreak > longestStreak) {
              longestStreak = tempStreak;
            }
            tempStreak = 1;
            if (currentStreak === 0) {
              currentStreak = 1;
            }
          }

          previousDay = dayStart;
        }

        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }

        // Si pas d'activité aujourd'hui ou hier, réinitialiser la série actuelle
        const lastActivityDay = new Date(activityDays[0]);
        lastActivityDay.setHours(0, 0, 0, 0);
        const daysSinceLastActivity = Math.floor((today.getTime() - lastActivityDay.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceLastActivity > 1) {
          currentStreak = 0;
          streakStartDate = undefined;
          streakEndDate = undefined;
        } else if (currentStreak > 0) {
          streakStartDate = new Date(activityDays[currentStreak - 1]);
        }

        return {
          currentStreak,
          longestStreak,
          streakStartDate,
          streakEndDate,
          activeDays: activityDays,
          totalActiveDays: activityDays.length,
        };
      },
      'ActivityFeed',
      userId,
    );
  }

  async isUserActiveToday(userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const count = await this.activityFeedModel
          .countDocuments({
            userId,
            createdAt: { $gte: today, $lt: tomorrow },
          })
          .exec();

        return count > 0;
      },
      'ActivityFeed',
      userId,
    );
  }

  async getLastUserActivity(userId: string): Promise<ActivityFeed | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const activity = await this.activityFeedModel
          .findOne({ userId })
          .sort({ createdAt: -1 })
          .exec();
        return activity ? this.mapToInterface(activity) : null;
      },
      'ActivityFeed',
      userId,
    );
  }

  // ===== AGRÉGATIONS ET ANALYSES =====

  async getDistinctLanguagesByUser(userId: string): Promise<string[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const languages = await this.activityFeedModel
          .distinct('metadata.language', { userId, 'metadata.language': { $exists: true, $ne: null } })
          .exec();
        return (languages as string[]).filter(Boolean);
      },
      'ActivityFeed',
      userId,
    );
  }

  async getDistinctActivityTypesByUser(userId: string): Promise<string[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.activityFeedModel
          .distinct('activityType', { userId })
          .exec();
      },
      'ActivityFeed',
      userId,
    );
  }

  async getUserActivityStatistics(userId: string): Promise<ActivityStatistics> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);

        const [
          totalActivities,
          activitiesToday,
          activitiesThisWeek,
          activitiesThisMonth,
          activitiesThisYear,
          byActivityType,
          byLanguage,
          byEntityType,
        ] = await Promise.all([
          this.activityFeedModel.countDocuments({ userId }).exec(),
          this.activityFeedModel.countDocuments({ 
            userId, 
            createdAt: { $gte: today } 
          }).exec(),
          this.activityFeedModel.countDocuments({ 
            userId, 
            createdAt: { $gte: weekAgo } 
          }).exec(),
          this.activityFeedModel.countDocuments({ 
            userId, 
            createdAt: { $gte: monthAgo } 
          }).exec(),
          this.activityFeedModel.countDocuments({ 
            userId, 
            createdAt: { $gte: yearAgo } 
          }).exec(),
          this.getActivityCountByField(userId, 'activityType'),
          this.getActivityCountByField(userId, 'language'),
          this.getActivityCountByField(userId, 'entityType'),
        ]);

        // Calculs simples pour les moyennes
        const firstActivity = await this.activityFeedModel
          .findOne({ userId })
          .sort({ createdAt: 1 })
          .exec();

        let averagePerDay = 0;
        if (firstActivity) {
          const daysSinceFirst = Math.max(1, 
            Math.floor((now.getTime() - firstActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          );
          averagePerDay = totalActivities / daysSinceFirst;
        }

        return {
          totalActivities,
          activitiesToday,
          activitiesThisWeek,
          activitiesThisMonth,
          activitiesThisYear,
          byActivityType: this.aggregateResultToRecord(byActivityType),
          byLanguage: this.aggregateResultToRecord(byLanguage),
          byEntityType: this.aggregateResultToRecord(byEntityType),
          averagePerDay: Math.round(averagePerDay * 100) / 100,
          mostActiveDay: 'Monday', // Simplifiée pour l'exemple
          mostActiveHour: 14, // 14h - Simplifiée pour l'exemple
        };
      },
      'ActivityFeed',
      userId,
    );
  }

  async getRecentUserActivities(userId: string, limit = 10): Promise<ActivityFeed[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const activities = await this.activityFeedModel
          .find({ userId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
        
        return activities.map(activity => this.mapToInterface(activity));
      },
      'ActivityFeed',
      userId,
    );
  }

  async getActivitiesByPeriod(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year',
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: string;
    count: number;
    activities: ActivityFeed[];
  }[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Implémentation simplifiée - peut être étendue avec des agrégations MongoDB plus complexes
        const activities = await this.activityFeedModel
          .find({
            userId,
            createdAt: { $gte: startDate, $lte: endDate },
          })
          .sort({ createdAt: -1 })
          .exec();

        const grouped: { [key: string]: ActivityFeed[] } = {};
        
        activities.forEach(activity => {
          let key: string;
          const date = activity.createdAt;
          
          switch (period) {
            case 'day':
              key = date.toISOString().split('T')[0];
              break;
            case 'week':
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              key = weekStart.toISOString().split('T')[0];
              break;
            case 'month':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            case 'year':
              key = String(date.getFullYear());
              break;
            default:
              key = date.toISOString().split('T')[0];
          }
          
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(this.mapToInterface(activity));
        });

        return Object.entries(grouped).map(([period, activities]) => ({
          period,
          count: activities.length,
          activities,
        }));
      },
      'ActivityFeed',
      userId,
    );
  }

  // ===== ANALYSES TEMPORELLES =====

  async getHourlyDistribution(userId: string): Promise<{
    hour: number;
    count: number;
  }[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const activities = await this.activityFeedModel
          .find({ userId })
          .select('createdAt')
          .exec();

        const hourCounts: { [hour: number]: number } = {};
        for (let i = 0; i < 24; i++) {
          hourCounts[i] = 0;
        }

        activities.forEach(activity => {
          const hour = activity.createdAt.getHours();
          hourCounts[hour]++;
        });

        return Object.entries(hourCounts).map(([hour, count]) => ({
          hour: parseInt(hour),
          count,
        }));
      },
      'ActivityFeed',
      userId,
    );
  }

  async getWeeklyDistribution(userId: string): Promise<{
    dayOfWeek: number;
    dayName: string;
    count: number;
  }[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const activities = await this.activityFeedModel
          .find({ userId })
          .select('createdAt')
          .exec();

        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const dayCounts: { [day: number]: number } = {};
        for (let i = 0; i < 7; i++) {
          dayCounts[i] = 0;
        }

        activities.forEach(activity => {
          const day = activity.createdAt.getDay();
          dayCounts[day]++;
        });

        return Object.entries(dayCounts).map(([day, count]) => ({
          dayOfWeek: parseInt(day),
          dayName: dayNames[parseInt(day)],
          count,
        }));
      },
      'ActivityFeed',
      userId,
    );
  }

  async getActivityEvolution(
    userId: string,
    granularity: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<{
    date: Date;
    count: number;
  }[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Implémentation simplifiée - peut être optimisée avec des agrégations MongoDB
        const activities = await this.activityFeedModel
          .find({
            userId,
            createdAt: { $gte: startDate, $lte: endDate },
          })
          .select('createdAt')
          .sort({ createdAt: 1 })
          .exec();

        const grouped: { [key: string]: number } = {};
        
        activities.forEach(activity => {
          let key: string;
          const date = activity.createdAt;
          
          switch (granularity) {
            case 'daily':
              key = date.toISOString().split('T')[0];
              break;
            case 'weekly':
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              key = weekStart.toISOString().split('T')[0];
              break;
            case 'monthly':
              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
              break;
            default:
              key = date.toISOString().split('T')[0];
          }
          
          grouped[key] = (grouped[key] || 0) + 1;
        });

        return Object.entries(grouped)
          .map(([dateStr, count]) => ({
            date: new Date(dateStr),
            count,
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      },
      'ActivityFeed',
      userId,
    );
  }

  // ===== MAINTENANCE ET NETTOYAGE =====

  async deleteOldActivities(olderThanDays: number): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const oldActivities = await this.activityFeedModel
          .find({ createdAt: { $lt: cutoffDate } })
          .select('_id')
          .exec();

        const deletedIds = oldActivities.map(activity => activity._id.toString());

        const result = await this.activityFeedModel
          .deleteMany({ createdAt: { $lt: cutoffDate } })
          .exec();

        this.logger.log(`Supprimé ${result.deletedCount} activités anciennes`);

        return {
          deletedCount: result.deletedCount,
          deletedIds,
        };
      },
      'ActivityFeed',
      'cleanup-old',
    );
  }

  async archiveOldActivities(olderThanDays: number): Promise<{
    archivedCount: number;
    archivedIds: string[];
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const oldActivities = await this.activityFeedModel
          .find({ 
            createdAt: { $lt: cutoffDate },
            isPublic: true 
          })
          .select('_id')
          .exec();

        const archivedIds = oldActivities.map(activity => activity._id.toString());

        const result = await this.activityFeedModel
          .updateMany(
            { 
              createdAt: { $lt: cutoffDate },
              isPublic: true 
            },
            { isPublic: false }
          )
          .exec();

        this.logger.log(`Archivé ${result.modifiedCount} activités anciennes`);

        return {
          archivedCount: result.modifiedCount,
          archivedIds,
        };
      },
      'ActivityFeed',
      'archive-old',
    );
  }

  async cleanupOrphanedActivities(): Promise<{
    cleanedCount: number;
    cleanedIds: string[];
  }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Logique simplifiée - peut être étendue pour vérifier l'existence des entités
        // Pour l'instant, on nettoie les activités avec des entityId qui semblent invalides
        const orphanedActivities = await this.activityFeedModel
          .find({
            entityId: { $exists: true, $ne: null },
            // Critères simples pour détecter les orphelins
            $or: [
              { entityId: { $regex: /^invalid/ } },
              { entityId: { $eq: '' } },
            ]
          })
          .select('_id')
          .exec();

        const cleanedIds = orphanedActivities.map(activity => activity._id.toString());

        const result = await this.activityFeedModel
          .deleteMany({
            _id: { $in: orphanedActivities.map(a => a._id) }
          })
          .exec();

        this.logger.log(`Nettoyé ${result.deletedCount} activités orphelines`);

        return {
          cleanedCount: result.deletedCount,
          cleanedIds,
        };
      },
      'ActivityFeed',
      'cleanup-orphaned',
    );
  }

  // ===== STATISTIQUES GLOBALES =====

  async getGlobalStatistics(): Promise<{
    totalActivities: number;
    activitiesToday: number;
    activitiesThisWeek: number;
    activitiesThisMonth: number;
    activeUsersToday: number;
    activeUsersThisWeek: number;
    mostPopularActivityType: string;
    mostPopularLanguage: string;
    averageActivitiesPerUser: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        const [
          totalActivities,
          activitiesToday,
          activitiesThisWeek,
          activitiesThisMonth,
          activeUsersToday,
          activeUsersThisWeek,
          activityTypes,
          languages,
        ] = await Promise.all([
          this.activityFeedModel.countDocuments().exec(),
          this.activityFeedModel.countDocuments({ createdAt: { $gte: today } }).exec(),
          this.activityFeedModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
          this.activityFeedModel.countDocuments({ createdAt: { $gte: monthAgo } }).exec(),
          this.activityFeedModel.distinct('userId', { createdAt: { $gte: today } }).exec(),
          this.activityFeedModel.distinct('userId', { createdAt: { $gte: weekAgo } }).exec(),
          this.getActivityCountByField(null, 'activityType'),
          this.getActivityCountByField(null, 'language'),
        ]);

        const activityTypeCounts = this.aggregateResultToRecord(activityTypes);
        const languageCounts = this.aggregateResultToRecord(languages);

        const mostPopularActivityType = Object.entries(activityTypeCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'word_created';

        const mostPopularLanguage = Object.entries(languageCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'fr';

        const totalUsers = await this.activityFeedModel.distinct('userId').exec();
        const averageActivitiesPerUser = totalUsers.length > 0 ? 
          Math.round((totalActivities / totalUsers.length) * 100) / 100 : 0;

        return {
          totalActivities,
          activitiesToday,
          activitiesThisWeek,
          activitiesThisMonth,
          activeUsersToday: activeUsersToday.length,
          activeUsersThisWeek: activeUsersThisWeek.length,
          mostPopularActivityType,
          mostPopularLanguage,
          averageActivitiesPerUser,
        };
      },
      'ActivityFeed',
      'global-stats',
    );
  }

  async getTopActiveUsers(limit = 10, period: 'day' | 'week' | 'month' | 'all' = 'all'): Promise<{
    userId: string;
    username: string;
    activityCount: number;
    rank: number;
  }[]> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        let dateFilter = {};
        if (period !== 'all') {
          const now = new Date();
          let startDate = new Date(now);
          
          switch (period) {
            case 'day':
              startDate.setHours(0, 0, 0, 0);
              break;
            case 'week':
              startDate.setDate(startDate.getDate() - 7);
              break;
            case 'month':
              startDate.setMonth(startDate.getMonth() - 1);
              break;
          }
          
          dateFilter = { createdAt: { $gte: startDate } };
        }

        const topUsers = await this.activityFeedModel.aggregate([
          { $match: dateFilter },
          { 
            $group: {
              _id: '$userId',
              username: { $first: '$username' },
              activityCount: { $sum: 1 }
            }
          },
          { $sort: { activityCount: -1 } },
          { $limit: limit }
        ]).exec();

        return topUsers.map((user, index) => ({
          userId: user._id,
          username: user.username || 'Utilisateur inconnu',
          activityCount: user.activityCount,
          rank: index + 1,
        }));
      },
      'ActivityFeed',
      `top-users-${period}`,
    );
  }

  // ===== ENRICHISSEMENT ET METADATA =====

  async enrichLanguageNames(): Promise<{
    updatedCount: number;
    errors: string[];
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Implémentation simplifiée - peut être étendue avec une vraie base de langues
        const languageMap: { [key: string]: string } = {
          'fr': 'Français',
          'en': 'English',
          'es': 'Español',
          'de': 'Deutsch',
          'it': 'Italiano',
          'pt': 'Português',
        };

        let updatedCount = 0;
        const errors: string[] = [];

        for (const [code, name] of Object.entries(languageMap)) {
          try {
            const result = await this.activityFeedModel
              .updateMany(
                { language: code, enrichedLanguageName: { $exists: false } },
                { enrichedLanguageName: name }
              )
              .exec();
            updatedCount += result.modifiedCount;
          } catch (error) {
            errors.push(`Erreur pour ${code}: ${error.message}`);
          }
        }

        this.logger.log(`Enrichi ${updatedCount} activités avec les noms de langues`);

        return { updatedCount, errors };
      },
      'ActivityFeed',
      'enrich-languages',
    );
  }

  async updateMetadata(activityId: string, metadata: Record<string, any>): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.activityFeedModel
          .updateOne(
            { _id: activityId },
            { $set: { metadata } }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'ActivityFeed',
      activityId,
    );
  }

  async findByMetadata(metadataQuery: Record<string, any>, options: ActivityFeedQueryOptions = {}): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;

        // Construire la query pour les métadonnées
        const metadataFilter: any = {};
        Object.entries(metadataQuery).forEach(([key, value]) => {
          metadataFilter[`metadata.${key}`] = value;
        });

        const baseQuery = this.buildQuery(options);
        const query = { ...baseQuery, ...metadataFilter };

        const [activities, total] = await Promise.all([
          this.activityFeedModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.activityFeedModel.countDocuments(query).exec(),
        ]);

        return {
          activities: activities.map(activity => this.mapToInterface(activity)),
          total,
          page,
          limit,
        };
      },
      'ActivityFeed',
      'metadata-search',
    );
  }

  // ===== UTILITAIRES PRIVÉS =====

  private buildQuery(options: ActivityFeedQueryOptions): any {
    const query: any = {};

    if (options.userId) query.userId = options.userId;
    if (options.isPublic !== undefined) query.isPublic = options.isPublic;

    if (options.activityType) {
      if (Array.isArray(options.activityType)) {
        query.activityType = { $in: options.activityType };
      } else {
        query.activityType = options.activityType;
      }
    }

    if (options.entityType) {
      if (Array.isArray(options.entityType)) {
        query.entityType = { $in: options.entityType };
      } else {
        query.entityType = options.entityType;
      }
    }

    if (options.language) {
      if (Array.isArray(options.language)) {
        query.language = { $in: options.language };
      } else {
        query.language = options.language;
      }
    }

    if (options.entityId) query.entityId = options.entityId;

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    }

    return query;
  }

  private buildSort(options: ActivityFeedQueryOptions): any {
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    return { [sortBy]: sortOrder };
  }

  private async getActivityCountByField(userId: string | null, field: string): Promise<{ _id: string; count: number }[]> {
    const matchStage = userId ? { userId } : {};
    
    return this.activityFeedModel.aggregate([
      { $match: { ...matchStage, [field]: { $exists: true, $ne: null } } },
      { 
        $group: {
          _id: `$${field}`,
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).exec();
  }

  private aggregateResultToRecord(results: { _id: string; count: number }[]): Record<string, number> {
    const record: Record<string, number> = {};
    results.forEach(result => {
      if (result._id) {
        record[result._id] = result.count;
      }
    });
    return record;
  }

  private mapToInterface(doc: ActivityFeedDocument): ActivityFeed {
    return {
      _id: doc._id.toString(),
      activityType: doc.activityType,
      entityId: doc.entityId,
      entityType: doc.entityType,
      userId: doc.userId.toString(),
      username: doc.username,
      isPublic: doc.isPublic,
      isVisible: doc.isVisible,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}