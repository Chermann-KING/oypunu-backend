import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Word, WordDocument } from "../schemas/word.schema";
import {
  RevisionHistory,
} from "../schemas/revision-history.schema";
import { CreateWordDto } from "../dto/create-word.dto";
import { UpdateWordDto } from "../dto/update-word.dto";
import { SearchWordsDto } from "../dto/search-words.dto";
import { User, UserRole } from "../../users/schemas/user.schema";
import { CategoriesService } from "../services/categories.service";
import { UsersService } from "../../users/services/users.service";
import { AudioService } from "./audio.service";
import { ActivityService } from "../../common/services/activity.service";
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

    // PHASE 5 - DÉLÉGATION: Vérifier si le mot existe déjà (délégation vers WordCoreService)
    console.log('🔍 WordsService.create - Vérification existence via WordCoreService');
    return this.wordCoreService.create(createWordDto, user);

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
    console.log("🎭 WordsService.findAll - Délégation vers WordCoreService");
    const result = await this.wordCoreService.findAll(page, limit, status);
    
    return {
      ...result,
      totalPages: Math.ceil(result.total / result.limit),
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

    // PHASE 5 - DÉLÉGATION: Vérification mot via WordCoreService
    const word = await this.wordCoreService.findOne(id);

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

    // PHASE 5 - DÉLÉGATION: Vérification mot via WordCoreService  
    try {
      const word = await this.wordCoreService.findOne(wordId);
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
    } catch (error) {
      console.log("❌ Error checking word:", error);
      return false;
    }
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

  /**
   * Récupère les langues disponibles dans la base de données
   * PHASE 5 - DÉLÉGATION: Délégation vers WordCoreService
   */
  async getAvailableLanguages(): Promise<
    Array<{ language: string; count: number; languageId?: string }>
  > {
    console.log(
      "🎭 WordsService.getAvailableLanguages - Délégation vers WordCoreService"
    );
    return this.wordCoreService.getAvailableLanguages();
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

  /**
   * Récupère les mots en attente pour les admins
   * PHASE 5 - DÉLÉGATION: Délégation vers WordCoreService
   */
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
    console.log(
      "🎭 WordsService.getAdminPendingWords - Délégation vers WordCoreService"
    );
    const result = await this.wordCoreService.findAll(page, limit, "pending");
    return {
      ...result,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  /**
   * Met à jour le statut d'un mot
   * PHASE 5 - DÉLÉGATION: Délégation vers WordCoreService
   */
  async updateWordStatus(
    id: string,
    status: "approved" | "rejected",
    adminId?: string
  ): Promise<Word> {
    console.log(
      "🎭 WordsService.updateWordStatus - Délégation vers WordCoreService"
    );
    return this.wordCoreService.updateWordStatus(id, status, adminId || "system");
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
