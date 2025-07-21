import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Word, WordDocument } from '../../schemas/word.schema';
import { WordView, WordViewDocument } from '../../../users/schemas/word-view.schema';
import { DatabaseErrorHandler } from '../../../common/utils/database-error-handler.util';

/**
 * Service spécialisé pour les analytics et statistiques des mots
 * PHASE 4 - Extraction des responsabilités analytics depuis WordsService
 */
@Injectable()
export class WordAnalyticsService {
  private readonly logger = new Logger(WordAnalyticsService.name);

  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(WordView.name) private wordViewModel: Model<WordViewDocument>,
  ) {}

  /**
   * Récupère le nombre de mots approuvés
   * Ligne 1634-1640 dans WordsService original
   */
  async getApprovedWordsCount(): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const count = await this.wordModel.countDocuments({ status: 'approved' });
        console.log('📊 Nombre de mots approuvés:', count);
        return count;
      },
      'WordAnalytics',
      'approved-count',
    );
  }

  /**
   * Récupère le nombre de mots ajoutés aujourd'hui
   * Ligne 1642-1657 dans WordsService original
   */
  async getWordsAddedToday(): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const count = await this.wordModel.countDocuments({
          createdAt: {
            $gte: today,
            $lt: tomorrow,
          },
        });

        console.log('📊 Mots ajoutés aujourd\'hui:', count);
        return count;
      },
      'WordAnalytics',
      'today-count',
    );
  }

  /**
   * Récupère les statistiques complètes des mots
   * Ligne 1659-1703 dans WordsService original
   */
  async getWordsStatistics(): Promise<{
    totalApprovedWords: number;
    wordsAddedToday: number;
    wordsAddedThisWeek: number;
    wordsAddedThisMonth: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const now = new Date();

        // Aujourd'hui
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayStart.getDate() + 1);

        // Cette semaine (lundi à aujourd'hui)
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // dimanche = 0, lundi = 1
        weekStart.setDate(weekStart.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);

        // Ce mois
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
          totalApprovedWords,
          wordsAddedToday,
          wordsAddedThisWeek,
          wordsAddedThisMonth,
        ] = await Promise.all([
          this.wordModel.countDocuments({ status: 'approved' }).exec(),
          this.wordModel
            .countDocuments({
              status: 'approved',
              createdAt: { $gte: todayStart, $lt: todayEnd },
            })
            .exec(),
          this.wordModel
            .countDocuments({
              status: 'approved',
              createdAt: { $gte: weekStart },
            })
            .exec(),
          this.wordModel
            .countDocuments({
              status: 'approved',
              createdAt: { $gte: monthStart },
            })
            .exec(),
        ]);

        console.log('📊 Statistiques des mots:', {
          totalApprovedWords,
          wordsAddedToday,
          wordsAddedThisWeek,
          wordsAddedThisMonth,
        });

        return {
          totalApprovedWords,
          wordsAddedToday,
          wordsAddedThisWeek,
          wordsAddedThisMonth,
        };
      },
      'WordAnalytics',
      'statistics',
    );
  }

  /**
   * Enregistre une vue sur un mot pour les analytics
   * Ligne 382-437 dans WordsService original
   */
  async trackWordView(
    wordId: string,
    userId?: string,
    viewType: 'search' | 'detail' | 'favorite' = 'detail',
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log(`📊 trackWordView - wordId: ${wordId}, userId: ${userId}, type: ${viewType}`);

        // Récupérer les informations du mot
        const word = await this.wordModel.findById(wordId).select('word language');
        if (!word) {
          console.warn('⚠️ Mot non trouvé pour tracking:', wordId);
          return;
        }

        // Vérifier si une vue existe déjà pour cet utilisateur et ce mot aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const existingView = userId
          ? await this.wordViewModel.findOne({
              wordId,
              userId,
              viewedAt: { $gte: today, $lt: tomorrow },
            })
          : null;

        if (existingView) {
          // Mettre à jour la vue existante
          existingView.viewCount += 1;
          existingView.lastViewedAt = new Date();
          existingView.viewType = viewType;
          await existingView.save();
          console.log('📊 Vue mise à jour pour:', word.word);
        } else {
          // Créer une nouvelle vue
          const newView = new this.wordViewModel({
            wordId,
            userId,
            word: word.word,
            language: word.language,
            viewedAt: new Date(),
            viewType,
            viewCount: 1,
            lastViewedAt: new Date(),
          });

          await newView.save();
          console.log('📊 Nouvelle vue enregistrée pour:', word.word);
        }
      },
      'WordAnalytics',
      wordId,
    );
  }

  /**
   * Récupère les statistiques de vues pour un mot
   */
  async getWordViewStats(wordId: string): Promise<{
    totalViews: number;
    uniqueUsers: number;
    viewsToday: number;
    viewsByType: Record<string, number>;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const [totalViews, uniqueUsers, viewsToday, viewsByTypeResult] = await Promise.all([
          // Total des vues
          this.wordViewModel.aggregate([
            { $match: { wordId } },
            { $group: { _id: null, total: { $sum: '$viewCount' } } }
          ]),

          // Utilisateurs uniques
          this.wordViewModel.distinct('userId', { wordId }),

          // Vues aujourd'hui
          this.wordViewModel.aggregate([
            { $match: { wordId, viewedAt: { $gte: today, $lt: tomorrow } } },
            { $group: { _id: null, total: { $sum: '$viewCount' } } }
          ]),

          // Vues par type
          this.wordViewModel.aggregate([
            { $match: { wordId } },
            { $group: { _id: '$viewType', count: { $sum: '$viewCount' } } }
          ])
        ]);

        const viewsByType: Record<string, number> = {};
        viewsByTypeResult.forEach(item => {
          viewsByType[item._id || 'unknown'] = item.count;
        });

        return {
          totalViews: totalViews[0]?.total || 0,
          uniqueUsers: uniqueUsers.length,
          viewsToday: viewsToday[0]?.total || 0,
          viewsByType,
        };
      },
      'WordAnalytics',
      `stats-${wordId}`,
    );
  }

  /**
   * Récupère les mots les plus vus
   */
  async getMostViewedWords(limit: number = 10): Promise<Array<{
    word: string;
    language: string;
    totalViews: number;
    uniqueUsers: number;
  }>> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const results = await this.wordViewModel.aggregate([
          {
            $group: {
              _id: { wordId: '$wordId', word: '$word', language: '$language' },
              totalViews: { $sum: '$viewCount' },
              uniqueUsers: { $addToSet: '$userId' }
            }
          },
          {
            $project: {
              word: '$_id.word',
              language: '$_id.language',
              totalViews: 1,
              uniqueUsers: { $size: '$uniqueUsers' }
            }
          },
          { $sort: { totalViews: -1 } },
          { $limit: limit }
        ]);

        return results.map(result => ({
          word: result.word,
          language: result.language,
          totalViews: result.totalViews,
          uniqueUsers: result.uniqueUsers,
        }));
      },
      'WordAnalytics',
      'most-viewed',
    );
  }
}