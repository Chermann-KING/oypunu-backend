import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { Types } from "mongoose";
import {
  ContributorRequest,
  ContributorRequestStatus,
  ContributorRequestPriority,
} from "../schemas/contributor-request.schema";
import { User, UserRole } from "../schemas/user.schema";
import { IContributorRequestRepository } from "../../repositories/interfaces/contributor-request.repository.interface";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { CreateContributorRequestDto } from "../dto/create-contributor-request.dto";
import {
  ReviewContributorRequestDto,
  UpdateContributorRequestPriorityDto,
  BulkActionDto,
  ContributorRequestFiltersDto,
} from "../dto/review-contributor-request.dto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

export interface ContributorRequestListResponse {
  requests: ContributorRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statistics: {
    pending: number;
    approved: number;
    rejected: number;
    underReview: number;
    total: number;
    avgProcessingDays: number;
    approvalRate: number;
  };
}

export interface ContributorRequestStats {
  totalRequests: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  underReviewRequests: number;
  requestsThisMonth: number;
  requestsThisWeek: number;
  avgProcessingTime: number;
  approvalRate: number;
  topLanguages: Array<{ language: string; count: number }>;
  requestsByPriority: Record<ContributorRequestPriority, number>;
  expiringSoonCount: number;
}

@Injectable()
export class ContributorRequestService {
  constructor(
    @Inject('IContributorRequestRepository')
    private contributorRequestRepository: IContributorRequestRepository,
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
    @InjectModel(ContributorRequest.name)
    private contributorRequestModel: Model<ContributorRequest>,
    @InjectModel(User.name)
    private userModel: Model<User>,
    private eventEmitter: EventEmitter2
  ) {}

