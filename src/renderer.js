// ============================================================
// Configuration du serveur API
// Développement : http://localhost:3000
// Production (Render) : https://server-navigateur.onrender.com
// ============================================================
const API_SERVER_URL = 'https://server-navigateur.onrender.com';

// Debug control : activable via `localStorage.setItem('wapi_debug','true')`
const APP_DEBUG = (() => {
  try {
    return localStorage.getItem('wapi_debug') === 'true' || location.hostname === 'localhost';
  } catch (e) {
    return false;
  }
})();

function debugLog(...args) { if (APP_DEBUG) console.log(...args); }
function debugWarn(...args) { if (APP_DEBUG) console.warn(...args); }
function debugInfo(...args) { if (APP_DEBUG) console.info(...args); }

const webviewContainer = document.querySelector('.webview-container');
const addressForm = document.getElementById('address-form');
const addressInput = document.getElementById('address-input');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');
const statusText = document.getElementById('status-text');

const networkPanel = document.getElementById('network-panel');
const closePanelBtn = document.getElementById('close-panel-btn');
const publicIpEl = document.getElementById('public-ip');
const localInterfacesContainer = document.getElementById('local-interfaces-container');

const quickIpEl = document.getElementById('quick-ip');
const quickMacEl = document.getElementById('quick-mac');

const homePage = document.getElementById('home-page');
const homeSearchForm = document.getElementById('home-search-form');
const homeSearchInput = document.getElementById('home-search-input');
const engineSelect = document.getElementById('engine-select');
const tabsContainer = document.getElementById('tabs');
const newTabBtn = document.getElementById('new-tab-btn');

const translationPanel = document.getElementById('translation-panel');
const closeTranslationBtn = document.getElementById('close-translation-btn');
const targetLanguageSelect = document.getElementById('target-language');
const applyTranslationBtn = document.getElementById('apply-translation-btn');
const resetTranslationBtn = document.getElementById('reset-translation-btn');
const translationStatus = document.getElementById('translation-status');

const historyPanel = document.getElementById('history-panel');
const closeHistoryBtn = document.getElementById('close-history-btn');
const historyList = document.getElementById('history-list');
const historySearch = document.getElementById('history-search');
const clearHistoryBtn = document.getElementById('clear-history-btn');

const bookmarksPanel = document.getElementById('bookmarks-panel');
const closeBookmarksBtn = document.getElementById('close-bookmarks-btn');
const bookmarksList = document.getElementById('bookmarks-list');
const bookmarksSearch = document.getElementById('bookmarks-search');
const addBookmarkBtn = document.getElementById('add-current-bookmark-btn');

const passwordPanel = document.getElementById('password-panel');
const closePasswordBtn = document.getElementById('close-password-btn');
const passwordsList = document.getElementById('passwords-list');
const passwordsSearch = document.getElementById('passwords-search');
const passwordBtn = document.getElementById('password-btn');

const passwordSavePrompt = document.getElementById('password-save-prompt');
const closePromptBtn = document.getElementById('close-prompt-btn');
const savePasswordBtn = document.getElementById('save-password-btn');
const notNowPasswordBtn = document.getElementById('not-now-password-btn');
const passwordPromptDomain = document.getElementById('password-prompt-domain');

const passwordSuggestionPanel = document.getElementById('password-suggestion-panel');
const closeSuggestionBtn = document.getElementById('close-suggestion-btn');
const useSuggestedPasswordBtn = document.getElementById('use-suggested-password-btn');
const regeneratePasswordBtn = document.getElementById('regenerate-password-btn');
const closeSuggestionPromptBtn = document.getElementById('close-suggestion-prompt-btn');
const suggestedPasswordDisplay = document.getElementById('suggested-password-display');

const loginBtn = document.getElementById('login-btn');
const profileMenu = document.getElementById('profile-menu');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileAvatar = document.getElementById('profile-avatar');
const loginGoogleBtn = document.getElementById('login-google-btn');
const logoutBtn = document.getElementById('logout-btn');
const syncNowBtn = document.getElementById('sync-now-btn');
const viewProfileBtn = document.getElementById('view-profile-btn');

const menuHistoryBtn = document.getElementById('menu-history-btn');
const menuBookmarkBtn = document.getElementById('menu-bookmark-btn');
const menuDownloadsBtn = document.getElementById('menu-downloads-btn');
const menuPasswordBtn = document.getElementById('menu-password-btn');
const menuTranslateBtn = document.getElementById('menu-translate-btn');

let tabs = [];
let currentTranslationLanguage = 'fr';
const translationCache = {};
let activeTabId = null;
let history = [];
let bookmarks = [];
let passwords = [];
let pendingPassword = null;
let suggestedPassword = null;
let currentUser = null;

function makeTabId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTabTitle(url) {
  if (!url) return 'Nouvel onglet';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '') + (parsed.pathname === '/' ? '' : parsed.pathname);
  } catch {
    return url.length > 20 ? url.slice(0, 20) + '…' : url;
  }
}

