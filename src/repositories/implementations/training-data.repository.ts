import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrainingData, TrainingDataDocument } from '../../translation/schemas/training-data.schema';
import { ITrainingDataRepository } from '../interfaces/training-data.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

@Injectable()
export class TrainingDataRepository implements ITrainingDataRepository {
  constructor(
    @InjectModel(TrainingData.name)
    private trainingDataModel: Model<TrainingDataDocument>
  ) {}

  async create(trainingData: Partial<TrainingData>): Promise<TrainingData> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.trainingDataModel(trainingData);
        return await created.save();
      },
      'TrainingData',
      'create'
    );
  }

  async findById(id: string): Promise<TrainingData | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.trainingDataModel
          .findById(id)
          .populate('sourceWordId')
          .populate('targetWordId')
          .populate('validatedBy')
          .exec();
      },
      'TrainingData',
      id
    );
  }

  async findByWordPair(sourceWordId: string, targetWordId: string): Promise<TrainingData | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.trainingDataModel
          .findOne({
            $or: [
              { sourceWordId, targetWordId },
              { sourceWordId: targetWordId, targetWordId: sourceWordId }
            ]
          })
          .populate('sourceWordId')
          .populate('targetWordId')
          .exec();
      },
      'TrainingData',
      `pair-${sourceWordId}-${targetWordId}`
    );
  }

  async findByValidator(userId: string, options: {
    limit?: number;
    offset?: number;
    decision?: string;
  } = {}): Promise<TrainingData[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 50, offset = 0, decision } = options;
        const query: any = { validatedBy: userId };
        
        if (decision) {
          query.humanDecision = decision;
        }

        return await this.trainingDataModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .populate('sourceWordId')
          .populate('targetWordId')
          .exec();
      },
      'TrainingData',
      `validator-${userId}`
    );
  }

  async findByDecision(decision: string, options: {
    limit?: number;
    minScore?: number;
    maxScore?: number;
  } = {}): Promise<TrainingData[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 100, minScore, maxScore } = options;
        const query: any = { humanDecision: decision };
        
        if (minScore !== undefined || maxScore !== undefined) {
          query.similarityScore = {};
          if (minScore !== undefined) query.similarityScore.$gte = minScore;
          if (maxScore !== undefined) query.similarityScore.$lte = maxScore;
        }

        return await this.trainingDataModel
          .find(query)
          .sort({ similarityScore: -1 })
          .limit(limit)
          .populate('sourceWordId')
          .populate('targetWordId')
          .exec();
      },
      'TrainingData',
      `decision-${decision}`
    );
  }

  async findByValidationType(validationType: string, limit: number = 100): Promise<TrainingData[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.trainingDataModel
          .find({ validationType })
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('sourceWordId')
          .populate('targetWordId')
          .exec();
      },
      'TrainingData',
      `validation-type-${validationType}`
    );
  }

  async findTrainingSet(options: {
    limit?: number;
    excludeUncertain?: boolean;
    balanceDecisions?: boolean;
  } = {}): Promise<TrainingData[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { limit = 1000, excludeUncertain = true, balanceDecisions = false } = options;
        let query: any = {};
        
        if (excludeUncertain) {
          query.humanDecision = { $ne: 'uncertain' };
        }

        if (balanceDecisions) {
          // Récupérer un nombre équilibré de chaque décision
          const decisions = ['merge', 'separate'];
          const perDecision = Math.floor(limit / decisions.length);
          
          const results = await Promise.all(
            decisions.map(decision =>
              this.trainingDataModel
                .find({ humanDecision: decision })
                .sort({ createdAt: -1 })
                .limit(perDecision)
                .populate('sourceWordId')
                .populate('targetWordId')
                .exec()
            )
          );
          
          return results.flat();
        }

        return await this.trainingDataModel
          .find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('sourceWordId')
          .populate('targetWordId')
          .exec();
      },
      'TrainingData',
      'training-set'
    );
  }

  async getAccuracyStats(): Promise<{
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    byDecision: { [key: string]: { total: number; correct: number; accuracy: number } };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const stats = await this.trainingDataModel.aggregate([
          {
            $match: { validationType: { $in: ['auto', 'learned'] } }
          },
          {
            $group: {
              _id: '$humanDecision',
              total: { $sum: 1 },
              correct: { $sum: { $cond: ['$wasCorrectPrediction', 1, 0] } }
            }
          }
        ]).exec();

        let totalPredictions = 0;
        let correctPredictions = 0;
        const byDecision: { [key: string]: { total: number; correct: number; accuracy: number } } = {};

        stats.forEach(stat => {
          totalPredictions += stat.total;
          correctPredictions += stat.correct;
          byDecision[stat._id] = {
            total: stat.total,
            correct: stat.correct,
            accuracy: stat.total > 0 ? stat.correct / stat.total : 0
          };
        });

        return {
          totalPredictions,
          correctPredictions,
          accuracy: totalPredictions > 0 ? correctPredictions / totalPredictions : 0,
          byDecision
        };
      },
      'TrainingData',
      'accuracy-stats'
    );
  }

  async updatePredictionResult(id: string, wasCorrect: boolean): Promise<TrainingData | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.trainingDataModel
          .findByIdAndUpdate(
            id,
            { wasCorrectPrediction: wasCorrect },
            { new: true }
          )
          .exec();
      },
      'TrainingData',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.trainingDataModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'TrainingData',
      id
    );
  }

  async countByDecision(): Promise<{ [key: string]: number }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const counts = await this.trainingDataModel.aggregate([
          {
            $group: {
              _id: '$humanDecision',
              count: { $sum: 1 }
            }
          }
        ]).exec();

        const result: { [key: string]: number } = {};
        counts.forEach(count => {
          result[count._id] = count.count;
        });

        return result;
      },
      'TrainingData',
      'count-by-decision'
    );
  }
}