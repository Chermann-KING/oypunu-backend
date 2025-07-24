import { Injectable, Inject } from '@nestjs/common';
import { IWordRepository } from '../../repositories/interfaces/word.repository.interface';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { IWordViewRepository } from '../../repositories/interfaces/word-view.repository.interface';
import { IWordVoteRepository } from '../../repositories/interfaces/word-vote.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

export interface WordComment {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    profilePicture?: string;
    role: string;
  };
  createdAt: Date;
  updatedAt: Date;
  likes: number;
  isLiked: boolean;
  replies: WordComment[];
  parentId?: string;
}

export interface SocialStats {
  likes: number;
  shares: number;
  comments: number;
  views: number;
  favorites: number;
  averageRating: number;
  totalRatings: number;
  userInteractions?: {
    liked: boolean;
    shared: boolean;
    commented: boolean;
    rated: number;
    favorited: boolean;
  };
  popularityScore: number;
  trendingRank: number;
}

export interface TrendingWord {
  word: any;
  trendScore: number;
  socialStats: SocialStats;
  growth: number;
  rank: number;
  reasons: string[];
}

export interface UsageExample {
  id: string;
  sentence: string;
  translation?: string;
  context: 'formal' | 'informal' | 'technical' | 'literary' | 'everyday';
  source?: string;
  difficulty: string;
  contributedBy: string;
  likes: number;
  audioUrl?: string;
}

@Injectable()
export class WordSocialService {
  // Simuler des bases de données en mémoire pour les fonctionnalités sociales
  private comments: Map<string, WordComment[]> = new Map();
  private likes: Map<string, Set<string>> = new Map(); // wordId -> Set<userId>
  private shares: Map<string, Array<{ userId: string; platform: string; timestamp: Date }>> = new Map();
  private ratings: Map<string, Map<string, { rating: number; comment?: string; timestamp: Date }>> = new Map();
  private usageExamples: Map<string, UsageExample[]> = new Map();
  private commentLikes: Map<string, Set<string>> = new Map(); // commentId -> Set<userId>

  constructor(
    @Inject('IWordRepository') private wordRepository: IWordRepository,
    @Inject('IUserRepository') private userRepository: IUserRepository,
    @Inject('IWordViewRepository') private wordViewRepository: IWordViewRepository,
    @Inject('IWordVoteRepository') private wordVoteRepository: IWordVoteRepository,
  ) {}