function renderTabs() {
  const tabButtons = document.querySelectorAll('.tab');
  
  // Si le nombre de boutons a changé, reconstruire complètement
  if (tabButtons.length !== tabs.length) {
    tabsContainer.innerHTML = '';
    tabs.forEach((tab) => {
      const button = document.createElement('button');
      button.className = `tab${tab.id === activeTabId ? ' active' : ''}`;
      button.dataset.id = tab.id;
      button.innerHTML = `
        <span class="tab-title">${tab.title}</span>
        <span class="tab-close" data-close="${tab.id}">&times;</span>
      `;
      tabsContainer.appendChild(button);
    });
  } else {
    // Sinon, mettre à jour la classe active et les titres
    tabButtons.forEach((btn) => {
      const tabId = btn.dataset.id;
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        const titleEl = btn.querySelector('.tab-title');
        if (titleEl && titleEl.textContent !== tab.title) {
          titleEl.textContent = tab.title;
        }
      }
      if (tabId === activeTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function setActiveTab(tabId) {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) return;
  
  const prevTabId = activeTabId;
  
  // Éviter les changements inutiles si l'onglet est déjà actif
  if (activeTabId === tabId) return;
  
  activeTabId = tabId;
  
  // Rendus UI rapidement
  requestAnimationFrame(() => {
    renderTabs();
  });
  
  // Masquer la WebView de l'onglet précédent
  if (prevTabId) {
    const prevTab = tabs.find((item) => item.id === prevTabId);
    if (prevTab && prevTab.element) {
      prevTab.element.classList.add('hidden');
    }
  }
  
  if (!tab.url) {
    // Si pas d'URL, on affiche la page d'accueil et on masque la WebView actuelle
    if (tab.element) {
      tab.element.classList.add('hidden');
    }
    homePage.classList.remove('hidden');
    addressInput.value = '';
    homeSearchInput.value = ''; // Réinitialiser le champ de recherche de la page d'accueil
    statusText.textContent = 'Prêt';
  } else {
    homePage.classList.add('hidden');
    
    // Afficher la WebView du nouvel onglet
    if (tab.element) {
      tab.element.classList.remove('hidden');
      if (tab.element.src !== tab.url) {
        tab.element.src = tab.url;
      }
    }
    addressInput.value = tab.url;
    statusText.textContent = 'Prêt';
  }
}

function createNewTab(url = '') {
  const tabId = makeTabId();
  const tab = {
    id: tabId,
    title: getTabTitle(url),
    url,
    element: null
  };
  
  // Création dynamique de la balise <webview>
  const webView = document.createElement('webview');
  webView.id = `webview-${tabId}`;
  webView.className = 'tab-webview hidden';
  webView.setAttribute('preload', '../webview-preload.js');
  
  // Configuration des écouteurs d'événements pour cette WebView
  webView.addEventListener('did-start-loading', () => {
    if (activeTabId === tabId) {
      statusText.textContent = 'Chargement...';
    }
  });
  
  webView.addEventListener('did-finish-load', () => {
    const currentUrl = webView.getURL();
    tab.url = currentUrl;
    tab.title = getTabTitle(currentUrl);
    renderTabs();
    
    if (activeTabId === tabId) {
      statusText.textContent = 'Prêt';
      addressInput.value = currentUrl;
      addToHistory(currentUrl, tab.title);
      sendUrlToServer(currentUrl).catch(err => debugWarn('[WAPI][URL] Erreur:', err));
    }
  });
  
  webView.addEventListener('did-navigate', (e) => {
    const currentUrl = e.url || webView.getURL();
    tab.url = currentUrl;
    tab.title = getTabTitle(currentUrl);
    renderTabs();
    if (activeTabId === tabId) {
      addressInput.value = currentUrl;
    }
  });
  
  webView.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3 || (e.errorDescription && e.errorDescription.includes('ERR_ABORTED'))) {
      debugWarn('[WEBVIEW] Navigation abortée (ignorer) :', e.url, e.errorDescription);
      return;
    }
    if (activeTabId === tabId) {
      statusText.textContent = `Erreur de chargement: ${e.errorDescription}`;
    }
    console.error('[WEBVIEW] failed to load', e);
  });
  
  webView.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.electronAPI.openContextMenu();
  });
  
  webView.addEventListener('ipc-message', (event) => {
    if (event.channel === 'show-context-menu') {
      window.electronAPI.openContextMenu();
    } else if (event.channel === 'password-form-submitted') {
      const data = event.args[0];
      pendingPassword = data;
      passwordPromptDomain.textContent = `Enregistrer le mot de passe pour ${data.domain} (${data.username}) ?`;
      passwordSavePrompt.classList.remove('hidden');
      debugLog('[PASSWORDS] Form soumis:', data.domain);
    } else if (event.channel === 'password-creation-detected') {
      const data = event.args[0];
      suggestedPassword = generateStrongPassword();
      suggestedPasswordDisplay.textContent = suggestedPassword;
      passwordSuggestionPanel.classList.remove('hidden');
      debugLog('[PASSWORDS] Création détectée:', data.domain);
    }
  });
  
  webView.addEventListener('new-window', (e) => {
    e.preventDefault();
    if (e.url) {
      createNewTab(e.url);
    }
  });
  
  webView.addEventListener('page-title-updated', (e) => {
    if (e.title) {
      tab.title = e.title;
      renderTabs();
    }
  });
  
  // Flag pour ignorer les événements will-navigate déclenchés par notre propre loadURL de restauration
  let isRestoringUrl = false;

  webView.addEventListener('will-navigate', (e) => {
    // Ignorer si c'est nous qui restaurons l'URL
    if (isRestoringUrl) return;

    const currentUrl = webView.getURL();
    if (currentUrl && currentUrl !== 'about:blank' && e.url) {
      // Comparaison sans les ancres (#) pour éviter d'ouvrir un onglet lors du défilement interne
      const currentBase = currentUrl.split('#')[0];
      const targetBase = e.url.split('#')[0];
      if (currentBase !== targetBase) {
        e.preventDefault();
        // Arrêter immédiatement toute navigation en cours
        try { webView.stop(); } catch (err) { /* ignore */ }
        // Restaurer l'URL de l'onglet courant
        isRestoringUrl = true;
        try {
          webView.loadURL(currentUrl);
        } catch (err) {
          debugWarn('[WEBVIEW] Impossible de restaurer l\'URL:', err);
        } finally {
          setTimeout(() => { isRestoringUrl = false; }, 500);
        }
        // Ouvrir le lien cliqué dans un nouvel onglet
        createNewTab(e.url);
      }
    }
  });
  
  webviewContainer.appendChild(webView);
  tab.element = webView;
  
  if (url) {
    webView.src = url;
  }
  
  tabs.push(tab);
  setActiveTab(tabId);
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;
  const tab = tabs[index];
  
  // Retirer l'élément webview du DOM
  if (tab.element) {
    tab.element.remove();
  }
  
  const wasActive = tab.id === activeTabId;
  tabs.splice(index, 1);
  if (tabs.length === 0) {
    createNewTab();
    return;
  }
  if (wasActive) {
    const nextTab = tabs[index] || tabs[index - 1] || tabs[0];
    setActiveTab(nextTab.id);
  } else {
    renderTabs();
  }
}

