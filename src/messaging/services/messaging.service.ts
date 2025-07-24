import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Conversation } from '../schemas/conversation.schema';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetMessagesDto } from '../dto/get-messages.dto';
import { IMessageRepository } from '../../repositories/interfaces/message.repository.interface';
import { IConversationRepository } from '../../repositories/interfaces/conversation.repository.interface';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';

@Injectable()
export class MessagingService {
  constructor(
    @Inject('IMessageRepository') private messageRepository: IMessageRepository,
    @Inject('IConversationRepository') private conversationRepository: IConversationRepository,
    @Inject('IUserRepository') private userRepository: IUserRepository,
  ) {}

  /**
   * Envoyer un message
   */
  async sendMessage(
    senderId: string,
    sendMessageDto: SendMessageDto,
  ): Promise<any> {
    const { receiverId, content, messageType, metadata } = sendMessageDto;

    // Vérifier que l'expéditeur et le destinataire existent
    const [sender, receiver] = await Promise.all([
      this.userRepository.findById(senderId),
      this.userRepository.findById(receiverId),
    ]);

    if (!sender) {
      throw new NotFoundException('Expéditeur introuvable');
    }
    if (!receiver) {
      throw new NotFoundException('Destinataire introuvable');
    }

    // Vérifier qu'on n'envoie pas un message à soi-même
    if (senderId === receiverId) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer un message à vous-même',
      );
    }

    // Trouver ou créer une conversation
    const conversation = await this.findOrCreateConversation(
      senderId,
      receiverId,
    );

    // Créer le message
    const message = await this.messageRepository.create({
      conversationId: (conversation as any)._id,
      senderId,
      receiverId,
      content,
      messageType: messageType || 'text',
      metadata,
    });

    // Mettre à jour la conversation
    await this.conversationRepository.updateLastMessage(
      (conversation as any)._id,
      (message as any)._id,
      content.substring(0, 100) // Preview du message
    );

    // Transformer pour la cohérence frontend
    return {
      ...message,
      id: (message as any)._id?.toString(),
      conversationId: (message as any).conversationId?.toString(),
      senderId: {
        ...sender,
        id: (sender as any)._id?.toString(),
      },
      receiverId: {
        ...receiver,
        id: (receiver as any)._id?.toString(),
      },
    };
  }

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(
    userId: string,
    getMessagesDto: GetMessagesDto,
  ): Promise<{
    messages: any[];
    total: number;
    page: number;
    pages: number;
  }> {
    const { page = 1, limit = 20, conversationId } = getMessagesDto;

    if (!conversationId) {
      throw new BadRequestException('ID de conversation requis');
    }

    // Vérifier que l'utilisateur fait partie de la conversation
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette conversation",
      );
    }

    const skip = (page - 1) * limit;

    const result = await this.messageRepository.findByConversation(conversationId, {
      page,
      limit,
      sortOrder: 'desc'
    });

    const { messages, total } = result;

    const pages = Math.ceil(total / limit);

    // Transformer les messages pour la cohérence frontend
    const transformedMessages = await Promise.all(
      messages.map(async (message) => {
        const [sender, receiver] = await Promise.all([
          this.userRepository.findById((message as any).senderId),
          this.userRepository.findById((message as any).receiverId),
        ]);

        return {
          ...message,
          id: (message as any)._id?.toString(),
          conversationId: (message as any).conversationId?.toString(),
          senderId: {
            ...sender,
            id: (sender as any)?._id?.toString(),
          },
          receiverId: {
            ...receiver,
            id: (receiver as any)?._id?.toString(),
          },
        };
      })
    );

    return {
      messages: transformedMessages.reverse(),
      total,
      page,
      pages,
    };
  }

  /**
   * Récupérer les conversations d'un utilisateur
   */
  async getUserConversations(userId: string): Promise<any[]> {
    const result = await this.conversationRepository.findByUser(userId, {
      sortBy: 'lastActivity',
      sortOrder: 'desc',
      includeArchived: false,
    });
    
    const conversations = result.conversations;

    // Transformer les _id en id pour la cohérence frontend et enrichir avec les données utilisateurs
    return Promise.all(
      conversations.map(async (conversation) => {
        const participants = await Promise.all(
          (conversation as any).participants.map(async (participantId: string) => {
            const participant = await this.userRepository.findById(participantId);
            return {
              ...participant,
              id: (participant as any)?._id?.toString(),
            };
          })
        );

        const lastMessage = (conversation as any).lastMessageId
          ? await this.messageRepository.findById((conversation as any).lastMessageId)
          : null;

        return {
          ...conversation,
          id: (conversation as any)._id?.toString(),
          participants,
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                id: (lastMessage as any)._id?.toString(),
              }
            : null,
        };
      })
    );
  }

  /**
   * Marquer les messages comme lus
   */
  async markMessagesAsRead(
    userId: string,
    conversationId: string,
  ): Promise<{ modifiedCount: number }> {
    // Vérifier l'accès à la conversation
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }

    const isParticipant = await this.conversationRepository.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette conversation",
      );
    }

    // Marquer comme lus tous les messages reçus dans cette conversation
    const modifiedCount = await this.messageRepository.markConversationAsRead(conversationId, userId);

    return { modifiedCount };
  }

  /**
   * Trouver ou créer une conversation entre deux utilisateurs
   */
  private async findOrCreateConversation(
    userId1: string,
    userId2: string,
  ): Promise<Conversation> {
    // Chercher une conversation existante
    let conversation = await this.conversationRepository.findByParticipants([userId1, userId2]);

    // Si pas trouvée, en créer une nouvelle
    if (!conversation) {
      conversation = await this.conversationRepository.create({
        participants: [userId1, userId2],
        type: 'private',
        createdBy: userId1,
      });
    }

    return conversation;
  }

  /**
   * Récupérer le nombre de messages non lus
   */
  async getUnreadMessagesCount(userId: string): Promise<number> {
    return this.messageRepository.countUnreadForUser(userId);
  }
}
