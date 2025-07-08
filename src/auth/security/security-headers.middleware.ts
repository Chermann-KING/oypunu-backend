import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * 🛡️ MIDDLEWARE DE SÉCURITÉ - HEADERS HTTP
 * 
 * Ce middleware applique les headers de sécurité essentiels :
 * - Content Security Policy (CSP)
 * - X-Frame-Options (protection clickjacking)
 * - X-Content-Type-Options (protection MIME sniffing)
 * - Strict-Transport-Security (HTTPS forcé)
 * - X-XSS-Protection (protection XSS)
 * - Referrer-Policy (contrôle des référents)
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);

  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const apiUrl = this.configService.get('API_URL') || 'http://localhost:3001';

    // 🔒 Content Security Policy (CSP)
    const cspDirectives = this.buildCSPDirectives(isProduction, appUrl);
    res.setHeader('Content-Security-Policy', cspDirectives);

    // 🚫 X-Frame-Options (protection contre le clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');

    // 🔍 X-Content-Type-Options (prévention du MIME sniffing)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 🔐 Strict-Transport-Security (HTTPS forcé en production)
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // 🛡️ X-XSS-Protection (protection XSS legacy)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 🔗 Referrer-Policy (contrôle des informations de référent)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 🔒 Permissions-Policy (contrôle des APIs du navigateur)
    const permissionsPolicy = [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
    ].join(', ');
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // 🚫 X-Powered-By (masquer la technologie utilisée)
    res.removeHeader('X-Powered-By');

    // 📱 Cross-Origin-Embedder-Policy (isolation des ressources)
    if (isProduction) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // 🔒 Cross-Origin-Opener-Policy (isolation des fenêtres)
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // 🔐 Cross-Origin-Resource-Policy (contrôle cross-origin)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // 📋 Cache-Control pour les réponses sensibles
    if (this.isSensitiveRoute(req.path)) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // 🔍 Log des requêtes suspectes
    this.logSuspiciousActivity(req);

    next();
  }

  /**
   * 🔒 Construction de la Content Security Policy
   */
  private buildCSPDirectives(isProduction: boolean, appUrl: string): string {
    const baseDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // À supprimer progressivement
        'https://apis.google.com',
        'https://connect.facebook.net',
        'https://platform.twitter.com',
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Nécessaire pour certains frameworks CSS
        'https://fonts.googleapis.com',
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'data:',
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:',
      ],
      'connect-src': [
        "'self'",
        appUrl,
        'https://api.cloudinary.com',
        'wss://localhost:*', // WebSocket pour développement
      ],
      'media-src': [
        "'self'",
        'https://res.cloudinary.com',
        'blob:',
      ],
      'object-src': ["'none'"],
      'embed-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
      'worker-src': ["'self'", 'blob:'],
    };

    // Directives plus strictes en production
    if (isProduction) {
      baseDirectives['script-src'] = baseDirectives['script-src'].filter(
        src => src !== "'unsafe-inline'",
      );
      baseDirectives['upgrade-insecure-requests'] = [];
      baseDirectives['block-all-mixed-content'] = [];
    }

    // Conversion en string
    return Object.entries(baseDirectives)
      .map(([directive, sources]) => 
        sources.length > 0 
          ? `${directive} ${sources.join(' ')}`
          : directive
      )
      .join('; ');
  }

  /**
   * 🔍 Détecte les routes sensibles nécessitant des headers de cache spéciaux
   */
  private isSensitiveRoute(path: string): boolean {
    const sensitivePatterns = [
      '/auth/',
      '/admin/',
      '/users/profile',
      '/api/sensitive',
      '/dashboard',
    ];

    return sensitivePatterns.some(pattern => path.includes(pattern));
  }

  /**
   * 🚨 Log des activités suspectes
   */
  private logSuspiciousActivity(req: Request): void {
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers.referer || '';
    const origin = req.headers.origin || '';

    // Détection de User-Agents suspects
    const suspiciousUA = [
      'sqlmap',
      'nikto',
      'nmap',
      'masscan',
      'gobuster',
      'dirb',
      'wget',
      'curl/7', // Version générique de curl
    ];

    if (suspiciousUA.some(ua => userAgent.toLowerCase().includes(ua))) {
      this.logger.warn(`🚨 User-Agent suspect détecté: ${userAgent} depuis ${req.ip}`);
    }

    // Détection de tentatives d'injection
    const injectionPatterns = [
      /[<>\"']/g, // Tentatives XSS basiques
      /union.*select/i, // Injection SQL
      /javascript:/i, // JavaScript dans les paramètres
      /__proto__/i, // Prototype pollution
      /\.\.\/.*\.\./g, // Path traversal
    ];

    const queryString = req.url;
    const hasInjectionAttempt = injectionPatterns.some(pattern => 
      pattern.test(queryString)
    );

    if (hasInjectionAttempt) {
      this.logger.warn(
        `🚨 Tentative d'injection détectée: ${req.method} ${req.url} depuis ${req.ip}`,
      );
    }

    // Détection de scans de ports/répertoires
    const scanPatterns = [
      '/admin',
      '/wp-admin',
      '/phpmyadmin',
      '/.env',
      '/config',
      '/backup',
      '/api/v1',
      '/swagger',
      '/.git',
    ];

    if (scanPatterns.some(pattern => req.path.includes(pattern)) && 
        req.method === 'GET') {
      this.logger.warn(
        `🔍 Tentative de scan détectée: ${req.path} depuis ${req.ip}`,
      );
    }

    // Détection de trafic anormal (trop de requêtes)
    const suspiciousVolume = this.detectHighVolumeRequests(req.ip || 'unknown');
    if (suspiciousVolume) {
      this.logger.warn(
        `📈 Volume de requêtes suspect depuis ${req.ip}`,
      );
    }
  }

  /**
   * 📊 Cache simple pour détecter le volume de requêtes élevé
   */
  private requestCounts = new Map<string, { count: number; timestamp: number }>();

  private detectHighVolumeRequests(ip: string): boolean {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    const maxRequests = 100; // Max 100 requêtes par minute

    const current = this.requestCounts.get(ip) || { count: 0, timestamp: now };

    // Reset si la fenêtre de temps est dépassée
    if (now - current.timestamp > timeWindow) {
      current.count = 1;
      current.timestamp = now;
    } else {
      current.count++;
    }

    this.requestCounts.set(ip, current);

    // Nettoyage périodique du cache
    if (this.requestCounts.size > 1000) {
      this.cleanupRequestCounts();
    }

    return current.count > maxRequests;
  }

  /**
   * 🧹 Nettoyage du cache des compteurs de requêtes
   */
  private cleanupRequestCounts(): void {
    const now = Date.now();
    const timeWindow = 60000;

    for (const [ip, data] of this.requestCounts.entries()) {
      if (now - data.timestamp > timeWindow) {
        this.requestCounts.delete(ip);
      }
    }
  }
}