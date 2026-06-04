# Test Traduction - MyMemory API

## Changements effectués

### 1. **Nouvelle implémentation `translatePageContent()`**
- Utilise l'API **MyMemory** au lieu de Google Translate
- MyMemory est :
  - Gratuit (pas de clé requise)
  - Fiable pour les WebViews isolées
  - Sans restrictions CSP
  
### 2. **Algorithme de traduction**
```javascript
1. Parcourir tous les nœuds de texte du DOM
2. Pour chaque texte < 500 caractères:
   - Appeler l'API MyMemory
   - Remplacer le contenu traduit
3. Définir la langue HTML
4. Afficher le message de succès
```

### 3. **Mapping des langues**
- Conversion des codes langue courts (en, fr, etc.) en codes longs (en-US, fr-FR)
- Requis par l'API MyMemory

### 4. **CSP mis à jour**
- Ajout de `https://api.mymemory.translated.net` aux sources autorisées
- Permet les appels fetch vers l'API

## Comment ça fonctionne

1. Cliquer sur le bouton 🌐
2. Sélectionner une langue
3. Cliquer sur "Traduire la page"
4. La fonction `translatePageContent()` :
   - Injecte un script dans la WebView
   - Le script traduit chaque nœud de texte via MyMemory
   - Affiche un message de confirmation

## Limitations
- Traduction par **nœud de texte** (peut être lente pour très grandes pages)
- MyMemory limité à ~1000 req/jour/IP (gratuit)
- Mieux pour pages < 50KB

## Prochaines améliorations
- Cache local des traductions
- Batch multiple textes par requête
- Option "traduction rapide" (texte visible uniquement)
