import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MessagingEnhancedService } from '../services/messaging-enhanced.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    username: string;
    email: string;
  };
}

// DTOs pour les nouvelles fonctionnalités
class CreateGroupDto {
  name: string;
  description?: string;
  participants: string[]; // Array de userIds
  avatar?: string;
  isPrivate?: boolean;
}

class SendMessageEnhancedDto {
  recipientId?: string; // Pour messages privés
  groupId?: string; // Pour messages de groupe
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  replyToMessageId?: string; // Pour répondre à un message
  isEphemeral?: boolean; // Messages éphémères
  ephemeralDuration?: number; // Durée en secondes
}

class ReactToMessageDto {
  messageId: string;
  reaction: '👍' | '❤️' | '😂' | '😮' | '😢' | '😡' | '🔥' | '👏';
}

class UpdateGroupDto {
  name?: string;
  description?: string;
  avatar?: string;
  isPrivate?: boolean;
}

@ApiTags('messaging-enhanced')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messaging/enhanced')
export class MessagingEnhancedController {
  constructor(private readonly messagingEnhancedService: MessagingEnhancedService) {}

  // ========== GESTION DES GROUPES ==========

  @Post('groups')
  @ApiOperation({ summary: 'Créer un nouveau groupe' })
  @ApiResponse({ status: 201, description: 'Groupe créé avec succès' })
  async createGroup(
    @Request() req: AuthenticatedRequest,
    @Body() createGroupDto: CreateGroupDto,
  ) {
    return this.messagingEnhancedService.createGroup(
      req.user.userId,
      createGroupDto.name,
      createGroupDto.participants,
      createGroupDto.description,
      createGroupDto.isPrivate,
    );
  }

