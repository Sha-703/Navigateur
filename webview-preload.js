// webview-preload.js — préchargé dans chaque page chargée par le webview
const { ipcRenderer } = require('electron');

window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  ipcRenderer.sendToHost('show-context-menu');
});