import { TrainingData } from '../../translation/schemas/training-data.schema';

export interface ITrainingDataRepository {
  create(trainingData: Partial<TrainingData>): Promise<TrainingData>;
  findById(id: string): Promise<TrainingData | null>;
  findByWordPair(sourceWordId: string, targetWordId: string): Promise<TrainingData | null>;
  findByValidator(userId: string, options?: {
    limit?: number;
    offset?: number;
    decision?: string;
  }): Promise<TrainingData[]>;
  findByDecision(decision: string, options?: {
    limit?: number;
    minScore?: number;
    maxScore?: number;
  }): Promise<TrainingData[]>;
  findByValidationType(validationType: string, limit?: number): Promise<TrainingData[]>;
  findTrainingSet(options?: {
    limit?: number;
    excludeUncertain?: boolean;
    balanceDecisions?: boolean;
  }): Promise<TrainingData[]>;
  getAccuracyStats(): Promise<{
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    byDecision: { [key: string]: { total: number; correct: number; accuracy: number } };
  }>;
  updatePredictionResult(id: string, wasCorrect: boolean): Promise<TrainingData | null>;
  delete(id: string): Promise<boolean>;
  countByDecision(): Promise<{ [key: string]: number }>;
}