# Architecture Base de Données - O'Ypunu Backend

## 🗄️ Vue d'Ensemble

Le backend O'Ypunu utilise **MongoDB** comme base de données principale avec **Mongoose** comme ODM (Object Document Mapper). Cette architecture NoSQL offre la flexibilité nécessaire pour gérer la diversité des langues africaines et l'évolutivité des contenus linguistiques.

## 📊 Architecture Générale

### Stack Technologique
- **Base de données** : MongoDB 6.0+
- **ODM** : Mongoose 7.x
- **Driver** : MongoDB Node.js Driver 4.x
- **Indexation** : Indexes composés et text search
- **Réplication** : Replica Set (production)
- **Backup** : MongoDB Atlas Backup + snapshots

### Modèle de Données

```mermaid
erDiagram
    User ||--o{ Word : creates
    User ||--o{ CommunityMember : joins
    User ||--o{ Message : sends
    User ||--o{ WordView : tracks
    
    Language ||--o{ Word : contains
    Language ||--o{ Community : focuses_on
    
    Word ||--o{ Translation : has
    Word ||--o{ AudioFile : has
    Word ||--o{ RevisionHistory : has
    Word ||--o{ WordVote : receives
    
    Community ||--o{ CommunityMember : has
    Community ||--o{ CommunityPost : contains
    
    Conversation ||--o{ Message : contains
    
    User {
        ObjectId _id PK
        string email UK
        string username UK
        string password
        string role
        ObjectId nativeLanguageId FK
        ObjectId[] learningLanguageIds FK
        boolean isEmailVerified
        boolean isActive
        Date createdAt
        Date updatedAt
    }
    
    Word {
        ObjectId _id PK
        string word
        ObjectId languageId FK
        string pronunciation
        string etymology
        Object[] meanings
        string status
        ObjectId createdBy FK
        Date createdAt
        Date updatedAt
    }
    
    Language {
        ObjectId _id PK
        string name
        string nativeName
        string iso639_1
        string iso639_2
        string iso639_3
        string family
        string region
        boolean isActive
    }
    
    Community {
        ObjectId _id PK
        string name
        string slug UK
        string description
        ObjectId primaryLanguageId FK
        string visibility
        ObjectId createdBy FK
        Object stats
        Date createdAt
    }
```

## 🏗️ Schémas de Collections

### Collection Users
```typescript
interface UserSchema {
  _id: ObjectId;
  email: string;                    // Index unique
  username: string;                 // Index unique
  password: string;                 // Hash bcrypt
  role: 'user' | 'contributor' | 'admin' | 'superadmin';
  
  // Profil utilisateur
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePicture?: string;
  location?: string;
  website?: string;
  
  // Langues
  nativeLanguageId?: ObjectId;      // Référence Language
  learningLanguageIds: ObjectId[];  // Références Languages
  
  // Statuts
  isEmailVerified: boolean;
  isActive: boolean;
  isProfilePublic: boolean;
  
  // Tokens de sécurité
  emailVerificationToken?: string;
  emailVerificationTokenExpires?: Date;
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  
  // Activité
  lastLogin?: Date;
  lastActive?: Date;
  loginCount: number;
  
  // Statistiques
  totalWordsAdded: number;
  totalCommunityPosts: number;
  favoriteWordsCount: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### Collection Words
```typescript
interface WordSchema {
  _id: ObjectId;
  word: string;                     // Index text
  languageId: ObjectId;             // Référence Language, Index
  
  // Informations linguistiques
  pronunciation?: string;
  etymology?: string;
  categoryId?: ObjectId;            // Référence Category
  
  // Significations
  meanings: [{
    definition: string;             // Index text
    partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'pronoun' | 'conjunction' | 'preposition' | 'interjection' | 'other';
    example?: string;
    synonyms?: string[];
    antonyms?: string[];
    register?: 'formal' | 'informal' | 'colloquial' | 'slang' | 'archaic' | 'literary';
  }];
  
