import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from '../schemas/conversation.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetMessagesDto } from '../dto/get-messages.dto';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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
      this.userModel.findById(senderId),
      this.userModel.findById(receiverId),
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
    const message = new this.messageModel({
      conversationId: conversation._id,
      senderId,
      receiverId,
      content,
      messageType: messageType || 'text',
      metadata,
    });

    await message.save();

    // Mettre à jour la conversation
    conversation.lastMessage = message._id;
    conversation.lastActivity = new Date();
    await conversation.save();

    // Peupler les données pour le retour
    await message.populate([
      { path: 'senderId', select: 'username email profilePicture' },
      { path: 'receiverId', select: 'username email profilePicture' },
    ]);

    // Transformer pour la cohérence frontend
    const messageObj = message.toObject();
    return {
      ...messageObj,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      id: (messageObj._id as any).toString(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      conversationId: (messageObj.conversationId as any).toString(),
      senderId: {
        ...messageObj.senderId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        id: (messageObj.senderId._id as any).toString(),
      },
      receiverId: {
        ...messageObj.receiverId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        id: (messageObj.receiverId._id as any).toString(),
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
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }

    const isParticipant = conversation.participants.some(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (participantId) => (participantId as any).toString() === userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette conversation",
      );
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({
          conversationId,
          isDeleted: false,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'senderId', select: 'username email profilePicture' },
          { path: 'receiverId', select: 'username email profilePicture' },
        ])
        .lean(),
      this.messageModel.countDocuments({
        conversationId,
        isDeleted: false,
      }),
    ]);

    const pages = Math.ceil(total / limit);

    // Transformer les messages pour la cohérence frontend
    const transformedMessages = messages.map((message) => ({
      ...message,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      id: (message._id as any).toString(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      conversationId: (message.conversationId as any).toString(),
      senderId: {
        ...message.senderId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        id: (message.senderId._id as any).toString(),
      },
      receiverId: {
        ...message.receiverId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        id: (message.receiverId._id as any).toString(),
      },
    }));

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
    const conversations = await this.conversationModel
      .find({
        participants: userId,
        isActive: true,
      })
      .sort({ lastActivity: -1 })
      .populate([
        { path: 'participants', select: 'username email profilePicture' },
        {
          path: 'lastMessage',
          select: 'content messageType createdAt isRead',
          populate: {
            path: 'senderId',
            select: 'username',
          },
        },
      ])
      .lean();

    // Transformer les _id en id pour la cohérence frontend
    return conversations.map((conversation) => ({
      ...conversation,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      id: (conversation._id as any).toString(),
      participants: conversation.participants.map((participant) => ({
        ...participant,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        id: (participant._id as any).toString(),
      })),
    }));
  }

  /**
   * Marquer les messages comme lus
   */
  async markMessagesAsRead(
    userId: string,
    conversationId: string,
  ): Promise<{ modifiedCount: number }> {
    // Vérifier l'accès à la conversation
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation introuvable');
    }

    const isParticipant = conversation.participants.some(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (participantId) => (participantId as any).toString() === userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette conversation",
      );
    }

    // Marquer comme lus tous les messages reçus dans cette conversation
    const result = await this.messageModel.updateMany(
      {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Trouver ou créer une conversation entre deux utilisateurs
   */
  private async findOrCreateConversation(
    userId1: string,
    userId2: string,
  ): Promise<ConversationDocument> {
    // Chercher une conversation existante
    let conversation = await this.conversationModel.findOne({
      participants: { $all: [userId1, userId2] },
    });

    // Si pas trouvée, en créer une nouvelle
    if (!conversation) {
      conversation = new this.conversationModel({
        participants: [userId1, userId2],
      });
      await conversation.save();
    }

    return conversation;
  }

  /**
   * Récupérer le nombre de messages non lus
   */
  async getUnreadMessagesCount(userId: string): Promise<number> {
    const count = await this.messageModel.countDocuments({
      receiverId: userId,
      isRead: false,
      isDeleted: false,
    });

    return count;
  }
}
