# Module Authentication - Documentation Technique

## 🔐 Vue d'Ensemble

Le module `Auth` gère l'ensemble du système d'authentification, d'autorisation et de sécurité de la plateforme O'Ypunu. Il implémente une architecture sécurisée avec JWT, refresh tokens, et audit logging complet.

## 📁 Structure du Module

```
src/auth/
├── controllers/
│   └── auth.controller.ts          # Endpoints authentification
├── decorators/
│   └── current-user.decorator.ts   # Décorateur utilisateur courant
├── dto/
│   ├── change-password.dto.ts      # DTO changement mot de passe
│   └── reset-password.dto.ts       # DTO réinitialisation
├── guards/
│   ├── jwt-auth.guard.ts           # Guard JWT obligatoire
│   ├── optional-jwt-auth.guard.ts  # Guard JWT optionnel
│   └── role.guard.ts               # Guard vérification rôles
├── interceptors/
│   └── audit.interceptor.ts        # Intercepteur audit logging
├── middleware/
│   └── permission-validation.middleware.ts # Validation permissions
├── schemas/
│   ├── audit-log.schema.ts         # Schéma logs d'audit
│   └── refresh-token.schema.ts     # Schéma refresh tokens
├── security/
│   ├── jwt-secret-validator.service.ts    # Validation secret JWT
│   ├── rate-limiter.service.ts           # Service rate limiting
│   ├── security-headers.middleware.ts     # Headers sécurisés
│   ├── security.module.ts               # Module sécurité
│   └── token-storage.service.ts         # Stockage tokens
├── services/
│   ├── audit.service.ts            # Service audit logging
│   ├── auth.service.ts             # Service authentification principal
│   ├── password-strength.service.ts # Validation force mots de passe
│   └── refresh-token.service.ts    # Gestion refresh tokens
├── strategies/
│   ├── facebook.strategy.ts        # Stratégie OAuth Facebook
│   ├── google.strategy.ts          # Stratégie OAuth Google
│   ├── jwt.strategy.ts             # Stratégie JWT
│   └── twitter.strategy.ts         # Stratégie OAuth Twitter
├── validators/
│   └── password.validator.ts       # Validateurs mots de passe
└── auth.module.ts                  # Configuration module
```

## 🎯 Responsabilités Principales

### 1. **Authentification**
- **Login/Logout**: Gestion des sessions utilisateur
- **Registration**: Création de nouveaux comptes
- **Password Management**: Changement et réinitialisation
- **OAuth Integration**: Connexion via réseaux sociaux

### 2. **Autorisation**
- **Role-Based Access Control**: Système de rôles (USER, CONTRIBUTOR, ADMIN, SUPERADMIN)
- **Permission Validation**: Vérification des permissions par endpoint
- **Resource Protection**: Contrôle d'accès aux ressources

### 3. **Sécurité**
- **JWT Management**: Génération et validation des tokens
- **Refresh Tokens**: Rotation automatique des tokens
- **Rate Limiting**: Protection contre les attaques
- **Audit Logging**: Traçabilité complète des actions

## 🔧 Flow d'Authentification

### 1. **Registration Flow**
```mermaid
sequenceDiagram
    Client->>+AuthController: POST /auth/register
    AuthController->>+AuthService: register(userData)
    AuthService->>+UserRepository: create(user)
    UserRepository->>+Database: INSERT user
    Database-->>-UserRepository: user created
    UserRepository-->>-AuthService: user entity
    AuthService->>+RefreshTokenService: generateTokens(user)
    RefreshTokenService-->>-AuthService: tokens
    AuthService-->>-AuthController: tokens + user
    AuthController-->>-Client: 201 Created + tokens
```

### 2. **Login Flow**
```mermaid
sequenceDiagram
    Client->>+AuthController: POST /auth/login
    AuthController->>+AuthService: login(credentials)
    AuthService->>+UserRepository: validateCredentials()
    UserRepository-->>-AuthService: user validated
    AuthService->>+RefreshTokenService: generateTokens(user)
    RefreshTokenService->>+AuditService: logLogin(user)
    RefreshTokenService-->>-AuthService: tokens
    AuthService-->>-AuthController: tokens + user
    AuthController-->>-Client: 200 OK + tokens
```

### 3. **Protected Resource Access**
```mermaid
sequenceDiagram
    Client->>+Controller: GET /protected-resource
    Controller->>+JwtAuthGuard: canActivate()
    JwtAuthGuard->>+JwtStrategy: validate(token)
    JwtStrategy->>+UserRepository: findById(userId)
    UserRepository-->>-JwtStrategy: user entity
    JwtStrategy-->>-JwtAuthGuard: user validated
    JwtAuthGuard->>+RoleGuard: canActivate(roles)
    RoleGuard-->>-Controller: access granted
    Controller->>+Service: businessLogic()
    Service-->>-Controller: result
    Controller-->>-Client: 200 OK + data
```

## 🛡️ Endpoints Sécurisés

### Authentication Endpoints

| Endpoint | Method | Description | Guards | Rate Limit |
|----------|--------|-------------|---------|------------|
| `/auth/register` | POST | Inscription utilisateur | None | 5/hour |
| `/auth/login` | POST | Connexion utilisateur | None | 10/hour |
| `/auth/logout` | POST | Déconnexion | JWT | None |
| `/auth/refresh` | POST | Renouvellement token | RefreshToken | 20/hour |
| `/auth/change-password` | POST | Changement mot de passe | JWT | 3/hour |
| `/auth/reset-password` | POST | Réinitialisation | None | 3/day |

