/**
 * @fileoverview Configuration de production sécurisée et optimisée pour O'Ypunu
 *
 * Cette configuration complète et durcie pour l'environnement de production
 * inclut tous les paramètres de sécurité, performance, monitoring et
 * fonctionnalités nécessaires pour une application enterprise-grade.
 * Elle valide automatiquement les variables d'environnement critiques
 * et applique les meilleures pratiques de sécurité.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { ConfigFactory } from "@nestjs/config";

/**
 * Factory de configuration de production pour O'Ypunu
 *
 * Cette fonction génère une configuration complète et sécurisée pour
 * l'environnement de production. Elle inclut :
 *
 * ## Fonctionnalités de sécurité :
 * - Validation automatique des variables d'environnement critiques
 * - Validation de la robustesse des secrets JWT et encryption
 * - Configuration CORS restrictive avec domaines autorisés
 * - Headers de sécurité (HSTS, CSP, XSS Protection, etc.)
 * - Rate limiting strict avec limites spécialisées par endpoint
 * - Sessions sécurisées avec cookies HttpOnly/Secure/SameSite
 *
 * ## Performance et stabilité :
 * - Pool de connexions MongoDB optimisé (5-50 connexions)
 * - Compression Brotli/Gzip avec seuils optimisés
 * - Cache multi-niveau avec TTL configurable
 * - Support cluster multi-worker automatique
 * - SSL/TLS obligatoire avec validation complète
 *
 * ## Monitoring et observabilité :
 * - Logging structuré JSON pour ELK Stack
 * - Intégration Sentry pour error tracking
 * - Métriques Prometheus pour monitoring
 * - Health checks automatisés
 * - APM (Application Performance Monitoring)
 *
 * ## Fonctionnalités métier :
 * - OAuth multi-provider (Google, Facebook, Twitter)
 * - Email transactionnel avec pool de connexions
 * - Upload sécurisé via Cloudinary
 * - WebSocket temps réel avec CORS
 * - Audit trail avec rétention configurée
 * - Backup automatisé avec chiffrement
 *
 * @function productionConfig
 * @returns {Object} Configuration complète de production
 * @throws {Error} Si des variables d'environnement critiques manquent
 * @throws {Error} Si les secrets ne respectent pas les critères de robustesse
 *
 * @example
 * ```typescript
 * // Utilisation dans app.module.ts
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({
 *       load: [productionConfig],
 *       validationSchema: configValidationSchema,
 *       validationOptions: { allowUnknown: false, abortEarly: false }
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
export const productionConfig: ConfigFactory = () => {
  // Validation des variables d'environnement critiques
  const requiredEnvVars = [
    "MONGODB_URI",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "ENCRYPTION_MASTER_KEY",
    "APP_URL",
    "MAIL_HOST",
    "MAIL_USER",
    "MAIL_PASSWORD",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );
  if (missingVars.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes: ${missingVars.join(", ")}`
    );
  }

  // Validation de la robustesse des secrets
  validateSecretStrength(process.env.JWT_SECRET!, "JWT_SECRET");
  validateSecretStrength(process.env.JWT_REFRESH_SECRET!, "JWT_REFRESH_SECRET");
  validateSecretStrength(
    process.env.ENCRYPTION_MASTER_KEY!,
    "ENCRYPTION_MASTER_KEY"
  );

  return {
    // 🌍 Application
    app: {
      name: "O'Ypunu Dictionary API",
      version: process.env.APP_VERSION || "1.0.0",
      environment: "production",
      port: parseInt(process.env.PORT || "3001", 10),
      url: process.env.APP_URL,
      frontendUrl: process.env.FRONTEND_URL,
    },

    // 🗄️ Base de données
    database: {
      uri: process.env.MONGODB_URI,
      options: {
        // Configuration optimisée pour la production
        maxPoolSize: 50,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        compressors: ["zstd", "zlib"],
        tls: true,
        retryWrites: true,
        writeConcern: { w: "majority" },
        readPreference: "primaryPreferred",
      },
    },

    // 🔐 JWT Configuration sécurisée
    jwt: {
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: "15m", // Token courte durée pour sécurité
        issuer: "oypunu-api",
        audience: "oypunu-app",
        algorithm: "HS512", // Algorithme robuste
      },
      refresh: {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: "7d", // Refresh token 7 jours max
      },
    },

    // 🔒 Sécurité
    security: {
      // Chiffrement
      encryption: {
        masterKey: process.env.ENCRYPTION_MASTER_KEY,
        algorithm: "aes-256-gcm",
        keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 jours
      },

      // Hachage des mots de passe
      bcrypt: {
        rounds: 12, // Robuste mais pas trop lent
      },

      // CORS strict
      cors: {
        origin: [
          process.env.FRONTEND_URL!,
          "https://oypunu.com",
          "https://www.oypunu.com",
        ],
        credentials: true,
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Origin",
          "X-Requested-With",
          "Content-Type",
          "Accept",
          "Authorization",
          "X-CSRF-Token",
        ],
        maxAge: 86400, // 24h
      },

      // Headers de sécurité
      headers: {
        contentSecurityPolicy: true,
        hsts: {
          maxAge: 31536000, // 1 an
          includeSubDomains: true,
          preload: true,
        },
        frameguard: { action: "deny" },
        xssProtection: true,
        noSniff: true,
        referrerPolicy: "strict-origin-when-cross-origin",
      },

      // Rate limiting strict
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limite par IP
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: "Trop de requêtes, veuillez réessayer plus tard.",
          retryAfter: "15 minutes",
        },
        // Rate limits spécialisés
        auth: {
          windowMs: 15 * 60 * 1000,
          max: 5, // Seulement 5 tentatives de connexion
        },
        api: {
          windowMs: 60 * 1000,
          max: 100,
        },
        upload: {
          windowMs: 60 * 1000,
          max: 5,
        },
      },

      // Session sécurisée
      session: {
        secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
        name: "oypunu.sid",
        cookie: {
          httpOnly: true,
          secure: true, // HTTPS uniquement
          sameSite: "strict",
          maxAge: 24 * 60 * 60 * 1000, // 24h
          domain: process.env.COOKIE_DOMAIN,
        },
        resave: false,
        saveUninitialized: false,
      },
    },

    // 📧 Configuration mail
    mail: {
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || "587", 10),
      secure: process.env.MAIL_PORT === "465",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
      from: process.env.MAIL_FROM || `"O'Ypunu" <${process.env.MAIL_USER}>`,
      tls: {
        rejectUnauthorized: true,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    },

    // 🔌 OAuth (configuration sécurisée)
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scope: ["email", "profile"],
      },
      facebook: {
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET,
        scope: ["email", "public_profile"],
      },
      twitter: {
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        scope: ["email"],
      },
    },

    // ☁️ Cloudinary (stockage sécurisé)
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
      transformation: {
        quality: "auto:best",
        fetch_format: "auto",
      },
    },

    // 📊 Logging et monitoring
    logging: {
      level: process.env.LOG_LEVEL || "info",
      format: "json", // Format structuré pour ELK
      timestamp: true,
      colorize: false, // Pas de couleurs en production

      // Transports
      console: {
        enabled: true,
        level: "error", // Seulement les erreurs en console
      },
      file: {
        enabled: true,
        level: "info",
        filename: "/var/log/oypunu/app.log",
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        tailable: true,
      },
      // Intégration externe (ex: Sentry, DataDog)
      external: {
        enabled: !!process.env.SENTRY_DSN,
        dsn: process.env.SENTRY_DSN,
        environment: "production",
        sampleRate: 1.0,
        tracesSampleRate: 0.1, // 10% des traces
      },
    },

    // 📈 Monitoring et métriques
    monitoring: {
      healthCheck: {
        enabled: true,
        endpoint: "/health",
        timeout: 5000,
      },
      metrics: {
        enabled: true,
        endpoint: "/metrics",
        prometheus: true,
      },
      apm: {
        enabled: !!process.env.APM_SERVER_URL,
        serverUrl: process.env.APM_SERVER_URL,
        secretToken: process.env.APM_SECRET_TOKEN,
        serviceName: "oypunu-api",
        environment: "production",
      },
    },

    // 🚀 Performance
    performance: {
      compression: {
        enabled: true,
        level: 6, // Bon compromis compression/CPU
        threshold: 1024, // Compresser à partir de 1KB
      },
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes par défaut
        max: 1000, // Max 1000 entrées en cache
      },
      cluster: {
        enabled: true,
        workers:
          parseInt(process.env.CLUSTER_WORKERS || "0", 10) ||
          require("os").cpus().length,
      },
    },

    // 🔧 Fonctionnalités spécifiques
    features: {
      swagger: {
        enabled: false, // Désactivé en production pour sécurité
        path: "/api-docs",
      },
      websocket: {
        enabled: true,
        cors: {
          origin: process.env.FRONTEND_URL,
          credentials: true,
        },
      },
      audit: {
        enabled: true,
        retentionDays: 365, // Garder 1 an d'audit logs
        sensitiveFields: ["password", "token", "secret"],
      },
    },

    // 🌐 Internationalisation
    i18n: {
      defaultLanguage: "fr",
      supportedLanguages: ["fr", "en", "es", "de"],
      fallbackLanguage: "en",
    },

    // 💾 Backup et récupération
    backup: {
      enabled: true,
      schedule: "0 2 * * *", // Tous les jours à 2h du matin
      retention: 30, // Garder 30 jours de backups
      compression: true,
      encryption: true,
    },
  };
};

/**
 * Valide la robustesse et la sécurité d'un secret cryptographique
 *
 * Cette fonction critique vérifie que les secrets utilisés pour JWT,
 * chiffrement et autres opérations sensibles respectent les standards
 * de sécurité requis pour un environnement de production.
 *
 * ## Critères de validation :
 * - Longueur minimum : 32 caractères
 * - Complexité : majuscules, minuscules, chiffres, caractères spéciaux
 * - Absence de mots faibles ou communs
 * - Protection contre les secrets par défaut
 *
 * @function validateSecretStrength
 * @param {string} secret - Secret à valider
 * @param {string} name - Nom du secret pour messages d'erreur
 * @throws {Error} Si le secret ne respecte pas les critères minimum
 * @returns {void}
 *
 * @example
 * ```typescript
 * // Validation d'un secret JWT
 * validateSecretStrength(process.env.JWT_SECRET!, 'JWT_SECRET');
 *
 * // Validation d'une clé de chiffrement
 * validateSecretStrength(process.env.ENCRYPTION_KEY!, 'ENCRYPTION_KEY');
 * ```
 */
function validateSecretStrength(secret: string, name: string): void {
  if (secret.length < 32) {
    throw new Error(`${name} doit contenir au moins 32 caractères`);
  }

  // Vérifier la complexité
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasNumber = /[0-9]/.test(secret);
  const hasSpecial = /[^A-Za-z0-9]/.test(secret);

  if (!(hasLower && hasUpper && hasNumber && hasSpecial)) {
    console.warn(
      `⚠️  ${name} devrait contenir des majuscules, minuscules, chiffres et caractères spéciaux`
    );
  }

  // Vérifier qu'il ne s'agit pas d'un secret par défaut ou faible
  const weakSecrets = [
    "secret",
    "password",
    "changeme",
    "123456",
    "default",
    "mysecret",
  ];

  if (weakSecrets.some((weak) => secret.toLowerCase().includes(weak))) {
    throw new Error(`${name} ne doit pas contenir de mots faibles ou communs`);
  }
}
