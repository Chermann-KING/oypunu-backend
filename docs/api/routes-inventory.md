# O'Ypunu Backend — Inventaire des routes (source: OpenAPI)

Note: Le serveur local est http://localhost:3000 avec le préfixe global `/api`. Les serveurs prod/staging documentés utilisent `/v1`.

## Authentification
- POST /auth/register — Inscription
- POST /auth/login — Connexion
- POST /auth/refresh — Rafraîchir l’accès (body: refresh_token)
- POST /auth/logout — Déconnexion (body: refresh_token)
- GET  /auth/verify-email/{token} — Vérification email

## Utilisateurs
- GET  /users/profile — Profil utilisateur courant
- PATCH /users/profile — Mettre à jour le profil courant
- GET  /users/search?search= — Rechercher des utilisateurs
- GET  /users/{username} — Profil public par username

## Dictionnaire (Words)
- GET    /words — Liste paginée (query: page, limit, status, language)
- POST   /words — Créer un mot (CONTRIBUTOR+)
- GET    /words/search?q=&language=&category=&page=&limit= — Recherche avancée
- GET    /words/featured?limit= — Mots mis en avant
- GET    /words/{id} — Détails d’un mot
- PATCH  /words/{id} — Modifier un mot (créateur/admin)
- DELETE /words/{id} — Supprimer un mot (créateur/admin)
- POST   /words/{id}/favorite — Ajouter aux favoris (USER+)
- DELETE /words/{id}/favorite — Retirer des favoris (USER+)

## Langues
- GET /languages — Liste des langues

## Communautés
- GET  /communities?language=&type=&page=&limit= — Liste des communautés
- POST /communities — Créer une communauté
- GET  /communities/{id} — Détails d’une communauté
- POST /communities/{id}/join — Rejoindre une communauté

## Analytics (Admin)
- GET /analytics/dashboard — Métriques globales
- GET /analytics/users?period= — Métriques utilisateurs

—

Remarques d’alignement client:
- Préfixe global: côté runtime Nest, les routes sont sous `/api/*`.
- Prod/Staging: les URLs documentées incluent `/v1` (ex: https://api.oypunu.com/v1). 
  En local, pas de `/v1` (http://localhost:3000), mais le préfixe `/api` reste actif.