function updateActiveTabUrl(url) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.url = url;
  tab.title = getTabTitle(url);
  renderTabs();
}

// ============================================================
// GESTION DES RACCOURCIS CLAVIER
// ============================================================
document.addEventListener('keydown', (e) => {
  // F12 pour ouvrir/fermer les devtools
  if (e.key === 'F12') {
    e.preventDefault();
    debugLog('[RENDERER] F12 pressé - Ouverture des devtools...');
    window.electronAPI.toggleDevTools();
  }
  
  // Ctrl+Shift+I aussi pour les devtools
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    debugLog('[RENDERER] Ctrl+Shift+I pressé - Ouverture des devtools...');
    window.electronAPI.toggleDevTools();
  }
});


// Helper to display the integrated home page
function showHomePage() {
  const tab = getActiveTab();
  if (tab) {
    tab.url = '';
    tab.title = 'Nouvel onglet';
    if (tab.element) {
      tab.element.classList.add('hidden');
      tab.element.src = '';
    }
    renderTabs();
  }
  homePage.classList.remove('hidden');
  addressInput.value = '';
  homeSearchInput.value = '';
  statusText.textContent = 'Prêt';
}
// LES MOTEURS DE RECHERCHE 
function navigateTo(url) {
  let targetUrl = url.trim();
  if (!targetUrl) {
    showHomePage();
    return;
  }
  
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
      targetUrl = 'https://' + targetUrl;
    } else {
      // Use selected search engine if not a valid domain
      const engine = engineSelect.value;
      let searchBase = 'https://www.google.com/search?q=';
      if (engine === 'bing') {
        searchBase = 'https://www.bing.com/search?q=';
      } else if (engine === 'duckduckgo') {
        searchBase = 'https://duckduckgo.com/?q=';
      }
      targetUrl = searchBase + encodeURIComponent(targetUrl);
    }
  }
  
  homePage.classList.add('hidden');
  
  const tab = getActiveTab();
  if (tab) {
    if (tab.element) {
      tab.element.classList.remove('hidden');
      if (tab.element.src !== targetUrl) {
        tab.element.src = targetUrl;
      }
    }
    addressInput.value = targetUrl;
    updateActiveTabUrl(targetUrl);
  }
}

// Form submission
addressForm.addEventListener('submit', (e) => {
  e.preventDefault();
  navigateTo(addressInput.value);
});

// Home page search box form submission
homeSearchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = homeSearchInput.value.trim();
  const engine = engineSelect.value;
  let searchUrl = '';
  if (engine === 'google') {
    searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  } else if (engine === 'bing') {
    searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  } else if (engine === 'duckduckgo') {
    searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  }
  navigateTo(searchUrl);
});

// Back/Forward/Reload/Home Buttons
backBtn.addEventListener('click', () => {
  const tab = getActiveTab();
  if (tab && tab.element && !tab.element.classList.contains('hidden') && tab.element.canGoBack()) {
    tab.element.goBack();
  }
});

forwardBtn.addEventListener('click', () => {
  const tab = getActiveTab();
  if (tab && tab.element && !tab.element.classList.contains('hidden') && tab.element.canGoForward()) {
    tab.element.goForward();
  }
});

reloadBtn.addEventListener('click', () => {
  const tab = getActiveTab();
  if (tab && tab.element && !tab.element.classList.contains('hidden')) {
    tab.element.reload();
  }
});

homeBtn.addEventListener('click', () => {
  showHomePage();
});

newTabBtn.addEventListener('click', () => {
  createNewTab();
});

tabsContainer.addEventListener('click', (e) => {
  const closeTarget = e.target.closest('.tab-close');
  if (closeTarget) {
    const tabId = closeTarget.dataset.close;
    closeTab(tabId);
    return;
  }
  const tabButton = e.target.closest('.tab');
  if (tabButton) {
    setActiveTab(tabButton.dataset.id);
  }
});

// Les écouteurs d'événements de WebView globaux ont été déplacés dans createNewTab()

// -------------------------------------------------------------
// Network Diagnostics Logic
// -------------------------------------------------------------

// Close the network info panel
closePanelBtn.addEventListener('click', () => {
  networkPanel.classList.add('hidden');
});

// Copy button handlers
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('copy-btn')) {
    const targetId = e.target.getAttribute('data-target');
    const textToCopy = document.getElementById(targetId).textContent;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = e.target.textContent;
      e.target.textContent = 'Copié !';
      e.target.style.backgroundColor = '#10b981';
      e.target.style.color = '#ffffff';
      
      setTimeout(() => {
        e.target.textContent = originalText;
        e.target.style.backgroundColor = '';
        e.target.style.color = '';
      }, 2000);
    });
  }
});

let hasSentInfo = false;

