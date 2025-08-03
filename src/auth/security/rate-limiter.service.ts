/**
 * @fileoverview Service de limitation de débit et protection anti-attaques pour O'Ypunu
 * 
 * Ce service implémente une protection avancée contre les abus d'API et attaques
 * par déni de service avec algorithmes adaptatifs, détection d'intrusions et
 * gestion intelligente des blocages pour garantir la disponibilité de la plateforme.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service de limitation de débit avec protection anti-attaques
 * 
 * Ce service implémente une protection multi-niveaux contre les abus :
 * 
 * ## 🛡️ Protections mises en œuvre :
 * - **Force brute** : Limitation stricte sur l'authentification
 * - **Spam API** : Contrôle du débit de requêtes par endpoint
 * - **DoS/DDoS** : Détection et blocage des attaques volumétriques
 * - **Scraping** : Limitation du taux d'accès aux données
 * 
 * ## ⚡ Stratégies algorithmiques :
 * - **Sliding window** : Mesure précise sur fenêtres glissantes
 * - **Exponential backoff** : Pénalité croissante pour récidives
 * - **IP filtering** : Whitelist/blacklist dynamique
 * - **Pattern detection** : Détection automatique d'attaques
 * 
 * ## 📊 Catégories de limitation :
 * - **auth** : Endpoints d'authentification (5/15min)
 * - **api** : API générale (100/min)
 * - **sensitive** : Endpoints sensibles (10/min)
 * - **upload** : Upload de fichiers (5/min)
 * 
 * @class RateLimiterService
 * @version 1.0.0
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  
  // Cache en mémoire pour les compteurs (à remplacer par Redis en production)
  private ipCounts = new Map<string, RateLimitData>();
  private userCounts = new Map<string, RateLimitData>();
  private blacklistedIPs = new Set<string>();
  private whitelistedIPs = new Set<string>();
  
  // Configuration par défaut
  private readonly configs = {
    // Authentification (plus strict)
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxAttempts: 5,
      blockDurationMs: 30 * 60 * 1000, // 30 minutes
    },
    // API générale
    api: {
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 100,
      blockDurationMs: 5 * 60 * 1000, // 5 minutes
    },
    // Endpoints sensibles
    sensitive: {
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 10,
      blockDurationMs: 10 * 60 * 1000, // 10 minutes
    },
    // Upload de fichiers
    upload: {
      windowMs: 60 * 1000, // 1 minute
      maxAttempts: 5,
      blockDurationMs: 15 * 60 * 1000, // 15 minutes
    },
  };

  /**
   * Constructeur du service de limitation de débit
   * 
   * Initialise les configurations, charge les listes d'IPs autorisées
   * et démarre les tâches de maintenance automatique.
   * 
   * @constructor
   * @param {ConfigService} configService - Service de configuration NestJS
   */
  constructor(private configService: ConfigService) {
    // Charger les IPs en whitelist depuis la config
    const whitelistConfig = this.configService.get<string>('RATE_LIMIT_WHITELIST');
    if (whitelistConfig) {
      whitelistConfig.split(',').forEach(ip => this.whitelistedIPs.add(ip.trim()));
    }

    // Nettoyage périodique du cache
    setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000); // Toutes les 5 minutes
  }

  /**
   * Vérifie si une requête est autorisée selon les limites configurées
   * 
   * Méthode principale de validation qui applique les algorithmes de limitation
   * selon la catégorie d'endpoint, gère les listes blanches/noires et calcule
   * les temps de blocage avec exponential backoff pour les récidivistes.
   * 
   * @async
   * @method checkRateLimit
   * @param {string} identifier - IP ou ID utilisateur à vérifier
   * @param {keyof typeof this.configs} category - Catégorie de limitation ('auth', 'api', 'sensitive', 'upload')
   * @param {boolean} isIPBased - Si true, utilise l'IP, sinon l'ID utilisateur
   * @returns {Promise<RateLimitResult>} Résultat avec autorisation et métadonnées
   */
  async checkRateLimit(
    identifier: string,
    category: keyof typeof this.configs = 'api',
    isIPBased: boolean = true,
  ): Promise<RateLimitResult> {
    // Whitelist bypass
    if (isIPBased && this.whitelistedIPs.has(identifier)) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: new Date(),
        retryAfter: 0,
      };
    }

    // Blacklist block
    if (isIPBased && this.blacklistedIPs.has(identifier)) {
      this.logger.warn(`🚫 Requête bloquée - IP blacklistée: ${identifier}`);
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        retryAfter: 24 * 60 * 60 * 1000,
      };
    }

    const config = this.configs[category];
    const cache = isIPBased ? this.ipCounts : this.userCounts;
    const now = Date.now();

    let data = cache.get(identifier);
    
    if (!data) {
      data = {
        count: 0,
        windowStart: now,
        blockedUntil: 0,
        violations: 0,
      };
    }

    // Vérifier si encore bloqué
    if (data.blockedUntil > now) {
      const retryAfter = data.blockedUntil - now;
      this.logger.warn(
        `🚫 Requête bloquée - Rate limit: ${identifier} (${category}) - Retry dans ${Math.round(retryAfter / 1000)}s`,
      );
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(data.blockedUntil),
        retryAfter,
      };
    }

    // Reset de la fenêtre si expirée
    if (now - data.windowStart >= config.windowMs) {
      data.count = 0;
      data.windowStart = now;
    }

    // Incrémenter le compteur
    data.count++;
    cache.set(identifier, data);

    // Vérifier le dépassement
    if (data.count > config.maxAttempts) {
      data.violations++;
      
      // Calcul du temps de blocage avec exponential backoff
      const blockDuration = this.calculateBlockDuration(config.blockDurationMs, data.violations);
      data.blockedUntil = now + blockDuration;
      
      this.logger.warn(
        `🚨 Rate limit dépassé: ${identifier} (${category}) - ${data.count}/${config.maxAttempts} - Blocage ${Math.round(blockDuration / 1000)}s (violation #${data.violations})`,
      );

      // Auto-blacklist après trop de violations
      if (data.violations >= 5 && isIPBased) {
        this.blacklistIP(identifier, 'Trop de violations de rate limit');
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(data.blockedUntil),
        retryAfter: blockDuration,
      };
    }

    const remaining = config.maxAttempts - data.count;
    const resetTime = new Date(data.windowStart + config.windowMs);

    return {
      allowed: true,
      remaining,
      resetTime,
      retryAfter: 0,
    };
  }

  /**
   * ⚡ Calcule la durée de blocage avec exponential backoff
   */
  private calculateBlockDuration(baseDuration: number, violations: number): number {
    // Exponential backoff: 2^violations * baseDuration (max 24h)
    const maxDuration = 24 * 60 * 60 * 1000; // 24 heures
    const exponentialDuration = Math.pow(2, violations - 1) * baseDuration;
    
    return Math.min(exponentialDuration, maxDuration);
  }

  /**
   * 🚫 Ajoute une IP à la blacklist
   */
  blacklistIP(ip: string, reason: string): void {
    this.blacklistedIPs.add(ip);
    this.logger.warn(`🚫 IP blacklistée: ${ip} - Raison: ${reason}`);
    
    // Optionnel: persister en base de données
    // await this.saveBlacklistToDB(ip, reason);
  }

  /**
   * ✅ Supprime une IP de la blacklist
   */
  unblacklistIP(ip: string): void {
    this.blacklistedIPs.delete(ip);
    this.logger.log(`✅ IP déblacklistée: ${ip}`);
  }

  /**
   * ⭐ Ajoute une IP à la whitelist
   */
  whitelistIP(ip: string): void {
    this.whitelistedIPs.add(ip);
    this.logger.log(`⭐ IP whitelistée: ${ip}`);
  }

  /**
   * 🔄 Reset les compteurs pour un identifiant
   */
  resetLimits(identifier: string, isIPBased: boolean = true): void {
    const cache = isIPBased ? this.ipCounts : this.userCounts;
    cache.delete(identifier);
    this.logger.log(`🔄 Limites reset pour: ${identifier}`);
  }

  /**
   * 📊 Obtient les statistiques pour un identifiant
   */
  getStats(identifier: string, isIPBased: boolean = true): RateLimitData | null {
    const cache = isIPBased ? this.ipCounts : this.userCounts;
    return cache.get(identifier) || null;
  }

  /**
   * 📈 Obtient les statistiques globales
   */
  getGlobalStats(): {
    totalIPs: number;
    totalUsers: number;
    blacklistedIPs: number;
    whitelistedIPs: number;
    blockedIPs: number;
    blockedUsers: number;
  } {
    const now = Date.now();
    
    const blockedIPs = Array.from(this.ipCounts.values())
      .filter(data => data.blockedUntil > now).length;
    
    const blockedUsers = Array.from(this.userCounts.values())
      .filter(data => data.blockedUntil > now).length;

    return {
      totalIPs: this.ipCounts.size,
      totalUsers: this.userCounts.size,
      blacklistedIPs: this.blacklistedIPs.size,
      whitelistedIPs: this.whitelistedIPs.size,
      blockedIPs,
      blockedUsers,
    };
  }

  /**
   * 🧹 Nettoyage des entrées expirées
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    // Nettoyer les IPs
    for (const [key, data] of this.ipCounts.entries()) {
      if (data.blockedUntil > 0 && data.blockedUntil < now && 
          (now - data.windowStart) > 24 * 60 * 60 * 1000) { // Garder 24h d'historique
        this.ipCounts.delete(key);
        cleaned++;
      }
    }

    // Nettoyer les utilisateurs
    for (const [key, data] of this.userCounts.entries()) {
      if (data.blockedUntil > 0 && data.blockedUntil < now && 
          (now - data.windowStart) > 24 * 60 * 60 * 1000) {
        this.userCounts.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`🧹 Nettoyage rate limiter: ${cleaned} entrées supprimées`);
    }
  }

  /**
   * 🔍 Détecte les patterns d'attaque
   */
  detectAttackPatterns(): AttackPattern[] {
    const patterns: AttackPattern[] = [];
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes

    // Détecter les attaques distribuées (DDoS)
    const recentIPs = Array.from(this.ipCounts.entries())
      .filter(([_, data]) => (now - data.windowStart) < recentWindow)
      .filter(([_, data]) => data.count > 50); // Plus de 50 requêtes en 5 min

    if (recentIPs.length > 10) {
      patterns.push({
        type: 'distributed_attack',
        severity: 'high',
        description: `${recentIPs.length} IPs avec activité suspecte détectées`,
        affectedIPs: recentIPs.map(([ip]) => ip),
        timestamp: new Date(),
      });
    }

    // Détecter les attaques de force brute concentrées
    for (const [ip, data] of this.ipCounts.entries()) {
      if (data.violations >= 3 && (now - data.windowStart) < recentWindow) {
        patterns.push({
          type: 'brute_force',
          severity: 'medium',
          description: `Force brute détectée depuis ${ip}`,
          affectedIPs: [ip],
          timestamp: new Date(),
        });
      }
    }

    return patterns;
  }

  /**
   * 🚨 Déclenche des mesures d'urgence
   */
  activateEmergencyMode(durationMs: number = 60 * 60 * 1000): void {
    this.logger.warn('🚨 MODE D\'URGENCE ACTIVÉ - Rate limits réduits');
    
    // Réduire drastiquement les limites
    Object.keys(this.configs).forEach(key => {
      this.configs[key as keyof typeof this.configs].maxAttempts = 
        Math.floor(this.configs[key as keyof typeof this.configs].maxAttempts / 10);
    });

    // Désactiver après la durée spécifiée
    setTimeout(() => {
      this.logger.log('✅ Mode d\'urgence désactivé - Rate limits normaux restaurés');
      this.resetToDefaultLimits();
    }, durationMs);
  }

  /**
   * 🔄 Restaure les limites par défaut
   */
  private resetToDefaultLimits(): void {
    this.configs.auth.maxAttempts = 5;
    this.configs.api.maxAttempts = 100;
    this.configs.sensitive.maxAttempts = 10;
    this.configs.upload.maxAttempts = 5;
  }
}

// Interfaces
interface RateLimitData {
  count: number;
  windowStart: number;
  blockedUntil: number;
  violations: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter: number;
}

interface AttackPattern {
  type: 'distributed_attack' | 'brute_force' | 'scanning' | 'spam';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedIPs: string[];
  timestamp: Date;
}