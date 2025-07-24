import { Conversation } from '../../messaging/schemas/conversation.schema';

/**
 * 💬 INTERFACE CONVERSATION REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des conversations.
 * Gestion des conversations entre utilisateurs.
 */
export interface IConversationRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle conversation
   */
  create(conversationData: {
    participants: string[];
    type?: 'private' | 'group';
    title?: string;
    createdBy: string;
  }): Promise<Conversation>;
  
  /**
   * Récupérer une conversation par ID
   */
  findById(id: string): Promise<Conversation | null>;
  
  /**
   * Mettre à jour une conversation
   */
  update(id: string, updateData: Partial<Conversation>): Promise<Conversation | null>;
  
  /**
   * Supprimer une conversation
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET GESTION ==========
  
  /**
   * Trouver une conversation entre des participants spécifiques
   */
  findByParticipants(participantIds: string[]): Promise<Conversation | null>;
  
  /**
   * Récupérer toutes les conversations d'un utilisateur
   */
  findByUser(userId: string, options?: {
    page?: number;
    limit?: number;
    includeArchived?: boolean;
    sortBy?: 'lastMessage' | 'createdAt' | 'title';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    conversations: Conversation[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Rechercher des conversations par titre
   */
  searchByTitle(userId: string, query: string, options?: {
    limit?: number;
    includeArchived?: boolean;
  }): Promise<Conversation[]>;
  
  /**
   * Vérifier si un utilisateur fait partie d'une conversation
   */
  isParticipant(conversationId: string, userId: string): Promise<boolean>;
  
  // ========== GESTION DES PARTICIPANTS ==========
  
  /**
   * Ajouter des participants à une conversation
   */
  addParticipants(conversationId: string, participantIds: string[]): Promise<Conversation | null>;
  
  /**
   * Retirer des participants d'une conversation
   */
  removeParticipants(conversationId: string, participantIds: string[]): Promise<Conversation | null>;
  
  /**
   * Récupérer les participants d'une conversation
   */
  getParticipants(conversationId: string): Promise<string[]>;
  
  // ========== MÉTADONNÉES ET STATUTS ==========
  
  /**
   * Mettre à jour le dernier message d'une conversation
   */
  updateLastMessage(conversationId: string, messageId: string, messagePreview: string): Promise<Conversation | null>;
  
  /**
   * Mettre à jour le timestamp de dernière activité
   */
  updateLastActivity(conversationId: string): Promise<Conversation | null>;
  
  /**
   * Archiver/désarchiver une conversation pour un utilisateur
   */
  toggleArchive(conversationId: string, userId: string, isArchived: boolean): Promise<Conversation | null>;
  
  /**
   * Marquer une conversation comme épinglée/non épinglée
   */
  togglePin(conversationId: string, userId: string, isPinned: boolean): Promise<Conversation | null>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les conversations d'un utilisateur
   */
  countByUser(userId: string, options?: {
    includeArchived?: boolean;
    type?: 'private' | 'group';
  }): Promise<number>;
  
  /**
   * Récupérer les conversations les plus actives
   */
  getMostActive(userId: string, limit?: number): Promise<Conversation[]>;
  
  /**
   * Récupérer les statistiques d'une conversation
   */
  getStats(conversationId: string): Promise<{
    messagesCount: number;
    participantsCount: number;
    lastActivity: Date;
    createdAt: Date;
  }>;
  
  // ========== NETTOYAGE ==========
  
  /**
   * Supprimer les conversations vides (sans messages)
   */
  deleteEmpty(): Promise<number>;
  
  /**
   * Supprimer les anciennes conversations archivées
   */
  deleteOldArchived(olderThan: Date): Promise<number>;
  
  /**
   * Nettoyer les participants inactifs
   */
  cleanupInactiveParticipants(): Promise<number>;
}