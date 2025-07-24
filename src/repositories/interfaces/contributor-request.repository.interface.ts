import { ContributorRequest, ContributorRequestStatus, ContributorRequestPriority } from '../../users/schemas/contributor-request.schema';

/**
 * ✋ INTERFACE REPOSITORY CONTRIBUTOR REQUEST
 * 
 * Contrat abstrait pour la gestion des demandes de contributeur.
 * Définit toutes les opérations possibles sur les demandes de contribution.
 * 
 * Fonctionnalités couvertes :
 * - CRUD de base
 * - Gestion des statuts et workflow
 * - Recherche et filtrage avancés
 * - Évaluation et scoring
 * - Statistiques et analytics
 * - Notifications et expiration
 */
export interface IContributorRequestRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle demande de contributeur
   */
  create(requestData: {
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
  }): Promise<ContributorRequest>;

  /**
   * Trouver une demande par ID
   */
  findById(id: string): Promise<ContributorRequest | null>;

  /**
   * Mettre à jour une demande
   */
  update(id: string, updateData: Partial<ContributorRequest>): Promise<ContributorRequest | null>;

  /**
   * Supprimer une demande
   */
  delete(id: string): Promise<boolean>;

  // ========== RECHERCHE ET FILTRAGE ==========

  /**
   * Obtenir toutes les demandes avec filtres et pagination
   */
  findAll(options?: {
    page?: number;
    limit?: number;
    status?: ContributorRequestStatus;
    priority?: ContributorRequestPriority;
    isHighPriority?: boolean;
    requiresSpecialReview?: boolean;
    isRecommended?: boolean;
    sortBy?: 'createdAt' | 'priority' | 'evaluationScore' | 'reviewedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    requests: ContributorRequest[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Recherche textuelle dans les demandes
   */
  search(query: string, options?: {
    status?: ContributorRequestStatus;
    priority?: ContributorRequestPriority;
    limit?: number;
    offset?: number;
  }): Promise<{
    requests: ContributorRequest[];
    total: number;
  }>;

  /**
   * Trouver les demandes par utilisateur
   */
  findByUser(userId: string): Promise<ContributorRequest[]>;

  /**
   * Trouver une demande active (pending ou under_review) pour un utilisateur
   */
  findActiveByUser(userId: string): Promise<ContributorRequest | null>;

  /**
   * Trouver les demandes par statut
   */
  findByStatus(status: ContributorRequestStatus, options?: {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'priority';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    requests: ContributorRequest[];
    total: number;
  }>;

  /**
   * Trouver les demandes par priorité
   */
  findByPriority(priority: ContributorRequestPriority, options?: {
    status?: ContributorRequestStatus;
    limit?: number;
  }): Promise<ContributorRequest[]>;

  /**
   * Trouver les demandes assignées à un reviewer
   */
  findByReviewer(reviewerId: string, options?: {
    status?: ContributorRequestStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    requests: ContributorRequest[];
    total: number;
  }>;

  // ========== GESTION DES STATUTS ==========

  /**
   * Changer le statut d'une demande
   */
  updateStatus(
    id: string, 
    newStatus: ContributorRequestStatus,
    reviewerId: string,
    reviewNotes?: string,
    rejectionReason?: string
  ): Promise<ContributorRequest | null>;

  /**
   * Approuver une demande
   */
  approve(id: string, reviewerId: string, reviewNotes?: string): Promise<ContributorRequest | null>;

  /**
   * Rejeter une demande
   */
  reject(id: string, reviewerId: string, rejectionReason: string, reviewNotes?: string): Promise<ContributorRequest | null>;

  /**
   * Mettre en révision
   */
  putUnderReview(id: string, reviewerId: string, reviewNotes?: string): Promise<ContributorRequest | null>;

  // ========== ÉVALUATION ET SCORING ==========

  /**
   * Mettre à jour le score d'évaluation
   */
  updateEvaluationScore(id: string, score: number, criteria?: string[]): Promise<ContributorRequest | null>;

  /**
   * Mettre à jour l'évaluation des compétences
   */
  updateSkillsAssessment(id: string, skills: Record<string, number>): Promise<ContributorRequest | null>;

  /**
   * Marquer comme recommandé
   */
  markAsRecommended(
    id: string, 
    recommendedBy: string, 
    recommendationNotes?: string
  ): Promise<ContributorRequest | null>;

  /**
   * Marquer comme haute priorité
   */
  markAsHighPriority(id: string, requiresSpecialReview?: boolean): Promise<ContributorRequest | null>;

  // ========== GESTION DU LOG D'ACTIVITÉ ==========

  /**
   * Ajouter une entrée au log d'activité
   */
  addActivityLog(
    id: string,
    action: string,
    performedBy: string,
    notes?: string,
    oldStatus?: ContributorRequestStatus,
    newStatus?: ContributorRequestStatus
  ): Promise<ContributorRequest | null>;

  /**
   * Obtenir le log d'activité d'une demande
   */
  getActivityLog(id: string): Promise<Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    notes?: string;
    oldStatus?: ContributorRequestStatus;
    newStatus?: ContributorRequestStatus;
  }>>;

  // ========== GESTION DES NOTIFICATIONS ==========

  /**
   * Marquer comme notifié
   */
  markAsNotified(id: string): Promise<ContributorRequest | null>;

  /**
   * Trouver les demandes nécessitant une notification
   */
  findPendingNotifications(): Promise<ContributorRequest[]>;

  /**
   * Trouver les demandes qui expirent bientôt
   */
  findExpiringSoon(days?: number): Promise<ContributorRequest[]>;

  /**
   * Trouver les demandes expirées
   */
  findExpired(): Promise<ContributorRequest[]>;

  /**
   * Nettoyer les demandes expirées
   */
  cleanupExpired(): Promise<number>;

  // ========== STATISTIQUES ET ANALYTICS ==========

  /**
   * Obtenir les statistiques globales
   */
  getGlobalStats(): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    underReviewRequests: number;
    averageProcessingTime: number; // en jours
    approvalRate: number; // pourcentage
  }>;

  /**
   * Obtenir les statistiques par période
   */
  getStatsByPeriod(startDate: Date, endDate: Date): Promise<{
    submitted: number;
    approved: number;
    rejected: number;
    avgEvaluationScore: number;
  }>;

  /**
   * Obtenir les statistiques par reviewer
   */
  getReviewerStats(reviewerId: string): Promise<{
    totalReviewed: number;
    approved: number;
    rejected: number;
    avgProcessingTime: number;
    avgEvaluationScore: number;
  }>;

  /**
   * Obtenir le leaderboard des évaluations
   */
  getTopEvaluatedRequests(limit?: number): Promise<ContributorRequest[]>;

  /**
   * Obtenir les demandes par tranche de score
   */
  findByScoreRange(minScore: number, maxScore: number): Promise<ContributorRequest[]>;

  // ========== OPÉRATIONS EN MASSE ==========

  /**
   * Mettre à jour plusieurs demandes
   */
  bulkUpdateStatus(
    ids: string[], 
    newStatus: ContributorRequestStatus,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<number>;

  /**
   * Supprimer plusieurs demandes
   */
  deleteMany(ids: string[]): Promise<number>;

  /**
   * Exporter les demandes avec filtres
   */
  exportRequests(filters?: {
    status?: ContributorRequestStatus;
    priority?: ContributorRequestPriority;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ContributorRequest[]>;

  // ========== VALIDATION ET INTÉGRITÉ ==========

  /**
   * Vérifier l'intégrité des références utilisateur
   */
  validateUserReferences(): Promise<{
    invalidUserIds: string[];
    invalidReviewerIds: string[];
    orphanedRequests: string[];
  }>;

  /**
   * Nettoyer les références orphelines
   */
  cleanupOrphaned(): Promise<number>;
}