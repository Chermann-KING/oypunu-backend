import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word, WordDocument } from '../../schemas/word.schema';
import { User } from '../../../users/schemas/user.schema';
import { DatabaseErrorHandler } from '../../../common/utils/database-error-handler.util';

/**
 * Interface pour une traduction standardisée
 */
export interface Translation {
  id: string;
  sourceWord: string;
  sourceLanguageId?: Types.ObjectId;
  sourceLanguage?: string;
  targetWord: string;
  targetLanguageId?: Types.ObjectId;
  targetLanguage?: string;
  context?: string[];
  confidence?: number;
  verifiedBy?: Types.ObjectId[];
  targetWordId?: Types.ObjectId;
  direction: 'direct' | 'reverse';
}

/**
 * Service spécialisé pour la gestion des traductions bidirectionnelles
 * PHASE 1 - Service utilitaire pour centraliser la logique de traduction
 */
@Injectable()
export class WordTranslationService {
  private readonly logger = new Logger(WordTranslationService.name);

  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
  ) {}

  /**
   * Crée des traductions bidirectionnelles pour un mot nouvellement créé
   * Ligne 231-327 dans WordsService original
   */
  async createBidirectionalTranslations(
    sourceWord: WordDocument,
    userId: string,
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
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
              `❌ Erreur lors de la création de la traduction bidirectionnelle:`,
              error,
            );
          }
        }

        console.log('✅ Traductions bidirectionnelles terminées');
      },
      'WordTranslation',
      sourceWord._id?.toString(),
    );
  }

  /**
   * Récupère toutes les traductions d'un mot (directes + inverses)
   * Ligne 1490-1580 dans WordsService original
   */
  async getAllTranslations(wordId: string): Promise<{
    directTranslations: Translation[];
    reverseTranslations: Translation[];
    allTranslations: Translation[];
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        console.log(
          '🔍 Récupération de toutes les traductions pour le mot:',
          wordId,
        );

        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException('Mot non trouvé');
        }

        // 1. Traductions directes (stockées dans le mot)
        const directTranslations: Translation[] = word.translations.map((translation) => ({
          id:
            (translation as any)._id ||
            `${(word as any)._id}_${translation.translatedWord}`,
          sourceWord: word.word,
          sourceLanguageId: word.languageId ? new Types.ObjectId((word.languageId as unknown) as string) : undefined,
          sourceLanguage: word.language,
          targetWord: translation.translatedWord,
          targetLanguageId: translation.languageId ? new Types.ObjectId((translation.languageId as unknown) as string) : undefined,
          targetLanguage: translation.language,
          context: translation.context,
          confidence: translation.confidence,
          verifiedBy: translation.verifiedBy?.map(id => new Types.ObjectId(id as string)) || [],
          targetWordId: translation.targetWordId ? new Types.ObjectId(translation.targetWordId as string) : undefined,
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

        const reverseTranslations: Translation[] = [];
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
              sourceLanguageId: sourceWord.languageId ? new Types.ObjectId((sourceWord.languageId as unknown) as string) : undefined,
              sourceLanguage: sourceWord.language,
              targetWord: word.word,
              targetLanguageId: word.languageId ? new Types.ObjectId((word.languageId as unknown) as string) : undefined,
              targetLanguage: word.language,
              context: translation.context,
              confidence: translation.confidence,
              verifiedBy: translation.verifiedBy?.map(id => new Types.ObjectId(id as string)) || [],
              targetWordId: new Types.ObjectId((word as any)._id),
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
      },
      'WordTranslation',
      wordId,
    );
  }

  /**
   * Vérifie la cohérence des traductions bidirectionnelles
   */
  async validateBidirectionalConsistency(wordId: string): Promise<{
    isConsistent: boolean;
    missingReverse: Translation[];
    brokenLinks: Translation[];
    suggestions: string[];
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const { directTranslations, reverseTranslations } = await this.getAllTranslations(wordId);
        
        const missingReverse: Translation[] = [];
        const brokenLinks: Translation[] = [];
        const suggestions: string[] = [];

        // Vérifier chaque traduction directe
        for (const directTrans of directTranslations) {
          // Chercher si la traduction inverse existe
          const hasReverse = reverseTranslations.some(
            (reverse) =>
              reverse.sourceWord === directTrans.targetWord &&
              reverse.targetWord === directTrans.sourceWord
          );

          if (!hasReverse) {
            missingReverse.push(directTrans);
          }

          // Vérifier les liens targetWordId
          if (directTrans.targetWordId) {
            const targetExists = await this.wordModel.findById(directTrans.targetWordId);
            if (!targetExists) {
              brokenLinks.push(directTrans);
            }
          }
        }

        // Générer des suggestions
        if (missingReverse.length > 0) {
          suggestions.push(`${missingReverse.length} traduction(s) inverse(s) manquante(s)`);
        }
        if (brokenLinks.length > 0) {
          suggestions.push(`${brokenLinks.length} lien(s) targetWordId cassé(s)`);
        }

        return {
          isConsistent: missingReverse.length === 0 && brokenLinks.length === 0,
          missingReverse,
          brokenLinks,
          suggestions,
        };
      },
      'WordTranslation',
      `validate-${wordId}`,
    );
  }

  /**
   * Répare les traductions bidirectionnelles manquantes
   */
  async repairBidirectionalTranslations(wordId: string): Promise<{
    repaired: number;
    errors: string[];
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException('Mot non trouvé');
        }

        let repaired = 0;
        const errors: string[] = [];

        // Utiliser la méthode existante pour recréer les traductions bidirectionnelles
        try {
          await this.createBidirectionalTranslations(word, 'system-repair');
          repaired = word.translations.length;
          console.log(`✅ ${repaired} traductions réparées pour ${word.word}`);
        } catch (error) {
          const errorMsg = `Erreur lors de la réparation: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error('❌', errorMsg);
        }

        return { repaired, errors };
      },
      'WordTranslation',
      `repair-${wordId}`,
    );
  }

  /**
   * Version étendue de getAllTranslations pour le contrôleur
   * Retourne le format attendu par words-translation.controller.ts
   */
  async getAllTranslationsForController(
    wordId: string,
    options: {
      includeUnverified?: boolean;
      targetLanguages?: string[];
      userId?: string;
    } = {}
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
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException('Mot non trouvé');
        }

        // Récupérer toutes les traductions existantes
        const { allTranslations } = await this.getAllTranslations(wordId);
        
        // Filtrer selon les options
        let filteredTranslations = allTranslations;
        
        if (!options.includeUnverified) {
          filteredTranslations = filteredTranslations.filter(t => 
            t.verifiedBy && t.verifiedBy.length > 0
          );
        }
        
        if (options.targetLanguages && options.targetLanguages.length > 0) {
          filteredTranslations = filteredTranslations.filter(t =>
            options.targetLanguages!.includes(t.targetLanguage || '')
          );
        }

        // Formater les traductions pour le contrôleur
        const formattedTranslations = filteredTranslations.map(translation => ({
          id: translation.id,
          word: translation.targetWord,
          language: translation.targetLanguage || '',
          languageName: translation.targetLanguage || '', // TODO: Map to language names
          meanings: [], // TODO: Extract from target word if available
          confidence: translation.confidence || 0.8,
          verified: (translation.verifiedBy && translation.verifiedBy.length > 0) || false,
          createdBy: 'unknown', // TODO: Get from createdBy field
          createdAt: new Date(), // TODO: Get actual creation date
        }));

        // Générer les langues disponibles
        const allLanguages = [...new Set([
          word.language,
          ...word.translations.map(t => t.language),
        ])].filter(Boolean) as string[];

        const availableLanguages = allLanguages.map(lang => ({
          code: lang,
          name: lang, // TODO: Map to language names
          hasTranslation: word.translations.some(t => t.language === lang),
        }));

        // Calculer les statistiques
        const totalTranslations = word.translations.length;
        const verifiedTranslations = word.translations.filter(t => 
          t.verifiedBy && t.verifiedBy.length > 0
        ).length;
        
        return {
          wordId,
          sourceWord: word.word,
          sourceLanguage: word.language || '',
          translations: formattedTranslations,
          availableLanguages,
          statistics: {
            totalTranslations,
            verifiedTranslations,
            completionRate: totalTranslations > 0 ? 
              Math.round((verifiedTranslations / totalTranslations) * 100) : 0,
          },
        };
      },
      'WordTranslation',
      `controller-${wordId}`,
    );
  }

  /**
   * Ajouter une nouvelle traduction
   */
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
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException('Mot source non trouvé');
        }

        // Vérifier si la traduction existe déjà
        const existingTranslation = word.translations.find(t =>
          t.language === translationData.targetLanguage &&
          t.translatedWord === translationData.targetWord
        );

        if (existingTranslation) {
          throw new BadRequestException('Cette traduction existe déjà');
        }

        // Créer la nouvelle traduction
        const newTranslation = {
          language: translationData.targetLanguage,
          translatedWord: translationData.targetWord,
          context: [], // TODO: Extract from meanings
          confidence: translationData.confidence || 0.8,
          verifiedBy: [],
          targetWordId: null,
          createdBy: new Types.ObjectId(user._id as string),
          validatedBy: null,
        };

        word.translations.push(newTranslation as any);
        word.translationCount = word.translations.length;
        
        const savedWord = await word.save();
        
        // Créer les traductions bidirectionnelles
        await this.createBidirectionalTranslations(savedWord, user._id as string);

        const translationId = (newTranslation as any)._id || 
          `${wordId}_${translationData.targetWord}_${Date.now()}`;

        return {
          translationId: translationId.toString(),
          sourceWordId: wordId,
          targetWord: translationData.targetWord,
          targetLanguage: translationData.targetLanguage,
          status: 'pending',
          message: 'Traduction ajoutée avec succès',
        };
      },
      'WordTranslation',
      `add-${wordId}`,
    );
  }

  /**
   * Supprimer une traduction
   */
  async removeTranslation(
    wordId: string,
    translationId: string,
    user: User
  ): Promise<void> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException('Mot source non trouvé');
        }

        const translationIndex = word.translations.findIndex(t =>
          (t as any)._id?.toString() === translationId
        );

        if (translationIndex === -1) {
          throw new NotFoundException('Traduction non trouvée');
        }

        const translation = word.translations[translationIndex];

        // Vérifier les permissions (basique)
        // TODO: Utiliser WordPermissionService pour une vérification complète
        const canDelete = 
          user.role === 'admin' || 
          user.role === 'superadmin' ||
          translation.createdBy?.toString() === user._id?.toString();

        if (!canDelete) {
          throw new ForbiddenException('Permissions insuffisantes pour supprimer cette traduction');
        }

        // Supprimer la traduction
        word.translations.splice(translationIndex, 1);
        word.translationCount = word.translations.length;
        
        await word.save();
      },
      'WordTranslation',
      `remove-${wordId}-${translationId}`,
    );
  }

  /**
   * Vérifier/valider une traduction
   */
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
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!user) {
          throw new ForbiddenException('Utilisateur requis pour la vérification');
        }

        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException('Mot source non trouvé');
        }

        const translation = word.translations.find(t =>
          (t as any)._id?.toString() === translationId
        );

        if (!translation) {
          throw new NotFoundException('Traduction non trouvée');
        }

        // Vérifier les permissions de vérification
        const canVerify = 
          user.role === 'admin' || 
          user.role === 'superadmin' ||
          user.role === 'contributor';

        if (!canVerify) {
          throw new ForbiddenException('Permissions insuffisantes - Rôle contributeur ou admin requis');
        }

        // Ajouter la vérification
        if (!translation.verifiedBy) {
          translation.verifiedBy = [];
        }

        const userIdObj = new Types.ObjectId(user._id as string);
        if (!translation.verifiedBy.some(id => id.toString() === userIdObj.toString())) {
          translation.verifiedBy.push(userIdObj as any);
        }

        (translation as any).lastVerifiedAt = new Date();
        
        await word.save();

        return {
          translationId,
          verified: true,
          verifiedBy: user.username || user._id?.toString() || 'unknown',
          verifiedAt: new Date(),
          message: 'Traduction vérifiée avec succès',
        };
      },
      'WordTranslation',
      `verify-${wordId}-${translationId}`,
    );
  }

  /**
   * Rechercher des traductions
   */
  async searchTranslations(options: {
    query: string;
    sourceLanguage?: string;
    targetLanguage?: string;
    verified?: boolean;
    page?: number;
    limit?: number;
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
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          query,
          sourceLanguage,
          targetLanguage,
          verified,
          page = 1,
          limit = 10,
        } = options;

        // Construire le filtre de recherche
        const searchFilter: any = {
          $or: [
            { word: { $regex: query, $options: 'i' } },
            { 'translations.translatedWord': { $regex: query, $options: 'i' } },
          ],
        };

        if (sourceLanguage) {
          searchFilter.language = sourceLanguage;
        }

        // Exécuter la recherche
        const skip = (page - 1) * limit;
        const [words, total] = await Promise.all([
          this.wordModel
            .find(searchFilter)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.wordModel.countDocuments(searchFilter).exec(),
        ]);

        // Formater les résultats
        const results = words.map(word => {
          let filteredTranslations = word.translations;
          
          if (targetLanguage) {
            filteredTranslations = filteredTranslations.filter(t =>
              t.language === targetLanguage
            );
          }
          
          if (verified !== undefined) {
            filteredTranslations = filteredTranslations.filter(t =>
              verified ? (t.verifiedBy && t.verifiedBy.length > 0) : true
            );
          }

          return {
            sourceWord: word.word,
            sourceLanguage: word.language || '',
            translations: filteredTranslations.map(t => ({
              word: t.translatedWord,
              language: t.language || '',
              confidence: t.confidence || 0.8,
              verified: (t.verifiedBy && t.verifiedBy.length > 0) || false,
            })),
            relevanceScore: 1.0, // TODO: Implement proper relevance scoring
          };
        });

        const totalPages = Math.ceil(total / limit);

        return {
          query,
          results,
          total,
          page,
          limit,
          totalPages,
        };
      },
      'WordTranslation',
      `search-${options.query}`,
    );
  }

  /**
   * Obtenir les statistiques des traductions
   */
  async getTranslationStatistics(options: {
    period?: string;
    userId?: string;
  } = {}): Promise<{
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
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Agrégation pour les statistiques globales
        const pipeline = [
          { $unwind: '$translations' },
          {
            $group: {
              _id: null,
              totalTranslations: { $sum: 1 },
              verifiedTranslations: {
                $sum: {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$translations.verifiedBy', []] } }, 0] },
                    1,
                    0,
                  ],
                },
              },
              averageConfidence: { $avg: '$translations.confidence' },
              languagePairs: {
                $push: {
                  source: '$language',
                  target: '$translations.language',
                },
              },
            },
          },
        ];

        const [stats] = await this.wordModel.aggregate(pipeline).exec();
        
        if (!stats) {
          return {
            totalTranslations: 0,
            verifiedTranslations: 0,
            byLanguagePair: {},
            topContributors: [],
            qualityMetrics: {
              averageConfidence: 0,
              verificationRate: 0,
              completionRate: 0,
            },
            recentActivity: {
              today: 0,
              thisWeek: 0,
              thisMonth: 0,
            },
          };
        }

        // Calculer les paires de langues
        const byLanguagePair: Record<string, number> = {};
        stats.languagePairs.forEach((pair: any) => {
          const key = `${pair.source}-${pair.target}`;
          byLanguagePair[key] = (byLanguagePair[key] || 0) + 1;
        });

        // Calculer les métriques de qualité
        const verificationRate = stats.totalTranslations > 0 
          ? Math.round((stats.verifiedTranslations / stats.totalTranslations) * 100) 
          : 0;

        return {
          totalTranslations: stats.totalTranslations || 0,
          verifiedTranslations: stats.verifiedTranslations || 0,
          byLanguagePair,
          topContributors: [], // TODO: Implement contributor statistics
          qualityMetrics: {
            averageConfidence: Math.round((stats.averageConfidence || 0) * 100) / 100,
            verificationRate,
            completionRate: verificationRate, // TODO: Calculate proper completion rate
          },
          recentActivity: {
            today: 0, // TODO: Implement time-based statistics
            thisWeek: 0,
            thisMonth: 0,
          },
        };
      },
      'WordTranslation',
      `stats-${options.period || 'all'}`,
    );
  }
}