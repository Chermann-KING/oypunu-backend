# Module Repositories - Documentation Technique

## 🏗️ Vue d'Ensemble

Le module `Repositories` implémente le pattern Repository pour l'ensemble de l'application O'Ypunu. Il fournit une couche d'abstraction complète entre la logique métier et la persistance des données, facilitant la testabilité, la maintenabilité et l'évolutivité du système.

## 📁 Structure du Module

```
src/repositories/
├── implementations/                     # Implémentations concrètes
│   ├── activity-feed.repository.ts     # Repository flux activité
│   ├── audit-log.repository.ts         # Repository logs audit
│   ├── category.repository.ts          # Repository catégories
│   ├── community.repository.ts         # Repository communautés
│   ├── community-member.repository.ts  # Repository membres
│   ├── community-post.repository.ts    # Repository posts
│   ├── competition.repository.ts       # Repository compétitions
│   ├── contributor-request.repository.ts # Repository demandes
│   ├── conversation.repository.ts      # Repository conversations
│   ├── favorite-word.repository.ts     # Repository favoris
│   ├── language.repository.ts          # Repository langues
│   ├── like.repository.ts              # Repository likes
│   ├── message.repository.ts           # Repository messages
│   ├── post-comment.repository.ts      # Repository commentaires
│   ├── recommendation-cache.repository.ts # Repository cache reco
│   ├── refresh-token.repository.ts     # Repository tokens
│   ├── revision-history.repository.ts  # Repository révisions
│   ├── training-data.repository.ts     # Repository données IA
│   ├── translation-group.repository.ts # Repository groupes trad
│   ├── user.repository.ts              # Repository utilisateurs
│   ├── user-recommendation-profile.repository.ts # Repository profils
│   ├── vote.repository.ts              # Repository votes
│   ├── word.repository.ts              # Repository mots
│   ├── word-notification.repository.ts # Repository notifications
│   ├── word-view.repository.ts         # Repository vues mots
│   └── word-vote.repository.ts         # Repository votes mots
├── interfaces/                         # Interfaces abstraites
│   ├── activity-feed.repository.interface.ts
│   ├── audit-log.repository.interface.ts
│   ├── category.repository.interface.ts
│   ├── community.repository.interface.ts
│   ├── community-member.repository.interface.ts
│   ├── community-post.repository.interface.ts
│   ├── competition.repository.interface.ts
│   ├── contributor-request.repository.interface.ts
│   ├── conversation.repository.interface.ts
│   ├── favorite-word.repository.interface.ts
│   ├── language.repository.interface.ts
│   ├── like.repository.interface.ts
│   ├── message.repository.interface.ts
│   ├── post-comment.repository.interface.ts
│   ├── recommendation-cache.repository.interface.ts
│   ├── refresh-token.repository.interface.ts
│   ├── revision-history.repository.interface.ts
│   ├── training-data.repository.interface.ts
│   ├── translation-group.repository.interface.ts
│   ├── user.repository.interface.ts
│   ├── user-recommendation-profile.repository.interface.ts
│   ├── vote.repository.interface.ts
│   ├── word.repository.interface.ts
│   ├── word-notification.repository.interface.ts
│   ├── word-view.repository.interface.ts
│   └── word-vote.repository.interface.ts
├── tests/
│   └── repository-pattern.spec.ts      # Tests pattern repository
├── index.ts                            # Exports centralisés
└── repositories.module.ts              # Configuration DI
```

## 🎯 Philosophie du Pattern Repository

### 1. **Abstraction Complète**
- **Interfaces Pures**: Aucune dépendance vers MongoDB
- **Contrats Clairs**: Signatures explicites pour chaque opération
- **Testabilité**: Mocking facilité par les interfaces

### 2. **Single Responsibility**
- **Un Repository = Une Entité**: Responsabilité unique
- **Opérations Cohérentes**: Méthodes liées à l'entité
- **Séparation des Préoccupations**: Business logic séparée de la persistance

### 3. **Consistency**
- **Conventions Uniformes**: Même structure pour tous les repositories
- **Error Handling**: Gestion d'erreurs centralisée
- **Performance**: Optimisations systématiques

## 🏛️ Architecture du Pattern

### Interface Repository Type
```typescript
interface IBaseRepository<T> {
  // CRUD de base
  create(entity: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, updates: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  
  // Recherche
  findMany(criteria: any, options?: QueryOptions): Promise<T[]>;
  findOne(criteria: any): Promise<T | null>;
  count(criteria?: any): Promise<number>;
  
  // Opérations spécialisées (selon l'entité)
  // ...méthodes spécifiques
}
```

### Implémentation Concrète
```typescript
@Injectable()
export class EntityRepository implements IEntityRepository {
  constructor(
    @InjectModel(Entity.name)
    private entityModel: Model<EntityDocument>
  ) {}

  async create(entity: Partial<Entity>): Promise<Entity> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        const created = new this.entityModel(entity);
        return await created.save();
      },
      'Entity',
      'create'
    );
  }
  
  // ... autres implémentations
}
```