  // Vérifier les permissions
  private checkPermission(userRole: UserRole, requiredRole: UserRole): void {
    const roleHierarchy = {
      [UserRole.USER]: 0,
      [UserRole.CONTRIBUTOR]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.SUPERADMIN]: 3,
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenException("Permissions insuffisantes");
    }
  }

  // Créer une demande de contribution
  async createRequest(
    userId: string,
    createDto: CreateContributorRequestDto
  ): Promise<ContributorRequest> {
    // Vérifier si l'utilisateur existe
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    // Vérifier si l'utilisateur n'est pas déjà contributeur ou plus
    if (user.role !== UserRole.USER) {
      throw new BadRequestException(
        "Vous êtes déjà contributeur ou avez un rôle supérieur"
      );
    }

    // Vérifier s'il n'y a pas déjà une demande en cours
    const existingRequest = await this.contributorRequestRepository.findActiveByUser(userId);

    if (existingRequest) {
      throw new ConflictException(
        "Vous avez déjà une demande en cours de traitement"
      );
    }

    // Collecter les informations du profil utilisateur
    const userStats = await this.getUserStats(userId);

    // Créer la demande
    const savedRequest = await this.contributorRequestRepository.create({
      userId,
      username: user.username,
      email: user.email,
      ...createDto,
      userWordsCount: userStats.wordsCount,
      userCommunityPostsCount: userStats.postsCount,
      userJoinDate: (user as any).createdAt,
      userNativeLanguages: user.nativeLanguageId
        ? [
            user.nativeLanguageId.iso639_1 ||
              user.nativeLanguageId.iso639_2 ||
              user.nativeLanguageId.iso639_3 ||
              user.nativeLanguageId.name,
          ]
        : [],
      userLearningLanguages:
        user.learningLanguageIds
          ?.map(
            (lang) =>
              lang.iso639_1 || lang.iso639_2 || lang.iso639_3 || lang.name
          )
          .filter(Boolean) || [],
    });

    // Émettre un événement pour notifications
    this.eventEmitter.emit("contributor.request.created", {
      requestId: (savedRequest as any)._id?.toString(),
      userId,
      username: user.username,
      priority: savedRequest.priority,
    });

    return savedRequest;
  }

  // Récupérer les statistiques utilisateur
  private async getUserStats(userId: string) {
    return this.userRepository.getUserStats(userId);
  }

  // Calculer la priorité initiale basée sur l'activité de l'utilisateur
  private calculateInitialPriority(
    userStats: { wordsCount: number; postsCount: number },
    createDto: CreateContributorRequestDto
  ): ContributorRequestPriority {
    const activityScore = userStats.wordsCount * 2 + userStats.postsCount;
    const motivationScore = createDto.motivation.length;
    const experienceScore = createDto.experience
      ? createDto.experience.length
      : 0;

    const totalScore =
      activityScore + motivationScore / 10 + experienceScore / 5;

    if (totalScore > 200) return ContributorRequestPriority.HIGH;
    if (totalScore > 100) return ContributorRequestPriority.MEDIUM;
    return ContributorRequestPriority.LOW;
  }

  // Récupérer les demandes avec filtres et pagination
  async getRequests(
    page = 1,
    limit = 20,
    filters: ContributorRequestFiltersDto = {},
    userRole: UserRole
  ): Promise<ContributorRequestListResponse> {
    this.checkPermission(userRole, UserRole.ADMIN);

    const query: any = {};

    // Appliquer les filtres
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    if (filters.reviewedBy) {
      query.reviewedBy = new Types.ObjectId(filters.reviewedBy);
    }

    if (filters.highPriorityOnly) {
      query.isHighPriority = true;
    }

    if (filters.specialReviewOnly) {
      query.requiresSpecialReview = true;
    }

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    if (filters.maxDaysOld) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filters.maxDaysOld);
      query.createdAt = { $gte: cutoffDate };
    }

    if (filters.expiringSoon) {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      query.expiresAt = { $lte: weekFromNow, $gt: new Date() };
    }

    const skip = (page - 1) * limit;
    const total = await this.contributorRequestModel.countDocuments(query);

    const requests = await this.contributorRequestModel
      .find(query)
      .populate("userId", "username email profilePicture lastActive")
      .populate("reviewedBy", "username email")  
      .populate("recommendedBy", "username email")
      .skip(skip)
      .limit(limit)
      .sort({ 
        priority: -1, 
        createdAt: -1,
        updatedAt: -1 
      })
      .exec();

    // Calculer les statistiques
    const statistics = await this.calculateListStatistics();

    return {
      requests,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      statistics,
    };
  }

  // Calculer les statistiques pour la liste
  private async calculateListStatistics() {
    const stats = await this.contributorRequestModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgDays: {
            $avg: {
              $cond: [
                { $ne: ["$reviewedAt", null] },
                {
                  $divide: [
                    { $subtract: ["$reviewedAt", "$createdAt"] },
                    1000 * 60 * 60 * 24,
                  ],
                },
                null,
              ],
            },
          },
        },
      },
    ]);

    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      underReview: 0,
      total: 0,
      avgProcessingDays: 0,
      approvalRate: 0,
    };

    let totalProcessed = 0;
    let totalApproved = 0;
    let avgDaysSum = 0;
    let avgDaysCount = 0;

    for (const stat of stats) {
      result.total += stat.count;
      result[stat._id] = stat.count;

      if (stat._id === "approved" || stat._id === "rejected") {
        totalProcessed += stat.count;
        if (stat._id === "approved") {
          totalApproved += stat.count;
        }
        if (stat.avgDays) {
          avgDaysSum += stat.avgDays * stat.count;
          avgDaysCount += stat.count;
        }
      }
    }

    result.avgProcessingDays =
      avgDaysCount > 0 ? Math.round(avgDaysSum / avgDaysCount) : 0;
    result.approvalRate =
      totalProcessed > 0
        ? Math.round((totalApproved / totalProcessed) * 100)
        : 0;

    return result;
  }

  // Réviser une demande (approuver/rejeter/etc.)
  async reviewRequest(
    requestId: string,
    reviewDto: ReviewContributorRequestDto,
    reviewerId: string,
    userRole: UserRole
  ): Promise<ContributorRequest> {
    this.checkPermission(userRole, UserRole.ADMIN);

    const request = await this.contributorRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException("Demande non trouvée");
    }

    // Validation spécifique pour le rejet
    if (
      reviewDto.status === ContributorRequestStatus.REJECTED &&
      !reviewDto.rejectionReason
    ) {
      throw new BadRequestException("Une raison de rejet est requise");
    }

    const oldStatus = request.status;
    const newStatus = reviewDto.status;

    // Mettre à jour la demande
    const updateData: any = {
      status: newStatus,
      reviewedBy: new Types.ObjectId(reviewerId),
      reviewedAt: new Date(),
      reviewCount: request.reviewCount + 1,
      ...(reviewDto.reviewNotes && { reviewNotes: reviewDto.reviewNotes }),
      ...(reviewDto.rejectionReason && {
        rejectionReason: reviewDto.rejectionReason,
      }),
      ...(reviewDto.evaluationScore !== undefined && {
        evaluationScore: reviewDto.evaluationScore,
      }),
      ...(reviewDto.evaluationCriteria && {
        evaluationCriteria: reviewDto.evaluationCriteria,
      }),
      ...(reviewDto.skillsAssessment && {
        skillsAssessment: reviewDto.skillsAssessment,
      }),
      ...(reviewDto.isHighPriority !== undefined && {
        isHighPriority: reviewDto.isHighPriority,
      }),
      ...(reviewDto.requiresSpecialReview !== undefined && {
        requiresSpecialReview: reviewDto.requiresSpecialReview,
      }),
    };

    // Ajouter au log d'activité
    updateData.$push = {
      activityLog: {
        action: "reviewed",
        performedBy: new Types.ObjectId(reviewerId),
        performedAt: new Date(),
        notes: reviewDto.reviewNotes || `Status changed to ${newStatus}`,
        oldStatus,
        newStatus,
      },
    };

    const updatedRequest = await this.contributorRequestModel
      .findByIdAndUpdate(requestId, updateData, { new: true })
      .populate("userId", "username email");

    // Si approuvé, promouvoir l'utilisateur
    if (newStatus === ContributorRequestStatus.APPROVED) {
      await this.promoteUserToContributor(request.userId.toString());
    }

    // Émettre un événement pour notifications
    this.eventEmitter.emit("contributor.request.reviewed", {
      requestId,
      userId: request.userId,
      oldStatus,
      newStatus,
      reviewerId,
      reviewNotes: reviewDto.reviewNotes,
    });

    return updatedRequest!;
  }

  // Promouvoir un utilisateur au rôle de contributeur
  private async promoteUserToContributor(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      role: UserRole.CONTRIBUTOR,
      promotedAt: new Date(),
    });

    this.eventEmitter.emit("user.promoted", {
      userId,
      newRole: UserRole.CONTRIBUTOR,
      promotedAt: new Date(),
    });
  }

  // Mettre à jour la priorité d'une demande
  async updatePriority(
    requestId: string,
    priorityDto: UpdateContributorRequestPriorityDto,
    adminId: string,
    userRole: UserRole
  ): Promise<ContributorRequest> {
    this.checkPermission(userRole, UserRole.ADMIN);

    const request = await this.contributorRequestModel.findById(requestId);
    if (!request) {
      throw new NotFoundException("Demande non trouvée");
    }

    const updateData = {
      priority: priorityDto.priority,
      $push: {
        activityLog: {
          action: "priority_updated",
          performedBy: new Types.ObjectId(adminId),
          performedAt: new Date(),
          notes:
            priorityDto.reason || `Priority changed to ${priorityDto.priority}`,
        },
      },
    };

    const updated = await this.contributorRequestModel.findByIdAndUpdate(
      requestId,
      updateData,
      { new: true }
    );
    if (!updated) {
      throw new NotFoundException("Demande de contribution non trouvée");
    }
    return updated;
  }

  // Actions en lot
  async bulkAction(
    bulkDto: BulkActionDto,
    adminId: string,
    userRole: UserRole
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    this.checkPermission(userRole, UserRole.ADMIN);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const requestId of bulkDto.requestIds) {
      try {
        await this.reviewRequest(
          requestId,
          { status: bulkDto.action, reviewNotes: bulkDto.notes },
          adminId,
          userRole
        );
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${requestId}: ${error.message}`);
      }
    }

    return results;
  }

  // Obtenir les statistiques des demandes
  async getStatistics(userRole: UserRole): Promise<ContributorRequestStats> {
    this.checkPermission(userRole, UserRole.ADMIN);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      statusStats,
      timeStats,
      languageStats,
      priorityStats,
      expiringCount,
    ] = await Promise.all([
      this.contributorRequestModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      this.contributorRequestModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            thisMonth: {
              $sum: {
                $cond: [{ $gte: ["$createdAt", monthStart] }, 1, 0],
              },
            },
            thisWeek: {
              $sum: {
                $cond: [{ $gte: ["$createdAt", weekStart] }, 1, 0],
              },
            },
            avgProcessingTime: {
              $avg: {
                $cond: [
                  { $ne: ["$reviewedAt", null] },
                  {
                    $divide: [
                      { $subtract: ["$reviewedAt", "$createdAt"] },
                      1000 * 60 * 60 * 24,
                    ],
                  },
                  null,
                ],
              },
            },
            approvalRate: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "approved"] },
                  100,
                  { $cond: [{ $eq: ["$status", "rejected"] }, 0, null] },
                ],
              },
            },
          },
        },
      ]),
      this.contributorRequestModel.aggregate([
        { $unwind: "$userNativeLanguages" },
        {
          $group: {
            _id: "$userNativeLanguages",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      this.contributorRequestModel.aggregate([
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]),
      this.contributorRequestModel.countDocuments({
        expiresAt: {
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          $gt: now,
        },
      }),
    ]);

    // Organiser les résultats
    const result: ContributorRequestStats = {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      underReviewRequests: 0,
      requestsThisMonth: timeStats[0]?.thisMonth || 0,
      requestsThisWeek: timeStats[0]?.thisWeek || 0,
      avgProcessingTime: Math.round(timeStats[0]?.avgProcessingTime || 0),
      approvalRate: Math.round(timeStats[0]?.approvalRate || 0),
      topLanguages: languageStats.map((item) => ({
        language: item._id,
        count: item.count,
      })),
      requestsByPriority: {
        [ContributorRequestPriority.LOW]: 0,
        [ContributorRequestPriority.MEDIUM]: 0,
        [ContributorRequestPriority.HIGH]: 0,
        [ContributorRequestPriority.URGENT]: 0,
      },
      expiringSoonCount: expiringCount,
    };

    // Remplir les statistiques de statut
    statusStats.forEach((stat) => {
      result.totalRequests += stat.count;
      switch (stat._id) {
        case "pending":
          result.pendingRequests = stat.count;
          break;
        case "approved":
          result.approvedRequests = stat.count;
          break;
        case "rejected":
          result.rejectedRequests = stat.count;
          break;
        case "under_review":
          result.underReviewRequests = stat.count;
          break;
      }
    });

    // Remplir les statistiques de priorité
    priorityStats.forEach((stat) => {
      result.requestsByPriority[stat._id as ContributorRequestPriority] =
        stat.count;
    });

    return result;
  }

  // Obtenir une demande spécifique
  async getRequestById(
    requestId: string,
    userRole: UserRole
  ): Promise<ContributorRequest> {
    this.checkPermission(userRole, UserRole.ADMIN);

    const request = await this.contributorRequestModel
      .findById(requestId)
      .populate(
        "userId",
        "username email profilePicture createdAt lastActive totalWordsAdded totalCommunityPosts"
      )
      .populate("reviewedBy", "username email")
      .populate("recommendedBy", "username email")
      .populate("activityLog.performedBy", "username email");

    if (!request) {
      throw new NotFoundException("Demande non trouvée");
    }

    return request;
  }

  // Nettoyer les demandes expirées
  async cleanupExpiredRequests(): Promise<{ deletedCount: number }> {
    const result = await this.contributorRequestModel.deleteMany({
      expiresAt: { $lt: new Date() },
      status: ContributorRequestStatus.PENDING,
    });

    return { deletedCount: result.deletedCount || 0 };
  }

  // Obtenir les demandes d'un utilisateur spécifique
  async getUserRequests(userId: string): Promise<ContributorRequest[]> {
    return this.contributorRequestModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate("reviewedBy", "username email")
      .sort({ createdAt: -1 })
      .exec();
  }
}
