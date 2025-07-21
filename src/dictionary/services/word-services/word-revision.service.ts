import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word, WordDocument } from '../../schemas/word.schema';
import {
  RevisionHistory,
  RevisionHistoryDocument,
} from '../../schemas/revision-history.schema';
import { User, UserDocument, UserRole } from '../../../users/schemas/user.schema';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { WordNotificationService } from './word-notification.service';
import { DatabaseErrorHandler } from '../../../common/utils/database-error-handler.util';

/**
 * Interface pour un changement détecté lors d'une révision
 */
export interface ChangeLog {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'modified' | 'removed';
}

/**
 * Service spécialisé pour la gestion des révisions et du workflow d'approbation
 * PHASE 5 - Extraction responsabilités révision depuis WordsService
 */
@Injectable()
export class WordRevisionService {
  private readonly logger = new Logger(WordRevisionService.name);

  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(RevisionHistory.name)
    private revisionHistoryModel: Model<RevisionHistoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private wordNotificationService: WordNotificationService,
  ) {}

  /**
   * Crée une nouvelle révision lorsqu'un mot approuvé est modifié
   * Ligne 532-596 dans WordsService original
   */
  async createRevision(
    wordId: string,
    updateWordDto: UpdateWordDto,
    user: User,
  ): Promise<Word> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📝 Création révision pour mot:', wordId, 'par utilisateur:', user._id);

        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const existingWord = await this.wordModel.findById(wordId);
        if (!existingWord) {
          throw new NotFoundException('Mot non trouvé');
        }

        // Détecter les changements
        const changes = this.detectChanges(existingWord, updateWordDto);
        console.log(`🔍 ${changes.length} changements détectés:`, changes.map(c => c.field));

        if (changes.length === 0) {
          console.log('ℹ️ Aucun changement détecté, retour du mot existant');
          return existingWord;
        }

        // Créer l'historique de révision
        const revision = new this.revisionHistoryModel({
          wordId: existingWord._id,
          version: existingWord.version + 1,
          modifiedBy: user._id,
          modifiedAt: new Date(),
          changes: changes,
          previousVersion: existingWord.toObject(),
          newVersion: { ...existingWord.toObject(), ...updateWordDto },
          status: 'pending',
        });

        await revision.save();
        console.log('✅ Révision créée:', revision._id);

        // Mettre à jour le statut du mot
        const updatedWord = await this.wordModel
          .findByIdAndUpdate(
            wordId,
            { 
              status: 'pending_revision',
              version: existingWord.version + 1,
            },
            { new: true }
          )
          .populate('createdBy', 'username')
          .populate('categoryId', 'name')
          .exec();

        if (!updatedWord) {
          throw new NotFoundException('Mot non trouvé après mise à jour');
        }

        // Notifier les admins
        await this.notifyAdminsOfRevision(
          wordId,
          user._id.toString(),
          revision._id.toString(),
          changes,
        );

        console.log('✅ Révision créée avec succès et admins notifiés');
        return updatedWord;
      },
      'WordRevision',
      wordId,
      user._id?.toString(),
    );
  }

  /**
   * Approuve une révision et applique les changements
   * Ligne 698-756 dans WordsService original
   */
  async approveRevision(
    wordId: string,
    revisionId: string,
    adminUser: User,
    notes?: string,
  ): Promise<Word> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        console.log('✅ Approbation révision:', revisionId, 'par admin:', adminUser._id);

        if (
          !Types.ObjectId.isValid(wordId) ||
          !Types.ObjectId.isValid(revisionId)
        ) {
          throw new BadRequestException('ID invalide');
        }

        const revision = await this.revisionHistoryModel.findById(revisionId);
        if (!revision) {
          throw new NotFoundException('Révision non trouvée');
        }

        if (revision.wordId.toString() !== wordId) {
          throw new BadRequestException('Révision ne correspond pas au mot');
        }

        // Mettre à jour la révision
        revision.status = 'approved';
        revision.adminApprovedBy = adminUser._id as any;
        revision.adminApprovedAt = new Date();
        revision.adminNotes = notes;
        await revision.save();

        // Mettre à jour le mot avec la nouvelle version
        const updatedWord = await this.wordModel
          .findByIdAndUpdate(
            wordId,
            {
              ...(revision.newVersion as Partial<Word>),
              status: 'approved', // Retour au statut approuvé
              updatedAt: new Date(),
            },
            { new: true },
          )
          .populate('createdBy', 'username')
          .populate('categoryId', 'name')
          .exec();

        if (!updatedWord) {
          throw new NotFoundException(
            `Mot avec l'ID ${wordId} non trouvé après mise à jour`,
          );
        }

        // Notifier l'utilisateur qui a créé la révision
        await this.notifyUserOfRevisionApproval(
          revision.modifiedBy.toString(),
          wordId,
          revisionId,
          notes,
        );

        console.log('✅ Révision approuvée avec succès');
        return updatedWord;
      },
      'WordRevision',
      revisionId,
      adminUser._id?.toString(),
    );
  }

  /**
   * Rejette une révision avec une raison
   * Ligne 758-795 dans WordsService original
   */
  async rejectRevision(
    wordId: string,
    revisionId: string,
    adminUser: User,
    reason: string,
  ): Promise<void> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        console.log('❌ Rejet révision:', revisionId, 'par admin:', adminUser._id);

        if (
          !Types.ObjectId.isValid(wordId) ||
          !Types.ObjectId.isValid(revisionId)
        ) {
          throw new BadRequestException('ID invalide');
        }

        const revision = await this.revisionHistoryModel.findById(revisionId);
        if (!revision) {
          throw new NotFoundException('Révision non trouvée');
        }

        if (revision.wordId.toString() !== wordId) {
          throw new BadRequestException('Révision ne correspond pas au mot');
        }

        // Mettre à jour la révision
        revision.status = 'rejected';
        revision.adminApprovedBy = adminUser._id as any;
        revision.adminApprovedAt = new Date();
        revision.adminNotes = reason;
        await revision.save();

        // Remettre le mot en statut approuvé
        await this.wordModel.findByIdAndUpdate(wordId, {
          status: 'approved',
        });

        // Notifier l'utilisateur du rejet
        await this.notifyUserOfRevisionRejection(
          revision.modifiedBy.toString(),
          wordId,
          revisionId,
          reason,
        );

        console.log('✅ Révision rejetée avec succès');
      },
      'WordRevision',
      revisionId,
      adminUser._id?.toString(),
    );
  }

  /**
   * Récupère l'historique des révisions pour un mot
   * Ligne 685-696 dans WordsService original
   */
  async getRevisionHistory(wordId: string): Promise<RevisionHistory[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const revisions = await this.revisionHistoryModel
          .find({ wordId })
          .populate('modifiedBy', 'username email')
          .populate('adminApprovedBy', 'username email')
          .sort({ version: -1 })
          .exec();

        console.log(`📚 ${revisions.length} révisions trouvées pour le mot ${wordId}`);
        return revisions;
      },
      'WordRevision',
      wordId,
    );
  }

  /**
   * Récupère les révisions en attente avec pagination
   * Ligne 915-946 dans WordsService original
   */
  async getPendingRevisions(
    page = 1,
    limit = 10,
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const skip = (page - 1) * limit;

        const [revisions, total] = await Promise.all([
          this.revisionHistoryModel
            .find({ status: 'pending' })
            .populate('modifiedBy', 'username email')
            .populate({
              path: 'wordId',
              select: 'word language status',
            })
            .sort({ modifiedAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),

          this.revisionHistoryModel.countDocuments({ status: 'pending' }),
        ]);

        const totalPages = Math.ceil(total / limit);

        console.log(`📋 ${revisions.length}/${total} révisions en attente (page ${page}/${totalPages})`);

        return {
          revisions,
          total,
          page,
          limit,
          totalPages,
        };
      },
      'WordRevision',
      'pending-list',
    );
  }

  /**
   * Détecte les changements entre l'ancien mot et les nouvelles données
   * Ligne 598-647 dans WordsService original
   */
  private detectChanges(oldWord: Word, newData: UpdateWordDto): ChangeLog[] {
    const changes: ChangeLog[] = [];
    const fieldsToCheck = [
      'pronunciation',
      'etymology',
      'meanings', 
      'translations',
      'languageVariants',
      'audioFiles',
    ];

    for (const field of fieldsToCheck) {
      const oldValue = (oldWord as any)[field];
      const newValue = (newData as any)[field];

      // Ignorer si les deux valeurs sont undefined/null
      if (!oldValue && !newValue) continue;

      // Cas d'ajout
      if (!oldValue && newValue) {
        changes.push({
          field,
          oldValue: null,
          newValue,
          changeType: 'added',
        });
        continue;
      }

      // Cas de suppression
      if (oldValue && !newValue) {
        changes.push({
          field,
          oldValue,
          newValue: null,
          changeType: 'removed',
        });
        continue;
      }

      // Cas de modification - comparaison JSON pour les objets/arrays
      const oldSerialized = JSON.stringify(oldValue);
      const newSerialized = JSON.stringify(newValue);

      if (oldSerialized !== newSerialized) {
        changes.push({
          field,
          oldValue,
          newValue,
          changeType: 'modified',
        });
      }
    }

    return changes;
  }

  /**
   * Notifie les admins qu'une nouvelle révision est en attente
   * Ligne 649-683 dans WordsService original (utilise maintenant WordNotificationService)
   */
  private async notifyAdminsOfRevision(
    wordId: string,
    userId: string,
    revisionId: string,
    changes: ChangeLog[],
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📧 Notification des admins pour révision:', revisionId);

        // Utiliser le WordNotificationService pour la notification
        await this.wordNotificationService.notifyAdminsOfRevision(
          wordId,
          userId,
          revisionId,
          changes,
        );

        console.log('✅ Admins notifiés via WordNotificationService');
      },
      'WordRevision',
      revisionId,
    );
  }

  /**
   * Notifie l'utilisateur que sa révision a été approuvée
   * Ligne 811-831 dans WordsService original (utilise maintenant WordNotificationService)
   */
  private async notifyUserOfRevisionApproval(
    userId: string,
    wordId: string,
    revisionId: string,
    adminNotes?: string,
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📧 Notification utilisateur - révision approuvée:', userId);

        // Utiliser le WordNotificationService pour la notification
        await this.wordNotificationService.notifyUserOfRevisionApproval(
          userId,
          wordId,
          revisionId,
          adminNotes,
        );

        console.log('✅ Utilisateur notifié de l\'approbation via WordNotificationService');
      },
      'WordRevision',
      userId,
    );
  }

  /**
   * Notifie l'utilisateur que sa révision a été rejetée
   * Ligne 833-854 dans WordsService original (utilise maintenant WordNotificationService)
   */
  private async notifyUserOfRevisionRejection(
    userId: string,
    wordId: string,
    revisionId: string,
    reason: string,
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📧 Notification utilisateur - révision rejetée:', userId);

        // Utiliser le WordNotificationService pour la notification
        await this.wordNotificationService.notifyUserOfRevisionRejection(
          userId,
          wordId,
          revisionId,
          reason,
        );

        console.log('✅ Utilisateur notifié du rejet via WordNotificationService');
      },
      'WordRevision',
      userId,
    );
  }

  /**
   * Vérifie si un utilisateur peut créer une révision pour un mot
   */
  async canUserCreateRevision(word: WordDocument, user: User): Promise<boolean> {
    // Seuls les non-admins créent des révisions (les admins modifient directement)
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return false;
    }

    // Le mot doit être dans un statut qui permet les révisions
    const allowedStatuses = ['approved', 'pending_revision'];
    return allowedStatuses.includes(word.status);
  }

  /**
   * Statistiques des révisions pour le dashboard admin
   */
  async getRevisionStatistics(): Promise<{
    totalPending: number;
    totalApproved: number;
    totalRejected: number;
    averageApprovalTime: number; // en heures
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const [stats] = await this.revisionHistoryModel.aggregate([
          {
            $group: {
              _id: null,
              totalPending: {
                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
              },
              totalApproved: {
                $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
              },
              totalRejected: {
                $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
              },
              approvalTimes: {
                $push: {
                  $cond: [
                    { $ne: ['$adminApprovedAt', null] },
                    {
                      $divide: [
                        { $subtract: ['$adminApprovedAt', '$modifiedAt'] },
                        3600000, // Convertir en heures
                      ],
                    },
                    null,
                  ],
                },
              },
            },
          },
          {
            $project: {
              totalPending: 1,
              totalApproved: 1,
              totalRejected: 1,
              averageApprovalTime: {
                $avg: {
                  $filter: {
                    input: '$approvalTimes',
                    cond: { $ne: ['$$this', null] },
                  },
                },
              },
            },
          },
        ]);

        return {
          totalPending: stats?.totalPending || 0,
          totalApproved: stats?.totalApproved || 0,
          totalRejected: stats?.totalRejected || 0,
          averageApprovalTime: Math.round(stats?.averageApprovalTime || 0),
        };
      },
      'WordRevision',
      'statistics',
    );
  }
}