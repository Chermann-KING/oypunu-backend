import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Language, LanguageDocument } from '../schemas/language.schema';
import { User, UserRole } from '../../users/schemas/user.schema';
import {
  CreateLanguageDto,
  ApproveLanguageDto,
  RejectLanguageDto,
} from '../dto/create-language.dto';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

@Injectable()
export class LanguagesService {
  constructor(
    @InjectModel(Language.name) private languageModel: Model<LanguageDocument>,
  ) {}

  /**
   * 📝 PROPOSER une nouvelle langue (tous les utilisateurs authentifiés)
   */
  async proposeLanguage(
    createLanguageDto: CreateLanguageDto,
    user: User,
  ): Promise<Language> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        // Vérifier que la langue n'existe pas déjà
        const existingLanguage = await this.languageModel.findOne({
          $or: [
            { name: new RegExp(`^${createLanguageDto.name}$`, 'i') },
            { nativeName: new RegExp(`^${createLanguageDto.nativeName}$`, 'i') },
            ...(createLanguageDto.iso639_1
              ? [{ iso639_1: createLanguageDto.iso639_1 }]
              : []),
            ...(createLanguageDto.iso639_2
              ? [{ iso639_2: createLanguageDto.iso639_2 }]
              : []),
            ...(createLanguageDto.iso639_3
              ? [{ iso639_3: createLanguageDto.iso639_3 }]
              : []),
          ],
        });

        if (existingLanguage) {
          throw new BadRequestException(
            'Une langue avec ce nom ou code existe déjà',
          );
        }

        // Les scripts par défaut si non spécifiés (Latin pour les langues africaines)
        const defaultScripts = createLanguageDto.scripts?.length
          ? createLanguageDto.scripts
          : [
              {
                name: 'Latin',
                code: 'Latn',
                direction: 'ltr',
                isDefault: true,
              },
            ];

        const language = new this.languageModel({
          ...createLanguageDto,
          scripts: defaultScripts,
          proposedBy: user._id,
          systemStatus: 'proposed', // Toutes les propositions commencent en "proposed"
          wordCount: 0,
          userCount: 0,
          contributorCount: 0,
          translationCount: 0,
          isVisible: false, // Les langues proposées ne sont pas visibles initialement
          isFeatured: false,
          sortOrder: 0,
          flagEmojis: [], // Sera rempli lors de l'approbation
          sources: [],
        });

