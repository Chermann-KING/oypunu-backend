/**
 * @fileoverview Service de gestion des catégories du dictionnaire O'Ypunu
 *
 * Ce service gère les opérations CRUD sur les catégories de mots
 * avec organisation hiérarchique, validation d'unicité et intégration
 * avec le pattern Repository pour abstraction des données.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { Types } from "mongoose";
import { Category } from "../schemas/category.schema";
import { CreateCategoryDto } from "../dto/create-category.dto";
import { UpdateCategoryDto } from "../dto/update-category.dto";
import {
  ProposeCategoryDto,
  ModerateCategoryDto,
} from "../dto/propose-category.dto";
import { ICategoryRepository } from "../../repositories/interfaces/category.repository.interface";
import { ILanguageRepository } from "../../repositories/interfaces/language.repository.interface";
import { User } from "../../users/schemas/user.schema";

/**
 * Service de gestion des catégories du dictionnaire O'Ypunu
 *
 * Gère l'organisation hiérarchique des mots par catégories avec
 * validation d'unicité, opérations CRUD complètes et recherche
 * optimisée via le pattern Repository.
 *
 * ## Fonctionnalités principales :
 * - Création de catégories avec validation d'unicité
 * - Organisation hiérarchique parent/enfant
 * - Recherche et filtrage de catégories
 * - Mise à jour et suppression avec contrôles
 * - Comptage des mots par catégorie
 *
 * @class CategoriesService
 * @version 1.0.0
 */
@Injectable()
export class CategoriesService {
  constructor(
    @Inject("ICategoryRepository")
    private categoryRepository: ICategoryRepository,
    @Inject("ILanguageRepository")
    private languageRepository: ILanguageRepository
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    // Vérifier si la catégorie existe déjà dans la même langue
    const existsAlready = await this.categoryRepository.existsByName(
      createCategoryDto.name
    );

    if (existsAlready) {
      throw new BadRequestException(
        `La catégorie "${createCategoryDto.name}" existe déjà`
      );
    }

    // Créer la nouvelle catégorie
    return this.categoryRepository.create(createCategoryDto, "system");
  }

  async findAll(language?: string): Promise<Category[]> {    const result = await this.categoryRepository.findAll({
      includeInactive: false,
      sortBy: "name",
      sortOrder: "asc",
    });    console.log(
      "📦 Catégories brutes:",
      result.categories.map((cat) => ({
        id: (cat as any)._id,
        name: cat.name,
        language: (cat as any).language,
        languageId: (cat as any).languageId,
      }))
    );

    if (language) {
      // Filtrer par langue si spécifiée
      // Support à la fois pour 'language' (code) et 'languageId' (ObjectId)

      // Essayer de trouver la langue par son code pour obtenir son ObjectId
      let languageObjectId: string | null = null;

      // Cas 1: Si c'est déjà un ObjectId valide, l'utiliser directement
      if (Types.ObjectId.isValid(language)) {
        languageObjectId = language;
        console.log("✅ Utilisation directe de l'ObjectId:", languageObjectId);
      } else {
        // Cas 2: Essayer de trouver la langue par son code
        try {
          const languageEntity =
            await this.languageRepository.findByCode(language);
          if (languageEntity) {
            languageObjectId = (languageEntity as any)._id?.toString();
            console.log("🔍 Langue trouvée:", {
              code: language,
              id: languageObjectId,
              name: (languageEntity as any).name,
            });
          } else {
            console.warn("⚠️ Aucune langue trouvée avec le code:", language);
          }
        } catch (error) {
          console.warn(
            `❌ Erreur lors de la recherche de langue avec le code: ${language}`,
            error
          );
        }
      }

      const filteredCategories = result.categories.filter((cat: any) => {
        // Vérifie d'abord le champ 'language' (pour compatibilité avec les anciennes catégories)
        if (cat.language === language) {
          console.log("✅ Catégorie matchée par champ language:", cat.name);
          return true;
        }

        // Si on a trouvé l'ObjectId de la langue, comparer avec languageId
        if (cat.languageId && languageObjectId) {
          const match = cat.languageId.toString() === languageObjectId;
          if (match) {
            console.log("✅ Catégorie matchée par languageId:", cat.name);
          }
          return match;
        }

        return false;
      });      return filteredCategories;
    }

    return result.categories;
  }

