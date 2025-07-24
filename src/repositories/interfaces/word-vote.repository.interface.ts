import { WordVote } from '../../social/schemas/word-vote.schema';

/**
 * 🗳️ INTERFACE REPOSITORY WORD VOTE
 * 
 * Interface pour le repository des votes sur les mots.
 * Définit toutes les opérations de base de données pour les votes
 * avec un système sophistiqué de réactions et scoring.
 * 
 * Fonctionnalités :
 * - CRUD complet des votes sur mots
 * - Gestion des réactions multiples (like, love, helpful, etc.)
 * - Système de poids basé sur réputation utilisateur
 * - Contexte spécifique (définition, prononciation, etc.)
 * - Calculs de scores pondérés et statistiques
 * - Protection anti-spam et validation
 */
export interface IWordVoteRepository {
  // ========== CRUD DE BASE ==========
  
  create(voteData: {
    userId: string;
    wordId: string;
    reactionType: 'like' | 'love' | 'helpful' | 'accurate' | 'clear' | 'funny' | 'insightful' | 'disagree';
    context?: 'word' | 'definition' | 'pronunciation' | 'etymology' | 'example' | 'translation';
    contextId?: string;
    weight?: number;
    comment?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<WordVote>;

  findById(id: string): Promise<WordVote | null>;
  
  update(id: string, updateData: Partial<WordVote>): Promise<WordVote | null>;
  
  delete(id: string): Promise<boolean>;

  // ========== GESTION DES VOTES ==========
  
  findUserVote(
    userId: string, 
    wordId: string, 
    context?: string, 
    contextId?: string
  ): Promise<WordVote | null>;

  hasUserVoted(
    userId: string, 
    wordId: string, 
    context?: string, 
    contextId?: string
  ): Promise<boolean>;

  vote(
    userId: string,
    wordId: string,
    reactionType: 'like' | 'love' | 'helpful' | 'accurate' | 'clear' | 'funny' | 'insightful' | 'disagree',
    context?: 'word' | 'definition' | 'pronunciation' | 'etymology' | 'example' | 'translation',
    contextId?: string,
    options?: {
      weight?: number;
      comment?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<{
    vote: WordVote;
    action: 'created' | 'updated' | 'removed';
    previousReaction?: string;
  }>;

  removeUserVote(
    userId: string, 
    wordId: string, 
    context?: string, 
    contextId?: string
  ): Promise<boolean>;

  changeVoteReaction(
    userId: string,
    wordId: string,
    newReactionType: 'like' | 'love' | 'helpful' | 'accurate' | 'clear' | 'funny' | 'insightful' | 'disagree',
    context?: string,
    contextId?: string
  ): Promise<WordVote | null>;

  // ========== STATISTIQUES ET SCORES ==========
  
  findByWord(wordId: string, options?: {
    reactionType?: string;
    context?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'weight';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    votes: WordVote[];
    total: number;
    page: number;
    limit: number;
  }>;

  countByWord(wordId: string, options?: {
    reactionType?: string;
    context?: string;
  }): Promise<{
    [reactionType: string]: number;
    total: number;
  }>;

  getWordScore(wordId: string): Promise<{
    reactions: { [reactionType: string]: { count: number; weight: number } };
    totalVotes: number;
    averageWeight: number;
    popularityScore: number;
    qualityScore: number;
  }>;

  getWeightedScore(wordId: string, context?: string): Promise<{
    positiveScore: number;
    negativeScore: number;
    neutralScore: number;
    overallScore: number;
    weightedAverage: number;
  }>;

  // ========== CLASSEMENTS ET TENDANCES ==========
  
  getMostReacted(options?: {
    reactionType?: string;
    context?: string;
    timeframe?: 'hour' | 'day' | 'week' | 'month' | 'all';
    limit?: number;
    minVotes?: number;
  }): Promise<Array<{
    wordId: string;
    reactions: { [reactionType: string]: number };
    totalScore: number;
    qualityScore: number;
  }>>;

  getTopQualityWords(options?: {
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
    minVotes?: number;
  }): Promise<Array<{
    wordId: string;
    qualityScore: number;
    accurateVotes: number;
    clearVotes: number;
    helpfulVotes: number;
  }>>;

  getTrendingWords(options?: {
    timeframe?: 'hour' | 'day' | 'week';
    limit?: number;
  }): Promise<Array<{
    wordId: string;
    trendScore: number;
    recentVotes: number;
    growth: number;
  }>>;

  // ========== MÉTRIQUES UTILISATEUR ==========
  
  findByUser(userId: string, options?: {
    reactionType?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    votes: WordVote[];
    total: number;
    page: number;
    limit: number;
  }>;

  getUserVotingStats(userId: string): Promise<{
    totalVotes: number;
    reactionBreakdown: { [reactionType: string]: number };
    averageWeight: number;
    contributionScore: number;
  }>;

  // ========== QUALITÉ ET MODÉRATION ==========
  
  detectSpam(wordId: string, options?: {
    timeWindow?: number; // en minutes
    maxVotesPerUser?: number;
    suspiciousPatterns?: boolean;
  }): Promise<{
    isSpam: boolean;
    reasons: string[];
    suspiciousVotes: number;
    rapidVotes: number;
    duplicateIPs: number;
  }>;

  validateVoteIntegrity(wordId: string): Promise<{
    validVotes: number;
    invalidVotes: number;
    issues: string[];
  }>;

  // ========== CONTEXTE SPÉCIFIQUE ==========
  
  getContextStats(wordId: string): Promise<{
    [context: string]: {
      totalVotes: number;
      reactions: { [reactionType: string]: number };
      averageScore: number;
    };
  }>;

  getDefinitionQuality(wordId: string, definitionId: string): Promise<{
    accurateVotes: number;
    clearVotes: number;
    helpfulVotes: number;
    qualityScore: number;
  }>;

  getPronunciationAccuracy(wordId: string): Promise<{
    accurateVotes: number;
    disagreeVotes: number;
    accuracyScore: number;
  }>;

  // ========== MAINTENANCE ET NETTOYAGE ==========
  
  cleanupOldVotes(days: number): Promise<number>;
  
  deleteUserVotes(userId: string): Promise<number>;
  
  deleteWordVotes(wordId: string): Promise<number>;
  
  validateIntegrity(): Promise<{
    invalidWords: string[];
    invalidUsers: string[];
    orphanedVotes: number;
  }>;
}