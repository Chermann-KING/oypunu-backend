import { Category } from '../../dictionary/schemas/category.schema';
import { CreateCategoryDto } from '../../dictionary/dto/create-category.dto';

/**
 * 📚 INTERFACE CATEGORY REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des catégories de mots.
 * Gestion des catégories hiérarchiques et organisationnelles.
 */
export interface ICategoryRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle catégorie
   */
  create(categoryData: CreateCategoryDto, createdBy: string): Promise<Category>;
  
  /**
   * Récupérer une catégorie par ID
   */
  findById(id: string): Promise<Category | null>;
  
  /**
   * Récupérer une catégorie par nom
   */
  findByName(name: string): Promise<Category | null>;
  
  /**
   * Mettre à jour une catégorie
   */
  update(id: string, updateData: Partial<Category>): Promise<Category | null>;
  
  /**
   * Supprimer une catégorie
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Récupérer toutes les catégories avec pagination
   */
  findAll(options?: {
    page?: number;
    limit?: number;
    includeInactive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    categories: Category[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Rechercher des catégories par nom ou description
   */
  search(query: string, options?: {
    limit?: number;
    includeInactive?: boolean;
  }): Promise<Category[]>;
  
  /**
   * Récupérer les catégories actives uniquement
   */
  findActive(): Promise<Category[]>;
  
  /**
   * Récupérer les catégories par parent
   */
  findByParent(parentId: string | null): Promise<Category[]>;
  
  /**
   * Récupérer les catégories racines (sans parent)
   */
  findRootCategories(): Promise<Category[]>;
  
  // ========== HIÉRARCHIE ==========
  
  /**
   * Récupérer tous les enfants d'une catégorie (récursif)
   */
  findChildrenRecursive(parentId: string): Promise<Category[]>;
  
  /**
   * Récupérer le chemin complet d'une catégorie
   */
  getCategoryPath(categoryId: string): Promise<Category[]>;
  
  /**
   * Vérifier si une catégorie est descendante d'une autre
   */
  isDescendantOf(categoryId: string, ancestorId: string): Promise<boolean>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les mots dans une catégorie
   */
  countWords(categoryId: string, includeChildren?: boolean): Promise<number>;
  
  /**
   * Récupérer les statistiques d'utilisation des catégories
   */
  getUsageStats(): Promise<{
    categoryId: string;
    categoryName: string;
    wordCount: number;
    totalUsage: number;
  }[]>;
  
  /**
   * Récupérer les catégories les plus populaires
   */
  getMostPopular(limit?: number): Promise<Category[]>;
  
  /**
   * Compter les sous-catégories
   */
  countSubcategories(categoryId: string): Promise<number>;
  
  // ========== VALIDATION ==========
  
  /**
   * Vérifier si une catégorie existe par nom
   */
  existsByName(name: string): Promise<boolean>;
  
  /**
   * Vérifier si une catégorie a des mots associés
   */
  hasWords(categoryId: string): Promise<boolean>;
  
  /**
   * Vérifier si une catégorie a des sous-catégories
   */
  hasSubcategories(categoryId: string): Promise<boolean>;
  
  // ========== GESTION DE L'ÉTAT ==========
  
  /**
   * Activer/désactiver une catégorie
   */
  toggleActive(categoryId: string, isActive: boolean): Promise<Category | null>;
  
  /**
   * Réorganiser l'ordre des catégories
   */
  reorder(categoryId: string, newOrder: number): Promise<boolean>;
}