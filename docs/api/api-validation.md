# Validation et Tests API - O'Ypunu

## 🧪 Stratégie de Tests

Cette documentation décrit les approches de validation et de tests pour l'API O'Ypunu.

## 📋 Types de Tests

### 1. Tests Unitaires
Tests des fonctions individuelles et méthodes isolées.

```typescript
// Exemple: Test du service d'authentification
describe('AuthService', () => {
  it('should hash password correctly', async () => {
    const password = 'testPassword';
    const hashedPassword = await authService.hashPassword(password);
    
    expect(hashedPassword).toBeDefined();
    expect(hashedPassword).not.toBe(password);
    expect(await bcrypt.compare(password, hashedPassword)).toBe(true);
  });
  
  it('should generate valid JWT token', async () => {
    const user = { id: '1', email: 'test@example.com', role: 'user' };
    const token = await authService.generateToken(user);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.sub).toBe(user.id);
  });
});
```

### 2. Tests d'Intégration
Tests des interactions entre modules et services.

```typescript
// Exemple: Test d'intégration création de mot
describe('Word Creation Integration', () => {
  it('should create word with proper validation', async () => {
    const wordData = {
      word: 'test',
      language: 'fr',
      meanings: [{
        definition: 'Test definition',
        partOfSpeech: 'noun'
      }]
    };
    
    const result = await wordsService.create(wordData, mockUser);
    
    expect(result).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.createdBy).toBe(mockUser._id);
  });
});
```

### 3. Tests E2E (End-to-End)
Tests complets des parcours utilisateur via l'API REST.

```typescript
// Exemple: Test E2E complet d'inscription
describe('User Registration E2E', () => {
  it('should complete full registration flow', async () => {
    // 1. Register user
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        hasAcceptedTerms: true,
        hasAcceptedPrivacyPolicy: true
      })
      .expect(201);
    
    expect(registerResponse.body.access_token).toBeDefined();
    
    // 2. Verify email (simulate)
    const verifyResponse = await request(app)
      .get(`/auth/verify-email/${registerResponse.body.verification_token}`)
      .expect(200);
    
    // 3. Login with verified account
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!'
      })
      .expect(200);
    
    expect(loginResponse.body.user.isEmailVerified).toBe(true);
  });
});
```

## 🔧 Configuration des Tests

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/**/*.module.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 10000,
  verbose: true
};
```

### Setup de Test (`test/setup.ts`)

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  // Clean up
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
});

// Global test utilities
global.createMockUser = () => ({
  _id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  username: 'testuser',
  role: 'contributor',
  isEmailVerified: true
});

global.createMockWord = () => ({
  word: 'test',
  language: 'fr',
  meanings: [{
    definition: 'Test definition',
    partOfSpeech: 'noun'
  }],
  status: 'approved'
});
```

## 📊 Métriques de Couverture

### Objectifs de Couverture
- **Lignes de code** : ≥ 80%
- **Fonctions** : ≥ 85%
- **Branches** : ≥ 75%
- **Statements** : ≥ 80%

### Génération des Rapports

```bash
# Exécuter tous les tests avec couverture
npm run test:coverage

# Tests unitaires uniquement
npm run test:unit

# Tests d'intégration
npm run test:integration

# Tests E2E
npm run test:e2e

# Tests avec watch mode
npm run test:watch
```

## 🚀 Tests de Performance

### Tests de Charge avec Artillery

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm-up"
    - duration: 120
      arrivalRate: 50
      name: "Load test"
    - duration: 60
      arrivalRate: 100
      name: "Stress test"
  variables:
    auth_token: "your-jwt-token"

scenarios:
  - name: "API Load Test"
    weight: 100
    flow:
      - get:
          url: "/words"
          expect:
            - statusCode: 200
            - contentType: json
      - get:
          url: "/words/search?q=test"
          expect:
            - statusCode: 200
      - post:
          url: "/words"
          headers:
            Authorization: "Bearer {{ auth_token }}"
          json:
            word: "test{{ $randomString() }}"
            language: "fr"
            meanings:
              - definition: "Test definition"
                partOfSpeech: "noun"
          expect:
            - statusCode: 201
```

### Commandes de Test de Performance

```bash
# Test de charge basique
artillery run artillery-config.yml

# Test avec rapport détaillé
artillery run --output report.json artillery-config.yml
artillery report report.json

# Test de spike
artillery quick --duration 60s --rate 200 http://localhost:3000/words
```

## 📈 Monitoring en Continu

### GitHub Actions Workflow

```yaml
# .github/workflows/api-tests.yml
name: API Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:4.4
        ports:
          - 27017:27017
        options: >-
          --health-cmd mongo
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        MONGODB_URI: mongodb://localhost:27017/test
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        MONGODB_URI: mongodb://localhost:27017/test
    
    - name: Run E2E tests
      run: npm run test:e2e
      env:
        MONGODB_URI: mongodb://localhost:27017/test
    
    - name: Generate coverage report
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: api-tests
        name: oypunu-api
