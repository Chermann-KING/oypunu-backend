import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TrainingData,
  TrainingDataDocument,
} from '../schemas/training-data.schema';
import { Word } from '../../dictionary/schemas/word.schema';
import { User } from '../../users/schemas/user.schema';
import { SimilarityService, SimilarityResult } from './similarity.service';

export interface LearningInsight {
  categoryAccuracy: number;
  semanticAccuracy: number;
  overallAccuracy: number;
  recommendedThresholds: {
    autoMerge: number;
    askUser: number;
    autoSeparate: number;
  };
  commonPatterns: {
    pattern: string;
    accuracy: number;
    count: number;
  }[];
}

@Injectable()
export class LearningService {
  constructor(
    @InjectModel(TrainingData.name)
    private trainingDataModel: Model<TrainingDataDocument>,
    private readonly similarityService: SimilarityService,
  ) {}

  /**
   * Enregistre une décision humaine pour l'apprentissage
   */
  async recordHumanDecision(
    sourceWordId: string,
    targetWordId: string,
    similarityScore: number,
    humanDecision: 'merge' | 'separate' | 'uncertain',
    validatedBy: string,
    context: any,
    reason?: string,
  ): Promise<TrainingData> {
    // Vérifier si cette paire existe déjà
    const existing = await this.trainingDataModel.findOne({
      sourceWordId,
      targetWordId,
    });

    if (existing) {
      // Mettre à jour la décision existante
      existing.humanDecision = humanDecision;
      existing.validatedBy = validatedBy as any;
      existing.reason = reason;
      existing.context = context;
      return existing.save();
    }

    // Créer une nouvelle entrée d'apprentissage
    return this.trainingDataModel.create({
      sourceWordId,
      targetWordId,
      similarityScore,
      humanDecision,
      validatedBy,
      context,
      reason,
      validationType: 'manual',
      wasCorrectPrediction: this.wasPredictionCorrect(
        similarityScore,
        humanDecision,
      ),
    });
  }

  /**
   * Prédit l'action recommandée basée sur l'apprentissage précédent
   */
  async predictAction(
    sourceWord: Word,
    targetWord: Word,
    currentSimilarity: SimilarityResult,
  ): Promise<{
    action: 'merge' | 'separate' | 'uncertain';
    confidence: number;
    reasoning: string[];
  }> {
    // Récupérer l'historique d'apprentissage similaire
    const similarCases = await this.findSimilarCases(
      sourceWord,
      targetWord,
      currentSimilarity,
    );

    if (similarCases.length === 0) {
      // Pas d'historique, utiliser les seuils par défaut
      return this.getDefaultPrediction(currentSimilarity);
    }

    // Analyser les décisions précédentes
    const mergeDecisions = similarCases.filter(
      (c) => c.humanDecision === 'merge',
    ).length;
    const separateDecisions = similarCases.filter(
      (c) => c.humanDecision === 'separate',
    ).length;
    const uncertainDecisions = similarCases.filter(
      (c) => c.humanDecision === 'uncertain',
    ).length;

    const total = similarCases.length;
    const mergeRatio = mergeDecisions / total;
    const separateRatio = separateDecisions / total;

    let predictedAction: 'merge' | 'separate' | 'uncertain';
    let confidence: number;
    const reasoning: string[] = [];

    if (mergeRatio > 0.7) {
      predictedAction = 'merge';
      confidence = mergeRatio;
      reasoning.push(
        `${mergeDecisions}/${total} cas similaires ont été fusionnés`,
      );
    } else if (separateRatio > 0.7) {
      predictedAction = 'separate';
      confidence = separateRatio;
      reasoning.push(
        `${separateDecisions}/${total} cas similaires ont été séparés`,
      );
    } else {
      predictedAction = 'uncertain';
      confidence = Math.max(mergeRatio, separateRatio);
      reasoning.push(
        `Décisions partagées: ${mergeDecisions} fusion, ${separateDecisions} séparation`,
      );
    }

    // Ajouter des insights basés sur les patterns
    if (currentSimilarity.categoryMatch) {
      const categoryMatches = similarCases.filter(
        (c) => c.context.categoryMatch,
      );
      if (categoryMatches.length > 0) {
        const categoryMergeRate =
          categoryMatches.filter((c) => c.humanDecision === 'merge').length /
          categoryMatches.length;
        reasoning.push(
          `Même catégorie: ${Math.round(categoryMergeRate * 100)}% de fusion habituellement`,
        );
      }
    }

    if (currentSimilarity.sharedKeywords.length >= 3) {
      reasoning.push(
        `${currentSimilarity.sharedKeywords.length} mots-clés partagés détectés`,
      );
    }

    return {
      action: predictedAction,
      confidence,
      reasoning,
    };
  }

