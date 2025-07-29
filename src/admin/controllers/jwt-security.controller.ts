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
 * 🔐 CONTRÔLEUR SÉCURITÉ JWT
 *
 * Contrôleur d'administration pour la gestion de la sécurité des secrets JWT.
 * Permet la validation, génération et audit des secrets JWT.
 * Réservé aux super-administrateurs pour des raisons de sécurité.
 *
 * Endpoints disponibles :
 * ✅ POST /admin/jwt-security/validate - Valider un secret JWT
 * ✅ POST /admin/jwt-security/generate - Générer un secret sécurisé
 * ✅ GET /admin/jwt-security/audit - Audit du secret actuel
 */
@ApiTags("Administration - JWT Security")
@Controller("admin/jwt-security")
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class JwtSecurityController {
  constructor(private jwtSecretValidator: JwtSecretValidatorService) {}

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
