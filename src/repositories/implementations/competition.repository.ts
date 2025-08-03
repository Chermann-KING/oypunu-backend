import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  Competition, 
  CompetitionDocument 
} from '../../achievements/schemas/competition.schema';
import {
  ICompetitionRepository,
  CreateCompetitionData,
  CompetitionFilters,
  LeaderboardEntry
} from '../interfaces/competition.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

@Injectable()
export class CompetitionRepository implements ICompetitionRepository {
  constructor(
    @InjectModel(Competition.name)
    private competitionModel: Model<CompetitionDocument>
  ) {}

  /**
   * Créer une nouvelle compétition
   */
  async create(competitionData: CreateCompetitionData): Promise<Competition> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const competitionId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        
        const competition = new this.competitionModel({
          ...competitionData,
          competitionId,
          createdBy: new Types.ObjectId(competitionData.createdBy),
          leaderboard: [],
          participants: 0,
          status: competitionData.startDate > new Date() ? 'upcoming' : 'active'
        });

        return await competition.save();
      },
      'Competition',
      'create'
    );
  }

  /**
   * Récupérer une compétition par ID
   */
  async findById(id: string): Promise<Competition | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.competitionModel
          .findById(id)
          .populate('createdBy', 'username email')
          .populate('leaderboard.userId', 'username profilePicture')
          .exec();
      },
      'Competition',
      id
    );
  }

  /**
   * Récupérer une compétition par competitionId
   */
  async findByCompetitionId(competitionId: string): Promise<Competition | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.competitionModel
          .findOne({ competitionId })
          .populate('createdBy', 'username email')
          .populate('leaderboard.userId', 'username profilePicture')
          .exec();
      },
      'Competition',
      competitionId
    );
  }

  /**
   * Mettre à jour une compétition
   */
  async update(id: string, updateData: Partial<Competition>): Promise<Competition | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return await this.competitionModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate('createdBy', 'username email')
          .populate('leaderboard.userId', 'username profilePicture')
          .exec();
      },
      'Competition',
      id
    );
  }

  /**
   * Supprimer une compétition
   */
  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.competitionModel.findByIdAndDelete(id).exec();
        return !!result;
      },
      'Competition',
      id
    );
  }

  /**
   * Récupérer toutes les compétitions avec filtres
   */
  async findAll(
    filters: CompetitionFilters = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    competitions: Competition[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          sortBy = 'createdAt',
          sortOrder = 'desc'
        } = options;

        const query: any = {};
        
        if (filters.status) query.status = filters.status;
        if (filters.type) query.type = filters.type;
        if (filters.category) query.category = filters.category;
        if (filters.startDate || filters.endDate) {
          query.startDate = {};
          if (filters.startDate) query.startDate.$gte = filters.startDate;
          if (filters.endDate) query.startDate.$lte = filters.endDate;
        }

        const sortObject: any = {};
        sortObject[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [competitions, total] = await Promise.all([
          this.competitionModel
            .find(query)
            .sort(sortObject)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('createdBy', 'username email')
            .exec(),
          this.competitionModel.countDocuments(query).exec()
        ]);

        return {
          competitions,
          total,
          page,
          limit
        };
      },
      'Competition',
      'findAll'
    );
  }

  /**
   * Récupérer les compétitions actives
   */
  async findActiveCompetitions(): Promise<Competition[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const now = new Date();
        return await this.competitionModel
          .find({
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now }
          })
          .populate('createdBy', 'username email')
          .sort({ startDate: 1 })
          .exec();
      },
      'Competition',
      'activeCompetitions'
    );
  }

  /**
   * Récupérer les compétitions par statut
   */
  async findByStatus(status: 'upcoming' | 'active' | 'ended' | 'cancelled'): Promise<Competition[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.competitionModel
          .find({ status })
          .populate('createdBy', 'username email')
          .sort({ startDate: -1 })
          .exec();
      },
      'Competition',
      `status-${status}`
    );
  }

  /**
   * Récupérer les compétitions par catégorie
   */
  async findByCategory(category: 'contribution' | 'social' | 'learning' | 'mixed'): Promise<Competition[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.competitionModel
          .find({ category })
          .populate('createdBy', 'username email')
          .sort({ startDate: -1 })
          .exec();
      },
      'Competition',
      `category-${category}`
    );
  }

  /**
   * Rechercher des compétitions
   */
  async search(query: string, filters: CompetitionFilters = {}): Promise<Competition[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const searchQuery: any = {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
          ]
        };

        if (filters.status) searchQuery.status = filters.status;
        if (filters.type) searchQuery.type = filters.type;
        if (filters.category) searchQuery.category = filters.category;

        return await this.competitionModel
          .find(searchQuery)
          .populate('createdBy', 'username email')
          .sort({ startDate: -1 })
          .limit(20)
          .exec();
      },
      'Competition',
      `search-${query}`
    );
  }

  /**
   * Ajouter un participant à une compétition
   */
  async addParticipant(competitionId: string, userId: string, initialScore: number = 0): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier si l'utilisateur est déjà inscrit
        const competition = await this.competitionModel.findOne({ competitionId }).exec();
        if (!competition) {
          throw new Error('Compétition non trouvée');
        }

        const existingParticipant = competition.leaderboard.find(
          p => p.userId.toString() === userId
        );

        if (existingParticipant) {
          return false; // Déjà inscrit
        }

        // Obtenir les infos utilisateur
        const userObjectId = new Types.ObjectId(userId);
        
        const newEntry: any = {
          userId: userObjectId,
          username: 'User', // Sera mis à jour par populate
          rank: competition.leaderboard.length + 1,
          score: initialScore,
          metrics: {},
          lastUpdate: new Date(),
          streak: 0,
          isQualified: true
        };

        const result = await this.competitionModel.updateOne(
          { competitionId },
          {
            $push: { leaderboard: newEntry },
            $inc: { participants: 1 }
          }
        ).exec();

        return result.modifiedCount > 0;
      },
      'Competition',
      `addParticipant-${competitionId}-${userId}`
    );
  }

  /**
   * Mettre à jour le score d'un participant
   */
  async updateParticipantScore(
    competitionId: string,
    userId: string,
    score: number,
    metrics: { [key: string]: number } = {}
  ): Promise<LeaderboardEntry | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const competition = await this.competitionModel.findOne({ competitionId }).exec();
        if (!competition) {
          throw new Error('Compétition non trouvée');
        }

        // Mettre à jour le score du participant
        const result = await this.competitionModel.updateOne(
          { 
            competitionId,
            'leaderboard.userId': new Types.ObjectId(userId)
          },
          {
            $set: {
              'leaderboard.$.score': score,
              'leaderboard.$.metrics': metrics,
              'leaderboard.$.lastUpdate': new Date()
            }
          }
        ).exec();

        if (result.modifiedCount === 0) {
          return null;
        }

        // Recalculer les rangs
        await this.recalculateRanks(competitionId);

        // Retourner l'entrée mise à jour
        const updatedCompetition = await this.competitionModel
          .findOne({ competitionId })
          .populate('leaderboard.userId', 'username profilePicture')
          .exec();

        const entry = updatedCompetition?.leaderboard.find(
          p => p.userId.toString() === userId
        );

        return entry ? {
          userId: entry.userId.toString(),
          username: entry.username,
          profilePicture: entry.profilePicture,
          rank: entry.rank,
          score: entry.score,
          metrics: entry.metrics,
          lastUpdate: entry.lastUpdate,
          streak: entry.streak,
          isQualified: entry.isQualified
        } : null;
      },
      'Competition',
      `updateScore-${competitionId}-${userId}`
    );
  }

  /**
   * Obtenir le classement d'une compétition
   */
  async getLeaderboard(competitionId: string, limit?: number): Promise<LeaderboardEntry[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const competition = await this.competitionModel
          .findOne({ competitionId })
          .populate('leaderboard.userId', 'username profilePicture')
          .exec();

        if (!competition) {
          return [];
        }

        let leaderboard = competition.leaderboard
          .sort((a, b) => a.rank - b.rank);

        if (limit) {
          leaderboard = leaderboard.slice(0, limit);
        }

        return leaderboard.map(entry => ({
          userId: entry.userId.toString(),
          username: entry.username,
          profilePicture: entry.profilePicture,
          rank: entry.rank,
          score: entry.score,
          metrics: entry.metrics,
          lastUpdate: entry.lastUpdate,
          streak: entry.streak,
          isQualified: entry.isQualified
        }));
      },
      'Competition',
      `leaderboard-${competitionId}`
    );
  }

  /**
   * Obtenir la position d'un utilisateur dans une compétition
   */
  async getUserRankInCompetition(competitionId: string, userId: string): Promise<{
    rank: number;
    score: number;
    totalParticipants: number;
  } | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const competition = await this.competitionModel
          .findOne({ competitionId })
          .exec();

        if (!competition) {
          return null;
        }

        const entry = competition.leaderboard.find(
          p => p.userId.toString() === userId
        );

        if (!entry) {
          return null;
        }

        return {
          rank: entry.rank,
          score: entry.score,
          totalParticipants: competition.participants
        };
      },
      'Competition',
      `userRank-${competitionId}-${userId}`
    );
  }

  /**
   * Recalculer et mettre à jour tous les rangs d'une compétition
   */
  async recalculateRanks(competitionId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const competition = await this.competitionModel.findOne({ competitionId }).exec();
        if (!competition) {
          return false;
        }

        // Trier par score décroissant
        const sortedLeaderboard = competition.leaderboard
          .sort((a, b) => b.score - a.score)
          .map((entry, index) => ({
            ...entry,
            rank: index + 1
          }));

        // Mettre à jour en base
        await this.competitionModel.updateOne(
          { competitionId },
          { $set: { leaderboard: sortedLeaderboard } }
        ).exec();

        return true;
      },
      'Competition',
      `recalculateRanks-${competitionId}`
    );
  }

  /**
   * Compter les compétitions par statut
   */
  async countByStatus(status: 'upcoming' | 'active' | 'ended' | 'cancelled'): Promise<number> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return await this.competitionModel.countDocuments({ status }).exec();
      },
      'Competition',
      `countByStatus-${status}`
    );
  }

  /**
   * Obtenir les statistiques d'une compétition
   */
  async getCompetitionStats(competitionId: string): Promise<{
    totalParticipants: number;
    averageScore: number;
    scoreDistribution: {
      min: number;
      max: number;
      mean: number;
      quartiles: number[];
    };
    participationByTime: { [hour: string]: number };
    topPerformers: LeaderboardEntry[];
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const competition = await this.competitionModel
          .findOne({ competitionId })
          .populate('leaderboard.userId', 'username profilePicture')
          .exec();

        if (!competition) {
          throw new Error('Compétition non trouvée');
        }

        const scores = competition.leaderboard.map(entry => entry.score);
        const totalParticipants = competition.participants;
        const averageScore = scores.length > 0 ? 
          scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

        // Distribution des scores
        const sortedScores = scores.sort((a, b) => a - b);
        const min = sortedScores[0] || 0;
        const max = sortedScores[sortedScores.length - 1] || 0;
        const mean = averageScore;
        
        const quartiles = [
          sortedScores[Math.floor(sortedScores.length * 0.25)] || 0,
          sortedScores[Math.floor(sortedScores.length * 0.50)] || 0,
          sortedScores[Math.floor(sortedScores.length * 0.75)] || 0
        ];

        // Participation par heure (basée sur lastUpdate)
        const participationByTime: { [hour: string]: number } = {};
        for (let hour = 0; hour < 24; hour++) {
          const hourKey = hour.toString().padStart(2, '0');
          participationByTime[hourKey] = competition.leaderboard.filter(entry => {
            const updateHour = entry.lastUpdate.getHours();
            return updateHour === hour;
          }).length;
        }

        // Top performers (top 10)
        const topPerformers = competition.leaderboard
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 10)
          .map(entry => ({
            userId: entry.userId.toString(),
            username: entry.username,
            profilePicture: entry.profilePicture,
            rank: entry.rank,
            score: entry.score,
            metrics: entry.metrics,
            lastUpdate: entry.lastUpdate,
            streak: entry.streak,
            isQualified: entry.isQualified
          }));

        return {
          totalParticipants,
          averageScore,
          scoreDistribution: {
            min,
            max,
            mean,
            quartiles
          },
          participationByTime,
          topPerformers
        };
      },
      'Competition',
      `stats-${competitionId}`
    );
  }

  /**
   * Obtenir les statistiques globales des compétitions
   */
  async getGlobalStats(period?: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalCompetitions: number;
    totalParticipations: number;
    averageParticipation: number;
    completionRate: number;
    byCategory: { [category: string]: number };
    byType: { [type: string]: number };
    participationTrends: { [date: string]: number };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const matchQuery: any = {};
        if (period) {
          matchQuery.createdAt = {
            $gte: period.startDate,
            $lte: period.endDate
          };
        }

        const pipeline = [
          { $match: matchQuery },
          {
            $facet: {
              overview: [
                {
                  $group: {
                    _id: null,
                    totalCompetitions: { $sum: 1 },
                    totalParticipations: { $sum: '$participants' },
                    completedCompetitions: {
                      $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
                    }
                  }
                }
              ],
              byCategory: [
                {
                  $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                  }
                }
              ],
              byType: [
                {
                  $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                  }
                }
              ],
              participationTrends: [
                {
                  $group: {
                    _id: {
                      $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$createdAt'
                      }
                    },
                    participations: { $sum: '$participants' }
                  }
                },
                { $sort: { '_id': 1 } }
              ]
            }
          }
        ];

        const [result] = await this.competitionModel.aggregate(pipeline as any).exec();

        const overview = result.overview[0] || {
          totalCompetitions: 0,
          totalParticipations: 0,
          completedCompetitions: 0
        };

        const averageParticipation = overview.totalCompetitions > 0 ?
          overview.totalParticipations / overview.totalCompetitions : 0;

        const completionRate = overview.totalCompetitions > 0 ?
          (overview.completedCompetitions / overview.totalCompetitions) * 100 : 0;

        const byCategory = result.byCategory.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {});

        const byType = result.byType.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {});

        const participationTrends = result.participationTrends.reduce((acc: any, item: any) => {
          acc[item._id] = item.participations;
          return acc;
        }, {});

        return {
          totalCompetitions: overview.totalCompetitions,
          totalParticipations: overview.totalParticipations,
          averageParticipation: Math.round(averageParticipation * 100) / 100,
          completionRate: Math.round(completionRate * 100) / 100,
          byCategory,
          byType,
          participationTrends
        };
      },
      'Competition',
      'globalStats'
    );
  }

  /**
   * Obtenir les compétitions d'un utilisateur
   */
  async getUserCompetitions(userId: string, options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    competitions: Array<{
      competition: Competition;
      userRank: number;
      userScore: number;
      isWinner: boolean;
    }>;
    total: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { status, limit = 10, offset = 0 } = options;
        
        const query: any = {
          'leaderboard.userId': new Types.ObjectId(userId)
        };

        if (status) {
          query.status = status;
        }

        const competitions = await this.competitionModel
          .find(query)
          .skip(offset)
          .limit(limit)
          .populate('createdBy', 'username email')
          .sort({ createdAt: -1 })
          .exec();

        const total = await this.competitionModel.countDocuments(query).exec();

        const result = competitions.map(competition => {
          const userEntry = competition.leaderboard.find(
            entry => entry.userId.toString() === userId
          );

          return {
            competition,
            userRank: userEntry?.rank || 0,
            userScore: userEntry?.score || 0,
            isWinner: userEntry?.rank === 1 || false
          };
        });

        return {
          competitions: result,
          total
        };
      },
      'Competition',
      `userCompetitions-${userId}`
    );
  }

  /**
   * Distribuer les prix d'une compétition terminée
   */
  async distributePrizes(competitionId: string): Promise<Array<{
    userId: string;
    prizes: any[];
    distributed: boolean;
  }>> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const competition = await this.competitionModel
          .findOne({ competitionId })
          .exec();

        if (!competition || competition.status !== 'ended') {
          throw new Error('Compétition non trouvée ou non terminée');
        }

        const winners: Array<{
          userId: string;
          prizes: any[];
          distributed: boolean;
        }> = [];

        // Distribuer les prix selon les rangs
        for (const entry of competition.leaderboard) {
          const applicablePrizes = competition.prizes.filter(
            prize => prize.rank === entry.rank
          );

          if (applicablePrizes.length > 0) {
            winners.push({
              userId: entry.userId.toString(),
              prizes: applicablePrizes,
              distributed: true
            });

            // TODO: Intégrer avec le système de récompenses
            console.log(`Prix distribués à ${entry.username}:`, applicablePrizes);
          }
        }

        return winners;
      },
      'Competition',
      `distributePrizes-${competitionId}`
    );
  }

  /**
   * Marquer une compétition comme terminée
   */
  async markAsCompleted(competitionId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.competitionModel.updateOne(
          { competitionId },
          { 
            $set: { 
              status: 'ended',
              endDate: new Date()
            }
          }
        ).exec();

        return result.modifiedCount > 0;
      },
      'Competition',
      `markCompleted-${competitionId}`
    );
  }

  /**
   * Planifier la prochaine compétition récurrente
   */
  async scheduleNextRecurring(competitionId: string): Promise<Competition | null> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const originalCompetition = await this.competitionModel
          .findOne({ competitionId })
          .exec();

        if (!originalCompetition || originalCompetition.type === 'special') {
          return null;
        }

        // Calculer les nouvelles dates
        const duration = originalCompetition.endDate.getTime() - originalCompetition.startDate.getTime();
        const now = new Date();
        let nextStartDate = new Date(now);

        switch (originalCompetition.type) {
          case 'daily':
            nextStartDate.setDate(nextStartDate.getDate() + 1);
            break;
          case 'weekly':
            nextStartDate.setDate(nextStartDate.getDate() + 7);
            break;
          case 'monthly':
            nextStartDate.setMonth(nextStartDate.getMonth() + 1);
            break;
          case 'seasonal':
            nextStartDate.setMonth(nextStartDate.getMonth() + 3);
            break;
        }

        const nextEndDate = new Date(nextStartDate.getTime() + duration);

        const nextCompetitionData: CreateCompetitionData = {
          name: originalCompetition.name,
          description: originalCompetition.description,
          type: originalCompetition.type as any,
          category: originalCompetition.category as any,
          startDate: nextStartDate,
          endDate: nextEndDate,
          prizes: originalCompetition.prizes,
          rules: originalCompetition.rules,
          metadata: originalCompetition.metadata,
          createdBy: originalCompetition.createdBy.toString()
        };

        return await this.create(nextCompetitionData);
      },
      'Competition',
      `scheduleNext-${competitionId}`
    );
  }

  /**
   * Nettoyer les anciennes compétitions
   */
  async cleanupOldCompetitions(olderThanDays: number): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.competitionModel.deleteMany({
          endDate: { $lt: cutoffDate },
          status: 'ended'
        }).exec();

        return result.deletedCount || 0;
      },
      'Competition',
      `cleanup-${olderThanDays}days`
    );
  }

  /**
   * Archiver les compétitions terminées
   */
  async archiveCompletedCompetitions(olderThanDays: number): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.competitionModel.updateMany(
          {
            endDate: { $lt: cutoffDate },
            status: 'ended'
          },
          {
            $set: { status: 'archived' }
          }
        ).exec();

        return result.modifiedCount || 0;
      },
      'Competition',
      `archive-${olderThanDays}days`
    );
  }
}