  // Traductions
  translations: [{
    targetLanguageId: ObjectId;     // Référence Language
    text: string;
    createdBy: ObjectId;            // Référence User
    createdAt: Date;
  }];
  
  // Fichiers audio
  audioFiles: [{
    url: string;
    accent: string;
    createdBy: ObjectId;            // Référence User
    createdAt: Date;
  }];
  
  // Modération
  status: 'pending' | 'approved' | 'rejected';
  moderatedBy?: ObjectId;           // Référence User
  moderationReason?: string;
  
  // Métadonnées
  createdBy: ObjectId;              // Référence User, Index
  createdAt: Date;                  // Index
  updatedAt: Date;
  
  // Statistiques (dénormalisées pour performance)
  viewCount: number;
  favoriteCount: number;
}
```

### Collection Languages
```typescript
interface LanguageSchema {
  _id: ObjectId;
  name: string;                     // Index unique
  nativeName: string;
  
  // Codes ISO
  iso639_1?: string;                // Index unique sparse
  iso639_2?: string;                // Index unique sparse
  iso639_3?: string;                // Index unique sparse
  
  // Classification
  family?: string;                  // Index
  region?: string;                  // Index
  country?: string;
  
  // Métadonnées
  speakers?: number;
  description?: string;
  isActive: boolean;                // Index
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}
```

### Collection Communities
```typescript
interface CommunitySchema {
  _id: ObjectId;
  name: string;                     // Index
  slug: string;                     // Index unique
  description: string;
  longDescription?: string;
  
  // Médias
  avatar?: string;
  banner?: string;
  color?: string;
  
  // Configuration
  type: 'language' | 'region' | 'topic' | 'level';
  primaryLanguageId: ObjectId;      // Référence Language, Index
  supportedLanguageIds: ObjectId[]; // Références Languages
  visibility: 'public' | 'private' | 'invite-only';
  
  // Règles et modération
  rules: string[];
  moderationLevel: 'low' | 'medium' | 'high';
  allowPosts: boolean;
  requireApproval: boolean;
  
  // Statistiques (mise à jour par triggers)
  stats: {
    memberCount: number;
    postCount: number;
    activeMembers: number;
    engagementRate: number;
  };
  
  // Métadonnées
  tags: string[];                   // Index multikey
  createdBy: ObjectId;              // Référence User
  createdAt: Date;                  // Index
  updatedAt: Date;
  lastActivity: Date;               // Index
}
```

### Collection Messages
```typescript
interface MessageSchema {
  _id: ObjectId;
  conversationId: ObjectId;         // Index
  senderId: ObjectId;               // Référence User, Index
  
  // Contenu
  content: string;                  // Index text (pour recherche)
  contentType: 'text' | 'rich' | 'markdown' | 'system';
  messageType: 'text' | 'image' | 'file' | 'audio' | 'word' | 'system';
  
  // Hiérarchie
  replyToMessageId?: ObjectId;      // Référence Message
  threadId?: ObjectId;
  
  // Pièces jointes
  attachments: [{
    type: 'image' | 'file' | 'audio' | 'word';
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    metadata?: any;
  }];
  
  // Interactions
  mentions: ObjectId[];             // Références Users
  reactions: [{
    emoji: string;
    userId: ObjectId;               // Référence User
    addedAt: Date;
  }];
  
  // Statut
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveryStatus: Map<string, {
    status: 'delivered' | 'read';
    timestamp: Date;
  }>;
  
  // Modération
  isModerated: boolean;
  moderationReason?: string;
  reportCount: number;
  
  // Édition
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  
  // Chiffrement
  isEncrypted: boolean;
  encryptionKey?: string;
  
  // Timestamps
  createdAt: Date;                  // Index
  updatedAt: Date;
}
```

## 🔍 Stratégie d'Indexation

### Index Critiques

#### Collection Users
```javascript
// Index uniques
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })

