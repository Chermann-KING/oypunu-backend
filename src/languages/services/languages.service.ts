import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Language } from '../schemas/language.schema';
import { User, UserRole } from '../../users/schemas/user.schema';
import {
  CreateLanguageDto,
  ApproveLanguageDto,
  RejectLanguageDto,
} from '../dto/create-language.dto';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';
import { ILanguageRepository } from '../../repositories/interfaces/language.repository.interface';

@Injectable()
export class LanguagesService {
  constructor(
    @Inject('ILanguageRepository') private languageRepository: ILanguageRepository,
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
        const existsAlready = await this.languageRepository.existsByNameOrCode({
          name: createLanguageDto.name,
          nativeName: createLanguageDto.nativeName,
          iso639_1: createLanguageDto.iso639_1,
          iso639_2: createLanguageDto.iso639_2,
          iso639_3: createLanguageDto.iso639_3,
        });

        if (existsAlready) {
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

        // Créer la langue avec les valeurs par défaut
        const languageData = {
          ...createLanguageDto,
          scripts: defaultScripts,
          proposedBy: user._id,
          systemStatus: 'proposed' as const, // Toutes les propositions commencent en "proposed"
          wordCount: 0,
          userCount: 0,
          contributorCount: 0,
          translationCount: 0,
          isVisible: false, // Les langues proposées ne sont pas visibles initialement
          isFeatured: false,
          sortOrder: 0,
          flagEmojis: [], // Sera rempli lors de l'approbation
          sources: [],
        };

        console.log('💾 Tentative de sauvegarde de la langue:', languageData.name);
        const savedLanguage = await this.languageRepository.create(languageData, user._id.toString(), 'pending');
        console.log('✅ Langue sauvegardée avec succès:', {
          id: (savedLanguage as any)._id,
          name: savedLanguage.name,
          status: 'pending',
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
        const language = await this.languageRepository.findById(languageId);
        if (!language) {
          throw new NotFoundException('Langue non trouvée');
        }

        if ((language as any).systemStatus !== 'proposed') {
          throw new BadRequestException(
            'Seules les langues proposées peuvent être approuvées',
          );
        }

        const updateData: any = {
          systemStatus: 'active',
          approvedBy: admin._id,
          approvedAt: new Date(),
          isVisible: true,
        };

        if (approveDto.isFeatured !== undefined) {
          updateData.isFeatured = approveDto.isFeatured;
        }

        if (approveDto.sortOrder !== undefined) {
          updateData.sortOrder = approveDto.sortOrder;
        }

        const updatedLanguage = await this.languageRepository.update(languageId, updateData);
        if (!updatedLanguage) {
          throw new NotFoundException('Erreur lors de la mise à jour');
        }
        return updatedLanguage;
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
        const language = await this.languageRepository.findById(languageId);
        if (!language) {
          throw new NotFoundException('Langue non trouvée');
        }

        const updateData = {
          systemStatus: 'deprecated' as const,
          rejectionReason: rejectDto.rejectionReason,
          approvedBy: admin._id,
          approvedAt: new Date(),
          isVisible: false,
        };

        const updatedLanguage = await this.languageRepository.update(languageId, updateData);
        if (!updatedLanguage) {
          throw new NotFoundException('Erreur lors de la mise à jour');
        }
        return updatedLanguage;
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
        const result = await this.languageRepository.findAll({
          status: 'approved',
          sortBy: 'name',
          sortOrder: 'asc',
        });
        return result.languages.filter((lang: any) => lang.isVisible);
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
        const result = await this.languageRepository.findAll({
          status: 'approved',
          sortBy: 'name',
          sortOrder: 'asc',
        });
        return result.languages.filter((lang: any) => {
          return lang.region && 
                 lang.region.toLowerCase().includes(region.toLowerCase()) &&
                 lang.systemStatus === 'active' && 
                 lang.isVisible;
        });
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

        const result = await this.languageRepository.findAll({
          status: 'approved',
          sortBy: 'name',
          sortOrder: 'asc',
        });
        return result.languages.filter((lang: any) => {
          return africanRegions.includes(lang.region) &&
                 lang.systemStatus === 'active' && 
                 lang.isVisible;
        });
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
        const result = await this.languageRepository.findAll({
          status: 'pending',
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        return result.languages;
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
        const statusCounts = await this.languageRepository.countByStatus();
        
        // Les statistiques d'agrégation complexes nécessiteraient une extension du repository
        // Pour l'instant, retourner les statistiques de base
        return {
          byStatus: [
            { _id: 'approved', count: statusCounts.approved },
            { _id: 'pending', count: statusCounts.pending },
            { _id: 'rejected', count: statusCounts.rejected },
          ],
          byRegion: [], // À implémenter avec des méthodes d'agrégation
          totalActive: statusCounts.approved,
          totalPending: statusCounts.pending,
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
        return this.languageRepository.searchByName(query, {
          limit: 20,
          status: 'approved',
        });
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
        const language = await this.languageRepository.findById(id);
        if (!language) {
          throw new NotFoundException('Langue non trouvée');
        }
        // Note: Population will need to be handled in the repository layer
        return language;
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
        // Les opérations d'incrémentation nécessitent une méthode spécialisée
        const language = await this.languageRepository.findById(languageId);
        if (!language) return;
        
        const updateData: any = {};
        if (stats.wordCount !== undefined) {
          updateData.wordCount = (language as any).wordCount + stats.wordCount;
        }
        if (stats.userCount !== undefined) {
          updateData.userCount = (language as any).userCount + stats.userCount;
        }
        if (stats.contributorCount !== undefined) {
          updateData.contributorCount = (language as any).contributorCount + stats.contributorCount;
        }
        if (stats.translationCount !== undefined) {
          updateData.translationCount = (language as any).translationCount + stats.translationCount;
        }
        
        return this.languageRepository.update(languageId, updateData);
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
        return this.languageRepository.getMostPopular(limit);
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
        const result = await this.languageRepository.findAll({
          status: 'approved',
          sortBy: 'name',
          sortOrder: 'asc',
        });
        return result.languages.filter((lang: any) => {
          return lang.systemStatus === 'active' &&
                 lang.isFeatured &&
                 lang.isVisible;
        });
      },
      'Language'
    );
  }
}
