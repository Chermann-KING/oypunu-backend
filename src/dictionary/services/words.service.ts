import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word, WordDocument } from '../schemas/word.schema';
import {
  FavoriteWord,
  FavoriteWordDocument,
} from '../schemas/favorite-word.schema';
import {
  RevisionHistory,
  RevisionHistoryDocument,
} from '../schemas/revision-history.schema';
import {
  WordNotification,
  WordNotificationDocument,
} from '../schemas/word-notification.schema';
import {
  Language,
  LanguageDocument,
} from '../../languages/schemas/language.schema';
import { CreateWordDto } from '../dto/create-word.dto';
import { UpdateWordDto } from '../dto/update-word.dto';
import { SearchWordsDto } from '../dto/search-words.dto';
import { User, UserDocument, UserRole } from '../../users/schemas/user.schema';
import { CategoriesService } from '../services/categories.service';
import { UsersService } from '../../users/services/users.service';
import { AudioService } from './audio.service';
import { ActivityService } from '../../common/services/activity.service';
import {
  WordView,
  WordViewDocument,
} from '../../users/schemas/word-view.schema';
// PHASE 2 - Import WordAudioService
import { WordAudioService } from './word-services/word-audio.service';

interface WordFilter {
  status: string;
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
  language?: { $in: string[] };
  categoryId?: { $in: Types.ObjectId[] };
  'meanings.partOfSpeech'?: { $in: string[] };
}

interface ChangeLog {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'modified' | 'removed';
}