// Index composés pour requêtes fréquentes
db.users.createIndex({ "role": 1, "isActive": 1 })
db.users.createIndex({ "lastActive": -1, "isActive": 1 })
db.users.createIndex({ "nativeLanguageId": 1 })
db.users.createIndex({ "learningLanguageIds": 1 })

// Index sparse pour tokens
db.users.createIndex({ "emailVerificationToken": 1 }, { sparse: true })
db.users.createIndex({ "passwordResetToken": 1 }, { sparse: true })
```

#### Collection Words
```javascript
// Index text search (multilingue)
db.words.createIndex({ 
  "word": "text", 
  "meanings.definition": "text", 
  "meanings.example": "text" 
}, { 
  default_language: "none",
  weights: { 
    "word": 10, 
    "meanings.definition": 5, 
    "meanings.example": 1 
  }
})

// Index composés pour filtrage
db.words.createIndex({ "languageId": 1, "status": 1 })
db.words.createIndex({ "status": 1, "createdAt": -1 })
db.words.createIndex({ "createdBy": 1, "createdAt": -1 })

// Index pour analytics
db.words.createIndex({ "createdAt": -1 })
db.words.createIndex({ "status": 1, "createdAt": -1 })
```

#### Collection Communities
```javascript
// Index pour recherche et filtrage
db.communities.createIndex({ "slug": 1 }, { unique: true })
db.communities.createIndex({ "visibility": 1, "primaryLanguageId": 1 })
db.communities.createIndex({ "type": 1, "isActive": 1 })
db.communities.createIndex({ "tags": 1 })

// Index pour tri par popularité
db.communities.createIndex({ "stats.memberCount": -1 })
db.communities.createIndex({ "lastActivity": -1 })
```

#### Collection Messages
```javascript
// Index pour conversations
db.messages.createIndex({ "conversationId": 1, "createdAt": -1 })
db.messages.createIndex({ "senderId": 1, "createdAt": -1 })

// Index pour recherche dans messages
db.messages.createIndex({ "content": "text" })

// Index pour modération
db.messages.createIndex({ "isModerated": 1, "reportCount": -1 })
```

### Index TTL (Time To Live)
```javascript
// Auto-suppression des tokens expirés
db.users.createIndex({ "emailVerificationTokenExpires": 1 }, { expireAfterSeconds: 0 })
db.users.createIndex({ "passwordResetTokenExpires": 1 }, { expireAfterSeconds: 0 })

// Auto-suppression des sessions WebSocket expirées
db.websocketsessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 })
```

## 🚀 Optimisations de Performance

### 1. Connection Pooling
```typescript
// Configuration Mongoose optimisée
const mongooseConfig = {
  maxPoolSize: 10,        // Maximum 10 connexions
  minPoolSize: 2,         // Minimum 2 connexions
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 30000,   // Fermer connexions inactives après 30s
  
  // Optimisations read/write
  readPreference: 'primaryPreferred',
  writeConcern: { w: 'majority', j: true },
  
  // Monitoring
  monitorCommands: true,
};
```

### 2. Requêtes Aggregation Optimisées
```typescript
// Pipeline d'agrégation pour statistiques de mots
const wordStatsAggregation = [
  {
    $match: {
      status: 'approved',
      createdAt: { $gte: startDate }
    }
  },
  {
    $group: {
      _id: '$languageId',
      count: { $sum: 1 },
      avgMeanings: { $avg: { $size: '$meanings' } },
      recentWords: { $push: { word: '$word', createdAt: '$createdAt' } }
    }
  },
  {
    $lookup: {
      from: 'languages',
      localField: '_id',
      foreignField: '_id',
      as: 'language'
    }
  },
  {
    $project: {
      languageName: { $arrayElemAt: ['$language.name', 0] },
      count: 1,
      avgMeanings: { $round: ['$avgMeanings', 2] },
      recentWords: { $slice: ['$recentWords', 5] }
    }
  }
];
```

### 3. Caching Strategy
```typescript
// Cache Redis pour requêtes fréquentes
const cacheConfig = {
  // Cache des langues (rarement modifiées)
  languages: { ttl: 3600 * 24 },        // 24 heures
  
  // Cache des mots populaires
  featuredWords: { ttl: 3600 },         // 1 heure
  
  // Cache des statistiques
  userStats: { ttl: 300 },              // 5 minutes
  communityStats: { ttl: 600 },         // 10 minutes
  
  // Cache des recherches fréquentes
  searchResults: { ttl: 180 },          // 3 minutes
};
```

## 🔄 Migrations et Versioning

### Scripts de Migration
```typescript
// Migration: Ajout index performance v1.2.0
export class AddPerformanceIndexes1642680000000 implements Migration {
  async up(): Promise<void> {
    await this.connection.collection('words').createIndex(
      { "languageId": 1, "status": 1, "createdAt": -1 },
      { background: true }
    );
    
    await this.connection.collection('users').createIndex(
      { "role": 1, "lastActive": -1 },
      { background: true }
    );
  }
  
