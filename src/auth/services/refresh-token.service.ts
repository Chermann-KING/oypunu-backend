import { Injectable, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { RefreshToken } from '../schemas/refresh-token.schema';
import { IRefreshTokenRepository } from '../../repositories/interfaces/refresh-token.repository.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 jours
  private readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes

  constructor(
    @Inject('IRefreshTokenRepository')
    private refreshTokenRepository: IRefreshTokenRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Génère une paire de tokens (access + refresh) pour un utilisateur
   */
  async generateTokenPair(
    userId: string,
    userPayload: any,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = await this.createRefreshToken(userId, metadata);

    return {
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  /**
   * Génère un access token JWT
   */
  private generateAccessToken(payload: any): string {
    return this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });
  }

  /**
   * Crée un nouveau refresh token en base
   */
  private async createRefreshToken(
    userId: string,
    metadata?: TokenMetadata,
  ): Promise<RefreshToken> {
    // Générer un token cryptographiquement sécurisé
    const token = this.generateSecureToken();
    const hashedToken = this.hashToken(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);

    const refreshToken = await this.refreshTokenRepository.create({
      userId,
      token,
      hashedToken,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    this.logger.log(`Refresh token créé pour l'utilisateur ${userId}`);
    return refreshToken;
  }

  /**
   * Rafraîchit les tokens en utilisant le refresh token
   */
  async refreshTokens(
    refreshTokenValue: string,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    const refreshToken = await this.validateRefreshToken(refreshTokenValue);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    // Mettre à jour la date de dernière utilisation
    refreshToken.lastUsedAt = new Date();
    await refreshToken.save();

    // Générer le payload pour le nouvel access token
    const userPayload = {
      sub: refreshToken.userId.toString(),
      // Note: Récupérer les autres données utilisateur depuis la DB si nécessaire
    };

    // Rotation du refresh token pour sécurité maximale
    const newTokenPair = await this.rotateRefreshToken(
      refreshToken,
      userPayload,
      metadata,
    );

    this.logger.log(
      `Tokens rafraîchis pour l'utilisateur ${refreshToken.userId}`,
    );

    return newTokenPair;
  }

  /**
   * Rotation sécurisée du refresh token
   */
  private async rotateRefreshToken(
    oldToken: RefreshTokenDocument,
    userPayload: any,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    // Créer le nouveau refresh token
    const newRefreshToken = await this.createRefreshToken(
      oldToken.userId.toString(),
      metadata,
    );

    // Marquer l'ancien token comme remplacé
    oldToken.isRevoked = true;
    oldToken.revokedAt = new Date();
    oldToken.revokedReason = 'Replaced by rotation';
    oldToken.replacedByToken = newRefreshToken._id as any;
    await oldToken.save();

    // Lier le nouveau token à l'ancien
    newRefreshToken.replacesToken = oldToken._id as any;
    await newRefreshToken.save();

    // Générer le nouvel access token
    const accessToken = this.generateAccessToken(userPayload);

    return {
      accessToken,
      refreshToken: newRefreshToken.token,
    };
  }

  /**
   * Valide un refresh token
   */
  private async validateRefreshToken(
    token: string,
  ): Promise<RefreshToken | null> {
    const refreshToken = await this.refreshTokenRepository.findValidToken(token);

    if (!refreshToken) {
      this.logger.warn(`Tentative d'utilisation d'un refresh token invalide`);
      return null;
    }

    return refreshToken;
  }

  /**
   * Révoque un refresh token
   */
  async revokeRefreshToken(
    token: string,
    reason: string = 'Manual revocation',
  ): Promise<void> {
    const success = await this.refreshTokenRepository.revokeToken(token, reason);

    if (success) {
      this.logger.log(`Refresh token révoqué: ${reason}`);
    }
  }

  /**
   * Révoque tous les refresh tokens d'un utilisateur
   */
  async revokeAllUserTokens(
    userId: string,
    reason: string = 'Revoke all tokens',
  ): Promise<void> {
    const revokedCount = await this.refreshTokenRepository.revokeAllUserTokens(userId, reason);

    this.logger.log(
      `${revokedCount} refresh tokens révoqués pour l'utilisateur ${userId}: ${reason}`,
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
   * Génère un token cryptographiquement sécurisé
   */
  private generateSecureToken(): string {
    const randomBytes = crypto.randomBytes(32);
    const timestamp = Date.now().toString();
    const uuid = uuidv4().replace(/-/g, '');

    return crypto
      .createHash('sha256')
      .update(randomBytes + timestamp + uuid)
      .digest('hex');
  }

  /**
   * Hash un token pour le stockage sécurisé
   */
  private hashToken(token: string): string {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * Détecte une potentielle attaque par réutilisation de token
   */
  async detectTokenReuse(token: string): Promise<boolean> {
    const reuseResult = await this.refreshTokenRepository.detectTokenReuse(token);

    if (reuseResult.isReused && reuseResult.revokedToken) {
      this.logger.error(
        `SÉCURITÉ: Tentative de réutilisation d'un refresh token révoqué pour l'utilisateur ${reuseResult.revokedToken.userId}`,
      );

      // Révoquer tous les tokens de cet utilisateur par mesure de sécurité
      await this.revokeAllUserTokens(
        reuseResult.revokedToken.userId,
        'Token reuse detected - security measure',
      );

      return true;
    }

    return false;
  }
}
