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
import { CreateWordDto } from '../dto/create-word.dto';
import { UpdateWordDto } from '../dto/update-word.dto';
import { SearchWordsDto } from '../dto/search-words.dto';
import { User, UserDocument, UserRole } from '../../users/schemas/user.schema';
import { CategoriesService } from '../services/categories.service';
import { UsersService } from '../../users/services/users.service';
import { AudioService } from './audio.service';

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

type AudioStats = {
  totalAudioFiles: number;
  languageStats: { language: string; count: number }[];
  allAccents: string[][];
};

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
    private categoriesService: CategoriesService,
    private usersService: UsersService,
    private audioService: AudioService,
  ) {}

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
    const existingWord = await this.wordModel.findOne({
      word: createWordDto.word,
      language: createWordDto.language,
    });

    if (existingWord) {
      throw new BadRequestException(
        `Le mot "${createWordDto.word}" existe déjà dans la langue ${createWordDto.language}`,
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

    if (wordData.categoryId && wordData.language) {
      try {
        const category = await this.categoriesService.findOne(
          wordData.categoryId,
        );
        if (!category || category.language !== wordData.language) {
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
      status: user.role === 'admin' ? 'approved' : 'pending',
    });

    const savedWord = await createdWord.save();

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
      console.log('🎙️ Étape 2: Ajout du fichier audio');

      try {
        // Déterminer l'accent par défaut basé sur la langue du mot
        const defaultAccent = this.getDefaultAccentForLanguage(
          updatedWord.language,
        );

        // Ajouter le fichier audio
        const wordWithAudio = await this.addAudioFile(
          id,
          defaultAccent,
          audioFile.buffer,
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
   */
  private getDefaultAccentForLanguage(language: string): string {
    const defaultAccents: Record<string, string> = {
      fr: 'fr-fr',
      en: 'en-us',
      es: 'es-es',
      de: 'de-de',
      it: 'it-it',
      pt: 'pt-br',
    };

    return defaultAccents[language] || 'standard';
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

  async addAudioFile(
    wordId: string,
    accent: string,
    fileBuffer: Buffer,
    user: User,
  ): Promise<Word> {
    console.log('🎵 === DEBUT addAudioFile ===');
    console.log('📋 Paramètres:', {
      wordId: wordId,
      accent: accent,
      bufferSize: fileBuffer.length,
      userId: user._id,
    });

    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    console.log('📝 Mot trouvé:', {
      word: word.word,
      language: word.language,
      existingAudioFiles: Object.keys(word.audioFiles || {}).length,
    });

    // Vérifier les permissions
    const canEdit = await this.canUserEditWord(wordId, user);
    if (!canEdit) {
      throw new BadRequestException(
        "Vous n'avez pas la permission d'ajouter un fichier audio à ce mot",
      );
    }

    try {
      console.log('🚀 Appel uploadPhoneticAudio...');

      // Essayer de détecter le type MIME à partir de la signature
      let detectedMimeType: string | undefined;
      const signature = fileBuffer.slice(0, 12).toString('hex').toLowerCase();

      if (
        signature.startsWith('fffb') ||
        signature.startsWith('fff3') ||
        signature.startsWith('494433')
      ) {
        detectedMimeType = 'audio/mpeg';
      } else if (signature.startsWith('52494646')) {
        detectedMimeType = 'audio/wav';
      } else if (signature.startsWith('4f676753')) {
        detectedMimeType = 'audio/ogg';
      } else if (signature.includes('667479704d344120')) {
        detectedMimeType = 'audio/mp4';
      } else if (signature.startsWith('1a45dfa3')) {
        detectedMimeType = 'audio/webm';
      }

      console.log('🔍 Type MIME détecté:', detectedMimeType || 'non déterminé');

      const uploadResult = await this.audioService.uploadPhoneticAudio(
        word.word,
        word.language,
        fileBuffer,
        accent,
        detectedMimeType, // Passer le type MIME détecté
      );

      console.log('✅ Upload Cloudinary réussi:', {
        url: uploadResult.url,
        cloudinaryId: uploadResult.cloudinaryId,
        duration: uploadResult.duration,
        fileSize: uploadResult.fileSize,
      });

      // Mettre à jour le mot avec le fichier audio
      if (!word.audioFiles) {
        word.audioFiles = new Map();
      }

      word.audioFiles.set(accent, {
        url: uploadResult.url,
        cloudinaryId: uploadResult.cloudinaryId,
        language: word.language,
        accent: accent,
      });

      word.markModified('audioFiles');
      const updatedWord = await word.save();

      console.log('💾 Mot mis à jour avec nouveau fichier audio');
      console.log('🎵 === FIN addAudioFile (SUCCÈS) ===');

      return updatedWord;
    } catch (error: unknown) {
      console.error('💥 Erreur dans addAudioFile:', {
        error: error instanceof Error ? error.message : error,
        wordId: wordId,
        accent: accent,
        bufferSize: fileBuffer.length,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(
          `Erreur lors de l'ajout du fichier audio: ${error.message}`,
        );
      }
      throw new BadRequestException(
        "Erreur inconnue lors de l'ajout du fichier audio",
      );
    }
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
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
      return true;
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      return false;
    }

    // L'utilisateur peut modifier s'il est le créateur et que le mot n'est pas rejeté
    return !!(
      word.createdBy &&
      typeof word.createdBy === 'object' &&
      '_id' in word.createdBy &&
      String(word.createdBy._id) === String(user._id) &&
      word.status !== 'rejected'
    );
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

  async getFeaturedWords(limit = 6): Promise<Word[]> {
    // Récupérer des mots avec des exemples riches et bien structurés
    return this.wordModel
      .find({
        status: 'approved',
        'meanings.definitions.examples': { $exists: true, $not: { $size: 0 } },
      })
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Récupérer les langues disponibles dans la base de données
  async getAvailableLanguages(): Promise<
    {
      code: string;
      name: string;
      nativeName: string;
      wordCount: number;
    }[]
  > {
    // Mapping des codes de langue vers les noms
    const languageMap: Record<string, { name: string; nativeName: string }> = {
      fr: { name: 'Français', nativeName: 'Français' },
      en: { name: 'Anglais', nativeName: 'English' },
      es: { name: 'Espagnol', nativeName: 'Español' },
      de: { name: 'Allemand', nativeName: 'Deutsch' },
      it: { name: 'Italien', nativeName: 'Italiano' },
      pt: { name: 'Portugais', nativeName: 'Português' },
      ru: { name: 'Russe', nativeName: 'Русский' },
      ja: { name: 'Japonais', nativeName: '日本語' },
      zh: { name: 'Chinois', nativeName: '中文' },
      da: { name: 'Danois', nativeName: 'Dansk' },
      nl: { name: 'Néerlandais', nativeName: 'Nederlands' },
      sv: { name: 'Suédois', nativeName: 'Svenska' },
      no: { name: 'Norvégien', nativeName: 'Norsk' },
      fi: { name: 'Finnois', nativeName: 'Suomi' },
      pl: { name: 'Polonais', nativeName: 'Polski' },
      ar: { name: 'Arabe', nativeName: 'العربية' },
      ko: { name: 'Coréen', nativeName: '한국어' },
      hi: { name: 'Hindi', nativeName: 'हिन्दी' },
    };

    // Récupérer les langues distinctes avec le nombre de mots approuvés
    const languageStats = await this.wordModel.aggregate([
      {
        $match: { status: 'approved' },
      },
      {
        $group: {
          _id: '$language',
          wordCount: { $sum: 1 },
        },
      },
      {
        $sort: { wordCount: -1 },
      },
    ]);

    // Formater les résultats
    return languageStats.map((stat: { _id: string; wordCount: number }) => ({
      code: stat._id,
      name: languageMap[stat._id]?.name || stat._id,
      nativeName: languageMap[stat._id]?.nativeName || stat._id,
      wordCount: stat.wordCount,
    }));
  }

  async addToFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    console.log('addToFavorites - wordId:', wordId);
    console.log('addToFavorites - userId:', userId);

    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    // Vérifier si userId est valide
    if (!userId || !Types.ObjectId.isValid(userId)) {
      console.error('UserId invalide ou non fourni:', userId);
      throw new BadRequestException('ID utilisateur invalide');
    }

    // Vérifier si le mot existe
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // Vérifier si le mot est déjà dans les favoris
    const existingFavorite = await this.favoriteWordModel.findOne({
      wordId,
      userId,
    });

    if (existingFavorite) {
      return { success: true }; // Déjà dans les favoris
    }

    // Ajouter aux favoris
    const newFavorite = new this.favoriteWordModel({
      wordId,
      userId,
      addedAt: new Date(),
    });

    await newFavorite.save();
    return { success: true };
  }

  async removeFromFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    // Supprimer des favoris
    const result = await this.favoriteWordModel.deleteOne({
      wordId,
      userId,
    });

    return { success: result.deletedCount > 0 };
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
    const skip = (page - 1) * limit;

    // Trouver tous les IDs des mots favoris de l'utilisateur
    const favorites = await this.favoriteWordModel
      .find({ userId })
      .skip(skip)
      .limit(limit)
      .sort({ addedAt: -1 })
      .exec();

    const wordIds = favorites.map((fav) => fav.wordId);
    const total = await this.favoriteWordModel.countDocuments({ userId });

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
    if (!Types.ObjectId.isValid(wordId)) {
      return false;
    }

    const favorite = await this.favoriteWordModel.findOne({
      wordId,
      userId,
    });

    return !!favorite;
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
      language: word.language,
      audioFiles,
    };
  }

  /**
   * Met à jour en masse les fichiers audio d'un mot
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
    // 1. Validation
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // 2. Vérifier les permissions
    const canEdit = await this.canUserEditWord(wordId, user);
    if (!canEdit) {
      throw new BadRequestException(
        "Vous n'avez pas le droit de modifier ce mot.",
      );
    }

    // 3. Traiter chaque mise à jour
    const results: string[] = [];
    const errors: string[] = [];

    for (const update of audioUpdates) {
      try {
        // Vérifier si le fichier existe déjà
        const existingAudio = word.audioFiles?.get(update.accent);

        if (existingAudio && !update.replaceExisting) {
          errors.push(`Audio pour l'accent '${update.accent}' existe déjà`);
          continue;
        }

        // Supprimer l'ancien fichier si nécessaire
        if (existingAudio && update.replaceExisting) {
          try {
            await this.audioService.deletePhoneticAudio(
              existingAudio.cloudinaryId,
            );
          } catch (deleteError) {
            console.warn(
              `Avertissement: Impossible de supprimer l'ancien fichier pour ${update.accent}:`,
              deleteError,
            );
          }
        }

        // Uploader le nouveau fichier
        const audioData = await this.audioService.uploadPhoneticAudio(
          word.word,
          word.language,
          update.audioBuffer,
          update.accent,
        );

        // Mettre à jour la map
        if (!word.audioFiles) {
          word.audioFiles = new Map();
        }

        word.audioFiles.set(update.accent, {
          url: audioData.url,
          cloudinaryId: audioData.cloudinaryId,
          language: word.language,
          accent: update.accent,
        });

        results.push(`Audio mis à jour pour l'accent '${update.accent}'`);
      } catch (error) {
        errors.push(
          `Erreur pour l'accent '${update.accent}': ${error instanceof Error ? error.message : ''}`,
        );
      }
    }

    // 4. Sauvegarder si au moins une mise à jour a réussi
    if (results.length > 0) {
      await word.save();
    }

    // 5. Retourner le résultat avec les erreurs éventuelles
    if (errors.length > 0) {
      console.warn('Erreurs lors de la mise à jour en masse:', errors);
      if (results.length === 0) {
        throw new BadRequestException(
          `Toutes les mises à jour ont échoué: ${errors.join(', ')}`,
        );
      }
    }

    return word;
  }

  /**
   * Génère une URL optimisée pour un fichier audio
   */
  async getOptimizedAudioUrl(
    wordId: string,
    accent: string,
    options: {
      quality?: 'auto:low' | 'auto:good' | 'auto:best';
      format?: 'mp3' | 'ogg' | 'webm';
      volume?: number; // -100 à 400
      speed?: number; // 0.5 à 2.0
    } = {},
  ): Promise<string> {
    // 1. Récupérer le mot
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // 2. Vérifier si le fichier audio existe
    if (!word.audioFiles || !word.audioFiles.has(accent)) {
      throw new NotFoundException(
        `Aucun fichier audio trouvé pour l'accent '${accent}'`,
      );
    }

    const audioInfo = word.audioFiles.get(accent);
    if (!audioInfo || !audioInfo.cloudinaryId) {
      throw new BadRequestException('Informations du fichier audio manquantes');
    }

    // 3. Générer l'URL optimisée
    let audioUrl: string;

    if (options.volume !== undefined || options.speed !== undefined) {
      // URL avec transformations
      audioUrl = this.audioService.getTransformedAudioUrl(
        audioInfo.cloudinaryId,
        {
          volume: options.volume,
          speed: options.speed,
        },
      );
    } else {
      // URL simple optimisée
      audioUrl = this.audioService.getAudioUrl(audioInfo.cloudinaryId, {
        quality: options.quality || 'auto:good',
        format: options.format || 'mp3',
      });
    }

    return audioUrl;
  }

  /**
   * Vérifie la validité des fichiers audio d'un mot
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
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    const issues: string[] = [];
    const audioFiles: Array<{
      accent: string;
      status: 'valid' | 'invalid' | 'missing';
      error?: string;
    }> = [];

    if (!word.audioFiles || word.audioFiles.size === 0) {
      issues.push('Aucun fichier audio pour ce mot');
      return {
        valid: false,
        issues,
        audioFiles,
      };
    }

    // Vérifier chaque fichier audio
    for (const [accent, audioInfo] of word.audioFiles) {
      try {
        // Vérifier la structure des données
        if (!audioInfo.cloudinaryId || !audioInfo.url) {
          audioFiles.push({
            accent,
            status: 'invalid',
            error: 'Données manquantes (cloudinaryId ou URL)',
          });
          issues.push(`Fichier ${accent}: données manquantes`);
          continue;
        }

        // Vérifier la validité de l'URL
        try {
          const response = await fetch(audioInfo.url, { method: 'HEAD' });
          if (!response.ok) {
            throw new Error(`Status ${response.status}`);
          }

          audioFiles.push({
            accent,
            status: 'valid',
          });
        } catch (urlError) {
          audioFiles.push({
            accent,
            status: 'invalid',
            error: `URL inaccessible: ${urlError instanceof Error ? urlError.message : ''}`,
          });
          issues.push(`Fichier ${accent}: URL inaccessible`);
        }
      } catch (error) {
        audioFiles.push({
          accent,
          status: 'invalid',
          error: error instanceof Error ? error.message : '',
        });
        issues.push(
          `Fichier ${accent}: ${error instanceof Error ? error.message : ''}`,
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      audioFiles,
    };
  }

  /**
   * Nettoie les fichiers audio orphelins (qui n'existent plus sur Cloudinary)
   */
  async cleanupOrphanedAudioFiles(wordId?: string): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    const filter = wordId ? { _id: new Types.ObjectId(wordId) } : {};
    const words = await this.wordModel.find(filter);

    let cleaned = 0;
    const errors: string[] = [];

    for (const word of words) {
      if (!word.audioFiles || word.audioFiles.size === 0) {
        continue;
      }

      const accentsToRemove: string[] = [];

      for (const [accent, audioInfo] of word.audioFiles) {
        try {
          // Vérifier si le fichier existe sur Cloudinary
          // const metadata = await this.audioService.getAudioMetadata();
          // (audioInfo n'est pas utilisé, donc on ne fait rien ici)
        } catch (error) {
          // En cas d'erreur, considérer comme orphelin
          accentsToRemove.push(accent);
          errors.push(
            `Erreur lors de la vérification de ${word.word}/${accent}: ${error instanceof Error ? error.message : ''}`,
          );
        }
      }

      // Supprimer les entrées orphelines
      for (const accent of accentsToRemove) {
        word.audioFiles.delete(accent);
        cleaned++;
      }

      // Sauvegarder si des modifications ont été apportées
      if (accentsToRemove.length > 0) {
        await word.save();
        console.log(
          `Nettoyé ${accentsToRemove.length} fichiers orphelins pour le mot: ${word.word}`,
        );
      }
    }

    return {
      cleaned,
      errors,
    };
  }

  /**
   * Obtient les statistiques des fichiers audio
   */
  async getAudioStatistics(): Promise<{
    totalWords: number;
    wordsWithAudio: number;
    totalAudioFiles: number;
    audioByLanguage: Record<string, number>;
    audioByAccent: Record<string, number>;
    averageAudioPerWord: number;
  }> {
    const totalWords = await this.wordModel.countDocuments();

    const wordsWithAudio = await this.wordModel.countDocuments({
      audioFiles: { $exists: true, $ne: {} },
    });

    // Agrégation pour obtenir les statistiques détaillées
    const audioStats = await this.wordModel.aggregate([
      { $match: { audioFiles: { $exists: true, $ne: {} } } },
      {
        $project: {
          language: 1,
          audioCount: { $size: { $objectToArray: '$audioFiles' } },
          audioAccents: {
            $map: {
              input: { $objectToArray: '$audioFiles' },
              as: 'audio',
              in: '$$audio.k',
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalAudioFiles: { $sum: '$audioCount' },
          languageStats: {
            $push: {
              language: '$language',
              count: '$audioCount',
            },
          },
          allAccents: { $push: '$audioAccents' },
        },
      },
    ]);

    const stats: AudioStats = (audioStats[0] as AudioStats) || {
      totalAudioFiles: 0,
      languageStats: [],
      allAccents: [],
    };

    // Traitement des statistiques par langue
    const audioByLanguage: Record<string, number> = {};
    for (const langStat of stats.languageStats) {
      audioByLanguage[langStat.language] =
        (audioByLanguage[langStat.language] || 0) + langStat.count;
    }

    // Traitement des statistiques par accent
    const audioByAccent: Record<string, number> = {};
    for (const accents of stats.allAccents) {
      for (const accent of accents) {
        audioByAccent[accent] = (audioByAccent[accent] || 0) + 1;
      }
    }

    return {
      totalWords,
      wordsWithAudio,
      totalAudioFiles: stats.totalAudioFiles,
      audioByLanguage,
      audioByAccent,
      averageAudioPerWord:
        wordsWithAudio > 0 ? stats.totalAudioFiles / wordsWithAudio : 0,
    };
  }
}
