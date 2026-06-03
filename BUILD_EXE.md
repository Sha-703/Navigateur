# Guide de build - Générer l'EXE Windows

## 📦 Configuration complète

La configuration electron-builder est maintenant définie dans `package.json`. Elle va générer :
- **Installateur NSIS** (.exe installer classique)
- **Portable EXE** (single executable, no install needed)

## 🚀 Générer l'EXE

### Étape 1 : Préparer l'icône (optionnel mais recommandé)

Placez une icône `icon.ico` dans le dossier `assets/` :

```bash
# Télécharger ou créer une icône PNG (512x512 pixels)
# Convertir en .ico:
# - Utiliser https://icoconvert.com/
# - Ou utiliser ImageMagick: convert icon.png assets/icon.ico
```

Sans icône, electron-builder utilisera l'icône par défaut.

### Étape 2 : Générer l'installateur + portable

```bash
npm run build:win
```

**Cela génère dans le dossier `dist/` :**
- `WAPI Browser Setup 1.0.0.exe` — Installateur classique
- `WAPI Browser 1.0.0.exe` — Portable (pas d'installation)

### Étape 3 (Optionnel) : Générer uniquement le portable

```bash
npm run build:win-portable
```

Génère juste l'EXE portable sans installateur.

## 📁 Résultat final

```
dist/
├── WAPI Browser Setup 1.0.0.exe    ← Installateur (recommandé pour distribution)
├── WAPI Browser 1.0.0.exe           ← Portable (exécutable direct)
└── builder-effective-config.yaml    ← Config utilisée
```

## 📊 Configuration détails

| Élément | Description |
|---------|-------------|
| **appId** | `com.wapi-navigateur.app` - ID unique de l'app |
| **productName** | `WAPI Browser` - Nom affiché |
| **target** | NSIS + Portable pour Windows |
| **icon** | `assets/icon.ico` - Icône de l'app |
| **output** | `dist/` - Dossier de destination |

## 🔧 Dépannage

**L'icône n'apparaît pas**
- Vérifier que `assets/icon.ico` existe
- Format doit être `.ico` (pas PNG)
- Taille minimum 512x512 pixels

**Erreur "Cannot find module"**
```bash
npm install
npm run build:win
```

**Build stuck ou très lent**
- Augmentez la RAM temporaire
- Vérifiez que l'antivirus ne bloque pas

## ✅ Distribuer l'EXE

Une fois généré, vous pouvez :

1. **Partager l'installateur** : `WAPI Browser Setup 1.0.0.exe`
   - Double-clic → installation standard Windows
   - Créera un raccourci Desktop + Start Menu
   - Serveur Render intégré automatiquement

2. **Ou partager l'EXE portable** : `WAPI Browser 1.0.0.exe`
   - Double-clic direct → lance l'app
   - Pas d'installation requise
   - Peut être mis sur clé USB

## 📝 Notes importantes

- **Serveur Render** : L'EXE utilisera automatiquement `https://server-navigateur.onrender.com`
- **Offline** : L'app peut afficher des pages localement, mais les connexions réseau seront envoyées au serveur
- **Mises à jour** : Pour mettre à jour l'app, régénérez l'EXE et redistribuez

## 🔄 Workflow de mise à jour

```bash
# 1. Faire des changements
# ... modifiez vos fichiers ...

# 2. Commit et push
git add .
git commit -m "Update: nouvelles fonctionnalités"
git push

# 3. Régénérer l'EXE
npm run build:win

# 4. Distribuer le nouveau dist/WAPI Browser Setup 1.0.0.exe
```

---

**Besoin d'aide pour créer l'icône ?** Consultez [icoconvert.com](https://icoconvert.com/) ou utilisez un logo que vous avez.
