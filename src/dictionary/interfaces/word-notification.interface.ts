import { User } from '../../users/schemas/user.schema';
import { Word } from '../schemas/word.schema';
import { RevisionHistory } from '../schemas/revision-history.schema';

/**
 * Interface pour la gestion centralisée des notifications liées aux mots
 * PHASE 1 - ÉTAPE 2 : Extraction responsabilités notifications
 */
export interface IWordNotificationService {
  /**
   * Notifie les administrateurs d'une nouvelle révision en attente
   */
  notifyAdminsOfNewRevision(
    word: Word,
    revision: RevisionHistory,
    user: User
  ): Promise<void>;

  /**
   * Notifie l'utilisateur de l'approbation de sa révision
   */
  notifyUserOfRevisionApproval(
    word: Word,
    revision: RevisionHistory,
    approvedBy: User
  ): Promise<void>;

  /**
   * Notifie l'utilisateur du rejet de sa révision
   */
  notifyUserOfRevisionRejection(
    word: Word,
    revision: RevisionHistory,
    rejectedBy: User,
    reason?: string
  ): Promise<void>;

  /**
   * Notifie les contributeurs d'un nouveau mot créé dans leur langue
   */
  notifyContributorsOfNewWord(word: Word, creator: User): Promise<void>;

  /**
   * Notifie l'utilisateur qu'un mot qu'il suit a été modifié
   */
  notifyUserOfWordUpdate(
    word: Word,
    updatedBy: User,
    followers: User[]
  ): Promise<void>;

  /**
   * Notifie les administrateurs d'un problème de contenu signalé
   */
  notifyAdminsOfContentReport(
    word: Word,
    reportedBy: User,
    reason: string
  ): Promise<void>;

  /**
   * Notifie l'utilisateur de l'ajout d'un fichier audio par un autre utilisateur
   */
  notifyUserOfAudioContribution(
    word: Word,
    audioContributor: User,
    wordOwner: User
  ): Promise<void>;

  /**
   * Crée une notification générale pour un utilisateur
   */
  createUserNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Marque une notification comme lue
   */
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;

  /**
   * Récupère les notifications non lues d'un utilisateur
   */
  getUserUnreadNotifications(userId: string): Promise<any[]>;
}