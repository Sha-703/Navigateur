// webview-preload.js — préchargé dans chaque page chargée par le webview
const { ipcRenderer } = require('electron');

window.addEventListener('contextmenu', (event) => {
  event.preventDefault();

  // Remonter le DOM depuis l'élément cliqué pour trouver un lien <a>
  let linkUrl = null;
  let node = event.target;
  while (node && node !== document.body) {
    if (node.tagName === 'A' && node.href) {
      linkUrl = node.href;
      break;
    }
    node = node.parentElement;
  }

  // Envoyer le type de contexte et l'URL du lien au renderer
  ipcRenderer.sendToHost('show-context-menu', { linkUrl });
});

// ============================================================
// PASSWORD MANAGER: Détection des formulaires de connexion
// ============================================================

// Détecter les formulaires avec champs password
document.addEventListener('submit', (event) => {
  const form = event.target;
  const passwordInput = form.querySelector('input[type="password"]');
  const emailInput = form.querySelector('input[type="email"], input[name*="email" i], input[name*="user" i]');
  const usernameInput = form.querySelector('input[type="text"][name*="user" i], input[name*="login" i]');
  
  if (passwordInput) {
    const email = emailInput?.value;
    const username = usernameInput?.value || emailInput?.value;
    const password = passwordInput.value;
    const url = window.location.href;
    
    if ((email || username) && password) {
      ipcRenderer.sendToHost('password-form-submitted', {
        username: username || email,
        email: email || null,
        password: password,
        url: url,
        domain: new URL(url).hostname
      });
    }
  }
}, true);

// Détecter les clics sur champs password pour offrir des suggestions
document.addEventListener('focus', (event) => {
  if (event.target.type === 'password') {
    const isNewPasswordField = event.target.name?.toLowerCase().includes('new') || 
                              event.target.placeholder?.toLowerCase().includes('new') ||
                              event.target.name?.toLowerCase().includes('confirm') ||
                              event.target.placeholder?.toLowerCase().includes('confirm');
    
    if (isNewPasswordField) {
      ipcRenderer.sendToHost('password-creation-detected', {
        url: window.location.href,
        domain: new URL(window.location.href).hostname
      });
    }
  }
}, true);


