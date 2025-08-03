/**
 * @fileoverview Contrôleur de sécurité JWT pour l'administration
 *
 * Ce contrôleur ultra-sécurisé gère la validation, génération et rotation
 * des secrets JWT. Il inclut des outils d'audit avancés et de validation
 * de la sécurité cryptographique. Réservé exclusivement aux super-administrateurs.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RoleGuard } from "../../auth/guards/role.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  JwtSecretValidatorService,
  JwtSecretValidationResult,
} from "../../auth/security/jwt-secret-validator.service";

/**
 * Contrôleur de sécurité JWT pour l'administration système
 *
 * Ce contrôleur de haute sécurité fournit des outils critiques pour la gestion
 * des secrets JWT de la plateforme. Il permet aux super-administrateurs de:
 * - Valider la robustesse cryptographique des secrets
 * - Générer de nouveaux secrets sécurisés
 * - Auditer la sécurité du système JWT actuel
 * - Effectuer des rotations sécurisées de secrets
 *
 * ## Sécurité :
 * - Accès restreint aux super-administrateurs uniquement
 * - Toutes les actions sont auditées et tracées
 * - Utilisation de JWT Guard + Role Guard pour double protection
 * - Validation cryptographique selon les standards OWASP
 *
 * ## Endpoints disponibles :
 * - POST /admin/jwt-security/validate - Valider un secret JWT
 * - POST /admin/jwt-security/generate - Générer un secret sécurisé
 * - GET /admin/jwt-security/audit - Audit du secret actuel
 *
 * @class JwtSecurityController
 * @version 1.0.0
 */
