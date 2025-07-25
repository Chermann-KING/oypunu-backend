import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word } from '../../dictionary/schemas/word.schema';
import { CreateWordDto } from '../../dictionary/dto/create-word.dto';
import { UpdateWordDto } from '../../dictionary/dto/update-word.dto';
import { SearchWordsDto } from '../../dictionary/dto/search-words.dto';
import { IWordRepository } from '../interfaces/word.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 📚 REPOSITORY WORD - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository Word utilisant Mongoose.
 * Toutes les opérations de base de données centralisées ici.
 * 
 * Fonctionnalités :
 * ✅ CRUD complet avec validation
 * ✅ Recherche avancée avec filtres multiples
 * ✅ Statistiques et agrégations
 * ✅ Opérations en masse optimisées
 * ✅ Gestion des relations (utilisateur, catégorie)
 */
@Injectable()
export class WordRepository implements IWordRepository {
  constructor(
    @InjectModel(Word.name) private wordModel: Model<Word>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(wordData: CreateWordDto, userId: string, status: string = 'pending'): Promise<Word> {
    const word = new this.wordModel({
      ...wordData,
      createdBy: new Types.ObjectId(userId),
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
      translationCount: wordData.translations?.length || 0,
      version: 1,
    });
    return word.save();
  }

  async findById(id: string): Promise<Word | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.wordModel.findById(id).exec();
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: string;
    language?: string;
    categoryId?: string;
  }): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};
    
    if (options.status) {
      filter.status = options.status;
    }
    
    if (options.language) {
      filter.language = options.language;
    }
    
    if (options.categoryId) {
      filter.categoryId = options.categoryId;
    }

    const [words, total] = await Promise.all([
      this.wordModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.wordModel.countDocuments(filter).exec(),
    ]);

    return {
      words,
      total,
      page,
      limit,
    };
  }

  async update(id: string, updateData: UpdateWordDto): Promise<Word | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }
    
    const updatedData = {
      ...updateData,
      updatedAt: new Date(),
    };

    return this.wordModel
      .findByIdAndUpdate(id, updatedData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      return false;
    }
    
    const result = await this.wordModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  // ========== RECHERCHE AVANCÉE ==========

  async search(searchParams: SearchWordsDto): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = searchParams.page || 1;
    const limit = searchParams.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = { status: 'approved' };

    // Recherche textuelle sécurisée (protection contre ReDoS)
    if (searchParams.query && searchParams.query.trim()) {
      const escapedQuery = this.escapeRegexCharacters(searchParams.query.trim());
      filter.$or = [
        { word: { $regex: escapedQuery, $options: 'i' } },
        { 'meanings.definition': { $regex: escapedQuery, $options: 'i' } },
        { 'meanings.example': { $regex: escapedQuery, $options: 'i' } },
        { 'translations.translatedWord': { $regex: escapedQuery, $options: 'i' } },
      ];
    }

    // Filtrer par langues
    if (searchParams.languages && searchParams.languages.length > 0) {
      filter.language = { $in: searchParams.languages };
    }

    // Filtrer par catégories
    if (searchParams.categories && searchParams.categories.length > 0) {
      const categoryIds = searchParams.categories
        .filter(Types.ObjectId.isValid)
        .map((id) => new Types.ObjectId(id));
      if (categoryIds.length > 0) {
        filter.categoryId = { $in: categoryIds };
      }
    }

    // Filtrer par classes grammaticales
    if (searchParams.partsOfSpeech && searchParams.partsOfSpeech.length > 0) {
      filter['meanings.partOfSpeech'] = { $in: searchParams.partsOfSpeech };
    }

    const [words, total] = await Promise.all([
      this.wordModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.wordModel.countDocuments(filter).exec(),
    ]);

    return {
      words,
      total,
      page,
      limit,
    };
  }

  async existsByWordAndLanguage(
    word: string, 
    language: string, 
    languageId?: string
  ): Promise<boolean> {
    const filter: any = {
      word: { $regex: `^${word}$`, $options: 'i' },
      language,
    };

    if (languageId) {
      filter.languageId = languageId;
    }

    const count = await this.wordModel.countDocuments(filter).exec();
    return count > 0;
  }

  async findByStatus(
    status: string, 
    options?: { limit?: number; offset?: number }
  ): Promise<Word[]> {
    let query = this.wordModel.find({ status });

    if (options?.offset) {
      query = query.skip(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.sort({ createdAt: -1 }).exec();
  }

  async findFeatured(limit: number = 10): Promise<Word[]> {
    return this.wordModel
      .find({ 
        isFeatured: true, 
        status: 'approved' 
      })
      .limit(limit)
      .sort({ featuredAt: -1, viewCount: -1 })
      .exec();
  }

  async findRandomWithCreatedBy(limit: number = 3): Promise<Word[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const result = await this.wordModel.aggregate([
          { $match: { status: 'approved' } },
          { $sample: { size: limit } },
          {
            $lookup: {
              from: 'users',
              localField: 'createdBy',
              foreignField: '_id',
              as: 'createdBy',
            },
          },
          {
            $unwind: {
              path: '$createdBy',
              preserveNullAndEmptyArrays: true,
            },
          },
        ]);
        return result;
      },
      'Word',
      `random-${limit}`
    );
  }

  // ========== STATISTIQUES ==========

  async countByStatus(status: string): Promise<number> {
    return this.wordModel.countDocuments({ status }).exec();
  }

  async countAddedToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.wordModel
      .countDocuments({
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      })
      .exec();
  }

  async getAvailableLanguages(): Promise<Array<{ 
    language: string; 
    count: number; 
    languageId?: string 
  }>> {
    const result = await this.wordModel
      .aggregate([
        {
          $group: {
            _id: {
              language: '$language',
              languageId: '$languageId',
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            language: '$_id.language',
            languageId: '$_id.languageId',
            count: 1,
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .exec();

    return result;
  }

  async getWordsStatistics(): Promise<{
    totalWords: number;
    approvedWords: number;
    pendingWords: number;
    rejectedWords: number;
    wordsByLanguage: Array<{ language: string; count: number }>;
  }> {
    const [
      totalWords,
      approvedWords,
      pendingWords,
      rejectedWords,
      wordsByLanguage,
    ] = await Promise.all([
      this.wordModel.countDocuments().exec(),
      this.wordModel.countDocuments({ status: 'approved' }).exec(),
      this.wordModel.countDocuments({ status: 'pending' }).exec(),
      this.wordModel.countDocuments({ status: 'rejected' }).exec(),
      this.wordModel
        .aggregate([
          {
            $group: {
              _id: '$language',
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              language: '$_id',
              count: 1,
            },
          },
          {
            $sort: { count: -1 },
          },
        ])
        .exec(),
    ]);

    return {
      totalWords,
      approvedWords,
      pendingWords,
      rejectedWords,
      wordsByLanguage,
    };
  }

  // ========== RELATIONS ==========

  async findByUserId(
    userId: string, 
    options?: { status?: string; limit?: number; offset?: number }
  ): Promise<Word[]> {
    const filter: any = { userId };
    
    if (options?.status) {
      filter.status = options.status;
    }

    let query = this.wordModel.find(filter);

    if (options?.offset) {
      query = query.skip(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.sort({ createdAt: -1 }).exec();
  }

  async findByCategoryId(
    categoryId: string, 
    options?: { limit?: number; offset?: number }
  ): Promise<Word[]> {
    let query = this.wordModel.find({ categoryId });

    if (options?.offset) {
      query = query.skip(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.sort({ createdAt: -1 }).exec();
  }

  async updateStatus(
    id: string, 
    status: string, 
    adminId?: string
  ): Promise<Word | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (adminId) {
      updateData.approvedBy = adminId;
      updateData.approvedAt = new Date();
    }

    return this.wordModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async incrementViewCount(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      return;
    }

    await this.wordModel
      .updateOne(
        { _id: id },
        { 
          $inc: { viewCount: 1 },
          lastViewedAt: new Date(),
        }
      )
      .exec();
  }

  async updateTranslationCount(id: string, count: number): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      return;
    }

    await this.wordModel
      .updateOne(
        { _id: id },
        { 
          translationCount: count,
          updatedAt: new Date(),
        }
      )
      .exec();
  }

  // ========== OPÉRATIONS EN MASSE ==========

  async deleteMany(ids: string[]): Promise<number> {
    const validIds = ids.filter(id => Types.ObjectId.isValid(id));
    
    const result = await this.wordModel
      .deleteMany({ _id: { $in: validIds } })
      .exec();
    
    return result.deletedCount || 0;
  }

  async updateManyStatus(
    ids: string[], 
    status: string, 
    adminId?: string
  ): Promise<number> {
    const validIds = ids.filter(id => Types.ObjectId.isValid(id));
    
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (adminId) {
      updateData.approvedBy = adminId;
      updateData.approvedAt = new Date();
    }

    const result = await this.wordModel
      .updateMany(
        { _id: { $in: validIds } },
        updateData
      )
      .exec();
    
    return result.modifiedCount || 0;
  }

  async searchByText(
    query: string, 
    options?: { languages?: string[]; limit?: number; offset?: number }
  ): Promise<Word[]> {
    const filter: any = {
      $or: [
        { word: { $regex: query, $options: 'i' } },
        { definition: { $regex: query, $options: 'i' } },
        { example: { $regex: query, $options: 'i' } },
        { 'translations.translation': { $regex: query, $options: 'i' } },
      ],
    };

    if (options?.languages && options.languages.length > 0) {
      filter.language = { $in: options.languages };
    }

    let mongoQuery = this.wordModel.find(filter);

    if (options?.offset) {
      mongoQuery = mongoQuery.skip(options.offset);
    }

    if (options?.limit) {
      mongoQuery = mongoQuery.limit(options.limit);
    }

    return mongoQuery.sort({ viewCount: -1, createdAt: -1 }).exec();
  }

  // ========== MÉTHODES POUR TRANSLATIONS ==========

  async findByTranslationId(translationId: string): Promise<Word | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(translationId)) {
          return null;
        }
        return this.wordModel.findOne({
          'translations._id': translationId,
        }).exec();
      },
      'Word',
      `translation-${translationId}`
    );
  }

  async findByTranslationGroupId(groupId: string): Promise<Word[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(groupId)) {
          return [];
        }
        return this.wordModel.find({
          'translations.translationGroupId': groupId,
        }).exec();
      },
      'Word',
      `group-${groupId}`
    );
  }

  async findByIdWithTranslations(wordId: string): Promise<Word | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          return null;
        }
        return this.wordModel
          .findById(wordId)
          .populate('translations.createdBy', 'username')
          .populate('translations.validatedBy', 'username')
          .exec();
      },
      'Word',
      wordId
    );
  }

  async findByCategoryAndLanguage(
    categoryId: string,
    language: string,
    status: string,
    excludeIds: string[],
    limit: number
  ): Promise<Word[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(categoryId)) {
          return [];
        }

        const query: any = {
          language,
          categoryId: new Types.ObjectId(categoryId),
          status,
        };

        if (excludeIds.length > 0) {
          const validExcludeIds = excludeIds
            .filter(id => Types.ObjectId.isValid(id))
            .map(id => new Types.ObjectId(id));
          
          if (validExcludeIds.length > 0) {
            query._id = { $nin: validExcludeIds };
          }
        }

        return this.wordModel
          .find(query)
          .limit(limit)
          .exec();
      },
      'Word',
      `category-${categoryId}-lang-${language}`
    );
  }

  /**
   * 🔒 Échappe les caractères spéciaux regex pour prévenir les attaques ReDoS
   * 
   * @param input - Chaîne d'entrée à échapper
   * @returns Chaîne sécurisée pour utilisation dans regex
   */
  private escapeRegexCharacters(input: string): string {
    // Échapper tous les caractères spéciaux regex : . * + ? ^ $ { } ( ) | [ ] \
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}