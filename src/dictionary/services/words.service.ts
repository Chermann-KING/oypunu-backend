import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { Word, WordDocument } from "../schemas/word.schema";
import { RevisionHistory } from "../schemas/revision-history.schema";
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
import { WordPermissionService } from "./word-services/word-permission.service";
// Import des repositories
import { IRevisionHistoryRepository } from "../../repositories/interfaces/revision-history.repository.interface";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { IFavoriteWordRepository } from "../../repositories/interfaces/favorite-word.repository.interface";
import { IWordViewRepository } from "../../repositories/interfaces/word-view.repository.interface";

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
    private wordCoreService: WordCoreService,
    private wordPermissionService: WordPermissionService,
    // Injection des repositories
    @Inject("IRevisionHistoryRepository")
    private revisionHistoryRepository: IRevisionHistoryRepository,
    @Inject("IWordRepository")
    private wordRepository: IWordRepository,
    @Inject("IFavoriteWordRepository")
    private favoriteWordRepository: IFavoriteWordRepository,
    @Inject("IWordViewRepository")
    private wordViewRepository: IWordViewRepository
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
    console.log(
      "🔍 WordsService.create - Vérification existence via WordCoreService"
    );
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

  // PHASE 2-1: DÉLÉGATION COMPLÈTE vers WordCoreService (sans adaptation)
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
    return this.wordCoreService.findAll(page, limit, status);
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

  // PHASE 2-1: DÉLÉGATION COMPLÈTE vers WordPermissionService
  async canUserEditWord(
    wordId: string,
    user?: User
  ): Promise<{
    wordId: string;
    canEdit: boolean;
    reason: string;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      isContributor: boolean;
      hasEditRole: boolean;
    };
    restrictions: string[];
  }> {
    console.log(
      "🔄 WordsService.canUserEditWord - Délégation vers WordPermissionService"
    );

    const word = await this.wordCoreService.findOne(wordId);
    if (!word) {
      return {
        wordId,
        canEdit: false,
        reason: "Mot non trouvé",
        permissions: {
          isOwner: false,
          isAdmin: false,
          isContributor: false,
          hasEditRole: false,
        },
        restrictions: ["Mot non trouvé"],
      };
    }

    if (!user) {
      return {
        wordId,
        canEdit: false,
        reason: "Utilisateur non authentifié",
        permissions: {
          isOwner: false,
          isAdmin: false,
          isContributor: false,
          hasEditRole: false,
        },
        restrictions: ["Utilisateur non authentifié"],
      };
    }

    const result = (await this.wordPermissionService.canUserEditWord(
      word,
      user,
      true
    )) as {
      canEdit: boolean;
      permissions: {
        isOwner: boolean;
        isAdmin: boolean;
        isContributor: boolean;
      };
      restrictions: string[];
      reason?: string;
    };

    return {
      wordId,
      canEdit: result.canEdit,
      reason: result.reason || (result.canEdit ? "Autorisé" : "Non autorisé"),
      permissions: {
        isOwner: result.permissions.isOwner,
        isAdmin: result.permissions.isAdmin,
        isContributor: result.permissions.isContributor,
        hasEditRole:
          result.permissions.isAdmin || result.permissions.isContributor,
      },
      restrictions: result.restrictions,
    };
  }

  async canUserDeleteWord(
    wordId: string,
    user: User
  ): Promise<{
    wordId: string;
    canDelete: boolean;
    reason: string;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      isSuperAdmin: boolean;
      hasDeleteRole: boolean;
    };
    warnings: string[];
    dependencies: {
      translations: number;
      favorites: number;
      references: number;
    };
  }> {
    const word = await this.wordRepository.findById(wordId);
    if (!word) {
      throw new NotFoundException("Mot introuvable");
    }

    const canDelete = await this.wordPermissionService.canUserDeleteWord(
      word,
      user
    );
    const isOwner = word.createdBy?.toString() === user._id?.toString();
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;

    return {
      wordId,
      canDelete: canDelete as boolean,
      reason: canDelete ? "Permission accordée" : "Permission refusée",
      permissions: {
        isOwner,
        isAdmin,
        isSuperAdmin: user.role === UserRole.SUPERADMIN,
        hasDeleteRole: isAdmin || isOwner,
      },
      warnings: [],
      dependencies: {
        translations: await this.wordRepository.countTranslations(wordId),
        favorites: await this.favoriteWordRepository.countByWord(wordId),
        references: await this.wordRepository.countReferences(wordId),
      },
    };
  }

  async canUserModerateWord(
    wordId: string,
    user: User
  ): Promise<{
    wordId: string;
    canModerate: boolean;
    reason: string;
    permissions: {
      isAdmin: boolean;
      isSuperAdmin: boolean;
      isModerator: boolean;
      hasModerateRole: boolean;
    };
    availableActions: string[];
  }> {
    console.log(
      "🔄 WordsService.canUserModerateWord - Délégation vers WordPermissionService"
    );
    const word = await this.wordRepository.findById(wordId);
    if (!word) {
      throw new NotFoundException("Mot introuvable");
    }

    const canModerate = await this.wordPermissionService.canUserModerateWord(
      word,
      user
    );
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;

    return {
      wordId,
      canModerate: (canModerate as any).canModerate || false,
      reason:
        (canModerate as any).reason ||
        (canModerate ? "Permission accordée" : "Permission refusée"),
      permissions: {
        isAdmin,
        isSuperAdmin: user.role === UserRole.SUPERADMIN,
        isModerator: isAdmin, // Simplification
        hasModerateRole: isAdmin,
      },
      availableActions: canModerate ? ["approve", "reject", "edit"] : [],
    };
  }

  async canUserReviseWord(
    wordId: string,
    user?: User
  ): Promise<{
    wordId: string;
    canRevise: boolean;
    reason: string;
    permissions: {
      isAuthenticated: boolean;
      isContributor: boolean;
      canEdit: boolean;
      hasRevisionRole: boolean;
    };
    limitations: {
      maxRevisionsPerDay: number;
      currentRevisions: number;
      cooldownRemaining: number;
    };
  }> {
    console.log(
      "🔄 WordsService.canUserReviseWord - Délégation vers WordPermissionService"
    );
    const word = await this.wordRepository.findById(wordId);
    if (!word) {
      throw new NotFoundException("Mot introuvable");
    }

    const canRevise = await this.wordPermissionService.canUserReviseWord(
      word,
      user
    );
    const isContributor =
      user?.role === UserRole.CONTRIBUTOR ||
      user?.role === UserRole.ADMIN ||
      user?.role === UserRole.SUPERADMIN;

    return {
      wordId,
      canRevise: (canRevise as any).canRevise || false,
      reason:
        (canRevise as any).reason ||
        (canRevise ? "Permission accordée" : "Permission refusée"),
      permissions: {
        isAuthenticated: !!user,
        isContributor,
        canEdit: isContributor,
        hasRevisionRole: isContributor,
      },
      limitations: {
        maxRevisionsPerDay: 10,
        currentRevisions: await this.revisionHistoryRepository.countTodayRevisions(userId),
        cooldownRemaining: 0,
      },
    };
  }

  async getWordPermissionSummary(
    wordId: string,
    user?: User
  ): Promise<{
    wordId: string;
    word: string;
    language: string;
    status: string;
    owner: string;
    userPermissions: {
      canView: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canModerate: boolean;
      canRevise: boolean;
      canAddToFavorites: boolean;
      canReport: boolean;
    };
    userRoles: {
      isOwner: boolean;
      isAdmin: boolean;
      isModerator: boolean;
      isContributor: boolean;
    };
    restrictions: string[];
    metadata: {
      createdAt: Date;
      updatedAt: Date;
      viewCount: number;
    };
  }> {
    console.log(
      "🔄 WordsService.getWordPermissionSummary - Délégation vers WordPermissionService"
    );
    const word = await this.wordRepository.findById(wordId);
    if (!word) {
      throw new NotFoundException("Mot introuvable");
    }

    const summary = await this.wordPermissionService.getWordPermissionSummary(
      word,
      user
    );

    return {
      wordId,
      word: word.word,
      language: word.language,
      status: word.status,
      owner: word.createdBy?.toString() || "",
      userPermissions: {
        canView: (summary as any).permissions?.canView || true,
        canEdit: (summary as any).permissions?.canEdit || false,
        canDelete: (summary as any).permissions?.canDelete || false,
        canModerate: (summary as any).permissions?.canModerate || false,
        canRevise: (summary as any).permissions?.canRevise || false,
        canAddToFavorites:
          (summary as any).permissions?.canAddToFavorites || true,
        canReport: (summary as any).permissions?.canReport || true,
      },
      userRoles: {
        isOwner: word.createdBy?.toString() === user._id?.toString(),
        isAdmin:
          user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN,
        isModerator:
          user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN,
        isContributor: user.role === UserRole.CONTRIBUTOR,
      },
      restrictions: (summary as any).restrictions || [],
      metadata: {
        createdAt: word.createdAt,
        updatedAt: word.updatedAt,
        viewCount: await this.wordViewRepository.countByWord(wordId),
      },
    };
  }

  async batchCheckUserPermissions(
    wordIds: string[],
    user: User,
    permission: "edit" | "delete" | "moderate" | "view"
  ): Promise<{
    results: Array<{
      wordId: string;
      canEdit: boolean;
      canDelete: boolean;
      canModerate: boolean;
      restrictions: string[];
    }>;
    summary: {
      totalChecked: number;
      canEditCount: number;
      canDeleteCount: number;
      canModerateCount: number;
    };
  }> {
    console.log(
      "🔄 WordsService.batchCheckUserPermissions - Délégation vers WordPermissionService"
    );

    const batchResult =
      await this.wordPermissionService.batchCheckUserPermissions(
        wordIds,
        user,
        permission
      );

    // Adapter la structure de retour
    const results = wordIds.map((wordId) => ({
      wordId,
      canEdit: true, // TODO: Vérifier réellement les permissions
      canDelete: false,
      canModerate:
        user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN,
      restrictions: [],
    }));

    return {
      results,
      summary: {
        totalChecked: wordIds.length,
        canEditCount: results.filter((r) => r.canEdit).length,
        canDeleteCount: results.filter((r) => r.canDelete).length,
        canModerateCount: results.filter((r) => r.canModerate).length,
      },
    };
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
    // Récupérer toutes les révisions en attente
    const allPendingRevisions =
      await this.revisionHistoryRepository.getPendingByPriority();

    // Compter le total
    const total = allPendingRevisions.length;

    // Appliquer la pagination manuellement
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedRevisions = allPendingRevisions.slice(startIndex, endIndex);

    // Adapter le format pour correspondre au type ReturnType attendu
    return {
      revisions: paginatedRevisions.map((rev) => ({
        _id: (rev as any)._id || (rev as any).id,
        wordId: rev.wordId.toString(),
        version: rev.version,
        previousVersion: {}, // À adapter selon les besoins
        modifiedBy: rev.modifiedBy,
        modifiedAt: rev.modifiedAt,
        changes: [
          {
            // Adapter les changements au format attendu
            field: "multiple",
            oldValue: {},
            newValue: rev.changes,
            changeType: "modified" as const,
          },
        ],
        status: rev.status,
        adminApprovedBy: rev.reviewedBy,
        adminApprovedAt: rev.reviewedAt,
        adminNotes: rev.reviewNotes,
        rejectionReason:
          rev.status === "rejected" ? rev.reviewNotes : undefined,
      })) as any[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
  // PHASE 2-1: DÉLÉGATION COMPLÈTE vers WordCoreService (sans adaptation)
  async getAdminPendingWords(
    page = 1,
    limit = 10,
    language?: string
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
    return this.wordCoreService.findAll(page, limit, "pending", language);
  }

  /**
   * Met à jour le statut d'un mot
   * PHASE 5 - DÉLÉGATION: Délégation vers WordCoreService
   */
  async updateWordStatus(
    id: string,
    status: "approved" | "rejected" | "pending",
    admin: User,
    reason?: string
  ): Promise<Word> {
    console.log(
      "🎭 WordsService.updateWordStatus - Délégation vers WordCoreService"
    );

    // Si c'est un rejet et qu'aucune raison n'est fournie, lancer une erreur
    if (status === "rejected" && !reason?.trim()) {
      throw new BadRequestException(
        "Une raison est requise pour rejeter un mot"
      );
    }

    const result = await this.wordCoreService.updateWordStatus(
      id,
      status,
      admin._id?.toString() || "system"
    );

    // Log de l'activité avec la raison si fournie
    if (this._activityService) {
      await this._activityService.recordActivity({
        userId: admin._id?.toString() || "system",
        activityType: `word_status_${status}`,
        targetId: id,
        targetType: "word",
        metadata: {
          newStatus: status,
          reason: reason || undefined,
          adminUsername: admin.username,
        },
      });
    }

    return result;
  }

  /**
   * Génère un rapport de modération complet pour les administrateurs
   * PHASE 3 - NOUVELLE MÉTHODE: Rapport administratif
   */
  async getModerationReport(): Promise<{
    summary: {
      pendingWords: number;
      pendingRevisions: number;
      approvedToday: number;
      rejectedToday: number;
    };
    recentActivity: Array<{
      action: string;
      target: string;
      admin: string;
      timestamp: Date;
    }>;
  }> {
    console.log(
      "📊 WordsService.getModerationReport - Génération du rapport de modération"
    );

    try {
      // Dates pour les statistiques du jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Statistiques des mots en attente
      const pendingWordsResult = await this.wordCoreService.findAll(
        1,
        1,
        "pending"
      );
      const pendingWords = pendingWordsResult.total;

      // Statistiques des révisions en attente
      const pendingRevisionsResult =
        await this.wordRevisionService.getPendingRevisions(1, 1);
      const pendingRevisions = pendingRevisionsResult.total;

      // Mots approuvés aujourd'hui
      let approvedToday = 0;
      let rejectedToday = 0;

      // Récupérer l'activité récente via ActivityService
      let recentActivity: Array<{
        action: string;
        target: string;
        admin: string;
        timestamp: Date;
      }> = [];

      if (this._activityService) {
        try {
          // Récupérer les activités de modération via repository direct
          const activities = await this.activityService[
            "activityFeedRepository"
          ].findWithCriteria({
            startDate: today,
            endDate: tomorrow,
            activityType: [
              "word_status_approved",
              "word_status_rejected",
              "word_status_pending",
              "revision_approved",
              "revision_rejected",
            ],
            isPublic: true,
            limit: 50,
            sortBy: "createdAt",
            sortOrder: "desc",
          });

          // Compter les approbations/rejets du jour
          approvedToday = activities.activities.filter(
            (a) =>
              a.activityType === "word_status_approved" &&
              a.createdAt >= today &&
              a.createdAt < tomorrow
          ).length;

          rejectedToday = activities.activities.filter(
            (a) =>
              a.activityType === "word_status_rejected" &&
              a.createdAt >= today &&
              a.createdAt < tomorrow
          ).length;

          // Formatage de l'activité récente (dernières 10 actions)
          recentActivity = activities.activities
            .slice(0, 10)
            .map((activity) => ({
              action: this.formatActivityAction(activity.activityType),
              target: activity.metadata?.wordName || activity.entityId,
              admin: activity.username || "Système",
              timestamp: activity.createdAt,
            }));
        } catch (activityError) {
          console.warn(
            "Erreur lors de la récupération des activités:",
            activityError
          );
          // Continuer sans les données d'activité
        }
      }

      const report = {
        summary: {
          pendingWords,
          pendingRevisions,
          approvedToday,
          rejectedToday,
        },
        recentActivity,
      };

      console.log("📊 Rapport de modération généré:", {
        pendingWords,
        pendingRevisions,
        approvedToday,
        rejectedToday,
        recentActivityCount: recentActivity.length,
      });

      return report;
    } catch (error) {
      console.error(
        "Erreur lors de la génération du rapport de modération:",
        error
      );
      throw new BadRequestException(
        "Impossible de générer le rapport de modération: " +
          (error.message || "Erreur inconnue")
      );
    }
  }

  /**
   * Formate le type d'activité pour affichage humain
   */
  private formatActivityAction(activityType: string): string {
    const actions: Record<string, string> = {
      word_status_approved: "Mot approuvé",
      word_status_rejected: "Mot rejeté",
      word_status_pending: "Mot mis en attente",
      revision_approved: "Révision approuvée",
      revision_rejected: "Révision rejetée",
      word_created: "Mot créé",
      word_updated: "Mot modifié",
    };

    return actions[activityType] || "Action inconnue";
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
  // PHASE 2-1: DÉLÉGATION COMPLÈTE vers WordAudioService (sans adaptation - interface harmonisée)
  async bulkUpdateAudioFiles(
    wordId: string,
    audioUpdates: Array<{
      accent: string;
      fileBuffer?: Buffer;
      action: "add" | "update" | "delete";
    }>,
    user: User
  ): Promise<Word> {
    console.log(
      "🎵 WordsService.bulkUpdateAudioFiles - Délégation vers WordAudioService"
    );
    return this.wordAudioService.bulkUpdateAudioFiles(
      wordId,
      audioUpdates,
      user
    );
  }

  // PHASE 2-1: DÉLÉGATION COMPLÈTE vers WordAudioService (sans adaptation - interface harmonisée)
  async getOptimizedAudioUrl(
    wordId: string,
    accent: string,
    options?: {
      quality?: "auto" | "good" | "best";
      format?: "mp3" | "ogg" | "wav";
    }
  ): Promise<{
    url: string;
    optimizedUrl: string;
    format: string;
    quality: string;
  }> {
    console.log(
      "🎵 WordsService.getOptimizedAudioUrl - Délégation vers WordAudioService"
    );
    return this.wordAudioService.getOptimizedAudioUrl(wordId, accent, options);
  }

  /**
   * Vérifie la validité des fichiers audio d'un mot
   * PHASE 2 - ÉTAPE 4 : Délégation vers WordAudioService
   */
  // PHASE 2-1: DÉLÉGATION COMPLÈTE vers WordAudioService (sans adaptation - interface harmonisée)
  async validateWordAudioFiles(wordId: string): Promise<{
    wordId: string;
    totalFiles: number;
    validFiles: number;
    invalidFiles: Array<{
      accent: string;
      issues: string[];
    }>;
    recommendations: string[];
  }> {
    console.log(
      "🎵 WordsService.validateWordAudioFiles - Délégation vers WordAudioService"
    );
    return this.wordAudioService.validateWordAudioFiles(wordId);
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
  async getAllTranslations(
    wordId: string,
    options?: {
      includeUnverified?: boolean;
      targetLanguages?: string[];
      userId?: string;
    }
  ): Promise<{
    wordId: string;
    sourceWord: string;
    sourceLanguage: string;
    translations: Array<{
      id: string;
      word: string;
      language: string;
      languageName: string;
      meanings: any[];
      confidence: number;
      verified: boolean;
      createdBy: string;
      createdAt: Date;
    }>;
    availableLanguages: Array<{
      code: string;
      name: string;
      hasTranslation: boolean;
    }>;
    statistics: {
      totalTranslations: number;
      verifiedTranslations: number;
      completionRate: number;
    };
  }> {
    console.log(
      "🔍 WordsService.getAllTranslations - Délégation vers WordTranslationService"
    );
    if (options) {
      return this.wordTranslationService.getAllTranslationsForController(
        wordId,
        options
      );
    } else {
      // Pour la compatibilité avec l'ancien format, convertir en nouveau format
      const basicResult =
        await this.wordTranslationService.getAllTranslations(wordId);
      const word = await this.wordCoreService.findOne(wordId);

      return {
        wordId,
        sourceWord: word?.word || "",
        sourceLanguage: word?.language || "",
        translations: [],
        availableLanguages: [],
        statistics: {
          totalTranslations: basicResult.allTranslations.length,
          verifiedTranslations: 0,
          completionRate: 0,
        },
      };
    }
  }

  async addTranslation(
    wordId: string,
    translationData: {
      targetWord: string;
      targetLanguage: string;
      meanings: Array<{
        definition: string;
        example?: string;
        partOfSpeech?: string;
      }>;
      confidence?: number;
      notes?: string;
    },
    user: User
  ): Promise<{
    translationId: string;
    sourceWordId: string;
    targetWord: string;
    targetLanguage: string;
    status: string;
    message: string;
  }> {
    console.log(
      "🔍 WordsService.addTranslation - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.addTranslation(
      wordId,
      translationData,
      user
    );
  }

  async removeTranslation(
    wordId: string,
    translationId: string,
    user: User
  ): Promise<void> {
    console.log(
      "🔍 WordsService.removeTranslation - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.removeTranslation(
      wordId,
      translationId,
      user
    );
  }

  async verifyTranslation(
    wordId: string,
    translationId: string,
    user?: User,
    comment?: string
  ): Promise<{
    translationId: string;
    verified: boolean;
    verifiedBy: string;
    verifiedAt: Date;
    message: string;
  }> {
    console.log(
      "🔍 WordsService.verifyTranslation - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.verifyTranslation(
      wordId,
      translationId,
      user,
      comment
    );
  }

  async searchTranslations(options: {
    query: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    verified?: boolean;
    page: number;
    limit: number;
    userId?: string;
  }): Promise<{
    query: string;
    results: Array<{
      sourceWord: string;
      sourceLanguage: string;
      translations: Array<{
        word: string;
        language: string;
        confidence: number;
        verified: boolean;
      }>;
      relevanceScore: number;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    console.log(
      "🔍 WordsService.searchTranslations - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.searchTranslations(options);
  }

  async getTranslationStatistics(options: {
    period: string;
    userId?: string;
  }): Promise<{
    totalTranslations: number;
    verifiedTranslations: number;
    byLanguagePair: Record<string, number>;
    topContributors: Array<{
      username: string;
      translationCount: number;
      verificationCount: number;
    }>;
    qualityMetrics: {
      averageConfidence: number;
      verificationRate: number;
      completionRate: number;
    };
    recentActivity: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
  }> {
    console.log(
      "🔍 WordsService.getTranslationStatistics - Délégation vers WordTranslationService"
    );
    return this.wordTranslationService.getTranslationStatistics(options);
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

  /**
   * Récupère les mots en tendance
   */
  async getTrendingWords(options: {
    period: string;
    limit: number;
    language?: string;
  }): Promise<{
    trending: Array<{
      word: string;
      language: string;
      views: number;
      searches: number;
      favorites: number;
      trendScore: number;
      growthRate: number;
    }>;
    period: string;
    generatedAt: Date;
  }> {
    console.log(
      "📈 WordsService.getTrendingWords - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getTrendingWords(options);
  }

  /**
   * Récupère les statistiques d'usage par langue
   */
  async getLanguageUsageStats(options: { period: string }): Promise<{
    languages: Array<{
      code: string;
      name: string;
      wordCount: number;
      activeUsers: number;
      searchVolume: number;
      growthRate: number;
      popularityScore: number;
    }>;
    totalLanguages: number;
    mostActive: string;
    fastestGrowing: string;
  }> {
    console.log(
      "🌍 WordsService.getLanguageUsageStats - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getLanguageUsageStats(options);
  }

  /**
   * Récupère le rapport d'activité des utilisateurs
   */
  async getUserActivityReport(options: {
    period: string;
    limit: number;
  }): Promise<{
    activeUsers: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topContributors: Array<{
      username: string;
      wordsCreated: number;
      wordsEdited: number;
      lastActivity: Date;
      contributionScore: number;
    }>;
    userEngagement: {
      averageSessionDuration: number;
      averageWordsPerUser: number;
      retentionRate: number;
    };
  }> {
    console.log(
      "👥 WordsService.getUserActivityReport - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getUserActivityReport(options);
  }

  /**
   * Récupère les métriques de performance du système
   */
  async getSystemMetrics(): Promise<{
    apiPerformance: {
      averageResponseTime: number;
      requestsPerMinute: number;
      errorRate: number;
    };
    databaseMetrics: {
      queryCount: number;
      averageQueryTime: number;
      connectionCount: number;
    };
    searchMetrics: {
      totalSearches: number;
      averageSearchTime: number;
      popularSearchTerms: string[];
    };
  }> {
    console.log(
      "🔧 WordsService.getSystemMetrics - Délégation vers WordAnalyticsService"
    );
    return this.wordAnalyticsService.getSystemMetrics();
  }

  // ========== GESTION DES RÉVISIONS ==========

  /**
   * Récupérer l'historique des révisions d'un mot
   */
  async getRevisionHistory(
    wordId: string,
    options: {
      page: number;
      limit: number;
      status?: string;
      userId?: string;
    }
  ): Promise<{
    wordId: string;
    currentVersion: any;
    revisions: Array<{
      id: string;
      version: number;
      changes: Record<string, any>;
      author: string;
      timestamp: Date;
      status: string;
      comment?: string;
    }>;
    totalRevisions: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Récupérer le mot actuel
    const currentWord = await this.findOne(wordId);
    if (!currentWord) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // Récupérer l'historique des révisions
    const revisionData = await this.revisionHistoryRepository.findByWordId(
      wordId,
      options
    );

    return {
      wordId,
      currentVersion: currentWord,
      revisions: revisionData.revisions.map((rev) => ({
        id: (rev as any).id || (rev as any)._id,
        version: rev.version,
        changes: rev.changes,
        author: (rev.modifiedBy as any)?.username || rev.modifiedBy,
        timestamp: rev.modifiedAt,
        status: rev.status,
        comment: rev.comment,
      })),
      totalRevisions: revisionData.total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(revisionData.total / options.limit),
    };
  }

  /**
   * Créer une nouvelle révision pour un mot
   */
  async createRevision(
    wordId: string,
    changes: Record<string, any>,
    user: any,
    options?: {
      comment?: string;
      reason?: string;
    }
  ): Promise<{
    revisionId: string;
    wordId: string;
    status: string;
    message: string;
    changes: Record<string, any>;
  }> {
    // Vérifier que le mot existe
    const word = await this.findOne(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // Vérifier les permissions de modification
    // Les utilisateurs peuvent proposer des révisions, mais les admins/modérateurs peuvent directement approuver
    let status: "pending" | "approved" = "pending";
    let priority: "low" | "medium" | "high" | "urgent" = "medium";

    // Auto-approuver pour les admins et modérateurs
    if (user.role === "admin" || user.role === "moderator") {
      status = "approved";
      priority = "high";
    }

    // Déterminer la priorité selon l'importance des changements
    if (changes.meanings || changes.word) {
      priority = changes.word ? "high" : "medium";
    }

    // Créer la révision
    const revision = await this.revisionHistoryRepository.create({
      wordId,
      changes,
      modifiedBy: user._id || user.id,
      modifiedAt: new Date(),
      status,
      comment: options?.comment,
      reason: options?.reason,
      version: (word as any).version ? (word as any).version + 1 : 1,
      priority,
      tags: this.generateRevisionTags(changes),
    });

    // Si auto-approuvé, appliquer immédiatement les changements
    if (status === "approved") {
      try {
        await this.update(wordId, changes as UpdateWordDto, user);
      } catch (error) {
        console.warn(
          "Erreur lors de l'application automatique des changements:",
          error
        );
        // La révision reste en base même si l'application échoue
      }
    }

    // Log de l'activité
    await this.activityService.recordActivity({
      userId: user._id || user.id,
      activityType: status === "approved" ? "word_updated" : "create_revision",
      targetType: "word",
      targetId: wordId,
      metadata: {
        revisionId: (revision as any).id || (revision as any)._id,
        fieldsChanged: Object.keys(changes),
        autoApproved: status === "approved",
      },
    });

    return {
      revisionId: (revision as any).id || (revision as any)._id,
      wordId,
      status,
      message:
        status === "approved"
          ? "Révision créée et approuvée automatiquement"
          : "Révision créée avec succès",
      changes,
    };
  }

  /**
   * Comparer deux versions d'un mot
   */
  async compareRevision(
    wordId: string,
    revisionId: string,
    user?: any
  ): Promise<{
    wordId: string;
    revisionId: string;
    comparison: {
      current: Record<string, any>;
      proposed: Record<string, any>;
      differences: Array<{
        field: string;
        operation: "added" | "removed" | "modified";
        oldValue?: any;
        newValue?: any;
      }>;
    };
    metadata: {
      author: string;
      submittedAt: Date;
      status: string;
    };
  }> {
    // Récupérer le mot actuel et la révision
    const [currentWord, revision] = await Promise.all([
      this.findOne(wordId),
      this.revisionHistoryRepository.findById(revisionId),
    ]);

    if (!currentWord) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }
    if (!revision) {
      throw new NotFoundException(
        `Révision avec l'ID ${revisionId} non trouvée`
      );
    }

    // Vérifier les permissions d'accès à la révision
    // Les auteurs peuvent voir leurs propres révisions, les admins/modérateurs peuvent tout voir
    const canViewRevision =
      !user || // Accès public aux révisions approuvées
      user.role === "admin" ||
      user.role === "moderator" ||
      (revision.modifiedBy as any)?.toString() === (user._id || user.id) ||
      revision.status === "approved";

    if (!canViewRevision && revision.status !== "approved") {
      throw new BadRequestException("Accès refusé à cette révision");
    }

    // Calculer les différences
    const differences = this.calculateDifferences(
      currentWord,
      revision.changes
    );

    return {
      wordId,
      revisionId,
      comparison: {
        current: this.sanitizeWordForComparison(currentWord),
        proposed: revision.changes,
        differences,
      },
      metadata: {
        author: (revision.modifiedBy as any)?.username || revision.modifiedBy,
        submittedAt: revision.modifiedAt,
        status: revision.status,
      },
    };
  }

  /**
   * Restaurer une version antérieure d'un mot
   */
  async restoreRevision(
    wordId: string,
    revisionId: string,
    user?: any,
    comment?: string
  ): Promise<any> {
    // Vérifications de permissions strictes pour la restauration
    if (!user) {
      throw new BadRequestException("Authentification requise");
    }

    if (!["admin", "moderator"].includes(user.role)) {
      throw new BadRequestException(
        "Seuls les administrateurs et modérateurs peuvent restaurer des révisions"
      );
    }

    // Récupérer le mot et la révision
    const [currentWord, revision] = await Promise.all([
      this.findOne(wordId),
      this.revisionHistoryRepository.findById(revisionId),
    ]);

    if (!currentWord) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }
    if (!revision) {
      throw new NotFoundException(
        `Révision avec l'ID ${revisionId} non trouvée`
      );
    }

    // Vérifier que la révision peut être restaurée
    if (revision.status === "rejected") {
      throw new BadRequestException(
        "Impossible de restaurer une révision rejetée"
      );
    }

    // Appliquer les changements de la révision
    const updatedWord = await this.update(
      wordId,
      revision.changes as UpdateWordDto,
      user
    );

    // Marquer la révision comme approuvée
    await this.revisionHistoryRepository.approve(
      revisionId,
      user._id || user.id,
      comment || `Révision restaurée par ${user.username || user.email}`
    );

    // Log de l'activité
    await this.activityService.recordActivity({
      userId: user._id || user.id,
      activityType: "restore_revision",
      targetType: "word",
      targetId: wordId,
      metadata: {
        restoredRevisionId: revisionId,
        comment,
        restoredBy: user.username || user.email,
      },
    });

    return updatedWord;
  }

  /**
   * Obtenir les statistiques des révisions
   */
  async getRevisionStatistics(options: {
    period: string;
    userId?: string;
  }): Promise<{
    totalRevisions: number;
    byStatus: {
      pending: number;
      approved: number;
      rejected: number;
    };
    byPeriod: {
      today: number;
      thisWeek: number;
      thisMonth: number;
    };
    topContributors: Array<{
      username: string;
      revisionCount: number;
      approvalRate: number;
    }>;
    averageProcessingTime: number;
  }> {
    // Récupérer les statistiques depuis le repository
    const stats = await this.revisionHistoryRepository.getStatistics({
      period: options.period,
      userId: options.userId,
    });

    return {
      totalRevisions: stats.total || 0,
      byStatus: {
        pending: stats.pending || 0,
        approved: stats.approved || 0,
        rejected: stats.rejected || 0,
      },
      byPeriod: {
        today: stats.today || 0,
        thisWeek: stats.thisWeek || 0,
        thisMonth: stats.thisMonth || 0,
      },
      topContributors: stats.topContributors || [],
      averageProcessingTime: stats.averageProcessingTime || 0,
    };
  }

  /**
   * Méthodes utilitaires privées pour les révisions
   */
  private calculateDifferences(
    current: any,
    proposed: any
  ): Array<{
    field: string;
    operation: "added" | "removed" | "modified";
    oldValue?: any;
    newValue?: any;
  }> {
    const differences = [];
    const allFields = new Set([
      ...Object.keys(current),
      ...Object.keys(proposed),
    ]);

    for (const field of allFields) {
      if (!(field in current)) {
        differences.push({
          field,
          operation: "added",
          newValue: proposed[field],
        });
      } else if (!(field in proposed)) {
        differences.push({
          field,
          operation: "removed",
          oldValue: current[field],
        });
      } else if (
        JSON.stringify(current[field]) !== JSON.stringify(proposed[field])
      ) {
        differences.push({
          field,
          operation: "modified",
          oldValue: current[field],
          newValue: proposed[field],
        });
      }
    }

    return differences;
  }

  private sanitizeWordForComparison(word: any): Record<string, any> {
    const { _id, __v, createdAt, updatedAt, ...sanitized } = word;
    return sanitized;
  }

  /**
   * Générer des tags automatiques pour une révision selon les changements
   */
  private generateRevisionTags(changes: Record<string, any>): string[] {
    const tags = [];

    if (changes.word) tags.push("word-change");
    if (changes.meanings) tags.push("meaning-change");
    if (changes.pronunciation) tags.push("pronunciation-change");
    if (changes.examples) tags.push("examples-change");
    if (changes.audioUrl) tags.push("audio-change");
    if (changes.category || changes.categoryId) tags.push("category-change");
    if (changes.language) tags.push("language-change");

    // Tags par importance
    if (changes.word || changes.meanings) {
      tags.push("major-change");
    } else {
      tags.push("minor-change");
    }

    return tags;
  }
}
