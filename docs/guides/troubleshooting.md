# Guide de Résolution de Problèmes - O'Ypunu Backend

## 🚨 Diagnostic Rapide

### Check List de Base
```bash
# 1. Vérifier le statut de l'application
curl http://localhost:3000/health

# 2. Vérifier les logs
tail -f logs/app.log

# 3. Vérifier la base de données
npm run db:test-connection

# 4. Vérifier les variables d'environnement
npm run env:check
```

## 🔧 Problèmes de Démarrage

### ❌ Port déjà utilisé
**Symptôme:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
```bash
# Option 1: Trouver et tuer le processus
lsof -i :3000
kill -9 <PID>

# Option 2: Utiliser un autre port
PORT=3001 npm run start:dev

# Option 3: Configuration permanente dans .env
echo "PORT=3001" >> .env
```

### ❌ Variables d'environnement manquantes
**Symptôme:**
```
Error: JWT_SECRET is required
Configuration validation failed
```

**Solutions:**
```bash
# 1. Vérifier le fichier .env
ls -la .env

# 2. Copier depuis l'exemple
cp .env.example .env

# 3. Générer les secrets manquants
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

### ❌ Modules non trouvés
**Symptôme:**
```
Error: Cannot find module '@nestjs/core'
Module not found: Error: Can't resolve 'mongoose'
```

**Solutions:**
```bash
# 1. Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# 2. Vérifier la version Node.js
node --version  # Doit être >= 18.x

# 3. Nettoyer le cache npm
npm cache clean --force
```

## 🗄️ Problèmes Base de Données

### ❌ Connexion MongoDB échoue
**Symptôme:**
```
MongoServerError: bad auth : Authentication failed
MongoNetworkError: connection refused
```

**Diagnostic:**
```bash
# Test connexion directe
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/oypunu"

# Vérifier la chaîne de connexion
echo $MONGODB_URI
```

**Solutions:**
```bash
# 1. Vérifier les credentials
# Dans MongoDB Atlas: Database Access > Users

# 2. Vérifier Network Access
# Dans MongoDB Atlas: Network Access > IP Whitelist
# Ajouter 0.0.0.0/0 pour tester

# 3. Format URI correct
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"

# 4. Caractères spéciaux dans le mot de passe
# Encoder avec encodeURIComponent() ou utiliser des caractères simples
```

### ❌ Index MongoDB manquants
**Symptôme:**
```
Query performance is slow
Search not working correctly
```

**Solutions:**
```bash
# Créer les index requis
npm run db:create-indexes

# Vérifier les index existants
npm run db:list-indexes

# Recréer tous les index
npm run db:rebuild-indexes
```

### ❌ Données corrompues ou incohérentes
**Symptôme:**
```
ValidationError: Path `field` is required
CastError: Cast to ObjectId failed
```

**Solutions:**
```bash
# 1. Validation des données
npm run db:validate

# 2. Nettoyage des données corrompues
npm run db:clean

# 3. Migration des données
npm run db:migrate

# 4. Backup avant réparation
npm run db:backup
mongorestore --drop dump/
```

## 🔐 Problèmes d'Authentification

### ❌ JWT Token invalide
**Symptôme:**
```
HTTP 401: Unauthorized
JsonWebTokenError: invalid signature
TokenExpiredError: jwt expired
```

**Diagnostic:**
```bash
# Décoder le token (sans vérification)
node -e "
const jwt = require('jsonwebtoken');
const token = 'your-token-here';
console.log(jwt.decode(token));
"

# Vérifier l'expiration
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/auth/verify
```

**Solutions:**
```bash
# 1. Vérifier le secret JWT
echo $JWT_SECRET | wc -c  # Doit être >= 32 caractères

# 2. Régénérer le secret (invalide les tokens existants)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Vérifier la synchronisation des horloges
date
# Sur le serveur et le client

