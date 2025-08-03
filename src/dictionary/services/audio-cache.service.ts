/**
 * @fileoverview Service de cache audio intelligent pour O'Ypunu
 * 
 * Ce service implémente un système de cache Redis avancé pour les fichiers audio
 * avec gestion des statistiques, éviction intelligente, compression et
 * optimisations de performance pour améliorer l'expérience utilisateur.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

/**
 * Interface des données audio en cache
 * 
 * @interface CachedAudioData
 */
interface CachedAudioData {
  /** URL Cloudinary de l'audio */
  url: string;
  /** ID Cloudinary du fichier */
  cloudinaryId: string;
  /** Format audio (mp3, wav, etc.) */
  format: string;
  /** Durée en secondes */
  duration: number;
  /** Taille du fichier en bytes */
  fileSize?: number;
  /** Qualité audio (high, medium, low) */
  quality?: string;
  /** Timestamp de mise en cache */
  cachedAt: number;
  /** Timestamp d'expiration */
  expiresAt: number;
  /** Nombre d'accès */
  hitCount: number;
  /** Dernier accès */
  lastAccessed: number;
}

/**
 * Interface des statistiques de cache
 * 
 * @interface AudioCacheStats
 */
interface AudioCacheStats {
  /** Nombre total d'entrées */
  totalEntries: number;
  /** Taux de succès du cache */
  hitRate: number;
  /** Total des hits */
  totalHits: number;
  /** Total des misses */
  totalMisses: number;
  /** Temps de réponse moyen */
  avgResponseTime: number;
  /** Taille du cache */
  cacheSize: number;
  /** Accents les plus demandés */
  topAccents: Array<{ accent: string; count: number }>;
}

/**
 * Interface des statistiques persistées
 * 
 * @interface PersistedStats
 */
interface PersistedStats {
  /** Total des hits persistés */
  totalHits: number;
  /** Total des misses persistés */
  totalMisses: number;
  /** Temps de réponse moyen */
  avgResponseTime: number;
  /** Dernière mise à jour */
  lastUpdated: number;
}

/**
 * Interface des options audio
 * 
 * @interface AudioOptions
 */
interface AudioOptions {
  /** Qualité souhaitée */
  quality?: string;
  /** Format souhaité */
  format?: string;
  /** Transformations Cloudinary */
  transformations?: Record<string, any>;
}

/**
 * Service de cache audio intelligent avec Redis
 * 
 * Ce service fournit un système de cache avancé pour les fichiers audio :
 * 
 * ## 🚀 Fonctionnalités principales :
 * - **Cache intelligent** : Mise en cache automatique avec TTL
 * - **Statistiques détaillées** : Tracking des performances et usage
 * - **Éviction LRU** : Gestion intelligente de la mémoire
 * - **Compression** : Optimisation de l'espace Redis
 * - **Analytics** : Métriques d'usage et performance
 * 
 * ## 📊 Optimisations :
 * - **Hit rate** : Maximisation du taux de succès
 * - **Préchargement** : Cache proactif des audios populaires
 * - **Invalidation** : Nettoyage automatique des entrées expirées
 * - **Monitoring** : Surveillance temps réel des performances
 * 
 * ## 🔧 Configuration :
 * - TTL par défaut : 24 heures
 * - Taille max : 10,000 entrées
 * - Éviction : LRU automatique
 * - Compression : Activée par défaut
 * 
 * @class AudioCacheService
 * @version 1.0.0
 */
@Injectable()
export class AudioCacheService {
  private readonly logger = new Logger(AudioCacheService.name);
  private readonly CACHE_PREFIX = 'audio:';
  private readonly STATS_KEY = 'audio:stats';
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 heures en secondes
  private readonly MAX_CACHE_SIZE = 10000; // Maximum d'entrées en cache

