# 🔴 ROTATION CREDENTIALS - SÉCURITÉ CRITIQUE

## ⚠️ ALERTE SÉCURITÉ
Des credentials de production ont été exposés dans le fichier `.env` et doivent être **immédiatement** rotés.

## 🚨 CREDENTIALS EXPOSÉS IDENTIFIÉS

### 1. JWT Secret
- **Ancien**: `23CodeSMILING#O'Ypunu@2025`
- **Status**: ❌ COMPROMIS - Rotation obligatoire

### 2. MongoDB Credentials
- **Ancien utilisateur**: `codessmiling`
- **Ancien mot de passe**: `sXyRW3IbxeWLgjTV`
- **Status**: ❌ COMPROMIS - Rotation obligatoire

### 3. Email Password
- **Ancien email**: `codes.smiling@gmail.com`
- **Ancien password**: `ocjutdxjccngufhh`
- **Status**: ❌ COMPROMIS - Rotation obligatoire

### 4. Cloudinary API Secret
- **Ancien cloud name**: `dupo9riqb`
- **Ancien API secret**: `RVK1dY0cTaMovbVaIlifO2So95g`
- **Status**: ❌ COMPROMIS - Rotation obligatoire

## 🔧 ACTIONS REQUISES IMMÉDIATEMENT

### 1. MongoDB Atlas
1. Connectez-vous à MongoDB Atlas
2. Créez un nouvel utilisateur de base de données
3. Supprimez l'ancien utilisateur `codessmiling`
4. Mettez à jour `MONGODB_URI` dans `.env`

### 2. JWT Secret
1. Générez un nouveau secret (minimum 32 caractères)
```bash
# Exemple de génération sécurisée
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
2. Mettez à jour `JWT_SECRET` dans `.env`
3. **IMPORTANT**: Tous les tokens JWT existants seront invalidés

### 3. Gmail App Password
1. Connectez-vous à votre compte Google
2. Allez dans "Sécurité" > "Mots de passe d'application"
3. Révoque l'ancien mot de passe d'application
4. Générez un nouveau mot de passe d'application
5. Mettez à jour `MAIL_PASSWORD` dans `.env`

### 4. Cloudinary
1. Connectez-vous à Cloudinary
2. Allez dans "Settings" > "Security"
3. Rotez votre API Secret
4. Mettez à jour les variables Cloudinary dans `.env`

## 📋 CHECKLIST DE SÉCURITÉ

- [ ] MongoDB : Nouvel utilisateur créé et ancien supprimé
- [ ] JWT : Nouveau secret généré (32+ caractères)
- [ ] Email : Nouveau mot de passe d'application généré
- [ ] Cloudinary : API Secret roté
- [ ] `.env` : Toutes les valeurs mises à jour
- [ ] Tests : Vérification du bon fonctionnement
- [ ] Production : Mise à jour des variables d'environnement

## 🔒 BONNES PRATIQUES POST-ROTATION

1. **Ne jamais committer le fichier `.env`** (déjà dans .gitignore)
2. **Utiliser des variables d'environnement** en production
3. **Rotation régulière** des credentials (tous les 90 jours)
4. **Monitoring** des accès non autorisés
5. **Audit logs** pour traquer l'utilisation des credentials

## ⚡ IMPACT ATTENDU

- ✅ Sécurité rétablie
- ⚠️ Redémarrage nécessaire de l'application
- ⚠️ Reconnexion requise pour tous les utilisateurs (JWT)
- ⚠️ Tests fonctionnels à relancer

**Date de rotation**: ${new Date().toISOString()}
**Priorité**: CRITIQUE
**Temps estimé**: 2-4 heures