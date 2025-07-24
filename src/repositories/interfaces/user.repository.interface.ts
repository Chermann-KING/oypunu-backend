import { User } from '../../users/schemas/user.schema';
import { RegisterDto } from '../../users/dto/register.dto';

/**
 * 👤 INTERFACE USER REPOSITORY
 * 
 * Contrat abstrait pour l'accès aux données des utilisateurs.
 * Sécurité et authentification découplées de la couche de persistance.
 */
export interface IUserRepository {
  // ========== CRUD DE BASE ==========
  
  /**
   * Créer un nouvel utilisateur
   */
  create(userData: RegisterDto): Promise<User>;
  
  /**
   * Récupérer un utilisateur par ID
   */
  findById(id: string): Promise<User | null>;
  
  /**
   * Récupérer un utilisateur par email
   */
  findByEmail(email: string): Promise<User | null>;
  
  /**
   * Récupérer un utilisateur par nom d'utilisateur
   */
  findByUsername(username: string): Promise<User | null>;
  
  /**
   * Mettre à jour un utilisateur
   */
  update(id: string, updateData: Partial<User>): Promise<User | null>;
  
  /**
   * Supprimer un utilisateur
   */
  delete(id: string): Promise<boolean>;
  
  // ========== AUTHENTIFICATION ==========
  
  /**
   * Vérifier si un email existe
   */
  existsByEmail(email: string): Promise<boolean>;
  
  /**
   * Vérifier si un nom d'utilisateur existe
   */
  existsByUsername(username: string): Promise<boolean>;
  
  /**
   * Rechercher utilisateur pour authentification sociale
   */
  findBySocialProvider(provider: string, providerId: string): Promise<User | null>;
  
  /**
   * Mettre à jour le mot de passe
   */
  updatePassword(id: string, hashedPassword: string): Promise<boolean>;
  
  /**
   * Marquer l'email comme vérifié
   */
  markEmailAsVerified(id: string): Promise<boolean>;
  
  // ========== PROFIL ET PRÉFÉRENCES ==========
  
  /**
   * Mettre à jour les langues de l'utilisateur
   */
  updateLanguagePreferences(id: string, data: {
    nativeLanguageId?: string;
    learningLanguageIds?: string[];
  }): Promise<User | null>;
  
  /**
   * Mettre à jour la photo de profil
   */
  updateProfilePicture(id: string, pictureUrl: string): Promise<boolean>;
  
  /**
   * Mettre à jour les paramètres de notification
   */
  updateNotificationSettings(id: string, settings: Record<string, boolean>): Promise<boolean>;
  
  // ========== STATISTIQUES ==========
  
  /**
   * Compter le nombre total d'utilisateurs
   */
  count(): Promise<number>;
  
  /**
   * Compter les utilisateurs par rôle
   */
  countByRole(role: string): Promise<number>;
  
  /**
   * Utilisateurs actifs (dernière connexion récente)
   */
  findActiveUsers(days?: number): Promise<User[]>;
  
  /**
   * Utilisateurs par langue native
   */
  findByNativeLanguage(languageId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<User[]>;
  
  // ========== RECHERCHE ET FILTRAGE ==========
  
  /**
   * Rechercher des utilisateurs
   */
  search(query: string, options?: {
    limit?: number;
    offset?: number;
    role?: string;
  }): Promise<User[]>;
  
  /**
   * Récupérer utilisateurs avec pagination
   */
  findAll(options?: {
    page?: number;
    limit?: number;
    role?: string;
    isEmailVerified?: boolean;
  }): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Récupérer les administrateurs
   */
  findAdmins(): Promise<User[]>;

  /**
   * Récupérer les statistiques d'activité d'un utilisateur
   */
  getUserStats(userId: string): Promise<{
    wordsCount: number;
    postsCount: number;
  }>;

  /**
   * Compter le nombre total d'utilisateurs
   */
  count(): Promise<number>;
}