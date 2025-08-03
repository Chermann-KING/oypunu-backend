import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../../dictionary/schemas/category.schema';
import { CreateCategoryDto } from '../../dictionary/dto/create-category.dto';
import { ICategoryRepository } from '../interfaces/category.repository.interface';
import { DatabaseErrorHandler } from "../../common/errors";

/**
 * 📚 REPOSITORY CATEGORY - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository Category utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les catégories.
 * 
 * Fonctionnalités :
 * - CRUD complet des catégories
 * - Gestion hiérarchique (parent/enfant)
 * - Recherche et filtrage
 * - Statistiques d'utilisation
 * - Validation et intégrité
 */
@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(categoryData: CreateCategoryDto, createdBy: string): Promise<Category> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const newCategory = new this.categoryModel({
          ...categoryData,
          createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        });
        return newCategory.save();
      },
      'Category'
    );
  }

  async findById(id: string): Promise<Category | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.categoryModel.findById(id).exec();
      },
      'Category',
      id
    );
  }

  async findByName(name: string): Promise<Category | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        return this.categoryModel.findOne({ 
          name: new RegExp(`^${name}$`, 'i') 
        }).exec();
      },
      'Category',
      name
    );
  }

  async update(id: string, updateData: Partial<Category>): Promise<Category | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.categoryModel
          .findByIdAndUpdate(
            id,
            { ...updateData, updatedAt: new Date() },
            { new: true }
          )
          .exec();
      },
      'Category',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }

        // Vérifier s'il y a des sous-catégories
        const hasChildren = await this.hasSubcategories(id);
        if (hasChildren) {
          throw new Error('Cannot delete category with subcategories');
        }

        // Vérifier s'il y a des mots associés
        const hasWordsAssociated = await this.hasWords(id);
        if (hasWordsAssociated) {
          throw new Error('Cannot delete category with associated words');
        }

        const result = await this.categoryModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'Category',
      id
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async findAll(options: {
    page?: number;
    limit?: number;
    includeInactive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    categories: Category[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const {
          page = 1,
          limit = 10,
          includeInactive = false,
          sortBy = 'name',
          sortOrder = 'asc'
        } = options;

        // Construire le filtre
        const filter: any = {};
        if (!includeInactive) {
          filter.isActive = true;
        }

        // Construire le tri
        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Exécuter les requêtes en parallèle
        const [categories, total] = await Promise.all([
          this.categoryModel
            .find(filter)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .exec(),
          this.categoryModel.countDocuments(filter).exec(),
        ]);

        return {
          categories,
          total,
          page,
          limit,
        };
      },
      'Category'
    );
  }

  async search(query: string, options: {
    limit?: number;
    includeInactive?: boolean;
  } = {}): Promise<Category[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const { limit = 10, includeInactive = false } = options;
        const searchRegex = new RegExp(query, 'i');

        const filter: any = {
          $or: [
            { name: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
          ]
        };

        if (!includeInactive) {
          filter.isActive = true;
        }

        return this.categoryModel
          .find(filter)
          .limit(limit)
          .sort({ name: 1 })
          .exec();
      },
      'Category'
    );
  }

  async findActive(): Promise<Category[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        return this.categoryModel
          .find({ isActive: true })
          .sort({ order: 1, name: 1 })
          .exec();
      },
      'Category'
    );
  }

  async findByParent(parentId: string | null): Promise<Category[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const filter: any = { isActive: true };
        
        if (parentId === null) {
          filter.parentId = { $exists: false };
        } else {
          if (!Types.ObjectId.isValid(parentId)) {
            return [];
          }
          filter.parentId = parentId;
        }

        return this.categoryModel
          .find(filter)
          .sort({ order: 1, name: 1 })
          .exec();
      },
      'Category'
    );
  }

  async findRootCategories(): Promise<Category[]> {
    return this.findByParent(null);
  }

  // ========== HIÉRARCHIE ==========

  async findChildrenRecursive(parentId: string): Promise<Category[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(parentId)) {
          return [];
        }

        const allCategories: Category[] = [];
        const processQueue = [parentId];

        while (processQueue.length > 0) {
          const currentParentId = processQueue.shift()!;
          const children = await this.findByParent(currentParentId);
          
          for (const child of children) {
            allCategories.push(child);
            processQueue.push((child as any)._id.toString());
          }
        }

        return allCategories;
      },
      'Category'
    );
  }

  async getCategoryPath(categoryId: string): Promise<Category[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(categoryId)) {
          return [];
        }

        const path: Category[] = [];
        let currentCategoryId = categoryId;

        while (currentCategoryId) {
          const category = await this.findById(currentCategoryId);
          if (!category) break;
          
          path.unshift(category); // Ajouter au début pour avoir l'ordre racine -> feuille
          currentCategoryId = (category as any).parentId;
        }

        return path;
      },
      'Category'
    );
  }

  async isDescendantOf(categoryId: string, ancestorId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(categoryId) || !Types.ObjectId.isValid(ancestorId)) {
          return false;
        }

        const path = await this.getCategoryPath(categoryId);
        return path.some(cat => (cat as any)._id.toString() === ancestorId);
      },
      'Category'
    );
  }

  // ========== STATISTIQUES ==========

  async countWords(categoryId: string, includeChildren: boolean = false): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(categoryId)) {
          return 0;
        }

        // Cette méthode nécessiterait l'accès au modèle Word pour compter
        // Pour l'instant, retourner 0 - à implémenter avec une jointure ou aggregation
        return 0;
      },
      'Category'
    );
  }

  async getUsageStats(): Promise<{
    categoryId: string;
    categoryName: string;
    wordCount: number;
    totalUsage: number;
  }[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Cette méthode nécessiterait des jointures avec d'autres collections
        // Pour l'instant, retourner un tableau vide - à implémenter avec aggregation
        return [];
      },
      'Category'
    );
  }

  async getMostPopular(limit: number = 10): Promise<Category[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Pour l'instant, retourner les catégories actives triées par nom
        // À améliorer avec des statistiques d'utilisation réelles
        return this.categoryModel
          .find({ isActive: true })
          .limit(limit)
          .sort({ name: 1 })
          .exec();
      },
      'Category'
    );
  }

  async countSubcategories(categoryId: string): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(categoryId)) {
          return 0;
        }
        return this.categoryModel.countDocuments({ parentId: categoryId }).exec();
      },
      'Category'
    );
  }

  // ========== VALIDATION ==========

  async existsByName(name: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const category = await this.findByName(name);
        return category !== null;
      },
      'Category'
    );
  }

  async hasWords(categoryId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Cette méthode nécessiterait l'accès au modèle Word
        // Pour l'instant, retourner false - à implémenter avec une requête vers WordRepository
        return false;
      },
      'Category'
    );
  }

  async hasSubcategories(categoryId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const count = await this.countSubcategories(categoryId);
        return count > 0;
      },
      'Category'
    );
  }

  // ========== GESTION DE L'ÉTAT ==========

  async toggleActive(categoryId: string, isActive: boolean): Promise<Category | null> {
    return this.update(categoryId, { isActive });
  }

  async reorder(categoryId: string, newOrder: number): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.update(categoryId, { order: newOrder });
        return result !== null;
      },
      'Category',
      categoryId
    );
  }
}