  async down(): Promise<void> {
    await this.connection.collection('words').dropIndex("languageId_1_status_1_createdAt_-1");
    await this.connection.collection('users').dropIndex("role_1_lastActive_-1");
  }
}
```

### Data Migrations
```typescript
// Migration: Normalisation codes ISO langues
export class NormalizeLanguageCodes1642690000000 implements Migration {
  async up(): Promise<void> {
    const languages = await this.connection.collection('languages').find({
      $or: [
        { iso639_1: { $exists: false } },
        { iso639_2: { $exists: false } },
        { iso639_3: { $exists: false } }
      ]
    }).toArray();
    
    for (const language of languages) {
      const normalizedCodes = this.normalizeISOCodes(language);
      
      await this.connection.collection('languages').updateOne(
        { _id: language._id },
        { $set: normalizedCodes }
      );
    }
  }
  
  private normalizeISOCodes(language: any) {
    // Logique de normalisation des codes ISO
    return {
      iso639_1: language.iso639_1 || this.deriveISO639_1(language.name),
      iso639_2: language.iso639_2 || this.deriveISO639_2(language.name),
      iso639_3: language.iso639_3 || this.deriveISO639_3(language.name)
    };
  }
}
```

## 📈 Monitoring et Maintenance

### Métriques de Performance
```typescript
// Monitoring des requêtes lentes
mongoose.connection.on('slow', (event) => {
  console.warn('Slow Query Detected:', {
    duration: event.duration,
    command: event.command,
    collection: event.collection
  });
  
  // Envoyer alerte si > 1000ms
  if (event.duration > 1000) {
    alertingService.sendSlowQueryAlert(event);
  }
});

// Métriques de connexion
setInterval(() => {
  const connectionStats = {
    readyState: mongoose.connection.readyState,
    poolSize: mongoose.connection.db?.serverConfig?.poolSize,
    activeConnections: mongoose.connection.db?.serverConfig?.connectionPool?.totalCreated
  };
  
  metricsService.recordDatabaseMetrics(connectionStats);
}, 30000); // Toutes les 30 secondes
```

### Maintenance Automatisée
```typescript
// Nettoyage automatique des données expirées
const cleanupJobs = {
  // Nettoyer les tokens expirés (backup)
  cleanExpiredTokens: cron.schedule('0 */6 * * *', async () => {
    await User.updateMany(
      {
        $or: [
          { emailVerificationTokenExpires: { $lt: new Date() } },
          { passwordResetTokenExpires: { $lt: new Date() } }
        ]
      },
      {
        $unset: {
          emailVerificationToken: 1,
          emailVerificationTokenExpires: 1,
          passwordResetToken: 1,
          passwordResetTokenExpires: 1
        }
      }
    );
  }),
  
  // Archiver anciennes révisions
  archiveRevisions: cron.schedule('0 2 * * 0', async () => {
    const oldDate = new Date();
    oldDate.setMonth(oldDate.getMonth() - 6);
    
    await RevisionHistory.deleteMany({
      createdAt: { $lt: oldDate },
      status: { $ne: 'approved' }
    });
  }),
  
  // Mettre à jour statistiques dénormalisées
  updateStats: cron.schedule('*/15 * * * *', async () => {
    await this.updateCommunityStats();
    await this.updateWordStats();
    await this.updateUserStats();
  })
};
```

## 🔒 Sécurité Base de Données

### Authentification et Autorisation
```javascript
// Création utilisateur applicatif avec permissions restreintes
use oypunu_production