  @Get('groups')
  @ApiOperation({ summary: 'Récupérer les groupes de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Groupes récupérés avec succès' })
  async getUserGroups(@Request() req: AuthenticatedRequest) {
    return this.messagingEnhancedService.getUserGroups(req.user.userId);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Récupérer les détails d\'un groupe' })
  @ApiParam({ name: 'groupId', description: 'ID du groupe' })
  @ApiResponse({ status: 200, description: 'Détails du groupe récupérés' })
  async getGroupDetails(@Param('groupId') groupId: string) {
    return this.messagingEnhancedService.getGroupDetails(groupId);
  }

  @Patch('groups/:groupId')
  @ApiOperation({ summary: 'Mettre à jour les informations d\'un groupe' })
  @ApiParam({ name: 'groupId', description: 'ID du groupe' })
  async updateGroup(
    @Param('groupId') groupId: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.updateGroup(
      groupId,
      req.user.userId,
      updateGroupDto,
    );
  }

  @Post('groups/:groupId/participants')
  @ApiOperation({ summary: 'Ajouter des participants à un groupe' })
  @ApiParam({ name: 'groupId', description: 'ID du groupe' })
  async addParticipants(
    @Param('groupId') groupId: string,
    @Body() body: { userIds: string[] },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.addParticipants(
      groupId,
      req.user.userId,
      body.userIds,
    );
  }

  @Delete('groups/:groupId/participants/:userId')
  @ApiOperation({ summary: 'Retirer un participant d\'un groupe' })
  @ApiParam({ name: 'groupId', description: 'ID du groupe' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur à retirer' })
  async removeParticipant(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.removeParticipant(
      groupId,
      req.user.userId,
      userId,
    );
  }

  @Post('groups/:groupId/leave')
  @ApiOperation({ summary: 'Quitter un groupe' })
  @ApiParam({ name: 'groupId', description: 'ID du groupe' })
  async leaveGroup(
    @Param('groupId') groupId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.leaveGroup(groupId, req.user.userId);
  }

  // ========== MESSAGES MULTIMÉDIA ==========

  @Post('messages/media')
  @ApiOperation({ summary: 'Envoyer un message avec fichier multimédia' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10)) // Jusqu'à 10 fichiers
  async sendMediaMessage(
    @Request() req: AuthenticatedRequest,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() messageData: {
      recipientId?: string;
      groupId?: string;
      content?: string;
      messageType: 'image' | 'audio' | 'video' | 'document';
    },
  ) {
    return this.messagingEnhancedService.sendMediaMessage(
      req.user.userId,
      files,
      messageData,
    );
  }

  @Post('messages/voice')
  @ApiOperation({ summary: 'Envoyer un message vocal' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('voiceMessage'))
  async sendVoiceMessage(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() voiceFile: Express.Multer.File,
    @Body() messageData: {
      recipientId?: string;
      groupId?: string;
      duration: number; // Durée en secondes
    },
  ) {
    return this.messagingEnhancedService.sendVoiceMessage(
      req.user.userId,
      voiceFile,
      messageData,
    );
  }

  @Post('messages/location')
  @ApiOperation({ summary: 'Partager une localisation' })
  async sendLocation(
    @Request() req: AuthenticatedRequest,
    @Body() locationData: {
      recipientId?: string;
      groupId?: string;
      latitude: number;
      longitude: number;
      address?: string;
      placeName?: string;
    },
  ) {
    return this.messagingEnhancedService.sendLocation(req.user.userId, locationData);
  }

  // ========== RÉACTIONS ET INTERACTIONS ==========

  @Post('messages/react')
  @ApiOperation({ summary: 'Réagir à un message' })
  async reactToMessage(
    @Request() req: AuthenticatedRequest,
    @Body() reactionDto: ReactToMessageDto,
  ) {
    return this.messagingEnhancedService.reactToMessage(
      req.user.userId,
      reactionDto.messageId,
      reactionDto.reaction,
    );
  }

  @Delete('messages/:messageId/reactions')
  @ApiOperation({ summary: 'Retirer sa réaction d\'un message' })
  @ApiParam({ name: 'messageId', description: 'ID du message' })
  async removeReaction(
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.removeReaction(messageId, req.user.userId);
  }

  @Post('messages/forward')
  @ApiOperation({ summary: 'Transférer un message' })
  async forwardMessage(
    @Request() req: AuthenticatedRequest,
    @Body() forwardData: {
      messageId: string;
      recipientIds?: string[];
      groupIds?: string[];
    },
  ) {
    return this.messagingEnhancedService.forwardMessage(
      req.user.userId,
      forwardData.messageId,
      forwardData.recipientIds,
      forwardData.groupIds,
    );
  }

  // ========== GESTION DES MESSAGES ==========

  @Delete('messages/:messageId')
  @ApiOperation({ summary: 'Supprimer un message' })
  @ApiParam({ name: 'messageId', description: 'ID du message à supprimer' })
  @ApiQuery({
    name: 'deleteFor',
    enum: ['me', 'everyone'],
    description: 'Supprimer pour moi seulement ou pour tout le monde',
  })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Query('deleteFor') deleteFor: 'me' | 'everyone' = 'me',
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.deleteMessage(
      messageId,
      req.user.userId,
      deleteFor,
    );
  }

  @Patch('messages/:messageId')
  @ApiOperation({ summary: 'Modifier un message' })
  @ApiParam({ name: 'messageId', description: 'ID du message à modifier' })
  async editMessage(
    @Param('messageId') messageId: string,
    @Body() editData: { content: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.editMessage(
      messageId,
      req.user.userId,
      editData.content,
    );
  }

  @Post('messages/:messageId/pin')
  @ApiOperation({ summary: 'Épingler un message dans une conversation' })
  @ApiParam({ name: 'messageId', description: 'ID du message à épingler' })
  async pinMessage(
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.pinMessage(messageId, req.user.userId);
  }

  @Delete('messages/:messageId/pin')
  @ApiOperation({ summary: 'Désépingler un message' })
  @ApiParam({ name: 'messageId', description: 'ID du message à désépingler' })
  async unpinMessage(
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.unpinMessage(messageId, req.user.userId);
  }

  // ========== STATUTS ET PRÉSENCE ==========

  @Get('presence/online-users')
  @ApiOperation({ summary: 'Récupérer les utilisateurs en ligne' })
  async getOnlineUsers(@Request() req: AuthenticatedRequest) {
    return this.messagingEnhancedService.getOnlineUsers(req.user.userId);
  }

  @Post('presence/status')
  @ApiOperation({ summary: 'Mettre à jour son statut de présence' })
  async updatePresenceStatus(
    @Request() req: AuthenticatedRequest,
    @Body() statusData: {
      status: 'online' | 'away' | 'busy' | 'invisible';
      customMessage?: string;
    },
  ) {
    return this.messagingEnhancedService.updatePresenceStatus(
      req.user.userId,
      statusData.status,
      statusData.customMessage,
    );
  }

  @Get('conversations/:conversationId/typing')
  @ApiOperation({ summary: 'Récupérer qui est en train de taper' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async getTypingUsers(@Param('conversationId') conversationId: string) {
    return this.messagingEnhancedService.getTypingUsers(conversationId);
  }

  @Post('conversations/:conversationId/typing')
  @ApiOperation({ summary: 'Indiquer que l\'utilisateur tape' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async startTyping(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.startTyping(conversationId, req.user.userId);
  }

  @Delete('conversations/:conversationId/typing')
  @ApiOperation({ summary: 'Arrêter d\'indiquer que l\'utilisateur tape' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async stopTyping(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.stopTyping(conversationId, req.user.userId);
  }

  // ========== RECHERCHE ET HISTORIQUE ==========

  @Get('search')
  @ApiOperation({ summary: 'Rechercher dans les messages' })
  @ApiQuery({ name: 'q', description: 'Terme de recherche' })
  @ApiQuery({ name: 'conversationId', required: false, description: 'Limiter à une conversation' })
  @ApiQuery({ name: 'messageType', required: false, description: 'Filtrer par type de message' })
  async searchMessages(
    @Query('q') query: string,
    @Query('conversationId') conversationId?: string,
    @Query('messageType') messageType?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.searchMessages(
      req.user.userId,
      query,
      conversationId,
      messageType,
    );
  }

  @Get('conversations/:conversationId/media')
  @ApiOperation({ summary: 'Récupérer tous les médias d\'une conversation' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  @ApiQuery({ name: 'type', required: false, enum: ['image', 'video', 'audio', 'document'] })
  async getConversationMedia(
    @Param('conversationId') conversationId: string,
    @Query('type') mediaType?: 'image' | 'video' | 'audio' | 'document',
  ) {
    return this.messagingEnhancedService.getConversationMedia(conversationId, mediaType);
  }

  // ========== PARAMÈTRES DE CONVERSATION ==========

  @Patch('conversations/:conversationId/settings')
  @ApiOperation({ summary: 'Mettre à jour les paramètres d\'une conversation' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async updateConversationSettings(
    @Param('conversationId') conversationId: string,
    @Body() settings: {
      notifications?: boolean;
      theme?: string;
      wallpaper?: string;
      autoDeleteDuration?: number; // en jours, 0 = désactivé
    },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.updateConversationSettings(
      conversationId,
      req.user.userId,
      settings,
    );
  }

  @Post('conversations/:conversationId/mute')
  @ApiOperation({ summary: 'Mettre en sourdine une conversation' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async muteConversation(
    @Param('conversationId') conversationId: string,
    @Body() muteData: {
      duration?: number; // en minutes, undefined = indéfiniment
    },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.muteConversation(
      conversationId,
      req.user.userId,
      muteData.duration,
    );
  }

  @Delete('conversations/:conversationId/mute')
  @ApiOperation({ summary: 'Réactiver les notifications d\'une conversation' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async unmuteConversation(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.messagingEnhancedService.unmuteConversation(
      conversationId,
      req.user.userId,
    );
  }

  // ========== STATISTIQUES ET ANALYTICS ==========

  @Get('analytics/my-stats')
  @ApiOperation({ summary: 'Statistiques personnelles de messagerie' })
  async getMyMessagingStats(@Request() req: AuthenticatedRequest) {
    return this.messagingEnhancedService.getUserMessagingStats(req.user.userId);
  }

  @Get('conversations/:conversationId/stats')
  @ApiOperation({ summary: 'Statistiques d\'une conversation' })
  @ApiParam({ name: 'conversationId', description: 'ID de la conversation' })
  async getConversationStats(@Param('conversationId') conversationId: string) {
    return this.messagingEnhancedService.getConversationStats(conversationId);
  }
}