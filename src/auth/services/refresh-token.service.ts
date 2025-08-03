/**
 * @fileoverview Service de gestion des tokens de rafraîchissement sécurisés pour O'Ypunu
 * 
 * Ce service implémente un système avancé de gestion des refresh tokens avec
 * rotation automatique, détection de réutilisation, révocation en chaîne et
 * protection contre les attaques de vol de tokens pour sécuriser les sessions.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomBytes, createHash } from "crypto";
import {
  IRefreshTokenRepository,
  RefreshToken as RefreshTokenInterface,
  CreateRefreshTokenData,
} from "../../repositories/interfaces/refresh-token.repository.interface";

/**
 * Interface des métadonnées de token
 * 
 * @interface TokenMetadata
 */
export interface TokenMetadata {
  /** Adresse IP du client */
  ipAddress?: string;
  /** User-Agent du navigateur */
  userAgent?: string;
  /** Identifiant unique d'appareil */
  deviceId?: string;
  /** Identifiant de session */
  sessionId?: string;
}

/**
 * Interface d'une paire de tokens
 * 
 * @interface TokenPair
 */
export interface TokenPair {
  /** Token d'accès JWT */
  accessToken: string;
  /** Token de rafraîchissement */
  refreshToken: string;
  /** Durée d'expiration en secondes */
  expiresIn: number;
}

