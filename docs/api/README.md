# Documentation API - O'Ypunu Backend

## 📚 Vue d'Ensemble

Cette documentation décrit l'API REST complète de la plateforme O'Ypunu, dictionnaire collaboratif des langues africaines.

## 🚀 Démarrage Rapide

### Authentification

Toutes les requêtes authentifiées nécessitent un token JWT dans le header `Authorization` :

```bash
Authorization: Bearer <your-jwt-token>
```

### Obtenir un Token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

## 📖 Documentation Interactive

La documentation Swagger UI est disponible à :
- **Développement** : http://localhost:3000/api-docs
- **Production** : https://api.oypunu.com/api-docs

## 🔗 Endpoints Principaux

### Authentification
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion
- `POST /auth/refresh` - Rafraîchir token
- `GET /auth/verify-email/{token}` - Vérifier email

### Dictionnaire
- `GET /words` - Liste des mots
- `POST /words` - Créer un mot
- `GET /words/{id}` - Détails d'un mot
- `GET /words/search` - Recherche avancée

### Utilisateurs
- `GET /users/profile` - Profil connecté
- `PATCH /users/profile` - Modifier profil
- `GET /users/search` - Rechercher utilisateurs

### Communautés
- `GET /communities` - Liste communautés
- `POST /communities` - Créer communauté
- `POST /communities/{id}/join` - Rejoindre

## 📝 Exemples d'Utilisation

### 1. Inscription et Connexion

```javascript
// Inscription
const registerResponse = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    username: 'myusername',
    password: 'SecurePass123!',
    hasAcceptedTerms: true,
    hasAcceptedPrivacyPolicy: true
  })
});

const { access_token, refresh_token, user } = await registerResponse.json();

// Connexion
const loginResponse = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});
```

### 2. Créer un Mot

```javascript
const createWordResponse = await fetch('/words', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    word: 'mbolo',
    language: 'douala',
    pronunciation: '[m.bo.lo]',
    meanings: [{
      definition: 'Bonjour, salutation amicale',
      partOfSpeech: 'interjection',
      example: 'Mbolo, comment tu vas ?'
    }]
  })
});

const newWord = await createWordResponse.json();
```

### 3. Recherche de Mots

```javascript
// Recherche simple
const searchResponse = await fetch('/words/search?q=bonjour&language=douala&page=1&limit=10');
const searchResults = await searchResponse.json();

// Recherche avec filtres
const filteredSearchResponse = await fetch('/words/search?' + new URLSearchParams({
  q: 'bonjour',
  language: 'douala',
  category: 'salutation',
  page: 1,
  limit: 20
}));
```

### 4. Gestion du Profil

```javascript
// Récupérer le profil
const profileResponse = await fetch('/users/profile', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const profile = await profileResponse.json();

// Mettre à jour le profil
const updateResponse = await fetch('/users/profile', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    bio: 'Passionné de langues africaines',
    location: 'Douala, Cameroun',
    isProfilePublic: true
  })
});
```

## 🔄 Gestion des Erreurs

L'API retourne des erreurs au format JSON standard :

```json
{
  "error": "BadRequest",
  "message": "Le champ 'word' est requis",
  "statusCode": 400,
  "timestamp": "2025-07-30T12:00:00.000Z"
}
```

### Codes d'Erreur Courants

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Requête invalide | Vérifier les données envoyées |
| 401 | Non authentifié | Inclure un token valide |
| 403 | Permissions insuffisantes | Vérifier le rôle utilisateur |
| 404 | Ressource non trouvée | Vérifier l'ID/URL |
| 429 | Trop de requêtes | Respecter les limites de taux |

## 📊 Rate Limiting

### Limites par Type d'Endpoint

| Type | Limite | Fenêtre |
|------|--------|---------|
| Authentification | 10 requêtes | 5 minutes |
| Endpoints publics | 100 requêtes | 1 minute |
| Endpoints authentifiés | 1000 requêtes | 1 minute |
| Upload de fichiers | 5 requêtes | 1 minute |
| Administration | 50 requêtes | 1 minute |

### Headers de Rate Limiting