```

## 🧪 Tests de Validation de Schéma

### Validation OpenAPI avec Swagger

```typescript
// test/schema-validation.spec.ts
import swaggerJSDoc from 'swagger-jsdoc';
import { validateSchema } from 'swagger-parser';

describe('OpenAPI Schema Validation', () => {
  let swaggerSpec: any;

  beforeAll(() => {
    const options = {
      definition: {
        openapi: '3.0.3',
        info: {
          title: 'O\'Ypunu API',
          version: '1.0.0',
        },
      },
      apis: ['./src/**/*.controller.ts'],
    };
    
    swaggerSpec = swaggerJSDoc(options);
  });

  it('should have valid OpenAPI schema', async () => {
    await expect(validateSchema(swaggerSpec)).resolves.not.toThrow();
  });

  it('should have all required endpoints documented', () => {
    const paths = Object.keys(swaggerSpec.paths);
    
    // Vérifier que les endpoints critiques sont documentés
    expect(paths).toContain('/auth/login');
    expect(paths).toContain('/auth/register');
    expect(paths).toContain('/words');
    expect(paths).toContain('/users/profile');
  });

  it('should have security definitions', () => {
    expect(swaggerSpec.components.securitySchemes).toBeDefined();
    expect(swaggerSpec.components.securitySchemes.BearerAuth).toBeDefined();
  });
});
```

## 🔒 Tests de Sécurité

### Tests d'Authentification et Autorisation

```typescript
describe('Security Tests', () => {
  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      await request(app)
        .get('/users/profile')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-id' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }
      );

      await request(app)
        .get('/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Authorization', () => {
    it('should reject non-admin access to admin endpoints', async () => {
      const userToken = generateToken({ role: 'user' });

      await request(app)
        .get('/words/pending')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should allow admin access to admin endpoints', async () => {
      const adminToken = generateToken({ role: 'admin' });

      await request(app)
        .get('/words/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Input Validation', () => {
    it('should sanitize XSS attempts', async () => {
      const maliciousData = {
        word: '<script>alert("xss")</script>',
        language: 'fr',
        meanings: [{
          definition: '<img src=x onerror=alert("xss")>',
          partOfSpeech: 'noun'
        }]
      };

      const response = await request(app)
        .post('/words')
        .set('Authorization', `Bearer ${validToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.word).not.toContain('<script>');
      expect(response.body.meanings[0].definition).not.toContain('<img');
    });

    it('should prevent SQL injection attempts', async () => {
      await request(app)
        .get('/words/search')
        .query({ q: "'; DROP TABLE users; --" })
        .expect(200); // Should not crash the server

      // Verify database integrity
      const userCount = await User.countDocuments();
      expect(userCount).toBeGreaterThan(0);
    });
  });
});
```

## 📋 Checklist de Validation Pre-Deploy

### Tests Obligatoires
- [ ] Tous les tests unitaires passent (100%)
- [ ] Tests d'intégration passent (100%)
- [ ] Tests E2E critiques passent
- [ ] Couverture de code ≥ 80%
- [ ] Tests de sécurité passent
- [ ] Validation OpenAPI réussie
- [ ] Tests de performance acceptables

### Validation Manuelle
- [ ] Documentation Swagger accessible
- [ ] Collection Postman fonctionne
- [ ] Endpoints critiques testés manuellement
- [ ] Rate limiting fonctionnel
- [ ] Gestion d'erreurs appropriée
- [ ] Logs d'audit corrects

### Infrastructure
- [ ] Variables d'environnement configurées
- [ ] Base de données accessible
- [ ] Services externes disponibles
- [ ] Monitoring configuré
- [ ] Alertes en place

## 📊 Rapports de Tests

### Format de Reporting

```typescript
// Custom test reporter
export class DetailedTestReporter {
  onRunComplete(contexts: Set<Context>, results: AggregatedResult) {
    const report = {
      summary: {
        total: results.numTotalTests,
        passed: results.numPassedTests,
        failed: results.numFailedTests,
        coverage: results.coverageMap?.getCoverageSummary()
      },
      performance: {
        totalTime: results.runExecution?.runtime || 0,
        averageTestTime: results.runExecution?.runtime / results.numTotalTests
      },
      coverage: {
        lines: results.coverageMap?.getCoverageSummary().lines.pct,
        functions: results.coverageMap?.getCoverageSummary().functions.pct,
        branches: results.coverageMap?.getCoverageSummary().branches.pct
      }
    };

    // Envoyer rapport vers système de monitoring
    this.sendToMonitoring(report);
    
    // Générer rapport HTML
    this.generateHTMLReport(report);
  }
}
```

### Commandes d'Exécution

```bash
# Suite complète de tests
npm run test:all

# Tests avec rapport détaillé
npm run test:report

# Tests de régression
npm run test:regression

# Validation pre-commit
npm run validate

# Tests de smoke (post-deploy)  
npm run test:smoke
```

---

**Responsable** : Équipe QA O'Ypunu  
**Dernière mise à jour** : 30 Juillet 2025  
**Version** : 1.0.0