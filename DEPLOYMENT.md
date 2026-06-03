# Guide de déploiement sur Render.com

## 📋 Prérequis

1. Un compte [Render.com](https://render.com) (gratuit)
2. Un repo Git (GitHub, GitLab ou Gitea) avec ce projet
3. Un client Git installé localement

## 🚀 Étapes de déploiement

### Étape 1 : Préparer le repo Git

```bash
# Initialiser le repo si ce n'est pas fait
git init

# Ajouter les fichiers
git add .

# Commit initial
git commit -m "Initial commit - WAPI Server configuration"

# Ajouter l'URL du repo (remplacer par votre URL)
git remote add origin https://github.com/votre-username/navigateur-tp.git

# Envoyer sur GitHub
git push -u origin main
```

### Étape 2 : Créer un service Web sur Render

1. Allez sur [https://dashboard.render.com](https://dashboard.render.com)
2. Connectez-vous avec votre compte
3. Cliquez sur **"New +"** → **"Web Service"**
4. Connectez votre repo GitHub (authoriser Render à accéder à GitHub)
5. Sélectionnez votre repo `navigateur-tp`

### Étape 3 : Configurer le service

**Dans le formulaire de création :**

| Paramètre | Valeur |
|-----------|--------|
| **Name** | `wapi-server` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm run server:prod` |
| **Instance Type** | `Free` |

### Étape 4 : Ajouter les variables d'environnement

1. Scroll down jusqu'à la section **"Environment Variables"**
2. Ajouter :
   - `NODE_ENV` = `production`
   - `CLIENT_URL` = (laissez vide pour le moment)

3. Cliquez sur **"Create Web Service"**

### Étape 5 : Vérifier le déploiement

Render va automatiquement :
1. ✅ Builder l'application (`npm install`)
2. ✅ Lancer le serveur (`npm run server:prod`)
3. ✅ Vous assigner une URL publique (ex: `https://wapi-server-xxxxx.onrender.com`)

Vous verrez les logs de déploiement en temps réel.

## 🔗 Utiliser l'URL du serveur dans Electron

Une fois le serveur actif, l'URL sera affichée sur le dashboard Render (ex: `https://wapi-server-abc123.onrender.com`).

### Modifier le client Electron

**Dans `renderer.js`**, changez l'URL du serveur :

```javascript
// En développement
const API_URL = 'http://localhost:3000';

// En production (utiliser l'URL de Render)
const API_URL = 'https://wapi-server-xxxxx.onrender.com';
```

Ou créer une variable d'environnement pour Electron Builder.

## 🔄 Mises à jour automatiques

Render redéploie automatiquement quand vous poussez du code :

```bash
# Après des modifications
git add .
git commit -m "Update: modifications du serveur"
git push origin main
```

Render détectera le changement et redéploiera automatiquement.

## ⚠️ Points importants

- **Plan gratuit** : Le service s'endort après 15 minutes d'inactivité
- **Cold start** : Le premier appel après l'hibernation peut être lent (5-10s)
- **Persistance des données** : `connections-db.json` sera réinitialisé à chaque redéploiement

### Pour la persistance (optionnel)

Si vous voulez conserver les connexions entre redéploiements, configurez une base de données PostgreSQL sur Render.

## ✅ Tester le serveur

```bash
# Depuis votre terminal
curl https://wapi-server-xxxxx.onrender.com/api/connections

# Ou visitez dans le navigateur
https://wapi-server-xxxxx.onrender.com/admin
```

## 🆘 Dépannage

**Le service ne démarre pas**
- Vérifier les logs Render (onglet "Logs")
- Vérifier que `PORT` est défini via process.env

**CORS errors**
- Vérifier que `CLIENT_URL` est correctement configuré
- Ou ajouter votre domaine Electron à la liste blanche du CORS

**Connection refused**
- S'assurer que le serveur est bien en production (`NODE_ENV=production`)
- Vérifier que le port 3000 est correctement exposé

---

**Besoin d'aide ?** Consultez la [documentation officielle Render](https://render.com/docs)
