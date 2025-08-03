import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { IMessageRepository } from "../../repositories/interfaces/message.repository.interface";
import { IConversationRepository } from "../../repositories/interfaces/conversation.repository.interface";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { AudioService } from "../../dictionary/services/audio.service";
import { DatabaseErrorHandler } from "../../common/errors"
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class MessagingEnhancedService {
  constructor(
    @Inject("IMessageRepository") private messageRepository: IMessageRepository,
    @Inject("IConversationRepository")
    private conversationRepository: IConversationRepository,
    @Inject("IUserRepository") private userRepository: IUserRepository,
    private audioService: AudioService
  ) {}

  // ========== MÉTHODES DE COMPATIBILITÉ (pour migration douce) ==========

  /**
   * 🔄 Envoyer un message simple (compatible avec l'ancien système)
   */
  async sendSimpleMessage(
    senderId: string,
    receiverId: string,
    content: string
  ) {
    return this.sendMessage(senderId, {
      recipientId: receiverId,
      content,
      messageType: "text",
    });
  }

  /**
   * 🔄 Récupérer conversations (compatible)
   */
  async getUserConversations(userId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Récupérer toutes les conversations de l'utilisateur
        const conversationsResult =
          await this.conversationRepository.findByUser(userId);

        // Enrichir avec les détails des participants
        const enrichedConversations = await Promise.all(
          conversationsResult.conversations.map(async (conversation) => {
            const participants =
              await this.conversationRepository.getParticipants(
                (conversation as any).id || (conversation as any)._id
              );
            // Récupérer le dernier message de la conversation
            const messages = await this.messageRepository.findByConversation(
              (conversation as any).id || (conversation as any)._id,
              { page: 1, limit: 1, sortOrder: "desc" }
            );
            const lastMessage = messages.messages[0] || null;
            const unreadCount =
              await this.messageRepository.countUnreadInConversation(
                userId,
                (conversation as any).id || (conversation as any)._id
              );

            return {
              id: (conversation as any).id || (conversation as any)._id,
              participants,
              lastMessage,
              unreadCount,
              updatedAt: (conversation as any).updatedAt || new Date(),
              createdAt: (conversation as any).createdAt || new Date(),
            };
          })
        );

        return { conversations: enrichedConversations };
      },
      "MessagingEnhanced",
      userId
    );
  }

  /**
   * 🔄 Récupérer messages d'une conversation (compatible)
   */
  async getConversationMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 20
  ) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Vérifier que l'utilisateur a accès à cette conversation
        const conversation =
          await this.conversationRepository.findById(conversationId);
        if (!conversation) {
          throw new NotFoundException("Conversation not found");
        }

        const participants =
          await this.conversationRepository.getParticipants(conversationId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Récupérer les messages de la conversation
        const result = await this.messageRepository.findByConversation(
          conversationId,
          {
            page,
            limit,
            sortOrder: "desc",
          }
        );

        return {
          messages: result.messages,
          total: result.total,
          page: result.page,
          limit: result.limit,
        };
      },
      "MessagingEnhanced",
      `conversation-${conversationId}`
    );
  }

  /**
   * 🔄 Marquer comme lu (compatible)
   */
  async markMessagesAsRead(userId: string, conversationId: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier l'accès à la conversation
        const participants =
          await this.conversationRepository.getParticipants(conversationId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Marquer tous les messages non lus comme lus
        const result = await this.messageRepository.markConversationAsRead(
          conversationId,
          userId
        );

        return { modifiedCount: result };
      },
      "MessagingEnhanced",
      `read-${conversationId}`
    );
  }

  /**
   * 🔄 Compter non lus (compatible)
   */
  async getUnreadMessagesCount(userId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Compter tous les messages non lus pour cet utilisateur
        const count = await this.messageRepository.countUnreadForUser(userId);
        return count;
      },
      "MessagingEnhanced",
      `unread-${userId}`
    );
  }

  // ========== NOUVELLES MÉTHODES ENHANCED ==========

  /**
   * 🚀 Envoyer un message avancé (nouvelle version)
   */
  async sendMessage(
    senderId: string,
    messageData: {
      recipientId?: string;
      groupId?: string;
      content: string;
      messageType:
        | "text"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "location";
      replyToMessageId?: string;
      isEphemeral?: boolean;
      ephemeralDuration?: number;
    }
  ) {
    // Validation de base
    if (!messageData.recipientId && !messageData.groupId) {
      throw new BadRequestException("Recipient or group ID is required");
    }

    if (messageData.recipientId && messageData.groupId) {
      throw new BadRequestException("Cannot send to both recipient and group");
    }

    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        let conversationId = messageData.groupId;

        // Si c'est un message privé, créer ou trouver la conversation
        if (messageData.recipientId) {
          // Vérifier que le destinataire existe
          const recipient = await this.userRepository.findById(
            messageData.recipientId
          );
          if (!recipient) {
            throw new NotFoundException("Recipient not found");
          }

          // Chercher une conversation existante ou en créer une
          const existingConversations =
            await this.conversationRepository.findByUser(senderId);
          let conversation = existingConversations.conversations.find(
            (conv) => {
              const participantIds = conv.participants.map((p) =>
                typeof p === "string" ? p : (p as any).id || (p as any)._id
              );
              return (
                participantIds.length === 2 &&
                participantIds.includes(senderId) &&
                participantIds.includes(messageData.recipientId!)
              );
            }
          );

          if (!conversation) {
            // Créer une nouvelle conversation
            conversation = await this.conversationRepository.create({
              participants: [senderId, messageData.recipientId],
              type: "private",
              createdBy: senderId,
            });
          }

          conversationId =
            (conversation as any).id || (conversation as any)._id;
        }

        // Vérifier l'accès à la conversation/groupe
        if (conversationId) {
          const participants =
            await this.conversationRepository.getParticipants(conversationId);
          if (!participants.includes(senderId)) {
            throw new BadRequestException("Access denied to this conversation");
          }
        }

        // Déterminer le receiverId pour l'interface
        const receiverId = messageData.recipientId || "group"; // Pour les groupes

        // Créer le message selon l'interface existante
        const messageToCreate = {
          senderId,
          receiverId,
          conversationId: conversationId!,
          content: messageData.content,
          messageType: "text" as const, // Simplifier pour l'interface existante
          metadata: {
            originalType: messageData.messageType,
            replyToMessageId: messageData.replyToMessageId,
            isEphemeral: messageData.isEphemeral || false,
            ephemeralDuration: messageData.ephemeralDuration,
          },
        };

        const createdMessage =
          await this.messageRepository.create(messageToCreate);

        // Mettre à jour la dernière activité de la conversation
        await this.conversationRepository.updateLastActivity(conversationId!);

        return {
          success: true,
          messageId: (createdMessage as any).id || (createdMessage as any)._id,
          message: "Message sent successfully",
          data: {
            ...createdMessage,
            sentAt: (createdMessage as any).createdAt || new Date(),
            status: "sent",
          },
        };
      },
      "MessagingEnhanced",
      `send-${senderId}`
    );
  }

  // ========== GESTION DES GROUPES ==========

  async createGroup(
    userId: string,
    name: string,
    participants: string[],
    description?: string,
    isPrivate?: boolean
  ) {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que tous les participants existent
        const participantChecks = await Promise.all(
          participants.map((id) => this.userRepository.findById(id))
        );

        const invalidParticipants = participantChecks
          .map((user, index) => (user ? null : participants[index]))
          .filter(Boolean);

        if (invalidParticipants.length > 0) {
          throw new NotFoundException(
            `Users not found: ${invalidParticipants.join(", ")}`
          );
        }

        // Ajouter le créateur aux participants s'il n'y est pas
        const allParticipants = Array.from(new Set([userId, ...participants]));

        // Créer la conversation de groupe
        const group = await this.conversationRepository.create({
          participants: allParticipants,
          type: "group",
          createdBy: userId,
          title: name, // L'interface utilise 'title' au lieu de 'name'
        });

        return {
          success: true,
          groupId: (group as any).id || (group as any)._id,
          message: "Group created successfully",
          data: {
            id: (group as any).id || (group as any)._id,
            name,
            description,
            participants: allParticipants,
            createdBy: userId,
            isPrivate: isPrivate || false,
            createdAt: (group as any).createdAt || new Date(),
          },
        };
      },
      "MessagingEnhanced",
      `create-group-${userId}`
    );
  }

  async getUserGroups(userId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Récupérer toutes les conversations de l'utilisateur
        const conversationsResult =
          await this.conversationRepository.findByUser(userId);

        // Filtrer seulement les groupes
        const groups = conversationsResult.conversations
          .filter((conv) => (conv as any).type === "group")
          .map((group) => ({
            id: (group as any).id || (group as any)._id,
            name: (group as any).title || "Unnamed Group",
            participants: group.participants,
            createdBy: (group as any).createdBy,
            createdAt: (group as any).createdAt || new Date(),
            memberCount: group.participants.length,
          }));

        return { groups };
      },
      "MessagingEnhanced",
      `user-groups-${userId}`
    );
  }

  async getGroupDetails(groupId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const group = await this.conversationRepository.findById(groupId);
        if (!group || (group as any).type !== "group") {
          throw new NotFoundException("Group not found");
        }

        const participants =
          await this.conversationRepository.getParticipants(groupId);
        const messageCount =
          await this.messageRepository.countInConversation(groupId);

        return {
          group: {
            id: (group as any).id || (group as any)._id,
            name: (group as any).title || "Unnamed Group",
            description: (group as any).description || "",
            participants,
            createdBy: (group as any).createdBy,
            createdAt: (group as any).createdAt || new Date(),
            memberCount: participants.length,
            messageCount,
            isPrivate: (group as any).isPrivate || false,
          },
        };
      },
      "MessagingEnhanced",
      `group-details-${groupId}`
    );
  }

  async updateGroup(groupId: string, userId: string, updateData: any) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const group = await this.conversationRepository.findById(groupId);
        if (!group || (group as any).type !== "group") {
          throw new NotFoundException("Group not found");
        }

        // Vérifier que l'utilisateur est le créateur ou un admin
        if ((group as any).createdBy !== userId) {
          throw new BadRequestException("Only group creator can update group");
        }

        // TODO: Implémenter la mise à jour du titre quand l'interface le supportera
        // Pour l'instant, juste confirmer que l'utilisateur a les droits

        return {
          success: true,
          message: "Group updated successfully",
          note: "Title update not yet implemented in repository interface",
        };
      },
      "MessagingEnhanced",
      `update-group-${groupId}`
    );
  }

  async addParticipants(groupId: string, userId: string, userIds: string[]) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const group = await this.conversationRepository.findById(groupId);
        if (!group || (group as any).type !== "group") {
          throw new NotFoundException("Group not found");
        }

        // Vérifier que l'utilisateur est membre du groupe
        const participants =
          await this.conversationRepository.getParticipants(groupId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this group");
        }

        // Vérifier que tous les nouveaux participants existent
        const userChecks = await Promise.all(
          userIds.map((id) => this.userRepository.findById(id))
        );

        const invalidUsers = userChecks
          .map((user, index) => (user ? null : userIds[index]))
          .filter(Boolean);

        if (invalidUsers.length > 0) {
          throw new NotFoundException(
            `Users not found: ${invalidUsers.join(", ")}`
          );
        }

        // Ajouter les participants (un par un)
        for (const participantId of userIds) {
          if (!participants.includes(participantId)) {
            await this.conversationRepository.addParticipants(groupId, [
              participantId,
            ]);
          }
        }

        return { success: true, message: "Participants added successfully" };
      },
      "MessagingEnhanced",
      `add-participants-${groupId}`
    );
  }

  async removeParticipant(
    groupId: string,
    userId: string,
    participantId: string
  ) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const group = await this.conversationRepository.findById(groupId);
        if (!group || (group as any).type !== "group") {
          throw new NotFoundException("Group not found");
        }

        // Vérifier que l'utilisateur est le créateur
        if ((group as any).createdBy !== userId) {
          throw new BadRequestException(
            "Only group creator can remove participants"
          );
        }

        // Vérifier que le participant à supprimer n'est pas le créateur
        if (participantId === (group as any).createdBy) {
          throw new BadRequestException("Cannot remove group creator");
        }

        // Supprimer le participant
        await this.conversationRepository.removeParticipants(groupId, [
          participantId,
        ]);

        return { success: true, message: "Participant removed successfully" };
      },
      "MessagingEnhanced",
      `remove-participant-${groupId}`
    );
  }

  async leaveGroup(groupId: string, userId: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const group = await this.conversationRepository.findById(groupId);
        if (!group || (group as any).type !== "group") {
          throw new NotFoundException("Group not found");
        }

        // Vérifier que l'utilisateur est membre du groupe
        const participants =
          await this.conversationRepository.getParticipants(groupId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("You are not a member of this group");
        }

        // Le créateur ne peut pas quitter son propre groupe
        if ((group as any).createdBy === userId) {
          throw new BadRequestException(
            "Group creator cannot leave group. Transfer ownership first."
          );
        }

        // Quitter le groupe
        await this.conversationRepository.removeParticipants(groupId, [userId]);

        return { success: true, message: "Left group successfully" };
      },
      "MessagingEnhanced",
      `leave-group-${groupId}`
    );
  }

  // ========== MESSAGES MULTIMÉDIA ==========

  async sendMediaMessage(
    userId: string,
    files: Express.Multer.File[],
    messageData: any
  ) {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Validation des fichiers
        if (!files || files.length === 0) {
          throw new BadRequestException("No files provided");
        }

        // Validation de la taille et du type de fichier
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
          "image/",
          "video/",
          "audio/",
          "application/pdf",
          "application/msword",
        ];

        for (const file of files) {
          if (file.size > maxSize) {
            throw new BadRequestException(
              `File ${file.originalname} exceeds maximum size of 10MB`
            );
          }

          const isAllowed = allowedTypes.some((type) =>
            file.mimetype.startsWith(type)
          );
          if (!isAllowed) {
            throw new BadRequestException(
              `File type ${file.mimetype} not allowed`
            );
          }
        }

        // Sauvegarder les fichiers avec Cloudinary
        const fileMetadata = await Promise.all(
          files.map(async (file) => {
            try {
              // Upload vers Cloudinary en utilisant le service existant
              let uploadResult;
              
              if (file.mimetype.startsWith('audio/')) {
                uploadResult = await this.audioService.uploadPhoneticAudio(
                  'audio_message',
                  'audio',
                  file.buffer,
                  'standard',
                  'auto'
                );
              } else if (file.mimetype.startsWith('image/')) {
                uploadResult = await this.uploadImageToCloudinary(file);
              } else {
                // Pour autres types de fichiers
                uploadResult = await this.uploadFileToCloudinary(file);
              }
              
              return {
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                url: uploadResult.secure_url,
                publicId: uploadResult.public_id,
                uploadedAt: new Date(),
                uploadStatus: 'success',
                duration: uploadResult.duration || null,
                format: uploadResult.format
              };
            } catch (error) {
              console.error('Failed to upload file to Cloudinary:', error);
              return {
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                url: '',
                publicId: '',
                uploadedAt: new Date(),
                uploadStatus: 'failed',
                error: error instanceof Error ? error.message : String(error)
              };
            }
          })
        );

        // Envoyer le message avec métadonnées des fichiers
        const messageResult = await this.sendMessage(userId, {
          recipientId: messageData.recipientId,
          groupId: messageData.groupId,
          content: messageData.content || "Media message",
          messageType: messageData.messageType,
        });

        return {
          success: true,
          messageId: messageResult.messageId,
          files: fileMetadata,
          message: "Media message sent successfully",
        };
      },
      "MessagingEnhanced",
      `media-message-${userId}`
    );
  }

  async sendVoiceMessage(
    userId: string,
    voiceFile: Express.Multer.File,
    messageData: any
  ) {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Validation du fichier vocal
        if (!voiceFile) {
          throw new BadRequestException("No voice file provided");
        }

        const maxSize = 5 * 1024 * 1024; // 5MB pour les messages vocaux
        const allowedTypes = [
          "audio/mpeg",
          "audio/wav",
          "audio/ogg",
          "audio/webm",
        ];

        if (voiceFile.size > maxSize) {
          throw new BadRequestException(
            "Voice file exceeds maximum size of 5MB"
          );
        }

        if (!allowedTypes.includes(voiceFile.mimetype)) {
          throw new BadRequestException(
            `Audio type ${voiceFile.mimetype} not allowed`
          );
        }

        // Sauvegarder le fichier vocal avec Cloudinary
        let voiceMetadata;
        try {
          const uploadResult = await this.audioService.uploadPhoneticAudio(
            'voice_message',
            'voice',
            voiceFile.buffer,
            'standard',
            'auto'
          );
          
          voiceMetadata = {
            originalName: voiceFile.originalname,
            mimeType: voiceFile.mimetype,
            size: voiceFile.size,
            duration: uploadResult.duration || messageData.duration || 0,
            url: uploadResult.url,
            publicId: uploadResult.cloudinaryId,
            uploadedAt: new Date(),
            uploadStatus: 'success',
            format: uploadResult.format
          };
        } catch (error) {
          console.error('Failed to upload voice file:', error);
          voiceMetadata = {
            originalName: voiceFile.originalname,
            mimeType: voiceFile.mimetype,
            size: voiceFile.size,
            duration: messageData.duration || 0,
            url: '',
            publicId: '',
            uploadedAt: new Date(),
            uploadStatus: 'failed',
            error: error instanceof Error ? error.message : String(error)
          };
        }

        // Envoyer le message vocal
        const messageResult = await this.sendMessage(userId, {
          recipientId: messageData.recipientId,
          groupId: messageData.groupId,
          content: `Voice message (${messageData.duration}s)`,
          messageType: "audio",
        });

        return {
          success: true,
          messageId: messageResult.messageId,
          voiceData: voiceMetadata,
          message: "Voice message sent successfully",
        };
      },
      "MessagingEnhanced",
      `voice-message-${userId}`
    );
  }

  async sendLocation(userId: string, locationData: any) {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Validation des données de localisation
        if (!locationData.latitude || !locationData.longitude) {
          throw new BadRequestException("Latitude and longitude are required");
        }

        const {
          latitude,
          longitude,
          address,
          placeName,
          recipientId,
          groupId,
        } = locationData;

        // Validation des coordonnées
        if (latitude < -90 || latitude > 90) {
          throw new BadRequestException("Invalid latitude value");
        }
        if (longitude < -180 || longitude > 180) {
          throw new BadRequestException("Invalid longitude value");
        }

        // Préparer le contenu du message de localisation
        const locationContent =
          placeName || address || `Location: ${latitude}, ${longitude}`;

        // Envoyer le message de localisation
        const messageResult = await this.sendMessage(userId, {
          recipientId,
          groupId,
          content: locationContent,
          messageType: "location",
        });

        return {
          success: true,
          messageId: messageResult.messageId,
          location: {
            latitude,
            longitude,
            address,
            placeName,
          },
          message: "Location shared successfully",
        };
      },
      "MessagingEnhanced",
      `location-message-${userId}`
    );
  }

  // ========== RÉACTIONS ET INTERACTIONS ==========

  async reactToMessage(userId: string, messageId: string, reaction: string) {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le message existe
        const message = await this.messageRepository.findById(messageId);
        if (!message) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier que l'utilisateur a accès au message
        const conversationId =
          typeof message.conversationId === "string"
            ? message.conversationId
            : (message.conversationId as any).id ||
              (message.conversationId as any)._id;
        const conversation =
          await this.conversationRepository.findById(conversationId);
        if (!conversation) {
          throw new NotFoundException("Conversation not found");
        }

        const participants =
          await this.conversationRepository.getParticipants(conversationId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Valider le type de réaction
        const allowedReactions = [
          "👍",
          "❤️",
          "😂",
          "😮",
          "😢",
          "😡",
          "🔥",
          "👏",
        ];
        if (!allowedReactions.includes(reaction)) {
          throw new BadRequestException("Invalid reaction type");
        }

        // Gérer les réactions dans la base de données
        const reactionData = {
          messageId,
          userId,
          reaction,
          addedAt: new Date()
        };

        // Ajouter la réaction via les métadonnées du message
        const reactions = (message.metadata?.reactions as any) || {};
        if (!reactions[reaction]) {
          reactions[reaction] = [];
        }
        
        // Retirer l'ancienne réaction de l'utilisateur s'il en a une
        Object.keys(reactions).forEach(reactionType => {
          reactions[reactionType] = reactions[reactionType].filter(
            (r: any) => r.userId !== userId
          );
          if (reactions[reactionType].length === 0) {
            delete reactions[reactionType];
          }
        });
        
        // Ajouter la nouvelle réaction
        if (!reactions[reaction]) {
          reactions[reaction] = [];
        }
        reactions[reaction].push({ userId, addedAt: new Date() });
        
        // Mettre à jour le message
        const addedReaction = await this.messageRepository.update(messageId, {
          metadata: {
            ...message.metadata,
            reactions
          }
        });

        console.log(
          `User ${userId} reacted with ${reaction} to message ${messageId}`,
          addedReaction
        );

        return {
          success: true,
          message: "Reaction added successfully",
          data: {
            messageId,
            userId,
            reaction,
            addedAt: new Date(),
          },
        };
      },
      "MessagingEnhanced",
      `react-${messageId}`
    );
  }

  async removeReaction(messageId: string, userId: string) {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Vérifier que le message existe
        const message = await this.messageRepository.findById(messageId);
        if (!message) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier l'accès
        const msgConversationId =
          typeof message.conversationId === "string"
            ? message.conversationId
            : (message.conversationId as any).id ||
              (message.conversationId as any)._id;
        const participants =
          await this.conversationRepository.getParticipants(msgConversationId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Supprimer la réaction des métadonnées du message
        const reactions = (message.metadata?.reactions as any) || {};
        let reactionRemoved = false;
        
        // Retirer toutes les réactions de cet utilisateur
        Object.keys(reactions).forEach(reactionType => {
          const originalLength = reactions[reactionType].length;
          reactions[reactionType] = reactions[reactionType].filter(
            (r: any) => r.userId !== userId
          );
          
          if (reactions[reactionType].length < originalLength) {
            reactionRemoved = true;
          }
          
          if (reactions[reactionType].length === 0) {
            delete reactions[reactionType];
          }
        });
        
        // Mettre à jour le message seulement si une réaction a été supprimée
        let removedReaction = null;
        if (reactionRemoved) {
          removedReaction = await this.messageRepository.update(messageId, {
            metadata: {
              ...message.metadata,
              reactions
            }
          });
        }

        console.log(
          `User ${userId} removed reaction from message ${messageId}`,
          removedReaction
        );

        return {
          success: true,
          message: "Reaction removed successfully",
          data: {
            messageId,
            userId,
            removedAt: new Date(),
          },
        };
      },
      "MessagingEnhanced",
      `remove-reaction-${messageId}`
    );
  }

  async forwardMessage(
    userId: string,
    messageId: string,
    recipientIds?: string[],
    groupIds?: string[]
  ) {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que le message existe
        const originalMessage =
          await this.messageRepository.findById(messageId);
        if (!originalMessage) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier l'accès au message original
        const originalConversationId =
          typeof originalMessage.conversationId === "string"
            ? originalMessage.conversationId
            : (originalMessage.conversationId as any).id ||
              (originalMessage.conversationId as any)._id;
        const originalParticipants =
          await this.conversationRepository.getParticipants(
            originalConversationId
          );
        if (!originalParticipants.includes(userId)) {
          throw new BadRequestException("Access denied to original message");
        }

        // Valider qu'au moins une destination est fournie
        if (
          (!recipientIds || recipientIds.length === 0) &&
          (!groupIds || groupIds.length === 0)
        ) {
          throw new BadRequestException(
            "At least one recipient or group is required"
          );
        }

        const forwardedMessages = [];

        // Transférer vers des utilisateurs individuels
        if (recipientIds && recipientIds.length > 0) {
          for (const recipientId of recipientIds) {
            // Vérifier que le destinataire existe
            const recipient = await this.userRepository.findById(recipientId);
            if (!recipient) {
              console.warn(`Recipient ${recipientId} not found, skipping`);
              continue;
            }

            // Envoyer le message transféré
            const forwardedMessage = await this.sendMessage(userId, {
              recipientId,
              content: `[Forwarded] ${originalMessage.content}`,
              messageType: "text",
            });

            forwardedMessages.push({
              recipientId,
              messageId: forwardedMessage.messageId,
            });
          }
        }

        // Transférer vers des groupes
        if (groupIds && groupIds.length > 0) {
          for (const groupId of groupIds) {
            // Vérifier que l'utilisateur a accès au groupe
            try {
              const groupParticipants =
                await this.conversationRepository.getParticipants(groupId);
              if (!groupParticipants.includes(userId)) {
                console.warn(`Access denied to group ${groupId}, skipping`);
                continue;
              }

              // Envoyer le message transféré au groupe
              const forwardedMessage = await this.sendMessage(userId, {
                groupId,
                content: `[Forwarded] ${originalMessage.content}`,
                messageType: "text",
              });

              forwardedMessages.push({
                groupId,
                messageId: forwardedMessage.messageId,
              });
            } catch (error) {
              console.warn(`Error forwarding to group ${groupId}:`, error);
              continue;
            }
          }
        }

        return {
          success: true,
          message: "Message forwarded successfully",
          data: {
            originalMessageId: messageId,
            forwardedMessages,
            totalForwarded: forwardedMessages.length,
          },
        };
      },
      "MessagingEnhanced",
      `forward-${messageId}`
    );
  }

  // ========== GESTION DES MESSAGES ==========

  async deleteMessage(
    messageId: string,
    userId: string,
    deleteFor: "me" | "everyone"
  ) {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Vérifier que le message existe
        const message = await this.messageRepository.findById(messageId);
        if (!message) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier l'accès au message
        const messageConversationId =
          typeof message.conversationId === "string"
            ? message.conversationId
            : (message.conversationId as any).id ||
              (message.conversationId as any)._id;
        const participants = await this.conversationRepository.getParticipants(
          messageConversationId
        );
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        if (deleteFor === "everyone") {
          // Vérifier que l'utilisateur est l'auteur du message
          const messageSenderId =
            typeof message.senderId === "string"
              ? message.senderId
              : (message.senderId as any).id || (message.senderId as any)._id;
          if (messageSenderId !== userId) {
            throw new BadRequestException(
              "Only message author can delete for everyone"
            );
          }

          // Supprimer le message pour tout le monde
          await this.messageRepository.delete(messageId);

          return {
            success: true,
            message: "Message deleted for everyone",
            deletedFor: "everyone",
          };
        } else {
          // Supprimer seulement pour l'utilisateur (soft delete)
          // Mettre à jour les métadonnées pour marquer comme supprimé pour cet utilisateur
          const hiddenForUsers = (message.metadata?.hiddenForUsers as string[]) || [];
          if (!hiddenForUsers.includes(userId)) {
            hiddenForUsers.push(userId);
            
            await this.messageRepository.update(messageId, {
              metadata: {
                ...message.metadata,
                hiddenForUsers,
                lastHiddenAt: new Date()
              }
            });
          }

          return {
            success: true,
            message: "Message deleted for you",
            deletedFor: "me",
          };
        }
      },
      "MessagingEnhanced",
      `delete-${messageId}`
    );
  }

  async editMessage(messageId: string, userId: string, content: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier que le message existe
        const message = await this.messageRepository.findById(messageId);
        if (!message) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier que l'utilisateur est l'auteur du message
        const messageSenderId =
          typeof message.senderId === "string"
            ? message.senderId
            : (message.senderId as any).id || (message.senderId as any)._id;
        if (messageSenderId !== userId) {
          throw new BadRequestException("Only message author can edit message");
        }

        // Vérifier l'accès au message
        const messageConversationId =
          typeof message.conversationId === "string"
            ? message.conversationId
            : (message.conversationId as any).id ||
              (message.conversationId as any)._id;
        const participants = await this.conversationRepository.getParticipants(
          messageConversationId
        );
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Valider le nouveau contenu
        if (!content || content.trim().length === 0) {
          throw new BadRequestException("Message content cannot be empty");
        }

        if (content.length > 1000) {
          throw new BadRequestException(
            "Message content too long (max 1000 characters)"
          );
        }

        // Mettre à jour le message (l'interface ne supporte que content et metadata)
        const updatedMessage = await this.messageRepository.update(messageId, {
          content: content.trim(),
          metadata: {
            ...message.metadata,
            isEdited: true,
            editedAt: new Date(),
          },
        });

        return {
          success: true,
          message: "Message edited successfully",
          data: updatedMessage,
        };
      },
      "MessagingEnhanced",
      `edit-${messageId}`
    );
  }

  async pinMessage(messageId: string, userId: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier que le message existe
        const message = await this.messageRepository.findById(messageId);
        if (!message) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier l'accès au message
        const messageConversationId =
          typeof message.conversationId === "string"
            ? message.conversationId
            : (message.conversationId as any).id ||
              (message.conversationId as any)._id;
        const participants = await this.conversationRepository.getParticipants(
          messageConversationId
        );
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Vérifier que la conversation existe
        const conversation = await this.conversationRepository.findById(
          messageConversationId
        );
        if (!conversation) {
          throw new NotFoundException("Conversation not found");
        }

        // Vérifier les permissions d'épinglage (créateur du groupe ou admin)
        if ((conversation as any).type === "group") {
          const isCreator = (conversation as any).createdBy === userId;
          if (!isCreator) {
            throw new BadRequestException(
              "Only group creators can pin messages"
            );
          }
        }

        // Épingler le message dans la base de données
        await this.messageRepository.update(messageId, {
          metadata: {
            ...message.metadata,
            isPinned: true,
            pinnedBy: userId,
            pinnedAt: new Date()
          }
        });

        console.log(
          `Message ${messageId} pinned by user ${userId} in conversation ${messageConversationId}`
        );

        return {
          success: true,
          message: "Message pinned successfully",
          data: {
            messageId,
            conversationId: messageConversationId,
            pinnedBy: userId,
            pinnedAt: new Date(),
          },
        };
      },
      "MessagingEnhanced",
      `pin-${messageId}`
    );
  }

  async unpinMessage(messageId: string, userId: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier que le message existe
        const message = await this.messageRepository.findById(messageId);
        if (!message) {
          throw new NotFoundException("Message not found");
        }

        // Vérifier l'accès au message
        const messageConversationId =
          typeof message.conversationId === "string"
            ? message.conversationId
            : (message.conversationId as any).id ||
              (message.conversationId as any)._id;
        const participants = await this.conversationRepository.getParticipants(
          messageConversationId
        );
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Vérifier que la conversation existe
        const conversation = await this.conversationRepository.findById(
          messageConversationId
        );
        if (!conversation) {
          throw new NotFoundException("Conversation not found");
        }

        // Vérifier les permissions de désépinglage
        if ((conversation as any).type === "group") {
          const isCreator = (conversation as any).createdBy === userId;
          if (!isCreator) {
            throw new BadRequestException(
              "Only group creators can unpin messages"
            );
          }
        }

        // Désépingler le message dans la base de données
        await this.messageRepository.update(messageId, {
          metadata: {
            ...message.metadata,
            isPinned: false,
            unpinnedBy: userId,
            unpinnedAt: new Date()
          }
        });

        console.log(
          `Message ${messageId} unpinned by user ${userId} in conversation ${messageConversationId}`
        );

        return {
          success: true,
          message: "Message unpinned successfully",
          data: {
            messageId,
            conversationId: messageConversationId,
            unpinnedBy: userId,
            unpinnedAt: new Date(),
          },
        };
      },
      "MessagingEnhanced",
      `unpin-${messageId}`
    );
  }

  // ========== STATUTS ET PRÉSENCE ==========

  // ========== PRÉSENCE UTILISATEUR ==========
  
  // Cache en mémoire pour le tracking de présence
  private onlineUsersMap = new Map<string, {
    userId: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    lastSeen: Date;
    customMessage?: string;
  }>();

  private typingUsersMap = new Map<string, Set<string>>(); // conversationId -> Set of userIds
  private typingTimeouts = new Map<string, NodeJS.Timeout>(); // userId -> timeout

  async getOnlineUsers(userId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Nettoyer les utilisateurs inactifs (plus de 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        for (const [id, userData] of this.onlineUsersMap.entries()) {
          if (userData.lastSeen < fiveMinutesAgo) {
            this.onlineUsersMap.delete(id);
          }
        }

        const onlineUsers = Array.from(this.onlineUsersMap.values())
          .filter(user => user.status !== 'offline')
          .map(user => ({
            userId: user.userId,
            status: user.status,
            lastSeen: user.lastSeen,
            customMessage: user.customMessage
          }));

        return { onlineUsers };
      },
      "MessagingEnhanced",
      `online-users-${userId}`
    );
  }

  async updatePresenceStatus(
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline',
    customMessage?: string
  ) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Valider le statut
        const validStatuses = ['online', 'away', 'busy', 'offline'];
        if (!validStatuses.includes(status)) {
          throw new BadRequestException('Invalid status');
        }

        // Mettre à jour la présence en mémoire
        this.onlineUsersMap.set(userId, {
          userId,
          status,
          lastSeen: new Date(),
          customMessage
        });

        // Si l'utilisateur se déconnecte, nettoyer les indications de frappe
        if (status === 'offline') {
          for (const [conversationId, typingUsers] of this.typingUsersMap.entries()) {
            typingUsers.delete(userId);
            if (typingUsers.size === 0) {
              this.typingUsersMap.delete(conversationId);
            }
          }
          
          // Nettoyer les timeouts
          const timeout = this.typingTimeouts.get(userId);
          if (timeout) {
            clearTimeout(timeout);
            this.typingTimeouts.delete(userId);
          }
        }

        return { 
          success: true, 
          message: "Presence status updated successfully",
          status,
          customMessage
        };
      },
      "MessagingEnhanced",
      `presence-${userId}`
    );
  }

  async getTypingUsers(conversationId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const typingUsers = Array.from(
          this.typingUsersMap.get(conversationId) || new Set()
        );
        return { typingUsers };
      },
      "MessagingEnhanced",
      `typing-${conversationId}`
    );
  }

  async startTyping(conversationId: string, userId: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Vérifier l'accès à la conversation
        const participants = await this.conversationRepository.getParticipants(conversationId);
        if (!participants.includes(userId)) {
          throw new BadRequestException("Access denied to this conversation");
        }

        // Ajouter l'utilisateur aux utilisateurs qui tapent
        if (!this.typingUsersMap.has(conversationId)) {
          this.typingUsersMap.set(conversationId, new Set());
        }
        this.typingUsersMap.get(conversationId)!.add(userId);

        // Arrêter automatiquement après 10 secondes
        const existingTimeout = this.typingTimeouts.get(userId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          this.stopTyping(conversationId, userId);
        }, 10000);
        
        this.typingTimeouts.set(userId, timeout);

        return { success: true };
      },
      "MessagingEnhanced",
      `start-typing-${conversationId}-${userId}`
    );
  }

  async stopTyping(conversationId: string, userId: string) {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // Retirer l'utilisateur des utilisateurs qui tapent
        const typingUsers = this.typingUsersMap.get(conversationId);
        if (typingUsers) {
          typingUsers.delete(userId);
          if (typingUsers.size === 0) {
            this.typingUsersMap.delete(conversationId);
          }
        }

        // Nettoyer le timeout
        const timeout = this.typingTimeouts.get(userId);
        if (timeout) {
          clearTimeout(timeout);
          this.typingTimeouts.delete(userId);
        }

        return { success: true };
      },
      "MessagingEnhanced",
      `stop-typing-${conversationId}-${userId}`
    );
  }

  // ========== RECHERCHE ET HISTORIQUE ==========

  async searchMessages(
    userId: string,
    query: string,
    conversationId?: string,
    messageType?: string
  ) {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Valider la requête de recherche
        if (!query || query.trim().length < 2) {
          throw new BadRequestException("Search query must be at least 2 characters");
        }

        // Utiliser la méthode de recherche du repository
        const searchOptions: any = {
          limit: 50
        };

        if (conversationId) {
          // Vérifier l'accès à la conversation spécifique
          const participants = await this.conversationRepository.getParticipants(conversationId);
          if (!participants.includes(userId)) {
            throw new BadRequestException("Access denied to this conversation");
          }
          searchOptions.conversationId = conversationId;
        }

        if (messageType) {
          searchOptions.messageTypes = [messageType];
        }

        // Effectuer la recherche
        const messages = await this.messageRepository.search(
          query.trim(),
          userId,
          searchOptions
        );

        // Filtrer les messages cachés pour cet utilisateur
        const filteredMessages = messages.filter(message => {
          const hiddenForUsers = (message.metadata?.hiddenForUsers as string[]) || [];
          return !hiddenForUsers.includes(userId);
        });

        return { 
          messages: filteredMessages, 
          total: filteredMessages.length,
          query: query.trim(),
          conversationId,
          messageType
        };
      },
      "MessagingEnhanced",
      `search-${userId}`
    );
  }

  async getConversationMedia(conversationId: string, mediaType?: string) {
    // TODO: Implémenter la récupération des médias de conversation
    return { media: [] };
  }

  // ========== PARAMÈTRES DE CONVERSATION ==========

  async updateConversationSettings(
    conversationId: string,
    userId: string,
    settings: any
  ) {
    // TODO: Implémenter la mise à jour des paramètres de conversation
    return {
      success: true,
      message: "Conversation settings updated successfully",
    };
  }

  async muteConversation(
    conversationId: string,
    userId: string,
    duration?: number
  ) {
    // TODO: Implémenter la mise en sourdine de conversation
    return { success: true, message: "Conversation muted successfully" };
  }

  async unmuteConversation(conversationId: string, userId: string) {
    // TODO: Implémenter la réactivation des notifications
    return { success: true, message: "Conversation unmuted successfully" };
  }

  // ========== STATISTIQUES ET ANALYTICS ==========

  async getUserMessagingStats(userId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Vérifier que l'utilisateur existe
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new NotFoundException("User not found");
        }

        // Récupérer les statistiques depuis le repository
        const basicStats = await this.messageRepository.getUserStats(userId);
        
        // Récupérer les conversations de l'utilisateur
        const conversationsResult = await this.conversationRepository.findByUser(userId);
        const conversations = conversationsResult.conversations;
        
        // Calculer des statistiques additionnelles
        const groupConversations = conversations.filter(conv => (conv as any).type === 'group');
        const privateConversations = conversations.filter(conv => (conv as any).type === 'private');
        
        // Statistiques de présence
        const presenceData = this.onlineUsersMap.get(userId);
        
        const stats = {
          ...basicStats,
          groupConversations: groupConversations.length,
          privateConversations: privateConversations.length,
          totalConversations: conversations.length,
          currentStatus: presenceData?.status || 'offline',
          lastSeen: presenceData?.lastSeen || null,
          customMessage: presenceData?.customMessage || null,
          generatedAt: new Date()
        };

        return { stats };
      },
      "MessagingEnhanced",
      `user-stats-${userId}`
    );
  }

  async getConversationStats(conversationId: string) {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Vérifier que la conversation existe
        const conversation = await this.conversationRepository.findById(conversationId);
        if (!conversation) {
          throw new NotFoundException("Conversation not found");
        }

        // Récupérer les participants
        const participants = await this.conversationRepository.getParticipants(conversationId);
        
        // Récupérer les statistiques de base
        const totalMessages = await this.messageRepository.countInConversation(conversationId);
        const lastMessage = await this.messageRepository.findLastInConversation(conversationId);
        
        // Calculer les statistiques par participant
        const participantStats = await Promise.all(
          participants.map(async (participantId) => {
            const messages = await this.messageRepository.findByConversation(
              conversationId,
              { limit: 1000 }
            );
            
            const userMessages = messages.messages.filter(msg => {
              const senderId = typeof msg.senderId === 'string' 
                ? msg.senderId 
                : (msg.senderId as any).id || (msg.senderId as any)._id;
              return senderId === participantId;
            });
            
            return {
              userId: participantId,
              messageCount: userMessages.length,
              lastMessageAt: userMessages[0]?.createdAt || null
            };
          })
        );

        // Statistiques des réactions (si supportées)
        const messages = await this.messageRepository.findByConversation(
          conversationId,
          { limit: 100 }
        );
        
        let totalReactions = 0;
        let pinnedMessages = 0;
        
        messages.messages.forEach(msg => {
          if (msg.metadata?.reactions) {
            totalReactions += Object.keys(msg.metadata.reactions).length;
          }
          if (msg.metadata?.isPinned) {
            pinnedMessages++;
          }
        });

        const stats = {
          conversationId,
          type: (conversation as any).type || 'private',
          createdAt: (conversation as any).createdAt || new Date(),
          participantCount: participants.length,
          totalMessages,
          totalReactions,
          pinnedMessages,
          lastMessage: lastMessage ? {
            id: (lastMessage as any).id || (lastMessage as any)._id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId
          } : null,
          participantStats,
          isActive: lastMessage && 
            new Date(lastMessage.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000,
          generatedAt: new Date()
        };

        return { stats };
      },
      "MessagingEnhanced",
      `conversation-stats-${conversationId}`
    );
  }

  // ========== MÉTHODES PRIVÉES D'UPLOAD CLOUDINARY ==========

  /**
   * Upload d'image vers Cloudinary
   */
  private async uploadImageToCloudinary(file: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'messaging/images',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(file.buffer);
    });
  }

  /**
   * Upload de fichier générique vers Cloudinary
   */
  private async uploadFileToCloudinary(file: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'messaging/files',
          resource_type: 'raw',
          use_filename: true,
          unique_filename: true
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(file.buffer);
    });
  }
}
