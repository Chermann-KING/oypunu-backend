import { Message } from '../../messaging/schemas/message.schema';
import { SendMessageDto } from '../../messaging/dto/send-message.dto';

/**
 * 💬 INTERFACE MESSAGE REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des messages.
 * Gestion des messages individuels dans les conversations.
 */
export interface IMessageRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer un nouveau message
   */
  create(messageData: {
    senderId: string;
    receiverId: string;
    conversationId: string;
    content: string;
    messageType?: 'text' | 'image' | 'file' | 'system';
    metadata?: any;
  }): Promise<Message>;
  
  /**
   * Récupérer un message par ID
   */
  findById(id: string): Promise<Message | null>;
  
  /**
   * Mettre à jour un message
   */
  update(id: string, updateData: Partial<Message>): Promise<Message | null>;
  
  /**
   * Supprimer un message
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Récupérer les messages d'une conversation avec pagination
   */
  findByConversation(conversationId: string, options?: {
    page?: number;
    limit?: number;
    before?: Date;
    after?: Date;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    messages: Message[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;
  
  /**
   * Rechercher des messages par contenu
   */
  search(query: string, userId: string, options?: {
    conversationId?: string;
    limit?: number;
    messageTypes?: string[];
  }): Promise<Message[]>;
  
  /**
   * Récupérer les messages entre deux utilisateurs
   */
  findBetweenUsers(user1Id: string, user2Id: string, options?: {
    limit?: number;
    before?: Date;
    after?: Date;
  }): Promise<Message[]>;
  
  // ========== GESTION DES STATUTS ==========
  
  /**
   * Marquer un message comme lu
   */
  markAsRead(messageId: string, userId: string): Promise<Message | null>;
  
  /**
   * Marquer tous les messages d'une conversation comme lus
   */
  markConversationAsRead(conversationId: string, userId: string): Promise<number>;
  
  /**
   * Récupérer les messages non lus pour un utilisateur
   */
  findUnreadForUser(userId: string): Promise<Message[]>;
  
  /**
   * Compter les messages non lus pour un utilisateur
   */
  countUnreadForUser(userId: string): Promise<number>;
  
  /**
   * Compter les messages non lus dans une conversation
   */
  countUnreadInConversation(conversationId: string, userId: string): Promise<number>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les messages dans une conversation
   */
  countInConversation(conversationId: string): Promise<number>;
  
  /**
   * Récupérer le dernier message d'une conversation
   */
  findLastInConversation(conversationId: string): Promise<Message | null>;
  
  /**
   * Récupérer les statistiques de messages d'un utilisateur
   */
  getUserStats(userId: string): Promise<{
    totalSent: number;
    totalReceived: number;
    totalUnread: number;
    conversationsCount: number;
  }>;
  
  // ========== NETTOYAGE ==========
  
  /**
   * Supprimer les anciens messages
   */
  deleteOlderThan(date: Date): Promise<number>;
  
  /**
   * Supprimer tous les messages d'une conversation
   */
  deleteByConversation(conversationId: string): Promise<number>;
}