import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  RefreshToken as RefreshTokenSchema,
  RefreshTokenDocument,
} from '../../auth/schemas/refresh-token.schema';
import {
  IRefreshTokenRepository,
  RefreshToken,
  CreateRefreshTokenData,
  UpdateRefreshTokenData,
  RefreshTokenQueryOptions,
} from '../interfaces/refresh-token.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 🔐 REFRESH TOKEN REPOSITORY - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository pour la gestion des refresh tokens.
 * Encapsule toute la logique d'accès aux données liée aux tokens avec Mongoose.
 */
@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  private readonly logger = new Logger(RefreshTokenRepository.name);

  constructor(
    @InjectModel(RefreshTokenSchema.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
  ) {}

  // ===== CRUD DE BASE =====

  async create(tokenData: CreateRefreshTokenData): Promise<RefreshToken> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const refreshToken = new this.refreshTokenModel(tokenData);
        const savedToken = await refreshToken.save();
        return this.mapToInterface(savedToken);
      },
      'RefreshToken',
    );
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const refreshToken = await this.refreshTokenModel
          .findOne({ token })
          .exec();
        return refreshToken ? this.mapToInterface(refreshToken) : null;
      },
      'RefreshToken',
      `token:${token.substring(0, 10)}...`,
    );
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const refreshToken = await this.refreshTokenModel
          .findById(id)
          .exec();
        return refreshToken ? this.mapToInterface(refreshToken) : null;
      },
      'RefreshToken',
      id,
    );
  }

  async update(id: string, updateData: UpdateRefreshTokenData): Promise<RefreshToken | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updatedToken = await this.refreshTokenModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .exec();
        return updatedToken ? this.mapToInterface(updatedToken) : null;
      },
      'RefreshToken',
      id,
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const result = await this.refreshTokenModel
          .findByIdAndDelete(id)
          .exec();
        return !!result;
      },
      'RefreshToken',
      id,
    );
  }

  // ===== GESTION SÉCURISÉE DES TOKENS =====

  async findValidToken(token: string): Promise<RefreshToken | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const refreshToken = await this.refreshTokenModel
          .findOne({
            token,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
          })
          .exec();
        return refreshToken ? this.mapToInterface(refreshToken) : null;
      },
      'RefreshToken',
      `validToken:${token.substring(0, 10)}...`,
    );
  }

  async revokeToken(token: string, reason: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.refreshTokenModel
          .updateOne(
            { token },
            {
              isRevoked: true,
              revokedAt: new Date(),
              revokedReason: reason,
            }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'RefreshToken',
      `revokeToken:${token.substring(0, 10)}...`,
    );
  }

  async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.refreshTokenModel
          .updateMany(
            { userId, isRevoked: false },
            {
              isRevoked: true,
              revokedAt: new Date(),
              revokedReason: reason,
            }
          )
          .exec();
        return result.modifiedCount;
      },
      'RefreshToken',
      userId,
    );
  }

  async markAsReplaced(oldTokenId: string, newTokenId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const result = await this.refreshTokenModel
          .updateOne(
            { _id: oldTokenId },
            { replacedBy: newTokenId }
          )
          .exec();
        return result.modifiedCount > 0;
      },
      'RefreshToken',
      oldTokenId,
    );
  }

  async updateLastUsed(tokenId: string, ipAddress?: string): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const updateData: any = { lastUsedAt: new Date() };
        if (ipAddress) {
          updateData.lastUsedIp = ipAddress;
        }
        
        const result = await this.refreshTokenModel
          .updateOne({ _id: tokenId }, updateData)
          .exec();
        return result.modifiedCount > 0;
      },
      'RefreshToken',
      tokenId,
    );
  }

  // ===== SÉCURITÉ ET DÉTECTION DE FRAUDE =====

  async detectTokenReuse(token: string): Promise<{
    isReused: boolean;
    revokedToken?: RefreshToken;
    relatedTokens?: RefreshToken[];
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Chercher le token révoqué
        const revokedToken = await this.refreshTokenModel
          .findOne({ token, isRevoked: true })
          .exec();

        if (!revokedToken) {
          return { isReused: false };
        }

        // Trouver les tokens liés (même utilisateur, même famille)
        const relatedTokens = await this.refreshTokenModel
          .find({ userId: revokedToken.userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .exec();

        return {
          isReused: true,
          revokedToken: this.mapToInterface(revokedToken),
          relatedTokens: relatedTokens.map(token => this.mapToInterface(token)),
        };
      },
      'RefreshToken',
      `detectReuse:${token.substring(0, 10)}...`,
    );
  }

  async findTokenChain(tokenId: string): Promise<RefreshToken[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const chain: RefreshToken[] = [];
        let currentTokenId = tokenId;

        // Remonter la chaîne de tokens
        while (currentTokenId) {
          const token = await this.refreshTokenModel.findById(currentTokenId).exec();
          if (!token) break;

          chain.push(this.mapToInterface(token));

          // Trouver le token qui a remplacé celui-ci
          const replacedBy = await this.refreshTokenModel
            .findOne({ replacedBy: currentTokenId })
            .exec();
          currentTokenId = replacedBy ? replacedBy._id.toString() : null;
        }

        return chain;
      },
      'RefreshToken',
      tokenId,
    );
  }

  async revokeTokenChain(tokenId: string, reason: string): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const chain = await this.findTokenChain(tokenId);
        const tokenIds = chain.map(token => token._id);

        const result = await this.refreshTokenModel
          .updateMany(
            { _id: { $in: tokenIds } },
            {
              isRevoked: true,
              revokedAt: new Date(),
              revokedReason: reason,
            }
          )
          .exec();

        return result.modifiedCount;
      },
      'RefreshToken',
      tokenId,
    );
  }

  // ===== RECHERCHE ET FILTRAGE =====

  async findByUserId(userId: string, options: RefreshTokenQueryOptions = {}): Promise<{
    tokens: RefreshToken[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;

        const query: any = { userId };
        if (options.isRevoked !== undefined) query.isRevoked = options.isRevoked;
        if (options.startDate) query.createdAt = { $gte: options.startDate };
        if (options.endDate) {
          query.createdAt = query.createdAt ? 
            { ...query.createdAt, $lte: options.endDate } : 
            { $lte: options.endDate };
        }

        const [tokens, total] = await Promise.all([
          this.refreshTokenModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.refreshTokenModel.countDocuments(query).exec(),
        ]);

        return {
          tokens: tokens.map(token => this.mapToInterface(token)),
          total,
          page,
          limit,
        };
      },
      'RefreshToken',
      userId,
    );
  }

  async findWithCriteria(options: RefreshTokenQueryOptions): Promise<{
    tokens: RefreshToken[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;

        const query: any = {};
        if (options.userId) query.userId = options.userId;
        if (options.isRevoked !== undefined) query.isRevoked = options.isRevoked;
        if (options.isExpired !== undefined) {
          if (options.isExpired) {
            query.expiresAt = { $lte: new Date() };
          } else {
            query.expiresAt = { $gt: new Date() };
          }
        }
        if (options.startDate) query.createdAt = { $gte: options.startDate };
        if (options.endDate) {
          query.createdAt = query.createdAt ? 
            { ...query.createdAt, $lte: options.endDate } : 
            { $lte: options.endDate };
        }

        const [tokens, total] = await Promise.all([
          this.refreshTokenModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
          this.refreshTokenModel.countDocuments(query).exec(),
        ]);

        return {
          tokens: tokens.map(token => this.mapToInterface(token)),
          total,
          page,
          limit,
        };
      },
      'RefreshToken',
      'criteria',
    );
  }

  // ===== MAINTENANCE ET NETTOYAGE =====

  async cleanupExpiredTokens(): Promise<{
    deletedCount: number;
    deletedTokens: string[];
  }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const expiredTokens = await this.refreshTokenModel
          .find({ expiresAt: { $lte: new Date() } })
          .select('_id token')
          .exec();

        const deletedTokens = expiredTokens.map(token => token.token);
        
        const result = await this.refreshTokenModel
          .deleteMany({ expiresAt: { $lte: new Date() } })
          .exec();

        this.logger.log(`Supprimé ${result.deletedCount} tokens expirés`);

        return {
          deletedCount: result.deletedCount,
          deletedTokens,
        };
      },
      'RefreshToken',
      'cleanup-expired',
    );
  }

  async cleanupRevokedTokens(olderThanDays: number): Promise<{
    deletedCount: number;
    deletedTokens: string[];
  }> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const revokedTokens = await this.refreshTokenModel
          .find({ 
            isRevoked: true,
            revokedAt: { $lte: cutoffDate }
          })
          .select('_id token')
          .exec();

        const deletedTokens = revokedTokens.map(token => token.token);
        
        const result = await this.refreshTokenModel
          .deleteMany({ 
            isRevoked: true,
            revokedAt: { $lte: cutoffDate }
          })
          .exec();

        this.logger.log(`Supprimé ${result.deletedCount} tokens révoqués anciens`);

        return {
          deletedCount: result.deletedCount,
          deletedTokens,
        };
      },
      'RefreshToken',
      'cleanup-revoked',
    );
  }

  // ===== STATISTIQUES ET MONITORING =====

  async countActiveTokensByUser(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.refreshTokenModel
          .countDocuments({
            userId,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
          })
          .exec();
      },
      'RefreshToken',
      userId,
    );
  }

  async countAllTokensByUser(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        return this.refreshTokenModel
          .countDocuments({ userId })
          .exec();
      },
      'RefreshToken',
      userId,
    );
  }

  async getTokenStatistics(): Promise<{
    totalTokens: number;
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    tokensCreatedToday: number;
    tokensRevokedToday: number;
    averageTokenLifetime: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          totalTokens,
          activeTokens,
          revokedTokens,
          expiredTokens,
          tokensCreatedToday,
          tokensRevokedToday,
        ] = await Promise.all([
          this.refreshTokenModel.countDocuments().exec(),
          this.refreshTokenModel.countDocuments({
            isRevoked: false,
            expiresAt: { $gt: new Date() },
          }).exec(),
          this.refreshTokenModel.countDocuments({ isRevoked: true }).exec(),
          this.refreshTokenModel.countDocuments({
            expiresAt: { $lte: new Date() },
          }).exec(),
          this.refreshTokenModel.countDocuments({
            createdAt: { $gte: today },
          }).exec(),
          this.refreshTokenModel.countDocuments({
            isRevoked: true,
            revokedAt: { $gte: today },
          }).exec(),
        ]);

        // Calcul simple de la durée de vie moyenne
        const averageTokenLifetime = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms par défaut

        return {
          totalTokens,
          activeTokens,
          revokedTokens,
          expiredTokens,
          tokensCreatedToday,
          tokensRevokedToday,
          averageTokenLifetime,
        };
      },
      'RefreshToken',
      'global-stats',
    );
  }

  async getUserTokenStatistics(userId: string): Promise<{
    totalTokens: number;
    activeTokens: number;
    revokedTokens: number;
    expiredTokens: number;
    lastTokenCreated?: Date;
    lastTokenUsed?: Date;
    averageSessionDuration: number;
  }> {
    return DatabaseErrorHandler.handleAggregationOperation(
      async () => {
        const [
          totalTokens,
          activeTokens,
          revokedTokens,
          expiredTokens,
          lastToken,
        ] = await Promise.all([
          this.refreshTokenModel.countDocuments({ userId }).exec(),
          this.refreshTokenModel.countDocuments({
            userId,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
          }).exec(),
          this.refreshTokenModel.countDocuments({ userId, isRevoked: true }).exec(),
          this.refreshTokenModel.countDocuments({
            userId,
            expiresAt: { $lte: new Date() },
          }).exec(),
          this.refreshTokenModel
            .findOne({ userId })
            .sort({ createdAt: -1 })
            .exec(),
        ]);

        const lastTokenUsed = await this.refreshTokenModel
          .findOne({ userId, lastUsedAt: { $exists: true } })
          .sort({ lastUsedAt: -1 })
          .exec();

        return {
          totalTokens,
          activeTokens,
          revokedTokens,
          expiredTokens,
          lastTokenCreated: (lastToken as any)?.createdAt,
          lastTokenUsed: lastTokenUsed?.lastUsedAt,
          averageSessionDuration: 15 * 60 * 1000, // 15 minutes par défaut
        };
      },
      'RefreshToken',
      userId,
    );
  }

  // ===== AUDIT ET LOGS =====

  async findSuspiciousTokens(): Promise<{
    token: RefreshToken;
    suspiciousReasons: string[];
  }[]> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        // Logique simplifiée pour détecter les tokens suspects
        const recentTokens = await this.refreshTokenModel
          .find({
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24h
          })
          .exec();

        return recentTokens
          .filter(token => {
            // Critères de suspicion simples
            const hasUnusualIP = token.ipAddress?.includes('unknown');
            const isOldButActive = !token.isRevoked && 
              (Date.now() - (token as any).createdAt.getTime()) > 7 * 24 * 60 * 60 * 1000; // > 7 jours
            
            return hasUnusualIP || isOldButActive;
          })
          .map(token => ({
            token: this.mapToInterface(token),
            suspiciousReasons: [
              ...(token.ipAddress?.includes('unknown') ? ['IP inconnue'] : []),
              ...(!token.isRevoked && (Date.now() - (token as any).createdAt.getTime()) > 7 * 24 * 60 * 60 * 1000 ? ['Token ancien actif'] : []),
            ],
          }));
      },
      'RefreshToken',
      'suspicious',
    );
  }

  async getTokenUsageHistory(tokenId: string): Promise<{
    createdAt: Date;
    lastUsedAt?: Date;
    usageCount: number;
    ipAddresses: string[];
    userAgents: string[];
    isRevoked: boolean;
    revokedReason?: string;
  }> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        const token = await this.refreshTokenModel.findById(tokenId).exec();
        if (!token) {
          throw new Error(`Token ${tokenId} non trouvé`);
        }

        return {
          createdAt: (token as any).createdAt,
          lastUsedAt: token.lastUsedAt,
          usageCount: token.lastUsedAt ? 1 : 0, // Simplifiée
          ipAddresses: [token.ipAddress].filter(Boolean),
          userAgents: [token.userAgent].filter(Boolean),
          isRevoked: token.isRevoked,
          revokedReason: token.revokedReason,
        };
      },
      'RefreshToken',
      tokenId,
    );
  }

  // ===== UTILITAIRES PRIVÉS =====

  private mapToInterface(doc: RefreshTokenDocument): RefreshToken {
    return {
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      token: doc.token,
      hashedToken: '', // Sera ajouté au schéma si nécessaire
      expiresAt: doc.expiresAt,
      createdAt: (doc as any).createdAt,
      isRevoked: doc.isRevoked,
      revokedAt: doc.revokedAt,
      revokedReason: doc.revokedReason,
      replacedBy: '', // Sera ajouté au schéma si nécessaire
      lastUsedAt: doc.lastUsedAt,
      lastUsedIp: '', // Sera ajouté au schéma si nécessaire
      ipAddress: doc.ipAddress,
      userAgent: doc.userAgent,
    };
  }
}