## 🎪 Dependency Injection Setup

### Configuration Module
```typescript
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Word.name, schema: WordSchema },
      // ... tous les schémas
    ]),
  ],
  providers: [
    // Liaison interface -> implémentation
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
    {
      provide: 'IWordRepository', 
      useClass: WordRepository,
    },
    // ... tous les repositories
  ],
  exports: [
    'IUserRepository',
    'IWordRepository',
    // ... toutes les interfaces
  ],
})
export class RepositoriesModule {}
```

### Injection dans Services
```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
  ) {}
  
  async createUser(userData: CreateUserDto): Promise<User> {
    return await this.userRepository.create(userData);
  }
}
```

## 📊 Repositories Détaillés

### UserRepository
**Interface:**
```typescript
interface IUserRepository {
  create(user: Partial<User>): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  updateProfile(id: string, profile: Partial<UserProfile>): Promise<User | null>;
  updatePassword(id: string, hashedPassword: string): Promise<User | null>;
  findContributors(options?: PaginationOptions): Promise<User[]>;
  updateRole(id: string, role: UserRole): Promise<User | null>;
  deactivate(id: string): Promise<boolean>;
  count(criteria?: any): Promise<number>;
}
```

**Opérations Spécialisées:**
- Recherche par email/username unique
- Gestion des rôles et permissions
- Profils utilisateur étendus
- Statistiques d'engagement

### WordRepository
**Interface:**
```typescript
interface IWordRepository {
  create(word: Partial<Word>): Promise<Word>;
  findById(id: string): Promise<Word | null>;
  findByWord(word: string, language: string): Promise<Word | null>;
  search(criteria: SearchCriteria): Promise<PaginatedResult<Word>>;
  findByCategory(categoryId: string, options?: PaginationOptions): Promise<Word[]>;
  findByLanguage(language: string, options?: PaginationOptions): Promise<Word[]>;
  addTranslation(wordId: string, translation: WordTranslation): Promise<Word | null>;
  updateTranslation(wordId: string, translationId: string, updates: Partial<WordTranslation>): Promise<Word | null>;
  updateStatus(id: string, status: WordStatus): Promise<Word | null>;
  incrementViewCount(id: string): Promise<Word | null>;
  findSimilar(word: string, language: string, threshold?: number): Promise<Word[]>;
  count(criteria?: any): Promise<number>;
}
```

**Optimisations Spécifiques:**
- Index MongoDB pour recherche textuelle
- Recherche de similarité optimisée
- Aggregation pour statistiques
- Cache pour requêtes fréquentes

### AuditLogRepository
**Interface:**
```typescript
interface IAuditLogRepository {
  create(auditLog: Partial<AuditLog>): Promise<AuditLog>;
  findByUserId(userId: string, options?: PaginationOptions): Promise<AuditLog[]>;
  findByAction(action: string, options?: DateRangeOptions): Promise<AuditLog[]>;
  findSuspiciousActivity(userId: string): Promise<AuditLog[]>;
  deleteOldLogs(olderThanDays: number): Promise<number>;
  countByUser(userId: string): Promise<number>;
  findByIpAddress(ipAddress: string): Promise<AuditLog[]>;
}
```

**Fonctionnalités Sécurité:**
- Détection d'activités suspectes
- Nettoyage automatique des logs anciens
- Recherche par IP et actions sensibles
- Métriques de sécurité

## 🔧 Database Error Handling

### Gestionnaire Centralisé
```typescript
export class DatabaseErrorHandler {
  static async handleCreateOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    operationType: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logError(error, entityName, operationType);
      
      if (error.code === 11000) {
        throw new ConflictException(`${entityName} already exists`);
      }
      
      if (error.name === 'ValidationError') {
        throw new BadRequestException(this.formatValidationError(error));
      }
      
      throw new InternalServerErrorException(
        `Database operation failed for ${entityName}`
      );
    }
  }
  
  static async handleFindOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    identifier: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.logError(error, entityName, `find-${identifier}`);
      throw new InternalServerErrorException(
        `Failed to retrieve ${entityName}`
      );
    }
  }
  
  static async handleUpdateOperation<T>(
    operation: () => Promise<T>,
    entityName: string,
    identifier: string
  ): Promise<T> {
    try {
      const result = await operation();
      if (!result) {
        throw new NotFoundException(`${entityName} not found`);
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      this.logError(error, entityName, `update-${identifier}`);
      throw new InternalServerErrorException(
        `Failed to update ${entityName}`
      );
    }
  }
  
  static async handleDeleteOperation(
    operation: () => Promise<any>,
    entityName: string,
    identifier: string
  ): Promise<boolean> {
    try {
      const result = await operation();
      return result !== null && result !== undefined;
    } catch (error) {
      this.logError(error, entityName, `delete-${identifier}`);
      throw new InternalServerErrorException(
        `Failed to delete ${entityName}`
      );
    }
  }
}
```

