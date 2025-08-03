# Guide d'Installation et Configuration - O'Ypunu Backend

## 🚀 Prérequis

### Environnement de Développement

- **Node.js**: Version 18.x ou supérieure
- **npm**: Version 9.x ou supérieure
- **MongoDB**: Version 6.x ou MongoDB Atlas
- **Git**: Pour le contrôle de version
- **VS Code**: Recommandé avec extensions TypeScript

### Outils Optionnels

- **Docker**: Pour containerisation
- **MongoDB Compass**: Interface graphique MongoDB
- **Postman**: Tests API
- **Redis**: Cache (optionnel)

## 📥 Installation

### 1. Clonage du Repository

```bash
git clone https://github.com/Chermann-KING/oypunu-backend.git
cd oypunu-backend
```

### 2. Installation des Dépendances

```bash
# Installation des packages
npm install

# Vérification des vulnérabilités
npm audit

# Correction automatique si nécessaire
npm audit fix
```

### 3. Configuration de l'Environnement

#### Fichier .env

Créez un fichier `.env` à la racine du projet :

```env
# === DATABASE ===
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/oypunu?retryWrites=true&w=majority
DATABASE_NAME=oypunu

# === JWT CONFIGURATION ===
JWT_SECRET=votre-secret-jwt-super-securise-256-bits-minimum
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=votre-refresh-secret-different-du-jwt
REFRESH_TOKEN_EXPIRES_IN=7d

# === SERVER ===
PORT=3000
NODE_ENV=development
API_VERSION=v1

# === CORS ===
FRONTEND_URL=http://localhost:4200
ALLOWED_ORIGINS=http://localhost:4200,http://localhost:3000

# === RATE LIMITING ===
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# === FILE UPLOAD ===
MAX_FILE_SIZE=5242880
UPLOAD_DEST=./uploads
ALLOWED_AUDIO_TYPES=audio/mpeg,audio/wav,audio/ogg

# === EXTERNAL SERVICES ===
SENDGRID_API_KEY=your-sendgrid-api-key
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# === MONITORING ===
SENTRY_DSN=your-sentry-dsn-url

# === SECURITY ===
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=your-session-secret

# === LOGS ===
LOG_LEVEL=debug
LOG_FILE_PATH=./logs/app.log
```

#### Variables d'Environnement Requises

| Variable      | Description                 | Valeur par Défaut |
| ------------- | --------------------------- | ----------------- |
| `MONGODB_URI` | Chaîne de connexion MongoDB | -                 |
| `JWT_SECRET`  | Secret pour signature JWT   | -                 |
| `PORT`        | Port d'écoute du serveur    | 3000              |
| `NODE_ENV`    | Environnement d'exécution   | development       |

#### Variables Optionnelles

| Variable                  | Description                 | Valeur par Défaut |
| ------------------------- | --------------------------- | ----------------- |
| `RATE_LIMIT_MAX_REQUESTS` | Limite requêtes par fenêtre | 100               |
| `MAX_FILE_SIZE`           | Taille max fichiers (bytes) | 5MB               |
| `LOG_LEVEL`               | Niveau de logging           | info              |

## 🗄️ Configuration Base de Données

### MongoDB Atlas (Recommandé pour Production)

