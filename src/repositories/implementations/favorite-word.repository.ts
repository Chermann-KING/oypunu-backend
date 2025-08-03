import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { 
  IFavoriteWordRepository,
  FavoriteWord,
  FavoriteWordStats,
  UserFavoritesSummary
} from '../interfaces/favorite-word.repository.interface';
import { Word } from '../../dictionary/schemas/word.schema';
import { DatabaseErrorHandler } from "../../common/errors";
import { ApplicationErrorHandler } from '../../common/errors';

// Schema pour FavoriteWord
const favoriteWordSchema = {
  userId: { type: String, required: true, index: true },
  wordId: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  notes: { type: String, maxlength: 500 },
  tags: [{ type: String, maxlength: 50 }],
  isPublic: { type: Boolean, default: false, index: true }
};

@Injectable()
export class FavoriteWordRepository implements IFavoriteWordRepository {
  private readonly errorHandler = new ApplicationErrorHandler();

  constructor(
    @InjectModel('FavoriteWord') private favoriteWordModel: Model<FavoriteWord>,
    @InjectModel(Word.name) private wordModel: Model<Word>
  ) {}

  async addToFavorites(
    userId: string,
    wordId: string,
    options?: {
      notes?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<FavoriteWord> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier si déjà en favoris
        const existing = await this.favoriteWordModel.findOne({
          userId,
          wordId
        });

        if (existing) {
          throw this.errorHandler.createFavoriteError(true, wordId, 'addToFavorites');
        }

        // Vérifier que le mot existe
        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw this.errorHandler.createNotFoundError('Mot', wordId, 'addToFavorites');
        }

        const favorite = new this.favoriteWordModel({
          userId,
          wordId,
          notes: options?.notes,
          tags: options?.tags || [],
          isPublic: options?.isPublic || false,
          createdAt: new Date()
        });

        return await favorite.save();
      },
      'FavoriteWord',
      userId
    );
  }

  async removeFromFavorites(userId: string, wordId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.favoriteWordModel.deleteOne({
          userId,
          wordId
        });
        return result.deletedCount > 0;
      },
      'FavoriteWord',
      userId,
      wordId
    );
  }

  async isFavorite(userId: string, wordId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const favorite = await this.favoriteWordModel.findOne({
          userId,
          wordId
        });
        return !!favorite;
      },
      'FavoriteWord',
      userId
    );
  }

  async getUserFavorites(
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
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        // Construire le filtre
        const filter: any = { userId };
        
        if (options?.isPublic !== undefined) {
          filter.isPublic = options.isPublic;
        }
        
        if (options?.tags && options.tags.length > 0) {
          filter.tags = { $in: options.tags };
        }

        // Pipeline d'agrégation pour joindre avec les mots
        const pipeline = [
          { $match: filter },
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'wordDetails'
            }
          },
          { $unwind: '$wordDetails' },
          {
            $match: {
              'wordDetails.status': 'approved',
              ...(options?.language && { 'wordDetails.language': options.language }),
              ...(options?.category && { 'wordDetails.categoryId': options.category })
            }
          },
          {
            $addFields: {
              'wordDetails.id': { $toString: '$wordDetails._id' },
              'wordDetails.definition': {
                $arrayElemAt: [
                  '$wordDetails.meanings.definitions.definition',
                  0
                ]
              }
            }
          }
        ];

        // Tri
        const sortField = options?.sortBy || 'createdAt';
        const sortOrder = options?.sortOrder === 'asc' ? 1 : -1;
        
        if (sortField === 'word') {
          pipeline.push({ $sort: { 'wordDetails.word': sortOrder } } as any);
        } else if (sortField === 'language') {
          pipeline.push({ $sort: { 'wordDetails.language': sortOrder } } as any);
        } else {
          pipeline.push({ $sort: { [sortField]: sortOrder } } as any);
        }

        // Pagination
        pipeline.push({ $skip: skip } as any, { $limit: limit } as any);

        const [favorites, totalCount] = await Promise.all([
          this.favoriteWordModel.aggregate(pipeline as any),
          this.favoriteWordModel.countDocuments(filter)
        ]);

        return {
          favorites: favorites.map(fav => ({
            ...fav,
            wordDetails: {
              id: fav.wordDetails.id,
              word: fav.wordDetails.word,
              language: fav.wordDetails.language,
              definition: fav.wordDetails.definition || 'Définition non disponible',
              category: fav.wordDetails.categoryId
            }
          })),
          total: totalCount,
          page,
          limit
        };
      },
      'FavoriteWord',
      userId
    );
  }

  async countUserFavorites(
    userId: string,
    filters?: {
      language?: string;
      category?: string;
      isPublic?: boolean;
    }
  ): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const matchFilter: any = { userId };
        
        if (filters?.isPublic !== undefined) {
          matchFilter.isPublic = filters.isPublic;
        }

        if (!filters?.language && !filters?.category) {
          return await this.favoriteWordModel.countDocuments(matchFilter);
        }

        // Utiliser l'agrégation si on a besoin de filtrer par langue/catégorie
        const pipeline = [
          { $match: matchFilter },
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'word'
            }
          },
          { $unwind: '$word' },
          {
            $match: {
              'word.status': 'approved',
              ...(filters?.language && { 'word.language': filters.language }),
              ...(filters?.category && { 'word.categoryId': filters.category })
            }
          },
          { $count: 'total' }
        ];

        const result = await this.favoriteWordModel.aggregate(pipeline);
        return result[0]?.total || 0;
      },
      'FavoriteWord',
      userId
    );
  }

  async getUserFavoritesStats(userId: string): Promise<UserFavoritesSummary> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const pipeline = [
          { $match: { userId } },
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'word'
            }
          },
          { $unwind: '$word' },
          { $match: { 'word.status': 'approved' } },
          {
            $group: {
              _id: null,
              totalCount: { $sum: 1 },
              languageDistribution: {
                $push: '$word.language'
              },
              categoryDistribution: {
                $push: '$word.categoryId'
              },
              recentlyAdded: {
                $push: {
                  $cond: [
                    { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                    {
                      wordId: { $toString: '$wordId' },
                      word: '$word.word',
                      language: '$word.language',
                      addedAt: '$createdAt'
                    },
                    null
                  ]
                }
              }
            }
          }
        ];

        const result = await this.favoriteWordModel.aggregate(pipeline);
        const stats = result[0];

        if (!stats) {
          return {
            totalCount: 0,
            languageDistribution: {},
            categoryDistribution: {},
            recentlyAdded: [],
            mostViewedFavorites: []
          };
        }

        // Convertir les arrays en objets de comptage
        const languageDistribution = stats.languageDistribution.reduce((acc: any, lang: string) => {
          acc[lang] = (acc[lang] || 0) + 1;
          return acc;
        }, {});

        const categoryDistribution = stats.categoryDistribution.reduce((acc: any, cat: string) => {
          if (cat) acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});

        return {
          totalCount: stats.totalCount,
          languageDistribution,
          categoryDistribution,
          recentlyAdded: stats.recentlyAdded
            .filter((item: any) => item !== null)
            .sort((a: any, b: any) => b.addedAt - a.addedAt)
            .slice(0, 10),
          mostViewedFavorites: [] // TODO: Implémenter avec WordViewRepository
        };
      },
      'FavoriteWord',
      userId
    );
  }

  async getMostFavoritedWords(options?: {
    limit?: number;
    language?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
  }): Promise<Array<{
    wordId: string;
    word: string;
    language: string;
    favoriteCount: number;
    recentFavorites: number;
  }>> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const limit = options?.limit || 10;
        const timeframe = options?.timeframe || 'all';
        
        // Calculer la date de début selon le timeframe
        let dateFilter = {};
        if (timeframe !== 'all') {
          const days = { day: 1, week: 7, month: 30 }[timeframe];
          const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          dateFilter = { createdAt: { $gte: startDate } };
        }

        const pipeline = [
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'word'
            }
          },
          { $unwind: '$word' },
          {
            $match: {
              'word.status': 'approved',
              ...(options?.language && { 'word.language': options.language })
            }
          },
          {
            $group: {
              _id: '$wordId',
              word: { $first: '$word.word' },
              language: { $first: '$word.language' },
              favoriteCount: { $sum: 1 },
              recentFavorites: {
                $sum: {
                  $cond: [
                    { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                    1,
                    0
                  ]
                }
              }
            }
          },
          { $sort: { favoriteCount: -1 } },
          { $limit: limit },
          {
            $project: {
              wordId: { $toString: '$_id' },
              word: 1,
              language: 1,
              favoriteCount: 1,
              recentFavorites: 1,
              _id: 0
            }
          }
        ];

        return await this.favoriteWordModel.aggregate(pipeline as any);
      },
      'FavoriteWord',
      'most-favorited'
    );
  }

  async getPublicFavorites(
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
  }> {
    const result = await this.getUserFavorites(userId, {
      ...options,
      isPublic: true
    });

    return {
      favorites: result.favorites,
      total: result.total
    };
  }

  async searchUserFavorites(
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
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        const searchRegex = new RegExp(query, 'i');

        const pipeline = [
          { $match: { userId } },
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'wordDetails'
            }
          },
          { $unwind: '$wordDetails' },
          {
            $match: {
              'wordDetails.status': 'approved',
              ...(options?.language && { 'wordDetails.language': options.language }),
              $or: [
                { 'wordDetails.word': searchRegex },
                { 'wordDetails.meanings.definitions.definition': searchRegex },
                { notes: searchRegex },
                { tags: { $in: [searchRegex] } }
              ]
            }
          },
          {
            $addFields: {
              'wordDetails.id': { $toString: '$wordDetails._id' },
              'wordDetails.definition': {
                $arrayElemAt: ['$wordDetails.meanings.definitions.definition', 0]
              }
            }
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit }
        ];

        const countPipeline = [...pipeline];
        countPipeline.splice(-2); // Enlever skip et limit
        countPipeline.push({ $count: 'total' } as any);

        const [favorites, countResult] = await Promise.all([
          this.favoriteWordModel.aggregate(pipeline as any),
          this.favoriteWordModel.aggregate(countPipeline as any)
        ]);

        return {
          favorites: favorites.map(fav => ({
            ...fav,
            wordDetails: {
              id: fav.wordDetails.id,
              word: fav.wordDetails.word,
              language: fav.wordDetails.language,
              definition: fav.wordDetails.definition || 'Définition non disponible'
            }
          })),
          total: countResult[0]?.total || 0
        };
      },
      'FavoriteWord'
    );
  }

  async updateFavoriteMetadata(
    userId: string,
    wordId: string,
    updates: {
      notes?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<FavoriteWord | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updated = await this.favoriteWordModel.findOneAndUpdate(
          { userId, wordId },
          { $set: updates },
          { new: true }
        );
        return updated;
      },
      'FavoriteWord',
      userId,
      wordId
    );
  }

  async getFavoritesByTags(
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
  }> {
    const result = await this.getUserFavorites(userId, {
      ...options,
      tags
    });

    return {
      favorites: result.favorites,
      total: result.total
    };
  }

  async getUserFavoriteTags(userId: string): Promise<Array<{
    tag: string;
    count: number;
  }>> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const pipeline = [
          { $match: { userId } },
          { $unwind: '$tags' },
          {
            $group: {
              _id: '$tags',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          {
            $project: {
              tag: '$_id',
              count: 1,
              _id: 0
            }
          }
        ];

        return await this.favoriteWordModel.aggregate(pipeline as any);
      },
      'FavoriteWord',
      userId
    );
  }

  async exportUserFavorites(
    userId: string,
    format: 'json' | 'csv'
  ): Promise<string> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const favorites = await this.getUserFavorites(userId, { limit: 10000 });
        
        if (format === 'json') {
          return JSON.stringify(favorites.favorites, null, 2);
        }
        
        // Format CSV
        const csvHeaders = 'Word,Language,Definition,Notes,Tags,Public,Added Date\n';
        const csvRows = favorites.favorites.map(fav => {
          const tags = fav.tags?.join(';') || '';
          const notes = (fav.notes || '').replace(/"/g, '""');
          const definition = (fav.wordDetails.definition || '').replace(/"/g, '""');
          
          return `"${fav.wordDetails.word}","${fav.wordDetails.language}","${definition}","${notes}","${tags}","${fav.isPublic}","${fav.createdAt}"`;
        }).join('\n');
        
        return csvHeaders + csvRows;
      },
      'FavoriteWord',
      userId
    );
  }

  async getGlobalFavoritesStats(): Promise<FavoriteWordStats> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const [generalStats, languageStats, recentStats] = await Promise.all([
          // Stats générales
          this.favoriteWordModel.aggregate([
            {
              $group: {
                _id: null,
                totalFavorites: { $sum: 1 },
                publicFavorites: {
                  $sum: { $cond: [{ $eq: ['$isPublic', true] }, 1, 0] }
                },
                privateFavorites: {
                  $sum: { $cond: [{ $eq: ['$isPublic', false] }, 1, 0] }
                }
              }
            }
          ]),
          
          // Stats par langue
          this.favoriteWordModel.aggregate([
            {
              $lookup: {
                from: 'words',
                localField: 'wordId',
                foreignField: '_id',
                as: 'word'
              }
            },
            { $unwind: '$word' },
            {
              $group: {
                _id: '$word.language',
                count: { $sum: 1 }
              }
            }
          ]),
          
          // Stats d'activité récente
          this.favoriteWordModel.aggregate([
            {
              $group: {
                _id: null,
                thisWeek: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                      1,
                      0
                    ]
                  }
                },
                thisMonth: {
                  $sum: {
                    $cond: [
                      { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ])
        ]);

        const general = generalStats[0] || { totalFavorites: 0, publicFavorites: 0, privateFavorites: 0 };
        const recent = recentStats[0] || { thisWeek: 0, thisMonth: 0 };

        const favoritesByLanguage = languageStats.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {});

        return {
          totalFavorites: general.totalFavorites,
          publicFavorites: general.publicFavorites,
          privateFavorites: general.privateFavorites,
          favoritesByLanguage,
          favoritesByCategory: {}, // TODO: Implémenter avec catégories
          recentActivity: {
            thisWeek: recent.thisWeek,
            thisMonth: recent.thisMonth
          }
        };
      },
      'FavoriteWord',
      'global-stats'
    );
  }

  // ========== MÉTHODES ALIAS POUR COMPATIBILITÉ ==========

  /**
   * Alias pour getUserFavorites (pour compatibilité)
   */
  async findByUser(
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
  }> {
    // Convertir les paramètres offset/limit vers page/limit
    const page = options?.page || (options?.offset ? Math.floor(options.offset / (options.limit || 10)) + 1 : 1);
    const limit = options?.limit || 10;

    const result = await this.getUserFavorites(userId, {
      page,
      limit,
      sortBy: options?.sortBy,
      sortOrder: options?.sortOrder
    });

    return {
      favorites: result.favorites.map(fav => ({
        ...fav,
        wordDetails: fav.wordDetails
      })) as any,
      total: result.total
    };
  }

  /**
   * Compter les favoris pour un mot spécifique
   */
  async countByWord(wordId: string): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.favoriteWordModel.countDocuments({ wordId });
      },
      'FavoriteWord',
      wordId
    );
  }

  /**
   * Alias pour isFavorite (pour compatibilité)
   */
  async isFavorited(userId: string, wordId: string): Promise<boolean> {
    return this.isFavorite(userId, wordId);
  }
}