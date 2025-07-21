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
  Language,
  LanguageDocument,
} from '../../../languages/schemas/language.schema';
import {
  WordView,
  WordViewDocument,
} from '../../../users/schemas/word-view.schema';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { SearchWordsDto } from '../../dto/search-words.dto';
import { User, UserDocument, UserRole } from '../../../users/schemas/user.schema';
import { CategoriesService } from '../categories.service';
import { UsersService } from '../../../users/services/users.service';
import { ActivityService } from '../../../common/services/activity.service';
import { DatabaseErrorHandler } from '../../../common/utils/database-error-handler.util';

interface WordFilter {
  status: string;
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
  language?: { $in: string[] };
  categoryId?: { $in: Types.ObjectId[] };
  'meanings.partOfSpeech'?: { $in: string[] };
}

/**
 * Service core pour les opérations CRUD de base sur les mots
 * PHASE 7 - Extraction des responsabilités principales depuis WordsService
 */
@Injectable()
export class WordCoreService {
  private readonly logger = new Logger(WordCoreService.name);

  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(Language.name) private languageModel: Model<LanguageDocument>,
    @InjectModel(WordView.name) private wordViewModel: Model<WordViewDocument>,
    private categoriesService: CategoriesService,
    private usersService: UsersService,
    private activityService: ActivityService,
  ) {}

  /**
   * Crée un nouveau mot
   * Ligne 87-223 dans WordsService original
   */
  async create(
    createWordDto: CreateWordDto,
    user: { _id?: string; userId?: string; role: string },
  ): Promise<Word> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        console.log('📝 === DEBUT CREATION MOT ===');
        console.log('📋 Données reçues:', JSON.stringify(createWordDto, null, 2));
        console.log('👤 Utilisateur:', user);

        // Vérifier si l'utilisateur a soit _id soit userId
        if (!user?._id && !user?.userId) {
          throw new BadRequestException('Utilisateur invalide');
        }

        // Utiliser l'ID approprié selon ce qui est disponible
        const userIdLocal: string = user._id || user.userId || '';

        // Vérifier si le mot existe déjà dans la même langue
        const languageFilter = createWordDto.languageId
          ? { languageId: createWordDto.languageId }
          : { language: createWordDto.language };

        const existingWord = await this.wordModel.findOne({
          word: createWordDto.word,
          ...languageFilter,
        });

        if (existingWord) {
          throw new BadRequestException(
            `Le mot "${createWordDto.word}" existe déjà dans cette langue`,
          );
        }

        // Vérifier si la catégorie existe
        if (createWordDto.categoryId) {
          const categoryExists = await this.categoriesService.findOne(
            createWordDto.categoryId,
          );
          if (!categoryExists) {
            throw new BadRequestException('Catégorie non trouvée');
          }
        }

        // Déterminer le statut en fonction du rôle
        const status =
          user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN
            ? 'approved'
            : 'pending';

        console.log(`📊 Status déterminé: ${status} (rôle: ${user.role})`);

        // Créer le mot
        const wordData = {
          ...createWordDto,
          createdBy: new Types.ObjectId(userIdLocal),
          status,
          createdAt: new Date(),
          translationCount: createWordDto.translations?.length || 0,
          version: 1,
        };

        const word = new this.wordModel(wordData);
        const savedWord = await word.save();

        // Peupler les références
        const populatedWord = await savedWord.populate([
          { path: 'createdBy', select: 'username' },
          { path: 'categoryId', select: 'name' }
        ]);

        console.log('✅ Mot créé avec succès:', {
          id: savedWord._id,
          word: savedWord.word,
          status: savedWord.status,
          translationCount: savedWord.translationCount,
        });

        // Enregistrer l'activité
        if (this.activityService && savedWord.status === 'approved') {
          try {
            // Récupérer les infos utilisateur pour l'activité
            const userData = await this.wordModel.findById(savedWord._id).populate('createdBy', 'username').exec();
            const username = userData?.createdBy && typeof userData.createdBy === 'object' && 'username' in userData.createdBy 
              ? userData.createdBy.username 
              : 'Unknown';
            
            await this.activityService.logWordCreated(
              userIdLocal,
              username,
              savedWord._id.toString(),
              savedWord.word,
              savedWord.language || savedWord.languageId?.toString() || 'unknown'
            );
          } catch (activityError) {
            console.warn('❌ Impossible d\'enregistrer l\'activité:', activityError);
          }
        }

        console.log('✅ === FIN CREATION MOT ===');
        return populatedWord;
      },
      'WordCore',
    );
  }

  /**
   * Récupère une liste paginée de mots
   * Ligne 237-267 dans WordsService original
   */
  async findAll(
    page = 1,
    limit = 10,
    status = 'approved',
    language?: string,
    categoryId?: string,
  ): Promise<{ words: Word[]; total: number; page: number; limit: number }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const skip = (page - 1) * limit;
        const filter: any = { status };

        if (language) {
          filter.language = language;
        }

        if (categoryId) {
          filter.categoryId = categoryId;
        }

        const [words, total] = await Promise.all([
          this.wordModel
            .find(filter)
            .populate('createdBy', 'username')
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.wordModel.countDocuments(filter),
        ]);

        return { words, total, page, limit };
      },
      'WordCore',
    );
  }

  /**
   * Récupère un mot par ID
   * Ligne 268-286 dans WordsService original
   */
  async findOne(id: string): Promise<Word> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
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
      },
      'WordCore',
    );
  }

  /**
   * Enregistre une vue de mot pour les analytics
   * Ligne 287-295 dans WordsService original
   */
  async trackWordView(
    wordId: string,
    userId: string,
    metadata?: any,
  ): Promise<void> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const view = new this.wordViewModel({
          wordId: new Types.ObjectId(wordId),
          userId: new Types.ObjectId(userId),
          viewedAt: new Date(),
          metadata,
        });
        await view.save();
      },
      'WordCore',
    );
  }

  /**
   * Met à jour un mot existant
   * Ligne 296-367 dans WordsService original
   */
  async update(
    id: string,
    updateWordDto: UpdateWordDto,
    user: User,
  ): Promise<Word> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const existingWord = await this.wordModel.findById(id);
        if (!existingWord) {
          throw new NotFoundException('Mot non trouvé');
        }

        // Vérifier les permissions
        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
        const isCreator = existingWord.createdBy?.toString() === user._id.toString();

        if (!isAdmin && !isCreator) {
          throw new BadRequestException(
            'Vous n\'avez pas la permission de modifier ce mot',
          );
        }

        // Si le mot est approuvé et l'utilisateur n'est pas admin, créer une révision
        if (existingWord.status === 'approved' && !isAdmin) {
          throw new BadRequestException(
            'Les modifications sur les mots approuvés nécessitent une révision. Utilisez la méthode de révision.',
          );
        }

        // Vérifier si la catégorie existe (si fournie)
        if (updateWordDto.categoryId) {
          const categoryExists = await this.categoriesService.findOne(
            updateWordDto.categoryId,
          );
          if (!categoryExists) {
            throw new BadRequestException('Catégorie non trouvée');
          }
        }

        // Mettre à jour le compteur de traductions si les traductions changent
        const updateData = {
          ...updateWordDto,
          updatedAt: new Date(),
          translationCount: updateWordDto.translations?.length || existingWord.translationCount,
        };

        const updatedWord = await this.wordModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate('createdBy', 'username')
          .populate('categoryId', 'name')
          .exec();

        if (!updatedWord) {
          throw new NotFoundException(`Mot avec l'ID ${id} non trouvé après mise à jour`);
        }

        // Enregistrer l'activité - Note: pas de méthode logWordUpdated, on skip pour maintenant
        // Les updates d'activité pourront être ajoutées plus tard si nécessaire

        return updatedWord;
      },
      'WordCore',
      user._id?.toString(),
    );
  }

  /**
   * Supprime un mot
   * Ligne 559-601 dans WordsService original
   */
  async remove(id: string, user: User): Promise<{ success: boolean }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const word = await this.wordModel.findById(id);
        if (!word) {
          throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
        }

        // Vérifier les permissions
        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
        const isCreator = word.createdBy?.toString() === user._id.toString();

        if (!isAdmin && !isCreator) {
          throw new BadRequestException(
            'Vous n\'avez pas la permission de supprimer ce mot',
          );
        }

        await this.wordModel.findByIdAndDelete(id);

        // Enregistrer l'activité - Note: pas de méthode logWordDeleted, on skip pour maintenant
        // Les suppressions d'activité pourront être ajoutées plus tard si nécessaire

        return { success: true };
      },
      'WordCore',
      user._id?.toString(),
    );
  }

  /**
   * Recherche des mots avec filtres
   * Ligne 602-667 dans WordsService original
   */
  async search(searchDto: SearchWordsDto): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const {
          query,
          languages,
          categories,
          partsOfSpeech,
          page = 1,
          limit = 10,
        } = searchDto;

        const skip = (page - 1) * limit;
        const filter: WordFilter = { status: 'approved' };

        // Recherche textuelle
        if (query && query.trim()) {
          filter.$or = [
            { word: { $regex: query, $options: 'i' } },
            { 'meanings.definition': { $regex: query, $options: 'i' } },
            { 'meanings.example': { $regex: query, $options: 'i' } },
            { 'translations.translatedWord': { $regex: query, $options: 'i' } },
          ];
        }

        // Filtrer par langues
        if (languages && languages.length > 0) {
          filter.language = { $in: languages };
        }

        // Filtrer par catégories
        if (categories && categories.length > 0) {
          const categoryIds = categories
            .filter(Types.ObjectId.isValid)
            .map((id) => new Types.ObjectId(id));
          if (categoryIds.length > 0) {
            filter.categoryId = { $in: categoryIds };
          }
        }

        // Filtrer par classes grammaticales
        if (partsOfSpeech && partsOfSpeech.length > 0) {
          filter['meanings.partOfSpeech'] = { $in: partsOfSpeech };
        }

        const [words, total] = await Promise.all([
          this.wordModel
            .find(filter)
            .populate('createdBy', 'username')
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.wordModel.countDocuments(filter),
        ]);

        return { words, total, page, limit };
      },
      'WordCore',
      `search-${searchDto.query}`,
    );
  }

  /**
   * Récupère les mots vedettes
   * Ligne 668-702 dans WordsService original
   */
  async getFeaturedWords(limit = 3): Promise<Word[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.wordModel
          .find({
            status: 'approved',
            $or: [
              { 'audioFiles': { $exists: true, $ne: {} } },
              { translationCount: { $gte: 2 } },
            ],
          })
          .populate('createdBy', 'username')
          .populate('categoryId', 'name')
          .sort({ createdAt: -1, translationCount: -1 })
          .limit(limit)
          .exec();
      },
      'WordCore',
      'featured',
    );
  }

  /**
   * Récupère la liste des langues disponibles
   * Ligne 703-769 dans WordsService original
   */
  async getAvailableLanguages(): Promise<
    Array<{ language: string; count: number; languageId?: string }>
  > {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        // Récupération des langues via languageId
        const languageIdStats = await this.wordModel.aggregate([
          { $match: { status: 'approved', languageId: { $exists: true } } },
          {
            $group: {
              _id: '$languageId',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]);

        const languageIds = languageIdStats.map((stat) => stat._id);
        const languageDetails = await this.languageModel
          .find({ _id: { $in: languageIds } })
          .exec();

        const languageIdMap = languageDetails.reduce(
          (map, lang) => {
            map[lang._id.toString()] = lang.name;
            return map;
          },
          {} as Record<string, string>,
        );

        const languageIdResults = languageIdStats.map((stat) => ({
          language: languageIdMap[stat._id.toString()] || 'Unknown',
          count: stat.count,
          languageId: stat._id.toString(),
        }));

        // Récupération des langues via champ language direct (legacy)
        const languageStats = await this.wordModel.aggregate([
          { $match: { status: 'approved', language: { $exists: true } } },
          {
            $group: {
              _id: '$language',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]);

        const languageResults = languageStats.map((stat) => ({
          language: stat._id,
          count: stat.count,
        }));

        // Combiner et dédupl iquer
        const combined = [...languageIdResults, ...languageResults];
        const languageMap = new Map<string, { language: string; count: number; languageId?: string }>();

        combined.forEach((item) => {
          const existing = languageMap.get(item.language);
          if (existing) {
            existing.count += item.count;
            if ('languageId' in item && item.languageId && !existing.languageId) {
              existing.languageId = item.languageId as string;
            }
          } else {
            languageMap.set(item.language, { ...item });
          }
        });

        return Array.from(languageMap.values()).sort((a, b) => b.count - a.count);
      },
      'WordCore',
      'languages',
    );
  }

  /**
   * Met à jour le statut d'un mot
   * Ligne 849-869 dans WordsService original
   */
  async updateWordStatus(
    wordId: string,
    status: 'pending' | 'approved' | 'rejected',
    adminId: string,
  ): Promise<Word> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(wordId)) {
          throw new BadRequestException('ID de mot invalide');
        }

        const updatedWord = await this.wordModel
          .findByIdAndUpdate(
            wordId,
            { status, updatedAt: new Date() },
            { new: true },
          )
          .populate('createdBy', 'username')
          .populate('categoryId', 'name')
          .exec();

        if (!updatedWord) {
          throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
        }

        return updatedWord;
      },
      'WordCore',
      wordId,
      adminId,
    );
  }
}