1. **Créer un Cluster**
   - Connectez-vous à [MongoDB Atlas](https://cloud.mongodb.com)
   - Créez un nouveau cluster
   - Configurez les utilisateurs et la sécurité réseau

2. **Configuration de Connexion**

   ```typescript
   // Configuration automatique via MONGODB_URI
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
   ```

3. **Index Requis**
   ```bash
   # Lancement automatique des migrations
   npm run migrate
   ```

### MongoDB Local

1. **Installation MongoDB**

   ```bash
   # Ubuntu/Debian
   sudo apt-get install mongodb

   # macOS avec Homebrew
   brew install mongodb-community

   # Windows - Télécharger depuis mongodb.com
   ```

2. **Démarrage du Service**

   ```bash
   # Ubuntu/Debian
   sudo systemctl start mongodb

   # macOS
   brew services start mongodb/brew/mongodb-community

   # Manuel
   mongod --dbpath /path/to/data/directory
   ```

3. **Chaîne de Connexion Locale**
   ```env
   MONGODB_URI=mongodb://localhost:27017/oypunu
   ```

## 🔧 Scripts de Développement

### Scripts Principaux

```bash
# Démarrage en mode développement (avec hot-reload)
npm run start:dev

# Démarrage en mode production
npm run start:prod

# Build pour production
npm run build

# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests end-to-end
npm run test:e2e

# Linting et formatage
npm run lint
npm run format

# Migrations base de données
npm run migrate

# Génération documentation
npm run docs:generate
```

### Scripts de Base de Données

```bash
# Création des index MongoDB
npm run db:index

# Seed des données de base
npm run db:seed

# Backup base de données
npm run db:backup

# Restauration backup
npm run db:restore
```

## 🐳 Docker (Optionnel)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/oypunu
    depends_on:
      - mongo
    volumes:
      - ./uploads:/app/uploads

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
      - MONGO_INITDB_DATABASE=oypunu

volumes:
  mongo_data:
```

### Commandes Docker

```bash
# Build et démarrage
docker-compose up --build

# Démarrage en arrière-plan
docker-compose up -d

# Arrêt des services
docker-compose down

# Logs des services
docker-compose logs -f

# Accès au container
docker-compose exec app sh
```

## 🧪 Vérification de l'Installation

### 1. Health Check

```bash
# Test de base
curl http://localhost:3000/health

# Réponse attendue
{
  "status": "ok",
  "timestamp": "2025-07-30T12:00:00.000Z",
  "database": "connected",
  "memory": "125.5 MB",
  "uptime": "00:05:23"
}
```

### 2. Test Endpoints Principaux

```bash
# Test de la documentation API
curl http://localhost:3000/api-docs

# Test endpoint public
curl http://localhost:3000/api/v1/languages

# Test endpoint protégé (doit retourner 401)
curl http://localhost:3000/api/v1/words \
  -H "Content-Type: application/json"
```

### 3. Vérification Base de Données

```bash
# Via MongoDB Compass
# Connectez-vous à votre URI MongoDB
# Vérifiez la présence des collections principales

# Via CLI
node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Database connected'))
  .catch(err => console.error('❌ Database error:', err));
"
```

## 🔒 Configuration Sécurité

### 1. Génération des Secrets

```bash
# Génération JWT Secret (256 bits)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Génération Refresh Token Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Génération Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configuration HTTPS (Production)

```typescript
// main.ts pour HTTPS
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as fs from "fs";

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync("./secrets/private-key.pem"),
    cert: fs.readFileSync("./secrets/public-certificate.pem"),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions,
  });

  await app.listen(3000);
}
bootstrap();
```

## 🚀 Déploiement

### Railway (Recommandé)

```bash
# Installation Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialisation projet
railway init

# Déploiement
railway up

# Variables d'environnement
railway variables set JWT_SECRET=your-secret
railway variables set MONGODB_URI=your-mongodb-uri
```

### Variables d'Environnement Railway

```bash
# Production essentials
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set MONGODB_URI=your-atlas-uri
railway variables set JWT_SECRET=your-production-secret
railway variables set FRONTEND_URL=https://your-frontend-domain.com
```

## 🔍 Debugging et Logs

### Configuration Logs

```typescript
// main.ts
import { Logger } from "@nestjs/common";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  logger.log("🚀 Application starting...");
  await app.listen(3000);
  logger.log("✅ Application started on port 3000");
}
```

### VS Code Launch Configuration

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
      "args": [],
      "runtimeArgs": ["-r", "ts-node/register"],
      "sourceMaps": true,
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal"
    }
  ]
}
```

## 📊 Monitoring

### Health Check Endpoint

```typescript
@Get('health')
async healthCheck(): Promise<HealthStatus> {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: await this.databaseService.checkConnection(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };
}
```

### Sentry Configuration

```typescript
// main.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## ❓ Résolution de Problèmes

### Problèmes Courants

1. **Erreur de Connexion MongoDB**

   ```
   Solution: Vérifiez MONGODB_URI et la connectivité réseau
   ```

2. **Port 3000 déjà utilisé**

   ```bash
   # Trouver le processus
   lsof -i :3000

   # Tuer le processus
   kill -9 <PID>

   # Ou changer le port
   PORT=3001 npm run start:dev
   ```

3. **Erreurs de TypeScript**

   ```bash
   # Nettoyage cache
   npm run build:clean
   rm -rf dist/
   npm run build
   ```

4. **Problèmes de Dépendances**
   ```bash
   # Reinstallation complète
   rm -rf node_modules package-lock.json
   npm install
   ```

---

**Version**: 1.0.0  
**Dernière mise à jour**: 30 Juillet 2025  
**Support**: team@oypunu.com