  /**
   * Génère des insights sur l'efficacité de l'algorithme
   */
  async generateLearningInsights(
    limit: number = 1000,
  ): Promise<LearningInsight> {
    const recentData = await this.trainingDataModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sourceWordId targetWordId');

    if (recentData.length === 0) {
      return this.getDefaultInsights();
    }

    // Analyser la précision par type de correspondance
    const categoryMatches = recentData.filter((d) => d.context.categoryMatch);
    const categoryAccuracy = this.calculateAccuracy(categoryMatches);

    const semanticMatches = recentData.filter(
      (d) => d.context.sharedKeywords?.length >= 2,
    );
    const semanticAccuracy = this.calculateAccuracy(semanticMatches);

    const overallAccuracy = this.calculateAccuracy(recentData);

    // Calculer les seuils recommandés
    const thresholds = this.calculateOptimalThresholds(recentData);

    // Identifier les patterns communs
    const patterns = this.identifyCommonPatterns(recentData);

    return {
      categoryAccuracy,
      semanticAccuracy,
      overallAccuracy,
      recommendedThresholds: thresholds,
      commonPatterns: patterns.slice(0, 10), // Top 10 patterns
    };
  }

  /**
   * Met à jour les seuils d'auto-validation basés sur l'apprentissage
   */
  async updateAutoValidationThresholds(): Promise<{
    autoMergeThreshold: number;
    askUserThreshold: number;
    autoSeparateThreshold: number;
  }> {
    const insights = await this.generateLearningInsights();

    return {
      autoMergeThreshold: insights.recommendedThresholds.autoMerge,
      askUserThreshold: insights.recommendedThresholds.askUser,
      autoSeparateThreshold: insights.recommendedThresholds.autoSeparate,
    };
  }

  /**
   * Trouve des cas similaires dans l'historique d'apprentissage
   */
  private async findSimilarCases(
    sourceWord: Word,
    targetWord: Word,
    similarity: SimilarityResult,
  ): Promise<TrainingDataDocument[]> {
    const query: any = {};

    // Rechercher des cas avec des scores de similarité proches (±0.1)
    query.similarityScore = {
      $gte: Math.max(0, similarity.score - 0.1),
      $lte: Math.min(1, similarity.score + 0.1),
    };

    // Si même catégorie, privilégier les cas de même catégorie
    if (similarity.categoryMatch) {
      query['context.categoryMatch'] = true;
    }

    // Rechercher des cas avec des mots-clés partagés similaires
    if (similarity.sharedKeywords.length > 0) {
      query['context.sharedKeywords'] = {
        $size: { $gte: Math.max(0, similarity.sharedKeywords.length - 1) },
      };
    }

    return this.trainingDataModel.find(query).sort({ createdAt: -1 }).limit(50);
  }

  /**
   * Prédiction par défaut sans historique d'apprentissage
   */
  private getDefaultPrediction(similarity: SimilarityResult): {
    action: 'merge' | 'separate' | 'uncertain';
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = ['Prédiction basée sur les seuils par défaut'];

    if (similarity.score > 0.9) {
      return {
        action: 'merge',
        confidence: 0.9,
        reasoning: [
          ...reasoning,
          `Score élevé: ${similarity.score.toFixed(2)}`,
        ],
      };
    } else if (similarity.score > 0.6) {
      return {
        action: 'uncertain',
        confidence: 0.6,
        reasoning: [
          ...reasoning,
          `Score modéré: ${similarity.score.toFixed(2)}`,
        ],
      };
    } else {
      return {
        action: 'separate',
        confidence: 0.8,
        reasoning: [
          ...reasoning,
          `Score faible: ${similarity.score.toFixed(2)}`,
        ],
      };
    }
  }

  /**
   * Calcule la précision des prédictions
   */
  private calculateAccuracy(data: TrainingDataDocument[]): number {
    if (data.length === 0) return 0;

    const correctPredictions = data.filter(
      (d) => d.wasCorrectPrediction,
    ).length;
    return correctPredictions / data.length;
  }