## 🚀 Optimisations Performance

### Query Options Standard
```typescript
interface QueryOptions {
  sort?: { [key: string]: 1 | -1 };
  limit?: number;
  skip?: number;
  populate?: string | string[];
  select?: string;
  lean?: boolean;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

### Index MongoDB Optimisés
```typescript
// Exemple d'optimisations dans WordRepository
WordSchema.index({ word: 1, language: 1 }, { unique: true });
WordSchema.index({ language: 1, createdAt: -1 });
WordSchema.index({ category: 1, status: 1 });
WordSchema.index({ createdBy: 1, createdAt: -1 });
WordSchema.index({ 
  word: 'text', 
  definition: 'text', 
  'translations.translation': 'text' 
});
```

### Connection Pooling
```typescript
// Configuration MongoDB optimisée
{
  maxPoolSize: 10,           // Maximum 10 connexions
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,       // Disable mongoose buffering
  bufferCommands: false,
  useNewUrlParser: true,
  useUnifiedTopology: true
}
```

## 🧪 Testing Strategy

### Unit Tests pour Repositories
```typescript
describe('UserRepository', () => {
  let repository: UserRepository;
  let model: jest.Mocked<Model<UserDocument>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
    model = module.get(getModelToken(User.name));
  });

  it('should create user successfully', async () => {
    const userData = { email: 'test@example.com', username: 'test' };
    const savedUser = { ...userData, _id: 'user-id' };
    
    model.create.mockResolvedValue(savedUser as any);
    
    const result = await repository.create(userData);
    
    expect(result).toEqual(savedUser);
    expect(model.create).toHaveBeenCalledWith(userData);
  });
  
  it('should handle duplicate email error', async () => {
    const userData = { email: 'existing@example.com' };
    const error = { code: 11000 };
    
    model.create.mockRejectedValue(error);
    
    await expect(repository.create(userData))
      .rejects.toThrow(ConflictException);
  });
});
```

### Integration Tests
```typescript
describe('Repository Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        RepositoriesModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should perform full CRUD cycle', async () => {
    const userRepository = app.get<IUserRepository>('IUserRepository');
    
    // Create
    const user = await userRepository.create({
      email: 'integration@test.com',
      username: 'integration'
    });
    
    // Read
    const foundUser = await userRepository.findById(user._id);
    expect(foundUser).toBeDefined();
    
    // Update
    const updatedUser = await userRepository.updateProfile(user._id, {
      bio: 'Updated bio'
    });
    expect(updatedUser.bio).toBe('Updated bio');
    
    // Delete
    const deleted = await userRepository.delete(user._id);
    expect(deleted).toBe(true);
  });
});
```

## 📈 Monitoring et Métriques

### Repository Performance Metrics
```typescript
interface RepositoryMetrics {
  operationCounts: {
    create: number;
    read: number;
    update: number;
    delete: number;
  };
  averageResponseTimes: {
    create: number;
    read: number;
    update: number;
    delete: number;
  };
  errorRates: {
    total: number;
    byOperation: { [key: string]: number };
  };
  cacheHitRates?: {
    hits: number;
    misses: number;
    ratio: number;
  };
}
```

### Health Checks
```typescript
@Injectable()
export class RepositoryHealthService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
  ) {}
  
  async checkRepositoryHealth(): Promise<HealthStatus> {
    try {
      // Test basic operations
      await this.userRepository.count();
      return { status: 'healthy', details: 'All repositories operational' };
    } catch (error) {
      return { status: 'unhealthy', details: error.message };
    }
  }
}
```

## 🔒 Sécurité

### Validation des Entrées
```typescript
// Tous les repositories valident les entrées
async create(entity: Partial<Entity>): Promise<Entity> {
  // Sanitization
  const sanitized = this.sanitizeInput(entity);
  
  // Validation
  const validation = await this.validateEntity(sanitized);
  if (!validation.isValid) {
    throw new BadRequestException(validation.errors);
  }
  
  return DatabaseErrorHandler.handleCreateOperation(
    async () => {
      const created = new this.entityModel(sanitized);
      return await created.save();
    },
    'Entity',
    'create'
  );
}
```

### Audit Trail
```typescript
// Logging automatique des opérations sensibles
async update(id: string, updates: Partial<Entity>): Promise<Entity | null> {
  const result = await DatabaseErrorHandler.handleUpdateOperation(
    async () => {
      return await this.entityModel.findByIdAndUpdate(id, updates, { new: true });
    },
    'Entity',
    id
  );
  
  // Log de l'opération
  await this.auditService.logOperation({
    entityType: 'Entity',
    entityId: id,
    operation: 'update',
    changes: updates,
    timestamp: new Date()
  });
  
  return result;
}
```

---

**Version**: 1.0.0  
**Dernière mise à jour**: 30 Juillet 2025  
**Responsable**: Équipe Architecture O'Ypunu