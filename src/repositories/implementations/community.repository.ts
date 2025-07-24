import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Community, CommunityDocument } from '../../communities/schemas/community.schema';
import { ICommunityRepository } from '../interfaces/community.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 🏘️ REPOSITORY COMMUNITY - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository Community utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les communautés.
 * 
 * Fonctionnalités :
 * - CRUD complet des communautés
 * - Recherche et filtrage avancés
 * - Gestion des membres et statistiques
 * - Validation et modération
 * - Optimisations de performance
 */
@Injectable()
export class CommunityRepository implements ICommunityRepository {
  constructor(
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(communityData: {
    name: string;
    language: string;
    description?: string;
    createdBy: string;
    tags?: string[];
    isPrivate?: boolean;
    coverImage?: string;
  }): Promise<Community> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const newCommunity = new this.communityModel({
          ...communityData,
          memberCount: 1, // Le créateur est automatiquement membre
          tags: communityData.tags || [],
          isPrivate: communityData.isPrivate || false,
        });
        return newCommunity.save();
      },
      'Community'
    );
  }

  async findById(id: string): Promise<Community | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityModel.findById(id).populate('createdBy', 'username email').exec();
      },
      'Community',
      id
    );
  }

  async update(id: string, updateData: Partial<Community>): Promise<Community | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate('createdBy', 'username email')
          .exec();
      },
      'Community',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.communityModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'Community',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async search(query: string, options: {
    language?: string;
    includePrivate?: boolean;
    limit?: number;
    skip?: number;
  } = {}): Promise<{ communities: Community[]; total: number; }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { language, includePrivate = false, limit = 20, skip = 0 } = options;

        const filter: any = {
          $text: { $search: query }
        };

        if (language) {
          filter.language = language;
        }

        if (!includePrivate) {
          filter.isPrivate = false;
        }

        const [communities, total] = await Promise.all([
          this.communityModel
            .find(filter)
            .populate('createdBy', 'username email')
            .sort({ score: { $meta: 'textScore' }, memberCount: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.communityModel.countDocuments(filter).exec(),
        ]);

        return { communities, total };
      },
      'Community'
    );
  }

  async findByLanguage(language: string, options: {
    includePrivate?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'memberCount' | 'createdAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          includePrivate = false,
          page = 1,
          limit = 20,
          sortBy = 'memberCount',
          sortOrder = 'desc'
        } = options;

        const filter: any = { language };
        if (!includePrivate) {
          filter.isPrivate = false;
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [communities, total] = await Promise.all([
          this.communityModel
            .find(filter)
            .populate('createdBy', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.communityModel.countDocuments(filter).exec(),
        ]);

        return { communities, total, page, limit };
      },
      'Community'
    );
  }

  async findByTags(tags: string[], options: {
    includePrivate?: boolean;
    limit?: number;
  } = {}): Promise<Community[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { includePrivate = false, limit = 20 } = options;

        const filter: any = {
          tags: { $in: tags }
        };

        if (!includePrivate) {
          filter.isPrivate = false;
        }

        return this.communityModel
          .find(filter)
          .populate('createdBy', 'username email')
          .sort({ memberCount: -1 })
          .limit(limit)
          .exec();
      },
      'Community'
    );
  }

  async findByName(name: string): Promise<Community | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.communityModel
          .findOne({ name })
          .populate('createdBy', 'username email')
          .exec();
      },
      'Community',
      name
    );
  }

  async existsByName(name: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const community = await this.communityModel.findOne({ name }).select('_id').exec();
        return community !== null;
      },
      'Community'
    );
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    includePrivate?: boolean;
    sortBy?: 'memberCount' | 'createdAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 20,
          includePrivate = false,
          sortBy = 'memberCount',
          sortOrder = 'desc'
        } = options;

        const filter: any = {};
        if (!includePrivate) {
          filter.isPrivate = false;
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [communities, total] = await Promise.all([
          this.communityModel
            .find(filter)
            .populate('createdBy', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.communityModel.countDocuments(filter).exec(),
        ]);

        return { communities, total, page, limit };
      },
      'Community'
    );
  }

  // ========== GESTION DES MEMBRES ==========

  async incrementMemberCount(id: string): Promise<Community | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityModel
          .findByIdAndUpdate(id, { $inc: { memberCount: 1 } }, { new: true })
          .populate('createdBy', 'username email')
          .exec();
      },
      'Community',
      id
    );
  }

  async decrementMemberCount(id: string): Promise<Community | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityModel
          .findByIdAndUpdate(
            id,
            { $inc: { memberCount: -1 } },
            { new: true }
          )
          .populate('createdBy', 'username email')
          .exec();
      },
      'Community',
      id
    );
  }

  async updateMemberCount(id: string, count: number): Promise<Community | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityModel
          .findByIdAndUpdate(id, { memberCount: Math.max(0, count) }, { new: true })
          .populate('createdBy', 'username email')
          .exec();
      },
      'Community',
      id
    );
  }

  async findByCreator(creatorId: string, options: {
    page?: number;
    limit?: number;
  } = {}): Promise<{ communities: Community[]; total: number; }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(creatorId)) {
          return { communities: [], total: 0 };
        }

        const { page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;

        const [communities, total] = await Promise.all([
          this.communityModel
            .find({ createdBy: creatorId })
            .populate('createdBy', 'username email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.communityModel.countDocuments({ createdBy: creatorId }).exec(),
        ]);

        return { communities, total };
      },
      'Community'
    );
  }

  // ========== STATISTIQUES ==========

  async getMostPopular(limit: number = 10, language?: string): Promise<Community[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const filter: any = { isPrivate: false };
        if (language) {
          filter.language = language;
        }

        return this.communityModel
          .find(filter)
          .populate('createdBy', 'username email')
          .sort({ memberCount: -1 })
          .limit(limit)
          .exec();
      },
      'Community'
    );
  }

  async getRecent(limit: number = 10, language?: string): Promise<Community[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const filter: any = { isPrivate: false };
        if (language) {
          filter.language = language;
        }

        return this.communityModel
          .find(filter)
          .populate('createdBy', 'username email')
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'Community'
    );
  }

  async countByLanguage(): Promise<Record<string, number>> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const result = await this.communityModel
          .aggregate([
            { $match: { isPrivate: false } },
            { $group: { _id: '$language', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ])
          .exec();

        const languageCounts: Record<string, number> = {};
        result.forEach(item => {
          languageCounts[item._id] = item.count;
        });

        return languageCounts;
      },
      'Community'
    );
  }

  async getStats(id: string): Promise<{
    memberCount: number;
    postCount: number;
    activeMembers: number;
    createdAt: Date;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return {
            memberCount: 0,
            postCount: 0,
            activeMembers: 0,
            createdAt: new Date(0),
          };
        }

        const community = await this.communityModel.findById(id).exec();
        if (!community) {
          return {
            memberCount: 0,
            postCount: 0,
            activeMembers: 0,
            createdAt: new Date(0),
          };
        }

        // Note: postCount et activeMembers nécessiteraient des jointures avec d'autres repositories
        // Pour l'instant, retourner les données disponibles
        return {
          memberCount: community.memberCount,
          postCount: 0, // À implémenter avec PostRepository
          activeMembers: 0, // À implémenter avec CommunityMemberRepository
          createdAt: community.createdAt,
        };
      },
      'Community'
    );
  }

  async getGlobalStats(): Promise<{
    totalCommunities: number;
    totalMembers: number;
    averageMembersPerCommunity: number;
    topLanguages: Array<{ language: string; count: number }>;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const [
          totalCommunities,
          memberStats,
          languageStats
        ] = await Promise.all([
          this.communityModel.countDocuments().exec(),
          this.communityModel
            .aggregate([
              { $group: { _id: null, totalMembers: { $sum: '$memberCount' } } }
            ])
            .exec(),
          this.communityModel
            .aggregate([
              { $group: { _id: '$language', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 10 }
            ])
            .exec(),
        ]);

        const totalMembers = memberStats[0]?.totalMembers || 0;
        const averageMembersPerCommunity = totalCommunities > 0 ? totalMembers / totalCommunities : 0;

        const topLanguages = languageStats.map(item => ({
          language: item._id,
          count: item.count
        }));

        return {
          totalCommunities,
          totalMembers,
          averageMembersPerCommunity: Math.round(averageMembersPerCommunity * 100) / 100,
          topLanguages,
        };
      },
      'Community'
    );
  }

  // ========== VALIDATION ET MODÉRATION ==========

  async isNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const filter: any = { name };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
          filter._id = { $ne: excludeId };
        }

        const community = await this.communityModel.findOne(filter).select('_id').exec();
        return community === null;
      },
      'Community'
    );
  }

  async findInactive(daysInactive: number): Promise<Community[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

        return this.communityModel
          .find({
            updatedAt: { $lt: cutoffDate },
            memberCount: { $lte: 1 } // Seul le créateur est membre
          })
          .populate('createdBy', 'username email')
          .sort({ updatedAt: 1 })
          .exec();
      },
      'Community'
    );
  }

  async togglePrivacy(id: string, isPrivate: boolean): Promise<Community | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityModel
          .findByIdAndUpdate(id, { isPrivate }, { new: true })
          .populate('createdBy', 'username email')
          .exec();
      },
      'Community',
      id
    );
  }

  async cleanupEmpty(): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.communityModel
          .deleteMany({ memberCount: { $lte: 0 } })
          .exec();
        return result.deletedCount || 0;
      },
      'Community',
      'empty-communities'
    );
  }
}