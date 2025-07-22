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
  FavoriteWord,
  FavoriteWordDocument,
} from '../../schemas/favorite-word.schema';
import { User, UserDocument } from '../../../users/schemas/user.schema';
import { ActivityService } from '../../../common/services/activity.service';
import { WordPermissionService } from './word-permission.service';
import { DatabaseErrorHandler } from '../../../common/utils/database-error-handler.util';

/**
 * Service spécialisé pour la gestion des mots favoris
 * PHASE 3 - ÉTAPE 3 : Extraction responsabilités favoris
 */
@Injectable()
export class WordFavoriteService {
  private readonly logger = new Logger(WordFavoriteService.name);

  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(FavoriteWord.name)
    private favoriteWordModel: Model<FavoriteWordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private activityService: ActivityService,
    private wordPermissionService: WordPermissionService,
  ) {}

  /**
   * Ajoute un mot aux favoris d'un utilisateur
   * Lignes 1211-1275 dans WordsService original
   */
  async addToFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('🔥 addToFavorites - wordId:', wordId);
        console.log('🔥 addToFavorites - userId:', userId);

        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

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

        // Vérifier les permissions
        const user = await this.userModel.findById(userId);
        if (!user) {
          throw new NotFoundException(`Utilisateur avec l'ID ${userId} non trouvé`);
        }

        const canAddToFavorites = await this.wordPermissionService.canUserAddToFavorites(word, user);
        if (!canAddToFavorites) {
          throw new BadRequestException('Vous ne pouvez pas ajouter ce mot aux favoris');
        }

        // Convertir les IDs en ObjectIds pour la requête MongoDB
        const wordObjectId = new Types.ObjectId(wordId);
        const userObjectId = new Types.ObjectId(userId);

        // Vérifier si le mot est déjà dans les favoris
        console.log('🔥 Vérification favoris existants...');
        const existingFavorite = await this.favoriteWordModel.findOne({
          wordId: wordObjectId,
          userId: userObjectId,
        });

        if (existingFavorite) {
          console.log('✅ Mot déjà dans les favoris');
          return { success: true };
        }
        console.log('🔥 Mot pas encore dans les favoris, ajout en cours...');

        // Ajouter aux favoris
        const newFavorite = new this.favoriteWordModel({
          wordId: wordObjectId,
          userId: userObjectId,
          addedAt: new Date(),
        });

        console.log('🔥 Sauvegarde du favori...');
        await newFavorite.save();

        console.log('✅ Mot ajouté aux favoris avec succès');

        // Enregistrer l'activité
        if (this.activityService) {
          try {
            await this.activityService.recordActivity({
              userId,
              activityType: 'word_favorited',
              targetType: 'word',
              targetId: wordId,
              metadata: {
                wordText: word.word,
                language: word.language,
              },
            });
          } catch (activityError) {
            console.warn('❌ Impossible d\'enregistrer l\'activité favorite:', activityError);
          }
        }

        return { success: true };
      },
      'FavoriteWord',
      userId,
    );
  }

  /**
   * Retire un mot des favoris d'un utilisateur
   * Lignes 1277-1342 dans WordsService original
   */
  async removeFromFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        console.log('🔥 removeFromFavorites - wordId:', wordId, 'userId:', userId);

        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID utilisateur invalide');
        }

        // Convertir les IDs en ObjectIds
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
          console.log('❌ Favori non trouvé');
          return { success: false, message: 'Ce mot n\'est pas dans vos favoris' };
        }

        console.log('✅ Favori trouvé, suppression en cours...');

        // Supprimer des favoris
        const result = await this.favoriteWordModel.deleteOne({
          wordId: wordObjectId,
          userId: userObjectId,
        });

        console.log('🔥 Résultat suppression:', result);

        if (result.deletedCount === 0) {
          console.log('❌ Aucun favori supprimé');
          return { success: false, message: 'Erreur lors de la suppression' };
        }

        console.log('✅ Favori supprimé avec succès');

        // Enregistrer l'activité
        if (this.activityService) {
          try {
            const word = await this.wordModel.findById(wordId);
            await this.activityService.recordActivity({
              userId,
              activityType: 'word_unfavorited',
              targetType: 'word',
              targetId: wordId,
              metadata: {
                wordText: word?.word || 'unknown',
                language: word?.language || 'unknown',
              },
            });
          } catch (activityError) {
            console.warn('❌ Impossible d\'enregistrer l\'activité unfavorite:', activityError);
          }
        }

        return { success: true };
      },
      'FavoriteWord',
      wordId,
      userId,
    );
  }

  /**
   * Récupère la liste des mots favoris d'un utilisateur avec pagination
   * Lignes 1346-1427 dans WordsService original
   */
  async getFavoriteWords(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        console.log(
          '🔥 getFavoriteWords - userId:',
          userId,
          'page:',
          page,
          'limit:',
          limit,
        );

        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID utilisateur invalide');
        }

        const skip = (page - 1) * limit;

        // Trouver tous les IDs des mots favoris de l'utilisateur
        const favorites = await this.favoriteWordModel
          .find({ userId })
          .skip(skip)
          .limit(limit)
          .sort({ addedAt: -1 })
          .exec();

        console.log('🔥 Favoris trouvés en base:', favorites.length);

        const wordIds = favorites.map((fav) => fav.wordId);
        const total = await this.favoriteWordModel.countDocuments({ userId });

        console.log('🔥 Total favoris:', total);
        console.log('🔥 WordIds:', wordIds);

        // Si aucun favori, retourner un tableau vide
        if (wordIds.length === 0) {
          console.log('🔥 Aucun favori trouvé');
          return {
            words: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }

        // Récupérer les détails des mots
        const words = await this.wordModel
          .find({
            _id: { $in: wordIds },
            status: 'approved',
          })
          .populate('createdBy', 'username')
          .populate('categoryId', 'name')
          .exec();

        console.log('🔥 Mots favoris récupérés:', words.length);

        // Réorganiser les mots selon l'ordre des favoris (plus récent en premier)
        const orderedWords = wordIds
          .map((wordId) =>
            words.find((word) => word._id.toString() === wordId.toString()),
          )
          .filter((word) => word !== undefined) as Word[];

        const totalPages = Math.ceil(total / limit);

        return {
          words: orderedWords,
          total,
          page,
          limit,
          totalPages,
        };
      },
      'FavoriteWord',
      userId,
    );
  }

  /**
   * Vérifie si un mot est dans les favoris d'un utilisateur
   * Lignes 1429-1467 dans WordsService original
   */
  async checkIfFavorite(wordId: string, userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        console.log(
          '🔥 Backend: checkIfFavorite - wordId:',
          wordId,
          'userId:',
          userId,
        );

        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID utilisateur invalide');
        }

        // Convertir les IDs en ObjectIds
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
      },
      'FavoriteWord',
      wordId,
    );
  }

  /**
   * Partage un mot avec un autre utilisateur en l'ajoutant à ses favoris
   * Lignes 1469-1529 dans WordsService original
   */
  async shareWordWithUser(
    wordId: string,
    fromUserId: string,
    toUsername: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('🔥 shareWordWithUser:', { wordId, fromUserId, toUsername });

        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        if (!fromUserId || !Types.ObjectId.isValid(fromUserId)) {
          throw new BadRequestException('ID utilisateur expéditeur invalide');
        }

        // Vérifier si l'utilisateur destinataire existe
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
            success: false,
            message: `Le mot est déjà dans les favoris de ${toUsername}`,
          };
        }

        // Ajouter aux favoris de l'utilisateur de destination
        const newFavorite = new this.favoriteWordModel({
          wordId,
          userId: toUser._id,
          addedAt: new Date(),
          sharedBy: fromUserId,
        });

        await newFavorite.save();

        // Enregistrer l'activité pour les deux utilisateurs
        if (this.activityService) {
          try {
            const word = await this.wordModel.findById(wordId);
            
            // Activité pour l'expéditeur
            await this.activityService.recordActivity({
              userId: fromUserId,
              activityType: 'word_shared',
              targetType: 'user',
              targetId: toUser._id.toString(),
              metadata: {
                wordId,
                wordText: word?.word || 'unknown',
                sharedWith: toUsername,
              },
            });

            // Activité pour le destinataire
            await this.activityService.recordActivity({
              userId: toUser._id.toString(),
              activityType: 'word_received',
              targetType: 'word',
              targetId: wordId,
              metadata: {
                wordText: word?.word || 'unknown',
                sharedBy: fromUserId,
              },
            });
          } catch (activityError) {
            console.warn('❌ Impossible d\'enregistrer l\'activité partage:', activityError);
          }
        }

        return {
          success: true,
          message: `Mot partagé avec succès avec ${toUsername}`,
        };
      },
      'FavoriteWord',
      fromUserId,
    );
  }

  /**
   * Récupère les statistiques des favoris pour un utilisateur
   */
  async getFavoriteStats(userId: string): Promise<{
    totalFavorites: number;
    favoritesToday: number;
    favoritesByLanguage: Array<{ language: string; count: number }>;
    recentFavorites: Array<{ word: string; language: string; addedAt: Date }>;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID utilisateur invalide');
        }

        const userObjectId = new Types.ObjectId(userId);

        // Statistiques de base
        const totalFavorites = await this.favoriteWordModel.countDocuments({
          userId: userObjectId,
        });

        // Favoris ajoutés aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const favoritesToday = await this.favoriteWordModel.countDocuments({
          userId: userObjectId,
          addedAt: { $gte: today },
        });

        // Favoris récents avec détails des mots
        const recentFavoritesData = await this.favoriteWordModel
          .find({ userId: userObjectId })
          .sort({ addedAt: -1 })
          .limit(5)
          .populate('wordId', 'word language')
          .exec();

        const recentFavorites = recentFavoritesData.map((fav) => ({
          word: (fav.wordId as any)?.word || 'unknown',
          language: (fav.wordId as any)?.language || 'unknown',
          addedAt: fav.addedAt,
        }));

        // Favoris par langue
        const favoritesByLanguageData = await this.favoriteWordModel.aggregate([
          { $match: { userId: userObjectId } },
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'word',
            },
          },
          { $unwind: '$word' },
          {
            $group: {
              _id: '$word.language',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]);

        const favoritesByLanguage = favoritesByLanguageData.map((item) => ({
          language: item._id || 'unknown',
          count: item.count,
        }));

        return {
          totalFavorites,
          favoritesToday,
          favoritesByLanguage,
          recentFavorites,
        };
      },
      'FavoriteWord',
      'stats',
    );
  }

  /**
   * Supprime tous les favoris d'un utilisateur
   */
  async clearAllFavorites(userId: string): Promise<{
    success: boolean;
    deletedCount: number;
  }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID utilisateur invalide');
        }

        const userObjectId = new Types.ObjectId(userId);

        const result = await this.favoriteWordModel.deleteMany({
          userId: userObjectId,
        });

        // Enregistrer l'activité
        if (this.activityService && result.deletedCount > 0) {
          try {
            await this.activityService.recordActivity({
              userId,
              activityType: 'favorites_cleared',
              targetType: 'user',
              targetId: userId,
              metadata: {
                deletedCount: result.deletedCount,
              },
            });
          } catch (activityError) {
            console.warn('❌ Impossible d\'enregistrer l\'activité clear favorites:', activityError);
          }
        }

        return {
          success: true,
          deletedCount: result.deletedCount,
        };
      },
      'FavoriteWord',
      userId,
      userId,
    );
  }

  /**
   * Récupère les mots les plus populaires (avec le plus de favoris)
   */
  async getMostFavoritedWords(
    limit: number = 10,
    language?: string,
  ): Promise<Array<{
    word: Word;
    favoriteCount: number;
  }>> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const matchStage: any = {};
        if (language) {
          matchStage.language = language;
        }

        const pipeline: any[] = [
          {
            $lookup: {
              from: 'words',
              localField: 'wordId',
              foreignField: '_id',
              as: 'word',
            },
          },
          { $unwind: '$word' },
          { $match: { 'word.status': 'approved', ...matchStage } },
          {
            $group: {
              _id: '$wordId',
              word: { $first: '$word' },
              favoriteCount: { $sum: 1 },
            },
          },
          { $sort: { favoriteCount: -1 } },
          { $limit: limit },
        ];

        const results = await this.favoriteWordModel.aggregate(pipeline);

        return results.map((result) => ({
          word: result.word,
          favoriteCount: result.favoriteCount,
        }));
      },
      'FavoriteWord',
      'popular',
    );
  }
}