  /**
   * Calcule les seuils optimaux basés sur l'historique
   */
  private calculateOptimalThresholds(data: TrainingDataDocument[]): {
    autoMerge: number;
    askUser: number;
    autoSeparate: number;
  } {
    if (data.length < 10) {
      return { autoMerge: 0.9, askUser: 0.6, autoSeparate: 0.4 };
    }

    // Analyser les seuils qui maximisent la précision
    const mergeData = data.filter((d) => d.humanDecision === 'merge');
    const separateData = data.filter((d) => d.humanDecision === 'separate');

    const mergeScores = mergeData
      .map((d) => d.similarityScore)
      .sort((a, b) => b - a);
    const separateScores = separateData
      .map((d) => d.similarityScore)
      .sort((a, b) => a - b);

    // Seuil d'auto-merge: 90e percentile des scores de fusion
    const autoMerge =
      mergeScores.length > 0
        ? mergeScores[Math.floor(mergeScores.length * 0.1)]
        : 0.9;

    // Seuil d'auto-separate: 90e percentile des scores de séparation
    const autoSeparate =
      separateScores.length > 0
        ? separateScores[Math.floor(separateScores.length * 0.9)]
        : 0.4;

    // Seuil "demander à l'utilisateur" au milieu
    const askUser = (autoMerge + autoSeparate) / 2;

    return {
      autoMerge: Math.min(0.95, Math.max(0.8, autoMerge)),
      askUser: Math.min(0.8, Math.max(0.5, askUser)),
      autoSeparate: Math.min(0.5, Math.max(0.1, autoSeparate)),
    };
  }

  /**
   * Identifie les patterns communs dans les décisions
   */
  private identifyCommonPatterns(data: TrainingDataDocument[]): {
    pattern: string;
    accuracy: number;
    count: number;
  }[] {
    const patterns: Map<string, { correct: number; total: number }> = new Map();

    data.forEach((d) => {
      // Pattern: correspondance de catégorie
      if (d.context.categoryMatch) {
        this.addToPattern(patterns, 'same_category', d.wasCorrectPrediction);
      } else {
        this.addToPattern(
          patterns,
          'different_category',
          d.wasCorrectPrediction,
        );
      }

      // Pattern: nombre de mots-clés partagés
      const sharedCount = d.context.sharedKeywords?.length || 0;
      if (sharedCount >= 3) {
        this.addToPattern(
          patterns,
          'high_keyword_overlap',
          d.wasCorrectPrediction,
        );
      } else if (sharedCount >= 1) {
        this.addToPattern(
          patterns,
          'low_keyword_overlap',
          d.wasCorrectPrediction,
        );
      } else {
        this.addToPattern(
          patterns,
          'no_keyword_overlap',
          d.wasCorrectPrediction,
        );
      }

      // Pattern: score de similarité
      if (d.similarityScore > 0.8) {
        this.addToPattern(patterns, 'high_similarity', d.wasCorrectPrediction);
      } else if (d.similarityScore > 0.5) {
        this.addToPattern(
          patterns,
          'medium_similarity',
          d.wasCorrectPrediction,
        );
      } else {
        this.addToPattern(patterns, 'low_similarity', d.wasCorrectPrediction);
      }
    });

    return Array.from(patterns.entries())
      .map(([pattern, stats]) => ({
        pattern,
        accuracy: stats.correct / stats.total,
        count: stats.total,
      }))
      .filter((p) => p.count >= 5) // Minimum 5 occurrences
      .sort((a, b) => b.accuracy - a.accuracy);
  }

  private addToPattern(
    patterns: Map<string, { correct: number; total: number }>,
    pattern: string,
    wasCorrect: boolean,
  ): void {
    if (!patterns.has(pattern)) {
      patterns.set(pattern, { correct: 0, total: 0 });
    }
    const stats = patterns.get(pattern)!;
    stats.total++;
    if (wasCorrect) {
      stats.correct++;
    }
  }

  /**
   * Vérifie si la prédiction était correcte
   */
  private wasPredictionCorrect(
    similarityScore: number,
    humanDecision: string,
  ): boolean {
    if (similarityScore > 0.9 && humanDecision === 'merge') return true;
    if (
      similarityScore > 0.6 &&
      similarityScore <= 0.9 &&
      humanDecision === 'uncertain'
    )
      return true;
    if (similarityScore <= 0.6 && humanDecision === 'separate') return true;
    return false;
  }

  /**
   * Insights par défaut quand pas assez de données
   */
  private getDefaultInsights(): LearningInsight {
    return {
      categoryAccuracy: 0.75,
      semanticAccuracy: 0.7,
      overallAccuracy: 0.72,
      recommendedThresholds: {
        autoMerge: 0.9,
        askUser: 0.6,
        autoSeparate: 0.4,
      },
      commonPatterns: [],
    };
  }
}
