import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { MessagingService } from "../services/messaging.service";
import { SendMessageDto } from "../dto/send-message.dto";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type AuthenticatedSocket = Socket & {
  userId?: string;
  username?: string;
};

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true,
  },
  namespace: "/messaging",
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private readonly _messagingService: MessagingService,
    private readonly _jwtService: JwtService,
    private readonly _configService: ConfigService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraire le token du query ou des headers
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        this._extractTokenFromAuth(client.handshake.headers?.authorization);

      if (!token) {
        this.logger.warn("Client connecté sans token d'authentification");
        client.disconnect();
        return;
      }

      const payload = this._jwtService.verify(token, {
        secret: this._configService.get<string>("JWT_SECRET"),
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
        `✅ Utilisateur ${client.username} (${client.userId}) connecté via WebSocket`
      );

      // Notifier les autres utilisateurs que cet utilisateur est en ligne
      client.broadcast.emit("user_online", {
        userId: client.userId,
        username: client.username,
      });
    } catch (error) {
      this.logger.error("❌ Erreur lors de l'authentification WebSocket:");
      this.logger.error(error);

      // Debug du token en cas d'erreur
      if (process.env.NODE_ENV === "development") {
        this._debugTokenError(client, error);
      }

      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      // Retirer l'utilisateur de la liste des connectés
      this.connectedUsers.delete(client.userId);

      this.logger.log(
        `🔌 Utilisateur ${client.username} (${client.userId}) déconnecté`
      );

      // Notifier les autres utilisateurs que cet utilisateur est hors ligne
      client.broadcast.emit("user_offline", {
        userId: client.userId,
        username: client.username,
      });
    }
  }

  @SubscribeMessage("send_message")
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto
  ) {
    try {
      if (!client.userId) {
        client.emit("error", { message: "Non authentifié" });
        return;
      }

      // Envoyer le message via le service
      const message = await this._messagingService.sendMessage(
        client.userId,
        data
      );

      // Envoyer le message au destinataire s'il est connecté
      const receiverSocketId = this.connectedUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.server.to(receiverSocketId).emit("new_message", message);
      }

      // Confirmer l'envoi à l'expéditeur
      client.emit("message_sent", message);

      this.logger.log(
        `📤 Message envoyé de ${client.userId} vers ${data.receiverId}`
      );
    } catch (error) {
      this.logger.error("❌ Erreur lors de l'envoi du message:", error);
      client.emit("error", { message: "Erreur lors de l'envoi du message" });
    }
  }

  @SubscribeMessage("join_conversation")
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    try {
      if (!client.userId) {
        client.emit("error", { message: "Non authentifié" });
        return;
      }

      // Joindre la room de la conversation
      client.join(`conversation_${data.conversationId}`);

      this.logger.log(
        `🏠 Utilisateur ${client.userId} a rejoint la conversation ${data.conversationId}`
      );
    } catch (error) {
      this.logger.error(
        "❌ Erreur lors de la jointure de conversation:",
        error
      );
      client.emit("error", {
        message: "Erreur lors de la jointure de conversation",
      });
    }
  }

  @SubscribeMessage("leave_conversation")
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    try {
      // Quitter la room de la conversation
      client.leave(`conversation_${data.conversationId}`);

      this.logger.log(
        `🚪 Utilisateur ${client.userId} a quitté la conversation ${data.conversationId}`
      );
    } catch (error) {
      this.logger.error("❌ Erreur lors de la sortie de conversation:", error);
    }
  }

  @SubscribeMessage("typing_start")
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    try {
      if (!client.userId) return;

      // Notifier les autres participants de la conversation que l'utilisateur tape
      client.to(`conversation_${data.conversationId}`).emit("user_typing", {
        userId: client.userId,
        username: client.username,
        conversationId: data.conversationId,
      });
    } catch (error) {
      this.logger.error("❌ Erreur lors de la notification de frappe:", error);
    }
  }

  @SubscribeMessage("typing_stop")
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    try {
      if (!client.userId) return;

      // Notifier les autres participants que l'utilisateur a arrêté de taper
      client
        .to(`conversation_${data.conversationId}`)
        .emit("user_stopped_typing", {
          userId: client.userId,
          username: client.username,
          conversationId: data.conversationId,
        });
    } catch (error) {
      this.logger.error(
        "❌ Erreur lors de la notification d'arrêt de frappe:",
        error
      );
    }
  }

  /**
   * Méthode pour extraire le token Bearer
   */
  private _extractTokenFromAuth(authorization?: string): string | null {
    if (authorization && authorization.startsWith("Bearer ")) {
      return authorization.substring(7);
    }
    return null;
  }

  /**
   * Méthode de debug pour les erreurs de token
   */
  private _debugTokenError(client: AuthenticatedSocket, error: any) {
    this.logger.debug("🔍 Debug WebSocket Authentication Error:");
    this.logger.debug(
      "Authorization header:",
      client.handshake.headers?.authorization
    );
    this.logger.debug("Query token:", client.handshake.query?.token);
    this.logger.debug("Auth token:", client.handshake.auth?.token);
    this.logger.debug(
      "JWT Secret configured:",
      !!this._configService.get<string>("JWT_SECRET")
    );
    this.logger.debug("Error details:", error.message);
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
}
