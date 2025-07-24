import { Vote } from '../../communities/schemas/vote.schema';

/**
 * 🗳️ INTERFACE REPOSITORY VOTE
 * 
 * Contrat abstrait pour la gestion des votes.
 * Définit toutes les opérations possibles sur les votes (posts, commentaires).
 * 
 * Fonctionnalités couvertes :
 * - CRUD de base
 * - Gestion des votes (up/down)
 * - Statistiques et analytics
 * - Validation et intégrité
 * - Détection de contenu controversé
 */
export interface IVoteRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer un vote
   */
  create(voteData: {
    userId: string;
    targetType: 'community_post' | 'post_comment';
    targetId: string;
    voteType: 'up' | 'down';
    reason?: string;
    weight?: number;
  }): Promise<Vote>;

  /**
   * Trouver un vote par ID
   */
  findById(id: string): Promise<Vote | null>;

  /**
   * Mettre à jour un vote
   */
  update(id: string, updateData: Partial<Vote>): Promise<Vote | null>;

  /**
   * Supprimer un vote
   */
  delete(id: string): Promise<boolean>;

  // ========== GESTION DES VOTES ==========

  /**
   * Trouver un vote spécifique d'un utilisateur
   */
  findUserVote(userId: string, targetType: 'community_post' | 'post_comment', targetId: string): Promise<Vote | null>;

  /**
   * Vérifier si un utilisateur a voté pour un contenu
   */
  hasUserVoted(userId: string, targetType: 'community_post' | 'post_comment', targetId: string): Promise<boolean>;

  /**
   * Changer le type de vote (up -> down ou down -> up)
   */
  changeVoteType(userId: string, targetType: 'community_post' | 'post_comment', targetId: string, newVoteType: 'up' | 'down'): Promise<Vote | null>;

  /**
   * Retirer le vote d'un utilisateur
   */
  removeUserVote(userId: string, targetType: 'community_post' | 'post_comment', targetId: string): Promise<boolean>;

  /**
   * Voter ou changer son vote (upsert intelligent)
   */
  vote(userId: string, targetType: 'community_post' | 'post_comment', targetId: string, voteType: 'up' | 'down', reason?: string): Promise<{
    vote: Vote;
    action: 'created' | 'updated' | 'removed';
    previousVoteType?: 'up' | 'down';
  }>;

  // ========== STATISTIQUES DES VOTES ==========

  /**
   * Obtenir les votes d'un contenu
   */
  findByTarget(targetType: 'community_post' | 'post_comment', targetId: string, options?: {
    voteType?: 'up' | 'down';
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'weight';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    votes: Vote[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Compter les votes d'un contenu
   */
  countByTarget(targetType: 'community_post' | 'post_comment', targetId: string): Promise<{
    upVotes: number;
    downVotes: number;
    totalVotes: number;
    score: number; // upVotes - downVotes
  }>;

  /**
   * Obtenir le score d'un contenu (avec poids)
   */
  getWeightedScore(targetType: 'community_post' | 'post_comment', targetId: string): Promise<{
    upVotes: number;
    downVotes: number;
    weightedScore: number;
    averageWeight: number;
  }>;

  /**
   * Obtenir les votes d'un utilisateur
   */
  findByUser(userId: string, options?: {
    targetType?: 'community_post' | 'post_comment';
    voteType?: 'up' | 'down';
    page?: number;
    limit?: number;
    sortBy?: 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    votes: Vote[];
    total: number;
    page: number;
    limit: number;
  }>;

  // ========== ANALYTICS ET TENDANCES ==========

  /**
   * Obtenir les contenus les plus votés
   */
  getMostVoted(targetType: 'community_post' | 'post_comment', options?: {
    voteType?: 'up' | 'down' | 'both';
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
    minVotes?: number;
  }): Promise<Array<{
    targetId: string;
    upVotes: number;
    downVotes: number;
    score: number;
    weightedScore: number;
  }>>;

  /**
   * Obtenir les contenus controversés (beaucoup d'up et down votes)
   */
  getControversial(targetType: 'community_post' | 'post_comment', options?: {
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
    minVotes?: number;
  }): Promise<Array<{
    targetId: string;
    upVotes: number;
    downVotes: number;
    controversyScore: number; // Formule basée sur l'équilibre up/down
  }>>;

  /**
   * Obtenir les statistiques de votes par période
   */
  getVoteStats(options?: {
    targetType?: 'community_post' | 'post_comment';
    timeframe?: 'day' | 'week' | 'month';
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<Array<{
    period: string;
    upVotes: number;
    downVotes: number;
    totalVotes: number;
    uniqueVoters: number;
  }>>;

  /**
   * Obtenir les tendances de votes (évolution dans le temps)
   */
  getVoteTrends(targetType: 'community_post' | 'post_comment', targetId: string, days?: number): Promise<Array<{
    date: Date;
    upVotes: number;
    downVotes: number;
    cumulativeScore: number;
  }>>;

  // ========== MODÉRATION ET QUALITÉ ==========

  /**
   * Trouver les votes avec raisons (généralement des downvotes)
   */
  findVotesWithReasons(options?: {
    targetType?: 'community_post' | 'post_comment';
    voteType?: 'up' | 'down';
    limit?: number;
  }): Promise<Vote[]>;

  /**
   * Obtenir les raisons de downvotes les plus fréquentes
   */
  getCommonDownvoteReasons(limit?: number): Promise<Array<{
    reason: string;
    count: number;
    percentage: number;
  }>>;

  /**
   * Détecter les patterns de votes suspects (vote brigading)
   */
  detectSuspiciousVoting(targetType: 'community_post' | 'post_comment', targetId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    rapidVotes: number; // Votes dans une courte période
    sameIPVotes: number; // À implémenter si on track les IPs
    newAccountVotes: number; // Votes de comptes récents
  }>;

  // ========== VALIDATION ET NETTOYAGE ==========

  /**
   * Valider l'intégrité des votes (targets existent)
   */
  validateIntegrity(): Promise<{
    invalidTargets: Array<{
      voteId: string;
      targetType: string;
      targetId: string;
    }>;
    invalidUsers: Array<{
      voteId: string;
      userId: string;
    }>;
  }>;

  /**
   * Nettoyer les votes orphelins (targets supprimés)
   */
  cleanupOrphaned(): Promise<number>;

  /**
   * Supprimer les votes d'un utilisateur
   */
  deleteUserVotes(userId: string): Promise<number>;

  /**
   * Supprimer tous les votes d'un contenu
   */
  deleteTargetVotes(targetType: 'community_post' | 'post_comment', targetId: string): Promise<number>;

  /**
   * Obtenir les doublons de votes (ne devrait pas arriver avec l'index unique)
   */
  findDuplicates(): Promise<Array<{
    userId: string;
    targetType: string;
    targetId: string;
    count: number;
  }>>;

  // ========== CACHE ET PERFORMANCE ==========

  /**
   * Mettre en cache les scores populaires
   */
  cachePopularScores(limit?: number): Promise<void>;

  /**
   * Invalider le cache des scores
   */
  invalidateScoreCache(targetType: 'community_post' | 'post_comment', targetId: string): Promise<void>;

  /**
   * Obtenir les scores depuis le cache
   */
  getCachedScores(targetIds: string[]): Promise<Record<string, {
    upVotes: number;
    downVotes: number;
    score: number;
  }>>;
}