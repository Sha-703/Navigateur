// ============================================================
// main.js — Processus principal d'Electron (Backend)
// Ce fichier est le point d'entrée de l'application Electron.
// Il s'exécute côté Node.js et a accès au système d'exploitation.
// ============================================================

// Importation des modules principaux d'Electron :
// - app        : gère le cycle de vie de l'application
// - BrowserWindow : crée et contrôle les fenêtres du navigateur
// - ipcMain    : reçoit les messages envoyés depuis le processus de rendu (renderer.js)
const { app, BrowserWindow, ipcMain, globalShortcut, Menu } = require('electron');

// Module natif Node.js pour construire des chemins de fichiers compatibles OS
const path = require('path');

// Module natif Node.js pour accéder aux informations système (réseau, CPU, etc.)
const os = require('os');

// Variable globale pour stocker la référence à la fenêtre principale
let mainWindow;

// ============================================================
// FONCTION : getNetworkInfo()
// Rôle : Parcourt toutes les interfaces réseau de la machine
//        et retourne la liste des interfaces actives (non-loopback)
//        avec leur adresse IP locale (IPv4) et leur adresse MAC.
// ============================================================
function getNetworkInfo() {
  // os.networkInterfaces() retourne un objet contenant toutes
  // les interfaces réseau (Wi-Fi, Ethernet, loopback, etc.)
  const interfaces = os.networkInterfaces();

  // Tableau qui contiendra les résultats filtrés
  const info = [];

  // On parcourt chaque interface réseau disponible sur la machine
  for (const interfaceName of Object.keys(interfaces)) {
    // Chaque interface peut avoir plusieurs adresses (IPv4, IPv6, etc.)
    for (const net of interfaces[interfaceName]) {
      // On filtre :
      // - net.internal === false : on ignore le loopback (127.0.0.1)
      // - net.family === 'IPv4'  : on garde uniquement les adresses IPv4
      if (!net.internal && net.family === 'IPv4') {
        info.push({
          interface: interfaceName, // Nom de l'interface (ex: "Wi-Fi", "Ethernet")
          ip: net.address,          // ✅ Adresse IP locale (ex: 192.168.1.50)
          mac: net.mac              // ✅ Adresse MAC physique (ex: 00:1A:2B:3C:4D:5E)
        });
      }
    }
  }

  // On retourne la liste de toutes les interfaces actives trouvées
  return info;
}

// ============================================================
// FONCTION : createWindow()
// Rôle : Crée et configure la fenêtre principale de l'application
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,  // Largeur initiale de la fenêtre en pixels
    height: 800,  // Hauteur initiale de la fenêtre en pixels
    icon: path.join(__dirname, 'src', 'icon.png'), // Icône de la fenêtre

    webPreferences: {
      // Chemin vers le script de préchargement (passerelle sécurisée entre main et renderer)
      preload: path.join(__dirname, 'preload.js'),

      // Permet l'utilisation de la balise <webview> dans le HTML
      // (nécessaire pour afficher des sites web dans le navigateur)
      webviewTag: true,

      // contextIsolation: true → sépare le contexte Node.js du contexte web (sécurité)
      contextIsolation: true,

      // nodeIntegration: false → le renderer ne peut pas utiliser Node.js directement (sécurité)
      nodeIntegration: false,
    },

    autoHideMenuBar: true, // Cache la barre de menu native (Fichier, Édition, etc.)
    title: 'WAPI Browser',
  });

  // Charge le fichier HTML principal de l'interface utilisateur
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Décommenter la ligne suivante pour ouvrir les outils de développement (débogage)
  // mainWindow.webContents.openDevTools();
}

// ============================================================
// ÉVÉNEMENT : app.whenReady()
// Se déclenche quand Electron a fini son initialisation
// et que l'application est prête à créer des fenêtres.
// ============================================================
app.whenReady().then(() => {

  // On enregistre un gestionnaire IPC nommé 'get-network-info'.
  // Quand renderer.js appellera window.electronAPI.getNetworkInfo(),
  // cela enverra un message IPC 'get-network-info' ici,
  // et cette fonction retournera les infos réseau de la machine.
  ipcMain.handle('get-network-info', () => {
    return getNetworkInfo();
  });

  // Gestionnaire IPC pour toggler les devtools
  ipcMain.on('toggle-devtools', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Gestionnaire IPC pour afficher le menu contextuel
  ipcMain.on('show-context-menu', () => {
    if (!mainWindow) return;

    const menuTemplate = [
      { label: 'Retour', click: () => mainWindow.webContents.goBack(), enabled: mainWindow.webContents.canGoBack() },
      { label: 'Avancer', click: () => mainWindow.webContents.goForward(), enabled: mainWindow.webContents.canGoForward() },
      { type: 'separator' },
      { label: 'Recharger', click: () => mainWindow.webContents.reload() },
      { type: 'separator' },
      { label: 'Copier', role: 'copy' },
      { label: 'Coller', role: 'paste' },
      { type: 'separator' },
      { label: 'Ouvrir les outils de développement', click: () => mainWindow.webContents.toggleDevTools() }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup({ window: mainWindow });
  });

  // Création de la fenêtre principale
  createWindow();

  // ============================================================
  // RACCOURCIS CLAVIER GLOBAUX - Fallback (si IPC ne fonctionne pas)
  // ============================================================
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  globalShortcut.register('Ctrl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Sur macOS, il est courant de recréer une fenêtre quand on clique
  // sur l'icône du dock alors que toutes les fenêtres sont fermées.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ============================================================
// ÉVÉNEMENT : window-all-closed
// Se déclenche quand toutes les fenêtres sont fermées.
// Sur Windows/Linux → on quitte l'application.
// Sur macOS (darwin) → on laisse l'application active dans le dock.
// ============================================================
app.on('window-all-closed', () => {
  // Désactiver tous les raccourcis globaux
  globalShortcut.unregisterAll();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