/**
 * Service de gestion des refresh tokens avec sécurité avancée
 * 
 * Ce service implémente un système de refresh tokens hautement sécurisé :
 * 
 * ## 🔄 Rotation automatique :
 * - **Nouveaux tokens** : Génération à chaque utilisation
 * - **Révocation immédiate** : Anciens tokens invalidés
 * - **Chaînage sécurisé** : Traçabilité des remplacements
 * - **Nettoyage automatique** : Suppression des tokens expirés
 * 
 * ## 🛡️ Détection d'attaques :
 * - **Réutilisation** : Détection de tokens déjà utilisés
 * - **Vol présumé** : Révocation en cascade des tokens
 * - **Anomalies IP** : Tracking des changements d'adresse
 * - **Expiration stricte** : Validation temporelle rigoureuse
 * 
 * ## 🔐 Sécurité cryptographique :
 * - **Tokens aléatoires** : Génération cryptographiquement sécurisée
 * - **Hachage SHA-256** : Stockage sécurisé des tokens
 * - **Entropie maximale** : Combinaison timestamp + UUID + random
 * - **Révocation granulaire** : Par token, utilisateur ou chaîne
 * 
 * @class RefreshTokenService
 * @version 1.0.0
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  /**
   * Constructeur du service de refresh tokens
   * 
   * @constructor
   * @param {IRefreshTokenRepository} refreshTokenRepository - Repository des refresh tokens
   * @param {JwtService} jwtService - Service JWT de NestJS
   * @param {ConfigService} configService - Service de configuration
   */
  constructor(
    @Inject("IRefreshTokenRepository")
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Crée un nouveau refresh token sécurisé
   * 
   * Génère un refresh token cryptographiquement sécurisé avec métadonnées
   * d'environnement pour tracking et expiration configurée.
   * 
   * @async
   * @method createRefreshToken
   * @param {string} userId - ID de l'utilisateur
   * @param {TokenMetadata} metadata - Métadonnées optionnelles du token
   * @returns {Promise<RefreshTokenInterface>} Token de rafraîchissement créé
   */
  async createRefreshToken(
    userId: string,
    metadata?: TokenMetadata
  ): Promise<RefreshTokenInterface> {
    const tokenValue = this.generateSecureToken();
    const hashedToken = this.hashToken(tokenValue);

    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        this.configService.get<number>("jwt.refreshTokenExpirationDays", 30)
    );

    const tokenData: CreateRefreshTokenData = {
      userId,
      token: tokenValue,
      hashedToken,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      isRevoked: false,
    };

    const refreshToken = await this.refreshTokenRepository.create(tokenData);

    this.logger.log(`Refresh token créé pour l'utilisateur ${userId}`);
    return refreshToken;
  }

  /**
   * Rafraîchit les tokens en utilisant le refresh token
   */
  async refreshTokens(
    refreshTokenValue: string,
    metadata?: TokenMetadata
  ): Promise<TokenPair> {
    const refreshToken = await this.validateRefreshToken(refreshTokenValue);

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token invalide");
    }

    // Mettre à jour la date de dernière utilisation via le repository
    await this.refreshTokenRepository.updateLastUsed(
      refreshToken._id,
      metadata?.ipAddress
    );

    // Générer le payload pour le nouvel access token
    const userPayload = {
      sub: refreshToken.userId,
      // Note: Récupérer les autres données utilisateur depuis la DB si nécessaire
    };

    // Rotation du refresh token pour sécurité maximale
    const newTokenPair = await this.rotateRefreshToken(
      refreshToken,
      userPayload,
      metadata
    );

    this.logger.log(
      `Tokens rafraîchis pour l'utilisateur ${refreshToken.userId}`
    );

    return newTokenPair;
  }

  /**
   * Rotation sécurisée du refresh token
   */
  private async rotateRefreshToken(
    oldToken: RefreshTokenInterface,
    userPayload: any,
    metadata?: TokenMetadata
  ): Promise<TokenPair> {
    // Créer le nouveau refresh token
    const newRefreshToken = await this.createRefreshToken(
      oldToken.userId,
      metadata
    );

    // Marquer l'ancien token comme remplacé via le repository
    await this.refreshTokenRepository.update(oldToken._id, {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: "Replaced by rotation",
      replacedBy: newRefreshToken._id,
    });

    // Lier le nouveau token à l'ancien via le repository
    await this.refreshTokenRepository.update(newRefreshToken._id, {
      lastUsedAt: new Date(),
    });

    // Générer le nouvel access token
    const accessToken = this.generateAccessToken(userPayload);

    return {
      accessToken,
      refreshToken: newRefreshToken.token,
      expiresIn: this.configService.get<number>(
        "jwt.accessTokenExpirationTime",
        3600
      ),
    };
  }

  /**
   * Valide un refresh token
   */
  async validateRefreshToken(
    tokenValue: string
  ): Promise<RefreshTokenInterface | null> {
    try {
      // Utiliser le repository pour trouver un token valide
      const refreshToken =
        await this.refreshTokenRepository.findValidToken(tokenValue);

      if (!refreshToken) {
        this.logger.warn(`Tentative d'utilisation d'un refresh token invalide`);
        return null;
      }

      // Détecter la réutilisation de tokens
      const reuseDetection =
        await this.refreshTokenRepository.detectTokenReuse(tokenValue);
      if (reuseDetection.isReused) {
        this.logger.error(`Réutilisation détectée du refresh token`);
        // Révoquer toute la chaîne de tokens par sécurité
        await this.refreshTokenRepository.revokeTokenChain(
          refreshToken._id,
          "Token reuse detected"
        );
        throw new UnauthorizedException("Token compromis détecté");
      }

      return refreshToken;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation du refresh token: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Révoque un refresh token
   */
  async revokeRefreshToken(
    token: string,
    reason: string = "Manual revocation"
  ): Promise<void> {
    const success = await this.refreshTokenRepository.revokeToken(
      token,
      reason
    );

    if (success) {
      this.logger.log(`Refresh token révoqué: ${reason}`);
    }
  }

  /**
   * Révoque tous les refresh tokens d'un utilisateur
   */
  async revokeAllUserTokens(
    userId: string,
    reason: string = "Revoke all tokens"
  ): Promise<void> {
    const revokedCount = await this.refreshTokenRepository.revokeAllUserTokens(
      userId,
      reason
    );

    this.logger.log(
      `${revokedCount} refresh tokens révoqués pour l'utilisateur ${userId}: ${reason}`
    );
  }

  /**
   * Nettoie les tokens expirés (à exécuter périodiquement)
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository.cleanupExpiredTokens();

    this.logger.log(`${result.deletedCount} refresh tokens expirés supprimés`);
  }

  /**
   * Génère un access token JWT
   */
  private generateAccessToken(payload: any): string {
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>(
        "jwt.accessTokenExpirationTime",
        "15m"
      ),
    });
  }

  /**
   * Génère un token cryptographiquement sécurisé
   */
  private generateSecureToken(): string {
    const randomBytesValue = randomBytes(32);
    const timestamp = Date.now().toString();
    const uuid = randomBytes(16).toString("hex");

    return createHash("sha256")
      .update(randomBytesValue.toString("hex") + timestamp + uuid)
      .digest("hex");
  }

  /**
   * Hache un token pour le stockage sécurisé
   */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /**
   * Génère une paire de tokens (access + refresh) pour un utilisateur
   */
  async generateTokenPair(
    userId: string,
    userPayload: any,
    metadata?: TokenMetadata
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = await this.createRefreshToken(userId, metadata);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      expiresIn: this.configService.get<number>(
        "jwt.accessTokenExpirationTime",
        3600
      ),
    };
  }

  /**
   * Détecte une potentielle attaque par réutilisation de token
   */
  async detectTokenReuse(token: string): Promise<boolean> {
    const reuseResult =
      await this.refreshTokenRepository.detectTokenReuse(token);

    if (reuseResult.isReused && reuseResult.revokedToken) {
      this.logger.error(
        `SÉCURITÉ: Tentative de réutilisation d'un refresh token révoqué pour l'utilisateur ${reuseResult.revokedToken.userId}`
      );

      // Révoquer tous les tokens de cet utilisateur par mesure de sécurité
      await this.revokeAllUserTokens(
        reuseResult.revokedToken.userId,
        "Token reuse detected - security measure"
      );

      return true;
    }

    return false;
  }
}
