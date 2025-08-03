# Guide de Développement - O'Ypunu Backend

## 🚀 Guide du Développeur

Ce guide complet vous accompagne dans le développement sur la plateforme O'Ypunu Backend, des premiers pas aux pratiques avancées.

## 📋 Prérequis Développeur

### Environnement de Développement

```bash
# Versions recommandées
Node.js >= 18.17.0 (LTS)
npm >= 9.6.7
MongoDB >= 6.0
Redis >= 7.0
Git >= 2.40.0

# Outils recommandés
VS Code + Extensions O'Ypunu Pack
Docker Desktop (pour MongoDB local)
Postman (pour tests API)
MongoDB Compass (interface graphique DB)
```

### Extensions VS Code Recommandées

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-docker",
    "mongodb.mongodb-vscode"
  ]
}
```

## 🛠️ Configuration de l'Environnement

### 1. Clone et Installation

```bash
# Cloner le repository
git clone https://github.com/Chermann-KING/oypunu-backend.git
cd oypunu-backend

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env.development

# Générer les clés de développement
npm run generate:dev-keys
```

### 2. Configuration Base de Données

#### MongoDB avec Docker

```bash
# Démarrer MongoDB avec Docker
docker run -d \
  --name oypunu-mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -e MONGO_INITDB_DATABASE=oypunu_dev \
  -v oypunu_mongodb_data:/data/db \
  mongo:6.0

# Ou utiliser docker-compose
docker-compose up -d mongodb
```

#### Configuration .env.development

```bash
# Database
MONGODB_URI=mongodb://admin:password@localhost:27017/oypunu_dev?authSource=admin

# JWT Secrets (générés automatiquement)
JWT_SECRET=dev_jwt_secret_minimum_256_bits_long_for_security
JWT_REFRESH_SECRET=dev_refresh_secret_different_from_jwt_secret

# Redis (optionnel pour développement)
REDIS_URL=redis://localhost:6379

# Email (utilisé pour tests)
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_USER=test@oypunu.com
MAIL_PASS=test

# Mode développement
NODE_ENV=development
DEBUG=oypunu:*
LOG_LEVEL=debug
```

### 3. Initialisation des Données

```bash
# Créer les indexes et collections
npm run db:setup

# Seeder avec données de test
npm run db:seed

# Créer un utilisateur admin de développement
npm run create:dev-admin
```

## 🏗️ Architecture de Développement

### Structure du Projet

```
src/
├── main.ts                     # Point d'entrée de l'application
├── app.module.ts              # Module principal
├── app.controller.ts          # Contrôleur racine
├── common/                    # Utilities partagées
│   ├── decorators/           # Décorateurs personnalisés
│   ├── filters/              # Filtres d'exception
│   ├── guards/               # Guards d'authentification
│   ├── interceptors/         # Interceptors
│   ├── pipes/                # Pipes de validation
│   └── utils/                # Utilitaires
├── config/                   # Configuration de l'application
├── modules/                  # Modules métier
│   ├── auth/                # Authentification
│   ├── users/               # Gestion utilisateurs
│   ├── dictionary/          # Dictionnaire des mots
│   ├── communities/         # Communautés
│   ├── messaging/           # Messagerie temps réel
│   └── analytics/           # Analytics et métriques
├── database/                # Configuration et migrations DB
│   ├── migrations/          # Scripts de migration
│   └── seeders/            # Scripts de peuplement
└── scripts/                # Scripts utilitaires
```

### Module Type (Template)

```typescript
// example.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExampleController } from "./controllers/example.controller";
import { ExampleService } from "./services/example.service";
import { Example, ExampleSchema } from "./schemas/example.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Example.name, schema: ExampleSchema }]),
  ],
  controllers: [ExampleController],
  providers: [ExampleService],
  exports: [ExampleService],
})
export class ExampleModule {}
```

## 📝 Standards de Code

### 1. Conventions de Nommage

```typescript
// Variables et fonctions: camelCase
const userName = "john_doe";
const getUserProfile = () => {
  /* ... */
};

