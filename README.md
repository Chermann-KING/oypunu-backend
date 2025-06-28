# 🌍 O'Ypunu - API du Dictionnaire Social Multilingue

[![NestJS](https://img.shields.io/badge/NestJS-11.0.1-ea2845.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.12.1-47A248.svg)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8.1-010101.svg)](https://socket.io/)
[![JWT](https://img.shields.io/badge/JWT-11.0.0-000000.svg)](https://jwt.io/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-2.6.1-3448C5.svg)](https://cloudinary.com/)

> API backend robuste pour O'Ypunu, une plateforme sociale de dictionnaire multilingue qui révolutionne l'apprentissage des langues en combinant la richesse d'un dictionnaire collaboratif avec les fonctionnalités d'un réseau social moderne.

## 📋 Table des Matières

- [✨ Aperçu du Projet](#-aperçu-du-projet)
- [🚀 Fonctionnalités API](#-fonctionnalités-api)
- [🏗️ Architecture Backend](#️-architecture-backend)
- [🛠️ Technologies Utilisées](#️-technologies-utilisées)
- [📦 Installation](#-installation)
- [💻 Développement](#-développement)
- [📁 Structure du Projet](#-structure-du-projet)
- [🔗 API Documentation](#-api-documentation)
- [🔒 Sécurité](#-sécurité)
- [🤝 Contribution](#-contribution)
- [📄 Licence](#-licence)

## ✨ Aperçu du Projet

**O'Ypunu Backend** est l'API REST et WebSocket qui alimente la plateforme O'Ypunu. Cette API robuste fournit :

- 🔐 **Authentification complète** avec JWT et OAuth social
- 📚 **API Dictionnaire** avec gestion collaborative des mots
- 🌐 **Gestion des communautés** linguistiques
- 💬 **Messagerie temps réel** via WebSocket
- 👥 **Système social** avec profils et favoris
- 🎯 **Administration** et modération avancées
- 🔊 **Gestion audio** pour prononciations

### 🎯 Mission

Fournir une API scalable et sécurisée pour démocratiser l'apprentissage linguistique en créant une communauté mondiale où chaque utilisateur contribue à enrichir la connaissance collective des langues.

## 🚀 Fonctionnalités API

### 🔐 Authentification & Autorisation

- **JWT Authentication** avec refresh tokens
- **OAuth Social** : Google, Facebook, Twitter
- **Vérification email** avec templates personnalisés
- **Réinitialisation de mot de passe** sécurisée
- **Système de rôles** : USER, CONTRIBUTOR, ADMIN, SUPERADMIN
- **Guards NestJS** pour la protection des routes

### 📖 API Dictionnaire

- **CRUD complet** pour les mots avec validation
- **Recherche avancée** avec filtres multiples
- **Système d'approbation** avec workflow de modération
- **Gestion des révisions** avec historique complet
- **Upload audio** avec validation et optimisation
- **Traductions multilingues** et étymologies

### 🌍 Gestion des Communautés

- **CRUD communautés** avec permissions
- **Système de membres** avec rôles (admin, modérateur, membre)
- **Posts communautaires** avec likes et commentaires
- **Modération** distribuée et outils d'administration
- **Communautés privées/publiques** selon les besoins

### 💬 Messagerie Temps Réel

- **WebSocket Gateway** avec Socket.io
- **Messages privés** persistants
- **Conversations** avec historique
- **Indicateurs de frappe** et statuts de présence
- **Partage de mots** intégré dans les conversations
- **Notifications** en temps réel

### 👤 Gestion des Utilisateurs

- **Profils utilisateurs** complets
- **Système de favoris** pour les mots
- **Statistiques d'apprentissage** personnalisées
- **Langues natives/apprises** avec préférences
- **Système de suspension** et modération

### 🛡️ Administration

- **Dashboard administrateur** avec métriques détaillées
- **Modération des contenus** (approbation/rejet)
- **Gestion des utilisateurs** et permissions
- **Statistiques avancées** et rapports
- **Outils de monitoring** et maintenance

## 🏗️ Architecture Backend

### Structure Modulaire NestJS

```
src/
├── auth/                  # Module d'authentification
│   ├── controllers/      # Contrôleurs auth (login, register, social)
│   ├── services/         # Logique métier auth
│   ├── guards/           # Guards JWT et rôles
│   └── strategies/       # Stratégies Passport OAuth
├── users/                # Module utilisateurs
│   ├── controllers/      # CRUD utilisateurs
│   ├── services/         # Logique métier utilisateurs
│   ├── schemas/          # Schémas MongoDB
│   └── dto/              # Data Transfer Objects
├── dictionary/           # Module dictionnaire
│   ├── controllers/      # API mots, catégories, audio
│   ├── services/         # Logique métier dictionnaire
│   ├── schemas/          # Schémas mots, révisions
│   └── middlewares/      # Sécurité audio
├── communities/          # Module communautés
│   ├── controllers/      # CRUD communautés et posts
│   ├── services/         # Logique métier social
│   └── schemas/          # Schémas communautés, membres
├── messaging/            # Module messagerie
│   ├── controllers/      # API messages
│   ├── services/         # Logique métier chat
│   ├── gateways/         # WebSocket Gateway
│   └── schemas/          # Schémas messages, conversations
├── admin/                # Module administration
│   ├── controllers/      # Dashboard et modération
│   └── services/         # Logique métier admin
├── common/               # Services partagés
│   ├── services/         # Mail, cache, utilities
│   ├── guards/           # Guards réutilisables
│   ├── interceptors/     # Intercepteurs HTTP
│   └── decorators/       # Décorateurs personnalisés
└── config/               # Configuration globale
```

### Base de Données MongoDB

- **Collections principales** : Users, Words, Communities, Messages
- **Indexation optimisée** pour les performances
- **Relations** avec références ObjectId
- **Validation** avec Mongoose schemas

## 🛠️ Technologies Utilisées

### Backend Core

| Technologie    | Version | Usage                    |
| -------------- | ------- | ------------------------ |
| **NestJS**     | 11.0.1  | Framework Node.js        |
| **TypeScript** | 5.7.3   | Langage de développement |
| **MongoDB**    | 8.12.1  | Base de données NoSQL    |
| **Mongoose**   | 8.12.1  | ODM MongoDB              |
| **Socket.io**  | 4.8.1   | Communication temps réel |
| **Passport**   | 0.7.0   | Authentification         |

### Services & Intégrations

| Service        | Version | Usage                     |
| -------------- | ------- | ------------------------- |
| **JWT**        | 11.0.0  | Tokens d'authentification |
| **Bcrypt**     | 5.1.1   | Hashage mots de passe     |
| **Cloudinary** | 2.6.1   | Stockage fichiers audio   |
| **Nodemailer** | 6.10.0  | Envoi d'emails            |
| **Redis**      | 5.6.1   | Cache et sessions         |
| **Multer**     | 2.0.1   | Upload de fichiers        |

### Développement & Tests

| Outil        | Version | Usage              |
| ------------ | ------- | ------------------ |
| **Jest**     | 29.7.0  | Tests unitaires    |
| **ESLint**   | 9.23.0  | Linting TypeScript |
| **Prettier** | 3.4.2   | Formatage du code  |
| **Swagger**  | 11.1.0  | Documentation API  |

## 📦 Installation

### Prérequis

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB** (local ou cloud Atlas)
- **Redis** (optionnel, pour les fonctionnalités temps réel)

### Installation Rapide

```bash
# Cloner le repository
git clone <repository-url>
cd oypunu-backend

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Modifier les variables selon votre configuration

# Lancer en développement
npm run start:dev
```

L'API sera accessible sur `http://localhost:3000`

### Variables d'Environnement

```bash
# .env
# Base de données
MONGODB_URI=mongodb://localhost:27017/oypunu

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1d

# Email (Nodemailer)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=noreply@oypunu.com

# Cloudinary (pour les audios)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# OAuth (optionnel)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Frontend URL
FRONTEND_URL=http://localhost:4200

# App URL
APP_URL=http://localhost:3000
PORT=3000
```

## 💻 Développement

### Scripts Disponibles

```bash
# Développement avec hot reload
npm run start:dev

# Build de production
npm run build

# Lancer en production
npm run start:prod

# Tests unitaires
npm test

# Tests avec couverture
npm run test:cov

# Linting et formatage
npm run lint
```

### Base de Données

```bash
# MongoDB local
mongod

# Ou utiliser MongoDB Atlas (cloud)
# Modifier MONGODB_URI dans .env
```

### Documentation API

Une fois l'API lancée, accédez à :

- **Swagger UI** : `http://localhost:3000/api-docs`
- **API Base** : `http://localhost:3000/api/`

## 📁 Structure du Projet

### Modules Principaux

- **AppModule** : Module racine avec configuration globale
- **AuthModule** : Authentification complète (JWT + OAuth)
- **UsersModule** : Gestion des utilisateurs et profils
- **DictionaryModule** : API dictionnaire avec audio
- **CommunitiesModule** : Réseau social et communautés
- **MessagingModule** : Chat temps réel
- **AdminModule** : Administration et modération

### Services Centraux

- **AuthService** : Logique d'authentification et autorisation
- **WordsService** : CRUD mots avec système d'approbation
- **AudioService** : Gestion des fichiers audio avec Cloudinary
- **MailService** : Envoi d'emails avec templates HTML
- **MessagingService** : Logique de messagerie persistante

### Schémas MongoDB

```typescript
// Exemple : User Schema
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  username: string;

  @Prop({ enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  favoriteWords: string[];

  @Prop()
  nativeLanguage: string;

  @Prop({ type: [String], default: [] })
  learningLanguages: string[];
}
```

## 🔗 API Documentation

### Endpoints Principaux

#### Authentification

```
POST   /api/auth/register           # Inscription
POST   /api/auth/login              # Connexion
GET    /api/auth/verify-email/:token # Vérification email
POST   /api/auth/forgot-password    # Mot de passe oublié
GET    /api/auth/profile            # Profil utilisateur
```

#### Dictionnaire

```
GET    /api/words/search            # Recherche de mots
POST   /api/words                   # Créer un mot
GET    /api/words/:id               # Détails d'un mot
PUT    /api/words/:id               # Modifier un mot
POST   /api/words/:id/audio         # Upload audio
GET    /api/words/pending           # Mots en attente (admin)
```

#### Communautés

```
GET    /api/communities             # Lister les communautés
POST   /api/communities             # Créer une communauté
GET    /api/communities/:id         # Détails communauté
POST   /api/communities/:id/join    # Rejoindre
GET    /api/communities/:id/members # Membres
```

#### Messagerie

```
GET    /api/messaging/conversations # Conversations
GET    /api/messaging/messages      # Messages
POST   /api/messaging/send          # Envoyer message
GET    /api/messaging/unread-count  # Messages non lus
```

### WebSocket Events

```typescript
// Événements temps réel
"send_message"; // Envoyer un message
"join_conversation"; // Rejoindre une conversation
"typing_start"; // Commencer à taper
"typing_stop"; // Arrêter de taper

// Événements reçus
"new_message"; // Nouveau message
"user_online"; // Utilisateur en ligne
"user_offline"; // Utilisateur hors ligne
```

## 🔒 Sécurité

### Authentification

- **JWT Tokens** avec expiration configurable
- **Refresh Tokens** pour la sécurité
- **Hashage bcrypt** pour les mots de passe
- **Validation stricte** des entrées utilisateur

### Autorisation

```typescript
// Exemple de protection par rôle
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('admin/users')
async getUsers() {
  // Seuls les admins peuvent accéder
}
```

### Validation

- **DTOs avec class-validator** pour toutes les entrées
- **Sanitisation** des données utilisateur
- **Validation des fichiers** audio uploadés
- **Rate limiting** pour éviter les abus

## 🤝 Contribution

### Workflow de Développement

1. **Fork** le projet
2. **Créer une branche** : `git checkout -b feature/nouvelle-fonctionnalite`
3. **Commit** les changements : `git commit -m 'Ajout nouvelle fonctionnalité API'`
4. **Push** la branche : `git push origin feature/nouvelle-fonctionnalite`
5. **Ouvrir une Pull Request**

### Standards de Code

- **TypeScript strict** activé
- **ESLint + Prettier** pour la qualité du code
- **Tests unitaires** obligatoires pour les services
- **Documentation Swagger** pour tous les endpoints

### Tests

```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:cov

# Tests de bout en bout
npm run test:e2e
```

## 🚀 Déploiement

### Build de Production

```bash
# Build optimisé
npm run build

# Lancer en production
npm run start:prod
```

### Variables d'Environnement Production

```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/oypunu
JWT_SECRET=super-secure-production-secret
FRONTEND_URL=https://oypunu.com
APP_URL=https://api.oypunu.com
```

### Docker (optionnel)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

## 📊 Monitoring & Performance

### Métriques Disponibles

- **Utilisateurs actifs** et statistiques d'inscription
- **Mots créés/approuvés** par période
- **Messages envoyés** et activité temps réel
- **Performance API** et temps de réponse

### Optimisations

- **Indexation MongoDB** pour les requêtes fréquentes
- **Cache Redis** pour les données souvent consultées
- **Pagination** pour toutes les listes
- **Validation optimisée** des fichiers audio

## 📄 Licence

Ce projet est sous licence **MIT** - voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 👨‍💻 Auteur

**Chermann KING** - _Développeur Principal_

---

<div align="center">

**🌟 Si ce projet vous plaît, n'hésitez pas à lui donner une étoile ! 🌟**

_API robuste pour la communauté des passionnés de langues - Fait avec ❤️ et NestJS_

</div>
