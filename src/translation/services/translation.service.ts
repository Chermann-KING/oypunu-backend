import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Word } from "../../dictionary/schemas/word.schema";
import {
  TranslationGroup,
  TranslationGroupDocument,
} from "../schemas/translation-group.schema";
import {
  TrainingData,
  TrainingDataDocument,
} from "../schemas/training-data.schema";
import { IWordRepository } from "../../repositories/interfaces/word.repository.interface";
import { User } from "../../users/schemas/user.schema";
import { SimilarityService } from "./similarity.service";
import { LearningService } from "./learning.service";
import {
  CreateTranslationDto,
  ValidateTranslationDto,
  VoteTranslationDto,
  SearchTranslationDto,
} from "../dto/create-translation.dto";
import {
  TranslationDto,
  AvailableLanguageDto,
  TranslationSuggestionDto,
  TranslationGroupDto,
  ValidationResultDto,
  LanguageStatsDto,
} from "../dto/translation-response.dto";

@Injectable()
export class TranslationService {
  constructor(
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @InjectModel(Word.name)
    private wordModel: Model<Word>,
    @InjectModel(TranslationGroup.name)
    private translationGroupModel: Model<TranslationGroupDocument>,
    @InjectModel(TrainingData.name)
    private trainingDataModel: Model<TrainingDataDocument>,
    private readonly similarityService: SimilarityService,
    private readonly learningService: LearningService
  ) {}

  /**
   * Récupère les langues disponibles pour un mot spécifique
   */
  async getAvailableLanguages(wordId: string): Promise<AvailableLanguageDto[]> {
    const word = await this.wordRepository.findById(wordId);
    if (!word) {
      throw new NotFoundException("Mot non trouvé");
    }

    // Récupérer les langues depuis les traductions directes
    const directLanguages = word.translations.map((t) => t.language);

    // Récupérer les langues depuis le groupe de traduction (si existe)
    let groupLanguages: string[] = [];
    if (word.translations.some((t) => t.translationGroupId)) {
      const groupId = word.translations.find(
        (t) => t.translationGroupId
      )?.translationGroupId;
      if (groupId) {
        // Utiliser la nouvelle méthode spécialisée du repository
        const relatedWords =
          await this.wordRepository.findByTranslationGroupId(groupId);
        groupLanguages = relatedWords
          .map((w) => w.language || "fr")
          .filter(Boolean);
      }
    }

    const allLanguages = [...new Set([...directLanguages, ...groupLanguages])];

    // Calculer les statistiques pour chaque langue
    const languageStats = await Promise.all(
      allLanguages.map(async (lang) => {
        const translationsToLang = word.translations.filter(
          (t) => t.language === lang
        );
        const avgQuality =
          translationsToLang.length > 0
            ? translationsToLang.reduce((sum, t) => sum + (t.votes || 0), 0) /
              translationsToLang.length
            : 0;

        return {
          code: lang || "fr",
          name: this.getLanguageName(lang || "fr"),
          translationCount: translationsToLang.length,
          averageQuality: Math.max(0, Math.min(1, avgQuality / 10)), // Normaliser sur 0-1
        };
      })
    );

    return languageStats.sort(
      (a, b) => b.translationCount - a.translationCount
    );
  }

  /**
   * Récupère la traduction d'un mot vers une langue spécifique
   */
  async getTranslation(
    wordId: string,
    targetLanguage: string
  ): Promise<TranslationDto[]> {
    // Utiliser la méthode spécialisée avec traductions populées
    const word = await this.wordRepository.findByIdWithTranslations(wordId);

    if (!word) {
      throw new NotFoundException("Mot non trouvé");
    }

    const translations = word.translations.filter(
      (t) => t.language === targetLanguage
    );

    return translations.map((t) => ({
      id: (t as any)._id?.toString() || "",
      language: t.language || "fr",
      translatedWord: t.translatedWord,
      context: t.context,
      confidence: t.confidence,
      votes: t.votes || 0,
      validationType: t.validationType || "manual",
      targetWordId: t.targetWordId?.toString(),
      senseId: t.senseId,
      createdAt: t.createdAt,
      createdBy: t.createdBy
        ? {
            id: (t.createdBy as any)._id.toString(),
            username: (t.createdBy as any).username,
          }
        : undefined,
      validatedBy: t.validatedBy
        ? {
            id: (t.validatedBy as any)._id.toString(),
            username: (t.validatedBy as any).username,
          }
        : undefined,
    }));
  }