# 4. Réinitialiser les tokens
npm run auth:reset-tokens
```

### ❌ Refresh Token ne fonctionne pas
**Symptôme:**
```
HTTP 401: Invalid refresh token
RefreshTokenExpiredError
```

**Solutions:**
```bash
# 1. Vérifier la base de données des refresh tokens
npm run db:check-refresh-tokens

# 2. Nettoyer les tokens expirés
npm run auth:cleanup-expired-tokens

# 3. Vérifier la configuration
grep REFRESH_TOKEN .env
```

## 📁 Problèmes de Fichiers

### ❌ Upload de fichiers échoue
**Symptôme:**
```
HTTP 413: Payload Too Large
MulterError: Unexpected field
File validation failed
```

**Solutions:**
```bash
# 1. Vérifier la taille limite
echo $MAX_FILE_SIZE

# 2. Vérifier le dossier uploads
ls -la uploads/
chmod 755 uploads/

# 3. Vérifier l'espace disque
df -h

# 4. Configuration Multer
# Vérifier dans audio-security.middleware.ts
```

### ❌ Fichiers audio corrompus
**Symptôme:**
```
Audio processing failed
Invalid audio format
Malware detected
```

**Solutions:**
```bash
# 1. Valider le fichier manuellement
file uploads/audio/filename.mp3

# 2. Reconvertir le fichier
ffmpeg -i input.wav -acodec mp3 output.mp3

# 3. Scanner antivirus
clamscan uploads/

# 4. Régénérer les métadonnées
npm run audio:repair-metadata
```

## 🚦 Problèmes de Performance

### ❌ Réponses lentes
**Symptôme:**
```
Request timeout
High response times
Database query slow
```

**Diagnostic:**
```bash
# 1. Profiling des requêtes
npm run db:profile

# 2. Monitoring des performances
npm run perf:monitor

# 3. Analyse des logs
grep "slow query" logs/app.log

# 4. Métriques système
htop
iotop
```

**Solutions:**
```bash
# 1. Optimiser les requêtes
npm run db:optimize-queries

# 2. Ajouter des index manquants
npm run db:suggest-indexes

# 3. Augmenter la pool de connexions
# Dans database.config.ts: maxPoolSize: 20

# 4. Activer le cache
REDIS_URL=redis://localhost:6379
npm install redis
```

### ❌ Fuite mémoire
**Symptôme:**
```
Out of memory error
Heap out of memory
Process killed by system
```

**Diagnostic:**
```bash
# 1. Monitoring mémoire
node --inspect src/main.ts
# Ouvrir Chrome DevTools > Memory

# 2. Heap dump
kill -USR2 <process-id>

# 3. Profiling avec clinic
npm install -g clinic
clinic doctor -- node dist/main.js
```

**Solutions:**
```bash
# 1. Augmenter la limite heap
node --max-old-space-size=4096 dist/main.js

# 2. Optimiser les requêtes MongoDB
# Utiliser .lean() pour les lectures seules
# Limiter les .populate()

# 3. Nettoyer les listeners d'événements
# Vérifier EventEmitter.removeAllListeners()
```

## 🔒 Problèmes de Sécurité

### ❌ Rate limiting trop restrictif
**Symptôme:**
```
HTTP 429: Too Many Requests
Rate limit exceeded
```

**Solutions:**
```bash
# 1. Ajuster les limites temporairement
RATE_LIMIT_MAX_REQUESTS=200
RATE_LIMIT_WINDOW_MS=900000

# 2. Whitelist des IPs spécifiques
# Dans rate-limit.middleware.ts

# 3. Rate limiting par utilisateur plutôt que par IP
# Implémenter un rate limiter personnalisé
```

### ❌ CORS bloque les requêtes
**Symptôme:**
```
CORS error in browser
Access-Control-Allow-Origin missing
```

**Solutions:**
```bash
# 1. Vérifier la configuration CORS
echo $FRONTEND_URL
echo $ALLOWED_ORIGINS

# 2. Configuration temporaire permissive (DEV uniquement)
ALLOWED_ORIGINS=*

