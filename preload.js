// ============================================================
// preload.js — Script de Préchargement (Pont sécurisé)
// Ce fichier est exécuté AVANT le chargement de la page web,
// dans un contexte qui a accès à la fois à Node.js et au DOM.
//
// Son rôle est de servir de PASSERELLE SÉCURISÉE entre :
//   - Le processus principal (main.js) qui a accès au système
//   - Le processus de rendu (renderer.js) qui affiche l'interface
//
// Sans ce pont, renderer.js ne pourrait pas accéder aux infos système.
// ============================================================

// contextBridge : permet d'exposer des APIs de façon sécurisée au renderer
// ipcRenderer   : permet d'envoyer des messages au processus principal (main.js)
const { contextBridge, ipcRenderer } = require('electron');

// On expose un objet "electronAPI" dans le contexte global du renderer (window.electronAPI)
// Grâce à contextBridge, seules les fonctions que l'on liste ici sont accessibles.
// Cela empêche le code web d'avoir un accès non contrôlé à Node.js (sécurité).
contextBridge.exposeInMainWorld('electronAPI', {

  // getNetworkInfo() : envoie un message IPC 'get-network-info' au processus principal
  // main.js reçoit ce message et retourne les infos réseau (IP locale + MAC)
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),

  // toggleDevTools() : envoie un message IPC pour ouvrir/fermer les devtools
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),

  // openContextMenu() : envoie un message IPC pour afficher le menu contextuel
  openContextMenu: () => ipcRenderer.send('show-context-menu'),

  // Permet au renderer d'écouter les actions du menu applicatif
  onAppMenu: (callback) => {
    ipcRenderer.on('app-menu', (event, action) => {
      try { callback(action); } catch (e) { /* ignore */ }
    });
  },

  // Ecoute les événements de progression de téléchargement
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => {
      try { callback(data); } catch (e) { /* ignore */ }
    });
  },

  // Ecoute la fin des téléchargements
  onDownloadDone: (callback) => {
    ipcRenderer.on('download-done', (event, data) => {
      try { callback(data); } catch (e) { /* ignore */ }
    });
  },

  // Ouvrir le dossier d'un téléchargement (path absolu)
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),

  // Afficher le menu contextuel en connaissant l'URL du lien cliqué (si présente)
  showLinkContextMenu: (linkUrl) => ipcRenderer.send('show-link-context-menu', linkUrl || null),

  // Écouter la demande du main process d'ouvrir une URL dans un nouvel onglet
  onOpenInNewTab: (callback) => {
    ipcRenderer.on('open-in-new-tab', (event, url) => {
      try { callback(url); } catch (e) { /* ignore */ }
    });
  },

});
