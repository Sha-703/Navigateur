// ============================================================
// main.js — Processus principal d'Electron (Backend)
// Ce fichier est le point d'entrée de l'application Electron.
// Il s'exécute côté Node.js et a accès au système d'exploitation.
// ============================================================

// Importation des modules principaux d'Electron :
// - app        : gère le cycle de vie de l'application
// - BrowserWindow : crée et contrôle les fenêtres du navigateur
// - ipcMain    : reçoit les messages envoyés depuis le processus de rendu (renderer.js)
const { app, BrowserWindow, ipcMain, globalShortcut, Menu, session, shell } = require('electron');

// Module natif Node.js pour construire des chemins de fichiers compatibles OS
const path = require('path');

// Module natif Node.js pour accéder aux informations système (réseau, CPU, etc.)
const os = require('os');

// Variable globale pour stocker la référence à la fenêtre principale
let mainWindow;

// ============================================================
// FILTRE CONSOLE : Supprimer les erreurs ERR_ABORTED non-essentielles
// Ces erreurs sont normales lors de navigations rapides dans la WebView.
// ============================================================
const originalError = console.error;
console.error = function(...args) {
  try {
    const message = String(args.join(' ')).trim();
    // Ignorer les messages GUEST_VIEW_MANAGER_CALL contenant ERR_ABORTED
    if (message && message.includes('GUEST_VIEW_MANAGER_CALL') && message.includes('ERR_ABORTED')) {
      return; // Supprimer le message
    }
  } catch (e) {
    // En cas d'erreur dans le filtre, continuer normalement
  }
  // Afficher les autres erreurs normalement
  originalError.apply(console, args);
};

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

  // Supprimer les messages de console contenant 'ERR_ABORTED' (navigation interrompue)
  mainWindow.webContents.on('console-message', (level, message, line, sourceId) => {
    // Vérifier que message est une string avant d'appeler .includes()
    if (!message || typeof message !== 'string') {
      return;
    }
    
    if (message.includes('ERR_ABORTED') || message.includes('GUEST_VIEW_MANAGER_CALL')) {
      return; // Ignorer ce message
    }
    // Afficher les autres messages normalement
    if (level === 0) console.log(`[RENDERER] ${message}`);
    else if (level === 1) console.warn(`[RENDERER] ${message}`);
    else if (level === 2) console.error(`[RENDERER] ${message}`);
  });

  // Suppression des erreurs non-capturées du processus principal
  mainWindow.webContents.on('crashed', () => {
    // App a crashé
  });

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

  // Application Menu (Barre de menu)
  const menuTemplate = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Nouvel onglet', click: () => mainWindow.webContents.send('app-menu', 'new-tab') },
        { label: 'Nouvelle fenêtre', click: () => createWindow() },
        { type: 'separator' },
        { label: 'Paramètres', click: () => mainWindow.webContents.send('app-menu', 'open-settings') },
        { type: 'separator' },
        { label: 'Quitter', role: 'quit' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Recharger', click: () => mainWindow.webContents.reload() },
        { label: 'Basculer les outils de développement', click: () => mainWindow.webContents.toggleDevTools() },
      ]
    },
    {
      label: 'Outils',
      submenu: [
        { label: 'Téléchargements', click: () => mainWindow.webContents.send('app-menu', 'show-downloads') },
        { label: 'Profils', click: () => mainWindow.webContents.send('app-menu', 'manage-profiles') }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        { label: 'À propos', click: () => mainWindow.webContents.send('app-menu', 'about') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

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

  // ------------------------------------------------------------
  // Gestionnaire global des téléchargements (will-download)
  // Ecoute la session par défaut et transmet les mises à jour
  // au renderer via IPC 'download-progress' et 'download-done'.
  // ------------------------------------------------------------
  const downloadsFolder = app.getPath('downloads');
  session.defaultSession.on('will-download', (event, item, webContents) => {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const filename = item.getFilename();
      const totalBytes = item.getTotalBytes();
      const savePath = path.join(downloadsFolder, filename);

      // Autoriser chemin de sauvegarde par défaut
      item.setSavePath(savePath);

      // Notifier le renderer qu'un téléchargement commence
      if (mainWindow) {
        mainWindow.webContents.send('download-progress', { id, filename, percent: 0, state: 'started', path: savePath });
      }

      item.on('updated', (e, state) => {
        if (state === 'progressing') {
          const received = item.getReceivedBytes();
          const percent = totalBytes > 0 ? Math.round((received / totalBytes) * 100) : 0;
          if (mainWindow) mainWindow.webContents.send('download-progress', { id, filename, percent, state: 'progressing', path: savePath });
        } else if (state === 'interrupted') {
          if (mainWindow) mainWindow.webContents.send('download-progress', { id, filename, percent: 0, state: 'interrupted', path: savePath });
        }
      });

      item.once('done', (e, state) => {
        if (mainWindow) mainWindow.webContents.send('download-done', { id, filename, state, path: savePath });
      });

    } catch (err) {
      console.error('Erreur will-download:', err);
    }
  });

  // Handler pour ouvrir un fichier/dossier depuis le renderer
  ipcMain.handle('open-path', (event, targetPath) => {
    try {
      if (targetPath) shell.showItemInFolder(targetPath);
      return true;
    } catch (err) {
      console.error('open-path error', err);
      return false;
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

// ============================================================
// SUPPRESSION DES ERREURS ERR_ABORTED NON-CAPTURÉES
// Ces erreurs sont normales lors de navigations rapides.
// ============================================================
process.on('uncaughtException', (error) => {
  // Supprimer les messages ERR_ABORTED (navigation interrompue)
  if (error.code === 'ERR_ABORTED' || (error.message && error.message.includes('ERR_ABORTED'))) {
    return; // Ignorer l'erreur
  }
  
  // Logger les autres erreurs
  console.error('[MAIN] Uncaught Exception:', error);
});
