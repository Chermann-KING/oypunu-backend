import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Word, WordDocument } from "../schemas/word.schema";
import {
  FavoriteWord,
  FavoriteWordDocument,
} from "../schemas/favorite-word.schema";
import {
  RevisionHistory,
  RevisionHistoryDocument,
} from "../schemas/revision-history.schema";
import {
  WordNotification,
  WordNotificationDocument,
} from "../schemas/word-notification.schema";
import {
  Language,
  LanguageDocument,
} from "../../languages/schemas/language.schema";
import { CreateWordDto } from "../dto/create-word.dto";
import { UpdateWordDto } from "../dto/update-word.dto";
import { SearchWordsDto } from "../dto/search-words.dto";
import { User, UserDocument, UserRole } from "../../users/schemas/user.schema";
import { CategoriesService } from "../services/categories.service";
import { UsersService } from "../../users/services/users.service";
import { AudioService } from "./audio.service";
import { ActivityService } from "../../common/services/activity.service";
import {
  WordView,
  WordViewDocument,
} from "../../users/schemas/word-view.schema";
// PHASE 2-7 - Import services spécialisés
import { WordAudioService } from "./word-services/word-audio.service";
import { WordFavoriteService } from "./word-services/word-favorite.service";
import { WordAnalyticsService } from "./word-services/word-analytics.service";
import { WordRevisionService } from "./word-services/word-revision.service";
import { WordTranslationService } from "./word-services/word-translation.service";
import { WordCoreService } from "./word-services/word-core.service";

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
    // PHASE 2-7 - Injection services spécialisés
    private wordAudioService: WordAudioService,
    private wordFavoriteService: WordFavoriteService,
    private wordAnalyticsService: WordAnalyticsService,
    private wordRevisionService: WordRevisionService,
    private wordTranslationService: WordTranslationService,
    private wordCoreService: WordCoreService
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
    user: { _id?: string; userId?: string; role: string }
  ): Promise<Word> {
    // Vérifier si l'utilisateur a soit _id soit userId
    if (!user?._id && !user?.userId) {
      throw new BadRequestException("Utilisateur invalide");
    }

    // Utiliser l'ID approprié selon ce qui est disponible
    const userIdLocal: string = user._id || user.userId || "";

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
        `Le mot "${createWordDto.word}" existe déjà dans cette langue`
      );
    }

    // Créer une copie du DTO pour éviter de modifier l'objet original
    const wordData = { ...createWordDto };

    // Supprimer categoryId s'il est vide ou undefined
    if (
      !wordData.categoryId ||
      wordData.categoryId === "" ||
      wordData.categoryId === "undefined"
    ) {
      delete wordData.categoryId;
    }

    if (wordData.categoryId && (wordData.languageId || wordData.language)) {
      try {
        const category = await this.categoriesService.findOne(
          wordData.categoryId
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
      status: ["admin", "superadmin"].includes(user.role)
        ? "approved"
        : "pending",
    });

    const savedWord = await createdWord.save();

    // 📊 Logger l'activité de création de mot
    try {
      console.log(
        "🔄 Début du logging d'activité pour:",
        savedWord.word,
        "Status:",
        savedWord.status
      );
      const userDoc = await this.userModel
        .findById(userIdLocal)
        .select("username")
        .exec();
      console.log("👤 User trouvé:", userDoc?.username, "UserID:", userIdLocal);

      if (userDoc && savedWord.status === "approved") {
        console.log("🎯 Conditions remplies, création d'activité...");
        // Only log approved words to avoid spam from pending words
        await this.activityService.logWordCreated(
          userIdLocal,
          userDoc.username,
          String(savedWord._id),
          savedWord.word,
          savedWord.language || savedWord.languageId?.toString() || "unknown"
        );
        console.log('✅ Activité "word_created" enregistrée');
      } else {
        console.log(
          "❌ Conditions non remplies - User:",
          !!userDoc,
          "Status:",
          savedWord.status
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
          "Erreur lors de la création des traductions bidirectionnelles:",
          error
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
        error
      );
      // Ne pas faire échouer la création du mot si l'incrémentation échoue
    }

    return savedWord;
  }

  /**
   * Crée des traductions bidirectionnelles pour un mot nouvellement créé
   * PHASE 6B - DÉLÉGATION: Délégation vers WordTranslationService
   */
  private async createBidirectionalTranslations(
    sourceWord: WordDocument,
    userId: string
  ): Promise<void> {
    console.log(
      "🔄 WordsService.createBidirectionalTranslations - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.createBidirectionalTranslations(
      sourceWord,
      userId
    );
  }

  async findAll(
    page = 1,
    limit = 10,
    status = "approved"
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
      .populate("createdBy", "username")
      .populate("categoryId", "name")
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

  /**
   * Récupère un mot par ID
   * PHASE 7B - DÉLÉGATION: Délégation vers WordCoreService
   */
  async findOne(id: string): Promise<Word> {
    console.log("🎭 WordsService.findOne - Délégation vers WordCoreService");
    return this.wordCoreService.findOne(id);
  }

  // PHASE 4 - DÉLÉGATION: Enregistrer une vue sur un mot
  async trackWordView(
    wordId: string,
    userId: string,
    viewType: "search" | "detail" | "favorite" = "detail"
  ): Promise<void> {
    console.log(
      "📊 WordsService.trackWordView - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.trackWordView(wordId, userId, viewType);
  }

  /**
   * Met à jour un mot existant
   * PHASE 7B - DÉLÉGATION: Délégation vers WordCoreService
   */
  async update(
    id: string,
    updateWordDto: UpdateWordDto,
    user: User
  ): Promise<Word> {
    console.log("🎭 WordsService.update - Délégation vers WordCoreService");
    return this.wordCoreService.update(id, updateWordDto, user);
  }

  /**
   * Met à jour un mot avec fichier audio en une seule opération
   * PHASE 2 - Délégation vers WordAudioService
   */
  async updateWithAudio(
    id: string,
    updateWordDto: UpdateWordDto,
    audioFile: Express.Multer.File,
    user: User
  ): Promise<Word> {
    console.log("🎵 WordsService.updateWithAudio - Début");

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("ID de mot invalide");
    }

    const word = await this.wordModel.findById(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    console.log("📝 Étape 1: Mise à jour des données textuelles du mot");

    // Étape 1: Mettre à jour les données textuelles du mot
    const updatedWord = await this.update(id, updateWordDto, user);

    // Étape 2: Ajouter le fichier audio si présent
    if (audioFile && audioFile.buffer && audioFile.size > 0) {
      console.log("🎙️ Étape 2: Ajout du fichier audio via WordAudioService");

      try {
        // Déléguer vers WordAudioService
        const language = updatedWord.language || "fr";
        const wordWithAudio = await this.wordAudioService.updateWordWithAudio(
          id,
          audioFile.buffer,
          language,
          user
        );

        console.log("✅ Mise à jour avec audio terminée avec succès");
        return wordWithAudio;
      } catch (audioError) {
        console.error("❌ Erreur lors de l'ajout de l'audio:", audioError);

        // L'audio a échoué mais le mot a été mis à jour
        // On retourne le mot mis à jour avec un avertissement
        console.warn(
          "⚠️ Le mot a été mis à jour mais l'audio n'a pas pu être ajouté"
        );
        throw new BadRequestException(
          `Le mot a été mis à jour avec succès, mais l'ajout de l'audio a échoué: ${
            audioError instanceof Error
              ? audioError.message
              : String(audioError)
          }`
        );
      }
    } else {
      console.log(
        "📝 Pas de fichier audio fourni, mise à jour textuelle uniquement"
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

  // PHASE 5 - DÉLÉGATION: Récupérer l'historique des révisions
  async getRevisionHistory(wordId: string): Promise<RevisionHistory[]> {
    console.log(
      "📝 WordsService.getRevisionHistory - Délégation vers WordRevisionService"
    );
    return this.wordRevisionService.getRevisionHistory(wordId);
  }

  // PHASE 5 - DÉLÉGATION: Approuver une révision
  async approveRevision(
    wordId: string,
    revisionId: string,
    adminUser: User,
    notes?: string
  ): Promise<Word> {
    console.log(
      "📝 WordsService.approveRevision - Délégation vers WordRevisionService"
    );
    return this.wordRevisionService.approveRevision(
      wordId,
      revisionId,
      adminUser,
      notes
    );
  }

  // PHASE 5 - DÉLÉGATION: Rejeter une révision
  async rejectRevision(
    wordId: string,
    revisionId: string,
    adminUser: User,
    reason: string
  ): Promise<void> {
    console.log(
      "📝 WordsService.rejectRevision - Délégation vers WordRevisionService"
    );
    return this.wordRevisionService.rejectRevision(
      wordId,
      revisionId,
      adminUser,
      reason
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
    user: User
  ): Promise<Word> {
    console.log(
      "🎵 WordsService.addAudioFile - Délégation vers WordAudioService"
    );
    return this.wordAudioService.addAudioFile(wordId, accent, fileBuffer, user);
  }

  async canUserEditWord(wordId: string, user: User): Promise<boolean> {
    console.log("=== DEBUG canUserEditWord ===");
    console.log("WordId:", wordId);
    console.log("User:", {
      _id: user._id,
      username: user.username,
      role: user.role,
    });

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN) {
      console.log("✅ User is admin/superadmin, allowing edit");
      return true;
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      console.log("❌ Word not found");
      return false;
    }

    console.log("Word found:", {
      word: word.word,
      createdBy: word.createdBy,
      createdByType: typeof word.createdBy,
      status: word.status,
    });

    // L'utilisateur peut modifier s'il est le créateur et que le mot n'est pas rejeté
    if (!word.createdBy || word.status === "rejected") {
      console.log("❌ No createdBy or word is rejected");
      return false;
    }

    // Gérer le cas où createdBy est un ObjectId (string) ou un objet User peuplé
    let createdByIdToCompare: string;
    if (typeof word.createdBy === "object" && "_id" in word.createdBy) {
      // createdBy est un objet User peuplé
      createdByIdToCompare = String(word.createdBy._id);
      console.log("🔍 createdBy is User object, ID:", createdByIdToCompare);
    } else {
      // createdBy est juste un ObjectId (string)
      createdByIdToCompare = String(word.createdBy);
      console.log("🔍 createdBy is ObjectId string, ID:", createdByIdToCompare);
    }

    const userIdToCompare = String(user._id);
    console.log("🔍 Comparing IDs:", {
      createdByIdToCompare,
      userIdToCompare,
      areEqual: createdByIdToCompare === userIdToCompare,
    });

    const canEdit = createdByIdToCompare === userIdToCompare;
    console.log("✅ Can edit result:", canEdit);
    console.log("=== END DEBUG canUserEditWord ===");

    return canEdit;
  }

  // PHASE 5 - DÉLÉGATION: Récupérer les révisions en attente avec pagination
  async getPendingRevisions(
    page = 1,
    limit = 10
  ): Promise<{
    revisions: RevisionHistory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    console.log(
      "📝 WordsService.getPendingRevisions - Délégation vers WordRevisionService"
    );
    return this.wordRevisionService.getPendingRevisions(page, limit);
  }

  /**
   * Supprime un mot
   * PHASE 7B - DÉLÉGATION: Délégation vers WordCoreService
   */
  async remove(id: string, user: User): Promise<{ success: boolean }> {
    console.log("🎭 WordsService.remove - Délégation vers WordCoreService");
    return this.wordCoreService.remove(id, user);
  }

  /**
   * Recherche des mots avec filtres
   * PHASE 7B - DÉLÉGATION: Délégation vers WordCoreService
   */
  async search(searchDto: SearchWordsDto): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
  }> {
    console.log("🎭 WordsService.search - Délégation vers WordCoreService");
    return this.wordCoreService.search(searchDto);
  }

  /**
   * Récupère les mots vedettes
   * PHASE 7B - DÉLÉGATION: Délégation vers WordCoreService
   */
  async getFeaturedWords(limit = 3): Promise<Word[]> {
    console.log(
      "🎭 WordsService.getFeaturedWords - Délégation vers WordCoreService"
    );
    return this.wordCoreService.getFeaturedWords(limit);
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
      "🔄 Récupération des langues depuis la collection Languages..."
    );

    // Récupérer les langues actives depuis la collection Languages
    const activeLanguages = await this.languageModel
      .find({
        systemStatus: "active",
        isVisible: true,
      })
      .exec();

    console.log("📋 Langues actives trouvées:", activeLanguages.length);

    // Pour chaque langue active, compter les mots approuvés
    const languagesWithWordCount = await Promise.all(
      activeLanguages.map(async (language) => {
        // Compter les mots par languageId (nouveau système)
        const wordCountByLanguageId = await this.wordModel.countDocuments({
          status: "approved",
          languageId: (language as any)._id,
        });

        // Compter les mots par ancien code language (système de transition)
        let wordCountByCode = 0;
        if (language.iso639_1) {
          wordCountByCode = await this.wordModel.countDocuments({
            status: "approved",
            language: language.iso639_1,
          });
        }

        const totalWordCount = wordCountByLanguageId + wordCountByCode;

        console.log(
          `📊 Langue ${language.name}: ${totalWordCount} mots (${wordCountByLanguageId} par ID + ${wordCountByCode} par code)`
        );

        return {
          id: (language as any)._id.toString(),
          code: language.iso639_1 || language.name.toLowerCase().slice(0, 2),
          name: language.name,
          nativeName: language.nativeName,
          wordCount: totalWordCount,
        };
      })
    );

    // Trier par nombre de mots décroissant
    const sortedLanguages = languagesWithWordCount.sort(
      (a, b) => b.wordCount - a.wordCount
    );

    console.log("✅ Langues disponibles formatées:", sortedLanguages.length);
    return sortedLanguages;
  }

  // PHASE 3 - DÉLÉGATION: Ajouter un mot aux favoris
  async addToFavorites(
    wordId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    console.log(
      "⭐ WordsService.addToFavorites - Délégation vers WordFavoriteService"
    );
    return this.wordFavoriteService.addToFavorites(wordId, userId);
  }

  // PHASE 3 - DÉLÉGATION: Retirer un mot des favoris
  async removeFromFavorites(
    wordId: string,
    userId: string
  ): Promise<{ success: boolean }> {
    console.log(
      "⭐ WordsService.removeFromFavorites - Délégation vers WordFavoriteService"
    );
    return this.wordFavoriteService.removeFromFavorites(wordId, userId);
  }

  // PHASE 3 - DÉLÉGATION: Récupérer les mots favoris d'un utilisateur
  async getFavoriteWords(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    console.log(
      "⭐ WordsService.getFavoriteWords - Délégation vers WordFavoriteService"
    );
    return this.wordFavoriteService.getFavoriteWords(userId, page, limit);
  }

  // PHASE 3 - DÉLÉGATION: Vérifier si un mot est dans les favoris
  async checkIfFavorite(wordId: string, userId: string): Promise<boolean> {
    console.log(
      "⭐ WordsService.checkIfFavorite - Délégation vers WordFavoriteService"
    );
    return this.wordFavoriteService.checkIfFavorite(wordId, userId);
  }

  // PHASE 3 - DÉLÉGATION: Partager un mot avec un autre utilisateur
  async shareWordWithUser(
    wordId: string,
    fromUserId: string,
    toUsername: string
  ): Promise<{ success: boolean; message: string }> {
    console.log(
      "⭐ WordsService.shareWordWithUser - Délégation vers WordFavoriteService"
    );
    return this.wordFavoriteService.shareWordWithUser(
      wordId,
      fromUserId,
      toUsername
    );
  }

  async getAdminPendingWords(
    page = 1,
    limit = 10
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const total = await this.wordModel.countDocuments({ status: "pending" });
    const words = await this.wordModel
      .find({ status: "pending" })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "username")
      .populate("categoryId", "name")
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
    status: "approved" | "rejected"
  ): Promise<Word> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("ID de mot invalide");
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
  // PHASE 6A - DÉLÉGATION: Supprimer un fichier audio d'un mot
  async deleteAudioFile(
    wordId: string,
    accent: string,
    user: User
  ): Promise<Word> {
    console.log(
      "🎵 WordsService.deleteAudioFile - Délégation vers WordAudioService"
    );
    return this.wordAudioService.deleteAudioFile(wordId, accent, user);
  }

  // PHASE 6A - DÉLÉGATION: Récupérer tous les fichiers audio d'un mot
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
    totalCount: number;
  }> {
    console.log(
      "🎵 WordsService.getWordAudioFiles - Délégation vers WordAudioService"
    );
    return this.wordAudioService.getWordAudioFiles(wordId);
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
    user: User
  ): Promise<Word> {
    // Adapter les données vers le format WordAudioService
    const adaptedUpdates = audioUpdates.map((update) => ({
      accent: update.accent,
      fileBuffer: update.audioBuffer,
      action: update.replaceExisting ? ("update" as const) : ("add" as const),
    }));

    console.log(
      "🎵 WordsService.bulkUpdateAudioFiles - Délégation vers WordAudioService"
    );
    return this.wordAudioService.bulkUpdateAudioFiles(
      wordId,
      adaptedUpdates,
      user
    );
  }

  /**
   * Génère une URL optimisée pour un fichier audio
   * PHASE 2 - ÉTAPE 4 : Délégation vers WordAudioService
   */
  async getOptimizedAudioUrl(
    wordId: string,
    accent: string,
    options: {
      quality?: "auto:low" | "auto:good" | "auto:best";
      format?: "mp3" | "ogg" | "wav";
      volume?: number;
      speed?: number;
    } = {}
  ): Promise<string> {
    // Adapter les options vers le format WordAudioService
    const adaptedOptions = {
      quality:
        (options.quality?.replace("auto:", "") as "auto" | "good" | "best") ||
        "auto",
      format: options.format || "mp3",
    };

    console.log(
      "🎵 WordsService.getOptimizedAudioUrl - Délégation vers WordAudioService"
    );
    const result = await this.wordAudioService.getOptimizedAudioUrl(
      wordId,
      accent,
      adaptedOptions
    );
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
      status: "valid" | "invalid" | "missing";
      error?: string;
    }>;
  }> {
    console.log(
      "🎵 WordsService.validateWordAudioFiles - Délégation vers WordAudioService"
    );
    const result = await this.wordAudioService.validateWordAudioFiles(wordId);

    // Adapter la réponse vers le format attendu par WordsService
    const audioFiles: Array<{
      accent: string;
      status: "valid" | "invalid" | "missing";
      error?: string;
    }> = [];

    // Ajouter les fichiers invalides
    result.invalidFiles.forEach((invalid) => {
      audioFiles.push({
        accent: invalid.accent,
        status: "invalid",
        error: invalid.issues.join(", "),
      });
    });

    // Ajouter les fichiers valides
    const totalFiles = result.totalFiles;
    const invalidCount = result.invalidFiles.length;
    const validCount = totalFiles - invalidCount;

    for (let i = 0; i < validCount; i++) {
      audioFiles.push({
        accent: `valid-${i}`, // Placeholder car WordAudioService ne retourne pas les détails des valides
        status: "valid",
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
   * PHASE 6B - DÉLÉGATION: Délégation vers WordTranslationService
   */
  async getAllTranslations(wordId: string): Promise<{
    directTranslations: any[];
    reverseTranslations: any[];
    allTranslations: any[];
  }> {
    console.log(
      "🔍 WordsService.getAllTranslations - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.getAllTranslations(wordId);
  }

  // PHASE 4 - DÉLÉGATION: Nombre de mots approuvés
  async getApprovedWordsCount(): Promise<number> {
    console.log(
      "📊 WordsService.getApprovedWordsCount - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getApprovedWordsCount();
  }

  // PHASE 4 - DÉLÉGATION: Mots ajoutés aujourd'hui
  async getWordsAddedToday(): Promise<number> {
    console.log(
      "📊 WordsService.getWordsAddedToday - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getWordsAddedToday();
  }

  // PHASE 4 - DÉLÉGATION: Récupérer les statistiques complètes des mots
  async getWordsStatistics(): Promise<{
    totalApprovedWords: number;
    wordsAddedToday: number;
    wordsAddedThisWeek: number;
    wordsAddedThisMonth: number;
  }> {
    console.log(
      "📊 WordsService.getWordsStatistics - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getWordsStatistics();
  }
}
