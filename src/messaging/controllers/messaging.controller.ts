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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MessagingService } from '../services/messaging.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetMessagesDto } from '../dto/get-messages.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    username: string;
    email: string;
  };
}

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Envoyer un message' })
  @ApiResponse({ status: 201, description: 'Message envoyé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Destinataire introuvable' })
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendMessage(
      req.user.userId,
      sendMessageDto,
    );
    return {
      success: true,
      message: 'Message envoyé avec succès',
      data: message,
    };
  }

  @Get('conversations')
  @ApiOperation({ summary: "Récupérer les conversations de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Conversations récupérées avec succès',
  })
  async getUserConversations(@Request() req: AuthenticatedRequest) {
    const conversations = await this.messagingService.getUserConversations(
      req.user.userId,
    );
    return {
      success: true,
      data: conversations,
    };
  }

  @Get('messages')
  @ApiOperation({ summary: "Récupérer les messages d'une conversation" })
  @ApiResponse({ status: 200, description: 'Messages récupérés avec succès' })
  @ApiResponse({ status: 400, description: 'ID de conversation requis' })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit à cette conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  async getMessages(
    @Request() req: AuthenticatedRequest,
    @Query() getMessagesDto: GetMessagesDto,
  ) {
    const result = await this.messagingService.getMessages(
      req.user.userId,
      getMessagesDto,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Patch('conversations/:conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Marquer les messages d'une conversation comme lus",
  })
  @ApiResponse({ status: 200, description: 'Messages marqués comme lus' })
  @ApiResponse({
    status: 403,
    description: 'Accès interdit à cette conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation introuvable' })
  async markMessagesAsRead(
    @Request() req: AuthenticatedRequest,
    @Param('conversationId') conversationId: string,
  ) {
    const result = await this.messagingService.markMessagesAsRead(
      req.user.userId,
      conversationId,
    );
    return {
      success: true,
      message: `${result.modifiedCount} message(s) marqué(s) comme lu(s)`,
      data: result,
    };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Récupérer le nombre de messages non lus' })
  @ApiResponse({
    status: 200,
    description: 'Nombre de messages non lus récupéré',
  })
  async getUnreadMessagesCount(@Request() req: AuthenticatedRequest) {
    const count = await this.messagingService.getUnreadMessagesCount(
      req.user.userId,
    );
    return {
      success: true,
      data: { count },
    };
  }
}
