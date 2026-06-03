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
  openContextMenu: () => ipcRenderer.send('show-context-menu')

});
