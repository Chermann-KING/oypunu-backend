import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Word } from '../../schemas/word.schema';
import { Language } from '../../../languages/schemas/language.schema';
import { WordView } from '../../../users/schemas/word-view.schema';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { SearchWordsDto } from '../../dto/search-words.dto';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { CategoriesService } from '../categories.service';
import { UsersService } from '../../../users/services/users.service';
import { ActivityService } from '../../../common/services/activity.service';
import { DatabaseErrorHandler } from '../../../common/utils/database-error-handler.util';
import { IWordRepository } from '../../../repositories/interfaces/word.repository.interface';
import { IUserRepository } from '../../../repositories/interfaces/user.repository.interface';
import { ILanguageRepository } from '../../../repositories/interfaces/language.repository.interface';
import { IWordViewRepository } from '../../../repositories/interfaces/word-view.repository.interface';

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
    @Inject('IWordRepository') private wordRepository: IWordRepository,
    @Inject('IUserRepository') private userRepository: IUserRepository,
    @Inject('ILanguageRepository') private languageRepository: ILanguageRepository,
    @Inject('IWordViewRepository') private wordViewRepository: IWordViewRepository,
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
        const wordExists = await this.wordRepository.existsByWordAndLanguage(
          createWordDto.word,
          createWordDto.language,
          createWordDto.languageId,
        );

        if (wordExists) {
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
        const savedWord = await this.wordRepository.create(createWordDto, userIdLocal, status);

        console.log('✅ Mot créé avec succès:', {
          id: (savedWord as any)._id,
          word: savedWord.word,
          status: savedWord.status,
          translationCount: savedWord.translationCount,
        });

        // Enregistrer l'activité
        if (this.activityService && savedWord.status === 'approved') {
          try {
            // Récupérer les infos utilisateur pour l'activité
            const userData = await this.userRepository.findById(userIdLocal);
            const username = userData?.username || 'Unknown';
            
            await this.activityService.logWordCreated(
              userIdLocal,
              username,
              (savedWord as any)._id.toString(),
              savedWord.word,
              savedWord.language || savedWord.languageId?.toString() || 'unknown'
            );
          } catch (activityError) {
            console.warn('❌ Impossible d\'enregistrer l\'activité:', activityError);
          }
        }

        console.log('✅ === FIN CREATION MOT ===');
        return savedWord;
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
  ): Promise<{ words: Word[]; total: number; page: number; limit: number; totalPages: number }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const result = await this.wordRepository.findAll({
          page,
          limit,
          status,
          language,
          categoryId,
        });
        
        // PHASE 2-1: Calcul de totalPages intégré dans le service core
        return {
          ...result,
          totalPages: Math.ceil(result.total / result.limit),
        };
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
        const word = await this.wordRepository.findById(id);

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

        // Incrémenter le compteur de vues du mot
        await this.wordRepository.incrementViewCount(wordId);
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

        const existingWord = await this.wordRepository.findById(id);
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

        const updatedWord = await this.wordRepository.update(id, updateData);

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

        const word = await this.wordRepository.findById(id);
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

        await this.wordRepository.delete(id);

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
        return this.wordRepository.search(searchDto);
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
        return this.wordRepository.findFeatured(limit);
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
        return this.wordRepository.getAvailableLanguages();
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

        const updatedWord = await this.wordRepository.updateStatus(wordId, status, adminId);

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