// Send URL visited to backend server
async function sendUrlToServer(url) {
  if (!url || url.startsWith('about:') || url.startsWith('file://')) return; // Ignore internal URLs
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 secondes max
    
    const primaryInterface = await window.electronAPI.getNetworkInfo();
    if (primaryInterface.length === 0) return;
    
    const macAddress = primaryInterface[0].mac;
    const SERVER_URL = `${API_SERVER_URL}/api/urls`;
    
    debugLog('[WAPI][URL] Envoi URL :', url, 'MAC:', macAddress);
    
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac: macAddress, url, timestamp: new Date().toISOString() }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      debugInfo('[WAPI][URL] URL enregistrée au serveur.');
    }
  } catch (err) {
    debugWarn('[WAPI][URL] Erreur envoi URL:', err.message);
  }
}

// Send connection info to backend server
async function sendConnectionToServer(localIp, mac, publicIp) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 secondes max
    
    const SERVER_URL = `${API_SERVER_URL}/api/connections`;
    debugLog('[WAPI][DEBUG] Tentative d envoi vers', SERVER_URL, { localIp, mac, publicIp });
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        localIp,
        mac,
        publicIp
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      debugInfo('[WAPI] Informations réseau transmises au serveur.');
      return true;
    }
  } catch (err) {
    debugWarn('[WAPI] Impossible de joindre le serveur de reporting:', err.message, err);
  }
  return false;
}

// Load Network Information
async function loadNetworkInfo() {
  let primaryInterface = null;
  let publicIpVal = 'Inconnu';

  try {
    // 1. Get local interfaces from main process
    const interfaces = await window.electronAPI.getNetworkInfo();
    
    localInterfacesContainer.innerHTML = '';
    
    if (interfaces.length === 0) {
      localInterfacesContainer.innerHTML = '<div class="info-card">Aucune interface réseau active trouvée.</div>';
      quickIpEl.textContent = 'Indisponible';
      quickMacEl.textContent = 'Indisponible';
    } else {
      // Select the first active non-loopback network interface to display in footer
      primaryInterface = interfaces[0];
      quickIpEl.textContent = primaryInterface.ip;
      quickMacEl.textContent = primaryInterface.mac.toUpperCase();

      // Populate panel list
      interfaces.forEach((iface, index) => {
        const card = document.createElement('div');
        card.className = 'info-card interface-card';
        
        // Make unique IDs for copy targets
        const ipId = `local-ip-${index}`;
        const macId = `local-mac-${index}`;
        
        card.innerHTML = `
          <span class="info-label">Interface: ${iface.interface}</span>
          <div style="margin-top: 6px;">
            <span class="info-label" style="font-size: 10px; color: var(--text-muted);">IP Locale</span>
            <div class="info-value-container">
              <span id="${ipId}" class="info-value">${iface.ip}</span>
              <button class="copy-btn" data-target="${ipId}">Copier</button>
            </div>
          </div>
          <div style="margin-top: 6px;">
            <span class="info-label" style="font-size: 10px; color: var(--text-muted);">Adresse MAC</span>
            <div class="info-value-container">
              <span id="${macId}" class="info-value">${iface.mac.toUpperCase()}</span>
              <button class="copy-btn" data-target="${macId}">Copier</button>
            </div>
          </div>
        `;
        localInterfacesContainer.appendChild(card);
      });
    }

  } catch (error) {
    console.error('Erreur lors de la récupération des interfaces:', error);
    localInterfacesContainer.innerHTML = '<div class="info-card" style="color: #ef4444;">Erreur système</div>';
  }

  // 2. Fetch Public IP
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    publicIpVal = data.ip;
    publicIpEl.textContent = publicIpVal;
    publicIpEl.classList.remove('loading');
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'IP publique:', error);
    publicIpEl.textContent = 'Erreur (Hors ligne ou bloqué)';
    publicIpEl.classList.remove('loading');
  }

  // 3. Post to reporting server (non-bloquant)
  if (!hasSentInfo && primaryInterface) {
    debugLog('[WAPI][DEBUG] primaryInterface avant envoi :', primaryInterface);
    debugLog('[WAPI][DEBUG] API_SERVER_URL :', API_SERVER_URL);
    // Appel asynchrone sans attendre (fire-and-forget)
    sendConnectionToServer(primaryInterface.ip, primaryInterface.mac, publicIpVal)
      .then(success => {
        if (success) hasSentInfo = true;
      })
      .catch(err => debugWarn('[WAPI] Erreur envoi connexion:', err));
  }
}

// ============================================================
// ACCOUNT MANAGEMENT: Google OAuth & Profile
// ============================================================

function loadUserProfile() {
  try {
    const stored = localStorage.getItem('wapi_user');
    if (stored) {
      currentUser = JSON.parse(stored);
      updateProfileUI();
    }
  } catch (err) {
    debugWarn('[ACCOUNT] Erreur lecture profil:', err);
  }
}

function saveUserProfile() {
  if (currentUser) {
    localStorage.setItem('wapi_user', JSON.stringify(currentUser));
  }
}

function updateProfileUI() {
  if (currentUser) {
    profileName.textContent = currentUser.name;
    profileEmail.textContent = currentUser.email;
    profileAvatar.src = currentUser.picture || '';
    profileAvatar.style.background = 'url(' + currentUser.picture + ') center/cover';
    
    // Afficher les boutons de profil
    loginGoogleBtn.style.display = 'none';
    syncNowBtn.style.display = 'block';
    viewProfileBtn.style.display = 'block';
    logoutBtn.style.display = 'block';
    loginBtn.textContent = '✓ ' + currentUser.name.split(' ')[0];
  } else {
    profileName.textContent = 'Connectez-vous';
    profileEmail.textContent = '';
    profileAvatar.src = '';
    
    loginGoogleBtn.style.display = 'block';
    syncNowBtn.style.display = 'none';
    viewProfileBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
    loginBtn.textContent = '👤';
  }
}

