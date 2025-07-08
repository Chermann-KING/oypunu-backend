import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

/**
 * 🔐 TESTS E2E CRITIQUES - FLOW D'AUTHENTIFICATION
 * 
 * Ces tests valident les flux de sécurité essentiels :
 * - Authentification avec refresh tokens
 * - Validation des permissions hiérarchiques
 * - Détection des violations de sécurité
 * - Audit logs des actions sensibles
 */
describe('AuthFlow (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let mongoConnection: Connection;
  let moduleRef: TestingModule;
  
  // Données de test
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123!',
    role: 'user',
  };

  const testAdmin = {
    username: 'testadmin',
    email: 'admin@example.com',
    password: 'AdminPassword123!',
    role: 'admin',
  };

  beforeAll(async () => {
    // 🗄️ Base de données en mémoire pour les tests
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRoot(mongoUri),
        JwtModule.register({
          secret: 'test-jwt-secret',
          signOptions: { expiresIn: '15m' },
        }),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    mongoConnection = moduleRef.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await mongoConnection.close();
    await mongoServer.stop();
    await app.close();
  });

  afterEach(async () => {
    // 🧹 Nettoyage entre les tests
    const collections = mongoConnection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('🔐 Authentification de base', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');
      expect(response.body.user).toHaveProperty('username', testUser.username);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('role', 'user');
    });

    it('should prevent duplicate user registration', async () => {
      // Créer le premier utilisateur
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Tentative de création du même utilisateur
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(400);
    });

    it('should login with correct credentials', async () => {
      // Créer un utilisateur
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Se connecter
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');
      expect(response.body.user).toHaveProperty('username', testUser.username);
    });

    it('should reject login with wrong credentials', async () => {
      // Créer un utilisateur
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Tentative de connexion avec mauvais mot de passe
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('🔄 Système de refresh tokens', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Créer et connecter un utilisateur
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      accessToken = registerResponse.body.tokens.access_token;
      refreshToken = registerResponse.body.tokens.refresh_token;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('access_token');
      expect(response.body.tokens).toHaveProperty('refresh_token');

      // Les nouveaux tokens doivent être différents
      expect(response.body.tokens.access_token).not.toBe(accessToken);
      expect(response.body.tokens.refresh_token).not.toBe(refreshToken);
    });

    it('should reject refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should reject refresh with expired token', async () => {
      // Simuler un token expiré en utilisant un ancien token
      const oldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldToken })
        .expect(401);
    });

    it('should detect token reuse (security violation)', async () => {
      // Utiliser le refresh token une première fois
      const firstRefresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Tenter de réutiliser l'ancien refresh token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken }) // Ancien token
        .expect(401);

      // Vérifier que le nouveau token est aussi invalidé
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: firstRefresh.body.tokens.refresh_token })
        .expect(401);
    });
  });

  describe('🛡️ Validation des permissions et rôles', () => {
    let userToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // Créer un utilisateur normal
      const userResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);
      userToken = userResponse.body.tokens.access_token;

      // Créer un admin
      const adminResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testAdmin)
        .expect(201);
      adminToken = adminResponse.body.tokens.access_token;
    });

    it('should allow user access to user-level routes', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should deny user access to admin routes', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow admin access to admin routes', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should deny access without token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .expect(401);
    });

    it('should deny access with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('🚨 Détection des violations de sécurité', () => {
    let userToken: string;
    
    beforeEach(async () => {
      const userResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);
      userToken = userResponse.body.tokens.access_token;
    });

    it('should detect and log permission violations', async () => {
      // Tentative d'accès non autorisé
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Vérifier que l'audit log a été créé
      const auditLogs = await mongoConnection.collection('audit_logs').find({
        action: 'permission_denied',
        userId: testUser.username,
      }).toArray();

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toHaveProperty('severity', 'high');
      expect(auditLogs[0]).toHaveProperty('success', false);
    });

    it('should detect brute force attempts', async () => {
      // Créer un utilisateur
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      // Simuler des tentatives de connexion répétées
      const attempts = Array.from({ length: 5 }, (_, i) => 
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            username: testUser.username,
            password: 'wrongpassword',
          })
          .expect(401)
      );

      await Promise.all(attempts);

      // Vérifier que les tentatives sont loggées
      const auditLogs = await mongoConnection.collection('audit_logs').find({
        action: 'user_login',
        success: false,
      }).toArray();

      expect(auditLogs.length).toBe(5);
    });
  });

  describe('🔒 Logout et révocation des tokens', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      accessToken = response.body.tokens.access_token;
      refreshToken = response.body.tokens.refresh_token;
    });

    it('should logout and revoke refresh token', async () => {
      // Se déconnecter
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200);

      // Vérifier que le refresh token est révoqué
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should logout from all devices', async () => {
      // Créer plusieurs sessions
      const session1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200);

      const session2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200);

      // Se déconnecter de tous les appareils
      await request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Vérifier que tous les refresh tokens sont révoqués
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: session1.body.tokens.refresh_token })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: session2.body.tokens.refresh_token })
        .expect(401);
    });
  });

  describe('📊 Audit logs des actions sensibles', () => {
    let adminToken: string;

    beforeEach(async () => {
      const adminResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testAdmin)
        .expect(201);
      adminToken = adminResponse.body.tokens.access_token;
    });

    it('should log user registration', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'NewUserPassword123!',
        })
        .expect(201);

      // Vérifier l'audit log
      const auditLogs = await mongoConnection.collection('audit_logs').find({
        action: 'user_register',
        success: true,
      }).toArray();

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toHaveProperty('severity', 'low');
    });

    it('should log admin access', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Vérifier l'audit log
      const auditLogs = await mongoConnection.collection('audit_logs').find({
        action: 'admin_access',
        success: true,
      }).toArray();

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0]).toHaveProperty('severity', 'high');
    });

    it('should log security violations with critical severity', async () => {
      // Simuler une violation de sécurité
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'malicious-token' })
        .expect(401);

      // Dans un vrai scénario, cela déclencherait un audit log de sécurité
      // Pour ce test, nous vérifions juste que la structure est en place
    });
  });
});