        console.log('💾 Tentative de sauvegarde de la langue:', language.name);
        const savedLanguage = await language.save();
        console.log('✅ Langue sauvegardée avec succès:', {
          id: savedLanguage._id,
          name: savedLanguage.name,
          systemStatus: savedLanguage.systemStatus,
        });
        return savedLanguage;
      },
      'Language',
      user._id?.toString()
    );
  }

  /**
   * ✅ APPROUVER une langue (admins/language-admins uniquement)
   */
  async approveLanguage(
    languageId: string,
    approveDto: ApproveLanguageDto,
    admin: User,
  ): Promise<Language> {
    if (!this.canManageLanguages(admin)) {
      throw new ForbiddenException(
        'Permissions insuffisantes pour approuver des langues',
      );
    }

    if (!Types.ObjectId.isValid(languageId)) {
      throw new BadRequestException('ID de langue invalide');
    }

    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const language = await this.languageModel.findById(languageId);
        if (!language) {
          throw new NotFoundException('Langue non trouvée');
        }

        if (language.systemStatus !== 'proposed') {
          throw new BadRequestException(
            'Seules les langues proposées peuvent être approuvées',
          );
        }

        language.systemStatus = 'active';
        language.approvedBy = admin._id as any;
        language.approvedAt = new Date();
        language.isVisible = true;

        if (approveDto.isFeatured !== undefined) {
          language.isFeatured = approveDto.isFeatured;
        }

        if (approveDto.sortOrder !== undefined) {
          language.sortOrder = approveDto.sortOrder;
        }

        return language.save();
      },
      'Language',
      languageId
    );
  }

  /**
   * ❌ REJETER une langue (admins/language-admins uniquement)
   */
  async rejectLanguage(
    languageId: string,
    rejectDto: RejectLanguageDto,
    admin: User,
  ): Promise<Language> {
    if (!this.canManageLanguages(admin)) {
      throw new ForbiddenException(
        'Permissions insuffisantes pour rejeter des langues',
      );
    }

    if (!Types.ObjectId.isValid(languageId)) {
      throw new BadRequestException('ID de langue invalide');
    }

    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const language = await this.languageModel.findById(languageId);
        if (!language) {
          throw new NotFoundException('Langue non trouvée');
        }

        language.systemStatus = 'deprecated';
        language.rejectionReason = rejectDto.rejectionReason;
        language.approvedBy = admin._id as any;
        language.approvedAt = new Date();
        language.isVisible = false;

        return language.save();
      },
      'Language',
      languageId
    );
  }

  /**
   * 📋 LISTER les langues actives (pour les dropdowns, etc.)
   */
  async getActiveLanguages(): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({
            systemStatus: 'active',
            isVisible: true,
          })
          .sort({ isFeatured: -1, sortOrder: 1, speakerCount: -1, name: 1 })
          .exec();
      },
      'Language'
    );
  }

  /**
   * 📋 LISTER les langues par région (pour l'interface africaine)
   */
  async getLanguagesByRegion(region: string): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({
            region: new RegExp(region, 'i'),
            systemStatus: 'active',
            isVisible: true,
          })
          .sort({ speakerCount: -1, wordCount: -1, name: 1 })
          .exec();
      },
      'Language'
    );
  }

  /**
   * 🌍 LISTER les langues africaines prioritaires
   */
  async getAfricanLanguages(): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const africanRegions = [
          'Afrique Centrale',
          "Afrique de l'Ouest",
          "Afrique de l'Est",
          'Afrique du Nord',
          'Afrique Australe',
        ];

        return this.languageModel
          .find({
            region: { $in: africanRegions },
            systemStatus: 'active',
            isVisible: true,
          })
          .sort({ isFeatured: -1, speakerCount: -1, wordCount: -1, name: 1 })
          .exec();
      },
      'Language'
    );
  }

  /**
   * ⏳ LISTER les langues en attente d'approbation (admins)
   */
  async getPendingLanguages(admin: User): Promise<Language[]> {
    if (!this.canManageLanguages(admin)) {
      throw new ForbiddenException('Permissions insuffisantes');
    }

    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({ systemStatus: 'proposed' })
          .populate('proposedBy', 'username email')
          .sort({ createdAt: -1 })
          .exec();
      },
      'Language'
    );
  }

  /**
   * 📊 STATISTIQUES des langues
   */
  async getLanguageStats(): Promise<any> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const stats = await this.languageModel.aggregate([
          {
            $group: {
              _id: '$systemStatus',
              count: { $sum: 1 },
              totalSpeakers: { $sum: '$speakerCount' },
              totalWords: { $sum: '$wordCount' },
            },
          },
        ]);

        const regionStats = await this.languageModel.aggregate([
          {
            $match: { systemStatus: 'active' },
          },
          {
            $group: {
              _id: '$region',
              count: { $sum: 1 },
              totalSpeakers: { $sum: '$speakerCount' },
              totalWords: { $sum: '$wordCount' },
            },
          },
          {
            $sort: { totalWords: -1 },
          },
        ]);

        return {
          byStatus: stats,
          byRegion: regionStats,
          totalActive: await this.languageModel.countDocuments({
            systemStatus: 'active',
          }),
          totalPending: await this.languageModel.countDocuments({
            systemStatus: 'proposed',
          }),
        };
      },
      'Language'
    );
  }

  /**
   * 🔍 RECHERCHER des langues
   */
  async searchLanguages(query: string): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({
            $and: [
              { systemStatus: 'active' },
              {
                $or: [
                  { name: new RegExp(query, 'i') },
                  { nativeName: new RegExp(query, 'i') },
                  { alternativeNames: new RegExp(query, 'i') },
                  { iso639_1: new RegExp(query, 'i') },
                  { iso639_2: new RegExp(query, 'i') },
                  { iso639_3: new RegExp(query, 'i') },
                ],
              },
            ],
          })
          .sort({ speakerCount: -1, wordCount: -1 })
          .limit(20)
          .exec();
      },
      'Language'
    );
  }

  /**
   * 🆔 OBTENIR une langue par ID
   */
  async getLanguageById(id: string): Promise<Language> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de langue invalide');
    }

    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.languageModel
          .findById(id)
          .populate('proposedBy', 'username')
          .populate('approvedBy', 'username')
          .populate('parentLanguage', 'name nativeName')
          .populate('childLanguages', 'name nativeName')
          .exec();
      },
      'Language',
      id,
      true
    );
  }

  /**
   * 📈 METTRE À JOUR les statistiques d'une langue
   */
  async updateLanguageStats(
    languageId: string,
    stats: {
      wordCount?: number;
      userCount?: number;
      contributorCount?: number;
      translationCount?: number;
    },
  ): Promise<void> {
    await DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        return this.languageModel.findByIdAndUpdate(languageId, {
          $inc: stats,
        });
      },
      'Language',
      languageId
    );
  }

  /**
   * 🔐 VÉRIFIER les permissions de gestion des langues
   */
  private canManageLanguages(user: User): boolean {
    return (
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SUPERADMIN ||
      // Futur: ajouter un rôle spécifique "language-admin"
      false
    );
  }

  /**
   * 📋 OBTENIR les langues populaires (avec le plus de mots)
   */
  async getPopularLanguages(limit: number = 10): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({
            systemStatus: 'active',
            isVisible: true,
            wordCount: { $gt: 0 },
          })
          .sort({ wordCount: -1, translationCount: -1, userCount: -1 })
          .limit(limit)
          .exec();
      },
      'Language'
    );
  }

  /**
   * 🌟 OBTENIR les langues mises en avant
   */
  async getFeaturedLanguages(): Promise<Language[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.languageModel
          .find({
            systemStatus: 'active',
            isFeatured: true,
            isVisible: true,
          })
          .sort({ sortOrder: 1, wordCount: -1 })
          .exec();
      },
      'Language'
    );
  }
}