// Classes: PascalCase
class UserService {}
class DatabaseException {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 10;

// Interfaces: PascalCase avec préfixe I (optionnel)
interface UserRepository {}
interface IEmailService {}

// Enums: PascalCase
enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

// Fichiers: kebab-case
user - profile.service.ts;
email - notification.controller.ts;
```

### 2. Structure des Classes

````typescript
/**
 * @fileoverview Service de gestion des utilisateurs
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

/**
 * Service principal de gestion des utilisateurs
 *
 * Gère les opérations CRUD, l'authentification et la validation
 * des données utilisateur selon les standards de sécurité.
 *
 * @class UserService
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  /**
   * Constructeur du service utilisateur
   * @param {Model<User>} userModel - Modèle Mongoose des utilisateurs
   */
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  /**
   * Crée un nouvel utilisateur avec validation complète
   *
   * @async
   * @param {CreateUserDto} createUserDto - Données de création
   * @returns {Promise<User>} L'utilisateur créé
   * @throws {BadRequestException} Si les données sont invalides
   * @throws {ConflictException} Si l'email existe déjà
   *
   * @example
   * ```typescript
   * const user = await userService.create({
   *   email: 'user@example.com',
   *   username: 'newuser',
   *   password: 'securePassword123!'
   * });
   * ```
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      this.logger.log(`Creating new user: ${createUserDto.email}`);

      // Implémentation...

      this.logger.log(`User created successfully: ${user._id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Autres méthodes...
}
````

### 3. Gestion des Erreurs

```typescript
// exceptions/business.exception.ts
export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    errorCode?: string
  ) {
    super(
      {
        message,
        errorCode,
        timestamp: new Date().toISOString(),
        statusCode
      },
      statusCode
    );
  }
}

// Utilisation dans les services
async createWord(wordData: CreateWordDto): Promise<Word> {
  // Validation métier
  if (await this.isDuplicateWord(wordData.word, wordData.languageId)) {
    throw new BusinessException(
      'Ce mot existe déjà dans cette langue',
      HttpStatus.CONFLICT,
      'DUPLICATE_WORD'
    );
  }

  // Logique de création...
}
```

## 🧪 Tests et Qualité

### 1. Tests Unitaires

```typescript
// user.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserService } from "./user.service";
import { User } from "../schemas/user.schema";

describe("UserService", () => {
  let service: UserService;
  let model: Model<User>;

  // Mock du modèle Mongoose
  const mockUserModel = {
    new: jest.fn().mockResolvedValue(mockUser),
    constructor: jest.fn().mockResolvedValue(mockUser),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockUser = {
    _id: "507f1f77bcf86cd799439011",
    email: "test@example.com",
    username: "testuser",
    role: "user",
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    model = module.get<Model<User>>(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new user successfully", async () => {
      const createUserDto = {
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      };

      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockUser);
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createUserDto.email,
          username: createUserDto.username,
        })
      );
    });

    it("should throw ConflictException when email already exists", async () => {
      const createUserDto = {
        email: "existing@example.com",
        username: "testuser",
        password: "password123",
      };

      mockUserModel.create.mockRejectedValue(
        new Error("E11000 duplicate key error")
      );

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe("findByEmail", () => {
    it("should return user when found", async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        email: "test@example.com",
      });
    });

    it("should return null when user not found", async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.findByEmail("notfound@example.com");

      expect(result).toBeNull();
    });
  });
});
```

### 2. Tests d'Intégration

```typescript
// user.integration.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("UserController (Integration)", () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    // Démarrer MongoDB en mémoire
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, MongooseModule.forRoot(uri)],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe("/users (POST)", () => {
    it("should create a new user", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({
          email: "test@example.com",
          username: "testuser",
          password: "password123",
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty("_id");
          expect(res.body.email).toBe("test@example.com");
          expect(res.body).not.toHaveProperty("password");
        });
    });

    it("should return 400 for invalid email", () => {
      return request(app.getHttpServer())
        .post("/users")
        .send({
          email: "invalid-email",
          username: "testuser",
          password: "password123",
        })
        .expect(400);
    });
  });
});
```

### 3. Scripts de Test

```bash
# package.json scripts de test
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:unit": "jest --testPathPattern=src/.*\\.spec\\.ts$",
    "test:integration": "jest --testPathPattern=test/.*\\.spec\\.ts$"
  }
}
```

## 🔧 Outils de Développement

### 1. Scripts Utilitaires

```bash
# scripts/dev-utils.sh

# Réinitialiser la base de données de développement
reset-dev-db() {
  echo "🗄️  Réinitialisation de la base de données de développement..."
  npm run db:drop
  npm run db:setup
  npm run db:seed
  echo "✅ Base de données réinitialisée avec succès"
}

# Générer un nouveau module complet
generate-module() {
  local module_name=$1
  if [ -z "$module_name" ]; then
    echo "❌ Usage: generate-module <nom-du-module>"
    return 1
  fi

  echo "🏗️  Génération du module $module_name..."
  npx nest generate module $module_name
  npx nest generate controller $module_name
  npx nest generate service $module_name

  # Créer les dossiers et fichiers de base
  mkdir -p "src/$module_name/dto"
  mkdir -p "src/$module_name/schemas"
  mkdir -p "src/$module_name/interfaces"

  echo "✅ Module $module_name généré avec succès"
}

# Vérifier la qualité du code
check-code-quality() {
  echo "🔍 Vérification de la qualité du code..."

  echo "  📝 Linting..."
  npm run lint

  echo "  🧪 Tests unitaires..."
  npm run test:unit

  echo "  🔧 Vérification TypeScript..."
  npm run build

  echo "  📊 Couverture de tests..."
  npm run test:coverage

  echo "✅ Vérification terminée"
}
```

### 2. Configuration ESLint/Prettier

```json
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    '@nestjs/eslint-config-nestjs',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/prefer-const': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'max-len': ['error', { code: 120 }],
    'complexity': ['error', 10],
    'max-depth': ['error', 4],
    'max-params': ['error', 4]
  },
};
```

```json
// .prettierrc
{
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 120,
  "endOfLine": "lf",
  "arrowParens": "avoid",
  "bracketSpacing": true,
  "insertPragma": false,
  "proseWrap": "preserve",
  "quoteProps": "as-needed",
  "requirePragma": false,
  "useTabs": false
}
```

## 🚀 Workflow de Développement

### 1. Cycle de Développement Typique

```bash
# 1. Créer une nouvelle branche pour la feature
git checkout -b feature/nouvelle-fonctionnalite

# 2. Développer avec rechargement automatique
npm run start:dev

# 3. Écrire les tests au fur et à mesure
npm run test:watch

# 4. Vérifier la qualité avant commit
npm run lint:fix
npm run test:unit
npm run build

# 5. Commit avec message conventionnel
git add .
git commit -m "feat(users): add email verification system

- Add email verification service
- Implement verification email templates
- Add verification status to user model
- Update registration flow with verification

Closes #123"

# 6. Push et créer PR
git push origin feature/nouvelle-fonctionnalite
```

### 2. Commits Conventionnels

```bash
# Format: type(scope): description
#
# Types:
# feat: nouvelle fonctionnalité
# fix: correction de bug
# docs: documentation
# style: formatage, points-virgules manquants, etc.
# refactor: refactoring du code
# test: ajout ou modification de tests
# chore: maintenance, mise à jour dépendances

# Exemples:
git commit -m "feat(auth): add refresh token rotation"
git commit -m "fix(words): resolve duplicate word creation bug"
git commit -m "docs(api): update authentication endpoints documentation"
git commit -m "refactor(database): optimize user queries performance"
git commit -m "test(communities): add integration tests for community creation"
```

### 3. Pull Request Template

```markdown
## 📋 Description

Décrivez clairement les changements apportés et leur objectif.

## 🔧 Type de changement

- [ ] 🐛 Bug fix (changement qui corrige un problème)
- [ ] ✨ Nouvelle fonctionnalité (changement qui ajoute une fonctionnalité)
- [ ] 💥 Breaking change (correction ou fonctionnalité qui cause un dysfonctionnement de fonctionnalités existantes)
- [ ] 📚 Documentation (changements de documentation uniquement)

## 🧪 Tests

- [ ] Les tests existants passent
- [ ] J'ai ajouté des tests qui prouvent que ma correction est efficace ou que ma fonctionnalité marche
- [ ] Les tests unitaires atteignent au moins 80% de couverture sur le nouveau code

## 📝 Checklist

- [ ] Mon code suit les conventions de style du projet
- [ ] J'ai effectué une auto-review de mon propre code
- [ ] J'ai commenté mon code, particulièrement dans les zones difficiles à comprendre
- [ ] J'ai fait les changements correspondants à la documentation
- [ ] Mes changements ne génèrent pas de nouveaux warnings
- [ ] J'ai vérifié que mon code n'introduit pas de vulnérabilités de sécurité

## 🔗 Issues liées

Fixes #(numéro de l'issue)

## 📸 Screenshots (si applicable)

Ajoutez des captures d'écran pour illustrer les changements visuels.

## 📋 Notes pour les reviewers

Ajoutez toute information utile pour faciliter la review.
```

## 🐛 Debug et Troubleshooting

### 1. Configuration Debug

```typescript
// Configuration de logging pour développement
import { Logger } from "@nestjs/common";

// Dans main.ts
if (process.env.NODE_ENV === "development") {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });
}

// Utilisation dans les services
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(userData: CreateUserDto): Promise<User> {
    this.logger.debug(`Creating user with email: ${userData.email}`);

    try {
      const user = await this.userModel.create(userData);
      this.logger.log(`User created successfully: ${user._id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

### 2. Outils de Debug

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "test"
      }
    }
  ]
}
```

### 3. Troubleshooting Courant

```bash
# Problème de connexion MongoDB
# Vérifier que MongoDB est démarré
docker ps | grep mongo
# Ou
brew services list | grep mongodb