db.createUser({
  user: "oypunu_app",
  pwd: "secure_random_password",
  roles: [
    {
      role: "readWrite",
      db: "oypunu_production"
    }
  ]
})

// Utilisateur lecture seule pour analytics
db.createUser({
  user: "oypunu_analytics",
  pwd: "analytics_password", 
  roles: [
    {
      role: "read",
      db: "oypunu_production"
    }
  ]
})
```

### Audit et Logging
```typescript
// Schema pour audit trail
interface AuditLogSchema {
  _id: ObjectId;
  collection: string;
  operation: 'create' | 'update' | 'delete';
  documentId: ObjectId;
  userId?: ObjectId;
  changes: {
    before: any;
    after: any;
  };
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

// Middleware d'audit automatique
const auditPlugin = function(schema: Schema) {
  schema.post(['save', 'findOneAndUpdate', 'findOneAndDelete'], async function(doc, next) {
    await AuditLog.create({
      collection: this.constructor.modelName,
      operation: this.op || 'save',
      documentId: doc._id,
      userId: this.userId, // Context de l'utilisateur
      changes: {
        before: this.getUpdate ? this.getUpdate() : null,
        after: doc
      },
      timestamp: new Date(),
      ipAddress: this.ipAddress,
      userAgent: this.userAgent
    });
    
    next();
  });
};
```

## 🚧 Backup et Recovery

### Stratégie de Sauvegarde
```bash
#!/bin/bash
# Script de backup automatisé

# Backup quotidien complet
mongodump \
  --uri="mongodb+srv://backup_user:password@cluster.mongodb.net/oypunu_production" \
  --out="/backups/daily/$(date +%Y%m%d)" \
  --gzip

# Backup incrémental (oplog)
mongodump \
  --uri="mongodb+srv://backup_user:password@cluster.mongodb.net/local" \
  --collection=oplog.rs \
  --query='{"ts":{"$gt":{"$timestamp":{"t":LAST_BACKUP_TIMESTAMP,"i":1}}}}' \
  --out="/backups/incremental/$(date +%Y%m%d_%H%M%S)"

# Archivage sur cloud storage
aws s3 sync /backups/ s3://oypunu-database-backups/ --delete
```

### Plan de Recovery
```typescript
// Procédure de restauration
class DatabaseRecovery {
  async restoreFromBackup(backupDate: string, pointInTime?: Date) {
    console.log(`Starting restore from backup: ${backupDate}`);
    
    // 1. Arrêter l'application
    await this.stopApplication();
    
    // 2. Restaurer backup principal
    await this.executeCommand(`
      mongorestore \
        --uri="${MONGODB_URI}" \
        --drop \
        --gzip \
        /backups/daily/${backupDate}
    `);
    
    // 3. Appliquer les oplogs jusqu'au point dans le temps
    if (pointInTime) {
      await this.applyOplogUntil(pointInTime);
    }
    
    // 4. Vérifier l'intégrité
    await this.verifyDataIntegrity();
    
    // 5. Redémarrer l'application
    await this.startApplication();
    
    console.log('Database restore completed successfully');
  }
}
```

---

**Version** : 1.0.0  
**Dernière mise à jour** : 30 Juillet 2025  
**Responsable** : Équipe Infrastructure O'Ypunu