import { Language } from '../../languages/schemas/language.schema';
import { CreateLanguageDto } from '../../languages/dto/create-language.dto';

/**
 * 🌍 INTERFACE LANGUAGE REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des langues.
 * Gestion des langues proposées, approuvées et leur cycle de vie.
 */
export interface ILanguageRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer une nouvelle langue
   */
  create(languageData: CreateLanguageDto, createdBy: string, status?: 'pending' | 'approved' | 'rejected'): Promise<Language>;
  
  /**
   * Récupérer une langue par ID
   */
  findById(id: string): Promise<Language | null>;
  
  /**
   * Récupérer une langue par critères multiples
   */
  findByNameOrCode(criteria: {
    name?: string;
    nativeName?: string;
    iso639_1?: string;
    iso639_2?: string;
    iso639_3?: string;
  }): Promise<Language | null>;
  
  /**
   * Mettre à jour une langue
   */
  update(id: string, updateData: Partial<Language>): Promise<Language | null>;
  
  /**
   * Supprimer une langue
   */
  delete(id: string): Promise<boolean>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Récupérer toutes les langues avec pagination
   */
  findAll(options?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    languages: Language[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Rechercher des langues par nom
   */
  searchByName(query: string, options?: {
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected';
  }): Promise<Language[]>;
  
  /**
   * Récupérer les langues approuvées uniquement
   */
  findApproved(): Promise<Language[]>;
  
  /**
   * Récupérer les langues en attente d'approbation
   */
  findPending(): Promise<Language[]>;
  
  // ========== GESTION DU STATUT ==========
  
  /**
   * Approuver une langue
   */
  approve(id: string, approvedBy: string, reason?: string): Promise<Language | null>;
  
  /**
   * Rejeter une langue
   */
  reject(id: string, rejectedBy: string, reason: string): Promise<Language | null>;
  
  /**
   * Changer le statut d'une langue
   */
  updateStatus(id: string, status: 'pending' | 'approved' | 'rejected', updatedBy: string, reason?: string): Promise<Language | null>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter les langues par statut
   */
  countByStatus(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }>;
  
  /**
   * Récupérer les statistiques d'utilisation des langues
   */
  getUsageStats(): Promise<{
    languageId: string;
    languageName: string;
    wordsCount: number;
    usersCount: number;
    totalUsage: number;
  }[]>;
  
  /**
   * Récupérer les langues les plus populaires
   */
  getMostPopular(limit?: number): Promise<Language[]>;
  
  // ========== VALIDATION ==========
  
  /**
   * Vérifier si une langue existe déjà
   */
  existsByNameOrCode(criteria: {
    name?: string;
    nativeName?: string;
    iso639_1?: string;
    iso639_2?: string;
    iso639_3?: string;
  }): Promise<boolean>;
  
  /**
   * Vérifier si un code ISO est déjà utilisé
   */
  existsByIsoCode(isoCode: string): Promise<boolean>;
}