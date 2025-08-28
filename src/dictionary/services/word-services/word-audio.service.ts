import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word, WordDocument } from '../../schemas/word.schema';
import { User } from '../../../users/schemas/user.schema';
import { AudioService } from '../audio.service';
import { ActivityService } from '../../../common/services/activity.service';
import { WordPermissionService } from './word-permission.service';
import { DatabaseErrorHandler } from "../../../common/errors";

/**
 * Service spécialisé pour la gestion des fichiers audio des mots
 * PHASE 2 - ÉTAPE 2 : Extraction responsabilités audio
 */
@Injectable()
export class WordAudioService {
  private readonly logger = new Logger(WordAudioService.name);

  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    private audioService: AudioService,
    private activityService: ActivityService,
    private wordPermissionService: WordPermissionService,
  ) {}

  /**
   * Ajoute un fichier audio à un mot existant
   * Ligne 856-972 dans WordsService original
   */
  async addAudioFile(
    wordId: string,
    accent: string,
    fileBuffer: Buffer,
    user: User,
  ): Promise<Word> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
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

        const word = await this.wordModel.findById(wordId).populate('createdBy', '_id username');
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        console.log('📝 Mot trouvé:', {
          word: word.word,
          language: word.language,
          existingAudioFiles: Object.keys(word.audioFiles || {}).length,
        });

        // Vérifier les permissions
        const canAddAudio = await this.wordPermissionService.canUserAddAudio(word, user);
        if (!canAddAudio) {
          throw new BadRequestException(
            "Vous n'avez pas la permission d'ajouter un fichier audio à ce mot",
          );
        }

        try {
          console.log('🚀 Appel uploadPhoneticAudio...');

          // Essayer de détecter le type MIME à partir de la signature
          let detectedMimeType: string | undefined;
          const signature = fileBuffer.slice(0, 12).toString('hex').toLowerCase();

          // Signatures pour les formats audio courants
          if (signature.startsWith('fff3') || signature.startsWith('fff2')) {
            detectedMimeType = 'audio/mpeg';
          } else if (signature.startsWith('4f676753')) {
            detectedMimeType = 'audio/ogg';
          } else if (signature.startsWith('52494646')) {
            detectedMimeType = 'audio/wav';
          } else if (signature.startsWith('664c6143')) {
            detectedMimeType = 'audio/flac';
          }

          console.log('🔍 Type MIME détecté:', detectedMimeType);

          const audioResult = await this.audioService.uploadPhoneticAudio(
            word.word,
            word.language || 'unknown',
            fileBuffer,
            accent,
            detectedMimeType,
          );

          console.log('✅ Upload réussi:', audioResult);

          // Mettre à jour le mot avec le nouveau fichier audio
          const audioFiles = new Map(word.audioFiles || new Map());
          audioFiles.set(accent, {
            url: audioResult.url,
            cloudinaryId: audioResult.cloudinaryId,
            language: word.language || 'unknown',
            accent: accent,
          });

          const updatedWord = await this.wordModel
            .findByIdAndUpdate(
              wordId,
              { audioFiles: audioFiles },
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

          // Enregistrer l'activité d'ajout audio
          try {
            await this.activityService.logAudioAdded(
              user._id,
              wordId,
              audioResult.url,
              { 
                wordTitle: word.word,
                language: word.language,
                fileSize: fileBuffer.length,
                accent: accent,
                duration: audioResult.duration || 0
              }
            );
          } catch (error) {
            console.warn('Failed to log audio addition activity:', error);
          }

          console.log('✅ === FIN addAudioFile ===');
          return updatedWord;
        } catch (error) {
          console.error('❌ Erreur lors de l\'upload audio:', error);
          throw new BadRequestException(
            `Erreur lors de l'ajout du fichier audio: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      'WordAudio',
      user._id?.toString(),
    );
  }

  /**
   * Supprime un fichier audio d'un mot
   * Ligne 1684-1748 dans WordsService original
   */
  async deleteAudioFile(wordId: string, accent: string, user: User): Promise<Word> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        // Vérifier les permissions
        const canEdit = await this.wordPermissionService.canUserEditWord(word, user);
        if (!canEdit) {
          throw new BadRequestException(
            "Vous n'avez pas la permission de supprimer ce fichier audio",
          );
        }

        const audioFiles = new Map(word.audioFiles || new Map());
        const audioFile = audioFiles.get(accent);

        if (!audioFile) {
          throw new NotFoundException(
            `Fichier audio pour l'accent '${accent}' non trouvé`,
          );
        }

        try {
          // Supprimer le fichier de Cloudinary
          if (audioFile.cloudinaryId) {
            await this.audioService.deletePhoneticAudio(audioFile.cloudinaryId);
          }

          // Supprimer l'entrée de la Map
          audioFiles.delete(accent);

          // Mettre à jour le mot
          const updatedWord = await this.wordModel
            .findByIdAndUpdate(
              wordId,
              { audioFiles: audioFiles },
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

          // Enregistrer l'activité de suppression audio
          try {
            await this.activityService.logAudioDeleted(
              user._id,
              wordId,
              audioFile.url,
              { 
                wordTitle: word.word,
                language: word.language,
                accent: accent,
                reason: 'Suppression par utilisateur'
              }
            );
          } catch (error) {
            console.warn('Failed to log audio deletion activity:', error);
          }

          return updatedWord;
        } catch (error) {
          console.error('❌ Erreur lors de la suppression audio:', error);
          throw new BadRequestException(
            `Erreur lors de la suppression du fichier audio: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      'WordAudio',
      wordId,
      user._id?.toString(),
    );
  }

  /**
   * Récupère tous les fichiers audio d'un mot
   * Ligne 1753-1797 dans WordsService original
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
    totalCount: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const word = await this.wordModel.findById(wordId).exec();
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        const audioFilesArray = Array.from(word.audioFiles || new Map()).map(
          ([accent, audioData]) => ({
            accent,
            url: audioData.url,
            cloudinaryId: audioData.cloudinaryId,
            language: audioData.language,
          }),
        );

        return {
          wordId: word._id.toString(),
          word: word.word,
          language: word.language || 'unknown',
          audioFiles: audioFilesArray,
          totalCount: audioFilesArray.length,
        };
      },
      'WordAudio',
      wordId,
    );
  }

  /**
   * Met à jour plusieurs fichiers audio en lot
   * Ligne 1802-1901 dans WordsService original
   */
  async bulkUpdateAudioFiles(
    wordId: string,
    audioUpdates: Array<{
      accent: string;
      fileBuffer?: Buffer;
      action: 'add' | 'update' | 'delete';
    }>,
    user: User,
  ): Promise<Word> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const word = await this.wordModel.findById(wordId);
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        // Vérifier les permissions
        const canEdit = await this.wordPermissionService.canUserEditWord(word, user);
        if (!canEdit) {
          throw new BadRequestException(
            "Vous n'avez pas la permission de modifier les fichiers audio",
          );
        }

        const audioFiles = new Map(word.audioFiles || new Map());
        const results: Array<{ accent: string; status: string; error?: string }> = [];

        for (const update of audioUpdates) {
          try {
            if (update.action === 'delete') {
              const existingFile = audioFiles.get(update.accent);
              if (existingFile?.cloudinaryId) {
                await this.audioService.deletePhoneticAudio(existingFile.cloudinaryId);
              }
              audioFiles.delete(update.accent);
              results.push({ accent: update.accent, status: 'deleted' });
            } else if (update.action === 'add' || update.action === 'update') {
              if (!update.fileBuffer) {
                throw new BadRequestException('Buffer audio requis pour add/update');
              }

              // Supprimer l'ancien fichier si c'est une mise à jour
              if (update.action === 'update') {
                const existingFile = audioFiles.get(update.accent);
                if (existingFile?.cloudinaryId) {
                  await this.audioService.deletePhoneticAudio(existingFile.cloudinaryId);
                }
              }

              const audioResult = await this.audioService.uploadPhoneticAudio(
                word.word,
                word.language || 'unknown',
                update.fileBuffer,
                update.accent,
              );

              audioFiles.set(update.accent, {
                url: audioResult.url,
                cloudinaryId: audioResult.cloudinaryId,
                language: word.language || 'unknown',
                accent: update.accent,
              });

              results.push({ accent: update.accent, status: update.action });
            }
          } catch (error) {
            results.push({
              accent: update.accent,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Mettre à jour le mot
        const updatedWord = await this.wordModel
          .findByIdAndUpdate(
            wordId,
            { audioFiles: audioFiles },
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

        // Enregistrer l'activité de mise à jour en bulk
        try {
          const successCount = results.filter(r => r.status !== 'error').length;
          if (successCount > 0) {
            await this.activityService.logAudioBulkUpdated(
              user._id,
              wordId,
              'updated',
              successCount,
              { 
                wordTitle: word.word,
                language: word.language,
                operations: results.map(r => ({ accent: r.accent, status: r.status }))
              }
            );
          }
        } catch (error) {
          console.warn('Failed to log bulk audio update activity:', error);
        }

        return updatedWord;
      },
      'WordAudio',
      wordId,
      user._id?.toString(),
    );
  }

  /**
   * Récupère l'URL optimisée d'un fichier audio
   * Ligne 1906-1955 dans WordsService original
   */
  async getOptimizedAudioUrl(
    wordId: string,
    accent: string,
    options?: {
      quality?: 'auto' | 'good' | 'best';
      format?: 'mp3' | 'ogg' | 'wav';
    },
  ): Promise<{
    url: string;
    optimizedUrl: string;
    format: string;
    quality: string;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const word = await this.wordModel.findById(wordId).exec();
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        const audioFiles = word.audioFiles || new Map();
        const audioFile = audioFiles.get(accent);

        if (!audioFile) {
          throw new NotFoundException(
            `Fichier audio pour l'accent '${accent}' non trouvé`,
          );
        }

        const quality = options?.quality || 'auto';
        const format = options?.format || 'mp3';

        // Pour le moment, retourner l'URL de base (l'optimisation peut être ajoutée plus tard)
        const optimizedUrl = audioFile.url;

        return {
          url: audioFile.url,
          optimizedUrl,
          format,
          quality,
        };
      },
      'WordAudio',
      wordId,
    );
  }

  /**
   * Valide les fichiers audio d'un mot
   * Ligne 1960-2040 dans WordsService original
   */
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
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const word = await this.wordModel.findById(wordId).exec();
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        const audioFiles = Array.from(word.audioFiles || new Map());
        const invalidFiles: Array<{ accent: string; issues: string[] }> = [];
        const recommendations: string[] = [];
        let validFiles = 0;

        for (const [accent, audioData] of audioFiles) {
          const issues: string[] = [];

          // Vérifications basiques
          if (!audioData.url) {
            issues.push('URL manquante');
          }

          if (!audioData.cloudinaryId) {
            issues.push('ID Cloudinary manquant');
          }

          // Vérifier l'accessibilité du fichier
          try {
            const response = await fetch(audioData.url, { method: 'HEAD' });
            if (!response.ok) {
              issues.push(`Fichier inaccessible (${response.status})`);
            }
          } catch {
            issues.push('Erreur de réseau lors de la vérification');
          }

          if (issues.length > 0) {
            invalidFiles.push({ accent, issues });
          } else {
            validFiles++;
          }
        }

        // Générer des recommandations
        if (audioFiles.length === 0) {
          recommendations.push('Aucun fichier audio disponible. Envisagez d\'ajouter des prononciations.');
        }

        if (invalidFiles.length > 0) {
          recommendations.push(`${invalidFiles.length} fichier(s) audio nécessitent une correction.`);
        }

        const defaultAccent = this.getDefaultAccentForLanguage(word.language || 'unknown');
        if (!audioFiles.some(([accent]) => accent === defaultAccent)) {
          recommendations.push(`Accent par défaut '${defaultAccent}' manquant pour cette langue.`);
        }

        return {
          wordId: word._id.toString(),
          totalFiles: audioFiles.length,
          validFiles,
          invalidFiles,
          recommendations,
        };
      },
      'WordAudio',
      wordId,
    );
  }

  /**
   * Nettoie les fichiers audio orphelins
   * Ligne 2045-2095 dans WordsService original
   */
  async cleanupOrphanedAudioFiles(wordId?: string): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const errors: string[] = [];
        const details: Array<{
          wordId: string;
          accent: string;
          action: string;
        }> = [];
        let cleanedCount = 0;

        const query = wordId ? { _id: wordId } : {};
        const words = await this.wordModel.find(query).exec();

        for (const word of words) {
          const audioFiles = new Map(word.audioFiles || new Map());
          const validAudioFiles = new Map();

          for (const [accent, audioData] of audioFiles) {
            try {
              // Pour le moment, supposer que le fichier existe (la vérification peut être ajoutée plus tard)
              const exists = true; // await this.audioService.checkAudioFileExists(audioData.cloudinaryId);
              
              if (exists) {
                validAudioFiles.set(accent, audioData);
              } else {
                details.push({
                  wordId: word._id.toString(),
                  accent,
                  action: 'removed_orphaned',
                });
                cleanedCount++;
              }
            } catch (error) {
              errors.push(`Erreur vérification ${accent} pour mot ${word._id}: ${error}`);
              // En cas d'erreur, on garde le fichier par sécurité
              validAudioFiles.set(accent, audioData);
            }
          }

          // Mettre à jour seulement si des changements sont nécessaires
          if (validAudioFiles.size !== audioFiles.size) {
            await this.wordModel.findByIdAndUpdate(
              word._id,
              { audioFiles: validAudioFiles },
            );
          }
        }

        return {
          cleaned: cleanedCount,
          errors,
        };
      },
      'WordAudio',
      wordId || 'all',
    );
  }

  /**
   * Récupère les statistiques des fichiers audio
   * Ligne 2100-2175 dans WordsService original
   */
  async getAudioStatistics(): Promise<{
    totalWords: number;
    wordsWithAudio: number;
    totalAudioFiles: number;
    audioByLanguage: Record<string, number>;
    audioByAccent: Record<string, number>;
    averageAudioPerWord: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
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

        const stats = (audioStats[0] as any) || {
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
      },
      'WordAudio',
      'statistics',
    );
  }

  /**
   * Détermine l'accent par défaut basé sur la langue
   * Ligne 578-589 dans WordsService original
   */
  getDefaultAccentForLanguage(language: string): string {
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

  /**
   * Met à jour un mot avec des fichiers audio
   * Utilisé par WordsService pour l'intégration
   */
  async updateWordWithAudio(
    wordId: string,
    audioFile: Buffer,
    language: string,
    user: User,
  ): Promise<Word> {
    const defaultAccent = this.getDefaultAccentForLanguage(language);
    return this.addAudioFile(wordId, defaultAccent, audioFile, user);
  }
}