  /**
   * Créer une nouvelle traduction avec détection intelligente de doublons
   */
  async createTranslation(
    createTranslationDto: CreateTranslationDto,
    userId: string
  ): Promise<ValidationResultDto> {
    const sourceWord = await this.wordRepository.findById(
      createTranslationDto.sourceWordId
    );
    if (!sourceWord) {
      throw new NotFoundException("Mot source non trouvé");
    }

    // 1. Rechercher des mots similaires dans la langue cible
    const similarWords = await this.findSimilarWordsInLanguage(
      createTranslationDto.translatedWord,
      createTranslationDto.targetLanguage,
      sourceWord
    );

    // 2. Évaluer la similarité et obtenir une recommandation
    let finalAction: "merge" | "separate" | "uncertain" = "separate";
    let targetWordId = createTranslationDto.targetWordId;
    let translationGroupId: string | undefined;
    let confidence = createTranslationDto.confidence || 0.8;

    if (similarWords.length > 0) {
      // Trouver le mot le plus similaire
      const bestMatch = similarWords[0];
      const similarity = this.similarityService.calculateSimilarity(
        sourceWord,
        bestMatch.word
      );

      // Utiliser l'apprentissage automatique pour prédire l'action
      const prediction = await this.learningService.predictAction(
        sourceWord,
        bestMatch.word,
        similarity
      );

      finalAction = this.determineActionFromScore(
        similarity.score,
        prediction.action
      );
      confidence = this.similarityService.adjustConfidenceBasedOnHistory(
        confidence,
        similarity.categoryMatch,
        similarity.sharedKeywords.length
      );

      if (finalAction === "merge") {
        // Fusionner avec le mot existant
        targetWordId = (bestMatch.word as any)._id?.toString() || "";
        translationGroupId = await this.getOrCreateTranslationGroup(
          sourceWord,
          bestMatch.word
        );
      }
    }

    // 3. Créer ou mettre à jour la traduction
    if (finalAction === "uncertain") {
      // Retourner les suggestions pour que l'utilisateur décide
      return {
        success: false,
        action: "uncertain",
        message:
          "Traduction similaire détectée. Veuillez confirmer votre choix.",
        // Les suggestions seront gérées par un endpoint séparé
      };
    }

    // 4. Ajouter la traduction au mot source
    const newTranslation = {
      language: createTranslationDto.targetLanguage,
      translatedWord: createTranslationDto.translatedWord,
      context: createTranslationDto.context || [],
      confidence,
      targetWordId,
      translationGroupId,
      senseId: createTranslationDto.senseId,
      createdBy: userId,
      validationType: finalAction === "merge" ? "auto" : "manual",
      votes: 0,
      votedBy: [],
      createdAt: new Date(),
    };

    sourceWord.translations.push(newTranslation as any);
    sourceWord.translationCount = sourceWord.translations.length;
    sourceWord.availableLanguages = [
      ...new Set(
        sourceWord.translations.map((t) => t.language || "fr").filter(Boolean)
      ),
    ];

    // 5. Mettre à jour les mots-clés extraits si nécessaire
    if (
      !sourceWord.extractedKeywords ||
      sourceWord.extractedKeywords.length === 0
    ) {
      sourceWord.extractedKeywords =
        this.similarityService.extractKeywords(sourceWord);
    }

    await this.wordRepository.update((sourceWord as any)._id?.toString(), {
      pronunciation: sourceWord.pronunciation,
      meanings: sourceWord.meanings,
      categoryId:
        (sourceWord.categoryId as any)?._id?.toString() ||
        sourceWord.categoryId,
      etymology: sourceWord.etymology,
    });

    // 6. Enregistrer dans l'historique d'apprentissage si fusion automatique
    if (finalAction === "merge" && similarWords.length > 0) {
      await this.learningService.recordHumanDecision(
        (sourceWord as any)._id?.toString(),
        targetWordId!,
        confidence,
        "merge",
        userId,
        {
          category: sourceWord.categoryId,
          categoryMatch: true,
          sourceKeywords: sourceWord.extractedKeywords,
          targetKeywords: similarWords[0].word.extractedKeywords || [],
        },
        "Auto-fusion basée sur similarité élevée"
      );
    }

    return {
      success: true,
      action: finalAction,
      message: this.getSuccessMessage(finalAction),
      translationGroupId,
      finalConfidence: confidence,
    };
  }