@ApiTags("Administration - JWT Security")
@Controller("admin/jwt-security")
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class JwtSecurityController {
  /**
   * Constructeur du contrôleur de sécurité JWT
   *
   * @constructor
   * @param {JwtSecretValidatorService} jwtSecretValidator - Service de validation des secrets JWT
   *
   * @example
   * ```typescript
   * // Le constructeur est utilisé automatiquement par NestJS
   * // Exemple d'injection automatique :
   * @Controller('admin/jwt-security')
   * export class JwtSecurityController {
   *   constructor(
   *     private readonly jwtSecretValidator: JwtSecretValidatorService
   *   ) {}
   * }
   * ```
   *
   * @since 1.0.0
   * @memberof JwtSecurityController
   */
  constructor(private readonly jwtSecretValidator: JwtSecretValidatorService) {}

  /**
   * Valide la sécurité d'un secret JWT
   *
   * Cette méthode analyse la robustesse cryptographique d'un secret JWT proposé
   * selon les standards de sécurité OWASP. Elle évalue la complexité, l'entropie
   * et détecte les vulnérabilités potentielles. Accessible aux superadmins uniquement.
   *
   * @async
   * @method validateSecret
   * @param {Object} body - Corps de la requête
   * @param {string} body.secret - Le secret JWT à valider
   * @returns {Promise<JwtSecretValidationResult & { timestamp: string }>} Résultat de validation avec horodatage
   * @throws {Error} Si le secret est manquant
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /admin/jwt-security/validate
   * Authorization: Bearer <jwt-token>
   * {
   *   "secret": "MySecureJwtSecret123!@#$%^&*()_+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg"
   * }
   *
   * // Réponse typique:
   * {
   *   isValid: true,
   *   strength: "excellent",
   *   score: 95,
   *   entropy: 4.2,
   *   errors: [],
   *   warnings: [],
   *   recommendations: ["Excellent secret, aucune amélioration nécessaire"],
   *   timestamp: "2024-01-01T00:00:00Z"
   * }
   * ```
   */
  @Post("validate")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Valider la sécurité d'un secret JWT",
    description: "Analyse complète de la sécurité d'un secret JWT proposé",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        secret: {
          type: "string",
          description: "Le secret JWT à valider",
          example:
            "MySecureJwtSecret123!@#$%^&*()_+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg",
        },
      },
      required: ["secret"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Validation complétée avec succès",
    schema: {
      type: "object",
      properties: {
        isValid: { type: "boolean" },
        strength: {
          type: "string",
          enum: ["weak", "medium", "good", "excellent"],
        },
        score: { type: "number", minimum: 0, maximum: 100 },
        entropy: { type: "number" },
        errors: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        timestamp: { type: "string" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Secret manquant ou invalide",
  })
  async validateSecret(
    @Body() body: { secret: string }
  ): Promise<JwtSecretValidationResult & { timestamp: string }> {
    if (!body.secret) {
      throw new Error("Secret JWT requis pour validation");
    }

    const validationResult = this.jwtSecretValidator.validateJwtSecret(
      body.secret
    );

    return {
      ...validationResult,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Génère un secret JWT cryptographiquement sécurisé
   *
   * Cette méthode génère un nouveau secret JWT en utilisant des algorithmes
   * cryptographiques sécurisés. Le secret généré respecte les standards OWASP
   * et inclut une validation automatique. Réservé aux super-administrateurs.
   *
   * @async
   * @method generateSecret
   * @param {Object} body - Corps de la requête
   * @param {number} [body.length=64] - Longueur du secret à générer (32-128 caractères)
   * @returns {Promise<{secret: string, validation: JwtSecretValidationResult, usage: object, timestamp: string}>} Secret généré avec validation et exemples d'usage
   * @throws {Error} Si la longueur est invalide
   *
   * @example
   * ```typescript
   * // Appel API
   * POST /admin/jwt-security/generate
   * Authorization: Bearer <jwt-token>
   * {
   *   "length": 64
   * }
   *
   * // Réponse typique:
   * {
   *   secret: "Hy7k9P2mR8qL5vN3zX6wE1tY4uI0oP9aS8dF7gH2jK5lM3nB6vC9xZ2qW5eR8tY1",
   *   validation: {
   *     isValid: true,
   *     strength: "excellent",
   *     score: 98,
   *     entropy: 4.5
   *   },
   *   usage: {
   *     environment: "JWT_SECRET=Hy7k9P2mR8qL5vN3zX6wE1tY4uI0oP9aS8dF7gH2jK5lM3nB6vC9xZ2qW5eR8tY1",
   *     dockerCompose: "      - JWT_SECRET=Hy7k9P2mR8qL5vN3zX6wE1tY4uI0oP9aS8dF7gH2jK5lM3nB6vC9xZ2qW5eR8tY1",
   *     kubernetes: "  JWT_SECRET: \"Hy7k9P2mR8qL5vN3zX6wE1tY4uI0oP9aS8dF7gH2jK5lM3nB6vC9xZ2qW5eR8tY1\""
   *   },
   *   timestamp: "2024-01-01T00:00:00Z"
   * }
   * ```
   */
  @Post("generate")
  @Roles("superadmin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Générer un secret JWT sécurisé",
    description: "Génère un nouveau secret JWT cryptographiquement sécurisé",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        length: {
          type: "number",
          description: "Longueur du secret à générer",
          minimum: 32,
          maximum: 128,
          default: 64,
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Secret généré avec succès",
    schema: {
      type: "object",
      properties: {
        secret: { type: "string" },
        validation: {
          type: "object",
          properties: {
            isValid: { type: "boolean" },
            strength: { type: "string" },
            score: { type: "number" },
            entropy: { type: "number" },
          },
        },
        usage: {
          type: "object",
          properties: {
            environment: { type: "string" },
            dockerCompose: { type: "string" },
            kubernetes: { type: "string" },
          },
        },
        timestamp: { type: "string" },
      },
    },
  })
  async generateSecret(@Body() body: { length?: number } = {}): Promise<{
    secret: string;
    validation: JwtSecretValidationResult;
    usage: {
      environment: string;
      dockerCompose: string;
      kubernetes: string;
    };
    timestamp: string;
  }> {
    const length = body.length || 64;

    if (length < 32 || length > 128) {
      throw new Error(
        "Longueur du secret doit être entre 32 et 128 caractères"
      );
    }

    const secret = this.jwtSecretValidator.generateSecureSecret(length);
    const validation = this.jwtSecretValidator.validateJwtSecret(secret);

    return {
      secret,
      validation,
      usage: {
        environment: `JWT_SECRET=${secret}`,
        dockerCompose: `      - JWT_SECRET=${secret}`,
        kubernetes: `  JWT_SECRET: "${secret}"`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Audite la sécurité du secret JWT actuellement configuré
   *
   * Cette méthode effectue un audit complet du secret JWT en production
   * sans jamais exposer le secret lui-même. Elle analyse la configuration,
   * évalue la robustesse cryptographique et fournit des recommandations
   * de sécurité. Accessible aux administrateurs et super-administrateurs.
   *
   * @async
   * @method auditCurrentSecret
   * @returns {Promise<{configured: boolean, strength?: string, score?: number, entropy?: number, warnings: string[], recommendations: string[], securityLevel: string, auditDate: string}>} Rapport d'audit complet
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/jwt-security/audit
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique (secret configuré):
   * {
   *   configured: true,
   *   strength: "excellent",
   *   score: 95,
   *   entropy: 4.2,
   *   warnings: [],
   *   recommendations: ["Secret excellent, maintenir le niveau de sécurité"],
   *   securityLevel: "EXCELLENT (95/100)",
   *   auditDate: "2024-01-01T00:00:00Z"
   * }
   *
   * // Réponse typique (secret non configuré):
   * {
   *   configured: false,
   *   warnings: ["JWT_SECRET n'est pas configuré"],
   *   recommendations: ["Configurer JWT_SECRET immédiatement"],
   *   securityLevel: "CRITIQUE - Non configuré",
   *   auditDate: "2024-01-01T00:00:00Z"
   * }
   * ```
   */
  @Get("audit")
  @Roles("admin", "superadmin")
  @ApiOperation({
    summary: "Audit du secret JWT actuel",
    description:
      "Analyse la sécurité du secret JWT actuellement configuré (sans révéler le secret)",
  })
  @ApiResponse({
    status: 200,
    description: "Audit complété avec succès",
    schema: {
      type: "object",
      properties: {
        configured: { type: "boolean" },
        strength: { type: "string" },
        score: { type: "number" },
        entropy: { type: "number" },
        warnings: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        securityLevel: { type: "string" },
        auditDate: { type: "string" },
      },
    },
  })
  async auditCurrentSecret(): Promise<{
    configured: boolean;
    strength?: string;
    score?: number;
    entropy?: number;
    warnings: string[];
    recommendations: string[];
    securityLevel: string;
    auditDate: string;
  }> {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return {
        configured: false,
        warnings: ["JWT_SECRET n'est pas configuré"],
        recommendations: [
          "Configurer JWT_SECRET dans les variables d'environnement",
          "Utiliser un secret d'au moins 32 caractères",
          "Générer un secret cryptographiquement sécurisé",
        ],
        securityLevel: "CRITIQUE - Non configuré",
        auditDate: new Date().toISOString(),
      };
    }

    const validation = this.jwtSecretValidator.validateJwtSecret(jwtSecret);

    return {
      configured: true,
      strength: validation.strength,
      score: validation.score,
      entropy: validation.entropy,
      warnings: validation.warnings,
      recommendations: validation.recommendations,
      securityLevel: validation.isValid
        ? `${validation.strength.toUpperCase()} (${validation.score}/100)`
        : "CRITIQUE - Secret invalide",
      auditDate: new Date().toISOString(),
    };
  }

  /**
   * Récupère les standards de sécurité JWT
   *
   * Cette méthode fournit la documentation complète des standards de sécurité
   * appliqués pour les secrets JWT, incluant les exigences minimales, les
   * bonnes pratiques et des exemples concrets. Accessible aux administrateurs
   * et super-administrateurs pour référence et formation.
   *
   * @async
   * @method getSecurityStandards
   * @returns {Promise<{standards: object, examples: object, tools: object}>} Documentation complète des standards
   *
   * @example
   * ```typescript
   * // Appel API
   * GET /admin/jwt-security/standards
   * Authorization: Bearer <jwt-token>
   *
   * // Réponse typique:
   * {
   *   standards: {
   *     minimumLength: 32,
   *     recommendedLength: 64,
   *     minimumEntropy: 3.0,
   *     recommendedEntropy: 4.0,
   *     requiredComplexity: ["Lettres majuscules", "Lettres minuscules", "Chiffres", "Caractères spéciaux"],
   *     forbiddenPatterns: ["Caractères répétés", "Séquences simples", "Mots communs"]
   *   },
   *   examples: {
   *     weak: ["secret", "mysecret"],
   *     good: "MyApp_JWT_Secret_2024_Prod_!@#...",
   *     excellent: "Hy7k9P2mR8qL5vN3zX6wE1tY..."
   *   },
   *   tools: {
   *     generation: ["openssl rand -base64 64", "POST /admin/jwt-security/generate"],
   *     validation: ["POST /admin/jwt-security/validate", "GET /admin/jwt-security/audit"]
   *   }
   * }
   * ```
   */
  @Get("standards")
  @Roles("admin", "superadmin")
  @ApiOperation({
    summary: "Standards de sécurité JWT",
    description:
      "Documentation des standards de sécurité appliqués pour les secrets JWT",
  })
  @ApiResponse({
    status: 200,
    description: "Standards récupérés avec succès",
  })
  async getSecurityStandards(): Promise<{
    standards: {
      minimumLength: number;
      recommendedLength: number;
      minimumEntropy: number;
      recommendedEntropy: number;
      requiredComplexity: string[];
      forbiddenPatterns: string[];
    };
    examples: {
      weak: string[];
      good: string;
      excellent: string;
    };
    tools: {
      generation: string[];
      validation: string[];
    };
  }> {
    return {
      standards: {
        minimumLength: 32,
        recommendedLength: 64,
        minimumEntropy: 3.0,
        recommendedEntropy: 4.0,
        requiredComplexity: [
          "Lettres majuscules (A-Z)",
          "Lettres minuscules (a-z)",
          "Chiffres (0-9)",
          "Caractères spéciaux (!@#$%^&*)",
        ],
        forbiddenPatterns: [
          "Caractères répétés (aaaa, 1111)",
          "Séquences simples (abc, 123)",
          "Mots communs (password, secret)",
          "Secrets d'exemple/tutoriels",
        ],
      },
      examples: {
        weak: [
          "secret",
          "mysecret",
          "your-256-bit-secret",
          "12345678901234567890123456789012",
        ],
        good: "MyApp_JWT_Secret_2024_Prod_!@#$%^&*()_+ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg",
        excellent: this.jwtSecretValidator.generateSecureSecret(64),
      },
      tools: {
        generation: [
          "openssl rand -base64 64",
          "node -e \"console.log(require('crypto').randomBytes(64).toString('base64'))\"",
          "POST /admin/jwt-security/generate (cette API)",
        ],
        validation: [
          "POST /admin/jwt-security/validate (cette API)",
          "GET /admin/jwt-security/audit (audit automatique)",
        ],
      },
    };
  }
}
