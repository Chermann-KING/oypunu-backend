import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word, WordDocument } from '../../schemas/word.schema';
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
}