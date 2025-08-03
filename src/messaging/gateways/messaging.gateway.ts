/**
 * @fileoverview Gateway WebSocket pour messagerie temps réel O'Ypunu
 * 
 * Cette gateway gère toute la communication temps réel de la messagerie
 * avec authentification JWT, gestion des sessions utilisateur, rooms
 * par conversation et fonctionnalités avancées (présence, typing indicators).
 * Elle constitue le cœur de l'expérience messagerie en temps réel.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from '../services/messaging.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Type étendu de Socket avec données d'authentification
 * 
 * @typedef {Socket & Object} AuthenticatedSocket
 * @property {string} [userId] - ID de l'utilisateur authentifié
 * @property {string} [username] - Nom d'utilisateur pour affichage
 */
type AuthenticatedSocket = Socket & {
  userId?: string;
  username?: string;
};

/**
 * Gateway WebSocket de messagerie temps réel O'Ypunu
 * 
 * Cette gateway fournit une communication bidirectionnelle temps réel
 * pour la messagerie avec architecture room-based et fonctionnalités avancées :
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 🔐 Authentification sécurisée
 * - Authentification JWT obligatoire à la connexion
 * - Support multiple pour token (query, auth, headers)
 * - Validation et vérification automatique des tokens
 * - Déconnexion automatique si authentification échoue
 * 
 * ### 🏠 Système de rooms intelligent
 * - Room personnelle par utilisateur (user_${userId})
 * - Rooms par conversation (conversation_${conversationId})
 * - Gestion automatique des jointures/sorties
 * - Diffusion ciblée par room
 * 
 * ### 📡 Messagerie temps réel
 * - Envoi messages instantané via WebSocket
 * - Notification automatique au destinataire connecté
 * - Accusé de réception pour l'expéditeur
 * - Persistance via MessagingService intégré
 * 
 * ### 👀 Fonctionnalités avancées
 * - Indicateurs de présence (online/offline)
 * - Typing indicators avec start/stop
 * - Gestion des sessions multiples par utilisateur
 * - Debug mode pour développement
 * 
 * ### 🛠️ Utilitaires d'administration
 * - Tracking des utilisateurs connectés
 * - Logging détaillé pour monitoring
 * - Méthodes utilitaires pour diffusion ciblée
 * - Gestion d'erreurs contextualisée
 * 
 * @class MessagingGateway
 * @implements {OnGatewayConnection, OnGatewayDisconnect}
 * @version 1.0.0
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/messaging',
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  /** Serveur Socket.IO pour diffusion */
  @WebSocketServer()
  server: Server;

  /** Logger pour traçabilité */
  private readonly logger = new Logger(MessagingGateway.name);
  
  /** Map des utilisateurs connectés : userId -> socketId */
  private connectedUsers = new Map<string, string>();

  /**
   * Constructeur avec injection des services
   * 
   * @constructor
   * @param {MessagingService} _messagingService - Service de messagerie
   * @param {JwtService} _jwtService - Service JWT pour authentification
   * @param {ConfigService} _configService - Service de configuration
   */
  constructor(
    private readonly _messagingService: MessagingService,
    private readonly _jwtService: JwtService,
    private readonly _configService: ConfigService,
  ) {}

  /**
   * Gère la connexion d'un nouveau client WebSocket
   * 
   * Cette méthode critique authentifie le client via JWT, l'ajoute
   * aux utilisateurs connectés et configure ses rooms personnelles.
   * Elle diffuse également sa présence aux autres utilisateurs.
   * 
   * @async
   * @method handleConnection
   * @param {AuthenticatedSocket} client - Socket client à authentifier
   * @returns {Promise<void>}
   * 
   * @example
   * ```javascript
   * // Côté client - Connexion avec token
   * const socket = io('/messaging', {
   *   auth: { token: jwtToken },
   *   query: { token: jwtToken } // Alternative
   * });
   * ```
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraire le token du query ou des headers
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        this._extractTokenFromAuth(client.handshake.headers?.authorization);

      if (!token) {
        this.logger.warn("Client connecté sans token d'authentification");
        this._sendErrorAndDisconnect(
          client, 
          'AUTH_TOKEN_MISSING', 
          "Token d'authentification requis pour utiliser la messagerie"
        );
        return;
      }

      const payload = this._jwtService.verify(token, {
        secret: this._configService.get<string>('JWT_SECRET'),
      });

      client.userId = payload.sub;
      client.username = payload.username;

      // Ajouter l'utilisateur à la liste des connectés
      if (client.userId) {
        this.connectedUsers.set(client.userId, client.id);
      }

      // Joindre l'utilisateur à sa "room" personnelle
      client.join(`user_${client.userId}`);

      this.logger.log(
        `✅ Utilisateur ${client.username} (${client.userId}) connecté via WebSocket`,
      );

      // Notifier les autres utilisateurs que cet utilisateur est en ligne
      client.broadcast.emit('user_online', {
        userId: client.userId,
        username: client.username,
      });
    } catch (error) {
      this.logger.error("❌ Erreur lors de l'authentification WebSocket:", error);

      // Debug du token en cas d'erreur (uniquement en dev)
      if (process.env.NODE_ENV === 'development') {
        this._debugTokenError(client, error);
      }

      // Déterminer le type d'erreur et envoyer une réponse appropriée
      const errorCode = this._getAuthErrorCode(error);
      const errorMessage = this._getAuthErrorMessage(errorCode);
      
      this._sendErrorAndDisconnect(client, errorCode, errorMessage);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      // Retirer l'utilisateur de la liste des connectés
      this.connectedUsers.delete(client.userId);

      this.logger.log(
        `🔌 Utilisateur ${client.username} (${client.userId}) déconnecté`,
      );

      // Notifier les autres utilisateurs que cet utilisateur est hors ligne
      client.broadcast.emit('user_offline', {
        userId: client.userId,
        username: client.username,
      });
    }
  }

  /**
   * Gère l'envoi d'un message via WebSocket
   * 
   * Cette méthode handler reçoit un message du client, le persiste
   * via le service de messagerie et le diffuse en temps réel au
   * destinataire s'il est connecté. L'expéditeur reçoit confirmation.
   * 
   * @async
   * @method handleSendMessage
   * @param {AuthenticatedSocket} client - Client expéditeur
   * @param {SendMessageDto} data - Données du message à envoyer
   * @returns {Promise<void>}
   * 
   * @example
   * ```javascript
   * // Côté client - Envoi de message
   * socket.emit('send_message', {
   *   receiverId: 'recipient-user-id',
   *   content: 'Bonjour en Yipunu!',
   *   messageType: 'text',
   *   metadata: { language: 'yipunu' }
   * });
   * ```
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    try {
      if (!client.userId) {
        client.emit('error', { message: 'Non authentifié' });
        return;
      }

      // Envoyer le message via le service
      const message = await this._messagingService.sendMessage(
        client.userId,
        data,
      );

      // Envoyer le message au destinataire s'il est connecté
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit('new_message', message);
      }

      // Confirmer l'envoi à l'expéditeur
      client.emit('message_sent', message);

      this.logger.log(
        `📤 Message envoyé de ${client.userId} vers ${data.receiverId}`,
      );
    } catch (error) {
      this.logger.error("❌ Erreur lors de l'envoi du message:", error);
      client.emit('error', { message: "Erreur lors de l'envoi du message" });
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      if (!client.userId) {
        client.emit('error', { message: 'Non authentifié' });
        return;
      }

      // Joindre la room de la conversation
      client.join(`conversation_${data.conversationId}`);

      this.logger.log(
        `🏠 Utilisateur ${client.userId} a rejoint la conversation ${data.conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Erreur lors de la jointure de conversation:',
        error,
      );
      client.emit('error', {
        message: 'Erreur lors de la jointure de conversation',
      });
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      // Quitter la room de la conversation
      client.leave(`conversation_${data.conversationId}`);

      this.logger.log(
        `🚪 Utilisateur ${client.userId} a quitté la conversation ${data.conversationId}`,
      );
    } catch (error) {
      this.logger.error('❌ Erreur lors de la sortie de conversation:', error);
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      if (!client.userId) return;

      // Notifier les autres participants de la conversation que l'utilisateur tape
      client.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId: client.userId,
        username: client.username,
        conversationId: data.conversationId,
      });
    } catch (error) {
      this.logger.error('❌ Erreur lors de la notification de frappe:', error);
    }
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      if (!client.userId) return;

      // Notifier les autres participants que l'utilisateur a arrêté de taper
      client
        .to(`conversation_${data.conversationId}`)
        .emit('user_stopped_typing', {
          userId: client.userId,
          username: client.username,
          conversationId: data.conversationId,
        });
    } catch (error) {
      this.logger.error(
        "❌ Erreur lors de la notification d'arrêt de frappe:",
        error,
      );
    }
  }

  /**
   * Méthode pour extraire le token Bearer
   */
  private _extractTokenFromAuth(authorization?: string): string | null {
    if (authorization && authorization.startsWith('Bearer ')) {
      return authorization.substring(7);
    }
    return null;
  }

  /**
   * Méthode de debug pour les erreurs de token
   */
  private _debugTokenError(client: AuthenticatedSocket, error: any) {
    this.logger.debug('🔍 Debug WebSocket Authentication Error:');
    this.logger.debug(
      'Authorization header:',
      client.handshake.headers?.authorization,
    );
    this.logger.debug('Query token:', client.handshake.query?.token);
    this.logger.debug('Auth token:', client.handshake.auth?.token);
    this.logger.debug(
      'JWT Secret configured:',
      !!this._configService.get<string>('JWT_SECRET'),
    );
    this.logger.debug('Error details:', error.message);
  }

  /**
   * Méthode utilitaire pour envoyer un message à un utilisateur spécifique
   */
  sendToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /**
   * Méthode utilitaire pour envoyer un message à tous les participants d'une conversation
   */
  sendToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`conversation_${conversationId}`).emit(event, data);
  }

  /**
   * Envoie une erreur structurée au client avant de le déconnecter
   */
  private _sendErrorAndDisconnect(
    client: AuthenticatedSocket, 
    errorCode: string, 
    message: string
  ): void {
    // Envoyer l'erreur au client avant la déconnexion
    client.emit('auth_error', {
      code: errorCode,
      message: message,
      timestamp: new Date().toISOString(),
      action: 'disconnect'
    });

    // Délai court pour permettre l'envoi du message d'erreur
    setTimeout(() => {
      client.disconnect(true);
    }, 100);
  }

  /**
   * Détermine le code d'erreur d'authentification
   */
  private _getAuthErrorCode(error: any): string {
    if (error.name === 'JsonWebTokenError') {
      return 'AUTH_TOKEN_INVALID';
    }
    if (error.name === 'TokenExpiredError') {
      return 'AUTH_TOKEN_EXPIRED';
    }
    if (error.name === 'NotBeforeError') {
      return 'AUTH_TOKEN_NOT_ACTIVE';
    }
    return 'AUTH_FAILED';
  }

  /**
   * Génère un message d'erreur utilisateur approprié
   */
  private _getAuthErrorMessage(errorCode: string): string {
    const messages = {
      'AUTH_TOKEN_MISSING': "Token d'authentification manquant",
      'AUTH_TOKEN_INVALID': "Token d'authentification invalide",
      'AUTH_TOKEN_EXPIRED': "Session expirée, veuillez vous reconnecter",
      'AUTH_TOKEN_NOT_ACTIVE': "Token d'authentification pas encore valide",
      'AUTH_FAILED': "Échec de l'authentification WebSocket"
    };
    
    return messages[errorCode] || messages['AUTH_FAILED'];
  }
}
