import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from '../services/auth.service';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { RefreshTokenService } from '../services/refresh-token.service';
import { MailService } from '../../common/services/mail.service';
import { ActivityService } from '../../common/services/activity.service';

/**
 * 🔐 TESTS UNITAIRES - AUTH SERVICE (REPOSITORY PATTERN)
 * 
 * Tests pour AuthService utilisant Repository Pattern :
 * - Inscription avec validation et email
 * - Authentification et génération de tokens
 * - Gestion des mots de passe (reset, forgot)
 * - Authentification sociale
 * - Validation et refresh des tokens
 * - Déconnexion sécurisée
 */
describe('AuthService (Repository Pattern)', () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<IUserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;
  let mailService: jest.Mocked<MailService>;
  let activityService: jest.Mocked<ActivityService>;
  let configService: jest.Mocked<ConfigService>;

  // Mock user data
  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedpassword',
    isEmailVerified: true,
    isActive: true,
    role: 'user',
    nativeLanguageId: 'fr',
    learningLanguageIds: ['en'],
    profilePicture: null,
    totalWordsAdded: 0,
    totalCommunityPosts: 0,
    createdAt: new Date(),
    lastActive: new Date(),
  };

  const mockRegisterDto = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    hasAcceptedTerms: true,
    hasAcceptedPrivacyPolicy: true,
  };

  const mockLoginDto = {
    email: 'test@example.com',
    password: 'password123',
  };

  const mockTokenPair = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
  };

  beforeEach(async () => {
    // Mock repositories et services
    const mockUserRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      findByEmailVerificationToken: jest.fn(),
      updateEmailVerificationToken: jest.fn(),
      markEmailAsVerified: jest.fn(),
      findByPasswordResetToken: jest.fn(),
      updatePasswordResetToken: jest.fn(),
      updatePassword: jest.fn(),
      updateLastActive: jest.fn(),
      findBySocialProvider: jest.fn(),
      createSocialUser: jest.fn(),
    };

    const mockRefreshTokenService = {
      generateTokenPair: jest.fn(),
      refreshTokens: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserTokens: jest.fn(),
    };

    const mockMailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const mockActivityService = {
      logUserRegistered: jest.fn(),
      logUserLoggedIn: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: 'IUserRepository', useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: MailService, useValue: mockMailService },
        { provide: ActivityService, useValue: mockActivityService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get('IUserRepository');
    jwtService = module.get(JwtService);
    refreshTokenService = module.get(RefreshTokenService);
    mailService = module.get(MailService);
    activityService = module.get(ActivityService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('🔐 Registration Process', () => {
    it('should register user successfully with email verification', async () => {
      // Setup mocks
      userRepository.existsByEmail.mockResolvedValue(false);
      userRepository.existsByUsername.mockResolvedValue(false);
      userRepository.create.mockResolvedValue(mockUser as any);
      activityService.logUserRegistered.mockResolvedValue(undefined);
      mailService.sendVerificationEmail.mockResolvedValue(undefined);

      // Execute
      const result = await authService.register(mockRegisterDto, {
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Verify
      expect(result.message).toContain('Inscription réussie');
      expect(userRepository.existsByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userRepository.existsByUsername).toHaveBeenCalledWith('testuser');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          username: 'testuser',
          hasAcceptedTerms: true,
          hasAcceptedPrivacyPolicy: true,
          isEmailVerified: false,
          consentIP: '127.0.0.1',
          consentUserAgent: 'test-agent',
        })
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
      expect(activityService.logUserRegistered).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      userRepository.existsByEmail.mockResolvedValue(true);

      await expect(authService.register(mockRegisterDto)).rejects.toThrow(
        BadRequestException
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if username already exists', async () => {
      userRepository.existsByEmail.mockResolvedValue(false);
      userRepository.existsByUsername.mockResolvedValue(true);

      await expect(authService.register(mockRegisterDto)).rejects.toThrow(
        BadRequestException
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if terms not accepted', async () => {
      const invalidDto = { ...mockRegisterDto, hasAcceptedTerms: false };

      await expect(authService.register(invalidDto)).rejects.toThrow(
        BadRequestException
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('🔑 Login Process', () => {
    it('should login user successfully and generate tokens', async () => {
      // Setup mocks
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      userRepository.update.mockResolvedValue(mockUser as any);
      refreshTokenService.generateTokenPair.mockResolvedValue(mockTokenPair);
      activityService.logUserLoggedIn.mockResolvedValue(undefined);

      // Execute
      const result = await authService.login(mockLoginDto, {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      // Verify
      expect(result.tokens.access_token).toBe('access-token-123');
      expect(result.tokens.refresh_token).toBe('refresh-token-123');
      expect(result.user.email).toBe('test@example.com');
      expect(userRepository.update).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          isActive: true,
          lastActive: expect.any(Date),
          lastLogin: expect.any(Date),
        })
      );
      expect(activityService.logUserLoggedIn).toHaveBeenCalled();
    });

    it('should throw error for invalid email', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException
      );
      expect(refreshTokenService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(authService.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException
      );
      expect(refreshTokenService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('should throw error for unverified email', async () => {
      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      userRepository.findByEmail.mockResolvedValue(unverifiedUser as any);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      await expect(authService.login(mockLoginDto)).rejects.toThrow(
        UnauthorizedException
      );
      expect(refreshTokenService.generateTokenPair).not.toHaveBeenCalled();
    });
  });

  describe('📧 Email Verification', () => {
    it('should verify email successfully', async () => {
      const token = 'verification-token-123';
      userRepository.findByEmailVerificationToken.mockResolvedValue(mockUser as any);
      userRepository.markEmailAsVerified.mockResolvedValue(true);
      userRepository.updateEmailVerificationToken.mockResolvedValue(true);

      const result = await authService.verifyEmail(token);

      expect(result.message).toContain('Email vérifié avec succès');
      expect(userRepository.markEmailAsVerified).toHaveBeenCalledWith('user123');
      expect(userRepository.updateEmailVerificationToken).toHaveBeenCalledWith('user123', '');
    });

    it('should throw error for invalid verification token', async () => {
      userRepository.findByEmailVerificationToken.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should resend verification email', async () => {
      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      userRepository.findByEmail.mockResolvedValue(unverifiedUser as any);
      userRepository.updateEmailVerificationToken.mockResolvedValue(true);
      mailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await authService.resendVerificationEmail('test@example.com');

      expect(result.message).toContain('Un nouvel email de vérification');
      expect(userRepository.updateEmailVerificationToken).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('🔒 Password Reset', () => {
    it('should send password reset email', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      userRepository.updatePasswordResetToken.mockResolvedValue(true);
      mailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await authService.forgotPassword('test@example.com');

      expect(result.message).toContain('Un email de réinitialisation');
      expect(userRepository.updatePasswordResetToken).toHaveBeenCalledWith(
        'user123',
        expect.any(String),
        expect.any(Date)
      );
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should reset password successfully', async () => {
      const token = 'reset-token-123';
      const newPassword = 'newpassword123';
      
      userRepository.findByPasswordResetToken.mockResolvedValue(mockUser as any);
      userRepository.updatePassword.mockResolvedValue(true);
      userRepository.updatePasswordResetToken.mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-new-password' as never);

      const result = await authService.resetPassword(token, newPassword);

      expect(result.message).toContain('Mot de passe réinitialisé');
      expect(userRepository.updatePassword).toHaveBeenCalledWith('user123', 'hashed-new-password');
      expect(userRepository.updatePasswordResetToken).toHaveBeenCalledWith('user123', '', expect.any(Date));
    });
  });

  describe('🌐 Social Authentication', () => {
    const mockSocialUser = {
      provider: 'google',
      providerId: 'google123',
      email: 'social@example.com',
      firstName: 'Social',
      lastName: 'User',
      username: 'socialuser',
      profilePicture: 'https://example.com/pic.jpg',
    };

    it('should authenticate existing social user', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);
      refreshTokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

      const result = await authService.validateSocialLogin(mockSocialUser);

      expect(result.tokens.access_token).toBe('access-token-123');
      expect(result.user.email).toBe('test@example.com');
      expect(userRepository.update).toHaveBeenCalled();
    });

    it('should create new social user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.findBySocialProvider.mockResolvedValue(null);
      userRepository.findByUsername.mockResolvedValue(null);
      userRepository.createSocialUser.mockResolvedValue(mockUser as any);
      refreshTokenService.generateTokenPair.mockResolvedValue(mockTokenPair);

      const result = await authService.validateSocialLogin(mockSocialUser);

      expect(result.tokens.access_token).toBe('access-token-123');
      expect(userRepository.createSocialUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'social@example.com',
          provider: 'google',
          providerId: 'google123',
          isEmailVerified: true,
        })
      );
    });
  });

  describe('🔄 Token Management', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'refresh-token-123';
      refreshTokenService.refreshTokens.mockResolvedValue(mockTokenPair);

      const result = await authService.refreshTokens(refreshToken, {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.tokens.access_token).toBe('access-token-123');
      expect(result.tokens.refresh_token).toBe('refresh-token-123');
    });

    it('should logout and revoke refresh token', async () => {
      const refreshToken = 'refresh-token-123';
      refreshTokenService.revokeRefreshToken.mockResolvedValue(undefined);

      const result = await authService.logout(refreshToken);

      expect(result.message).toContain('Déconnexion réussie');
      expect(refreshTokenService.revokeRefreshToken).toHaveBeenCalledWith(
        refreshToken,
        'User logout'
      );
    });

    it('should logout from all devices', async () => {
      const userId = 'user123';
      refreshTokenService.revokeAllUserTokens.mockResolvedValue(undefined);

      const result = await authService.logoutAllDevices(userId);

      expect(result.message).toContain('Déconnexion effectuée sur tous les appareils');
      expect(refreshTokenService.revokeAllUserTokens).toHaveBeenCalledWith(
        userId,
        'Logout all devices'
      );
    });
  });

  describe('✅ User Validation', () => {
    it('should validate user and update last active', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.updateLastActive.mockResolvedValue(true);

      const result = await authService.validateUser('user123');

      expect(result.email).toBe('test@example.com');
      expect(userRepository.updateLastActive).toHaveBeenCalledWith('user123');
    });

    it('should throw error for invalid user', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(authService.validateUser('invalid-user')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});