import { Competition } from '../../achievements/schemas/competition.schema';

export interface CreateCompetitionData {
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'special';
  category: 'contribution' | 'social' | 'learning' | 'mixed';
  startDate: Date;
  endDate: Date;
  prizes: Array<{
    rank: number;
    type: string;
    name: string;
    description: string;
    value: number;
    icon: string;
    rarity: string;
  }>;
  rules?: Array<{
    id: string;
    description: string;
    type: string;
    value: any;
  }>;
  metadata?: any;
  createdBy: string;
}

export interface CompetitionFilters {
  status?: 'upcoming' | 'active' | 'ended' | 'cancelled';
  type?: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'special';
  category?: 'contribution' | 'social' | 'learning' | 'mixed';
  startDate?: Date;
  endDate?: Date;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  profilePicture?: string;
  rank: number;
  score: number;
  metrics: { [key: string]: number };
  lastUpdate: Date;
  streak: number;
  isQualified: boolean;
}

/**
 * 🏆 INTERFACE COMPETITION REPOSITORY
 * 
 * Contrat abstrait pour la gestion des compétitions et classements.
 * Permet de découpler la logique métier de la persistance des données.
 */
export interface ICompetitionRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle compétition
   */
  create(competitionData: CreateCompetitionData): Promise<Competition>;

  /**
   * Récupérer une compétition par ID
   */
  findById(id: string): Promise<Competition | null>;

  /**
   * Récupérer une compétition par competitionId
   */
  findByCompetitionId(competitionId: string): Promise<Competition | null>;

  /**
   * Mettre à jour une compétition
   */
  update(id: string, updateData: Partial<Competition>): Promise<Competition | null>;

  /**
   * Supprimer une compétition
   */
  delete(id: string): Promise<boolean>;

  // ========== RECHERCHE ET FILTRAGE ==========

  /**
   * Récupérer toutes les compétitions avec filtres
   */
  findAll(filters?: CompetitionFilters, options?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    competitions: Competition[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Récupérer les compétitions actives
   */
  findActiveCompetitions(): Promise<Competition[]>;

  /**
   * Récupérer les compétitions par statut
   */
  findByStatus(status: 'upcoming' | 'active' | 'ended' | 'cancelled'): Promise<Competition[]>;

  /**
   * Récupérer les compétitions par catégorie
   */
  findByCategory(category: 'contribution' | 'social' | 'learning' | 'mixed'): Promise<Competition[]>;

  /**
   * Rechercher des compétitions
   */
  search(query: string, filters?: CompetitionFilters): Promise<Competition[]>;

  // ========== GESTION DU LEADERBOARD ==========

  /**
   * Ajouter un participant à une compétition
   */
  addParticipant(competitionId: string, userId: string, initialScore?: number): Promise<boolean>;

  /**
   * Mettre à jour le score d'un participant
   */
  updateParticipantScore(
    competitionId: string, 
    userId: string, 
    score: number, 
    metrics?: { [key: string]: number }
  ): Promise<LeaderboardEntry | null>;

  /**
   * Obtenir le classement d'une compétition
   */
  getLeaderboard(competitionId: string, limit?: number): Promise<LeaderboardEntry[]>;

  /**
   * Obtenir la position d'un utilisateur dans une compétition
   */
  getUserRankInCompetition(competitionId: string, userId: string): Promise<{
    rank: number;
    score: number;
    totalParticipants: number;
  } | null>;

  /**
   * Recalculer et mettre à jour tous les rangs d'une compétition
   */
  recalculateRanks(competitionId: string): Promise<boolean>;

  // ========== STATISTIQUES ==========

  /**
   * Compter les compétitions par statut
   */
  countByStatus(status: 'upcoming' | 'active' | 'ended' | 'cancelled'): Promise<number>;

  /**
   * Obtenir les statistiques d'une compétition
   */
  getCompetitionStats(competitionId: string): Promise<{
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
  }>;

  /**
   * Obtenir les statistiques globales des compétitions
   */
  getGlobalStats(period?: {
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
  }>;

  /**
   * Obtenir les compétitions d'un utilisateur
   */
  getUserCompetitions(userId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    competitions: Array<{
      competition: Competition;
      userRank: number;
      userScore: number;
      isWinner: boolean;
    }>;
    total: number;
  }>;

  // ========== GESTION DES PRIX ==========

  /**
   * Distribuer les prix d'une compétition terminée
   */
  distributePrizes(competitionId: string): Promise<Array<{
    userId: string;
    prizes: any[];
    distributed: boolean;
  }>>;

  /**
   * Marquer une compétition comme terminée
   */
  markAsCompleted(competitionId: string): Promise<boolean>;

  /**
   * Planifier la prochaine compétition récurrente
   */
  scheduleNextRecurring(competitionId: string): Promise<Competition | null>;

  // ========== MAINTENANCE ==========

  /**
   * Nettoyer les anciennes compétitions
   */
  cleanupOldCompetitions(olderThanDays: number): Promise<number>;

  /**
   * Archiver les compétitions terminées
   */
  archiveCompletedCompetitions(olderThanDays: number): Promise<number>;
}