  async findOne(id: string): Promise<Category> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("ID de catégorie invalide");
    }

    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto
  ): Promise<Category> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("ID de catégorie invalide");
    }

    // Vérifier si la catégorie existe
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    // Mettre à jour la catégorie
    const updatedCategory = await this.categoryRepository.update(
      id,
      updateCategoryDto
    );

    if (!updatedCategory) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    return updatedCategory;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("ID de catégorie invalide");
    }

    // Vérifier si la catégorie existe
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    // Supprimer la catégorie
    const deleted = await this.categoryRepository.delete(id);

    return { success: deleted };
  }

  // ===== MÉTHODES POUR LE WORKFLOW D'APPROBATION =====

  async proposeCategory(
    proposeCategoryDto: ProposeCategoryDto,
    user: User
  ): Promise<Category> {
    try {
      console.log("📥 Proposition de catégorie reçue:", proposeCategoryDto);
      console.log("👤 Utilisateur:", user);

      // Validation des données
      if (!proposeCategoryDto.name || proposeCategoryDto.name.trim() === "") {
        throw new BadRequestException("Le nom de la catégorie est requis");
      }

      // Vérifier qu'au moins languageId ou language est fourni
      if (!proposeCategoryDto.languageId && !proposeCategoryDto.language) {
        throw new BadRequestException(
          "La langue est requise (languageId ou language)"
        );
      }

      // Vérifier si une catégorie similaire existe déjà
      const existingCategory =
        await this.categoryRepository.findByNameAndLanguage(
          proposeCategoryDto.name.trim(),
          proposeCategoryDto.languageId || proposeCategoryDto.language
        );

      if (existingCategory) {
        throw new BadRequestException(
          `Une catégorie avec le nom "${proposeCategoryDto.name}" existe déjà pour cette langue`
        );
      }

      // Créer la catégorie avec statut "pending"
      const categoryData = {
        name: proposeCategoryDto.name.trim(),
        description: proposeCategoryDto.description?.trim(),
        languageId: proposeCategoryDto.languageId,
        language: proposeCategoryDto.language,
        systemStatus: "pending",
        proposedBy: (user as any)._id,
        isActive: false, // Inactive jusqu'à approbation
      };

      const category =
        await this.categoryRepository.createWithProposal(categoryData);

      console.log("✅ Catégorie proposée avec succès:", {
        id: (category as any)._id,
        name: category.name,
        systemStatus: category.systemStatus,
      });

      return category;
    } catch (error) {
      console.error("❌ Erreur lors de la proposition de catégorie:", error);
      throw error;
    }
  }

  async getPendingCategories(user: User): Promise<Category[]> {
    try {      // Vérifier que l'utilisateur a les permissions admin
      if (!["admin", "superadmin"].includes(user.role)) {
        throw new BadRequestException("Permissions insuffisantes");
      }

      const pendingCategories =
        await this.categoryRepository.findByStatus("pending");      return pendingCategories;
    } catch (error) {
      console.error(
        "❌ Erreur lors de la récupération des catégories en attente:",
        error
      );
      throw error;
    }
  }

  async moderateCategory(
    categoryId: string,
    moderateDto: ModerateCategoryDto,
    moderator: User
  ): Promise<Category> {
    try {      if (!Types.ObjectId.isValid(categoryId)) {
        throw new BadRequestException("ID de catégorie invalide");
      }

      // Vérifier que l'utilisateur a les permissions admin
      if (!["admin", "superadmin"].includes(moderator.role)) {
        throw new BadRequestException("Permissions insuffisantes");
      }

      // Récupérer la catégorie
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) {
        throw new NotFoundException(
          `Catégorie avec l'ID ${categoryId} non trouvée`
        );
      }

      // Vérifier que la catégorie est en attente
      if (category.systemStatus !== "pending") {
        throw new BadRequestException(
          `La catégorie n'est pas en attente de modération (statut: ${category.systemStatus})`
        );
      }

      // Appliquer la modération
      const updateData: any = {
        systemStatus: moderateDto.action === "approve" ? "active" : "rejected",
        moderatedBy: (moderator as any)._id,
        moderatedAt: new Date(),
        moderationNotes: moderateDto.moderationNotes,
      };

      // Si approuvée, activer la catégorie
      if (moderateDto.action === "approve") {
        updateData.isActive = true;
      }

      const updatedCategory = await this.categoryRepository.update(
        categoryId,
        updateData
      );

      if (!updatedCategory) {
        throw new NotFoundException(
          `Catégorie avec l'ID ${categoryId} non trouvée`
        );
      }

      console.log("✅ Catégorie modérée avec succès:", {
        id: (updatedCategory as any)._id,
        name: updatedCategory.name,
        systemStatus: updatedCategory.systemStatus,
        action: moderateDto.action,
      });

      return updatedCategory;
    } catch (error) {
      console.error("❌ Erreur lors de la modération de catégorie:", error);
      throw error;
    }
  }

  /**
   * Récupérer les statistiques des catégories
   */
  async getCategoryStats(): Promise<any> {
    try {      // Compter les catégories par statut
      const [totalActive, totalPending] = await Promise.all([
        this.categoryRepository.findByStatus("active"),
        this.categoryRepository.findByStatus("pending"),
      ]);

      const stats = {
        totalActive: totalActive.length,
        totalPending: totalPending.length,
        byStatus: [
          { status: "active", count: totalActive.length },
          { status: "pending", count: totalPending.length },
        ],
      };

      console.log("✅ Statistiques des catégories récupérées:", stats);

      return stats;
    } catch (error) {
      console.error(
        "❌ Erreur lors de la récupération des statistiques des catégories:",
        error
      );
      throw error;
    }
  }
}
