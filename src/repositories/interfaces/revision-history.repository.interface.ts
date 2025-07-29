import { RevisionHistory } from "../../dictionary/schemas/revision-history.schema";

/**
 * Interface pour le repository de l'historique des révisions
 * Suit les patterns établis dans l'application
 */
export interface IRevisionHistoryRepository {
  /**
   * Créer une nouvelle révision
   */
  create(revisionData: {
    wordId: string;
    changes: Record<string, any>;
    modifiedBy: string;
    modifiedAt: Date;
    status?: "pending" | "approved" | "rejected" | "cancelled";
    action?: "create" | "update" | "delete" | "restore";
    comment?: string;
    reason?: string;
    version?: number;
    priority?: "low" | "medium" | "high" | "urgent";
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<RevisionHistory>;

  /**
   * Trouver une révision par ID
   */
  findById(id: string): Promise<RevisionHistory | null>;

  /**
   * Récupérer toutes les révisions d'un mot
   */
  findByWordId(
    wordId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      sortBy?: "modifiedAt" | "version" | "priority";
      sortOrder?: "asc" | "desc";
    }
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Récupérer les révisions d'un utilisateur
   */
  findByUserId(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      wordId?: string;
    }
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Mettre à jour une révision
   */
  update(
    id: string,
    updateData: {
      status?: "pending" | "approved" | "rejected" | "cancelled";
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNotes?: string;
      actualProcessingTime?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<RevisionHistory | null>;

  /**
   * Supprimer une révision
   */
  delete(id: string): Promise<boolean>;

  /**
   * Approuver une révision
   */
  approve(
    id: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<RevisionHistory | null>;

  /**
   * Rejeter une révision
   */
  reject(
    id: string,
    reviewerId: string,
    reviewNotes?: string
  ): Promise<RevisionHistory | null>;

  /**
   * Obtenir les statistiques des révisions
   */
  getStatistics(options: {
    period: string;
    userId?: string;
    wordId?: string;
  }): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    topContributors: Array<{
      userId: string;
      username: string;
      revisionCount: number;
      approvalRate: number;
    }>;
    averageProcessingTime: number;
    byPriority: {
      low: number;
      medium: number;
      high: number;
      urgent: number;
    };
    byAction: {
      create: number;
      update: number;
      delete: number;
      restore: number;
    };
  }>;

  /**
   * Rechercher dans les révisions
   */
  search(
    query: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      userId?: string;
      wordId?: string;
      priority?: string;
      action?: string;
    }
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;

  /**
   * Compter les révisions faites aujourd'hui par un utilisateur
   */
  countTodayRevisions(userId: string): Promise<number>;

  /**
   * Obtenir les révisions en attente par priorité
   */
  getPendingByPriority(
    priority?: "low" | "medium" | "high" | "urgent"
  ): Promise<RevisionHistory[]>;

  /**
   * Compter les révisions par statut
   */
  countByStatus(
    status: "pending" | "approved" | "rejected" | "cancelled"
  ): Promise<number>;

  /**
   * Obtenir les révisions récentes
   */
  getRecentRevisions(
    limit?: number,
    userId?: string
  ): Promise<RevisionHistory[]>;

  /**
   * Obtenir le temps moyen de traitement
   */
  getAverageProcessingTime(
    period?: "day" | "week" | "month" | "year"
  ): Promise<number>;

  /**
   * Obtenir les révisions par tags
   */
  findByTags(
    tags: string[],
    options?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Archiver les anciennes révisions
   */
  archiveOldRevisions(olderThanDays: number): Promise<number>;
}

/**
 * Type pour les données de création d'une révision
 */
export interface CreateRevisionData {
  wordId: string;
  changes: Record<string, any>;
  modifiedBy: string;
  modifiedAt?: Date;
  status?: "pending" | "approved" | "rejected" | "cancelled";
  action?: "create" | "update" | "delete" | "restore";
  comment?: string;
  reason?: string;
  version?: number;
  priority?: "low" | "medium" | "high" | "urgent";
  tags?: string[];
  metadata?: Record<string, any>;
}