Les réponses incluent des headers informatifs :

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627392000
```

## 🔐 Sécurité

### Bonnes Pratiques

1. **Tokens JWT** : Stocker de manière sécurisée (jamais en localStorage)
2. **HTTPS** : Toujours utiliser en production
3. **Refresh Tokens** : Renouveler régulièrement les tokens d'accès
4. **Validation** : Valider toutes les entrées côté client aussi

### Authentification avec Refresh Token

```javascript
// Fonction pour rafraîchir le token automatiquement
async function refreshTokenIfNeeded() {
  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token })
    });
    
    if (response.ok) {
      const { access_token, refresh_token: newRefreshToken } = await response.json();
      // Mettre à jour les tokens stockés
      updateStoredTokens(access_token, newRefreshToken);
      return access_token;
    }
  } catch (error) {
    // Rediriger vers la page de connexion
    redirectToLogin();
  }
}
```

## 📱 Exemples SDK/Client

### JavaScript/TypeScript

```typescript
class OYpunuAPI {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    this.accessToken = data.access_token;
    return data;
  }

  async getWords(params: { page?: number, limit?: number, language?: string } = {}) {
    const query = new URLSearchParams(params as any).toString();
    const response = await fetch(`${this.baseURL}/words?${query}`);
    return response.json();
  }

  async createWord(wordData: CreateWordDto) {
    const response = await fetch(`${this.baseURL}/words`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify(wordData)
    });
    return response.json();
  }
}

// Usage
const api = new OYpunuAPI('http://localhost:3000');
await api.login('user@example.com', 'password');
const words = await api.getWords({ language: 'douala', limit: 20 });
```

### Python

```python
import requests
from typing import Optional, Dict, Any

class OYpunuAPI:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.session = requests.Session()

    def login(self, email: str, password: str) -> Dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data["access_token"]
        self.session.headers.update({
            "Authorization": f"Bearer {self.access_token}"
        })
        return data

    def get_words(self, page: int = 1, limit: int = 10, language: str = None) -> Dict[str, Any]:
        params = {"page": page, "limit": limit}
        if language:
            params["language"] = language
        
        response = self.session.get(f"{self.base_url}/words", params=params)
        response.raise_for_status()
        return response.json()

    def create_word(self, word_data: Dict[str, Any]) -> Dict[str, Any]:
        response = self.session.post(f"{self.base_url}/words", json=word_data)
        response.raise_for_status()  
        return response.json()

# Usage
api = OYpunuAPI("http://localhost:3000")
api.login("user@example.com", "password")
words = api.get_words(language="douala", limit=20)
```

## 🧪 Tests et Validation

### Test avec cURL

```bash
# Test d'inscription
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "Test123!",
    "hasAcceptedTerms": true,
    "hasAcceptedPrivacyPolicy": true
  }'

# Test de création de mot
curl -X POST http://localhost:3000/words \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "word": "test",
    "language": "fr",
    "meanings": [{
      "definition": "Essai, vérification",
      "partOfSpeech": "noun"
    }]
  }'
```

### Test avec Postman

1. Importer la collection Postman depuis `/docs/api/postman-collection.json`
2. Configurer les variables d'environnement :
   - `base_url` : URL de l'API
   - `access_token` : Token JWT
3. Exécuter les tests automatisés

## 📋 Collection Postman

Une collection Postman complète est disponible avec tous les endpoints testés :

```json
{
  "info": {
    "name": "O'Ypunu API",
    "description": "Collection complète pour tester l'API O'Ypunu"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "access_token",
      "value": ""
    }
  ]
}
```

## 🐛 Debug et Troubleshooting

### Logs d'API

En mode développement, les logs détaillés sont disponibles dans la console :

```bash
# Démarrer avec logs debug
npm run start:dev

# Logs avec niveau spécifique
DEBUG=api:* npm run start:dev
```

### Erreurs Communes

| Problème | Cause | Solution |
|----------|-------|----------|
| Token expiré | JWT expiré | Utiliser refresh token |
| 422 Validation | Données invalides | Vérifier le schéma |
| 500 Erreur serveur | Bug ou config | Vérifier les logs |
| CORS | Origine non autorisée | Configurer CORS |

## 📈 Monitoring et Métriques

### Endpoints de Health Check

```bash
# Status de l'API
GET /health

# Métriques Prometheus
GET /metrics

# Status base de données
GET /health/database
```

### Réponse Health Check

```json
{
  "status": "ok",
  "timestamp": "2025-07-30T12:00:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "email": "healthy"
  }
}
```

## 🔄 Versions de l'API

### Versioning

L'API utilise le versioning par URL :
- `v1` : Version stable actuelle
- `v2` : Version en développement (bêta)

### Migration entre Versions

Lors des changements majeurs, un guide de migration sera fourni :

```bash
# Version actuelle
GET /v1/words

# Nouvelle version  
GET /v2/words
```

## 🎯 Roadmap API

### Version 1.1 (Q3 2025)
- [ ] WebSocket pour temps réel
- [ ] GraphQL endpoint
- [ ] Bulk operations
- [ ] Webhooks

### Version 2.0 (Q4 2025) 
- [ ] Breaking changes
- [ ] Nouvelle architecture auth
- [ ] Amélioration performances
- [ ] Support multitenancy

---

**Documentation maintenue par** : Équipe Backend O'Ypunu  
**Dernière mise à jour** : 30 Juillet 2025  
**Version API** : 1.0.0