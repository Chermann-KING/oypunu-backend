import { Injectable, Logger, ForbiddenException, Inject } from '@nestjs/common';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { DatabaseErrorHandler } from '../utils/database-error-handler.util';

export interface QuotaLimits {
  // Limites par jour
  dailyWordCreations: number;
  dailyWordUpdates: number;
  dailyTranslations: number;
  dailyComments: number;
  dailyMessages: number;
  dailyReports: number;
  
  // Limites par heure
  hourlyApiCalls: number;
  hourlyUploads: number;
  
  // Limites par mois
  monthlyWordsLimit: number;
  monthlyStorageLimit: number; // En MB
}

export interface UserQuotaUsage {
  userId: string;
  date: string; // Format: YYYY-MM-DD
  
  // Compteurs quotidiens
  wordCreations: number;
  wordUpdates: number;
  translations: number;
  comments: number;
  messages: number;
  reports: number;
  
  // Compteurs horaires (sliding window)
  hourlyApiCalls: { [hour: string]: number }; // Format: HH
  hourlyUploads: { [hour: string]: number };
  
  // Compteurs mensuels
  monthlyWords: number;
  monthlyStorageUsed: number; // En MB
  
  resetAt: Date;
  updatedAt: Date;
}

/**
 * 📊 SERVICE DE GESTION DES QUOTAS
 * 
 * Gère les limites d'utilisation par utilisateur pour :
 * - Création de mots
 * - Mise à jour de contenu
 * - Uploads de fichiers
 * - Appels API
 * - Usage du stockage
 * 
 * Système de quotas adaptatif basé sur le rôle utilisateur.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);
  
  // Cache en mémoire pour optimiser les vérifications fréquentes
  private quotaCache = new Map<string, UserQuotaUsage>();
  
  // Définition des limites par rôle
  private readonly ROLE_LIMITS: { [role: string]: QuotaLimits } = {
    user: {
      dailyWordCreations: 10,
      dailyWordUpdates: 20,
      dailyTranslations: 15,
      dailyComments: 50,
      dailyMessages: 100,
      dailyReports: 5,
      hourlyApiCalls: 60,
      hourlyUploads: 5,
      monthlyWordsLimit: 200,
      monthlyStorageLimit: 50, // 50MB
    },
    
    contributor: {
      dailyWordCreations: 25,
      dailyWordUpdates: 50,
      dailyTranslations: 40,
      dailyComments: 100,
      dailyMessages: 200,
      dailyReports: 10,
      hourlyApiCalls: 120,
      hourlyUploads: 10,
      monthlyWordsLimit: 500,
      monthlyStorageLimit: 100, // 100MB
    },
    
    moderator: {
      dailyWordCreations: 50,
      dailyWordUpdates: 100,
      dailyTranslations: 80,
      dailyComments: 200,
      dailyMessages: 300,
      dailyReports: 20,
      hourlyApiCalls: 200,
      hourlyUploads: 20,
      monthlyWordsLimit: 1000,
      monthlyStorageLimit: 200, // 200MB
    },
    
    admin: {
      dailyWordCreations: Infinity,
      dailyWordUpdates: Infinity,
      dailyTranslations: Infinity,
      dailyComments: Infinity,
      dailyMessages: Infinity,
      dailyReports: Infinity,
      hourlyApiCalls: Infinity,
      hourlyUploads: Infinity,
      monthlyWordsLimit: Infinity,
      monthlyStorageLimit: Infinity,
    }
  };

  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository
  ) {
    // Nettoyage périodique du cache
    setInterval(() => this.cleanupExpiredCache(), 15 * 60 * 1000); // Toutes les 15 minutes
  }

  /**
   * 🔍 Vérifie si un utilisateur peut effectuer une action
   */
  async canPerformAction(
    userId: string, 
    action: keyof QuotaLimits, 
    userRole?: string
  ): Promise<boolean> {
    try {
      const usage = await this.getUserQuotaUsage(userId);
      const limits = await this.getUserLimits(userId, userRole);
      
      const currentHour = new Date().getHours().toString().padStart(2, '0');
      const limit = limits[action];
      
      if (limit === Infinity) return true;
      
      switch (action) {
        case 'dailyWordCreations':
          return usage.wordCreations < limit;
        case 'dailyWordUpdates':
          return usage.wordUpdates < limit;
        case 'dailyTranslations':
          return usage.translations < limit;
        case 'dailyComments':
          return usage.comments < limit;
        case 'dailyMessages':
          return usage.messages < limit;
        case 'dailyReports':
          return usage.reports < limit;
        case 'hourlyApiCalls':
          return (usage.hourlyApiCalls[currentHour] || 0) < limit;
        case 'hourlyUploads':
          return (usage.hourlyUploads[currentHour] || 0) < limit;
        case 'monthlyWordsLimit':
          return usage.monthlyWords < limit;
        case 'monthlyStorageLimit':
          return usage.monthlyStorageUsed < limit;
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Erreur vérification quota: ${error.message}`, error.stack);
      return false; // En cas d'erreur, on bloque par sécurité
    }
  }

  /**
   * ➕ Incrémente l'usage d'un utilisateur
   */
  async incrementUsage(
    userId: string, 
    action: keyof QuotaLimits, 
    amount: number = 1
  ): Promise<void> {
    try {
      const usage = await this.getUserQuotaUsage(userId);
      const currentHour = new Date().getHours().toString().padStart(2, '0');
      
      switch (action) {
        case 'dailyWordCreations':
          usage.wordCreations += amount;
          usage.monthlyWords += amount;
          break;
        case 'dailyWordUpdates':
          usage.wordUpdates += amount;
          break;
        case 'dailyTranslations':
          usage.translations += amount;
          break;
        case 'dailyComments':
          usage.comments += amount;
          break;
        case 'dailyMessages':
          usage.messages += amount;
          break;
        case 'dailyReports':
          usage.reports += amount;
          break;
        case 'hourlyApiCalls':
          usage.hourlyApiCalls[currentHour] = (usage.hourlyApiCalls[currentHour] || 0) + amount;
          break;
        case 'hourlyUploads':
          usage.hourlyUploads[currentHour] = (usage.hourlyUploads[currentHour] || 0) + amount;
          break;
        case 'monthlyStorageLimit':
          usage.monthlyStorageUsed += amount;
          break;
      }
      
      usage.updatedAt = new Date();
      
      // Mettre à jour le cache et persister
      this.quotaCache.set(this.getCacheKey(userId), usage);
      await this.persistQuotaUsage(usage);
      
    } catch (error) {
      this.logger.error(`Erreur incrémentation quota: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 🚫 Vérifie les quotas et lance une exception si dépassé
   */
  async enforceQuota(
    userId: string, 
    action: keyof QuotaLimits, 
    userRole?: string
  ): Promise<void> {
    const canPerform = await this.canPerformAction(userId, action, userRole);
    
    if (!canPerform) {
      const limits = await this.getUserLimits(userId, userRole);
      const usage = await this.getUserQuotaUsage(userId);
      
      throw new ForbiddenException(
        `Quota dépassé pour '${action}'. Limite: ${limits[action]}, Usage actuel: ${this.getCurrentUsage(usage, action)}`
      );
    }
  }

  /**
   * 📊 Obtient les statistiques de quota d'un utilisateur
   */
  async getUserQuotaStats(userId: string, userRole?: string): Promise<{
    limits: QuotaLimits;
    usage: UserQuotaUsage;
    remaining: { [key in keyof QuotaLimits]: number };
    resetTimes: {
      daily: Date;
      hourly: Date;
      monthly: Date;
    };
  }> {
    const [limits, usage] = await Promise.all([
      this.getUserLimits(userId, userRole),
      this.getUserQuotaUsage(userId)
    ]);
    
    const remaining: { [key in keyof QuotaLimits]: number } = {} as any;
    const currentHour = new Date().getHours().toString().padStart(2, '0');
    
    // Calculer les quotas restants
    remaining.dailyWordCreations = Math.max(0, limits.dailyWordCreations - usage.wordCreations);
    remaining.dailyWordUpdates = Math.max(0, limits.dailyWordUpdates - usage.wordUpdates);
    remaining.dailyTranslations = Math.max(0, limits.dailyTranslations - usage.translations);
    remaining.dailyComments = Math.max(0, limits.dailyComments - usage.comments);
    remaining.dailyMessages = Math.max(0, limits.dailyMessages - usage.messages);
    remaining.dailyReports = Math.max(0, limits.dailyReports - usage.reports);
    remaining.hourlyApiCalls = Math.max(0, limits.hourlyApiCalls - (usage.hourlyApiCalls[currentHour] || 0));
    remaining.hourlyUploads = Math.max(0, limits.hourlyUploads - (usage.hourlyUploads[currentHour] || 0));
    remaining.monthlyWordsLimit = Math.max(0, limits.monthlyWordsLimit - usage.monthlyWords);
    remaining.monthlyStorageLimit = Math.max(0, limits.monthlyStorageLimit - usage.monthlyStorageUsed);
    
    const now = new Date();
    const resetTimes = {
      daily: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      hourly: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1),
      monthly: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    };
    
    return { limits, usage, remaining, resetTimes };
  }

  /**
   * 🔄 Réinitialise les quotas d'un utilisateur
   */
  async resetUserQuotas(userId: string, scope: 'daily' | 'hourly' | 'monthly' | 'all' = 'all'): Promise<void> {
    const usage = await this.getUserQuotaUsage(userId);
    
    if (scope === 'daily' || scope === 'all') {
      usage.wordCreations = 0;
      usage.wordUpdates = 0;
      usage.translations = 0;
      usage.comments = 0;
      usage.messages = 0;
      usage.reports = 0;
    }
    
    if (scope === 'hourly' || scope === 'all') {
      usage.hourlyApiCalls = {};
      usage.hourlyUploads = {};
    }
    
    if (scope === 'monthly' || scope === 'all') {
      usage.monthlyWords = 0;
      usage.monthlyStorageUsed = 0;
    }
    
    usage.updatedAt = new Date();
    this.quotaCache.set(this.getCacheKey(userId), usage);
    await this.persistQuotaUsage(usage);
    
    this.logger.log(`Quotas réinitialisés pour l'utilisateur ${userId} (scope: ${scope})`);
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Obtient les limites pour un utilisateur selon son rôle
   */
  private async getUserLimits(userId: string, userRole?: string): Promise<QuotaLimits> {
    let role = userRole;
    
    if (!role) {
      const user = await this.userRepository.findById(userId);
      role = user?.role || 'user';
    }
    
    return this.ROLE_LIMITS[role] || this.ROLE_LIMITS.user;
  }

  /**
   * Obtient l'usage actuel d'un utilisateur
   */
  private async getUserQuotaUsage(userId: string): Promise<UserQuotaUsage> {
    const cacheKey = this.getCacheKey(userId);
    const cached = this.quotaCache.get(cacheKey);
    
    if (cached && this.isCurrentPeriod(cached)) {
      return cached;
    }
    
    // Charger depuis la base ou créer nouveau
    const usage = await this.loadOrCreateUsage(userId);
    this.quotaCache.set(cacheKey, usage);
    
    return usage;
  }

  /**
   * Charge l'usage depuis la base ou en crée un nouveau
   */
  private async loadOrCreateUsage(userId: string): Promise<UserQuotaUsage> {
    const today = new Date().toISOString().split('T')[0];
    
    // Simuler le chargement depuis une collection MongoDB (à implémenter)
    // const existing = await this.quotaModel.findOne({ userId, date: today });
    
    return {
      userId,
      date: today,
      wordCreations: 0,
      wordUpdates: 0,
      translations: 0,
      comments: 0,
      messages: 0,
      reports: 0,
      hourlyApiCalls: {},
      hourlyUploads: {},
      monthlyWords: 0,
      monthlyStorageUsed: 0,
      resetAt: new Date(new Date().setHours(23, 59, 59, 999)),
      updatedAt: new Date()
    };
  }

  /**
   * Persiste l'usage en base de données
   */
  private async persistQuotaUsage(usage: UserQuotaUsage): Promise<void> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        // TODO: Implémenter la persistance en MongoDB
        // await this.quotaModel.updateOne(
        //   { userId: usage.userId, date: usage.date },
        //   usage,
        //   { upsert: true }
        // );
        this.logger.debug(`Usage persisté pour ${usage.userId}: ${JSON.stringify(usage)}`);
      },
      'Quota',
      usage.userId
    );
  }

  /**
   * Vérifie si l'usage est de la période courante
   */
  private isCurrentPeriod(usage: UserQuotaUsage): boolean {
    const today = new Date().toISOString().split('T')[0];
    return usage.date === today && usage.resetAt > new Date();
  }

  /**
   * Génère la clé de cache
   */
  private getCacheKey(userId: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `quota:${userId}:${today}`;
  }

  /**
   * Obtient l'usage actuel pour une action donnée
   */
  private getCurrentUsage(usage: UserQuotaUsage, action: keyof QuotaLimits): number {
    const currentHour = new Date().getHours().toString().padStart(2, '0');
    
    switch (action) {
      case 'dailyWordCreations': return usage.wordCreations;
      case 'dailyWordUpdates': return usage.wordUpdates;
      case 'dailyTranslations': return usage.translations;
      case 'dailyComments': return usage.comments;
      case 'dailyMessages': return usage.messages;
      case 'dailyReports': return usage.reports;
      case 'hourlyApiCalls': return usage.hourlyApiCalls[currentHour] || 0;
      case 'hourlyUploads': return usage.hourlyUploads[currentHour] || 0;
      case 'monthlyWordsLimit': return usage.monthlyWords;
      case 'monthlyStorageLimit': return usage.monthlyStorageUsed;
      default: return 0;
    }
  }

  /**
   * Nettoyage du cache expiré
   */
  private cleanupExpiredCache(): void {
    const now = new Date();
    let cleaned = 0;
    
    for (const [key, usage] of this.quotaCache.entries()) {
      if (usage.resetAt < now) {
        this.quotaCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`🧹 Cache quota nettoyé: ${cleaned} entrées supprimées`);
    }
  }
}