import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WordView, WordViewDocument } from '../../users/schemas/word-view.schema';
import { 
  IWordViewRepository, 
  CreateWordViewData, 
  UpdateWordViewData 
} from '../interfaces/word-view.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 👁️ REPOSITORY WORD VIEW - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository WordView utilisant Mongoose.
 * Gère toutes les opérations de base de données pour le tracking des vues.
 */
@Injectable()
export class WordViewRepository implements IWordViewRepository {
  constructor(
    @InjectModel(WordView.name) private wordViewModel: Model<WordViewDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(viewData: CreateWordViewData): Promise<WordView> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const view = new this.wordViewModel({
          ...viewData,
          userId: new Types.ObjectId(viewData.userId),
          wordId: new Types.ObjectId(viewData.wordId),
          viewCount: 1,
          viewedAt: new Date(),
          lastViewedAt: new Date(),
        });
        return view.save();
      },
      'WordView'
    );
  }

  async findById(id: string): Promise<WordView | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.wordViewModel.findById(id).exec();
      },
      'WordView',
      id
    );
  }

  async update(id: string, updateData: UpdateWordViewData): Promise<WordView | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.wordViewModel
          .findByIdAndUpdate(
            id, 
            { ...updateData, lastViewedAt: new Date() }, 
            { new: true }
          )
          .exec();
      },
      'WordView',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.wordViewModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'WordView',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findByUser(userId: string, options: {
    page?: number;
    limit?: number;
    sortBy?: 'viewedAt' | 'viewCount' | 'word';
    sortOrder?: 'asc' | 'desc';
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
  } = {}): Promise<{
    views: WordView[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          sortBy = 'lastViewedAt',
          sortOrder = 'desc',
          language,
          viewType
        } = options;

        const filter: any = { userId: new Types.ObjectId(userId) };
        if (language) {
          filter.language = language;
        }
        if (viewType) {
          filter.viewType = viewType;
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [views, total] = await Promise.all([
          this.wordViewModel
            .find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.wordViewModel.countDocuments(filter).exec(),
        ]);

        return { views, total, page, limit };
      },
      'WordView'
    );
  }

  async findByWord(wordId: string, options: {
    page?: number;
    limit?: number;
    userId?: string;
    viewType?: 'search' | 'detail' | 'favorite';
  } = {}): Promise<{
    views: WordView[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { page = 1, limit = 10, userId, viewType } = options;

        const filter: any = { wordId: new Types.ObjectId(wordId) };
        if (userId) {
          filter.userId = new Types.ObjectId(userId);
        }
        if (viewType) {
          filter.viewType = viewType;
        }

        const [views, total] = await Promise.all([
          this.wordViewModel
            .find(filter)
            .sort({ lastViewedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.wordViewModel.countDocuments(filter).exec(),
        ]);

        return { views, total, page, limit };
      },
      'WordView'
    );
  }

  async findByUserAndWord(userId: string, wordId: string): Promise<WordView | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(wordId)) {
          return null;
        }
        return this.wordViewModel.findOne({
          userId: new Types.ObjectId(userId),
          wordId: new Types.ObjectId(wordId),
        }).exec();
      },
      'WordView',
      `${userId}-${wordId}`
    );
  }

  async findRecentByUser(userId: string, limit: number = 10): Promise<WordView[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.wordViewModel
          .find({ userId: new Types.ObjectId(userId) })
          .sort({ lastViewedAt: -1 })
          .limit(limit)
          .exec();
      },
      'WordView'
    );
  }

  async searchByWord(wordQuery: string, options: {
    userId?: string;
    language?: string;
    limit?: number;
  } = {}): Promise<WordView[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { userId, language, limit = 10 } = options;
        const searchRegex = new RegExp(wordQuery, 'i');

        const filter: any = { word: { $regex: searchRegex } };
        if (userId) {
          filter.userId = new Types.ObjectId(userId);
        }
        if (language) {
          filter.language = language;
        }

        return this.wordViewModel
          .find(filter)
          .sort({ lastViewedAt: -1 })
          .limit(limit)
          .exec();
      },
      'WordView'
    );
  }

  // ========== STATISTIQUES ==========

  async countByUser(userId: string, options: {
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const { language, viewType, startDate, endDate } = options;

        const filter: any = { userId: new Types.ObjectId(userId) };
        if (language) {
          filter.language = language;
        }
        if (viewType) {
          filter.viewType = viewType;
        }
        if (startDate || endDate) {
          filter.viewedAt = {};
          if (startDate) filter.viewedAt.$gte = startDate;
          if (endDate) filter.viewedAt.$lte = endDate;
        }

        return this.wordViewModel.countDocuments(filter).exec();
      },
      'WordView',
      userId
    );
  }

  async countByWord(wordId: string, options: {
    uniqueUsers?: boolean;
    viewType?: 'search' | 'detail' | 'favorite';
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const { uniqueUsers = false, viewType, startDate, endDate } = options;

        const matchStage: any = { wordId: new Types.ObjectId(wordId) };
        if (viewType) {
          matchStage.viewType = viewType;
        }
        if (startDate || endDate) {
          matchStage.viewedAt = {};
          if (startDate) matchStage.viewedAt.$gte = startDate;
          if (endDate) matchStage.viewedAt.$lte = endDate;
        }

        if (uniqueUsers) {
          const pipeline = [
            { $match: matchStage },
            { $group: { _id: '$userId' } },
            { $count: 'uniqueUsers' }
          ];
          const result = await this.wordViewModel.aggregate(pipeline).exec();
          return result[0]?.uniqueUsers || 0;
        } else {
          return this.wordViewModel.countDocuments(matchStage).exec();
        }
      },
      'WordView',
      wordId
    );
  }

  async countTotal(options: {
    uniqueUsers?: boolean;
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const { uniqueUsers = false, language, viewType, startDate, endDate } = options;

        const matchStage: any = {};
        if (language) {
          matchStage.language = language;
        }
        if (viewType) {
          matchStage.viewType = viewType;
        }
        if (startDate || endDate) {
          matchStage.viewedAt = {};
          if (startDate) matchStage.viewedAt.$gte = startDate;
          if (endDate) matchStage.viewedAt.$lte = endDate;
        }

        if (uniqueUsers) {
          const pipeline = [
            { $match: matchStage },
            { $group: { _id: '$userId' } },
            { $count: 'uniqueUsers' }
          ];
          const result = await this.wordViewModel.aggregate(pipeline).exec();
          return result[0]?.uniqueUsers || 0;
        } else {
          return this.wordViewModel.countDocuments(matchStage).exec();
        }
      },
      'WordView',
      'global'
    );
  }

  async getMostViewedWords(options: {
    language?: string;
    viewType?: 'search' | 'detail' | 'favorite';
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  } = {}): Promise<Array<{
    wordId: string;
    word: string;
    language: string;
    viewCount: number;
    uniqueUsers: number;
  }>> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const { language, viewType, timeframe = 'all', limit = 10 } = options;

        const matchStage: any = {};
        if (language) {
          matchStage.language = language;
        }
        if (viewType) {
          matchStage.viewType = viewType;
        }

        // Filtrer par période
        if (timeframe !== 'all') {
          const now = new Date();
          let startDate: Date;
          
          switch (timeframe) {
            case 'day':
              startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              break;
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
          }
          matchStage.viewedAt = { $gte: startDate };
        }

        const pipeline = [
          { $match: matchStage },
          {
            $group: {
              _id: {
                wordId: '$wordId',
                word: '$word',
                language: '$language'
              },
              viewCount: { $sum: '$viewCount' },
              uniqueUsers: { $addToSet: '$userId' }
            }
          },
          {
            $project: {
              wordId: { $toString: '$_id.wordId' },
              word: '$_id.word',
              language: '$_id.language',
              viewCount: 1,
              uniqueUsers: { $size: '$uniqueUsers' }
            }
          },
          { $sort: { viewCount: -1 } },
          { $limit: limit }
        ];

        return this.wordViewModel.aggregate(pipeline).exec();
      },
      'WordView',
      'mostViewed'
    );
  }

  async getMostActiveUsers(options: {
    language?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  } = {}): Promise<Array<{
    userId: string;
    viewCount: number;
    uniqueWords: number;
    lastActivity: Date;
  }>> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const { language, timeframe = 'all', limit = 10 } = options;

        const matchStage: any = {};
        if (language) {
          matchStage.language = language;
        }

        // Filtrer par période
        if (timeframe !== 'all') {
          const now = new Date();
          let startDate: Date;
          
          switch (timeframe) {
            case 'day':
              startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
              break;
            case 'week':
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case 'month':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
          }
          matchStage.viewedAt = { $gte: startDate };
        }

        const pipeline = [
          { $match: matchStage },
          {
            $group: {
              _id: '$userId',
              viewCount: { $sum: '$viewCount' },
              uniqueWords: { $addToSet: '$wordId' },
              lastActivity: { $max: '$lastViewedAt' }
            }
          },
          {
            $project: {
              userId: { $toString: '$_id' },
              viewCount: 1,
              uniqueWords: { $size: '$uniqueWords' },
              lastActivity: 1
            }
          },
          { $sort: { viewCount: -1 } },
          { $limit: limit }
        ];

        return this.wordViewModel.aggregate(pipeline).exec();
      },
      'WordView',
      'mostActive'
    );
  }

  // ========== ANALYTICS ==========

  async getUserActivityStats(userId: string): Promise<{
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
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const pipeline = [
          { $match: { userId: new Types.ObjectId(userId) } },
          {
            $facet: {
              totalStats: [
                {
                  $group: {
                    _id: null,
                    totalViews: { $sum: '$viewCount' },
                    uniqueWords: { $addToSet: '$wordId' },
                    languagesViewed: { $addToSet: '$language' },
                    firstView: { $min: '$viewedAt' }
                  }
                }
              ],
              languageStats: [
                {
                  $group: {
                    _id: '$language',
                    count: { $sum: '$viewCount' }
                  }
                },
                { $sort: { count: -1 } },
                { $limit: 1 }
              ],
              wordStats: [
                {
                  $group: {
                    _id: {
                      wordId: '$wordId',
                      word: '$word'
                    },
                    viewCount: { $sum: '$viewCount' }
                  }
                },
                { $sort: { viewCount: -1 } },
                { $limit: 5 },
                {
                  $project: {
                    wordId: { $toString: '$_id.wordId' },
                    word: '$_id.word',
                    viewCount: 1
                  }
                }
              ],
              typeStats: [
                {
                  $group: {
                    _id: '$viewType',
                    count: { $sum: '$viewCount' }
                  }
                }
              ]
            }
          }
        ];

        const result = await this.wordViewModel.aggregate(pipeline).exec();
        const stats = result[0];

        const totalStats = stats.totalStats[0] || {};
        const favoriteLanguage = stats.languageStats[0]?._id || '';
        const mostViewedWords = stats.wordStats || [];
        
        const activityByType = {
          search: 0,
          detail: 0,
          favorite: 0
        };
        stats.typeStats.forEach((stat: any) => {
          if (activityByType.hasOwnProperty(stat._id)) {
            activityByType[stat._id as keyof typeof activityByType] = stat.count;
          }
        });

        // Calculer la moyenne par jour
        const daysSinceFirstView = totalStats.firstView 
          ? Math.max(1, Math.ceil((Date.now() - totalStats.firstView.getTime()) / (1000 * 60 * 60 * 24)))
          : 1;

        return {
          totalViews: totalStats.totalViews || 0,
          uniqueWords: totalStats.uniqueWords?.length || 0,
          languagesViewed: totalStats.languagesViewed || [],
          favoriteLanguage,
          averageViewsPerDay: Math.round((totalStats.totalViews || 0) / daysSinceFirstView * 100) / 100,
          mostViewedWords,
          activityByType
        };
      },
      'WordView',
      userId
    );
  }

  async getGlobalStats(): Promise<{
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
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const pipeline = [
          {
            $facet: {
              generalStats: [
                {
                  $group: {
                    _id: null,
                    totalViews: { $sum: '$viewCount' },
                    uniqueUsers: { $addToSet: '$userId' },
                    uniqueWords: { $addToSet: '$wordId' }
                  }
                }
              ],
              languageStats: [
                {
                  $group: {
                    _id: '$language',
                    viewCount: { $sum: '$viewCount' },
                    uniqueUsers: { $addToSet: '$userId' }
                  }
                },
                {
                  $project: {
                    language: '$_id',
                    viewCount: 1,
                    uniqueUsers: { $size: '$uniqueUsers' }
                  }
                },
                { $sort: { viewCount: -1 } },
                { $limit: 10 }
              ],
              typeStats: [
                {
                  $group: {
                    _id: '$viewType',
                    count: { $sum: '$viewCount' }
                  }
                }
              ]
            }
          }
        ];

        const result = await this.wordViewModel.aggregate(pipeline).exec();
        const stats = result[0];

        const generalStats = stats.generalStats[0] || {};
        const topLanguages = stats.languageStats || [];
        
        const viewsByType = {
          search: 0,
          detail: 0,
          favorite: 0
        };
        stats.typeStats.forEach((stat: any) => {
          if (viewsByType.hasOwnProperty(stat._id)) {
            viewsByType[stat._id as keyof typeof viewsByType] = stat.count;
          }
        });

        const totalViews = generalStats.totalViews || 0;
        const uniqueUsers = generalStats.uniqueUsers?.length || 0;
        const uniqueWords = generalStats.uniqueWords?.length || 0;

        return {
          totalViews,
          uniqueUsers,
          uniqueWords,
          averageViewsPerUser: uniqueUsers > 0 ? Math.round(totalViews / uniqueUsers * 100) / 100 : 0,
          averageViewsPerWord: uniqueWords > 0 ? Math.round(totalViews / uniqueWords * 100) / 100 : 0,
          topLanguages,
          viewsByType
        };
      },
      'WordView',
      'global'
    );
  }

  // ========== NETTOYAGE ==========

  async deleteOldViews(daysOld: number): Promise<{ deletedCount: number }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.wordViewModel.deleteMany({
          viewedAt: { $lt: cutoffDate }
        }).exec();

        return { deletedCount: result.deletedCount || 0 };
      },
      'WordView',
      `older-than-${daysOld}-days`
    );
  }

  async cleanupOrphanedViews(): Promise<{ deletedCount: number }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Cette méthode nécessiterait des jointures avec d'autres collections
        // Pour l'instant, on simule le nettoyage
        // TODO: Implémenter avec aggregation pour vérifier l'existence des mots/utilisateurs
        return { deletedCount: 0 };
      },
      'WordView',
      'orphaned'
    );
  }

  async archiveOldViews(daysOld: number): Promise<{ archivedCount: number }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await this.wordViewModel.updateMany(
          { viewedAt: { $lt: cutoffDate }, archived: { $ne: true } },
          { archived: true, archivedAt: new Date() }
        ).exec();

        return { archivedCount: result.modifiedCount || 0 };
      },
      'WordView',
      `archive-older-than-${daysOld}-days`
    );
  }
}