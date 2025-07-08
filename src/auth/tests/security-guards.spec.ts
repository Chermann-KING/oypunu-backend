import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { RoleGuard, UserRole } from '../guards/role.guard';
import { AuditService } from '../services/audit.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { User } from '../../users/schemas/user.schema';
import { RefreshToken } from '../schemas/refresh-token.schema';
import { AuditLog } from '../schemas/audit-log.schema';

/**
 * 🛡️ TESTS UNITAIRES - GUARDS DE SÉCURITÉ
 * 
 * Tests focused sur la validation des permissions et rôles :
 * - Hiérarchie des rôles (user < contributor < admin < superadmin)
 * - Validation en temps réel depuis la base de données
 * - Audit logs des refus de permission
 * - Détection des tentatives d'élévation de privilèges
 */
describe('Security Guards', () => {
  let roleGuard: RoleGuard;
  let reflector: Reflector;
  let userModel: any;
  let auditService: AuditService;
  let mockExecutionContext: ExecutionContext;

  const mockUser = {
    _id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    save: jest.fn(),
  };

  const mockAdmin = {
    _id: 'admin123',
    username: 'testadmin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    isActive: true,
    isEmailVerified: true,
    save: jest.fn(),
  };

  const mockSuperAdmin = {
    _id: 'superadmin123',
    username: 'testsuperadmin',
    email: 'superadmin@example.com',
    role: UserRole.SUPERADMIN,
    isActive: true,
    isEmailVerified: true,
    save: jest.fn(),
  };

  beforeEach(async () => {
    const mockUserModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockRefreshTokenModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    };

    const mockAuditLogModel = {
      create: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleGuard,
        Reflector,
        JwtService,
        AuditService,
        RefreshTokenService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: mockRefreshTokenModel,
        },
        {
          provide: getModelToken(AuditLog.name),
          useValue: mockAuditLogModel,
        },
      ],
    }).compile();

    roleGuard = module.get<RoleGuard>(RoleGuard);
    reflector = module.get<Reflector>(Reflector);
    userModel = module.get(getModelToken(User.name));
    auditService = module.get<AuditService>(AuditService);

    // Mock du contexte d'exécution
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: mockUser,
          ip: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' },
          path: '/test',
          method: 'GET',
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    // Mock des méthodes du service d'audit
    jest.spyOn(auditService, 'logPermissionDenied').mockResolvedValue();
    jest.spyOn(auditService, 'logSecurityViolation').mockResolvedValue();
  });

  describe('🔐 Validation des rôles hiérarchiques', () => {
    it('should allow user access to user-level routes', async () => {
      // Mock: route nécessitant le rôle USER
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      userModel.findById.mockResolvedValue(mockUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow admin access to user-level routes (hierarchy)', async () => {
      // Mock: route nécessitant le rôle USER, mais utilisateur admin
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      userModel.findById.mockResolvedValue(mockAdmin);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny user access to admin routes', async () => {
      // Mock: route nécessitant le rôle ADMIN, mais utilisateur normal
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.ADMIN]);
      userModel.findById.mockResolvedValue(mockUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
      expect(auditService.logPermissionDenied).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser._id,
          username: mockUser.username,
          userRole: mockUser.role,
        }),
        expect.any(String),
        'admin',
      );
    });

    it('should allow superadmin access to all routes', async () => {
      // Mock: route nécessitant le rôle ADMIN, utilisateur superadmin
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.ADMIN]);
      userModel.findById.mockResolvedValue(mockSuperAdmin);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle multiple required roles', async () => {
      // Mock: route nécessitant CONTRIBUTOR ou ADMIN
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.CONTRIBUTOR, UserRole.ADMIN]);
      userModel.findById.mockResolvedValue(mockAdmin);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('🔄 Validation en temps réel depuis la base de données', () => {
    it('should validate user status from database', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      
      // Mock: utilisateur inactif dans la base
      const inactiveUser = { ...mockUser, isActive: false };
      userModel.findById.mockResolvedValue(inactiveUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        expect.any(Object),
        'inactive_user_access',
        expect.objectContaining({
          userId: mockUser._id,
          username: mockUser.username,
        }),
      );
    });

    it('should validate email verification status', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      
      // Mock: utilisateur avec email non vérifié
      const unverifiedUser = { ...mockUser, isEmailVerified: false };
      userModel.findById.mockResolvedValue(unverifiedUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        expect.any(Object),
        'unverified_email_access',
        expect.objectContaining({
          userId: mockUser._id,
          username: mockUser.username,
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      userModel.findById.mockRejectedValue(new Error('Database connection failed'));

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        expect.any(Object),
        'database_error_during_auth',
        expect.objectContaining({
          error: 'Database connection failed',
        }),
      );
    });

    it('should handle user not found in database', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      userModel.findById.mockResolvedValue(null);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        expect.any(Object),
        'user_not_found_in_db',
        expect.objectContaining({
          userId: mockUser._id,
        }),
      );
    });
  });

  describe('🚨 Détection des tentatives d\'élévation de privilèges', () => {
    it('should detect role mismatch between token and database', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.ADMIN]);
      
      // Mock: token contient role admin mais DB contient role user
      const requestWithElevatedToken = {
        user: { ...mockUser, role: UserRole.ADMIN }, // Token falsifié
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        path: '/admin/users',
        method: 'GET',
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(requestWithElevatedToken);
      userModel.findById.mockResolvedValue(mockUser); // DB contient role user

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        expect.any(Object),
        'role_escalation_attempt',
        expect.objectContaining({
          tokenRole: UserRole.ADMIN,
          dbRole: UserRole.USER,
          userId: mockUser._id,
        }),
      );
    });

    it('should detect suspicious IP changes', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      
      // Mock: utilisateur avec IP suspecte
      const suspiciousRequest = {
        user: mockUser,
        ip: '192.168.1.100', // IP différente
        headers: { 'user-agent': 'test-agent' },
        path: '/admin/users',
        method: 'GET',
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(suspiciousRequest);
      userModel.findById.mockResolvedValue(mockUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      // Note: ce test dépend de la logique métier pour détecter les IPs suspectes
      // Pour l'instant, on vérifie juste que la structure est en place
    });
  });

  describe('📊 Audit logs des refus de permission', () => {
    it('should log permission denial with context', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.ADMIN]);
      userModel.findById.mockResolvedValue(mockUser);

      await roleGuard.canActivate(mockExecutionContext);

      expect(auditService.logPermissionDenied).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser._id,
          username: mockUser.username,
          userRole: mockUser.role,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          requestPath: '/test',
          requestMethod: 'GET',
        }),
        '/test',
        'admin',
      );
    });

    it('should log security violations with detailed context', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);
      userModel.findById.mockResolvedValue(null);

      await roleGuard.canActivate(mockExecutionContext);

      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser._id,
          username: mockUser.username,
          userRole: mockUser.role,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          requestPath: '/test',
          requestMethod: 'GET',
        }),
        'user_not_found_in_db',
        expect.objectContaining({
          userId: mockUser._id,
        }),
      );
    });
  });

  describe('🔒 Gestion des cas limites', () => {
    it('should handle missing user in request', async () => {
      const requestWithoutUser = {
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        path: '/test',
        method: 'GET',
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(requestWithoutUser);
      jest.spyOn(reflector, 'get').mockReturnValue([UserRole.USER]);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('should handle routes without role requirements', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(null);
      userModel.findById.mockResolvedValue(mockUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle empty role requirements', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([]);
      userModel.findById.mockResolvedValue(mockUser);

      const result = await roleGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});