@Injectable()
export class WordsService {
  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(FavoriteWord.name)
    private favoriteWordModel: Model<FavoriteWordDocument>,
    @InjectModel(RevisionHistory.name)
    private revisionHistoryModel: Model<RevisionHistoryDocument>,
    @InjectModel(WordNotification.name)
    private wordNotificationModel: Model<WordNotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Language.name) private languageModel: Model<LanguageDocument>,
    @InjectModel(WordView.name) private wordViewModel: Model<WordViewDocument>,
    private categoriesService: CategoriesService,
    private usersService: UsersService,
    private audioService: AudioService,
    private activityService: ActivityService,
    // PHASE 2 - Injection WordAudioService
    private wordAudioService: WordAudioService,
  ) {}

  // Injecter les dépendances (ActivityService est optionnel pour éviter les erreurs circulaires)
  private get _activityService(): ActivityService | null {
    try {
      return this.activityService;
    } catch {
      return null;
    }
  }

  async create(
    createWordDto: CreateWordDto,
    user: { _id?: string; userId?: string; role: string },
  ): Promise<Word> {
    // Vérifier si l'utilisateur a soit _id soit userId
    if (!user?._id && !user?.userId) {
      throw new BadRequestException('Utilisateur invalide');
    }

    // Utiliser l'ID approprié selon ce qui est disponible
    const userIdLocal: string = user._id || user.userId || '';

    // Vérifier si le mot existe déjà dans la même langue
    // Utilise le nouveau languageId en priorité, sinon utilise l'ancien champ language pour compatibilité
    const languageFilter = createWordDto.languageId
      ? { languageId: createWordDto.languageId }
      : { language: createWordDto.language };

    const existingWord = await this.wordModel.findOne({
      word: createWordDto.word,
      ...languageFilter,
    });

    if (existingWord) {
      const languageRef = createWordDto.languageId || createWordDto.language;
      throw new BadRequestException(
        `Le mot "${createWordDto.word}" existe déjà dans cette langue`,
      );
    }

    // Créer une copie du DTO pour éviter de modifier l'objet original
    const wordData = { ...createWordDto };

    // Supprimer categoryId s'il est vide ou undefined
    if (
      !wordData.categoryId ||
      wordData.categoryId === '' ||
      wordData.categoryId === 'undefined'
    ) {
      delete wordData.categoryId;
    }

    if (wordData.categoryId && (wordData.languageId || wordData.language)) {
      try {
        const category = await this.categoriesService.findOne(
          wordData.categoryId,
        );
        // Vérifie la compatibilité de langue (nouveau système ou ancien)
        const languageMatches = wordData.languageId
          ? category.languageId?.toString() === wordData.languageId
          : category.language === wordData.language;

        if (!category || !languageMatches) {
          delete wordData.categoryId;
        }
      } catch {
        delete wordData.categoryId;
      }
    }

    // Créer le nouveau mot
    const createdWord = new this.wordModel({
      ...wordData,
      createdBy: Types.ObjectId.isValid(String(userIdLocal))
        ? new Types.ObjectId(String(userIdLocal))
        : new Types.ObjectId(),
      status: ['admin', 'superadmin'].includes(user.role)
        ? 'approved'
        : 'pending',
    });

    const savedWord = await createdWord.save();

    // 📊 Logger l'activité de création de mot
    try {
      console.log(
        "🔄 Début du logging d'activité pour:",
        savedWord.word,
        'Status:',
        savedWord.status,
      );
      const userDoc = await this.userModel
        .findById(userIdLocal)
        .select('username')
        .exec();
      console.log('👤 User trouvé:', userDoc?.username, 'UserID:', userIdLocal);

      if (userDoc && savedWord.status === 'approved') {
        console.log("🎯 Conditions remplies, création d'activité...");
        // Only log approved words to avoid spam from pending words
        await this.activityService.logWordCreated(
          userIdLocal,
          userDoc.username,
          String(savedWord._id),
          savedWord.word,
          savedWord.language || savedWord.languageId?.toString() || 'unknown',
        );
        console.log('✅ Activité "word_created" enregistrée');
      } else {
        console.log(
          '❌ Conditions non remplies - User:',
          !!userDoc,
          'Status:',
          savedWord.status,
        );
      }
    } catch (error) {
      console.error("❌ Erreur lors du logging d'activité:", error);
      // Ne pas faire échouer la création du mot si le logging échoue
    }

    // Créer les traductions bidirectionnelles si des traductions sont fournies
    if (wordData.translations && wordData.translations.length > 0) {
      try {
        await this.createBidirectionalTranslations(savedWord, userIdLocal);
      } catch (error) {
        console.error(
          'Erreur lors de la création des traductions bidirectionnelles:',
          error,
        );
        // Ne pas faire échouer la création du mot si les traductions bidirectionnelles échouent
      }
    }

    // Incrémenter le compteur de mots ajoutés pour l'utilisateur
    try {
      await this.usersService.incrementWordCount(userIdLocal);
    } catch (error) {
      console.error(
        "Erreur lors de l'incrémentation du compteur de mots:",
        error,
      );
      // Ne pas faire échouer la création du mot si l'incrémentation échoue
    }

    return savedWord;
  }

  /**
   * Crée des traductions bidirectionnelles pour un mot nouvellement créé
   */
  private async createBidirectionalTranslations(
    sourceWord: WordDocument,
    userId: string,
  ): Promise<void> {
    console.log(
      '🔄 Création de traductions bidirectionnelles pour:',
      sourceWord.word,
    );

    for (const translation of sourceWord.translations) {
      try {
        // Chercher le mot cible par nom dans la langue de traduction
        const targetWordFilter = translation.languageId
          ? {
              languageId: translation.languageId,
              word: translation.translatedWord,
            }
          : {
              language: translation.language,
              word: translation.translatedWord,
            };

        const targetWord = await this.wordModel.findOne(targetWordFilter);

        if (targetWord) {
          console.log(
            `✅ Mot cible trouvé: ${targetWord.word} (${translation.language || translation.languageId})`,
          );

          // Vérifier si la traduction inverse existe déjà
          const sourceLanguageId = sourceWord.languageId || null;
          const sourceLanguage = sourceWord.language || null;

          const reverseTranslationExists = targetWord.translations.some((t) => {
            // Vérifier par languageId ou par language selon ce qui est disponible
            const languageMatches = sourceLanguageId
              ? t.languageId?.toString() === sourceLanguageId.toString()
              : t.language === sourceLanguage;

            return languageMatches && t.translatedWord === sourceWord.word;
          });

          if (!reverseTranslationExists) {
            console.log(
              `➕ Ajout de la traduction inverse: ${targetWord.word} -> ${sourceWord.word}`,
            );

            // Créer la traduction inverse
            const reverseTranslation = {
              languageId: sourceLanguageId,
              language: sourceLanguage,
              translatedWord: sourceWord.word,
              context: translation.context || [],
              confidence: translation.confidence || 0.8,
              verifiedBy: [],
              targetWordId: sourceWord._id,
              createdBy: new Types.ObjectId(userId),
              validatedBy: null,
            };

            targetWord.translations.push(reverseTranslation as any);
            targetWord.translationCount = targetWord.translations.length;

            await targetWord.save();
            console.log(`✅ Traduction inverse sauvegardée`);
          } else {
            console.log(`ℹ️ Traduction inverse existe déjà`);
          }

          // Mettre à jour le targetWordId dans la traduction source
          const sourceTranslation = sourceWord.translations.find(
            (t) =>
              t.translatedWord === translation.translatedWord &&
              (t.languageId?.toString() ===
                translation.languageId?.toString() ||
                t.language === translation.language),
          );

          if (sourceTranslation && !sourceTranslation.targetWordId) {
            sourceTranslation.targetWordId = targetWord._id as any;
            await sourceWord.save();
            console.log(`🔗 Lien targetWordId mis à jour`);
          }
        } else {
          console.log(
            `⚠️ Mot cible non trouvé: ${translation.translatedWord} en ${translation.language || translation.languageId}`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Erreur lors du traitement de la traduction ${translation.translatedWord}:`,
          error,
        );
      }
    }

    // Mettre à jour le compteur de traductions du mot source
    sourceWord.translationCount = sourceWord.translations.length;
    await sourceWord.save();
  }

  async findAll(
    page = 1,
    limit = 10,
    status = 'approved',
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const total = await this.wordModel.countDocuments({ status });
    const words = await this.wordModel
      .find({ status })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    return {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Word> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel
      .findById(id)
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    return word;
  }

  /**
   * Track qu'un utilisateur a consulté un mot
   */
  async trackWordView(
    wordId: string,
    userId: string,
    viewType: 'search' | 'direct' | 'favorite' | 'recommendation' = 'direct',
  ): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(wordId) || !Types.ObjectId.isValid(userId)) {
        console.warn('IDs invalides pour le tracking:', { wordId, userId });
        return;
      }

      // Récupérer les informations du mot pour le cache
      const word = await this.wordModel
        .findById(wordId)
        .select('word language')
        .exec();
      if (!word) {
        console.warn('Mot non trouvé pour le tracking:', wordId);
        return;
      }

      // Chercher si une entrée existe déjà pour cet utilisateur et ce mot
      const existingView = await this.wordViewModel
        .findOne({
          userId,
          wordId,
        })
        .exec();

      if (existingView) {
        // Mettre à jour l'entrée existante
        await this.wordViewModel
          .findByIdAndUpdate(existingView._id, {
            $inc: { viewCount: 1 },
            lastViewedAt: new Date(),
            viewType, // Mettre à jour le type de vue
          })
          .exec();
      } else {
        // Créer une nouvelle entrée
        await this.wordViewModel.create({
          userId,
          wordId,
          word: word.word,
          language: word.language,
          viewedAt: new Date(),
          lastViewedAt: new Date(),
          viewType,
          viewCount: 1,
        });
      }

      console.log(`📊 Vue trackée: ${word.word} par utilisateur ${userId}`);
    } catch (error) {
      console.error('❌ Erreur lors du tracking de vue:', error);
      // Ne pas faire échouer la requête principale si le tracking échoue
    }
  }

  async update(
    id: string,
    updateWordDto: UpdateWordDto,
    user: User,
  ): Promise<Word> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);

    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    // Vérifier si l'utilisateur a le droit de modifier ce mot
    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPERADMIN &&
      word.createdBy &&
      typeof word.createdBy === 'object' &&
      '_id' in word.createdBy &&
      word.createdBy._id &&
      Types.ObjectId.isValid(String(word.createdBy._id)) &&
      Types.ObjectId.isValid(String(user._id)) &&
      String(word.createdBy._id) !== String(user._id)
    ) {
      throw new BadRequestException(
        "Vous n'avez pas le droit de modifier ce mot",
      );
    }

    // Si le statut du mot a été modifié et que l'utilisateur n'est pas admin
    if (
      updateWordDto.status &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPERADMIN
    ) {
      delete updateWordDto.status;
    }

    // Vérifier si le mot est approuvé et nécessite une révision
    const needsRevision =
      word.status === 'approved' &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPERADMIN;

    if (needsRevision || updateWordDto.forceRevision) {
      return this.createRevision(id, updateWordDto, user);
    }

    // Mise à jour directe pour les admins ou mots non approuvés
    const updatedWord = await this.wordModel
      .findByIdAndUpdate(id, updateWordDto, { new: true })
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    if (!updatedWord) {
      throw new NotFoundException(
        `Mot avec l'ID ${id} non trouvé après mise à jour`,
      );
    }

    return updatedWord;
  }

  /**
   * Met à jour un mot avec fichier audio en une seule opération
   * PHASE 2 - Délégation vers WordAudioService
   */
  async updateWithAudio(
    id: string,
    updateWordDto: UpdateWordDto,
    audioFile: Express.Multer.File,
    user: User,
  ): Promise<Word> {
    console.log('🎵 WordsService.updateWithAudio - Début');

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    console.log('📝 Étape 1: Mise à jour des données textuelles du mot');

    // Étape 1: Mettre à jour les données textuelles du mot
    const updatedWord = await this.update(id, updateWordDto, user);

    // Étape 2: Ajouter le fichier audio si présent
    if (audioFile && audioFile.buffer && audioFile.size > 0) {
      console.log('🎙️ Étape 2: Ajout du fichier audio via WordAudioService');

      try {
        // Déléguer vers WordAudioService
        const language = updatedWord.language || 'fr';
        const wordWithAudio = await this.wordAudioService.updateWordWithAudio(
          id,
          audioFile.buffer,
          language,
          user,
        );

        console.log('✅ Mise à jour avec audio terminée avec succès');
        return wordWithAudio;
      } catch (audioError) {
        console.error("❌ Erreur lors de l'ajout de l'audio:", audioError);

        // L'audio a échoué mais le mot a été mis à jour
        // On retourne le mot mis à jour avec un avertissement
        console.warn(
          "⚠️ Le mot a été mis à jour mais l'audio n'a pas pu être ajouté",
        );
        throw new BadRequestException(
          `Le mot a été mis à jour avec succès, mais l'ajout de l'audio a échoué: ${
            audioError instanceof Error
              ? audioError.message
              : String(audioError)
          }`,
        );
      }
    } else {
      console.log(
        '📝 Pas de fichier audio fourni, mise à jour textuelle uniquement',
      );
      return updatedWord;
    }
  }

  /**
   * Détermine l'accent par défaut basé sur la langue
   * PHASE 2 - Délégation vers WordAudioService
   */
  private getDefaultAccentForLanguage(language: string): string {
    return this.wordAudioService.getDefaultAccentForLanguage(language);
  }

  private async createRevision(
    wordId: string,
    updateWordDto: UpdateWordDto,
    user: User,
  ): Promise<Word> {
    const word = await this.wordModel.findById(wordId);

    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // Créer l'historique des changements
    const changes = this.detectChanges(word, updateWordDto);

    if (changes.length === 0) {
      throw new BadRequestException('Aucun changement détecté');
    }

    // Obtenir le numéro de version suivant
    const lastRevision = await this.revisionHistoryModel
      .findOne({ wordId })
      .sort({ version: -1 })
      .exec();

    const nextVersion = (lastRevision?.version || 0) + 1;

    // Créer la révision
    const revision = new this.revisionHistoryModel({
      wordId: new Types.ObjectId(wordId),
      version: nextVersion,
      previousVersion: word.toObject(),
      modifiedBy: new Types.ObjectId(user._id),
      modifiedAt: new Date(),
      changes,
      status: 'pending',
    });

    await revision.save();

    // Mettre à jour le statut du mot
    const updatedWord = await this.wordModel
      .findByIdAndUpdate(
        wordId,
        {
          ...updateWordDto,
          status: 'pending_revision',
          revisionNotes: updateWordDto.revisionNotes,
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

    // Notifier les admins
    await this.notifyAdminsOfRevision(wordId, user, changes);

    return updatedWord;
  }

  private detectChanges(oldWord: Word, newData: UpdateWordDto): ChangeLog[] {
    const changes: ChangeLog[] = [];

    // Fonction utilitaire pour comparer les valeurs
    const compareValues = (oldVal: unknown, newVal: unknown, field: string) => {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field,
          oldValue: oldVal,
          newValue: newVal,
          changeType:
            oldVal === undefined
              ? 'added'
              : newVal === undefined
                ? 'removed'
                : 'modified',
        });
      }
    };

    // Comparer chaque champ
    if (newData.pronunciation !== undefined) {
      compareValues(
        oldWord.pronunciation,
        newData.pronunciation,
        'pronunciation',
      );
    }
    if (newData.etymology !== undefined) {
      compareValues(oldWord.etymology, newData.etymology, 'etymology');
    }
    if (newData.meanings !== undefined) {
      compareValues(oldWord.meanings, newData.meanings, 'meanings');
    }
    if (newData.translations !== undefined) {
      compareValues(oldWord.translations, newData.translations, 'translations');
    }
    if (newData.languageVariants !== undefined) {
      compareValues(
        oldWord.languageVariants,
        newData.languageVariants,
        'languageVariants',
      );
    }
    if (newData.audioFiles !== undefined) {
      compareValues(oldWord.audioFiles, newData.audioFiles, 'audioFiles');
    }

    return changes;
  }

  private async notifyAdminsOfRevision(
    wordId: string,
    user: User,
    changes: ChangeLog[],
  ): Promise<void> {
    // Trouver tous les admins
    const admins = await this.userModel
      .find({
        role: { $in: ['admin', 'superadmin'] },
      })
      .exec();

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    const changeFields = changes.map((c) => c.field).join(', ');

    // Créer des notifications pour chaque admin
    const notifications = admins.map((admin) => ({
      type: 'word_revision' as const,
      wordId: new Types.ObjectId(wordId),
      targetUserId: new Types.ObjectId(admin._id),
      triggeredBy: new Types.ObjectId(user._id),
      message: `Le mot "${word.word}" a été modifié par ${user.username}. Champs modifiés: ${changeFields}`,
      metadata: {
        wordName: word.word,
        revisionVersion: 1, // Sera mis à jour
        changes: changes.map((c) => c.field),
      },
    }));

    await this.wordNotificationModel.insertMany(notifications);
  }

  async getRevisionHistory(wordId: string): Promise<RevisionHistory[]> {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    return this.revisionHistoryModel
      .find({ wordId: new Types.ObjectId(wordId) })
      .populate('modifiedBy', 'username')
      .populate('adminApprovedBy', 'username')
      .sort({ version: -1 })
      .exec();
  }

  async approveRevision(
    wordId: string,
    revisionId: string,
    adminUser: User,
    notes?: string,
  ): Promise<Word> {
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
    revision.adminApprovedBy = adminUser;
    revision.adminApprovedAt = new Date();
    revision.adminNotes = notes;
    await revision.save();

    // Mettre à jour le mot avec la nouvelle version
    const updatedWord = await this.wordModel
      .findByIdAndUpdate(
        wordId,
        {
          ...(revision.previousVersion as Partial<Word>),
          status: 'revision_approved',
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
      wordId,
      revision.modifiedBy as unknown as Types.ObjectId,
      adminUser,
    );

    return updatedWord;
  }

  async rejectRevision(
    wordId: string,
    revisionId: string,
    adminUser: User,
    reason: string,
  ): Promise<void> {
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

    // Mettre à jour la révision
    revision.status = 'rejected';
    revision.adminApprovedBy = adminUser;
    revision.adminApprovedAt = new Date();
    revision.rejectionReason = reason;
    await revision.save();

    // Remettre le mot en statut approuvé
    await this.wordModel.findByIdAndUpdate(wordId, {
      status: 'approved',
    });

    // Notifier l'utilisateur
    await this.notifyUserOfRevisionRejection(
      wordId,
      revision.modifiedBy as unknown as Types.ObjectId,
      adminUser,
      reason,
    );
  }

  /**
   * Ajoute un fichier audio à un mot
   * PHASE 2 - Délégation vers WordAudioService
   */
  async addAudioFile(
    wordId: string,
    accent: string,
    fileBuffer: Buffer,
    user: User,
  ): Promise<Word> {
    console.log('🎵 WordsService.addAudioFile - Délégation vers WordAudioService');
    return this.wordAudioService.addAudioFile(wordId, accent, fileBuffer, user);
  }

  private async notifyUserOfRevisionApproval(
    wordId: string,
    userId: Types.ObjectId,
    adminUser: User,
  ): Promise<void> {
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    await this.wordNotificationModel.create({
      type: 'revision_approved',
      wordId: new Types.ObjectId(wordId),
      targetUserId: userId,
      triggeredBy: new Types.ObjectId(adminUser._id),
      message: `Votre modification du mot "${word.word}" a été approuvée par ${adminUser.username}`,
      metadata: {
        wordName: word.word,
      },
    });
  }

  private async notifyUserOfRevisionRejection(
    wordId: string,
    userId: Types.ObjectId,
    adminUser: User,
    reason: string,
  ): Promise<void> {
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    await this.wordNotificationModel.create({
      type: 'revision_rejected',
      wordId: new Types.ObjectId(wordId),
      targetUserId: userId,
      triggeredBy: new Types.ObjectId(adminUser._id),
      message: `Votre modification du mot "${word.word}" a été rejetée par ${adminUser.username}. Raison: ${reason}`,
      metadata: {
        wordName: word.word,
      },
    });
  }

  async canUserEditWord(wordId: string, user: User): Promise<boolean> {
    console.log('=== DEBUG canUserEditWord ===');
    console.log('WordId:', wordId);
    console.log('User:', {
      _id: user._id,
      username: user.username,
      role: user.role,
    });

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
      console.log('✅ User is admin/superadmin, allowing edit');
      return true;
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      console.log('❌ Word not found');
      return false;
    }

    console.log('Word found:', {
      word: word.word,
      createdBy: word.createdBy,
      createdByType: typeof word.createdBy,
      status: word.status,
    });

    // L'utilisateur peut modifier s'il est le créateur et que le mot n'est pas rejeté
    if (!word.createdBy || word.status === 'rejected') {
      console.log('❌ No createdBy or word is rejected');
      return false;
    }

    // Gérer le cas où createdBy est un ObjectId (string) ou un objet User peuplé
    let createdByIdToCompare: string;
    if (typeof word.createdBy === 'object' && '_id' in word.createdBy) {
      // createdBy est un objet User peuplé
      createdByIdToCompare = String(word.createdBy._id);
      console.log('🔍 createdBy is User object, ID:', createdByIdToCompare);
    } else {
      // createdBy est juste un ObjectId (string)
      createdByIdToCompare = String(word.createdBy);
      console.log('🔍 createdBy is ObjectId string, ID:', createdByIdToCompare);
    }

    const userIdToCompare = String(user._id);
    console.log('🔍 Comparing IDs:', {
      createdByIdToCompare,
      userIdToCompare,
      areEqual: createdByIdToCompare === userIdToCompare,
    });

    const canEdit = createdByIdToCompare === userIdToCompare;
    console.log('✅ Can edit result:', canEdit);
    console.log('=== END DEBUG canUserEditWord ===');

    return canEdit;
  }

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
    const skip = (page - 1) * limit;

    const [revisions, total] = await Promise.all([
      this.revisionHistoryModel
        .find({ status: 'pending' })
        .populate('wordId')
        .populate('modifiedBy', 'username')
        .sort({ modifiedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.revisionHistoryModel.countDocuments({ status: 'pending' }),
    ]);

    return {
      revisions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async remove(id: string, user: User): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);

    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    // Vérifier si l'utilisateur a le droit de supprimer ce mot
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;

    // Fonction pour extraire et comparer les IDs de manière sûre
    const compareIds = (id1: any, id2: any): boolean => {
      return String(id1) === String(id2);
    };

    let isCreator = false;
    if (
      word.createdBy &&
      typeof word.createdBy === 'object' &&
      'id' in word.createdBy &&
      user._id
    ) {
      isCreator = compareIds(word.createdBy._id, user._id);
    }

    if (!isAdmin && !isCreator) {
      throw new BadRequestException(
        "Vous n'avez pas le droit de supprimer ce mot",
      );
    }

    await this.wordModel.findByIdAndDelete(id);
    // Supprimer également les favoris associés à ce mot
    await this.favoriteWordModel.deleteMany({ wordId: id });

    return { success: true };
  }

  async search(searchDto: SearchWordsDto): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      query,
      languages,
      categories,
      partsOfSpeech,
      page = 1,
      limit = 10,
    } = searchDto;
    const skip = (page - 1) * limit;

    // Construire les filtres de recherche
    const filter: WordFilter = {
      status: 'approved',
    };

    // Recherche par texte
    if (query && query.trim() !== '') {
      filter.$or = [
        { word: { $regex: query, $options: 'i' } },
        { 'meanings.definitions.definition': { $regex: query, $options: 'i' } },
      ];
    }

    // Filtrer par langue
    if (languages && languages.length > 0) {
      filter.language = { $in: languages };
    }

    // Filtrer par catégorie
    if (categories && categories.length > 0) {
      filter.categoryId = {
        $in: categories.map((id) => new Types.ObjectId(id)),
      };
    }

    // Filtrer par partie du discours
    if (partsOfSpeech && partsOfSpeech.length > 0) {
      filter['meanings.partOfSpeech'] = { $in: partsOfSpeech };
    }

    // Exécuter la requête
    const total = await this.wordModel.countDocuments(filter);
    const words = await this.wordModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    return {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeaturedWords(limit = 3): Promise<Word[]> {
    // Récupérer des mots aléatoires parmi ceux approuvés
    return this.wordModel
      .aggregate([
        { $match: { status: 'approved' } },
        { $sample: { size: limit } },
        {
          $lookup: {
            from: 'users',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [{ $project: { username: 1 } }],
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'categoryId',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        {
          $addFields: {
            createdBy: { $arrayElemAt: ['$createdBy', 0] },
            categoryId: { $arrayElemAt: ['$categoryId', 0] },
          },
        },
      ])
      .exec();
  }

  // Récupérer les langues disponibles dans la base de données
  async getAvailableLanguages(): Promise<
    {
      id: string;
      code: string;
      name: string;
      nativeName: string;
      wordCount: number;
    }[]
  > {
    console.log(
      '🔄 Récupération des langues depuis la collection Languages...',
    );

    // Récupérer les langues actives depuis la collection Languages
    const activeLanguages = await this.languageModel
      .find({
        systemStatus: 'active',
        isVisible: true,
      })
      .exec();

    console.log('📋 Langues actives trouvées:', activeLanguages.length);

    // Pour chaque langue active, compter les mots approuvés
    const languagesWithWordCount = await Promise.all(
      activeLanguages.map(async (language) => {
        // Compter les mots par languageId (nouveau système)
        const wordCountByLanguageId = await this.wordModel.countDocuments({
          status: 'approved',
          languageId: (language as any)._id,
        });

        // Compter les mots par ancien code language (système de transition)
        let wordCountByCode = 0;
        if (language.iso639_1) {
          wordCountByCode = await this.wordModel.countDocuments({
            status: 'approved',
            language: language.iso639_1,
          });
        }

        const totalWordCount = wordCountByLanguageId + wordCountByCode;

        console.log(
          `📊 Langue ${language.name}: ${totalWordCount} mots (${wordCountByLanguageId} par ID + ${wordCountByCode} par code)`,
        );

        return {
          id: (language as any)._id.toString(),
          code: language.iso639_1 || language.name.toLowerCase().slice(0, 2),
          name: language.name,
          nativeName: language.nativeName,
          wordCount: totalWordCount,
        };
      }),
    );

    // Trier par nombre de mots décroissant
    const sortedLanguages = languagesWithWordCount.sort(
      (a, b) => b.wordCount - a.wordCount,
    );

    console.log('✅ Langues disponibles formatées:', sortedLanguages.length);
    return sortedLanguages;
  }

  async addToFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    console.log('🔥 addToFavorites - wordId:', wordId);
    console.log('🔥 addToFavorites - userId:', userId);
    console.log('🔥 addToFavorites - userId type:', typeof userId);

    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    // Vérifier si userId est valide
    if (!userId || !Types.ObjectId.isValid(userId)) {
      console.error('UserId invalide ou non fourni:', userId);
      throw new BadRequestException('ID utilisateur invalide');
    }

    // Vérifier si le mot existe
    console.log('🔥 Vérification existence du mot...');
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      console.log('❌ Mot non trouvé:', wordId);
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }
    console.log('✅ Mot trouvé:', word.word);

    // Convertir les IDs en ObjectIds pour la requête MongoDB
    const wordObjectId = new Types.ObjectId(wordId);
    const userObjectId = new Types.ObjectId(userId);

    console.log(
      '🔥 ObjectIds convertis - wordObjectId:',
      wordObjectId,
      'userObjectId:',
      userObjectId,
    );

    // Vérifier si le mot est déjà dans les favoris
    console.log('🔥 Vérification favoris existants...');
    const existingFavorite = await this.favoriteWordModel.findOne({
      wordId: wordObjectId,
      userId: userObjectId,
    });

    if (existingFavorite) {
      console.log('✅ Mot déjà dans les favoris');
      return { success: true }; // Déjà dans les favoris
    }
    console.log('🔥 Mot pas encore dans les favoris, ajout en cours...');

    // Ajouter aux favoris
    const newFavorite = new this.favoriteWordModel({
      wordId: wordObjectId,
      userId: userObjectId,
      addedAt: new Date(),
    });

    console.log('🔥 Sauvegarde du favori...');
    try {
      await newFavorite.save();
      console.log('✅ Favori sauvegardé avec succès!');
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }

  async removeFromFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    console.log('🔥 removeFromFavorites - wordId:', wordId);
    console.log('🔥 removeFromFavorites - userId:', userId);
    console.log('🔥 removeFromFavorites - userId type:', typeof userId);

    try {
      if (!Types.ObjectId.isValid(wordId)) {
        console.error('❌ ID de mot invalide:', wordId);
        return { success: false };
      }

      // Vérifier si userId est valide
      if (!userId || !Types.ObjectId.isValid(userId)) {
        console.error('❌ UserId invalide ou non fourni:', userId);
        return { success: false };
      }

      // Convertir les IDs en ObjectIds pour la requête MongoDB
      const wordObjectId = new Types.ObjectId(wordId);
      const userObjectId = new Types.ObjectId(userId);

      console.log(
        '🔥 ObjectIds convertis - wordObjectId:',
        wordObjectId,
        'userObjectId:',
        userObjectId,
      );

      // Vérifier si le favori existe avant suppression
      console.log('🔥 Vérification existence du favori...');
      const existingFavorite = await this.favoriteWordModel.findOne({
        wordId: wordObjectId,
        userId: userObjectId,
      });

      if (!existingFavorite) {
        console.log('⚠️ Favori non trouvé, mais on retourne success:true');
        return { success: true }; // Pas dans les favoris, mais on considère ça comme un succès
      }

      console.log('✅ Favori trouvé, suppression en cours...');

      // Supprimer des favoris
      const result = await this.favoriteWordModel.deleteOne({
        wordId: wordObjectId,
        userId: userObjectId,
      });

      console.log('🔥 Résultat suppression:', result);
      console.log('🔥 Nombre supprimé:', result.deletedCount);

      const success = result.deletedCount > 0;
      console.log(
        success ? '✅ Suppression réussie!' : '❌ Échec de suppression',
      );

      return { success };
    } catch (error) {
      console.error('❌ Erreur dans removeFromFavorites:', error);
      return { success: false };
    }
  }

  async getFavoriteWords(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    console.log(
      '🔥 getFavoriteWords - userId:',
      userId,
      'page:',
      page,
      'limit:',
      limit,
    );
    const skip = (page - 1) * limit;

    // Trouver tous les IDs des mots favoris de l'utilisateur
    const favorites = await this.favoriteWordModel
      .find({ userId })
      .skip(skip)
      .limit(limit)
      .sort({ addedAt: -1 })
      .exec();

    console.log('🔥 Favoris trouvés en base:', favorites.length);
    console.log('🔥 Détails favoris:', favorites);

    const wordIds = favorites.map((fav) => fav.wordId);
    const total = await this.favoriteWordModel.countDocuments({ userId });

    console.log('🔥 Total favoris:', total);
    console.log('🔥 WordIds:', wordIds);

    // Si aucun favori, retourner un tableau vide
    if (wordIds.length === 0) {
      return {
        words: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Récupérer les mots correspondants
    const words = await this.wordModel
      .find({ _id: { $in: wordIds } })
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    // Fonction pour comparer les IDs MongoDB de manière sûre
    const compareIds = (id1: any, id2: any): boolean => {
      return String(id1) === String(id2);
    };

    // Réordonner les mots dans le même ordre que les favoris
    const orderedWords = [] as Word[];

    for (const id of wordIds) {
      let found = false;
      for (const word of words) {
        if (!found && word && word._id && compareIds(word._id, id)) {
          orderedWords.push(word as unknown as Word);
          found = true;
        }
      }
    }

    return {
      words: orderedWords,
      total,
      limit,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkIfFavorite(wordId: string, userId: string): Promise<boolean> {
    console.log(
      '🔥 Backend: checkIfFavorite - wordId:',
      wordId,
      'userId:',
      userId,
    );

    if (!Types.ObjectId.isValid(wordId)) {
      console.log('🔥 Backend: wordId invalide');
      return false;
    }

    // Vérifier si userId est valide
    if (!userId || !Types.ObjectId.isValid(userId)) {
      console.log('🔥 Backend: userId invalide ou non fourni:', userId);
      return false;
    }

    // Convertir les IDs en ObjectIds pour la requête MongoDB
    const wordObjectId = new Types.ObjectId(wordId);
    const userObjectId = new Types.ObjectId(userId);

    console.log(
      '🔥 ObjectIds convertis - wordObjectId:',
      wordObjectId,
      'userObjectId:',
      userObjectId,
    );

    const favorite = await this.favoriteWordModel.findOne({
      wordId: wordObjectId,
      userId: userObjectId,
    });

    const result = !!favorite;
    console.log('🔥 Backend: checkIfFavorite résultat:', result);
    return result;
  }

  async shareWordWithUser(
    wordId: string,
    fromUserId: string,
    toUsername: string,
  ): Promise<{ success: boolean; message: string }> {
    // Vérifier si le mot existe
    if (!Types.ObjectId.isValid(wordId)) {
      return { success: false, message: 'ID de mot invalide' };
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      return { success: false, message: `Mot avec l'ID ${wordId} non trouvé` };
    }

    // Trouver l'utilisateur de destination par son nom d'utilisateur
    const toUser = await this.userModel.findOne({ username: toUsername });
    if (!toUser) {
      return {
        success: false,
        message: `Utilisateur '${toUsername}' non trouvé`,
      };
    }

    // Vérifier si le mot est déjà dans les favoris de l'utilisateur de destination
    const existingFavorite = await this.favoriteWordModel.findOne({
      wordId,
      userId: toUser._id,
    });

    if (existingFavorite) {
      return {
        success: true,
        message: `Le mot est déjà dans les favoris de ${toUsername}`,
      };
    }

    // Ajouter aux favoris de l'utilisateur de destination
    const newFavorite = new this.favoriteWordModel({
      wordId,
      userId: toUser._id,
      addedAt: new Date(),
      sharedBy: fromUserId, // Optionnel: enregistrer qui a partagé le mot
    });

    await newFavorite.save();

    // TODO: Optionnel: Envoyer une notification à l'utilisateur de destination

    return {
      success: true,
      message: `Mot partagé avec succès avec ${toUsername}`,
    };
  }

  async getAdminPendingWords(
    page = 1,
    limit = 10,
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const total = await this.wordModel.countDocuments({ status: 'pending' });
    const words = await this.wordModel
      .find({ status: 'pending' })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .exec();

    return {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateWordStatus(
    id: string,
    status: 'approved' | 'rejected',
  ): Promise<Word> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    word.status = status;
    return word.save();
  }

  /**
   * Supprime un fichier audio pour un accent spécifique
   */
  async deleteAudioFile(
    wordId: string,
    accent: string,
    user: User,
  ): Promise<Word> {
    // 1. Validation des paramètres
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    if (!accent || accent.trim() === '') {
      throw new BadRequestException("L'accent est requis");
    }

    // 2. Récupérer le mot
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // 3. Vérifier les permissions
    const canEdit = await this.canUserEditWord(wordId, user);
    if (!canEdit) {
      throw new BadRequestException(
        "Vous n'avez pas le droit de modifier ce mot.",
      );
    }

    // 4. Vérifier si le fichier audio existe
    if (!word.audioFiles || !word.audioFiles.has(accent)) {
      throw new NotFoundException(
        `Aucun fichier audio trouvé pour l'accent '${accent}'`,
      );
    }

    // 5. Récupérer les informations du fichier à supprimer
    const audioFileInfo = word.audioFiles.get(accent);
    if (!audioFileInfo || !audioFileInfo.cloudinaryId) {
      throw new BadRequestException(
        `Informations du fichier audio manquantes pour l'accent '${accent}'`,
      );
    }

    try {
      // 6. Supprimer le fichier de Cloudinary
      await this.audioService.deletePhoneticAudio(audioFileInfo.cloudinaryId);

      // 7. Supprimer l'entrée de la Map
      word.audioFiles.delete(accent);

      // 8. Sauvegarder et retourner le mot mis à jour
      const updatedWord = await word.save();

      console.log(
        `✅ Fichier audio supprimé avec succès pour le mot ${wordId}, accent ${accent}`,
      );

      return updatedWord;
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier audio:`, error);
      throw new BadRequestException(
        `Erreur lors de la suppression du fichier audio: ${error instanceof Error ? error.message : ''}`,
      );
    }
  }

  /**
   * Récupère tous les fichiers audio d'un mot
   */
  async getWordAudioFiles(wordId: string): Promise<{
    wordId: string;
    word: string;
    language: string;
    audioFiles: Array<{
      accent: string;
      url: string;
      cloudinaryId: string;
      language: string;
    }>;
  }> {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    const audioFiles: Array<{
      accent: string;
      url: string;
      cloudinaryId: string;
      language: string;
    }> = [];

    if (word.audioFiles) {
      for (const [accent, audioInfo] of word.audioFiles) {
        audioFiles.push({
          accent,
          url: audioInfo.url,
          cloudinaryId: audioInfo.cloudinaryId,
          language: audioInfo.language,
        });
      }
    }

    return {
      wordId: (word._id as Types.ObjectId).toString(),
      word: word.word,
      language: word.language || 'fr', // Fallback vers français si undefined
      audioFiles,
    };
  }

  /**
   * Met à jour en masse les fichiers audio d'un mot
   * PHASE 2 - ÉTAPE 4 : Délégation vers WordAudioService
   */
  async bulkUpdateAudioFiles(
    wordId: string,
    audioUpdates: Array<{
      accent: string;
      audioBuffer: Buffer;
      replaceExisting?: boolean;
    }>,
    user: User,
  ): Promise<Word> {
    // Adapter les données vers le format WordAudioService
    const adaptedUpdates = audioUpdates.map(update => ({
      accent: update.accent,
      fileBuffer: update.audioBuffer,
      action: update.replaceExisting ? 'update' as const : 'add' as const,
    }));

    console.log('🎵 WordsService.bulkUpdateAudioFiles - Délégation vers WordAudioService');
    return this.wordAudioService.bulkUpdateAudioFiles(wordId, adaptedUpdates, user);
  }

  /**
   * Génère une URL optimisée pour un fichier audio
   * PHASE 2 - ÉTAPE 4 : Délégation vers WordAudioService
   */
  async getOptimizedAudioUrl(
    wordId: string,
    accent: string,
    options: {
      quality?: 'auto:low' | 'auto:good' | 'auto:best';
      format?: 'mp3' | 'ogg' | 'webm';
      volume?: number;
      speed?: number;
    } = {},
  ): Promise<string> {
    // Adapter les options vers le format WordAudioService
    const adaptedOptions = {
      quality: options.quality?.replace('auto:', '') as 'auto' | 'good' | 'best' || 'auto',
      format: options.format || 'mp3',
    };

    console.log('🎵 WordsService.getOptimizedAudioUrl - Délégation vers WordAudioService');
    const result = await this.wordAudioService.getOptimizedAudioUrl(wordId, accent, adaptedOptions);
    return result.optimizedUrl;
  }

  /**
   * Vérifie la validité des fichiers audio d'un mot
   * PHASE 2 - ÉTAPE 4 : Délégation vers WordAudioService
   */
  async validateWordAudioFiles(wordId: string): Promise<{
    valid: boolean;
    issues: string[];
    audioFiles: Array<{
      accent: string;
      status: 'valid' | 'invalid' | 'missing';
      error?: string;
    }>;
  }> {
    console.log('🎵 WordsService.validateWordAudioFiles - Délégation vers WordAudioService');
    const result = await this.wordAudioService.validateWordAudioFiles(wordId);
    
    // Adapter la réponse vers le format attendu par WordsService
    const audioFiles = result.invalidFiles.map(invalid => ({
      accent: invalid.accent,
      status: 'invalid' as const,
      error: invalid.issues.join(', '),
    }));
    
    // Ajouter les fichiers valides
    const totalFiles = result.totalFiles;
    const invalidCount = result.invalidFiles.length;
    const validCount = totalFiles - invalidCount;
    
    for (let i = 0; i < validCount; i++) {
      audioFiles.push({
        accent: `valid-${i}`, // Placeholder car WordAudioService ne retourne pas les détails des valides
        status: 'valid' as const,
      });
    }

    return {
      valid: result.invalidFiles.length === 0,
      issues: result.recommendations,
      audioFiles,
    };
  }

  /**
   * Nettoie les fichiers audio orphelins (qui n'existent plus sur Cloudinary)
   */
  // PHASE 2 - DÉLÉGATION: Nettoyage des fichiers audio orphelins
  async cleanupOrphanedAudioFiles(wordId?: string): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    return this.wordAudioService.cleanupOrphanedAudioFiles(wordId);
  }

  // PHASE 2 - DÉLÉGATION: Statistiques des fichiers audio
  async getAudioStatistics(): Promise<{
    totalWords: number;
    wordsWithAudio: number;
    totalAudioFiles: number;
    audioByLanguage: Record<string, number>;
    audioByAccent: Record<string, number>;
    averageAudioPerWord: number;
  }> {
    return this.wordAudioService.getAudioStatistics();
  }

  /**
   * Récupère toutes les traductions d'un mot (directes + inverses)
   */
  async getAllTranslations(wordId: string): Promise<{
    directTranslations: any[];
    reverseTranslations: any[];
    allTranslations: any[];
  }> {
    console.log(
      '🔍 Récupération de toutes les traductions pour le mot:',
      wordId,
    );

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException('Mot non trouvé');
    }

    // 1. Traductions directes (stockées dans le mot)
    const directTranslations = word.translations.map((translation) => ({
      id:
        (translation as any)._id ||
        `${(word as any)._id}_${translation.translatedWord}`,
      sourceWord: word.word,
      sourceLanguageId: word.languageId,
      sourceLanguage: word.language,
      targetWord: translation.translatedWord,
      targetLanguageId: translation.languageId,
      targetLanguage: translation.language,
      context: translation.context,
      confidence: translation.confidence,
      verifiedBy: translation.verifiedBy,
      targetWordId: translation.targetWordId,
      direction: 'direct' as const,
    }));

    // 2. Traductions inverses (chercher dans les autres mots qui nous référencent)
    const reverseTranslationsQuery = word.languageId
      ? {
          'translations.targetWordId': (word as any)._id,
          $or: [
            { 'translations.languageId': word.languageId },
            { 'translations.language': word.language },
          ],
        }
      : {
          'translations.targetWordId': (word as any)._id,
          'translations.language': word.language,
        };

    const wordsWithReverseTranslations = await this.wordModel.find(
      reverseTranslationsQuery,
    );

    const reverseTranslations: any[] = [];
    for (const sourceWord of wordsWithReverseTranslations) {
      const relevantTranslations = sourceWord.translations.filter(
        (t) =>
          t.targetWordId?.toString() === (word as any)._id.toString() &&
          t.translatedWord === word.word,
      );

      for (const translation of relevantTranslations) {
        reverseTranslations.push({
          id:
            (translation as any)._id ||
            `${(sourceWord as any)._id}_${translation.translatedWord}`,
          sourceWord: sourceWord.word,
          sourceLanguageId: sourceWord.languageId,
          sourceLanguage: sourceWord.language,
          targetWord: word.word,
          targetLanguageId: word.languageId,
          targetLanguage: word.language,
          context: translation.context,
          confidence: translation.confidence,
          verifiedBy: translation.verifiedBy,
          targetWordId: word._id,
          direction: 'reverse' as const,
        });
      }
    }

    // 3. Combiner toutes les traductions
    const allTranslations = [...directTranslations, ...reverseTranslations];

    console.log(
      `📊 Trouvé ${directTranslations.length} traductions directes et ${reverseTranslations.length} traductions inverses`,
    );

    return {
      directTranslations,
      reverseTranslations,
      allTranslations,
    };
  }

  // Méthodes pour les statistiques en temps réel
  async getApprovedWordsCount(): Promise<number> {
    return this.wordModel
      .countDocuments({
        status: 'approved',
      })
      .exec();
  }

  async getWordsAddedToday(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setDate(today.getDate() + 1);

    return this.wordModel
      .countDocuments({
        status: 'approved',
        createdAt: {
          $gte: today,
          $lt: todayEnd,
        },
      })
      .exec();
  }

  async getWordsStatistics(): Promise<{
    totalApprovedWords: number;
    wordsAddedToday: number;
    wordsAddedThisWeek: number;
    wordsAddedThisMonth: number;
  }> {
    const now = new Date();

    // Aujourd'hui
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayStart.getDate() + 1);

    // Cette semaine (lundi à aujourd'hui)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // dimanche = 0, lundi = 1
    weekStart.setDate(weekStart.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);

    // Ce mois
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalApprovedWords,
      wordsAddedToday,
      wordsAddedThisWeek,
      wordsAddedThisMonth,
    ] = await Promise.all([
      this.wordModel.countDocuments({ status: 'approved' }).exec(),
      this.wordModel
        .countDocuments({
          status: 'approved',
          createdAt: { $gte: todayStart, $lt: todayEnd },
        })
        .exec(),
      this.wordModel
        .countDocuments({
          status: 'approved',
          createdAt: { $gte: weekStart },
        })
        .exec(),
      this.wordModel
        .countDocuments({
          status: 'approved',
          createdAt: { $gte: monthStart },
        })
        .exec(),
    ]);

    console.log('📊 Statistiques des mots:', {
      totalApprovedWords,
      wordsAddedToday,
      wordsAddedThisWeek,
      wordsAddedThisMonth,
    });

    return {
      totalApprovedWords,
      wordsAddedToday,
      wordsAddedThisWeek,
      wordsAddedThisMonth,
    };
  }
}
