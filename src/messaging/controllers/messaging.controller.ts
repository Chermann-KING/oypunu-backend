/**
 * @fileoverview Contrôleur REST de messagerie basique pour O'Ypunu
 * 
 * Ce contrôleur fournit une API REST de compatibilité pour la messagerie
 * tout en utilisant le service Enhanced en arrière-plan. Il maintient
 * la compatibilité ascendante pour les clients existants avec une
 * transition transparente vers les fonctionnalités avancées.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

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

/**
 * Interface pour les requêtes authentifiées avec données utilisateur JWT
 * 
 * @interface AuthenticatedRequest
 * @extends Request
 * @property {Object} user - Données utilisateur extraites du token JWT
 * @property {string} user.userId - ID unique de l'utilisateur
 * @property {string} user.username - Nom d'utilisateur
 * @property {string} user.email - Email de l'utilisateur
 */
interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    username: string;
    email: string;
  };
}

/**
 * Contrôleur REST de messagerie de compatibilité O'Ypunu
 * 
 * Ce contrôleur maintient l'API REST existante pour la messagerie
 * tout en utilisant le service Enhanced pour bénéficier des
 * fonctionnalités avancées. Il assure une transition en douceur :
 * 
 * ## Fonctionnalités de compatibilité :
 * 
 * ### 📡 API REST standard
 * - Endpoints familiers pour clients existants
 * - Authentification JWT obligatoire sur tous les endpoints
 * - Documentation Swagger complète et cohérente
 * - Codes de statut HTTP standards et descriptifs
 * 
 * ### 🔄 Migration transparente
 * - Utilise MessagingEnhancedService en arrière-plan
 * - Maintient les interfaces existantes intactes
 * - Format de réponse uniforme avec structure success/data
 * - Gestion d'erreurs harmonisée
 * 
 * ### 🛡️ Sécurité intégrée
 * - JwtAuthGuard sur tous les endpoints
 * - Validation des permissions automatique
 * - Extraction sécurisée des données utilisateur
 * - Protection contre l'accès non autorisé
 * 
 * @class MessagingController
 * @version 1.0.0
 */
@ApiTags("messaging")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("messaging")
export class MessagingController {
  /**
   * Constructeur avec injection des services
   * 
   * @constructor
   * @param {MessagingService} messagingService - Service basique (compatibilité)
   * @param {MessagingEnhancedService} messagingEnhancedService - Service avancé utilisé
   */
  constructor(
    private readonly messagingService: MessagingService,
    private readonly messagingEnhancedService: MessagingEnhancedService
  ) {}

  /**
   * Envoie un message privé via API REST
   * 
   * Endpoint de compatibilité pour l'envoi de messages qui utilise
   * le service Enhanced tout en maintenant l'interface familière.
   * Valide automatiquement l'authentification et les permissions.
   * 
   * @async
   * @method sendMessage
   * @param {AuthenticatedRequest} req - Requête avec utilisateur authentifié
   * @param {SendMessageDto} sendMessageDto - Données validées du message
   * @returns {Promise<Object>} Réponse avec success/data structure
   * 
   * @example
   * ```bash
   * POST /messaging/send
   * Authorization: Bearer <jwt-token>
   * Content-Type: application/json
   * 
   * {
   *   "receiverId": "user-id-456",
   *   "content": "Salut! Comment ça va?",
   *   "messageType": "text"
   * }
   * ```
   */
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