  /**
   * Rechercher des suggestions intelligentes pour une traduction
   */
  async searchTranslationSuggestions(
    searchDto: SearchTranslationDto
  ): Promise<TranslationSuggestionDto[]> {
    const sourceWord = await this.wordRepository.findById(searchDto.wordId);
    if (!sourceWord) {
      throw new NotFoundException("Mot source non trouvé");
    }

    const suggestions: TranslationSuggestionDto[] = [];

    // 1. Recherche par terme si fourni
    if (searchDto.searchTerm) {
      // Utiliser la méthode de recherche du repository
      const searchResult = await this.wordRepository.search({
        query: searchDto.searchTerm,
        languages: [searchDto.targetLanguage],
        limit: 10,
      });
      const matchingWords = searchResult.words;

      for (const word of matchingWords) {
        const similarity = this.similarityService.calculateSimilarity(
          sourceWord,
          word
        );

        if (similarity.score >= (searchDto.minSimilarity || 0.3)) {
          const prediction = await this.learningService.predictAction(
            sourceWord,
            word,
            similarity
          );

          suggestions.push({
            wordId: (word as any)._id?.toString(),
            word: word.word,
            language: word.language || "fr",
            similarityScore: similarity.score,
            definition: this.getFirstDefinition(word),
            suggestedAction: prediction.action,
            sharedKeywords: similarity.sharedKeywords,
            sameCategory: similarity.categoryMatch,
            categoryName: await this.getCategoryName(
              word.categoryId?.toString()
            ),
          });
        }
      }
    }

    // 2. Recherche par catégorie si pas assez de résultats
    if (suggestions.length < 5 && sourceWord.categoryId) {
      const categoryWords = await this.wordRepository.findByCategoryAndLanguage(
        (sourceWord.categoryId as any)?._id?.toString() ||
          sourceWord.categoryId?.toString(),
        searchDto.targetLanguage,
        "approved",
        suggestions.map((s) => s.wordId),
        10 - suggestions.length
      );

      for (const word of categoryWords) {
        const similarity = this.similarityService.calculateSimilarity(
          sourceWord,
          word
        );
        const prediction = await this.learningService.predictAction(
          sourceWord,
          word,
          similarity
        );

        suggestions.push({
          wordId: (word as any)._id?.toString(),
          word: word.word,
          language: word.language || "fr",
          similarityScore: similarity.score,
          definition: this.getFirstDefinition(word),
          suggestedAction: prediction.action,
          sharedKeywords: similarity.sharedKeywords,
          sameCategory: true,
          categoryName: await this.getCategoryName(word.categoryId?.toString()),
        });
      }
    }

    return suggestions
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10);
  }

  /**
   * Valider une traduction proposée
   */
  async validateTranslation(
    translationId: string,
    validateDto: ValidateTranslationDto,
    userId: string
  ): Promise<ValidationResultDto> {
    // Trouver le mot contenant cette traduction
    // TODO: Créer une méthode spécialisée findByTranslationId dans le repository
    const word = await this.wordRepository.findByTranslationId(translationId);

    if (!word) {
      throw new NotFoundException("Traduction non trouvée");
    }

    const translation = word.translations.find(
      (t) => (t as any)._id?.toString() === translationId
    );
    if (!translation) {
      throw new NotFoundException("Traduction non trouvée");
    }

    // Enregistrer la décision pour l'apprentissage
    if (translation.targetWordId) {
      await this.learningService.recordHumanDecision(
        (word as any)._id?.toString(),
        translation.targetWordId.toString(),
        translation.confidence,
        validateDto.action as any,
        userId,
        {
          category: word.categoryId,
          categoryMatch: true, // Assumption basée sur le contexte
          sourceKeywords: word.extractedKeywords || [],
          targetKeywords: [], // Sera rempli par le service d'apprentissage
        },
        validateDto.reason
      );
    }

    // Appliquer l'action
    let affectedTranslations = 0;
    if (validateDto.action === "merge" && translation.targetWordId) {
      // Logique de fusion
      if (validateDto.adjustedConfidence) {
        translation.confidence = validateDto.adjustedConfidence;
      }
      translation.validatedBy = userId as any;
      translation.validationType = "manual";
      affectedTranslations = 1;
    } else if (validateDto.action === "separate") {
      // Séparer - supprimer les références de groupe
      translation.translationGroupId = undefined;
      translation.targetWordId = undefined;
      translation.validatedBy = userId as any;
      affectedTranslations = 1;
    }

    await this.wordRepository.update((word as any)._id?.toString(), {
      pronunciation: word.pronunciation,
      meanings: word.meanings,
      categoryId: (word.categoryId as any)?._id?.toString() || word.categoryId,
      etymology: word.etymology,
    });

    return {
      success: true,
      action: validateDto.action,
      message: `Traduction ${validateDto.action === "merge" ? "fusionnée" : "séparée"} avec succès`,
      finalConfidence: translation.confidence,
      affectedTranslations,
    };
  }

  /**
   * Voter pour une traduction
   */
  async voteForTranslation(
    translationId: string,
    voteDto: VoteTranslationDto,
    userId: string
  ): Promise<{ success: boolean; newVoteCount: number }> {
    // TODO: Utiliser la même méthode spécialisée que ci-dessus
    const word = await this.wordRepository.findByTranslationId(translationId);

    if (!word) {
      throw new NotFoundException("Traduction non trouvée");
    }

    const translation = word.translations.find(
      (t) => (t as any)._id?.toString() === translationId
    );
    if (!translation) {
      throw new NotFoundException("Traduction non trouvée");
    }

    // Vérifier si l'utilisateur a déjà voté
    const hasVoted = translation.votedBy?.some(
      (id) => id.toString() === userId
    );
    if (hasVoted) {
      throw new BadRequestException(
        "Vous avez déjà voté pour cette traduction"
      );
    }

    // Ajouter le vote
    translation.votes = (translation.votes || 0) + voteDto.voteValue;
    translation.votedBy = translation.votedBy || [];
    translation.votedBy.push(userId as any);

    await this.wordRepository.update((word as any)._id?.toString(), {
      pronunciation: word.pronunciation,
      meanings: word.meanings,
      categoryId: (word.categoryId as any)?._id?.toString() || word.categoryId,
      etymology: word.etymology,
    });

    return {
      success: true,
      newVoteCount: translation.votes,
    };
  }

  /**
   * Obtenir les statistiques des langues
   */
  async getLanguageStats(): Promise<LanguageStatsDto[]> {
    const pipeline = [
      { $match: { status: "approved" } },
      {
        $group: {
          _id: "$language",
          totalWords: { $sum: 1 },
          translatedWords: {
            $sum: { $cond: [{ $gt: ["$translationCount", 0] }, 1, 0] },
          },
          avgTranslationCount: { $avg: "$translationCount" },
        },
      },
      { $sort: { totalWords: -1 as 1 | -1 } },
    ];

    const stats = await this.wordModel.aggregate(pipeline);

    return stats.map((stat) => ({
      language: stat._id,
      totalWords: stat.totalWords,
      translatedWords: stat.translatedWords,
      coveragePercentage: (stat.translatedWords / stat.totalWords) * 100,
      averageQuality: Math.min(1, stat.avgTranslationCount / 5), // Estimation de qualité
      pendingTranslations: 0, // À calculer séparément si nécessaire
      mostTranslatedFrom: [], // À calculer séparément si nécessaire
    }));
  }

  // Méthodes utilitaires privées

  private async findSimilarWordsInLanguage(
    translatedWord: string,
    targetLanguage: string,
    sourceWord: Word
  ): Promise<{ word: Word; similarity: number }[]> {
    const candidates = await this.wordModel
      .find({
        language: targetLanguage,
        $or: [
          { word: { $regex: translatedWord, $options: "i" } },
          { categoryId: sourceWord.categoryId },
        ],
        status: "approved",
      })
      .limit(20);

    const results = candidates
      .map((word) => {
        const similarity = this.similarityService.calculateSimilarity(
          sourceWord,
          word
        );
        return { word, similarity: similarity.score };
      })
      .filter((result) => result.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  private determineActionFromScore(
    score: number,
    predictedAction: string
  ): "merge" | "separate" | "uncertain" {
    if (score > 0.9) return "merge";
    if (score > 0.6) return "uncertain";
    return "separate";
  }

  private async getOrCreateTranslationGroup(
    word1: Word,
    word2: Word
  ): Promise<string> {
    // Vérifier si un groupe existe déjà
    const existingGroup = await this.translationGroupModel.findOne({
      $or: [
        { "senses.keywords": { $in: word1.extractedKeywords || [] } },
        { "senses.keywords": { $in: word2.extractedKeywords || [] } },
      ],
    });

    if (existingGroup) {
      return (existingGroup as any)._id?.toString();
    }

    // Créer un nouveau groupe
    const conceptId = `CONCEPT_${word1.word.toUpperCase()}_${Date.now()}`;
    const newGroup = await this.translationGroupModel.create({
      conceptId,
      primaryWord: word1.word,
      primaryLanguage: word1.language,
      categoryId: word1.categoryId,
      senses: [
        {
          senseId: `${conceptId}_SENSE_1`,
          description: this.getFirstDefinition(word1),
          partOfSpeech: word1.meanings[0]?.partOfSpeech || "unknown",
          keywords: word1.extractedKeywords || [],
          context: [],
        },
      ],
      totalTranslations: 2,
      qualityScore: 0.8,
    });

    return (newGroup as any)._id?.toString();
  }

  private getFirstDefinition(word: Word): string {
    if (
      word.meanings &&
      word.meanings.length > 0 &&
      word.meanings[0].definitions.length > 0
    ) {
      return word.meanings[0].definitions[0].definition;
    }
    return "Aucune définition disponible";
  }

  private async getCategoryName(
    categoryId?: string
  ): Promise<string | undefined> {
    if (!categoryId) return undefined;
    // Cette méthode devrait récupérer le nom de la catégorie
    // Pour simplifier, on retourne undefined ici
    return undefined;
  }

  private getLanguageName(code: string): string {
    const languageNames: { [key: string]: string } = {
      fr: "Français",
      en: "English",
      es: "Español",
      de: "Deutsch",
      it: "Italiano",
      pt: "Português",
      ar: "العربية",
      zh: "中文",
      ja: "日本語",
      ko: "한국어",
      ru: "Русский",
    };
    return languageNames[code] || code.toUpperCase();
  }

  private getSuccessMessage(action: string): string {
    switch (action) {
      case "merge":
        return "Traduction fusionnée automatiquement avec un mot similaire";
      case "separate":
        return "Nouvelle traduction créée";
      default:
        return "Traduction traitée";
    }
  }
}
