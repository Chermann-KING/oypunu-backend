# 🌍 O'Ypunu Backend - API Enterprise-Grade

[![NestJS](https://img.shields.io/badge/NestJS-10.x-ea2845.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47A248.svg)](https://www.mongodb.com/)
[![Railway](https://img.shields.io/badge/Deployed%20on-Railway-purple.svg)](https://railway.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **API backend professionnel pour O'Ypunu** - Plateforme collaborative de dictionnaire multilingue spécialisée dans les langues africaines. Architecture robuste, sécurisée et scalable construite avec NestJS et MongoDB.

## 📋 Table des Matières

- [🎯 Vue d'Ensemble](#-vue-densemble)
- [🏗️ Architecture](#️-architecture)
- [🚀 Installation Rapide](#-installation-rapide)
- [📚 Documentation](#-documentation)
- [🔧 Configuration](#-configuration)
- [🛠️ Développement](#️-développement)
- [🚀 Déploiement](#-déploiement)
- [🧪 Tests](#-tests)
- [🤝 Contribution](#-contribution)

## 🎯 Vue d'Ensemble

### Mission
Démocratiser l'apprentissage des langues africaines en fournissant une API robuste et sécurisée pour une plateforme collaborative de dictionnaire multilingue.

### Fonctionnalités Principales

#### 🔐 **Authentification & Sécurité**
- JWT avec rotation automatique des refresh tokens
- OAuth social (Google, Facebook, Twitter)
- Système de rôles avancé (USER, CONTRIBUTOR, ADMIN, SUPERADMIN)
- Rate limiting intelligent et protection CSRF
- Audit logging complet

#### 📚 **Dictionnaire Collaboratif**
- CRUD complet avec workflow d'approbation
- Recherche avancée avec intelligence artificielle
- Upload et traitement des prononciations audio
- Système de révisions avec historique
- Traductions multiples et validation communautaire

#### 🌍 **Communautés & Social**
- Création et gestion de communautés linguistiques
- Posts, commentaires et système de votes
- Messagerie temps réel avec WebSockets
- Profils utilisateur enrichis
- Système de recommandations intelligent

#### ⚡ **Performance & Scalabilité**
- Architecture modulaire avec pattern Repository
- Optimisations MongoDB avec index stratégiques
- Cache intelligent et pagination avancée
- Monitoring et métriques en temps réel

## 🏗️ Architecture

### Stack Technologique

| Composant | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Framework** | NestJS | 10.x | Backend framework avec TypeScript |
| **Base de données** | MongoDB Atlas | 6.x | Base de données NoSQL cloud |
| **ODM** | Mongoose | 8.x | Object Document Mapping |
| **Authentification** | JWT + Passport | Latest | Sécurité et authentification |
| **WebSockets** | Socket.IO | 4.x | Communication temps réel |
| **Validation** | class-validator | Latest | Validation des données |
| **Documentation** | Swagger/OpenAPI | 3.0 | Documentation API automatique |
| **Deployment** | Railway | - | Plateforme de déploiement cloud |

### Architecture Modulaire

```
src/
├── 🔐 auth/                    # Authentification & sécurité
│   ├── controllers/           # Endpoints auth
│   ├── services/             # Logique métier auth
│   ├── guards/               # Protection des routes
│   ├── strategies/           # Stratégies OAuth
│   └── security/             # Services sécurité avancés
├── 📚 dictionary/             # Dictionnaire collaboratif
│   ├── controllers/          # API mots & catégories
│   ├── services/            # Services spécialisés
│   │   └── word-services/   # Services modulaires
│   ├── schemas/             # Modèles de données
│   └── middlewares/         # Sécurité audio
├── 👥 users/                  # Gestion utilisateurs
│   ├── controllers/         # Profils & préférences
│   ├── services/           # Logique utilisateur
│   └── schemas/            # Modèles utilisateur
├── 🌍 communities/           # Communautés & social
│   ├── controllers/        # API communautés
│   ├── services/          # Logique social
│   └── schemas/           # Modèles communautés
├── 💬 messaging/            # Messagerie temps réel
│   ├── controllers/       # API messages
│   ├── gateways/         # WebSocket Gateway
│   ├── services/         # Logique chat
│   └── schemas/          # Modèles messages
├── 🏗️ repositories/         # Pattern Repository
│   ├── interfaces/       # Contrats abstraits
│   ├── implementations/  # Implémentations concrètes
│   └── repositories.module.ts # Configuration DI
├── 🧠 translation/          # IA & traductions
│   ├── services/         # Algorithmes ML
│   └── schemas/          # Données d'entraînement
├── 📊 analytics/           # Métriques & statistiques
├── 🔧 admin/               # Administration
└── 🛠️ common/              # Services partagés
```

## 🚀 Installation Rapide

### Prérequis
- **Node.js** 18.x ou supérieur
- **npm** 9.x ou supérieur
- **MongoDB** (local ou Atlas)
- **Git** pour le versioning

### Installation en 3 minutes

```bash
# 1. Cloner le repository
git clone <repository-url>
cd oypunu-backend

# 2. Installer les dépendances
npm install

# 3. Configuration environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# 4. Démarrer en développement
npm run start:dev
```

✅ **API disponible sur**: `http://localhost:3000`  
📖 **Documentation Swagger**: `http://localhost:3000/api-docs`

## 📚 Documentation

### Documentation Technique Complète

| Document | Description | Lien |
|----------|-------------|------|
| **Setup Guide** | Installation et configuration | [📖 docs/guides/setup.md](docs/guides/setup.md) |
| **Architecture** | Vue d'ensemble technique | [🏗️ docs/architecture/overview.md](docs/architecture/overview.md) |
| **Auth Module** | Authentification & sécurité | [🔐 docs/modules/auth.md](docs/modules/auth.md) |
| **Dictionary Module** | Système de dictionnaire | [📚 docs/modules/dictionary.md](docs/modules/dictionary.md) |
| **Repository Pattern** | Architecture données | [🏗️ docs/modules/repositories.md](docs/modules/repositories.md) |
| **Troubleshooting** | Résolution problèmes | [🔧 docs/guides/troubleshooting.md](docs/guides/troubleshooting.md) |
| **API Documentation** | Swagger/OpenAPI specs | [🌐 docs/api/swagger.yaml](docs/api/swagger.yaml) |

### API Endpoints Principaux

```bash
# Health Check
GET /health                          # Statut application

# Authentification
POST /api/v1/auth/register          # Inscription
POST /api/v1/auth/login             # Connexion
POST /api/v1/auth/refresh           # Renouvellement token

# Dictionnaire
GET  /api/v1/words                  # Recherche mots
POST /api/v1/words                  # Créer mot
GET  /api/v1/words/:id              # Détails mot
POST /api/v1/words/:id/audio        # Upload audio

# Communautés
GET  /api/v1/communities            # Liste communautés
POST /api/v1/communities            # Créer communauté
GET  /api/v1/communities/:id/posts  # Posts communauté

# Administration
GET  /api/v1/admin/dashboard        # Métriques admin
GET  /api/v1/admin/words/pending    # Mots en attente
```

## 🔧 Configuration

### Variables d'Environnement Essentielles

```bash
# === CORE CONFIGURATION ===
NODE_ENV=development
PORT=3000
API_VERSION=v1

# === DATABASE ===
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/oypunu

# === JWT SECURITY ===
JWT_SECRET=your-256-bit-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret
REFRESH_TOKEN_EXPIRES_IN=7d

# === FRONTEND ===
FRONTEND_URL=http://localhost:4200
ALLOWED_ORIGINS=http://localhost:4200,http://localhost:3000

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100     # Max requests per window

# === FILE UPLOAD ===
MAX_FILE_SIZE=5242880           # 5MB max
ALLOWED_AUDIO_TYPES=audio/mpeg,audio/wav,audio/ogg

# === EXTERNAL SERVICES ===
SENDGRID_API_KEY=your-sendgrid-key
GOOGLE_CLIENT_ID=your-google-oauth-id
FACEBOOK_APP_ID=your-facebook-app-id

# === MONITORING ===
SENTRY_DSN=your-sentry-dsn-url
LOG_LEVEL=debug
```

### Génération des Secrets Sécurisés

```bash
# JWT Secret (256 bits)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Refresh Token Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🛠️ Développement

### Scripts de Développement

```bash
# Développement avec hot-reload
npm run start:dev

# Build production
npm run build

# Production
npm run start:prod

# Tests
npm run test              # Tests unitaires
npm run test:e2e         # Tests end-to-end
npm run test:cov         # Couverture de code

# Qualité code
npm run lint             # ESLint
npm run format           # Prettier

# Base de données
npm run migrate          # Migrations
npm run db:seed          # Données de test
```

### Standards de Développement

#### 📝 **JSDoc Standard**
```typescript
/**
 * @fileoverview Service de gestion des mots - CRUD complet avec validation
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

/**
 * Créer un nouveau mot dans le dictionnaire
 * @async
 * @function createWord
 * @param {CreateWordDto} wordData - Données du mot à créer
 * @param {string} userId - ID de l'utilisateur créateur
 * @returns {Promise<Word>} Le mot créé avec son ID
 * @throws {ValidationError} Si les données sont invalides
 * @throws {ConflictError} Si le mot existe déjà
 * @example
 * const word = await createWord({
 *   word: 'ubuntu',
 *   language: 'zu',
 *   definition: 'humanité envers les autres'
 * }, 'user-id');
 */
```

#### 🏗️ **Architecture Pattern**
- **Repository Pattern** pour l'abstraction des données
- **Dependency Injection** avec interfaces
- **Modular Architecture** par domaine métier
- **Error Handling** centralisé

#### 🧪 **Testing Strategy**
```typescript
describe('WordService', () => {
  it('should create word with valid data', async () => {
    // Arrange
    const wordData: CreateWordDto = { /* ... */ };
    
    // Act
    const result = await wordService.create(wordData, 'user-id');
    
    // Assert
    expect(result).toBeDefined();
    expect(result.word).toBe(wordData.word);
  });
});
```

## 🚀 Déploiement

### Railway (Production)

```bash
# Installation Railway CLI
npm install -g @railway/cli

# Déploiement
railway login
railway link
railway up

# Variables d'environnement
railway variables set NODE_ENV=production
railway variables set MONGODB_URI=your-production-uri
railway variables set JWT_SECRET=your-production-secret
```

### Docker (Optionnel)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Health Checks & Monitoring

```bash
# Health check endpoint
curl https://your-api-domain.com/health

# Expected response
{
  "status": "ok",
  "timestamp": "2025-07-30T12:00:00.000Z",
  "database": "connected",
  "uptime": "2d 5h 23m"
}
```

## 🧪 Tests

### Stratégie de Tests

| Type | Coverage | Outils | Objectif |
|------|----------|--------|----------|
| **Unit Tests** | 85%+ | Jest | Services isolés |
| **Integration Tests** | 70%+ | Jest + MongoDB Memory | Modules complets |
| **E2E Tests** | 60%+ | Jest + Supertest | Parcours utilisateur |
| **Security Tests** | 100% | Custom | Fonctionnalités critiques |

### Commandes de Tests

```bash
# Tests complets avec couverture
npm run test:cov

# Tests en mode watch
npm run test:watch

# Tests end-to-end
npm run test:e2e

# Tests de sécurité
npm run test:security
```

### Métriques de Qualité

```bash
# Objectifs de couverture
Statements   : 85%
Branches     : 80%
Functions    : 90%
Lines        : 85%
```

## 🤝 Contribution

### Workflow de Contribution

1. **Fork** le projet
2. **Créer une branche**: `git checkout -b feature/amazing-feature`
3. **Commiter**: `git commit -m 'feat: add amazing feature'`
4. **Pusher**: `git push origin feature/amazing-feature`
5. **Pull Request** avec description détaillée

### Standards de Code

- ✅ **TypeScript strict mode** activé
- ✅ **ESLint + Prettier** configurés
- ✅ **JSDoc** obligatoire pour les fonctions publiques
- ✅ **Tests unitaires** pour les nouveaux services
- ✅ **Documentation Swagger** pour les nouveaux endpoints

### Commit Convention

```bash
feat: nouvelle fonctionnalité
fix: correction de bug
docs: mise à jour documentation
test: ajout de tests
refactor: refactoring sans changement fonctionnel
perf: amélioration performance
chore: tâches de maintenance
```

---

## 📊 Métriques & Performance

### Statistiques Actuelles
- **23 Repositories** avec pattern uniforme
- **100% TypeScript** avec types stricts
- **85%+ Test Coverage** sur les services critiques
- **Sub-200ms** response time moyenne
- **99.9%** uptime sur Railway

### Optimisations Mises en Place
- **MongoDB Index** optimisés pour les requêtes fréquentes
- **Repository Pattern** pour l'abstraction des données
- **Error Handling** centralisé et robuste
- **Rate Limiting** intelligent par utilisateur/IP
- **Audit Logging** complet pour la sécurité

---

## 📄 Licence

Ce projet est sous licence **MIT** - voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🎯 Roadmap

### 🚧 En Cours
- [ ] Système de recommandations IA avancé
- [ ] Cache Redis pour optimisations
- [ ] API GraphQL complémentaire
- [ ] Webhook system pour intégrations

### 🔮 Futur
- [ ] Microservices architecture
- [ ] Kubernetes deployment
- [ ] Machine Learning pour traductions
- [ ] API mobile dédiée

---

<div align="center">

**🌟 Si ce projet vous intéresse, n'hésitez pas à lui donner une étoile ! 🌟**

---

**Fait avec ❤️ par l'équipe O'Ypunu**  
*API robuste pour la démocratisation des langues africaines*

[![Built with NestJS](https://img.shields.io/badge/Built%20with-NestJS-ea2845?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![Powered by MongoDB](https://img.shields.io/badge/Powered%20by-MongoDB-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com/)
[![Deployed on Railway](https://img.shields.io/badge/Deployed%20on-Railway-purple?style=for-the-badge)](https://railway.app/)

</div>