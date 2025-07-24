import { PostComment } from '../../communities/schemas/post-comment.schema';

export interface CreatePostCommentData {
  postId: string;
  authorId: string;
  content: string;
  parentCommentId?: string;
}

export interface UpdatePostCommentData {
  content?: string;
  status?: 'active' | 'deleted' | 'hidden';
  isAccepted?: boolean;
}

/**
 * 💬 INTERFACE POST COMMENT REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des commentaires de posts.
 * Gestion des commentaires avec threading et système de scoring.
 */
export interface IPostCommentRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer un nouveau commentaire
   */
  create(commentData: CreatePostCommentData): Promise<PostComment>;
  
  /**
   * Récupérer un commentaire par ID
   */
  findById(id: string): Promise<PostComment | null>;
  
  /**
   * Mettre à jour un commentaire
   */
  update(id: string, updateData: UpdatePostCommentData): Promise<PostComment | null>;
  
  /**
   * Supprimer un commentaire
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Récupérer les commentaires d'un post
   */
  findByPost(postId: string, options?: {
    page?: number;
    limit?: number;
    sortBy?: 'score' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
    status?: 'active' | 'deleted' | 'hidden' | 'all';
    includeReplies?: boolean;
  }): Promise<{
    comments: PostComment[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Récupérer les commentaires d'un auteur
   */
  findByAuthor(authorId: string, options?: {
    page?: number;
    limit?: number;
    postId?: string;
  }): Promise<{
    comments: PostComment[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Récupérer les réponses à un commentaire
   */
  findReplies(parentCommentId: string, options?: {
    limit?: number;
    sortBy?: 'score' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<PostComment[]>;
  
  /**
   * Rechercher des commentaires par contenu
   */
  search(query: string, options?: {
    postId?: string;
    limit?: number;
    status?: 'active' | 'deleted' | 'hidden';
  }): Promise<PostComment[]>;
  
  // ========== STATISTIQUES ET SCORING ==========
  
  /**
   * Mettre à jour le score d'un commentaire
   */
  updateScore(commentId: string, scoreChange: number): Promise<boolean>;
  
  /**
   * Mettre à jour les compteurs de votes
   */
  updateVoteCounts(commentId: string, upvotes: number, downvotes: number): Promise<boolean>;
  
  /**
   * Incrémenter le nombre de réponses
   */
  incrementRepliesCount(commentId: string): Promise<boolean>;
  
  /**
   * Décrémenter le nombre de réponses
   */
  decrementRepliesCount(commentId: string): Promise<boolean>;
  
  // ========== MODÉRATION ==========
  
  /**
   * Changer le statut d'un commentaire
   */
  updateStatus(commentId: string, status: 'active' | 'deleted' | 'hidden', reason?: string): Promise<boolean>;
  
  /**
   * Marquer un commentaire comme accepté
   */
  markAsAccepted(commentId: string): Promise<boolean>;
  
  /**
   * Retirer l'acceptation d'un commentaire
   */
  unmarkAsAccepted(commentId: string): Promise<boolean>;
  
  /**
   * Marquer un commentaire comme signalé
   */
  markAsReported(commentId: string, reportedBy: string, reason: string): Promise<boolean>;
  
  /**
   * Récupérer les commentaires signalés
   */
  findReported(options?: {
    postId?: string;
    limit?: number;
  }): Promise<PostComment[]>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les commentaires d'un post
   */
  countByPost(postId: string, status?: 'active' | 'deleted' | 'hidden'): Promise<number>;
  
  /**
   * Compter les commentaires d'un auteur
   */
  countByAuthor(authorId: string): Promise<number>;
  
  /**
   * Récupérer les commentaires les mieux notés
   */
  findTopRated(options?: {
    postId?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  }): Promise<PostComment[]>;
  
  /**
   * Récupérer les commentaires récents
   */
  findRecent(options?: {
    postId?: string;
    limit?: number;
    status?: 'active' | 'deleted' | 'hidden';
  }): Promise<PostComment[]>;
  
  /**
   * Récupérer les commentaires acceptés d'un post
   */
  findAcceptedByPost(postId: string): Promise<PostComment[]>;
}