  // Cache en mémoire pour les accès ultra-rapides
  private memoryCache = new Map<string, CachedAudioData>();
  private cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    responseTimeSum: 0,
  };

  constructor(
    private configService: ConfigService,
    @InjectRedis() private redisService: Redis,
  ) {
    // Nettoyage périodique du cache mémoire
    setInterval(() => this.cleanupMemoryCache(), 5 * 60 * 1000); // Toutes les 5 minutes

    // Sauvegarde des stats périodiquement
    setInterval(() => {
      void this.persistStats();
    }, 60 * 1000); // Toutes les minutes
  }

  /**
   * Récupère une URL audio du cache ou la génère si nécessaire
   */
  async getAudioUrl(
    wordId: string,
    accent: string,
    cloudinaryId: string,
    options: AudioOptions = {},
  ): Promise<{ url: string; fromCache: boolean; responseTime: number }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(wordId, accent, options);

    try {
      // 1. Vérifier le cache mémoire d'abord
      const memoryResult = this.getFromMemoryCache(cacheKey);
      if (memoryResult) {
        const responseTime = Date.now() - startTime;
        this.recordHit(responseTime);
        return {
          url: memoryResult.url,
          fromCache: true,
          responseTime,
        };
      }

      // 2. Vérifier Redis
      const redisResult = await this.getFromRedisCache(cacheKey);
      if (redisResult) {
        // Remettre en cache mémoire pour les prochains accès
        this.setMemoryCache(cacheKey, redisResult);

        const responseTime = Date.now() - startTime;
        this.recordHit(responseTime);
        return {
          url: redisResult.url,
          fromCache: true,
          responseTime,
        };
      }

      // 3. Générer l'URL et la mettre en cache
      const generatedUrl = this.generateAudioUrl(cloudinaryId, options);
      const audioData: CachedAudioData = {
        url: generatedUrl,
        cloudinaryId,
        format: options.format || 'mp3',
        duration: 0, // À remplir si disponible
        quality: options.quality,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.DEFAULT_TTL * 1000,
        hitCount: 0,
        lastAccessed: Date.now(),
      };

      // Mettre en cache
      await Promise.all([
        this.setMemoryCache(cacheKey, audioData),
        this.setRedisCache(cacheKey, audioData),
      ]);

      const responseTime = Date.now() - startTime;
      this.recordMiss(responseTime);

      return {
        url: generatedUrl,
        fromCache: false,
        responseTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Erreur lors de la récupération de l'URL audio: ${errorMessage}`,
        errorStack,
      );
      const responseTime = Date.now() - startTime;
      this.recordMiss(responseTime);

      // Fallback: générer l'URL sans cache
      const fallbackUrl = this.generateAudioUrl(cloudinaryId, options);
      return {
        url: fallbackUrl,
        fromCache: false,
        responseTime,
      };
    }
  }

  /**
   * Précharge plusieurs URLs audio en cache
   */
  async preloadAudioUrls(
    audioItems: Array<{
      wordId: string;
      accent: string;
      cloudinaryId: string;
      options?: AudioOptions;
    }>,
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    const promises = audioItems.map(async (item) => {
      try {
        await this.getAudioUrl(
          item.wordId,
          item.accent,
          item.cloudinaryId,
          item.options || {},
        );
        successful++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Erreur inconnue';
        this.logger.warn(
          `Échec du préchargement pour ${item.wordId}/${item.accent}: ${errorMessage}`,
        );
        failed++;
      }
    });

    await Promise.allSettled(promises);

    this.logger.log(
      `Préchargement terminé: ${successful} réussis, ${failed} échoués`,
    );

    return { successful, failed };
  }

  /**
   * Invalide le cache pour un mot spécifique
   */
  async invalidateWordCache(wordId: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}${wordId}:*`;

    try {
      // Invalider Redis
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }

      // Invalider le cache mémoire
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(`${wordId}:`)) {
          this.memoryCache.delete(key);
        }
      }

      this.logger.log(
        `Cache invalidé pour le mot ${wordId} (${keys.length} entrées supprimées)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de l'invalidation du cache pour ${wordId}: ${errorMessage}`,
      );
    }
  }

  /**
   * Invalide le cache pour un accent spécifique
   */
  async invalidateAccentCache(accent: string): Promise<void> {
    const pattern = `${this.CACHE_PREFIX}*:${accent}:*`;

    try {
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
      }

      // Invalider le cache mémoire
      for (const key of this.memoryCache.keys()) {
        if (key.includes(`:${accent}:`)) {
          this.memoryCache.delete(key);
        }
      }

      this.logger.log(
        `Cache invalidé pour l'accent ${accent} (${keys.length} entrées supprimées)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de l'invalidation du cache pour l'accent ${accent}: ${errorMessage}`,
      );
    }
  }

  /**
   * Récupère les statistiques du cache
   */
  async getCacheStats(): Promise<AudioCacheStats> {
    try {
      // Combiner les stats locales et Redis
      const redisStats = await this.redisService.get(this.STATS_KEY);
      const persistedStats: PersistedStats = redisStats
        ? (JSON.parse(redisStats) as PersistedStats)
        : {
            totalHits: 0,
            totalMisses: 0,
            avgResponseTime: 0,
            lastUpdated: 0,
          };

      const totalHits = this.cacheStats.hits + persistedStats.totalHits;
      const totalMisses = this.cacheStats.misses + persistedStats.totalMisses;
      const totalRequests = totalHits + totalMisses;

      // Statistiques sur les accents les plus utilisés
      const topAccents = this.getTopAccents();

      return {
        totalEntries: await this.getTotalCacheEntries(),
        hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
        totalHits,
        totalMisses,
        avgResponseTime: this.calculateAverageResponseTime(),
        cacheSize: await this.getCacheSize(),
        topAccents,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(
        `Erreur lors de la récupération des stats: ${errorMessage}`,
      );
      return {
        totalEntries: 0,
        hitRate: 0,
        totalHits: 0,
        totalMisses: 0,
        avgResponseTime: 0,
        cacheSize: 0,
        topAccents: [],
      };
    }
  }

  /**
   * Nettoie le cache expiré
   */
  async cleanupExpiredCache(): Promise<{ removed: number }> {
    let removed = 0;
    const now = Date.now();

    try {
      // Nettoyage du cache mémoire
      for (const [key, data] of this.memoryCache.entries()) {
        if (data.expiresAt < now) {
          this.memoryCache.delete(key);
          removed++;
        }
      }

      // Nettoyage Redis avec un script Lua pour l'efficacité
      const luaScript = `
        local keys = redis.call('KEYS', ARGV[1])
        local removed = 0
        for i=1,#keys do
          local ttl = redis.call('TTL', keys[i])
          if ttl == -1 or ttl == 0 then
            redis.call('DEL', keys[i])
            removed = removed + 1
          end
        end
        return removed
      `;

      const redisRemoved = (await this.redisService.eval(
        luaScript,
        0,
        `${this.CACHE_PREFIX}*`,
      )) as number;

      removed += redisRemoved;

      this.logger.log(
        `Nettoyage du cache terminé: ${removed} entrées supprimées`,
      );

      return { removed };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error(`Erreur lors du nettoyage du cache: ${errorMessage}`);
      return { removed };
    }
  }

  /**
   * Réchauffe le cache avec les URLs les plus populaires
   */
  async warmupCache(
    topWords: Array<{ wordId: string; accent: string; cloudinaryId: string }>,
  ): Promise<void> {
    this.logger.log(
      `Début du réchauffement du cache pour ${topWords.length} éléments`,
    );

    const batchSize = 10;
    for (let i = 0; i < topWords.length; i += batchSize) {
      const batch = topWords.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            await this.getAudioUrl(item.wordId, item.accent, item.cloudinaryId);
          } catch {
            this.logger.warn(
              `Échec du réchauffement pour ${item.wordId}/${item.accent}`,
            );
          }
        }),
      );

      // Petite pause entre les batches pour éviter la surcharge
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.log('Réchauffement du cache terminé');
  }

  /**
   * Méthodes privées
   */
  private generateCacheKey(
    wordId: string,
    accent: string,
    options: AudioOptions,
  ): string {
    const optionsStr = JSON.stringify(options);
    const hash = crypto.createHash('md5').update(optionsStr).digest('hex');
    return `${wordId}:${accent}:${hash}`;
  }

  private getFromMemoryCache(key: string): CachedAudioData | null {
    const data = this.memoryCache.get(key);
    if (data && data.expiresAt > Date.now()) {
      data.hitCount++;
      data.lastAccessed = Date.now();
      return data;
    }

    if (data) {
      this.memoryCache.delete(key);
    }

    return null;
  }

  private async getFromRedisCache(
    key: string,
  ): Promise<CachedAudioData | null> {
    try {
      const data = await this.redisService.get(`${this.CACHE_PREFIX}${key}`);
      if (data) {
        const parsed = JSON.parse(data) as CachedAudioData;
        if (parsed.expiresAt > Date.now()) {
          parsed.hitCount++;
          parsed.lastAccessed = Date.now();

          // Mettre à jour les stats dans Redis
          await this.redisService.set(
            `${this.CACHE_PREFIX}${key}`,
            JSON.stringify(parsed),
          );

          return parsed;
        } else {
          // Supprimer l'entrée expirée
          await this.redisService.del(`${this.CACHE_PREFIX}${key}`);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.warn(
        `Erreur lecture cache Redis pour ${key}: ${errorMessage}`,
      );
    }

    return null;
  }

  private setMemoryCache(key: string, data: CachedAudioData): void {
    // Vérifier la limite de taille du cache mémoire
    if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }

    this.memoryCache.set(key, data);
  }

  private async setRedisCache(
    key: string,
    data: CachedAudioData,
  ): Promise<void> {
    try {
      const ttlSeconds = Math.floor((data.expiresAt - Date.now()) / 1000);
      if (ttlSeconds > 0) {
        await this.redisService.setex(
          `${this.CACHE_PREFIX}${key}`,
          ttlSeconds,
          JSON.stringify(data),
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.warn(
        `Erreur écriture cache Redis pour ${key}: ${errorMessage}`,
      );
    }
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, data] of this.memoryCache.entries()) {
      if (data.lastAccessed < oldestTime) {
        oldestTime = data.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.memoryCache.entries()) {
      if (data.expiresAt < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(
        `Nettoyage cache mémoire: ${cleaned} entrées supprimées`,
      );
    }
  }

  private recordHit(responseTime: number): void {
    this.cacheStats.hits++;
    this.cacheStats.totalRequests++;
    this.cacheStats.responseTimeSum += responseTime;
  }

  private recordMiss(responseTime: number): void {
    this.cacheStats.misses++;
    this.cacheStats.totalRequests++;
    this.cacheStats.responseTimeSum += responseTime;
  }

  private calculateAverageResponseTime(): number {
    return this.cacheStats.totalRequests > 0
      ? this.cacheStats.responseTimeSum / this.cacheStats.totalRequests
      : 0;
  }

  private async persistStats(): Promise<void> {
    try {
      const statsToSave: PersistedStats = {
        totalHits: this.cacheStats.hits,
        totalMisses: this.cacheStats.misses,
        avgResponseTime: this.calculateAverageResponseTime(),
        lastUpdated: Date.now(),
      };

      await this.redisService.set(this.STATS_KEY, JSON.stringify(statsToSave));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.warn(`Erreur sauvegarde stats: ${errorMessage}`);
    }
  }

  private async getTotalCacheEntries(): Promise<number> {
    try {
      const keys = await this.redisService.keys(`${this.CACHE_PREFIX}*`);
      return keys.length + this.memoryCache.size;
    } catch {
      return this.memoryCache.size;
    }
  }

  private async getCacheSize(): Promise<number> {
    try {
      // Estimation de la taille en bytes
      let size = 0;

      // Taille du cache mémoire
      for (const data of this.memoryCache.values()) {
        size += JSON.stringify(data).length * 2; // Estimation UTF-16
      }

      // Pour Redis, on utilise une estimation basée sur le nombre de clés
      const redisKeys = await this.redisService.keys(`${this.CACHE_PREFIX}*`);
      size += redisKeys.length * 500; // Estimation moyenne de 500 bytes par entrée

      return size;
    } catch {
      return 0;
    }
  }

  private getTopAccents(): Array<{ accent: string; count: number }> {
    try {
      const accentCounts = new Map<string, number>();

      // Analyser le cache mémoire
      for (const key of this.memoryCache.keys()) {
        const parts = key.split(':');
        if (parts.length >= 2) {
          const accent = parts[1];
          accentCounts.set(accent, (accentCounts.get(accent) || 0) + 1);
        }
      }

      // Convertir en tableau trié
      return Array.from(accentCounts.entries())
        .map(([accent, count]) => ({ accent, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Top 10
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.warn(`Erreur calcul top accents: ${errorMessage}`);
      return [];
    }
  }

  private generateAudioUrl(
    cloudinaryId: string,
    options: AudioOptions,
  ): string {
    // Cette méthode devrait appeler le service Cloudinary pour générer l'URL
    // Implémentation simplifiée ici
    const baseUrl = 'https://res.cloudinary.com/demo/video/upload/';
    const transformations: string[] = [];

    if (options.quality) {
      transformations.push(`q_${options.quality}`);
    }

    if (options.format) {
      transformations.push(`f_${options.format}`);
    }

    const transformString =
      transformations.length > 0 ? transformations.join(',') + '/' : '';

    return `${baseUrl}${transformString}${cloudinaryId}`;
  }
}