  async getWordOfTheDay(): Promise<{
    word: any;
    date: string;
    stats: {
      views: number;
      likes: number;
      shares: number;
      comments: number;
    };
    didYouKnow: string;
    relatedWords: any[];
    challenge: {
      question: string;
      options: string[];
      correctAnswer: number;
      explanation: string;
    };
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Obtenir un mot aléatoire ou sélectionné pour aujourd'hui
        const featuredWords = await this.wordRepository.findFeatured(1);
        const word = featuredWords[0];

        if (!word) {
          throw new Error('Aucun mot disponible pour le mot du jour');
        }

        const wordId = (word as any)._id.toString();
        const socialStats = await this.getSocialStats(wordId);

        // Générer un challenge basé sur le mot
        const challenge = this.generateWordChallenge(word);

        return {
          word: {
            id: wordId,
            word: word.word,
            language: word.language,
            meanings: word.meanings,
            pronunciation: word.pronunciation,
            etymology: word.etymology,
            examples: word.examples || [],
            audioUrl: word.audioFiles?.[0]?.url,
          },
          date: new Date().toISOString().split('T')[0],
          stats: {
            views: socialStats.views,
            likes: socialStats.likes,
            shares: socialStats.shares,
            comments: socialStats.comments,
          },
          didYouKnow: this.generateDidYouKnow(word),
          relatedWords: [], // TODO: Implémenter mots relatés
          challenge,
        };
      },
      'WordSocial',
      'word-of-the-day',
    );
  }

  async addComment(
    wordId: string,
    content: string,
    authorId: string,
    parentId?: string,
  ): Promise<WordComment> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le mot existe
        const word = await this.wordRepository.findById(wordId);
        if (!word) {
          throw new Error('Mot introuvable');
        }

        // Récupérer les informations de l'auteur
        const author = await this.userRepository.findById(authorId);
        if (!author) {
          throw new Error('Utilisateur introuvable');
        }

        const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const comment: WordComment = {
          id: commentId,
          content: content.trim(),
          author: {
            id: authorId,
            username: author.username,
            profilePicture: author.profilePicture,
            role: author.role,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          likes: 0,
          isLiked: false,
          replies: [],
          parentId,
        };

        // Ajouter le commentaire
        const wordComments = this.comments.get(wordId) || [];
        
        if (parentId) {
          // Ajouter comme réponse à un commentaire parent
          const parentComment = wordComments.find(c => c.id === parentId);
          if (parentComment) {
            parentComment.replies.push(comment);
          }
        } else {
          // Ajouter comme commentaire principal
          wordComments.unshift(comment);
        }

        this.comments.set(wordId, wordComments);

        return comment;
      },
      'WordSocial',
      wordId,
      authorId,
    );
  }

  async getComments(
    wordId: string,
    options: {
      page: number;
      limit: number;
      sort: 'newest' | 'oldest' | 'most_liked' | 'most_replies';
      userId?: string;
    }
  ): Promise<{
    comments: WordComment[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let comments = this.comments.get(wordId) || [];

        // Marquer les likes de l'utilisateur si connecté
        if (options.userId) {
          comments = comments.map(comment => ({
            ...comment,
            isLiked: this.commentLikes.get(comment.id)?.has(options.userId!) || false,
            replies: comment.replies.map(reply => ({
              ...reply,
              isLiked: this.commentLikes.get(reply.id)?.has(options.userId!) || false,
            })),
          }));
        }

        // Trier les commentaires
        switch (options.sort) {
          case 'oldest':
            comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            break;
          case 'most_liked':
            comments.sort((a, b) => b.likes - a.likes);
            break;
          case 'most_replies':
            comments.sort((a, b) => b.replies.length - a.replies.length);
            break;
          case 'newest':
          default:
            comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            break;
        }

        // Pagination
        const total = comments.length;
        const startIndex = (options.page - 1) * options.limit;
        const paginatedComments = comments.slice(startIndex, startIndex + options.limit);

        return {
          comments: paginatedComments,
          total,
          page: options.page,
          limit: options.limit,
          hasMore: startIndex + options.limit < total,
        };
      },
      'WordSocial',
      wordId,
    );
  }

  async shareWord(
    wordId: string,
    platform: 'facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'telegram' | 'email',
    userId: string,
    message?: string,
    recipients?: string[],
  ): Promise<{
    success: boolean;
    shareUrl: string;
    platform: string;
    message: string;
    analytics: {
      shareId: string;
      trackingUrl: string;
    };
  }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le mot existe
        const word = await this.wordRepository.findById(wordId);
        if (!word) {
          throw new Error('Mot introuvable');
        }

        // Enregistrer le partage
        const wordShares = this.shares.get(wordId) || [];
        const shareData = {
          userId,
          platform,
          timestamp: new Date(),
        };
        wordShares.push(shareData);
        this.shares.set(wordId, wordShares);

        // Générer l'URL de partage
        const baseUrl = process.env.FRONTEND_URL || 'https://oypunu.com';
        const shareUrl = `${baseUrl}/words/${wordId}`;
        
        // Générer le message de partage
        const shareMessage = message || this.generateShareMessage(word, platform);
        
        // ID unique pour le tracking
        const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return {
          success: true,
          shareUrl,
          platform,
          message: shareMessage,
          analytics: {
            shareId,
            trackingUrl: `${shareUrl}?ref=${shareId}`,
          },
        };
      },
      'WordSocial',
      wordId,
      userId,
    );
  }

  async toggleLike(wordId: string, userId: string): Promise<{
    liked: boolean;
    totalLikes: number;
    message: string;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier que le mot existe
        const word = await this.wordRepository.findById(wordId);
        if (!word) {
          throw new Error('Mot introuvable');
        }

        // Utiliser le système de vote sophistiqué
        const voteResult = await this.wordVoteRepository.vote(
          userId,
          wordId,
          'like'
        );

        // Compter les likes totaux
        const likeCounts = await this.wordVoteRepository.countByWord(wordId, {
          reactionType: 'like'
        });

        return {
          liked: voteResult.action === 'created',
          totalLikes: likeCounts.like || 0,
          message: voteResult.action === 'created' ? 'Like ajouté' : 'Like retiré',
        };
      },
      'WordSocial',
      wordId,
      userId,
    );
  }

  async rateWord(
    wordId: string,
    userId: string,
    rating: number,
    comment?: string,
  ): Promise<{
    userRating: number;
    averageRating: number;
    totalRatings: number;
    ratingDistribution: Record<string, number>;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Validation
        if (rating < 1 || rating > 5) {
          throw new Error('La note doit être entre 1 et 5');
        }

        // Vérifier que le mot existe
        const word = await this.wordRepository.findById(wordId);
        if (!word) {
          throw new Error('Mot introuvable');
        }

        // Enregistrer/mettre à jour la note
        const wordRatings = this.ratings.get(wordId) || new Map();
        wordRatings.set(userId, {
          rating,
          comment,
          timestamp: new Date(),
        });
        this.ratings.set(wordId, wordRatings);

        // Calculer les statistiques
        const allRatings = Array.from(wordRatings.values());
        const totalRatings = allRatings.length;
        const averageRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;

        // Distribution des notes
        const ratingDistribution: Record<string, number> = {
          '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
        };
        allRatings.forEach(r => {
          ratingDistribution[r.rating.toString()]++;
        });

        return {
          userRating: rating,
          averageRating: Math.round(averageRating * 100) / 100,
          totalRatings,
          ratingDistribution,
        };
      },
      'WordSocial',
      wordId,
      userId,
    );
  }

  async getSocialStats(wordId: string, userId?: string): Promise<SocialStats> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Récupérer les statistiques de vote sophistiquées
        const voteStats = await this.wordVoteRepository.getWordScore(wordId);
        const voteCounts = await this.wordVoteRepository.countByWord(wordId);
        
        // Autres statistiques
        const shares = this.shares.get(wordId)?.length || 0;
        const comments = this.getTotalCommentsCount(wordId);
        const views = await this.getWordViews(wordId);
        const favorites = 0; // TODO: Implémenter via repository

        // Statistiques de notation (legacy pour compatibilité)
        const wordRatings = this.ratings.get(wordId);
        const ratingsArray = wordRatings ? Array.from(wordRatings.values()) : [];
        const legacyAverageRating = ratingsArray.length > 0 
          ? ratingsArray.reduce((sum, r) => sum + r.rating, 0) / ratingsArray.length 
          : 0;

        // Interactions utilisateur
        let userInteractions;
        if (userId) {
          const hasVoted = await this.wordVoteRepository.hasUserVoted(userId, wordId);
          const userVote = await this.wordVoteRepository.findUserVote(userId, wordId);
          
          userInteractions = {
            liked: userVote?.reactionType === 'like' || false,
            shared: this.shares.get(wordId)?.some(s => s.userId === userId) || false,
            commented: this.hasUserCommented(wordId, userId),
            rated: wordRatings?.get(userId)?.rating || 0,
            favorited: false, // TODO: Vérifier via repository
          };
        }

        // Score de popularité basé sur le système de vote sophistiqué
        const popularityScore = voteStats.popularityScore + (shares * 5) + (comments * 4) + (views * 0.1);

        return {
          likes: voteCounts.like || 0,
          shares,
          comments,
          views,
          favorites,
          averageRating: Math.round(legacyAverageRating * 100) / 100,
          totalRatings: ratingsArray.length,
          userInteractions,
          popularityScore: Math.round(popularityScore * 100) / 100,
          trendingRank: 0, // TODO: Calculer le rang dans les tendances
        };
      },
      'WordSocial',
      wordId,
    );
  }

  async getTrendingWords(options: {
    timeframe: 'hour' | 'day' | 'week' | 'month';
    language?: string;
    limit: number;
  }): Promise<{
    trendingWords: TrendingWord[];
    timeframe: string;
    generatedAt: Date;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Récupérer les mots populaires
        const popularWords = await this.wordRepository.findFeatured(options.limit * 2);
        
        // Calculer les scores de tendance pour chaque mot
        const trendingWords: TrendingWord[] = await Promise.all(
          popularWords.slice(0, options.limit).map(async (word, index) => {
            const wordId = (word as any)._id.toString();
            const socialStats = await this.getSocialStats(wordId);
            const trendScore = this.calculateTrendScore(socialStats, options.timeframe);
            
            return {
              word,
              trendScore,
              socialStats,
              growth: Math.random() * 100 - 50, // Simulé
              rank: index + 1,
              reasons: this.getTrendingReasons(socialStats),
            };
          })
        );

        // Trier par score de tendance
        trendingWords.sort((a, b) => b.trendScore - a.trendScore);

        return {
          trendingWords,
          timeframe: options.timeframe,
          generatedAt: new Date(),
        };
      },
      'WordSocial',
      'trending',
    );
  }

  async toggleCommentLike(commentId: string, userId: string): Promise<{
    liked: boolean;
    totalLikes: number;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const commentLikes = this.commentLikes.get(commentId) || new Set();
        const isLiked = commentLikes.has(userId);

        if (isLiked) {
          commentLikes.delete(userId);
        } else {
          commentLikes.add(userId);
        }

        this.commentLikes.set(commentId, commentLikes);

        // Mettre à jour le compteur dans le commentaire original
        this.updateCommentLikeCount(commentId, commentLikes.size);

        return {
          liked: !isLiked,
          totalLikes: commentLikes.size,
        };
      },
      'WordSocial',
      commentId,
      userId,
    );
  }

  async deleteComment(commentId: string, userId: string): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Trouver et supprimer le commentaire
        for (const [wordId, comments] of this.comments.entries()) {
          // Chercher dans les commentaires principaux
          const commentIndex = comments.findIndex(c => c.id === commentId && c.author.id === userId);
          if (commentIndex !== -1) {
            comments.splice(commentIndex, 1);
            this.comments.set(wordId, comments);
            return { success: true };
          }

          // Chercher dans les réponses
          for (const comment of comments) {
            const replyIndex = comment.replies.findIndex(r => r.id === commentId && r.author.id === userId);
            if (replyIndex !== -1) {
              comment.replies.splice(replyIndex, 1);
              return { success: true };
            }
          }
        }

        throw new Error('Commentaire introuvable ou non autorisé');
      },
      'WordSocial',
      commentId,
      userId,
    );
  }

  async getUsageExamples(
    wordId: string,
    options: {
      limit: number;
      context?: 'formal' | 'informal' | 'technical' | 'literary' | 'everyday';
    }
  ): Promise<{
    examples: UsageExample[];
    total: number;
    contexts: string[];
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        let examples = this.usageExamples.get(wordId) || [];

        // Filtrer par contexte si spécifié
        if (options.context) {
          examples = examples.filter(e => e.context === options.context);
        }

        // Trier par nombre de likes
        examples.sort((a, b) => b.likes - a.likes);

        // Limiter les résultats
        const limitedExamples = examples.slice(0, options.limit);

        // Récupérer tous les contextes disponibles
        const allExamples = this.usageExamples.get(wordId) || [];
        const contexts = [...new Set(allExamples.map(e => e.context))];

        return {
          examples: limitedExamples,
          total: examples.length,
          contexts,
        };
      },
      'WordSocial',
      wordId,
    );
  }

  async addUsageExample(
    wordId: string,
    sentence: string,
    contributorId: string,
    context: 'formal' | 'informal' | 'technical' | 'literary' | 'everyday',
    translation?: string,
    source?: string,
  ): Promise<UsageExample> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le mot existe
        const word = await this.wordRepository.findById(wordId);
        if (!word) {
          throw new Error('Mot introuvable');
        }

        const contributor = await this.userRepository.findById(contributorId);
        if (!contributor) {
          throw new Error('Utilisateur introuvable');
        }

        const exampleId = `example_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const example: UsageExample = {
          id: exampleId,
          sentence: sentence.trim(),
          translation,
          context,
          source,
          difficulty: this.calculateExampleDifficulty(sentence),
          contributedBy: contributor.username,
          likes: 0,
        };

        // Ajouter l'exemple
        const examples = this.usageExamples.get(wordId) || [];
        examples.unshift(example);
        this.usageExamples.set(wordId, examples);

        return example;
      },
      'WordSocial',
      wordId,
      contributorId,
    );
  }

  async getRelatedDiscussions(wordId: string, limit: number): Promise<{
    discussions: Array<{
      id: string;
      title: string;
      excerpt: string;
      author: string;
      replies: number;
      lastActivity: Date;
      tags: string[];
      community: string;
    }>;
    total: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Simuler des discussions liées
        // Dans une vraie implémentation, cela rechercherait dans les communautés
        const mockDiscussions = [
          {
            id: 'disc1',
            title: 'Utilisation correcte de ce mot',
            excerpt: 'Je me demande dans quels contextes utiliser ce mot...',
            author: 'CuriousLearner',
            replies: 5,
            lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
            tags: ['grammaire', 'usage'],
            community: 'Français Avancé',
          },
          {
            id: 'disc2',
            title: 'Étymologie et histoire',
            excerpt: 'L\'origine de ce mot est fascinante...',
            author: 'HistoryBuff',
            replies: 12,
            lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000),
            tags: ['étymologie', 'histoire'],
            community: 'Linguistique',
          },
        ].slice(0, limit);

        return {
          discussions: mockDiscussions,
          total: mockDiscussions.length,
        };
      },
      'WordSocial',
      wordId,
    );
  }

  // ========== NOUVELLES MÉTHODES DE VOTE SOPHISTIQUÉ ==========

  async voteForWord(
    wordId: string,
    userId: string,
    reactionType: 'like' | 'love' | 'helpful' | 'accurate' | 'clear' | 'funny' | 'insightful' | 'disagree',
    context?: 'word' | 'definition' | 'pronunciation' | 'etymology' | 'example' | 'translation',
    contextId?: string,
    comment?: string,
  ): Promise<{
    action: 'created' | 'updated' | 'removed';
    reactionType: string;
    previousReaction?: string;
    totalVotes: number;
    message: string;
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier que le mot existe
        const word = await this.wordRepository.findById(wordId);
        if (!word) {
          throw new Error('Mot introuvable');
        }

        // Récupérer le poids de l'utilisateur (basé sur sa réputation)
        const user = await this.userRepository.findById(userId);
        const userWeight = this.calculateUserWeight(user);

        // Effectuer le vote
        const voteResult = await this.wordVoteRepository.vote(
          userId,
          wordId,
          reactionType,
          context,
          contextId,
          {
            weight: userWeight,
            comment,
            userAgent: 'web', // TODO: Récupérer du request
            ipAddress: 'hashed_ip', // TODO: Hash de l'IP réelle
          }
        );

        // Compter les votes totaux pour ce type de réaction
        const voteCounts = await this.wordVoteRepository.countByWord(wordId, {
          reactionType,
          context,
        });

        const messages = {
          created: `Réaction "${reactionType}" ajoutée`,
          updated: `Réaction changée vers "${reactionType}"`,
          removed: `Réaction "${reactionType}" retirée`,
        };

        return {
          action: voteResult.action,
          reactionType,
          previousReaction: voteResult.previousReaction,
          totalVotes: voteCounts[reactionType] || 0,
          message: messages[voteResult.action],
        };
      },
      'WordSocial',
      wordId,
      userId,
    );
  }

  async getWordVotes(wordId: string, options: {
    reactionType?: string;
    context?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    votes: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.wordVoteRepository.findByWord(wordId, {
          reactionType: options.reactionType,
          context: options.context,
          page: options.page || 1,
          limit: options.limit || 20,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
      },
      'WordSocial',
      wordId,
    );
  }

  async getWordVoteStats(wordId: string): Promise<{
    reactions: { [reactionType: string]: { count: number; weight: number } };
    totalVotes: number;
    averageWeight: number;
    popularityScore: number;
    qualityScore: number;
    weightedScore: {
      positiveScore: number;
      negativeScore: number;
      neutralScore: number;
      overallScore: number;
      weightedAverage: number;
    };
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const [wordScore, weightedScore] = await Promise.all([
          this.wordVoteRepository.getWordScore(wordId),
          this.wordVoteRepository.getWeightedScore(wordId),
        ]);

        return {
          ...wordScore,
          weightedScore,
        };
      },
      'WordSocial',
      wordId,
    );
  }

  async getTopQualityWords(options: {
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
    minVotes?: number;
  }): Promise<{
    topQualityWords: Array<{
      wordId: string;
      qualityScore: number;
      accurateVotes: number;
      clearVotes: number;
      helpfulVotes: number;
    }>;
    timeframe: string;
    generatedAt: Date;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const topQualityWords = await this.wordVoteRepository.getTopQualityWords({
          timeframe: options.timeframe || 'week',
          limit: options.limit || 10,
          minVotes: options.minVotes || 3,
        });

        return {
          topQualityWords,
          timeframe: options.timeframe || 'week',
          generatedAt: new Date(),
        };
      },
      'WordSocial',
      'top-quality',
    );
  }

  // Méthodes utilitaires privées
  private generateWordChallenge(word: any): {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  } {
    const meanings = word.meanings || [];
    if (meanings.length === 0) {
      return {
        question: `Que signifie le mot "${word.word}" ?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0,
        explanation: 'Explication du sens du mot.',
      };
    }

    const correctMeaning = meanings[0]?.definition || 'Définition';
    const wrongOptions = [
      'Définition incorrecte 1',
      'Définition incorrecte 2',
      'Définition incorrecte 3',
    ];

    const options = [correctMeaning, ...wrongOptions].sort(() => Math.random() - 0.5);
    const correctAnswer = options.indexOf(correctMeaning);

    return {
      question: `Que signifie le mot "${word.word}" ?`,
      options,
      correctAnswer,
      explanation: `"${word.word}" signifie : ${correctMeaning}`,
    };
  }

  private generateDidYouKnow(word: any): string {
    const facts = [
      `Le mot "${word.word}" est utilisé dans ${Math.floor(Math.random() * 50) + 10} pays différents.`,
      `Ce mot a été ajouté au dictionnaire pour la première fois au ${Math.floor(Math.random() * 5) + 15}ème siècle.`,
      `"${word.word}" fait partie des ${Math.floor(Math.random() * 1000) + 500} mots les plus recherchés.`,
      `Il existe ${Math.floor(Math.random() * 10) + 2} variantes régionales de ce mot.`,
    ];

    return facts[Math.floor(Math.random() * facts.length)];
  }

  private generateShareMessage(word: any, platform: string): string {
    const baseMessage = `Découvrez le mot "${word.word}" sur Oypunu`;
    
    switch (platform) {
      case 'twitter':
        return `${baseMessage} 📚 #Oypunu #Dictionary #${word.language}`;
      case 'facebook':
        return `${baseMessage}. Une plateforme collaborative pour enrichir nos langues !`;
      case 'linkedin':
        return `${baseMessage}. Rejoignez notre communauté d'apprentissage linguistique.`;
      default:
        return baseMessage;
    }
  }

  private getTotalCommentsCount(wordId: string): number {
    const comments = this.comments.get(wordId) || [];
    return comments.reduce((total, comment) => total + 1 + comment.replies.length, 0);
  }

  private async getWordViews(wordId: string): Promise<number> {
    try {
      return await this.wordViewRepository.countByWord(wordId);
    } catch {
      return Math.floor(Math.random() * 1000) + 100; // Fallback
    }
  }

  private hasUserCommented(wordId: string, userId: string): boolean {
    const comments = this.comments.get(wordId) || [];
    return comments.some(c => 
      c.author.id === userId || 
      c.replies.some(r => r.author.id === userId)
    );
  }

  private calculatePopularityScore(stats: {
    likes: number;
    shares: number;
    comments: number;
    views: number;
    averageRating: number;
  }): number {
    // Algorithme simple de scoring
    const { likes, shares, comments, views, averageRating } = stats;
    
    const score = 
      (likes * 3) + 
      (shares * 5) + 
      (comments * 4) + 
      (views * 0.1) + 
      (averageRating * 10);

    return Math.round(score * 100) / 100;
  }

  private calculateTrendScore(socialStats: SocialStats, timeframe: string): number {
    const baseScore = socialStats.popularityScore;
    
    // Ajuster selon la période
    const timeMultiplier = {
      'hour': 1.5,
      'day': 1.2,
      'week': 1.0,
      'month': 0.8,
    }[timeframe] || 1.0;

    return Math.round(baseScore * timeMultiplier * 100) / 100;
  }

  private getTrendingReasons(socialStats: SocialStats): string[] {
    const reasons: string[] = [];
    
    if (socialStats.likes > 50) reasons.push('Très apprécié');
    if (socialStats.shares > 20) reasons.push('Beaucoup partagé');
    if (socialStats.comments > 30) reasons.push('Génère des discussions');
    if (socialStats.averageRating > 4.5) reasons.push('Excellente note');
    if (socialStats.views > 1000) reasons.push('Très consulté');

    return reasons.length > 0 ? reasons : ['En progression'];
  }

  private updateCommentLikeCount(commentId: string, newCount: number): void {
    // Mettre à jour le compteur dans les commentaires stockés
    for (const comments of this.comments.values()) {
      const comment = comments.find(c => c.id === commentId);
      if (comment) {
        comment.likes = newCount;
        return;
      }
      
      for (const comment of comments) {
        const reply = comment.replies.find(r => r.id === commentId);
        if (reply) {
          reply.likes = newCount;
          return;
        }
      }
    }
  }

  private calculateExampleDifficulty(sentence: string): string {
    const wordCount = sentence.split(' ').length;
    const avgWordLength = sentence.replace(/[^\w]/g, '').length / wordCount;
    
    if (wordCount < 8 && avgWordLength < 6) return 'Débutant';
    if (wordCount < 15 && avgWordLength < 8) return 'Intermédiaire';
    return 'Avancé';
  }

  private calculateUserWeight(user: any): number {
    if (!user) return 1;
    
    // Calcul du poids basé sur la réputation utilisateur
    const reputation = user.reputation || 0;
    const role = user.role || 'user';
    
    let baseWeight = 1;
    
    // Bonus selon le rôle
    const roleMultipliers = {
      'admin': 2.5,
      'moderator': 2.0,
      'expert': 1.8,
      'contributor': 1.5,
      'verified': 1.3,
      'user': 1.0,
    };
    
    baseWeight *= roleMultipliers[role] || 1.0;
    
    // Bonus selon la réputation (logarithmique pour éviter l'inflation)
    if (reputation > 0) {
      const reputationMultiplier = 1 + Math.log10(reputation + 1) * 0.2;
      baseWeight *= Math.min(reputationMultiplier, 2.0); // Cap à 2.0
    }
    
    // S'assurer que le poids reste dans les limites (0.1 - 5.0)
    return Math.max(0.1, Math.min(5.0, baseWeight));
  }
}