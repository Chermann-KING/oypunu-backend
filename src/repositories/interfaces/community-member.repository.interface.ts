import { CommunityMember } from '../../communities/schemas/community-member.schema';

/**
 * 👥 INTERFACE REPOSITORY COMMUNITY MEMBER
 * 
 * Contrat abstrait pour la gestion des membres de communautés.
 * Définit toutes les opérations possibles sur l'appartenance aux communautés.
 * 
 * Fonctionnalités couvertes :
 * - CRUD de base
 * - Gestion des rôles
 * - Recherche et filtrage
 * - Statistiques d'adhésion
 * - Validation des permissions
 */
export interface ICommunityMemberRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Ajouter un membre à une communauté
   */
  create(memberData: {
    communityId: string;
    userId: string;
    role?: 'member' | 'moderator' | 'admin';
  }): Promise<CommunityMember>;

  /**
   * Trouver un membre par ID
   */
  findById(id: string): Promise<CommunityMember | null>;

  /**
   * Mettre à jour un membre
   */
  update(id: string, updateData: Partial<CommunityMember>): Promise<CommunityMember | null>;

  /**
   * Supprimer un membre
   */
  delete(id: string): Promise<boolean>;

  // ========== GESTION DES MEMBRES ==========

  /**
   * Trouver un membre spécifique dans une communauté
   */
  findMember(communityId: string, userId: string): Promise<CommunityMember | null>;

  /**
   * Vérifier si un utilisateur est membre d'une communauté
   */
  isMember(communityId: string, userId: string): Promise<boolean>;

  /**
   * Obtenir tous les membres d'une communauté
   */
  findByCommunity(communityId: string, options?: {
    page?: number;
    limit?: number;
    role?: 'member' | 'moderator' | 'admin';
    sortBy?: 'joinedAt' | 'role';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    members: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Obtenir toutes les communautés d'un utilisateur
   */
  findByUser(userId: string, options?: {
    page?: number;
    limit?: number;
    role?: 'member' | 'moderator' | 'admin';
    sortBy?: 'joinedAt' | 'role';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    memberships: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Retirer un membre d'une communauté
   */
  removeMember(communityId: string, userId: string): Promise<boolean>;

  // ========== GESTION DES RÔLES ==========

  /**
   * Changer le rôle d'un membre
   */
  updateRole(communityId: string, userId: string, newRole: 'member' | 'moderator' | 'admin'): Promise<CommunityMember | null>;

  /**
   * Obtenir les membres par rôle
   */
  findByRole(communityId: string, role: 'member' | 'moderator' | 'admin'): Promise<CommunityMember[]>;

  /**
   * Vérifier si un utilisateur a un rôle spécifique
   */
  hasRole(communityId: string, userId: string, role: 'member' | 'moderator' | 'admin'): Promise<boolean>;

  /**
   * Vérifier si un utilisateur peut modérer (moderator ou admin)
   */
  canModerate(communityId: string, userId: string): Promise<boolean>;

  /**
   * Obtenir le rôle d'un utilisateur dans une communauté
   */
  getUserRole(communityId: string, userId: string): Promise<'member' | 'moderator' | 'admin' | null>;

  /**
   * Promouvoir un membre (member -> moderator -> admin)
   */
  promote(communityId: string, userId: string): Promise<CommunityMember | null>;

  /**
   * Rétrograder un membre (admin -> moderator -> member)
   */
  demote(communityId: string, userId: string): Promise<CommunityMember | null>;

  // ========== RECHERCHE ET FILTRAGE ==========

  /**
   * Rechercher des membres par nom d'utilisateur
   */
  searchMembers(communityId: string, query: string, options?: {
    limit?: number;
    role?: 'member' | 'moderator' | 'admin';
  }): Promise<CommunityMember[]>;

  /**
   * Trouver les membres actifs récemment
   */
  findRecentlyActive(communityId: string, days?: number, limit?: number): Promise<CommunityMember[]>;

  /**
   * Trouver les membres inactifs
   */
  findInactive(communityId: string, days?: number): Promise<CommunityMember[]>;

  // ========== STATISTIQUES ==========

  /**
   * Compter les membres d'une communauté
   */
  countByCommunity(communityId: string, role?: 'member' | 'moderator' | 'admin'): Promise<number>;

  /**
   * Compter les communautés d'un utilisateur
   */
  countByUser(userId: string, role?: 'member' | 'moderator' | 'admin'): Promise<number>;

  /**
   * Obtenir les statistiques de membres d'une communauté
   */
  getCommunityMemberStats(communityId: string): Promise<{
    totalMembers: number;
    memberCount: number;
    moderatorCount: number;
    adminCount: number;
    recentJoins: number; // Derniers 7 jours
    averageJoinDate: Date;
  }>;

  /**
   * Obtenir les statistiques d'adhésion d'un utilisateur
   */
  getUserMembershipStats(userId: string): Promise<{
    totalCommunities: number;
    asMembers: number;
    asModerator: number;
    asAdmin: number;
    oldestMembership: Date;
    newestMembership: Date;
  }>;

  /**
   * Obtenir les communautés les plus actives pour un utilisateur
   */
  getMostActiveCommunities(userId: string, limit?: number): Promise<CommunityMember[]>;

  // ========== VALIDATION ET NETTOYAGE ==========

  /**
   * Vérifier l'intégrité des adhésions (communautés et utilisateurs existent)
   */
  validateIntegrity(): Promise<{
    invalidCommunities: string[];
    invalidUsers: string[];
    orphanedMemberships: string[];
  }>;

  /**
   * Nettoyer les adhésions orphelines
   */
  cleanupOrphaned(): Promise<number>;

  /**
   * Obtenir les doublons d'adhésion (ne devrait pas arriver avec l'index unique)
   */
  findDuplicates(): Promise<Array<{
    communityId: string;
    userId: string;
    count: number;
  }>>;

  // ========== OPÉRATIONS EN MASSE ==========

  /**
   * Supprimer tous les membres d'une communauté
   */
  removeAllFromCommunity(communityId: string): Promise<number>;

  /**
   * Retirer un utilisateur de toutes ses communautés
   */
  removeUserFromAll(userId: string): Promise<number>;

  /**
   * Mettre à jour les rôles en masse
   */
  bulkUpdateRoles(updates: Array<{
    communityId: string;
    userId: string;
    newRole: 'member' | 'moderator' | 'admin';
  }>): Promise<number>;
}