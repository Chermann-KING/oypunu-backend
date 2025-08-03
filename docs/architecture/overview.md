# Architecture Overview - O'Ypunu Backend

## 🏗️ Vue d'Ensemble

O'Ypunu est une plateforme de dictionnaire collaboratif spécialisée dans les langues africaines, construite avec NestJS et MongoDB. L'architecture suit un pattern modulaire avec une séparation claire des responsabilités.

## 📋 Architecture Générale

```
┌─────────────────────────────────────────┐
│              Frontend Apps              │
│     (Web Angular + Mobile React)       │
└─────────────────┬───────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────┐
│              API Gateway                │
│         (NestJS Controllers)           │
├─────────────────────────────────────────┤
│              Core Modules               │
├─────────────────────────────────────────┤
│              Services Layer             │
├─────────────────────────────────────────┤
│            Repository Pattern           │
├─────────────────────────────────────────┤
│              Database Layer             │
│            (MongoDB Atlas)              │
└─────────────────────────────────────────┘
```

## 🎯 Principes Architecturaux

### 1. **Modular Architecture**
- Chaque fonctionnalité métier est encapsulée dans son propre module
- Dépendances claires entre modules
- Réutilisabilité maximale

### 2. **Repository Pattern**
- Abstraction complète de la couche données
- Interfaces pour tous les repositories
- Facilite les tests unitaires et les changements d'implémentation

### 3. **Dependency Injection**
- Inversion de contrôle complète
- Testabilité optimale
- Couplage faible entre composants

### 4. **Security First**
- JWT avec rotation automatique
- Rate limiting sophistiqué
- Audit logging complet
- Validation stricte des entrées

## 📦 Modules Principaux

| Module | Responsabilité | Dépendances |
|--------|---------------|-------------|
| **auth** | Authentification, autorisation, sécurité | users, repositories |
| **dictionary** | Gestion des mots, traductions, catégories | languages, repositories |
| **users** | Gestion des utilisateurs et profils | auth, repositories |
| **communities** | Communautés, posts, interactions sociales | users, repositories |
| **messaging** | Messages privés, conversations | users, repositories |
| **translation** | Traduction intelligente, IA | dictionary, repositories |
| **recommendations** | Système de recommandations | users, dictionary, repositories |
| **analytics** | Métriques, statistiques, tableaux de bord | all modules, repositories |

## 🔧 Stack Technique

### Backend Core
- **Framework**: NestJS 10.x (TypeScript)
- **Base de données**: MongoDB Atlas
- **ODM**: Mongoose
- **Authentication**: JWT + Passport
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI

### Infrastructure
- **Déploiement**: Railway
- **Monitoring**: Sentry
- **Cache**: Redis (optionnel)
- **File Storage**: MongoDB GridFS
- **WebSockets**: Socket.io

### Sécurité
- **Rate Limiting**: Express Rate Limit
- **CORS**: Configuré pour production
- **Headers sécurisés**: Helmet
- **Validation**: class-validator + custom validators
- **Audit**: Logging complet des actions

## 🚀 Patterns Utilisés

### 1. **Repository Pattern**
```typescript
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(user: Partial<User>): Promise<User>;
  // ... autres méthodes
}
```

### 2. **DTO Pattern**
```typescript
export class CreateWordDto {
  @IsString()
  @Length(1, 100)
  word: string;
  
  @IsString()
  @IsOptional()
  definition?: string;
}
```

### 3. **Guard Pattern**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'contributor')
async adminAction() { ... }
```

## 📊 Flow de Données

### 1. **Requête Utilisateur**
```
Client → Controller → Service → Repository → Database
```

### 2. **Réponse**
```
Database → Repository → Service → DTO → Controller → Client
```

### 3. **WebSocket Events**
```
Client → Gateway → Service → Event Emitter → All Connected Clients
```

## 🔐 Sécurité

### Authentication Flow
```
1. Login → JWT + Refresh Token
2. Request → JWT Validation
3. Protected Resource → Role Check
4. Action → Audit Log
```

### Data Protection
- **Encryption**: Passwords avec bcrypt
- **Sanitization**: Toutes les entrées utilisateur
- **Validation**: Stricte à tous les niveaux
- **Rate Limiting**: Par IP et par utilisateur

## 📈 Performance

### Optimisations Database
- **Index MongoDB**: Optimisés pour les requêtes fréquentes
- **Aggregation**: Pipeline optimisés
- **Connection Pooling**: Configuration fine

### Caching Strategy
- **Application Level**: Services avec cache en mémoire
- **Database Level**: MongoDB cache
- **Response Caching**: Pour les données statiques

## 🧪 Testing Strategy

### Niveaux de Tests
1. **Unit Tests**: Services isolés avec mocks
2. **Integration Tests**: Modules complets
3. **E2E Tests**: Parcours utilisateur complets

### Coverage
- **Target**: 80% minimum
- **Critical Paths**: 95% minimum
- **Security Features**: 100%

## 📚 Documentation

### Levels
1. **API Documentation**: Swagger automatique
2. **Code Documentation**: JSDoc complet
3. **Architecture**: Diagrammes et flows
4. **Deployment**: Guides détaillés

---

**Dernière mise à jour**: 30 Juillet 2025  
**Version**: 1.0.0  
**Auteur**: Équipe O'Ypunu