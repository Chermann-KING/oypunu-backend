import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityService } from '../services/activity.service';
import { ActivityFeed } from '../schemas/activity-feed.schema';
import { ILanguageRepository } from '../../repositories/interfaces/language.repository.interface';

type ActivitySocket = Socket & {
  userId?: string;
  username?: string;
};

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/activities',
})
export class ActivityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivityGateway.name);
  private connectedClients = new Set<string>(); // socketIds connectés

  constructor(
    private readonly activityService: ActivityService,
    @Inject('ILanguageRepository')
    private languageRepository: ILanguageRepository,
  ) {}

  async handleConnection(client: ActivitySocket) {
    try {
      this.connectedClients.add(client.id);
      this.logger.log(`Client connecté aux activités: ${client.id}`);

      // Envoyer les activités récentes au nouveau client
      const recentActivities =
        await this.activityService.getRecentActivities(10);
      client.emit('activities:recent', recentActivities);

      // Notifier le nombre de clients connectés
      this.server.emit('activities:clients_count', this.connectedClients.size);
    } catch (error) {
      this.logger.error('Erreur lors de la connexion:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: ActivitySocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client déconnecté des activités: ${client.id}`);

    // Notifier le nouveau nombre de clients
    this.server.emit('activities:clients_count', this.connectedClients.size);
  }

  @SubscribeMessage('activities:request_recent')
  async handleRequestRecent(
    @ConnectedSocket() client: ActivitySocket,
    @MessageBody() data: { limit?: number; prioritizeAfrican?: boolean },
  ) {
    try {
      const activities = await this.activityService.getRecentActivities(
        data.limit || 10,
        data.prioritizeAfrican !== false,
      );

      client.emit('activities:recent', activities);
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des activités:', error);
      client.emit('activities:error', {
        message: 'Erreur lors de la récupération des activités',
      });
    }
  }

  @SubscribeMessage('activities:request_by_type')
  async handleRequestByType(
    @ConnectedSocket() client: ActivitySocket,
    @MessageBody() data: { activityType: string; limit?: number },
  ) {
    try {
      const activities = await this.activityService.getActivitiesByType(
        data.activityType as any,
        data.limit || 5,
      );

      client.emit('activities:by_type', {
        activityType: data.activityType,
        activities,
      });
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des activités par type:',
        error,
      );
      client.emit('activities:error', {
        message: 'Erreur lors de la récupération des activités',
      });
    }
  }

  // Écouter les événements d'activité pour diffusion temps réel
  @OnEvent('activity.created')
  async handleActivityCreated(payload: {
    activity: ActivityFeed;
    userId: string;
  }) {
    try {
      const { activity } = payload;

      console.log('🔴 Diffusion nouvelle activité:', {
        type: activity.activityType,
        user: activity.username,
        clients: this.connectedClients.size,
      });

      // Diffuser la nouvelle activité à tous les clients connectés
      this.server.emit('activities:new', {
        activity: await this.formatActivityForFrontend(activity),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error("Erreur lors de la diffusion d'activité:", error);
    }
  }

  // Diffuser des statistiques d'activité
  @OnEvent('activity.stats_updated')
  async handleStatsUpdated(payload: any) {
    this.server.emit('activities:stats', payload);
  }

  // Formater l'activité pour le frontend
  private async formatActivityForFrontend(
    activity: ActivityFeed | any,
  ): Promise<any> {
    console.log('🔧 Formatage activité:', {
      type: activity.activityType,
      username: activity.username,
      metadata: activity.metadata,
    });

    const formatted: any = {
      id: activity._id || activity.id,
      userId: activity.userId,
      username: activity.username,
      activityType: activity.activityType,
      entityType: activity.entityType,
      entityId: activity.entityId,
      metadata: activity.metadata || {},
      languageRegion: activity.languageRegion,
      userRegion: activity.userRegion,
      createdAt: activity.createdAt,
      isPublic: activity.isPublic,
      timeAgo: this.getTimeAgo(activity.createdAt),
      message: '',
      flag: '',
    };

    // Générer le message d'activité localisé
    formatted.message = await this.generateActivityMessage(formatted);
    formatted.flag = activity.metadata?.languageFlag || '🌍';

    return formatted;
  }

  // Générer le message d'activité en français
  private async generateActivityMessage(activity: any): Promise<string> {
    const { activityType, metadata, username } = activity;

    switch (activityType) {
      case 'word_created':
        return `a ajouté "${metadata.wordName}"`;

      case 'translation_added':
        return `a traduit "${metadata.wordName}" vers ${await this.getLanguageName(metadata.targetLanguageCode)}`;

      case 'synonym_added':
        const count = metadata.synonymsCount || 1;
        return `a ajouté ${count} synonyme${count > 1 ? 's' : ''}`;

      case 'word_approved':
        return `a approuvé "${metadata.wordName}"`;

      case 'word_verified':
        return `a vérifié une traduction`;

      case 'community_post_created':
        return `a publié dans ${metadata.communityName}`;

      case 'user_registered':
        return `a rejoint O'Ypunu`;

      case 'user_logged_in':
        return `s'est connecté(e)`;

      case 'community_joined':
        return `a rejoint ${metadata.communityName}`;

      case 'community_created':
        return `a créé la communauté ${metadata.communityName}`;

      case 'comment_added':
        return `a commenté dans ${metadata.communityName}`;

      default:
        return 'a effectué une action';
    }
  }

  // Obtenir le nom de la langue depuis la base de données ou fallback
  private async getLanguageName(languageCode?: string): Promise<string> {
    if (!languageCode) return 'une langue';

    try {
      const language = await this.languageRepository.findByCode(languageCode);

      if (language) {
        return `le ${language.nativeName || language.name}`;
      }
    } catch (error) {
      console.error('Erreur lors de la recherche de langue:', error);
    }

    // Fallback vers les mappings statiques
    const nameMap: { [key: string]: string } = {
      // Langues africaines
      yo: 'le yorùbá',
      ha: "l'hausa",
      ig: "l'igbo",
      ff: 'le fulfulde',
      wo: 'le wolof',
      bm: 'le bambara',
      ln: 'le lingala',
      kg: 'le kikongo',
      sw: 'le kiswahili',
      rw: 'le kinyarwanda',
      zu: 'le zulu',
      xh: 'le xhosa',
      af: "l'afrikaans",
      ar: "l'arabe",
      ber: 'le berbère',
      am: "l'amharique",
      om: "l'oromo",
      so: 'le somali',
      mg: 'le malgache',

      // Autres langues
      fr: 'le français',
      en: "l'anglais",
      es: "l'espagnol",
      de: "l'allemand",
      it: "l'italien",
      pt: 'le portugais',
      ja: 'le japonais',
      ko: 'le coréen',
      zh: 'le chinois',
      hi: "l'hindi",
      ru: 'le russe',
    };

    return nameMap[languageCode] || 'une langue';
  }

  // Calculer le temps écoulé
  private getTimeAgo(createdAt: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(createdAt).getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInMinutes < 1) {
      return "à l'instant";
    } else if (diffInMinutes === 1) {
      return 'il y a 1 min';
    } else if (diffInMinutes < 60) {
      return `il y a ${diffInMinutes} min`;
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours === 1) {
        return 'il y a 1 heure';
      } else if (diffInHours < 24) {
        return `il y a ${diffInHours} heures`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
      }
    }
  }

  // Méthodes utilitaires pour les tests
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  async broadcastTestActivity(): Promise<void> {
    const testActivity = {
      id: 'test-' + Date.now(),
      username: 'TestUser',
      activityType: 'word_created',
      metadata: {
        wordName: 'test',
        languageCode: 'yo',
      },
      createdAt: new Date(),
      timeAgo: "à l'instant",
    };

    this.server.emit('activities:new', {
      activity: await this.formatActivityForFrontend(testActivity),
      timestamp: new Date().toISOString(),
    });
  }
}
