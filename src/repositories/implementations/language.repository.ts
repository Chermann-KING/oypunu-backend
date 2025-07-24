import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Language, LanguageDocument } from '../../languages/schemas/language.schema';
import { CreateLanguageDto } from '../../languages/dto/create-language.dto';
import { ILanguageRepository } from '../interfaces/language.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 🌍 REPOSITORY LANGUAGE - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository Language utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les langues.
 * 
 * Fonctionnalités :
 * - CRUD complet des langues
 * - Gestion du cycle de vie (pending/approved/rejected)
 * - Recherche et filtrage avancés
 * - Statistiques d'utilisation
 * - Validation et unicité
 */
@Injectable()
export class LanguageRepository implements ILanguageRepository {
  constructor(
    @InjectModel(Language.name) private languageModel: Model<LanguageDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(
    languageData: CreateLanguageDto,
    createdBy: string,
    status: 'pending' | 'approved' | 'rejected' = 'pending'
  ): Promise<Language> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const newLanguage = new this.languageModel({
          ...languageData,
          createdBy,
          status,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return newLanguage.save();
      },
      'Language'
    );
  }

  async findById(id: string): Promise<Language | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.languageModel.findById(id).exec();
      },
      'Language',
      id
    );
  }

  async findByNameOrCode(criteria: {
    name?: string;
    nativeName?: string;
    iso639_1?: string;
    iso639_2?: string;
    iso639_3?: string;
  }): Promise<Language | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const searchCriteria = [];
        
        if (criteria.name) {
          searchCriteria.push({ name: new RegExp(`^${criteria.name}$`, 'i') });
        }
        if (criteria.nativeName) {
          searchCriteria.push({ nativeName: new RegExp(`^${criteria.nativeName}$`, 'i') });
        }
        if (criteria.iso639_1) {
          searchCriteria.push({ iso639_1: criteria.iso639_1 });
        }
        if (criteria.iso639_2) {
          searchCriteria.push({ iso639_2: criteria.iso639_2 });
        }
        if (criteria.iso639_3) {
          searchCriteria.push({ iso639_3: criteria.iso639_3 });
        }

        if (searchCriteria.length === 0) {
          return null;
        }

        return this.languageModel.findOne({ $or: searchCriteria }).exec();
      },
      'Language'
    );
  }

  async findByCode(languageCode: string): Promise<Language | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.languageModel.findOne({
          $or: [
            { iso639_1: languageCode },
            { iso639_2: languageCode },
            { iso639_3: languageCode },
          ],
        }).exec();
      },
      'Language',
      languageCode
    );
  }

  async update(id: string, updateData: Partial<Language>): Promise<Language | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.languageModel
          .findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true }
          )
          .exec();
      },
      'Language',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.languageModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'Language',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    languages: Language[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          status = 'approved',
          sortBy = 'name',
          sortOrder = 'asc'
        } = options;

        // Construire le filtre
        const filter: any = {};
        if (status !== 'all') {
          filter.status = status;
        }

        // Construire le tri
        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Exécuter les requêtes en parallèle
        const [languages, total] = await Promise.all([
          this.languageModel
            .find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.languageModel.countDocuments(filter).exec(),
        ]);

        return {
          languages,
          total,
          page,
          limit,
        };
      },
      'Language'
    );
  }

  async searchByName(query: string, options: {
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected';
  } = {}): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { limit = 10, status = 'approved' } = options;
        const searchRegex = new RegExp(query, 'i');

        return this.languageModel
          .find({
            $and: [
              { status },
              {
                $or: [
                  { name: { $regex: searchRegex } },
                  { nativeName: { $regex: searchRegex } },
                ]
              }
            ]
          })
          .limit(limit)
          .sort({ name: 1 })
          .exec();
      },
      'Language'
    );
  }

  async findApproved(): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({ status: 'approved' })
          .sort({ name: 1 })
          .exec();
      },
      'Language'
    );
  }

  async findPending(): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({ status: 'pending' })
          .sort({ createdAt: -1 })
          .exec();
      },
      'Language'
    );
  }

  // ========== GESTION DU STATUT ==========

  async approve(id: string, approvedBy: string, reason?: string): Promise<Language | null> {
    return this.updateStatus(id, 'approved', approvedBy, reason);
  }

  async reject(id: string, rejectedBy: string, reason: string): Promise<Language | null> {
    return this.updateStatus(id, 'rejected', rejectedBy, reason);
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected',
    updatedBy: string,
    reason?: string
  ): Promise<Language | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }

        const updateData: any = {
          status,
          updatedAt: new Date(),
        };

        if (status === 'approved') {
          updateData.approvedBy = updatedBy;
          updateData.approvedAt = new Date();
          if (reason) updateData.approvalReason = reason;
        } else if (status === 'rejected') {
          updateData.rejectedBy = updatedBy;
          updateData.rejectedAt = new Date();
          updateData.rejectionReason = reason;
        }

        return this.languageModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .exec();
      },
      'Language',
      id
    );
  }

  // ========== STATISTIQUES ==========

  async countByStatus(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const [pending, approved, rejected] = await Promise.all([
          this.languageModel.countDocuments({ status: 'pending' }).exec(),
          this.languageModel.countDocuments({ status: 'approved' }).exec(),
          this.languageModel.countDocuments({ status: 'rejected' }).exec(),
        ]);

        return {
          pending,
          approved,
          rejected,
          total: pending + approved + rejected,
        };
      },
      'Language'
    );
  }

  async countApproved(): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel.countDocuments({ status: 'approved' }).exec();
      },
      'Language'
    );
  }

  async getUsageStats(): Promise<{
    languageId: string;
    languageName: string;
    wordsCount: number;
    usersCount: number;
    totalUsage: number;
  }[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Cette méthode nécessiterait des jointures avec d'autres collections
        // Pour l'instant, retourner un tableau vide - à implémenter avec aggregation
        return [];
      },
      'Language'
    );
  }

  async getMostPopular(limit: number = 10): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Pour l'instant, retourner les langues approuvées triées par nom
        // À améliorer avec des statistiques d'utilisation réelles
        return this.languageModel
          .find({ status: 'approved' })
          .limit(limit)
          .sort({ name: 1 })
          .exec();
      },
      'Language'
    );
  }

  // ========== VALIDATION ==========

  async existsByNameOrCode(criteria: {
    name?: string;
    nativeName?: string;
    iso639_1?: string;
    iso639_2?: string;
    iso639_3?: string;
  }): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const language = await this.findByNameOrCode(criteria);
        return language !== null;
      },
      'Language'
    );
  }

  async existsByIsoCode(isoCode: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const language = await this.languageModel.findOne({
          $or: [
            { iso639_1: isoCode },
            { iso639_2: isoCode },
            { iso639_3: isoCode },
          ]
        }).exec();
        return language !== null;
      },
      'Language'
    );
  }
}