import { WordNotification } from '../../dictionary/schemas/word-notification.schema';

export interface IWordNotificationRepository {
  create(notification: Partial<WordNotification>): Promise<WordNotification>;
  findById(id: string): Promise<WordNotification | null>;
  findByUserId(userId: string, options?: {
    limit?: number;
    offset?: number;
    includeRead?: boolean;
    type?: string;
  }): Promise<WordNotification[]>;
  findByWordId(wordId: string, options?: {
    limit?: number;
    type?: string;
  }): Promise<WordNotification[]>;
  findUnreadByUserId(userId: string, limit?: number): Promise<WordNotification[]>;
  markAsRead(id: string): Promise<WordNotification | null>;
  markAllAsReadByUserId(userId: string): Promise<number>;
  deleteById(id: string): Promise<boolean>;
  deleteOldNotifications(olderThanDays: number): Promise<number>;
  countUnreadByUserId(userId: string): Promise<number>;
  findByType(type: string, options?: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WordNotification[]>;
}