/**
 * 📊 INTERFACE REPOSITORY - ACTIVITY FEED
 * 
 * Contrat abstrait pour la gestion du flux d'activités utilisateur.
 * Définit toutes les opérations nécessaires pour :
 * - CRUD de base des activités
 * - Calculs de statistiques et streaks
 * - Agrégations temporelles et par langue
 * - Maintenance et nettoyage
 */

export interface CreateActivityFeedData {
  activityType: string;
  entityId: string;
  entityType: string;
  userId: string;
  username: string;
  isPublic?: boolean;
  isVisible?: boolean;
  metadata?: {
    wordName?: string;
    language?: string;
    languageCode?: string;
    languageName?: string;
    translatedWord?: string;
    targetLanguage?: string;
    targetLanguageCode?: string;
    synonymsCount?: number;
    postTitle?: string;
    communityName?: string;
  };
}

export interface UpdateActivityFeedData {
  isPublic?: boolean;
  isVisible?: boolean;
  metadata?: {
    wordName?: string;
    language?: string;
    languageCode?: string;
    languageName?: string;
    translatedWord?: string;
    targetLanguage?: string;
    targetLanguageCode?: string;
    synonymsCount?: number;
    postTitle?: string;
    communityName?: string;
  };
}

export interface ActivityFeedQueryOptions extends PaginationOptions {
  userId?: string;
  activityType?: string | string[];
  entityType?: string | string[];
  language?: string | string[];
  isPublic?: boolean;
  startDate?: Date;
  endDate?: Date;
  entityId?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityFeed {
  _id: string;
  activityType: string;
  entityId: string;
  entityType: string;
  userId: string;
  username: string;
  isPublic: boolean;
  isVisible: boolean;
  metadata?: {
    wordName?: string;
    language?: string;
    languageCode?: string;
    languageName?: string;
    translatedWord?: string;
    targetLanguage?: string;
    targetLanguageCode?: string;
    synonymsCount?: number;
    postTitle?: string;
    communityName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityStreakData {
  currentStreak: number;
  longestStreak: number;
  streakStartDate?: Date;
  streakEndDate?: Date;
  activeDays: Date[];
  totalActiveDays: number;
}

export interface ActivityStatistics {
  totalActivities: number;
  activitiesToday: number;
  activitiesThisWeek: number;
  activitiesThisMonth: number;
  activitiesThisYear: number;
  byActivityType: Record<string, number>;
  byLanguage: Record<string, number>;
  byEntityType: Record<string, number>;
  averagePerDay: number;
  mostActiveDay: string;
  mostActiveHour: number;
}

export interface IActivityFeedRepository {
  // ===== CRUD DE BASE =====
  
  /**
   * Crée une nouvelle activité
   */
  create(activityData: CreateActivityFeedData): Promise<ActivityFeed>;
  
  /**
   * Trouve une activité par ID
   */
  findById(id: string): Promise<ActivityFeed | null>;
  
  /**
   * Met à jour une activité
   */
  update(id: string, updateData: UpdateActivityFeedData): Promise<ActivityFeed | null>;
  
  /**
   * Supprime une activité
   */
  delete(id: string): Promise<boolean>;

  // ===== RECHERCHE ET FILTRAGE =====
  
  /**
   * Trouve toutes les activités d'un utilisateur
   */
  findByUserId(userId: string, options?: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Version simplifiée pour récupérer directement les activités (pour les calculs de streak et stats)
   */
  getUserActivities(userId: string, options?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    activityTypes?: string[];
  }): Promise<ActivityFeed[]>;
  
  /**
   * Trouve les activités publiques pour le feed global
   */
  findPublicActivities(options?: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Recherche d'activités avec critères avancés
   */
  findWithCriteria(options: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Trouve les activités par type
   */
  findByActivityType(activityType: string, options?: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }>;
  
  /**
   * Trouve les activités liées à une entité
   */
  findByEntity(entityId: string, entityType?: string, options?: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }>;

  // ===== COMPTAGE ET STATISTIQUES =====
  
  /**
   * Compte le total d'activités d'un utilisateur
   */
  countByUser(userId: string): Promise<number>;
  
  /**
   * Compte les activités dans une période
   */
  countByUserAndTimeRange(userId: string, startDate: Date, endDate: Date): Promise<number>;
  
  /**
   * Compte par type d'activité
   */
  countByUserAndActivityType(userId: string, activityType: string): Promise<number>;
  
  /**
   * Compte par langue
   */
  countByUserAndLanguage(userId: string, language: string): Promise<number>;

  // ===== CALCULS DE STREAK (SÉRIE D'ACTIVITÉS) =====
  
  /**
   * Récupère les jours d'activité d'un utilisateur (pour calcul de streak)
   */
  getUserActivityDays(userId: string, limitDays?: number): Promise<Date[]>;
  
  /**
   * Calcule la série d'activités (streak) d'un utilisateur
   */
  calculateUserStreak(userId: string): Promise<ActivityStreakData>;
  
  /**
   * Vérifie si un utilisateur a été actif aujourd'hui
   */
  isUserActiveToday(userId: string): Promise<boolean>;
  
  /**
   * Trouve la dernière activité d'un utilisateur
   */
  getLastUserActivity(userId: string): Promise<ActivityFeed | null>;

  // ===== AGRÉGATIONS ET ANALYSES =====
  
  /**
   * Récupère les langues distinctes utilisées par un utilisateur
   */
  getDistinctLanguagesByUser(userId: string, options?: {
    activityTypes?: string[];
  }): Promise<string[]>;
  
  /**
   * Récupère les types d'activité distincts d'un utilisateur
   */
  getDistinctActivityTypesByUser(userId: string): Promise<string[]>;
  
  /**
   * Statistiques complètes d'un utilisateur
   */
  getUserActivityStatistics(userId: string): Promise<ActivityStatistics>;
  
  /**
   * Activités récentes d'un utilisateur (pour les contributions)
   */
  getRecentUserActivities(userId: string, limit?: number): Promise<ActivityFeed[]>;
  
  /**
   * Activités par période (jour, semaine, mois)
   */
  getActivitiesByPeriod(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year',
    startDate?: Date,
    endDate?: Date
  ): Promise<ActivityFeed[] | {
    period: string;
    count: number;
    activities: ActivityFeed[];
  }[]>;

  // ===== ANALYSES TEMPORELLES =====
  
  /**
   * Distribution horaire des activités
   */
  getHourlyDistribution(userId: string): Promise<{
    hour: number;
    count: number;
  }[]>;
  
  /**
   * Distribution par jour de la semaine
   */
  getWeeklyDistribution(userId: string): Promise<{
    dayOfWeek: number;
    dayName: string;
    count: number;
  }[]>;
  
  /**
   * Évolution des activités dans le temps
   */
  getActivityEvolution(
    userId: string,
    granularity: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<{
    date: Date;
    count: number;
  }[]>;

  // ===== MAINTENANCE ET NETTOYAGE =====
  
  /**
   * Supprime les anciennes activités (plus anciennes que X jours)
   */
  deleteOldActivities(olderThanDays: number): Promise<{
    deletedCount: number;
    deletedIds: string[];
  }>;
  
  /**
   * Archive les activités anciennes (marque comme non-publiques)
   */
  archiveOldActivities(olderThanDays: number): Promise<{
    archivedCount: number;
    archivedIds: string[];
  }>;
  
  /**
   * Nettoie les activités orphelines (entités supprimées)
   */
  cleanupOrphanedActivities(): Promise<{
    cleanedCount: number;
    cleanedIds: string[];
  }>;

  // ===== STATISTIQUES GLOBALES =====
  
  /**
   * Statistiques globales de la plateforme
   */
  getGlobalStatistics(): Promise<{
    totalActivities: number;
    activitiesToday: number;
    activitiesThisWeek: number;
    activitiesThisMonth: number;
    activeUsersToday: number;
    activeUsersThisWeek: number;
    mostPopularActivityType: string;
    mostPopularLanguage: string;
    averageActivitiesPerUser: number;
  }>;
  
  /**
   * Top utilisateurs par activité
   */
  getTopActiveUsers(limit?: number, period?: 'day' | 'week' | 'month' | 'all'): Promise<{
    userId: string;
    username: string;
    activityCount: number;
    rank: number;
  }[]>;

  // ===== ENRICHISSEMENT ET METADATA =====
  
  /**
   * Met à jour le nom de langue enrichi pour toutes les activités
   */
  enrichLanguageNames(): Promise<{
    updatedCount: number;
    errors: string[];
  }>;
  
  /**
   * Met à jour les métadonnées d'une activité
   */
  updateMetadata(activityId: string, metadata: Record<string, any>): Promise<boolean>;
  
  /**
   * Trouve les activités avec métadonnées spécifiques
   */
  findByMetadata(metadataQuery: Record<string, any>, options?: ActivityFeedQueryOptions): Promise<{
    activities: ActivityFeed[];
    total: number;
    page: number;
    limit: number;
  }>;
}