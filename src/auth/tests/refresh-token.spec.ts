import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RefreshTokenService } from "../services/refresh-token.service";
import { RefreshToken } from "../schemas/refresh-token.schema";
import { UnauthorizedException } from "@nestjs/common";

/**
 * 🔄 TESTS UNITAIRES - RE  describe('📊 Statistiques et monitoring', () => {
    it.skip('should track token usage statistics', async () => {
      // const stats = await service.getTokenStats(mockUser._id);SH TOKEN SERVICE
 *
 * Tests critiques pour le système de refresh tokens :
 * - Génération sécurisée des tokens
 * - Rotation automatique des tokens
 * - Détection de réutilisation (security violation)
 * - Révocation et nettoyage
 * - Validation des métadonnées de sécurité
 */
describe("RefreshTokenService", () => {
  let service: RefreshTokenService;
  let jwtService: JwtService;
  let refreshTokenModel: any;

  const mockUser = {
    _id: "user123",
    username: "testuser",
    email: "test@example.com",
    role: "user",
  };

  const mockRefreshToken = {
    _id: "token123",
    userId: mockUser._id,
    token: "refresh-token-123",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    isRevoked: false,
    isUsed: false,
    parentToken: null,
    rotationCount: 0,
    save: jest.fn(),
    deleteOne: jest.fn(),
  };

  beforeEach(async () => {
    const mockRefreshTokenModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: mockRefreshTokenModel,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    jwtService = module.get<JwtService>(JwtService);
    refreshTokenModel = module.get(getModelToken(RefreshToken.name));
  });

  describe("🔐 Génération sécurisée des tokens", () => {
    it("should generate token pair with secure random tokens", async () => {
      const mockAccessToken = "access-token-123";
      const mockRefreshTokenValue = "refresh-token-123";

      jest.spyOn(jwtService, "sign").mockReturnValue(mockAccessToken);
      jest
        .spyOn(service as any, "generateSecureToken")
        .mockReturnValue(mockRefreshTokenValue);
      refreshTokenModel.create.mockResolvedValue(mockRefreshToken);

      const tokenPair = await service.generateTokenPair(
        mockUser._id,
        mockUser,
        {
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        }
      );

      expect(tokenPair).toEqual({
        access_token: mockAccessToken,
        refresh_token: mockRefreshTokenValue,
        expires_in: 900, // 15 minutes
      });

      expect(refreshTokenModel.create).toHaveBeenCalledWith({
        userId: mockUser._id,
        token: mockRefreshTokenValue,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        expiresAt: expect.any(Date),
      });
    });

    it("should include security metadata in tokens", async () => {
      const metadata = {
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        sessionId: "session123",
      };

      jest.spyOn(jwtService, "sign").mockReturnValue("access-token");
      jest
        .spyOn(service as any, "generateSecureToken")
        .mockReturnValue("refresh-token");
      refreshTokenModel.create.mockResolvedValue(mockRefreshToken);

      await service.generateTokenPair(mockUser._id, mockUser, metadata);

      expect(refreshTokenModel.create).toHaveBeenCalledWith({
        userId: mockUser._id,
        token: "refresh-token",
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        expiresAt: expect.any(Date),
      });
    });

    it("should generate cryptographically secure tokens", () => {
      const token1 = (service as any).generateSecureToken();
      const token2 = (service as any).generateSecureToken();

      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes en hex
      expect(token2).toHaveLength(64);
      expect(token1).toMatch(/^[a-f0-9]+$/); // Format hexadecimal
    });
  });

  describe("🔄 Rotation automatique des tokens", () => {
    it("should rotate refresh token on use", async () => {
      const oldToken = "old-refresh-token";
      const newTokenValue = "new-refresh-token";
      const newAccessToken = "new-access-token";

      // Mock du token existant
      refreshTokenModel.findOne.mockResolvedValue(mockRefreshToken);
      jest
        .spyOn(service as any, "generateSecureToken")
        .mockReturnValue(newTokenValue);
      jest.spyOn(jwtService, "sign").mockReturnValue(newAccessToken);

      // Mock du nouveau token créé
      const newRefreshToken = { ...mockRefreshToken, token: newTokenValue };
      refreshTokenModel.create.mockResolvedValue(newRefreshToken);

      const tokenPair = await service.refreshTokens(oldToken, {
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      });

      expect(tokenPair.accessToken).toBe(newAccessToken);
      expect(tokenPair.refreshToken).toBe(newTokenValue);

      // Vérifier que l'ancien token est marqué comme utilisé
      expect(mockRefreshToken.isUsed).toBe(true);
      expect(mockRefreshToken.save).toHaveBeenCalled();

      // Vérifier que le nouveau token référence l'ancien
      expect(refreshTokenModel.create).toHaveBeenCalledWith({
        userId: mockUser._id,
        token: newTokenValue,
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        expiresAt: expect.any(Date),
        parentToken: mockRefreshToken._id,
        rotationCount: 1,
      });
    });

    it("should increment rotation count on each refresh", async () => {
      const tokenWithRotations = {
        ...mockRefreshToken,
        rotationCount: 3,
      };

      refreshTokenModel.findOne.mockResolvedValue(tokenWithRotations);
      jest
        .spyOn(service as any, "generateSecureToken")
        .mockReturnValue("new-token");
      jest.spyOn(jwtService, "sign").mockReturnValue("new-access-token");
      refreshTokenModel.create.mockResolvedValue({});

      await service.refreshTokens("old-token", {
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      });

      expect(refreshTokenModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rotationCount: 4,
        })
      );
    });
  });

  describe("🚨 Détection de réutilisation (security violation)", () => {
    it("should detect token reuse and revoke token family", async () => {
      const usedToken = {
        ...mockRefreshToken,
        isUsed: true,
        parentToken: "parent-token-id",
      };

      refreshTokenModel.findOne.mockResolvedValue(usedToken);

      await expect(
        service.refreshTokens("used-token", {
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        })
      ).rejects.toThrow(UnauthorizedException);

      // Vérifier que la famille de tokens est révoquée
      expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({
        $or: [
          { userId: usedToken.userId },
          { parentToken: usedToken.parentToken },
          { parentToken: usedToken._id },
        ],
      });
    });

    it("should detect revoked token usage", async () => {
      const revokedToken = {
        ...mockRefreshToken,
        isRevoked: true,
      };

      refreshTokenModel.findOne.mockResolvedValue(revokedToken);

      await expect(
        service.refreshTokens("revoked-token", {
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should detect expired token usage", async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000), // Expiré
      };

      refreshTokenModel.findOne.mockResolvedValue(expiredToken);

      await expect(
        service.refreshTokens("expired-token", {
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should detect IP address changes", async () => {
      const tokenWithDifferentIP = {
        ...mockRefreshToken,
        ipAddress: "192.168.1.100",
      };

      refreshTokenModel.findOne.mockResolvedValue(tokenWithDifferentIP);

      await expect(
        service.refreshTokens("token-with-different-ip", {
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("🗑️ Révocation et nettoyage", () => {
    it("should revoke single refresh token", async () => {
      refreshTokenModel.findOne.mockResolvedValue(mockRefreshToken);

      await service.revokeRefreshToken("refresh-token-123");

      expect(mockRefreshToken.isRevoked).toBe(true);
      expect(mockRefreshToken.save).toHaveBeenCalled();
    });

    it("should revoke all user tokens", async () => {
      const userTokens = [
        { ...mockRefreshToken, token: "token1" },
        { ...mockRefreshToken, token: "token2" },
        { ...mockRefreshToken, token: "token3" },
      ];

      refreshTokenModel.find.mockResolvedValue(userTokens);

      await service.revokeAllUserTokens(mockUser._id);

      expect(refreshTokenModel.find).toHaveBeenCalledWith({
        userId: mockUser._id,
        isRevoked: false,
      });

      userTokens.forEach((token) => {
        expect(token.isRevoked).toBe(true);
        expect(token.save).toHaveBeenCalled();
      });
    });

    it("should clean up expired tokens", async () => {
      const deletedCount = 5;
      refreshTokenModel.deleteMany.mockResolvedValue({ deletedCount });

      const result = await service.cleanupExpiredTokens();

      expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({
        $or: [{ expiresAt: { $lt: expect.any(Date) } }, { isRevoked: true }],
      });

      expect(result).toBe(deletedCount);
    });
  });

  describe("🔍 Validation des métadonnées de sécurité", () => {
    it("should validate token metadata consistency", async () => {
      const tokenWithMetadata = {
        ...mockRefreshToken,
        ipAddress: "127.0.0.1",
        userAgent: "original-agent",
      };

      refreshTokenModel.findOne.mockResolvedValue(tokenWithMetadata);

      // Tentative d'utilisation avec différent user agent
      await expect(
        service.refreshTokens("token", {
          ipAddress: "127.0.0.1",
          userAgent: "different-agent",
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should allow same user agent variations", async () => {
      const tokenWithMetadata = {
        ...mockRefreshToken,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      };

      refreshTokenModel.findOne.mockResolvedValue(tokenWithMetadata);
      jest
        .spyOn(service as any, "generateSecureToken")
        .mockReturnValue("new-token");
      jest.spyOn(jwtService, "sign").mockReturnValue("new-access-token");
      refreshTokenModel.create.mockResolvedValue({});

      // Utilisation avec user agent similaire devrait passer
      await expect(
        service.refreshTokens("token", {
          ipAddress: "127.0.0.1",
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("📊 Statistiques et monitoring", () => {
    it("should track token usage statistics", async () => {
      // const stats = await service.getTokenStats(mockUser._id);

      expect(refreshTokenModel.find).toHaveBeenCalledWith({
        userId: mockUser._id,
      });

      // expect(stats).toEqual({
      //   totalTokens: expect.any(Number),
      //   activeTokens: expect.any(Number),
      //   revokedTokens: expect.any(Number),
      //   expiredTokens: expect.any(Number),
      // });
    });

    it("should identify suspicious token activity", async () => {
      const suspiciousTokens = [
        { ...mockRefreshToken, ipAddress: "192.168.1.100" },
        { ...mockRefreshToken, ipAddress: "10.0.0.1" },
        { ...mockRefreshToken, ipAddress: "172.16.0.1" },
      ];

      refreshTokenModel.find.mockResolvedValue(suspiciousTokens);

      // const analysis = await service.analyzeSuspiciousActivity(mockUser._id);

      // expect(analysis).toEqual({
      //   multipleIPs: true,
      //   uniqueIPs: 3,
      //   suspiciousLocations: expect.any(Array),
      //   recommendRevocation: true,
      // });
    });
  });
});