# Problème de permissions de port
# Changer le port dans .env
PORT=3001

# Problème de modules manquants
rm -rf node_modules package-lock.json
npm install

# Problème de TypeScript
npm run build
# Ou pour rebuild complet
npm run build:clean

# Problème de tests
# Nettoyer le cache Jest
npm run test -- --clearCache

# Problème de base de données
# Réinitialiser complètement
npm run db:reset
```

## 📚 Ressources et Références

### Documentation Technique

- [NestJS Documentation](https://docs.nestjs.com/)
- [Mongoose Guide](https://mongoosejs.com/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Standards et Bonnes Pratiques

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Clean Code Principles](https://github.com/ryanmcdermott/clean-code-javascript)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### Outils de Développement

- [VS Code Extensions Pack](https://marketplace.visualstudio.com/items?itemName=oypunu.oypunu-dev-pack)
- [Postman Collection](../api/postman-collection.json)
- [MongoDB Compass](https://www.mongodb.com/products/compass)

---

**Version** : 1.0.0  
**Dernière mise à jour** : 30 Juillet 2025  
**Responsable** : Équipe Développement O'Ypunu

**Pour toute question ou support** :

- 📧 Email: dev@oypunu.com
- 💬 Slack: #dev-backend
- 📖 Wiki: [internal-wiki.oypunu.com](https://internal-wiki.oypunu.com)
