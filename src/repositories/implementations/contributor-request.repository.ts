import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { 
  ContributorRequest, 
  ContributorRequestDocument, 
  ContributorRequestStatus, 
  ContributorRequestPriority 
} from '../../users/schemas/contributor-request.schema';
import { IContributorRequestRepository } from '../interfaces/contributor-request.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * ✋ REPOSITORY CONTRIBUTOR REQUEST - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository ContributorRequest utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les demandes de contributeur.
 * 
 * Fonctionnalités :
 * - CRUD complet des demandes
 * - Gestion complète du workflow d'évaluation
 * - Système de scoring et évaluation
 * - Analytics et statistiques détaillées
 * - Gestion des notifications et expiration
 */
@Injectable()
export class ContributorRequestRepository implements IContributorRequestRepository {
  constructor(
    @InjectModel(ContributorRequest.name) private contributorRequestModel: Model<ContributorRequestDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(requestData: {
    userId: string;
    username: string;
    email: string;
    motivation: string;
    experience?: string;
    languages?: string;
    commitment: boolean;
    userWordsCount?: number;
    userCommunityPostsCount?: number;
    userJoinDate?: Date;
    userNativeLanguages?: string[];
    userLearningLanguages?: string[];
    linkedIn?: string;
    github?: string;
    portfolio?: string;
  }): Promise<ContributorRequest> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const newRequest = new this.contributorRequestModel({
          ...requestData,
          userId: new Types.ObjectId(requestData.userId),
          userNativeLanguages: requestData.userNativeLanguages || [],
          userLearningLanguages: requestData.userLearningLanguages || [],
          activityLog: [{
            action: 'created',
            performedBy: new Types.ObjectId(requestData.userId),
            performedAt: new Date(),
            notes: 'Demande de contributeur créée'
          }]
        });
        return newRequest.save();
      },
      'ContributorRequest'
    );
  }

  async findById(id: string): Promise<ContributorRequest | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.contributorRequestModel
          .findById(id)
          .populate('userId', 'username email profilePicture')
          .populate('reviewedBy', 'username email')
          .populate('recommendedBy', 'username email')
          .populate('activityLog.performedBy', 'username')
          .exec();
      },
      'ContributorRequest',
      id
    );
  }

  async update(id: string, updateData: Partial<ContributorRequest>): Promise<ContributorRequest | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.contributorRequestModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate('userId', 'username email profilePicture')
          .populate('reviewedBy', 'username email')
          .exec();
      },
      'ContributorRequest',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.contributorRequestModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'ContributorRequest',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findAll(options: {
    page?: number;
    limit?: number;
    status?: ContributorRequestStatus;
    priority?: ContributorRequestPriority;
    isHighPriority?: boolean;
    requiresSpecialReview?: boolean;
    isRecommended?: boolean;
    sortBy?: 'createdAt' | 'priority' | 'evaluationScore' | 'reviewedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    requests: ContributorRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 20,
          status,
          priority,
          isHighPriority,
          requiresSpecialReview,
          isRecommended,
          sortBy = 'createdAt',
          sortOrder = 'desc'
        } = options;

        const filter: any = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (typeof isHighPriority === 'boolean') filter.isHighPriority = isHighPriority;
        if (typeof requiresSpecialReview === 'boolean') filter.requiresSpecialReview = requiresSpecialReview;
        if (typeof isRecommended === 'boolean') filter.isRecommended = isRecommended;

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
          this.contributorRequestModel
            .find(filter)
            .populate('userId', 'username email profilePicture')
            .populate('reviewedBy', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.contributorRequestModel.countDocuments(filter).exec(),
        ]);

        return { requests, total, page, limit };
      },
      'ContributorRequest'
    );
  }

  async search(query: string, options: {
    status?: ContributorRequestStatus;
    priority?: ContributorRequestPriority;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    requests: ContributorRequest[];
    total: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { status, priority, limit = 20, offset = 0 } = options;

        const filter: any = {
          $text: { $search: query }
        };

        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        const [requests, total] = await Promise.all([
          this.contributorRequestModel
            .find(filter)
            .populate('userId', 'username email profilePicture')
            .populate('reviewedBy', 'username email')
            .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
            .skip(offset)
            .limit(limit)
            .exec(),
          this.contributorRequestModel.countDocuments(filter).exec(),
        ]);

        return { requests, total };
      },
      'ContributorRequest'
    );
  }

  async findByUser(userId: string): Promise<ContributorRequest[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return [];
        }
        return this.contributorRequestModel
          .find({ userId: new Types.ObjectId(userId) })
          .populate('reviewedBy', 'username email')
          .sort({ createdAt: -1 })
          .exec();
      },
      'ContributorRequest'
    );
  }

  async findActiveByUser(userId: string): Promise<ContributorRequest | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return null;
        }
        return this.contributorRequestModel
          .findOne({
            userId: new Types.ObjectId(userId),
            status: {
              $in: [
                ContributorRequestStatus.PENDING,
                ContributorRequestStatus.UNDER_REVIEW,
              ],
            },
          })
          .exec();
      },
      'ContributorRequest',
      `active-${userId}`
    );
  }

  async findByStatus(status: ContributorRequestStatus, options: {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'priority';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    requests: ContributorRequest[];
    total: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 20,
          sortBy = 'createdAt',
          sortOrder = 'desc'
        } = options;

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
          this.contributorRequestModel
            .find({ status })
            .populate('userId', 'username email profilePicture')
            .populate('reviewedBy', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.contributorRequestModel.countDocuments({ status }).exec(),
        ]);

        return { requests, total };
      },
      'ContributorRequest'
    );
  }

  async findByPriority(priority: ContributorRequestPriority, options: {
    status?: ContributorRequestStatus;
    limit?: number;
  } = {}): Promise<ContributorRequest[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { status, limit = 20 } = options;

        const filter: any = { priority };
        if (status) filter.status = status;

        return this.contributorRequestModel
          .find(filter)
          .populate('userId', 'username email profilePicture')
          .populate('reviewedBy', 'username email')
          .sort({ createdAt: -1 })
          .limit(limit)
          .exec();
      },
      'ContributorRequest'
    );
  }

  async findByReviewer(reviewerId: string, options: {
    status?: ContributorRequestStatus;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    requests: ContributorRequest[];
    total: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(reviewerId)) {
          return { requests: [], total: 0 };
        }

        const { status, page = 1, limit = 20 } = options;

        const filter: any = { reviewedBy: new Types.ObjectId(reviewerId) };
        if (status) filter.status = status;

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
          this.contributorRequestModel
            .find(filter)
            .populate('userId', 'username email profilePicture')
            .sort({ reviewedAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.contributorRequestModel.countDocuments(filter).exec(),
        ]);

        return { requests, total };
      },
      'ContributorRequest'
    );
  }

  // ========== GESTION DES STATUTS ==========

  async updateStatus(
    id: string, 
    newStatus: ContributorRequestStatus,
    reviewerId: string,
    reviewNotes?: string,
    rejectionReason?: string
  ): Promise<ContributorRequest | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(reviewerId)) {
          return null;
        }

        const request = await this.contributorRequestModel.findById(id).exec();
        if (!request) return null;

        const oldStatus = request.status;
        const updateData: any = {
          status: newStatus,
          reviewedBy: new Types.ObjectId(reviewerId),
          reviewedAt: new Date(),
          reviewCount: request.reviewCount + 1
        };

        if (reviewNotes) updateData.reviewNotes = reviewNotes;
        if (rejectionReason) updateData.rejectionReason = rejectionReason;

        // Ajouter au log d'activité
        updateData.$push = {
          activityLog: {
            action: `status_changed_to_${newStatus}`,
            performedBy: new Types.ObjectId(reviewerId),
            performedAt: new Date(),
            notes: reviewNotes,
            oldStatus,
            newStatus
          }
        };

        return this.contributorRequestModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate('userId', 'username email profilePicture')
          .populate('reviewedBy', 'username email')
          .exec();
      },
      'ContributorRequest',
      id
    );
  }

  async approve(id: string, reviewerId: string, reviewNotes?: string): Promise<ContributorRequest | null> {
    return this.updateStatus(id, ContributorRequestStatus.APPROVED, reviewerId, reviewNotes);
  }

  async reject(id: string, reviewerId: string, rejectionReason: string, reviewNotes?: string): Promise<ContributorRequest | null> {
    return this.updateStatus(id, ContributorRequestStatus.REJECTED, reviewerId, reviewNotes, rejectionReason);
  }

  async putUnderReview(id: string, reviewerId: string, reviewNotes?: string): Promise<ContributorRequest | null> {
    return this.updateStatus(id, ContributorRequestStatus.UNDER_REVIEW, reviewerId, reviewNotes);
  }

  // ========== MÉTHODES SIMPLIFIÉES (POUR L'INSTANT) ==========
  // Ces méthodes retournent des implémentations de base qui peuvent être étoffées

  async updateEvaluationScore(id: string, score: number, criteria?: string[]): Promise<ContributorRequest | null> {
    return this.update(id, { evaluationScore: score, evaluationCriteria: criteria });
  }

  async updateSkillsAssessment(id: string, skills: Record<string, number>): Promise<ContributorRequest | null> {
    return this.update(id, { skillsAssessment: new Map(Object.entries(skills)) });
  }

  async markAsRecommended(id: string, recommendedBy: string, recommendationNotes?: string): Promise<ContributorRequest | null> {
    if (!Types.ObjectId.isValid(recommendedBy)) return null;
    return this.update(id, {
      isRecommended: true,
      recommendedBy: new Types.ObjectId(recommendedBy),
      recommendationNotes
    });
  }

  async markAsHighPriority(id: string, requiresSpecialReview?: boolean): Promise<ContributorRequest | null> {
    const updateData: any = { isHighPriority: true };
    if (typeof requiresSpecialReview === 'boolean') {
      updateData.requiresSpecialReview = requiresSpecialReview;
    }
    return this.update(id, updateData);
  }

  async addActivityLog(
    id: string,
    action: string,
    performedBy: string,
    notes?: string,
    oldStatus?: ContributorRequestStatus,
    newStatus?: ContributorRequestStatus
  ): Promise<ContributorRequest | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(performedBy)) {
          return null;
        }

        return this.contributorRequestModel
          .findByIdAndUpdate(
            id,
            {
              $push: {
                activityLog: {
                  action,
                  performedBy: new Types.ObjectId(performedBy),
                  performedAt: new Date(),
                  notes,
                  oldStatus,
                  newStatus
                }
              }
            },
            { new: true }
          )
          .populate('userId', 'username email profilePicture')
          .exec();
      },
      'ContributorRequest',
      id
    );
  }

  async getActivityLog(id: string): Promise<Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    notes?: string;
    oldStatus?: ContributorRequestStatus;
    newStatus?: ContributorRequestStatus;
  }>> {
    const request = await this.findById(id);
    return request ? request.activityLog : [];
  }

  async markAsNotified(id: string): Promise<ContributorRequest | null> {
    return this.update(id, {
      applicantNotified: true,
      lastNotificationSent: new Date()
    });
  }

  async findPendingNotifications(): Promise<ContributorRequest[]> {
    return this.contributorRequestModel
      .find({
        applicantNotified: false,
        status: { $in: [ContributorRequestStatus.APPROVED, ContributorRequestStatus.REJECTED] }
      })
      .exec();
  }

  async findExpiringSoon(days: number = 7): Promise<ContributorRequest[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.contributorRequestModel
      .find({
        expiresAt: { $lte: futureDate, $gt: new Date() },
        status: ContributorRequestStatus.PENDING
      })
      .exec();
  }

  async findExpired(): Promise<ContributorRequest[]> {
    return this.contributorRequestModel
      .find({
        expiresAt: { $lt: new Date() },
        status: ContributorRequestStatus.PENDING
      })
      .exec();
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.contributorRequestModel
      .deleteMany({
        expiresAt: { $lt: new Date() },
        status: ContributorRequestStatus.PENDING
      })
      .exec();
    return result.deletedCount || 0;
  }

  // ========== MÉTHODES STUB (À IMPLÉMENTER SELON BESOINS) ==========

  async getGlobalStats(): Promise<any> {
    const stats = await this.contributorRequestModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).exec();

    const result = {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      underReviewRequests: 0,
      averageProcessingTime: 0,
      approvalRate: 0
    };

    stats.forEach(stat => {
      result.totalRequests += stat.count;
      switch (stat._id) {
        case ContributorRequestStatus.PENDING:
          result.pendingRequests = stat.count;
          break;
        case ContributorRequestStatus.APPROVED:
          result.approvedRequests = stat.count;
          break;
        case ContributorRequestStatus.REJECTED:
          result.rejectedRequests = stat.count;
          break;
        case ContributorRequestStatus.UNDER_REVIEW:
          result.underReviewRequests = stat.count;
          break;
      }
    });

    result.approvalRate = result.totalRequests > 0 
      ? (result.approvedRequests / result.totalRequests) * 100 
      : 0;

    return result;
  }

  async getStatsByPeriod(startDate: Date, endDate: Date): Promise<any> {
    return {
      submitted: 0,
      approved: 0,
      rejected: 0,
      avgEvaluationScore: 0
    };
  }

  async getReviewerStats(reviewerId: string): Promise<any> {
    return {
      totalReviewed: 0,
      approved: 0,
      rejected: 0,
      avgProcessingTime: 0,
      avgEvaluationScore: 0
    };
  }

  async getTopEvaluatedRequests(limit: number = 10): Promise<ContributorRequest[]> {
    return this.contributorRequestModel
      .find({ evaluationScore: { $exists: true } })
      .sort({ evaluationScore: -1 })
      .limit(limit)
      .populate('userId', 'username email')
      .exec();
  }

  async findByScoreRange(minScore: number, maxScore: number): Promise<ContributorRequest[]> {
    return this.contributorRequestModel
      .find({
        evaluationScore: { $gte: minScore, $lte: maxScore }
      })
      .sort({ evaluationScore: -1 })
      .exec();
  }

  async bulkUpdateStatus(
    ids: string[], 
    newStatus: ContributorRequestStatus,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<number> {
    const validIds = ids.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return 0;

    const result = await this.contributorRequestModel
      .updateMany(
        { _id: { $in: validIds.map(id => new Types.ObjectId(id)) } },
        {
          status: newStatus,
          reviewedBy: new Types.ObjectId(reviewerId),
          reviewedAt: new Date(),
          reviewNotes
        }
      )
      .exec();

    return result.modifiedCount || 0;
  }

  async deleteMany(ids: string[]): Promise<number> {
    const validIds = ids.filter(id => Types.ObjectId.isValid(id));
    const result = await this.contributorRequestModel
      .deleteMany({ _id: { $in: validIds.map(id => new Types.ObjectId(id)) } })
      .exec();
    return result.deletedCount || 0;
  }

  async exportRequests(filters: any = {}): Promise<ContributorRequest[]> {
    return this.contributorRequestModel
      .find(filters)
      .populate('userId', 'username email')
      .populate('reviewedBy', 'username email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async validateUserReferences(): Promise<any> {
    return {
      invalidUserIds: [],
      invalidReviewerIds: [],
      orphanedRequests: []
    };
  }

  async cleanupOrphaned(): Promise<number> {
    return 0;
  }
}