import { Community } from '../../communities/schemas/community.schema';

/**
 * 🏘️ INTERFACE REPOSITORY COMMUNITY
 * 
 * Contrat abstrait pour la gestion des communautés.
 * Définit toutes les opérations possibles sur les communautés.
 * 
 * Fonctionnalités couvertes :
 * - CRUD de base
 * - Recherche et filtrage
 * - Gestion des membres
 * - Statistiques
 * - Validation et modération
 */
export interface ICommunityRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle communauté
   */
  create(communityData: {
    name: string;
    language: string;
    description?: string;
    createdBy: string;
    tags?: string[];
    isPrivate?: boolean;
    coverImage?: string;
  }): Promise<Community>;

  /**
   * Trouver une communauté par ID
   */
  findById(id: string): Promise<Community | null>;

  /**
   * Mettre à jour une communauté
   */
  update(id: string, updateData: Partial<Community>): Promise<Community | null>;

  /**
   * Supprimer une communauté
   */
  delete(id: string): Promise<boolean>;

  // ========== RECHERCHE ET FILTRAGE ==========

  /**
   * Rechercher des communautés par nom/description
   */
  search(query: string, options?: {
    language?: string;
    includePrivate?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<{
    communities: Community[];
    total: number;
  }>;

  /**
   * Trouver des communautés par langue
   */
  findByLanguage(language: string, options?: {
    includePrivate?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'memberCount' | 'createdAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Trouver des communautés par tags
   */
  findByTags(tags: string[], options?: {
    includePrivate?: boolean;
    limit?: number;
  }): Promise<Community[]>;

  /**
   * Trouver une communauté par nom exact
   */
  findByName(name: string): Promise<Community | null>;

  /**
   * Vérifier si une communauté existe par nom
   */
  existsByName(name: string): Promise<boolean>;

  /**
   * Obtenir toutes les communautés (avec pagination)
   */
  findAll(options?: {
    page?: number;
    limit?: number;
    includePrivate?: boolean;
    sortBy?: 'memberCount' | 'createdAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }>;

  // ========== GESTION DES MEMBRES ==========

  /**
   * Incrémenter le nombre de membres
   */
  incrementMemberCount(id: string): Promise<Community | null>;

  /**
   * Décrémenter le nombre de membres
   */
  decrementMemberCount(id: string): Promise<Community | null>;

  /**
   * Mettre à jour le nombre de membres
   */
  updateMemberCount(id: string, count: number): Promise<Community | null>;

  /**
   * Trouver les communautés créées par un utilisateur
   */
  findByCreator(creatorId: string, options?: {
    page?: number;
    limit?: number;
  }): Promise<{
    communities: Community[];
    total: number;
  }>;

  // ========== STATISTIQUES ==========

  /**
   * Obtenir les communautés les plus populaires
   */
  getMostPopular(limit?: number, language?: string): Promise<Community[]>;

  /**
   * Obtenir les communautés récemment créées
   */
  getRecent(limit?: number, language?: string): Promise<Community[]>;

  /**
   * Compter les communautés par langue
   */
  countByLanguage(): Promise<Record<string, number>>;

  /**
   * Obtenir les statistiques d'une communauté
   */
  getStats(id: string): Promise<{
    memberCount: number;
    postCount: number;
    activeMembers: number;
    createdAt: Date;
  }>;

  /**
   * Obtenir les statistiques globales
   */
  getGlobalStats(): Promise<{
    totalCommunities: number;
    totalMembers: number;
    averageMembersPerCommunity: number;
    topLanguages: Array<{ language: string; count: number }>;
  }>;

  // ========== VALIDATION ET MODÉRATION ==========

  /**
   * Vérifier si un nom de communauté est disponible
   */
  isNameAvailable(name: string, excludeId?: string): Promise<boolean>;

  /**
   * Trouver les communautés inactives
   */
  findInactive(daysInactive: number): Promise<Community[]>;

  /**
   * Marquer une communauté comme privée/publique
   */
  togglePrivacy(id: string, isPrivate: boolean): Promise<Community | null>;

  /**
   * Nettoyer les communautés vides (sans membres)
   */
  cleanupEmpty(): Promise<number>;
}