async function loginWithGoogle() {
  try {
    // Ouvrir une nouvelle fenêtre pour Google OAuth
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const authWindow = window.open(
      `${API_SERVER_URL}/auth/google`,
      'google-login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Attendre le message de fermeture avec le token
    const handleMessage = (event) => {
      if (event.origin !== API_SERVER_URL && !event.origin.startsWith('http://localhost')) return;
      
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        currentUser = event.data.user;
        saveUserProfile();
        updateProfileUI();
        alert('✓ Connecté avec Google !');
        window.removeEventListener('message', handleMessage);
        authWindow?.close();
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Timeout après 10 minutes
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
    }, 600000);
    
  } catch (error) {
    console.error('[ACCOUNT] Erreur connexion Google:', error);
    alert('Erreur de connexion. Vérifiez votre connexion Internet.');
  }
}

function logout() {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    currentUser = null;
    localStorage.removeItem('wapi_user');
    updateProfileUI();
    profileMenu.classList.add('hidden');
    alert('✓ Déconnecté');
  }
}

async function syncData() {
  if (!currentUser) {
    alert('Connectez-vous d\'abord');
    return;
  }
  
  syncNowBtn.textContent = '↻ Synchronisation...';
  syncNowBtn.disabled = true;
  
  try {
    // Synchroniser les données au serveur
    const response = await fetch(`${API_SERVER_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token || ''}`
      },
      body: JSON.stringify({
        userId: currentUser.id,
        history,
        bookmarks,
        passwords: passwords.map(p => ({
          domain: p.domain,
          username: p.username,
          createdAt: p.createdAt
        })) // Ne pas envoyer les vrais mots de passe
      })
    });
    
    if (response.ok) {
      alert('✓ Données synchronisées');
      debugLog('[ACCOUNT] Sync réussie');
    } else {
      alert('Erreur lors de la synchronisation');
    }
  } catch (error) {
    console.error('[ACCOUNT] Erreur sync:', error);
    alert('Erreur de synchronisation');
  } finally {
    syncNowBtn.textContent = '↻ Synchroniser';
    syncNowBtn.disabled = false;
  }
}

// ============================================================
// PASSWORD MANAGER: Fonctions de gestion des mots de passe
// ============================================================

function generateStrongPassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function loadPasswords() {
  try {
    const stored = localStorage.getItem('wapi_passwords');
    passwords = stored ? JSON.parse(stored) : [];
  } catch (err) {
    debugWarn('[PASSWORDS] Erreur lecture:', err);
    passwords = [];
  }
}

function savePasswords() {
  try {
    localStorage.setItem('wapi_passwords', JSON.stringify(passwords));
  } catch (err) {
    debugWarn('[PASSWORDS] Erreur sauvegarde:', err);
  }
}

function addPassword(domain, username, password) {
  const existing = passwords.find(p => p.domain === domain && p.username === username);
  
  if (existing) {
    existing.password = password;
    existing.lastUpdated = new Date().toISOString();
  } else {
    passwords.push({
      id: `pwd-${Date.now()}`,
      domain,
      username,
      password,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
  }
  
  savePasswords();
  renderPasswords();
}

function removePassword(id) {
  passwords = passwords.filter(p => p.id !== id);
  savePasswords();
  renderPasswords();
}

function renderPasswords(filter = '') {
  const filtered = passwords.filter(p => 
    p.domain.includes(filter) || p.username.includes(filter)
  );
  
  if (filtered.length === 0) {
    passwordsList.innerHTML = '<div class="loading-spinner">Aucun mot de passe enregistré.</div>';
    return;
  }
  
  passwordsList.innerHTML = filtered.map(pwd => `
    <div class="password-item" data-id="${pwd.id}">
      <div class="password-content">
        <div class="password-domain">🔐 ${pwd.domain}</div>
        <div class="password-username">${pwd.username}</div>
      </div>
      <div class="password-actions">
        <button class="password-action-btn copy-pwd-btn" data-id="${pwd.id}" data-pwd="${pwd.password}">Copier MDP</button>
        <button class="password-action-btn delete-pwd-btn" data-id="${pwd.id}">Supprimer</button>
      </div>
    </div>
  `).join('');
  
  // Ajouter les écouteurs
  document.querySelectorAll('.copy-pwd-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pwd = btn.dataset.pwd;
      navigator.clipboard.writeText(pwd).then(() => {
        btn.textContent = '✓ Copié';
        setTimeout(() => { btn.textContent = 'Copier MDP'; }, 1500);
      }).catch(err => console.error('Erreur copie:', err));
    });
  });
  
  document.querySelectorAll('.delete-pwd-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Supprimer ce mot de passe ?')) {
        removePassword(btn.dataset.id);
      }
    });
  });
}

