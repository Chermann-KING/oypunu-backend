import { CommunityPost } from '../../communities/schemas/community-post.schema';

export interface CreateCommunityPostData {
  communityId: string;
  authorId: string;
  title: string;
  content: string;
  tags?: string[];
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
    size: number;
  }>;
}

export interface UpdateCommunityPostData {
  title?: string;
  content?: string;
  tags?: string[];
  status?: 'active' | 'hidden' | 'deleted';
}

/**
 * 📝 INTERFACE COMMUNITY POST REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des posts communautaires.
 * Gestion des publications avec système de scoring et modération.
 */
export interface ICommunityPostRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer un nouveau post
   */
  create(postData: CreateCommunityPostData): Promise<CommunityPost>;
  
  /**
   * Récupérer un post par ID
   */
  findById(id: string): Promise<CommunityPost | null>;
  
  /**
   * Mettre à jour un post
   */
  update(id: string, updateData: UpdateCommunityPostData): Promise<CommunityPost | null>;
  
  /**
   * Supprimer un post
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Récupérer les posts d'une communauté
   */
  findByCommunity(communityId: string, options?: {
    page?: number;
    limit?: number;
    sortBy?: 'score' | 'createdAt' | 'views' | 'commentsCount';
    sortOrder?: 'asc' | 'desc';
    status?: 'active' | 'hidden' | 'deleted' | 'all';
  }): Promise<{
    posts: CommunityPost[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Récupérer les posts d'un auteur
   */
  findByAuthor(authorId: string, options?: {
    page?: number;
    limit?: number;
    communityId?: string;
  }): Promise<{
    posts: CommunityPost[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Rechercher des posts par titre ou contenu
   */
  search(query: string, options?: {
    communityId?: string;
    limit?: number;
    status?: 'active' | 'hidden' | 'deleted';
  }): Promise<CommunityPost[]>;
  
  /**
   * Récupérer les posts par tags
   */
  findByTags(tags: string[], options?: {
    communityId?: string;
    limit?: number;
  }): Promise<CommunityPost[]>;
  
  // ========== STATISTIQUES ET SCORING ==========
  
  /**
   * Mettre à jour le score d'un post
   */
  updateScore(postId: string, scoreChange: number): Promise<boolean>;
  
  /**
   * Mettre à jour les compteurs de votes
   */
  updateVoteCounts(postId: string, upvotes: number, downvotes: number): Promise<boolean>;
  
  /**
   * Incrémenter le nombre de vues
   */
  incrementViews(postId: string, userId?: string): Promise<boolean>;
  
  /**
   * Incrémenter le nombre de commentaires
   */
  incrementCommentsCount(postId: string): Promise<boolean>;
  
  /**
   * Décrémenter le nombre de commentaires
   */
  decrementCommentsCount(postId: string): Promise<boolean>;
  
  // ========== MODÉRATION ==========
  
  /**
   * Changer le statut d'un post
   */
  updateStatus(postId: string, status: 'active' | 'hidden' | 'deleted', reason?: string): Promise<boolean>;
  
  /**
   * Marquer un post comme signalé
   */
  markAsReported(postId: string, reportedBy: string, reason: string): Promise<boolean>;
  
  /**
   * Récupérer les posts signalés
   */
  findReported(options?: {
    communityId?: string;
    limit?: number;
  }): Promise<CommunityPost[]>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les posts d'une communauté
   */
  countByCommunity(communityId: string, status?: 'active' | 'hidden' | 'deleted'): Promise<number>;
  
  /**
   * Compter les posts d'un auteur
   */
  countByAuthor(authorId: string): Promise<number>;
  
  /**
   * Récupérer les posts les plus populaires
   */
  findMostPopular(options?: {
    communityId?: string;
    timeframe?: 'day' | 'week' | 'month' | 'all';
    limit?: number;
  }): Promise<CommunityPost[]>;
  
  /**
   * Récupérer les posts récents
   */
  findRecent(options?: {
    communityId?: string;
    limit?: number;
    status?: 'active' | 'hidden' | 'deleted';
  }): Promise<CommunityPost[]>;
}