### OAuth Endpoints

| Endpoint | Method | Description | Provider |
|----------|--------|-------------|----------|
| `/auth/google` | GET | Connexion Google | Google OAuth |
| `/auth/facebook` | GET | Connexion Facebook | Facebook OAuth |
| `/auth/twitter` | GET | Connexion Twitter | Twitter OAuth |

## 📊 Schémas de Données

### AuditLog Schema
```typescript
interface AuditLog {
  _id: ObjectId;
  userId: ObjectId;           // Utilisateur concerné
  action: string;             // Action effectuée
  resource: string;           // Ressource concernée
  resourceId?: ObjectId;      // ID de la ressource
  ipAddress: string;          // Adresse IP
  userAgent: string;          // User agent
  timestamp: Date;            // Horodatage
  success: boolean;           // Succès/échec
  errorMessage?: string;      // Message d'erreur si échec
  metadata?: object;          // Métadonnées additionnelles
}
```

### RefreshToken Schema
```typescript
interface RefreshToken {
  _id: ObjectId;
  userId: ObjectId;           // Utilisateur propriétaire
  token: string;              // Token haché
  expiresAt: Date;           // Date d'expiration
  isRevoked: boolean;        // Token révoqué
  deviceInfo?: object;       // Informations appareil
  createdAt: Date;           // Date de création
}
```

## 🔐 Configuration Sécurité

### JWT Configuration
```typescript
{
  secret: process.env.JWT_SECRET,        // Secret sécurisé
  expiresIn: '15m',                      // Expiration courte
  algorithm: 'HS256',                    // Algorithme sécurisé
  issuer: 'oypunu-backend',             // Émetteur
  audience: 'oypunu-client'             // Audience
}
```

### Rate Limiting
```typescript
{
  windowMs: 15 * 60 * 1000,             // 15 minutes
  max: 100,                             // 100 requêtes max
  standardHeaders: true,                 // Headers standards
  legacyHeaders: false,                 // Pas de headers legacy
  skipSuccessfulRequests: false,        // Compter toutes les requêtes
  skipFailedRequests: false             // Compter les échecs
}
```

## 🧪 Services Principaux

### AuthService
**Responsabilités:**
- Authentification utilisateur
- Génération des tokens JWT
- Validation des credentials
- Gestion des sessions

**Méthodes principales:**
```typescript
async register(userData: RegisterDto): Promise<AuthResult>
async login(credentials: LoginDto): Promise<AuthResult>
async validateUser(payload: JwtPayload): Promise<User>
async changePassword(userId: string, passwords: ChangePasswordDto): Promise<void>
```

### RefreshTokenService
**Responsabilités:**
- Gestion du cycle de vie des refresh tokens
- Rotation automatique des tokens
- Révocation de tokens

**Méthodes principales:**
```typescript
async generateTokens(user: User): Promise<TokenPair>
async refreshTokens(refreshToken: string): Promise<TokenPair>
async revokeToken(tokenId: string): Promise<void>
async cleanupExpiredTokens(): Promise<number>
```

### AuditService
**Responsabilités:**
- Logging de toutes les actions sensibles
- Traçabilité complète des opérations
- Détection d'activités suspectes

**Méthodes principales:**
```typescript
async logAction(auditData: AuditLogData): Promise<void>
async getUserActivity(userId: string): Promise<AuditLog[]>
async getSuspiciousActivity(): Promise<AuditLog[]>
async generateSecurityReport(): Promise<SecurityReport>
```

## 🎭 Guards et Middleware

### JwtAuthGuard
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Validation JWT + extraction utilisateur
  }
  
  handleRequest(err: any, user: any): any {
    // Gestion des erreurs d'authentification
  }
}
```

### RoleGuard
```typescript
@Injectable()
export class RoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Vérification des rôles requis
  }
}
```

## 🔍 Audit et Monitoring

### Actions Auditées
- **Authentication**: Login, logout, registration
- **Authorization**: Changements de rôles, permissions
- **Password**: Changements, réinitialisations
- **Security**: Tentatives d'accès non autorisé
- **Admin**: Actions administratives sensibles

### Métriques de Sécurité
```typescript
interface SecurityMetrics {
  loginAttempts: number;          // Tentatives de connexion
  failedLogins: number;           // Échecs de connexion
  suspiciousActivity: number;     // Activités suspectes
  passwordChanges: number;        // Changements de mots de passe
  tokenRotations: number;         // Rotations de tokens
}
```

## 🚨 Gestion des Erreurs

### Types d'Erreurs Sécurisées
```typescript
class AuthenticationError extends HttpException {
  constructor(message: string = 'Authentication failed') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

class AuthorizationError extends HttpException {
  constructor(message: string = 'Access denied') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

class RateLimitError extends HttpException {
  constructor(message: string = 'Too many requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
```

## 📋 Tests

### Test Coverage
- **Unit Tests**: 95% coverage
- **Integration Tests**: Flows complets
- **Security Tests**: Tentatives d'intrusion
- **Performance Tests**: Charge authentification

### Scénarios de Tests
```typescript
describe('AuthService', () => {
  it('should authenticate valid user');
  it('should reject invalid credentials');
  it('should handle rate limiting');
  it('should rotate refresh tokens');
  it('should audit all actions');
});
```

---

**Version**: 1.0.0  
**Dernière mise à jour**: 30 Juillet 2025  
**Responsable**: Équipe Sécurité O'Ypunu