# 3. Debug CORS
curl -H "Origin: http://localhost:4200" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/api/v1/words
```

## 🧪 Problèmes de Tests

### ❌ Tests échouent
**Symptôme:**
```
Tests fail randomly
Database not cleaned between tests
Mock not working
```

**Solutions:**
```bash
# 1. Nettoyer la base de test
npm run test:db:clean

# 2. Augmenter les timeouts
# Dans jest.config.js: testTimeout: 30000

# 3. Isoler les tests
npm run test -- --runInBand

# 4. Debug un test spécifique
npm run test -- --verbose auth.service.spec.ts
```

### ❌ Coverage insuffisant
**Symptôme:**
```
Coverage below threshold
Uncovered lines in critical paths
```

**Solutions:**
```bash
# 1. Générer rapport détaillé
npm run test:cov:html

# 2. Identifier les fichiers non couverts
npm run test:cov -- --collectCoverageFrom="src/**/*.{ts,js}"

# 3. Exclure les fichiers de test/config
# Dans jest.config.js: coveragePathIgnorePatterns
```

## 🔧 Outils de Diagnostic

### Scripts Utiles
```json
{
  "scripts": {
    "debug:health": "curl -s http://localhost:3000/health | jq",
    "debug:db": "node scripts/test-db-connection.js",
    "debug:env": "node scripts/check-env-vars.js",
    "debug:auth": "node scripts/test-jwt.js",
    "debug:files": "ls -la uploads/ && df -h",
    "debug:logs": "tail -f logs/app.log | grep ERROR",
    "debug:memory": "node --inspect dist/main.js",
    "fix:permissions": "chmod -R 755 uploads/ logs/",
    "fix:deps": "rm -rf node_modules package-lock.json && npm install",
    "fix:db-indexes": "node scripts/create-indexes.js"
  }
}
```

### Script de Diagnostic Complet
```typescript
// scripts/diagnose.ts
import { Logger } from '@nestjs/common';
import * as mongoose from 'mongoose';
import * as fs from 'fs';

const logger = new Logger('Diagnostic');

async function runDiagnostic() {
  logger.log('🔍 Starting diagnostic...');
  
  // Check environment
  const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
  const missingVars = requiredEnvVars.filter(var => !process.env[var]);
  
  if (missingVars.length > 0) {
    logger.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
  } else {
    logger.log('✅ Environment variables OK');
  }
  
  // Check database
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.log('✅ Database connection OK');
    await mongoose.disconnect();
  } catch (error) {
    logger.error(`❌ Database connection failed: ${error.message}`);
  }
  
  // Check files
  const requiredDirs = ['uploads', 'logs'];
  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      logger.log(`✅ Directory ${dir} exists`);
    } else {
      logger.error(`❌ Directory ${dir} missing`);
      fs.mkdirSync(dir, { recursive: true });
      logger.log(`✅ Created directory ${dir}`);
    }
  });
  
  logger.log('🎉 Diagnostic complete');
}

runDiagnostic().catch(console.error);
```

## 📞 Support et Escalade

### Niveaux de Support
1. **Documentation**: Consultez d'abord cette documentation
2. **Logs**: Analysez les logs d'application et d'erreur
3. **Community**: Forum interne ou Discord de l'équipe
4. **Technical Lead**: Pour les problèmes complexes
5. **DevOps**: Pour les problèmes d'infrastructure

### Informations à Fournir
```markdown
**Environment:**
- Node.js version: 
- npm version:
- OS: 
- MongoDB version:

**Error Details:**
- Error message:
- Stack trace:
- Steps to reproduce:
- Expected behavior:

**Logs:**
```bash
# Logs d'application
tail -50 logs/app.log

# Logs système
dmesg | tail -20

# Configuration
cat .env | sed 's/=.*/=***HIDDEN***/'
```

**Diagnostic Results:**
```bash
npm run debug:health
npm run debug:db
npm run debug:env
```

---

**Version**: 1.0.0  
**Dernière mise à jour**: 30 Juillet 2025  
**Support**: team@oypunu.com