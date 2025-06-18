import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Word, WordDocument } from '../schemas/word.schema';
import {
  FavoriteWord,
  FavoriteWordDocument,
} from '../schemas/favorite-word.schema';
import { CreateWordDto } from '../dto/create-word.dto';
import { UpdateWordDto } from '../dto/update-word.dto';
import { SearchWordsDto } from '../dto/search-words.dto';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { CategoriesService } from '../services/categories.service';
import { UsersService } from '../../users/services/users.service';

interface WordFilter {
  status: string;
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
  language?: { $in: string[] };
  categoryId?: { $in: Types.ObjectId[] };
  'meanings.partOfSpeech'?: { $in: string[] };
}

@Injectable()
export class WordsService {
  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(FavoriteWord.name)
    private favoriteWordModel: Model<FavoriteWordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private categoriesService: CategoriesService,
    private usersService: UsersService,
  ) {}

  async create(
    createWordDto: CreateWordDto,
    user: { _id?: string; userId?: string; role: string },
  ): Promise<Word> {
    // Vérifier si l'utilisateur a soit _id soit userId
    if (!user?._id && !user?.userId) {
      throw new BadRequestException('Utilisateur invalide');
    }

    // Utiliser l'ID approprié selon ce qui est disponible
    const userId: string = user._id || user.userId || '';

    // Vérifier si le mot existe déjà dans la même langue
    const existingWord = await this.wordModel.findOne({
      word: createWordDto.word,
      language: createWordDto.language,
    });

    if (existingWord) {
      throw new BadRequestException(
        `Le mot "${createWordDto.word}" existe déjà dans la langue ${createWordDto.language}`,
      );
    }

    // Créer une copie du DTO pour éviter de modifier l'objet original
    const wordData = { ...createWordDto };

    // Supprimer categoryId s'il est vide ou undefined
    if (
      !wordData.categoryId ||
      wordData.categoryId === '' ||
      wordData.categoryId === 'undefined'
    ) {
      delete wordData.categoryId;
    }

    if (wordData.categoryId && wordData.language) {
      try {
        const category = await this.categoriesService.findOne(
          wordData.categoryId,
        );
        if (!category || category.language !== wordData.language) {
          delete wordData.categoryId;
        }
      } catch {
        delete wordData.categoryId;
      }
    }

    // Créer le nouveau mot
    const createdWord = new this.wordModel({
      ...wordData,
      createdBy: Types.ObjectId.isValid(String(userId))
        ? new Types.ObjectId(String(userId))
        : new Types.ObjectId(),
      status: user.role === 'admin' ? 'approved' : 'pending',
    });

    const savedWord = await createdWord.save();

    // Incrémenter le compteur de mots ajoutés pour l'utilisateur
    try {
      await this.usersService.incrementWordCount(userId);
    } catch (error) {
      console.error(
        "Erreur lors de l'incrémentation du compteur de mots:",
        error,
      );
      // Ne pas faire échouer la création du mot si l'incrémentation échoue
    }

    return savedWord;
  }

  async findAll(
    page = 1,
    limit = 10,
    status = 'approved',
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
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
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

  async findOne(id: string): Promise<Word> {
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
  }

  async update(
    id: string,
    updateWordDto: UpdateWordDto,
    user: User,
  ): Promise<Word> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);

    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    // Vérifier si l'utilisateur a le droit de modifier ce mot
    if (
      user.role !== 'admin' &&
      word.createdBy &&
      typeof word.createdBy === 'object' &&
      '_id' in word.createdBy &&
      word.createdBy._id &&
      Types.ObjectId.isValid(String(word.createdBy._id)) &&
      Types.ObjectId.isValid(String(user._id)) &&
      String(word.createdBy._id) !== String(user._id)
    ) {
      throw new BadRequestException(
        "Vous n'avez pas le droit de modifier ce mot",
      );
    }

    // Si le statut du mot a été modifié et que l'utilisateur n'est pas admin
    if (updateWordDto.status && user.role !== 'admin') {
      delete updateWordDto.status;
    }

    const updatedWord = await this.wordModel
      .findByIdAndUpdate(id, updateWordDto, { new: true })
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    if (!updatedWord) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    return updatedWord;
  }

  async remove(id: string, user: User): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);

    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    // Vérifier si l'utilisateur a le droit de supprimer ce mot
    const isAdmin = user.role === 'admin';

    // Fonction pour extraire et comparer les IDs de manière sûre
    const compareIds = (id1: any, id2: any): boolean => {
      return String(id1) === String(id2);
    };

    let isCreator = false;
    if (
      word.createdBy &&
      typeof word.createdBy === 'object' &&
      'id' in word.createdBy &&
      user._id
    ) {
      isCreator = compareIds(word.createdBy._id, user._id);
    }

    if (!isAdmin && !isCreator) {
      throw new BadRequestException(
        "Vous n'avez pas le droit de supprimer ce mot",
      );
    }

    await this.wordModel.findByIdAndDelete(id);
    // Supprimer également les favoris associés à ce mot
    await this.favoriteWordModel.deleteMany({ wordId: id });

    return { success: true };
  }

  async search(searchDto: SearchWordsDto): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      query,
      languages,
      categories,
      partsOfSpeech,
      page = 1,
      limit = 10,
    } = searchDto;
    const skip = (page - 1) * limit;

    // Construire les filtres de recherche
    const filter: WordFilter = {
      status: 'approved',
    };

    // Recherche par texte
    if (query && query.trim() !== '') {
      filter.$or = [
        { word: { $regex: query, $options: 'i' } },
        { 'meanings.definitions.definition': { $regex: query, $options: 'i' } },
      ];
    }

    // Filtrer par langue
    if (languages && languages.length > 0) {
      filter.language = { $in: languages };
    }

    // Filtrer par catégorie
    if (categories && categories.length > 0) {
      filter.categoryId = {
        $in: categories.map((id) => new Types.ObjectId(id)),
      };
    }

    // Filtrer par partie du discours
    if (partsOfSpeech && partsOfSpeech.length > 0) {
      filter['meanings.partOfSpeech'] = { $in: partsOfSpeech };
    }

    // Exécuter la requête
    const total = await this.wordModel.countDocuments(filter);
    const words = await this.wordModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    return {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeaturedWords(limit = 6): Promise<Word[]> {
    // Récupérer des mots avec des exemples riches et bien structurés
    return this.wordModel
      .find({
        status: 'approved',
        'meanings.definitions.examples': { $exists: true, $not: { $size: 0 } },
      })
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Récupérer les langues disponibles dans la base de données
  async getAvailableLanguages(): Promise<
    {
      code: string;
      name: string;
      nativeName: string;
      wordCount: number;
    }[]
  > {
    // Mapping des codes de langue vers les noms
    const languageMap: Record<string, { name: string; nativeName: string }> = {
      fr: { name: 'Français', nativeName: 'Français' },
      en: { name: 'Anglais', nativeName: 'English' },
      es: { name: 'Espagnol', nativeName: 'Español' },
      de: { name: 'Allemand', nativeName: 'Deutsch' },
      it: { name: 'Italien', nativeName: 'Italiano' },
      pt: { name: 'Portugais', nativeName: 'Português' },
      ru: { name: 'Russe', nativeName: 'Русский' },
      ja: { name: 'Japonais', nativeName: '日本語' },
      zh: { name: 'Chinois', nativeName: '中文' },
      da: { name: 'Danois', nativeName: 'Dansk' },
      nl: { name: 'Néerlandais', nativeName: 'Nederlands' },
      sv: { name: 'Suédois', nativeName: 'Svenska' },
      no: { name: 'Norvégien', nativeName: 'Norsk' },
      fi: { name: 'Finnois', nativeName: 'Suomi' },
      pl: { name: 'Polonais', nativeName: 'Polski' },
      ar: { name: 'Arabe', nativeName: 'العربية' },
      ko: { name: 'Coréen', nativeName: '한국어' },
      hi: { name: 'Hindi', nativeName: 'हिन्दी' },
    };

    // Récupérer les langues distinctes avec le nombre de mots approuvés
    const languageStats = await this.wordModel.aggregate([
      {
        $match: { status: 'approved' },
      },
      {
        $group: {
          _id: '$language',
          wordCount: { $sum: 1 },
        },
      },
      {
        $sort: { wordCount: -1 },
      },
    ]);

    // Formater les résultats
    return languageStats.map((stat) => ({
      code: stat._id,
      name: languageMap[stat._id]?.name || stat._id,
      nativeName: languageMap[stat._id]?.nativeName || stat._id,
      wordCount: stat.wordCount,
    }));
  }

  async addToFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    console.log('addToFavorites - wordId:', wordId);
    console.log('addToFavorites - userId:', userId);

    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    // Vérifier si userId est valide
    if (!userId || !Types.ObjectId.isValid(userId)) {
      console.error('UserId invalide ou non fourni:', userId);
      throw new BadRequestException('ID utilisateur invalide');
    }

    // Vérifier si le mot existe
    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${wordId} non trouvé`);
    }

    // Vérifier si le mot est déjà dans les favoris
    const existingFavorite = await this.favoriteWordModel.findOne({
      wordId,
      userId,
    });

    if (existingFavorite) {
      return { success: true }; // Déjà dans les favoris
    }

    // Ajouter aux favoris
    const newFavorite = new this.favoriteWordModel({
      wordId,
      userId,
      addedAt: new Date(),
    });

    await newFavorite.save();
    return { success: true };
  }

  async removeFromFavorites(
    wordId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(wordId)) {
      throw new BadRequestException('ID de mot invalide');
    }

    // Supprimer des favoris
    const result = await this.favoriteWordModel.deleteOne({
      wordId,
      userId,
    });

    return { success: result.deletedCount > 0 };
  }

  async getFavoriteWords(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Trouver tous les IDs des mots favoris de l'utilisateur
    const favorites = await this.favoriteWordModel
      .find({ userId })
      .skip(skip)
      .limit(limit)
      .sort({ addedAt: -1 })
      .exec();

    const wordIds = favorites.map((fav) => fav.wordId);
    const total = await this.favoriteWordModel.countDocuments({ userId });

    // Si aucun favori, retourner un tableau vide
    if (wordIds.length === 0) {
      return {
        words: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Récupérer les mots correspondants
    const words = await this.wordModel
      .find({ _id: { $in: wordIds } })
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
      .exec();

    // Fonction pour comparer les IDs MongoDB de manière sûre
    const compareIds = (id1: any, id2: any): boolean => {
      return String(id1) === String(id2);
    };

    // Réordonner les mots dans le même ordre que les favoris
    const orderedWords = [] as Word[];

    for (const id of wordIds) {
      let found = false;
      for (const word of words) {
        if (!found && word && word._id && compareIds(word._id, id)) {
          orderedWords.push(word as unknown as Word);
          found = true;
        }
      }
    }

    return {
      words: orderedWords,
      total,
      limit,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async checkIfFavorite(wordId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(wordId)) {
      return false;
    }

    const favorite = await this.favoriteWordModel.findOne({
      wordId,
      userId,
    });

    return !!favorite;
  }

  async shareWordWithUser(
    wordId: string,
    fromUserId: string,
    toUsername: string,
  ): Promise<{ success: boolean; message: string }> {
    // Vérifier si le mot existe
    if (!Types.ObjectId.isValid(wordId)) {
      return { success: false, message: 'ID de mot invalide' };
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      return { success: false, message: `Mot avec l'ID ${wordId} non trouvé` };
    }

    // Trouver l'utilisateur de destination par son nom d'utilisateur
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
        success: true,
        message: `Le mot est déjà dans les favoris de ${toUsername}`,
      };
    }

    // Ajouter aux favoris de l'utilisateur de destination
    const newFavorite = new this.favoriteWordModel({
      wordId,
      userId: toUser._id,
      addedAt: new Date(),
      sharedBy: fromUserId, // Optionnel: enregistrer qui a partagé le mot
    });

    await newFavorite.save();

    // TODO: Optionnel: Envoyer une notification à l'utilisateur de destination

    return {
      success: true,
      message: `Mot partagé avec succès avec ${toUsername}`,
    };
  }

  async getAdminPendingWords(
    page = 1,
    limit = 10,
  ): Promise<{
    words: Word[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const total = await this.wordModel.countDocuments({ status: 'pending' });
    const words = await this.wordModel
      .find({ status: 'pending' })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .populate('categoryId', 'name')
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
    status: 'approved' | 'rejected',
  ): Promise<Word> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de mot invalide');
    }

    const word = await this.wordModel.findById(id);
    if (!word) {
      throw new NotFoundException(`Mot avec l'ID ${id} non trouvé`);
    }

    word.status = status;
    return word.save();
  }
}
