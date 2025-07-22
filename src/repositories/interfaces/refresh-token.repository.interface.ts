/**
 * 🔐 INTERFACE REPOSITORY - REFRESH TOKENS
 * 
 * Contrat abstrait pour la gestion des refresh tokens.
 * Définit toutes les opérations nécessaires pour le cycle de vie des tokens :
 * - CRUD de base
 * - Gestion sécurisée (révocation, rotation)
 * - Détection de réutilisation malveillante
 * - Maintenance et nettoyage
 */

export interface CreateRefreshTokenData {
  userId: string;
  token: string;
  hashedToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isRevoked?: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  replacedBy?: string;
}

export interface UpdateRefreshTokenData {
  isRevoked?: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  replacedBy?: string;
  lastUsedAt?: Date;
  lastUsedIp?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface RefreshTokenQueryOptions extends PaginationOptions {
  userId?: string;
  isRevoked?: boolean;
  isExpired?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface RefreshToken {
  _id: string;
  userId: string;
  token: string;
  hashedToken: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  replacedBy?: string;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface IRefreshTokenRepository {
  // ===== CRUD DE BASE =====
  
  /**
   * Crée un nouveau refresh token
   */
  create(tokenData: CreateRefreshTokenData): Promise<RefreshToken>;
  
  /**
   * Trouve un token par sa valeur
   */
  findByToken(token: string): Promise<RefreshToken | null>;
  
  /**
   * Trouve un token par son ID
   */
  findById(id: string): Promise<RefreshToken | null>;
  
  /**
   * Met à jour un token
   */
  update(id: string, updateData: UpdateRefreshTokenData): Promise<RefreshToken | null>;
  
  /**
   * Supprime un token
   */
  delete(id: string): Promise<boolean>;

  // ===== GESTION SÉCURISÉE DES TOKENS =====
  
  /**
   * Trouve un token valide (non révoqué et non expiré)
   */
  findValidToken(token: string): Promise<RefreshToken | null>;
  
  /**
   * Révoque un token spécifique
   */
  revokeToken(token: string, reason: string): Promise<boolean>;
  
  /**
   * Révoque tous les tokens d'un utilisateur
   */
  revokeAllUserTokens(userId: string, reason: string): Promise<number>;
  
  /**
   * Marque un token comme remplacé (pour la rotation)
   */
  markAsReplaced(oldTokenId: string, newTokenId: string): Promise<boolean>;
  
  /**
   * Met à jour la dernière utilisation d'un token
   */
  updateLastUsed(tokenId: string, ipAddress?: string): Promise<boolean>;

  // ===== SÉCURITÉ ET DÉTECTION DE FRAUDE =====
  
  /**
   * Détecte la réutilisation d'un token révoqué
   */
  detectTokenReuse(token: string): Promise<{
    isReused: boolean;
    revokedToken?: RefreshToken;
    relatedTokens?: RefreshToken[];
  }>;
  
  /**
   * Trouve la chaîne de tokens (pour détecter les compromissions)
   */
  findTokenChain(tokenId: string): Promise<RefreshToken[]>;
  
  /**
   * Révoque une chaîne complète de tokens (en cas de compromission)
   */
  revokeTokenChain(tokenId: string, reason: string): Promise<number>;

  // ===== RECHERCHE ET FILTRAGE =====
  
  /**
   * Trouve tous les tokens d'un utilisateur
   */
  findByUserId(userId: string, options?: RefreshTokenQueryOptions): Promise<{
    tokens: RefreshToken[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Recherche des tokens avec critères avancés
   */
  findWithCriteria(options: RefreshTokenQueryOptions): Promise<{
    tokens: RefreshToken[];
    total: number;
    page: number;
    limit: number;
  }>;

  // ===== MAINTENANCE ET NETTOYAGE =====
  
  /**
   * Nettoie les tokens expirés
   */
  cleanupExpiredTokens(): Promise<{
    deletedCount: number;
    deletedTokens: string[];
  }>;
  
  /**
   * Nettoie les anciens tokens révoqués (plus anciens que X jours)
   */
  cleanupRevokedTokens(olderThanDays: number): Promise<{
    deletedCount: number;
    deletedTokens: string[];
  }>;

  // ===== STATISTIQUES ET MONITORING =====
  
  /**
   * Compte les tokens actifs d'un utilisateur
   */
  countActiveTokensByUser(userId: string): Promise<number>;
  
  /**
   * Compte tous les tokens d'un utilisateur
   */
  countAllTokensByUser(userId: string): Promise<number>;
  
  /**
   * Statistiques globales des tokens
   */
  getTokenStatistics(): Promise<{
    totalTokens: number;
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    tokensCreatedToday: number;
    tokensRevokedToday: number;
    averageTokenLifetime: number;
  }>;
  
  /**
   * Statistiques par utilisateur
   */
  getUserTokenStatistics(userId: string): Promise<{
    totalTokens: number;
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    lastTokenCreated?: Date;
    lastTokenUsed?: Date;
    averageSessionDuration: number;
  }>;

  // ===== AUDIT ET LOGS =====
  
  /**
   * Trouve les tokens suspects (multiples IP, user agents étranges, etc.)
   */
  findSuspiciousTokens(): Promise<{
    token: RefreshToken;
    suspiciousReasons: string[];
  }[]>;
  
  /**
   * Historique d'utilisation d'un token
   */
  getTokenUsageHistory(tokenId: string): Promise<{
    createdAt: Date;
    lastUsedAt?: Date;
    usageCount: number;
    ipAddresses: string[];
    userAgents: string[];
    isRevoked: boolean;
    revokedReason?: string;
  }>;
}