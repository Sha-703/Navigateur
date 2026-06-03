# Assets pour WAPI Browser

## Icône de l'application

L'application a besoin d'une icône au format `.ico` pour Windows.

### Option 1: Créer votre propre icône
1. Créez une image (512x512 pixels minimum) en PNG
2. Convertissez-la en ICO using:
   - [icoconvert.com](https://icoconvert.com/) (online)
   - ImageMagick: `convert image.png icon.ico`
   - Python: `from PIL import Image; Image.open('image.png').save('icon.ico')`

3. Placez le fichier `icon.ico` dans ce dossier

### Option 2: Utiliser une icône générique
Une icône placeholder sera utilisée si `icon.ico` n'existe pas.

### Fichiers requis
- `icon.ico` - Icône Windows (512x512 minimum, format .ico)

**Note**: Sans icône, electron-builder utilisera l'icône par défaut d'Electron.