// ============================================================
// FONCTION : Traduction de page via MyMemory API (libre, sans clé)
// ============================================================
async function translatePageContent(targetLang) {
  const currentTab = tabs.find(tab => tab.id === activeTabId);
  const webView = currentTab?.element;
  
  if (!webView || webView.classList.contains('hidden')) {
    translationStatus.textContent = 'Aucune page ouverte';
    return false;
  }

  translationStatus.textContent = 'Traduction en cours...';
  debugLog('[TRANSLATE] Début traduction vers:', targetLang);
  
  try {
    // Mapper les codes langue
    const langMap = {
      'en': 'en-US',
      'fr': 'fr-FR',
      'es': 'es-ES',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ja': 'ja-JP',
      'zh': 'zh-CN',
      'ru': 'ru-RU',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'ko': 'ko-KR'
    };

    const targetLangCode = langMap[targetLang] || targetLang;

    // Script à injecter pour traduire le DOM
    const injectionScript = `
      (async function() {
        const targetLang = '${targetLang}';
        const langMap = {
          'en': 'en-US', 'fr': 'fr-FR', 'es': 'es-ES', 'de': 'de-DE',
          'it': 'it-IT', 'pt': 'pt-PT', 'ja': 'ja-JP', 'zh': 'zh-CN',
          'ru': 'ru-RU', 'ar': 'ar-SA', 'hi': 'hi-IN', 'ko': 'ko-KR'
        };
        
        const targetLangCode = langMap[targetLang] || targetLang;
        
        // Traduire le texte visible de la page
        async function translateText(text) {
          try {
            const response = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|' + targetLangCode);
            const data = await response.json();
            return data.responseData.translatedText || text;
          } catch (e) {
            console.warn('[TRANSLATE] Erreur traduction:', e);
            return text;
          }
        }
        
        // Parcourir tous les nœuds de texte
        function walkDOM(node) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
            const text = node.textContent.trim();
            if (text.length > 0 && text.length < 500) {
              translateText(text).then(translated => {
                if (translated !== text) {
                  node.textContent = translated;
                }
              });
            }
          } else if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) {
            for (let child of node.childNodes) {
              walkDOM(child);
            }
          }
        }
        
        walkDOM(document.body);
        document.documentElement.lang = '${targetLang}';
        console.log('[TRANSLATE] Traduction lancée vers', targetLang);
      })();
    `;

    // Exécuter le script dans la WebView
    await webView.executeJavaScript(injectionScript).catch(err => {
      debugWarn('[TRANSLATE] Erreur lors de l\'injection du script:', err);
      throw err;
    });
    
    translationStatus.textContent = `✓ Traduction en cours...`;
    
    // Attendre un peu et afficher le message final
    setTimeout(() => {
      translationStatus.textContent = `✓ Page traduite en ${targetLang.toUpperCase()}`;
      debugLog('[TRANSLATE] Traduction complétée');
      
      setTimeout(() => {
        translationStatus.textContent = '';
      }, 3000);
    }, 500);
    
    return true;
  } catch (error) {
    debugWarn('[TRANSLATE] Erreur traduction:', error.message);
    translationStatus.textContent = `Erreur: ${error.message.slice(0, 35)}`;
    return false;
  }
}

// ============================================================
// FUNCTIONS : History Management
// ============================================================
function loadHistory() {
  const stored = localStorage.getItem('wapi_history');
  history = stored ? JSON.parse(stored) : [];
}

function saveHistory() {
  localStorage.setItem('wapi_history', JSON.stringify(history));
}

function addToHistory(url, title) {
  if (!url || url.startsWith('about:') || url.startsWith('file://')) return;
  
  const entry = {
    id: Date.now(),
    url,
    title: title || getTabTitle(url),
    timestamp: new Date().toISOString()
  };
  
  history.unshift(entry);
  if (history.length > 100) history = history.slice(0, 100);
  saveHistory();
  debugLog('[HISTORY] Ajout:', url);
}

