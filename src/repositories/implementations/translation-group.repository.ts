import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TranslationGroup, TranslationGroupDocument } from '../../translation/schemas/translation-group.schema';
import { ITranslationGroupRepository } from '../interfaces/translation-group.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

@Injectable()
export class TranslationGroupRepository implements ITranslationGroupRepository {
  constructor(
    @InjectModel(TranslationGroup.name)
    private groupModel: Model<TranslationGroupDocument>
  ) {}

  async create(group: Partial<TranslationGroup>): Promise<TranslationGroup> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.groupModel(group);
        return await created.save();
      },
      'TranslationGroup',
      'create'
    );
  }

  async findById(id: string): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.groupModel
          .findById(id)
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      id
    );
  }

  async findByConceptId(conceptId: string): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.groupModel
          .findOne({ conceptId })
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `concept-${conceptId}`
    );
  }

  async findByPrimaryWord(primaryWord: string, primaryLanguage: string): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.groupModel
          .findOne({ primaryWord, primaryLanguage })
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `primary-${primaryWord}-${primaryLanguage}`
    );
  }

  async findByCategory(categoryId: string, options: {
    limit?: number;
    offset?: number;
    sortBy?: 'qualityScore' | 'totalTranslations' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<TranslationGroup[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 50, offset = 0, sortBy = 'qualityScore', sortOrder = 'desc' } = options;
        const sortObject: any = {};
        sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

        return await this.groupModel
          .find({ categoryId })
          .sort(sortObject)
          .skip(offset)
          .limit(limit)
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `category-${categoryId}`
    );
  }

  async findBySense(senseDescription: string, partOfSpeech?: string): Promise<TranslationGroup[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = {
          'senses.description': { $regex: senseDescription, $options: 'i' }
        };
        
        if (partOfSpeech) {
          query['senses.partOfSpeech'] = partOfSpeech;
        }

        return await this.groupModel
          .find(query)
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `sense-${senseDescription}-${partOfSpeech || 'any'}`
    );
  }

  async findByKeywords(keywords: string[], minMatches: number = 1): Promise<TranslationGroup[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.groupModel
          .find({
            'senses.keywords': { 
              $in: keywords.map(kw => new RegExp(kw, 'i'))
            }
          })
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `keywords-${keywords.join(',')}`
    );
  }

  async findRelatedConcepts(conceptId: string, limit: number = 10): Promise<TranslationGroup[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.groupModel
          .find({ relatedConcepts: conceptId })
          .limit(limit)
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `related-${conceptId}`
    );
  }

  async updateQualityScore(id: string, newScore: number): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.groupModel
          .findByIdAndUpdate(
            id,
            { qualityScore: newScore },
            { new: true }
          )
          .exec();
      },
      'TranslationGroup',
      id
    );
  }

  async updateTranslationCount(id: string, increment: number): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.groupModel
          .findByIdAndUpdate(
            id,
            { $inc: { totalTranslations: increment } },
            { new: true }
          )
          .exec();
      },
      'TranslationGroup',
      id
    );
  }

  async addSense(id: string, sense: any): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.groupModel
          .findByIdAndUpdate(
            id,
            { $push: { senses: sense } },
            { new: true }
          )
          .exec();
      },
      'TranslationGroup',
      id
    );
  }

  async updateSense(id: string, senseId: string, updates: Partial<any>): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updateFields: any = {};
        Object.keys(updates).forEach(key => {
          updateFields[`senses.$.${key}`] = updates[key];
        });

        return await this.groupModel
          .findOneAndUpdate(
            { _id: id, 'senses.senseId': senseId },
            { $set: updateFields },
            { new: true }
          )
          .exec();
      },
      'TranslationGroup',
      `${id}-sense-${senseId}`
    );
  }

  async addRelatedConcept(id: string, relatedConceptId: string): Promise<TranslationGroup | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.groupModel
          .findByIdAndUpdate(
            id,
            { $addToSet: { relatedConcepts: relatedConceptId } },
            { new: true }
          )
          .exec();
      },
      'TranslationGroup',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.groupModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'TranslationGroup',
      id
    );
  }

  async getHighQualityGroups(minScore: number = 0.8, limit: number = 100): Promise<TranslationGroup[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.groupModel
          .find({ qualityScore: { $gte: minScore } })
          .sort({ qualityScore: -1, totalTranslations: -1 })
          .limit(limit)
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `high-quality-${minScore}`
    );
  }

  async searchByText(searchText: string, language?: string): Promise<TranslationGroup[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const query: any = {
          $or: [
            { primaryWord: { $regex: searchText, $options: 'i' } },
            { 'senses.description': { $regex: searchText, $options: 'i' } },
            { 'senses.keywords': { $regex: searchText, $options: 'i' } }
          ]
        };

        if (language) {
          query.primaryLanguage = language;
        }

        return await this.groupModel
          .find(query)
          .sort({ qualityScore: -1 })
          .limit(50)
          .populate('categoryId')
          .exec();
      },
      'TranslationGroup',
      `search-${searchText}-${language || 'any'}`
    );
  }
}