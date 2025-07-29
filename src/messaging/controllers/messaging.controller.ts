import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { MessagingService } from "../services/messaging.service";
import { MessagingEnhancedService } from "../services/messaging-enhanced.service";
import { SendMessageDto } from "../dto/send-message.dto";
import { GetMessagesDto } from "../dto/get-messages.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    username: string;
    email: string;
  };
}

@ApiTags("messaging")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("messaging")
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService, // 👈 Garde l'ancien pour compatibilité
    private readonly messagingEnhancedService: MessagingEnhancedService // 👈 Ajoute le nouveau
  ) {}

  @Post("send")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Envoyer un message" })
  @ApiResponse({ status: 201, description: "Message envoyé avec succès" })
  @ApiResponse({ status: 400, description: "Données invalides" })
  @ApiResponse({ status: 404, description: "Destinataire introuvable" })
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Body() sendMessageDto: SendMessageDto
  ) {
    // 🚀 Utilise le nouveau service Enhanced en maintenant la compatibilité
    const result = await this.messagingEnhancedService.sendSimpleMessage(
      req.user.userId,
      sendMessageDto.receiverId,
      sendMessageDto.content
    );
    return {
      success: true,
      message: "Message envoyé avec succès",
      data: result.data,
    };
  }

  @Get("conversations")
  @ApiOperation({ summary: "Récupérer les conversations de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: "Conversations récupérées avec succès",
  })
  async getUserConversations(@Request() req: AuthenticatedRequest) {
    // 🚀 Utilise le nouveau service Enhanced
    const result = await this.messagingEnhancedService.getUserConversations(
      req.user.userId
    );
    return {
      success: true,
      data: result.conversations,
    };
  }

  @Get("messages")
  @ApiOperation({ summary: "Récupérer les messages d'une conversation" })
  @ApiResponse({ status: 200, description: "Messages récupérés avec succès" })
  @ApiResponse({ status: 400, description: "ID de conversation requis" })
  @ApiResponse({
    status: 403,
    description: "Accès interdit à cette conversation",
  })
  @ApiResponse({ status: 404, description: "Conversation introuvable" })
  async getMessages(
    @Request() req: AuthenticatedRequest,
    @Query() getMessagesDto: GetMessagesDto
  ) {
    // 🚀 Utilise le nouveau service Enhanced
    const result = await this.messagingEnhancedService.getConversationMessages(
      req.user.userId,
      getMessagesDto.conversationId,
      getMessagesDto.page,
      getMessagesDto.limit
    );
    return {
      success: true,
      data: result,
    };
  }

  @Patch("conversations/:conversationId/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Marquer les messages d'une conversation comme lus",
  })
  @ApiResponse({ status: 200, description: "Messages marqués comme lus" })
  @ApiResponse({
    status: 403,
    description: "Accès interdit à cette conversation",
  })
  @ApiResponse({ status: 404, description: "Conversation introuvable" })
  async markMessagesAsRead(
    @Request() req: AuthenticatedRequest,
    @Param("conversationId") conversationId: string
  ) {
    // 🚀 Utilise le nouveau service Enhanced
    const result = await this.messagingEnhancedService.markMessagesAsRead(
      req.user.userId,
      conversationId
    );
    return {
      success: true,
      message: `${result.modifiedCount} message(s) marqué(s) comme lu(s)`,
      data: result,
    };
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Récupérer le nombre de messages non lus" })
  @ApiResponse({
    status: 200,
    description: "Nombre de messages non lus récupéré",
  })
  async getUnreadMessagesCount(@Request() req: AuthenticatedRequest) {
    // 🚀 Utilise le nouveau service Enhanced
    const count = await this.messagingEnhancedService.getUnreadMessagesCount(
      req.user.userId
    );
    return {
      success: true,
      data: { count },
    };
  }
}