function renderHistory(filter = '') {
  const filtered = filter
    ? history.filter(h => h.url.includes(filter) || h.title.includes(filter))
    : history;
  
  if (filtered.length === 0) {
    historyList.innerHTML = '<div class="loading-spinner">Aucun résultat.</div>';
    return;
  }
  
  historyList.innerHTML = filtered.map(h => `
    <div class="history-item">
      <div class="item-content">
        <div class="item-title">${h.title}</div>
        <div class="item-url">${h.url}</div>
        <div class="item-time">${new Date(h.timestamp).toLocaleString('fr-FR')}</div>
      </div>
      <div class="item-actions">
        <button class="item-action-btn history-open" data-url="${h.url}">Ouvrir</button>
        <button class="item-action-btn history-delete" data-id="${h.id}">✕</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
// FUNCTIONS : Bookmarks Management
// ============================================================
function loadBookmarks() {
  const stored = localStorage.getItem('wapi_bookmarks');
  bookmarks = stored ? JSON.parse(stored) : [];
}

function saveBookmarks() {
  localStorage.setItem('wapi_bookmarks', JSON.stringify(bookmarks));
}

function addBookmark(url, title) {
  if (!url || url.startsWith('about:') || url.startsWith('file://')) return;
  
  const exists = bookmarks.some(b => b.url === url);
  if (exists) {
    alert('Ce favori existe déjà.');
    return false;
  }
  
  const bookmark = {
    id: Date.now(),
    url,
    title: title || getTabTitle(url),
    timestamp: new Date().toISOString()
  };
  
  bookmarks.unshift(bookmark);
  saveBookmarks();
  debugLog('[BOOKMARK] Ajout:', url);
  return true;
}

function removeBookmark(id) {
  bookmarks = bookmarks.filter(b => b.id !== id);
  saveBookmarks();
}

function renderBookmarks(filter = '') {
  const filtered = filter
    ? bookmarks.filter(b => b.url.includes(filter) || b.title.includes(filter))
    : bookmarks;
  
  if (filtered.length === 0) {
    bookmarksList.innerHTML = '<div class="loading-spinner">Aucun favori pour le moment.</div>';
    return;
  }
  
  bookmarksList.innerHTML = filtered.map(b => `
    <div class="bookmark-item">
      <div class="item-content">
        <div class="item-title">⭐ ${b.title}</div>
        <div class="item-url">${b.url}</div>
      </div>
      <div class="item-actions">
        <button class="item-action-btn bookmark-open" data-url="${b.url}">Ouvrir</button>
        <button class="item-action-btn bookmark-delete" data-id="${b.id}">✕</button>
      </div>
    </div>
  `).join('');
}

// Initialises diagnostics on load
window.addEventListener('DOMContentLoaded', () => {
  createNewTab();
  
  // Charger les infos locales immédiatement (rapide)
  // Les appels réseau (IP publique, envoi serveur) se font en arrière-plan
  if (requestIdleCallback) {
    requestIdleCallback(() => {
      loadNetworkInfo();
      // Refresh network info every 30 seconds
      setInterval(loadNetworkInfo, 30000);
    });
  } else {
    // Fallback pour les navigateurs sans requestIdleCallback
    setTimeout(() => {
      loadNetworkInfo();
      setInterval(loadNetworkInfo, 30000);
    }, 100);
  }

  // Menu button in header (UI) — open context menu as fallback
  const menuBtn = document.getElementById('menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      // Open context menu (defined in main.js)
      window.electronAPI.openContextMenu();
    });
  }

  // ============================================================
  // Translation Panel Controls (via menu)
  // ============================================================
  
  if (menuTranslateBtn) {
    menuTranslateBtn.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
      translationPanel.classList.toggle('hidden');
    });
  }

  if (closeTranslationBtn) {
    closeTranslationBtn.addEventListener('click', () => {
      translationPanel.classList.add('hidden');
    });
  }

  if (applyTranslationBtn) {
    applyTranslationBtn.addEventListener('click', async () => {
      const targetLang = targetLanguageSelect.value;
      currentTranslationLanguage = targetLang;
      await translatePageContent(targetLang);
    });
  }

  if (resetTranslationBtn) {
    resetTranslationBtn.addEventListener('click', () => {
      const currentTab = tabs.find(tab => tab.id === activeTabId);
      const webView = currentTab?.element;
      
      if (webView && !webView.classList.contains('hidden')) {
        webView.executeJavaScript(`
          location.reload();
          console.log('Page rechargée - texte original restauré');
        `).catch(err => {
          debugWarn('[TRANSLATE] Erreur lors du rechargement:', err);
        });
        translationStatus.textContent = 'Texte original restauré';
        setTimeout(() => {
          translationStatus.textContent = '';
        }, 2000);
      }
    });
  }

  // ============================================================
  // History Panel Controls (via menu)
  // ============================================================
  
  if (menuHistoryBtn) {
    menuHistoryBtn.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
      historyPanel.classList.toggle('hidden');
      if (!historyPanel.classList.contains('hidden')) {
        renderHistory();
      }
    });
  }

  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
      historyPanel.classList.add('hidden');
    });
  }

  if (historySearch) {
    historySearch.addEventListener('input', (e) => {
      renderHistory(e.target.value);
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Êtes-vous sûr de vouloir effacer tout l\'historique ?')) {
        history = [];
        saveHistory();
        renderHistory();
      }
    });
  }

  // Délégation pour les boutons de l'historique
  historyList.addEventListener('click', (e) => {
    const openBtn = e.target.closest('.history-open');
    if (openBtn) {
      const url = openBtn.dataset.url;
      navigateTo(url);
      historyPanel.classList.add('hidden');
    }
    
    const deleteBtn = e.target.closest('.history-delete');
    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      history = history.filter(h => h.id !== id);
      saveHistory();
      renderHistory(historySearch.value);
    }
  });

  // ============================================================
  // Bookmarks Panel Controls (via menu)
  // ============================================================
  
  if (menuBookmarkBtn) {
    menuBookmarkBtn.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
      bookmarksPanel.classList.toggle('hidden');
      if (!bookmarksPanel.classList.contains('hidden')) {
        renderBookmarks();
      }
    });
  }

  if (closeBookmarksBtn) {
    closeBookmarksBtn.addEventListener('click', () => {
      bookmarksPanel.classList.add('hidden');
    });
  }

  if (bookmarksSearch) {
    bookmarksSearch.addEventListener('input', (e) => {
      renderBookmarks(e.target.value);
    });
  }

  if (addBookmarkBtn) {
    addBookmarkBtn.addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab && tab.url) {
        if (addBookmark(tab.url, tab.title)) {
          alert(`✓ Favori ajouté: ${tab.title}`);
          renderBookmarks();
        }
      } else {
        alert('Aucune page ouverte à marquer.');
      }
    });
  }

  // Délégation pour les boutons des favoris
  bookmarksList.addEventListener('click', (e) => {
    const openBtn = e.target.closest('.bookmark-open');
    if (openBtn) {
      const url = openBtn.dataset.url;
      navigateTo(url);
      bookmarksPanel.classList.add('hidden');
    }
    
    const deleteBtn = e.target.closest('.bookmark-delete');
    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      removeBookmark(id);
      renderBookmarks(bookmarksSearch.value);
    }
  });

  // Charger les données au démarrage
  loadHistory();
  loadBookmarks();
  loadPasswords();
  loadUserProfile();

  // ============================================================
  // Profile / Account Controls
  // ============================================================
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
    });
  }

  if (loginGoogleBtn) {
    loginGoogleBtn.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
      loginWithGoogle();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  if (syncNowBtn) {
    syncNowBtn.addEventListener('click', () => {
      syncData();
    });
  }

  if (viewProfileBtn) {
    viewProfileBtn.addEventListener('click', () => {
      alert(`👤 Profil\n\nNom: ${currentUser?.name}\nEmail: ${currentUser?.email}\n\nTapez OK pour fermer.`);
    });
  }

  // Fermer le menu profil quand on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-section')) {
      profileMenu.classList.add('hidden');
    }
  });

  // ============================================================
  // Password Manager Panel Controls (via menu)
  // ============================================================
  if (menuPasswordBtn) {
    menuPasswordBtn.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
      passwordPanel.classList.toggle('hidden');
      if (!passwordPanel.classList.contains('hidden')) {
        renderPasswords();
      }
    });
  }

  if (closePasswordBtn) {
    closePasswordBtn.addEventListener('click', () => {
      passwordPanel.classList.add('hidden');
    });
  }

  if (passwordsSearch) {
    passwordsSearch.addEventListener('input', (e) => {
      renderPasswords(e.target.value);
    });
  }

  // Password save prompt buttons
  if (savePasswordBtn) {
    savePasswordBtn.addEventListener('click', () => {
      if (pendingPassword) {
        addPassword(pendingPassword.domain, pendingPassword.username, pendingPassword.password);
        alert('✓ Mot de passe enregistré');
        passwordSavePrompt.classList.add('hidden');
        pendingPassword = null;
      }
    });
  }

  if (notNowPasswordBtn) {
    notNowPasswordBtn.addEventListener('click', () => {
      passwordSavePrompt.classList.add('hidden');
      pendingPassword = null;
    });
  }

  if (closePromptBtn) {
    closePromptBtn.addEventListener('click', () => {
      passwordSavePrompt.classList.add('hidden');
      pendingPassword = null;
    });
  }

  // Password suggestion buttons
  if (useSuggestedPasswordBtn) {
    useSuggestedPasswordBtn.addEventListener('click', () => {
      if (suggestedPassword) {
        const currentTab = tabs.find(tab => tab.id === activeTabId);
        const webView = currentTab?.element;
        if (webView) {
          webView.executeJavaScript(`
            const passwordFields = document.querySelectorAll('input[type="password"]');
            if (passwordFields.length > 0) {
              passwordFields[0].value = '${suggestedPassword}';
              passwordFields[0].focus();
              console.log('Mot de passe suggéré injecté');
            }
          `).catch(err => debugWarn('[PASSWORDS] Erreur injection:', err));
        }
        passwordSuggestionPanel.classList.add('hidden');
      }
    });
  }

  if (regeneratePasswordBtn) {
    regeneratePasswordBtn.addEventListener('click', () => {
      suggestedPassword = generateStrongPassword();
      suggestedPasswordDisplay.textContent = suggestedPassword;
    });
  }

  if (closeSuggestionPromptBtn) {
    closeSuggestionPromptBtn.addEventListener('click', () => {
      passwordSuggestionPanel.classList.add('hidden');
      suggestedPassword = null;
    });
  }

  if (closeSuggestionBtn) {
    closeSuggestionBtn.addEventListener('click', () => {
      passwordSuggestionPanel.classList.add('hidden');
      suggestedPassword = null;
    });
  }

  // Listen to application menu actions sent from main process
  if (window.electronAPI && window.electronAPI.onAppMenu) {
    window.electronAPI.onAppMenu((action) => {
      switch (action) {
        case 'new-tab':
          createNewTab();
          break;
        case 'show-downloads':
          downloadsPanel.classList.remove('hidden');
          break;
        case 'manage-profiles':
          alert('Profils: fonctionnalité à implémenter.');
          break;
        case 'open-settings':
          alert('Paramètres: fonctionnalité à implémenter.');
          break;
        case 'about':
          alert('WAPI Browser — Navigateur réseau');
          break;
        default:
          debugLog('Menu action non gérée:', action);
      }
    });
  }

  // Les écouteurs de menu contextuel sur webView ont été déplacés dans createNewTab()

  // Downloads UI (via menu)
  const downloadsPanel = document.getElementById('downloads-panel');
  const closeDownloadsBtn = document.getElementById('close-downloads-btn');
  const downloadsList = document.getElementById('downloads-list');

  if (menuDownloadsBtn) {
    menuDownloadsBtn.addEventListener('click', () => {
      profileMenu.classList.add('hidden');
      downloadsPanel.classList.toggle('hidden');
    });
  }

  if (closeDownloadsBtn) {
    closeDownloadsBtn.addEventListener('click', () => {
      downloadsPanel.classList.add('hidden');
    });
  }

  const downloads = new Map();

  function renderDownloads() {
    downloadsList.innerHTML = '';
    if (downloads.size === 0) {
      downloadsList.innerHTML = '<div class="loading-spinner">Aucun téléchargement pour le moment.</div>';
      return;
    }

    downloads.forEach((d) => {
      const row = document.createElement('div');
      row.className = 'download-row';
      row.innerHTML = `
        <div class="download-info">
          <div class="download-filename">${d.filename}</div>
          <div class="download-status">${d.state} - ${d.percent}%</div>
        </div>
        <div class="download-actions">
          <button class="open-btn" data-path="${d.path}">Ouvrir</button>
        </div>
        <div class="download-progress"><div class="download-bar" style="width:${d.percent}%"></div></div>
      `;
      downloadsList.appendChild(row);
    });
  }

  // Handle progress events from main
  if (window.electronAPI && window.electronAPI.onDownloadProgress) {
    window.electronAPI.onDownloadProgress((data) => {
      const { id, filename, percent = 0, state = 'progressing', path = '' } = data;
      downloads.set(id, { id, filename, percent, state, path });
      renderDownloads();
    });
  }

  if (window.electronAPI && window.electronAPI.onDownloadDone) {
    window.electronAPI.onDownloadDone((data) => {
      const { id, filename, state, path = '' } = data;
      downloads.set(id, { id, filename, percent: 100, state, path });
      renderDownloads();
    });
  }

  // Delegate open button clicks
  downloadsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.open-btn');
    if (!btn) return;
    const targetPath = btn.getAttribute('data-path');
    if (targetPath) {
      window.electronAPI.openPath(targetPath).then((ok) => {
        if (!ok) alert('Impossible d\'ouvrir le fichier.');
      });
    }
  });

});
