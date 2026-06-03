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

const webView = document.getElementById('web-view');
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

let tabs = [];
let activeTabId = null;

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
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function setActiveTab(tabId) {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) return;
  activeTabId = tabId;
  renderTabs();
  if (!tab.url) {
    showHomePage();
  } else {
    homePage.classList.add('hidden');
    webView.classList.remove('hidden');
    webView.src = tab.url;
    addressInput.value = tab.url;
    statusText.textContent = 'Prêt';
  }
}

function createNewTab(url = '') {
  const tab = {
    id: makeTabId(),
    title: getTabTitle(url),
    url,
  };
  tabs.push(tab);
  setActiveTab(tab.id);
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return;
  const wasActive = tabs[index].id === activeTabId;
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
    renderTabs();
  }
  webView.classList.add('hidden');
  homePage.classList.remove('hidden');
  addressInput.value = '';
  homeSearchInput.value = '';
  webView.src = '';
  statusText.textContent = 'Prêt';
}

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
  webView.classList.remove('hidden');
  webView.src = targetUrl;
  addressInput.value = targetUrl;
  updateActiveTabUrl(targetUrl);
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
  if (!webView.classList.contains('hidden') && webView.canGoBack()) {
    webView.goBack();
  }
});

forwardBtn.addEventListener('click', () => {
  if (!webView.classList.contains('hidden') && webView.canGoForward()) {
    webView.goForward();
  }
});

reloadBtn.addEventListener('click', () => {
  if (!webView.classList.contains('hidden')) {
    webView.reload();
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

// Update UI state based on WebView events
webView.addEventListener('did-start-loading', () => {
  statusText.textContent = 'Chargement...';
});

webView.addEventListener('did-stop-loading', () => {
  statusText.textContent = 'Prêt';
  const currentUrl = webView.getURL();
  addressInput.value = currentUrl;
  updateActiveTabUrl(currentUrl);
});

webView.addEventListener('did-fail-load', (e) => {
  // ERR_ABORTED (-3) se produit quand une navigation est interrompue
  // (nouvelle navigation, redirection, ou annulation). Ce n'est
  // généralement pas une erreur fatale : on l'ignore et on logge en debug.
  if (e.errorCode === -3 || (e.errorDescription && e.errorDescription.includes('ERR_ABORTED'))) {
    debugWarn('[WEBVIEW] Navigation abortée (ignorer) :', e.url, e.errorDescription);
    return;
  }

  statusText.textContent = `Erreur de chargement: ${e.errorDescription}`;
  console.error('[WEBVIEW] failed to load', e);
});

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

// Send connection info to backend server
async function sendConnectionToServer(localIp, mac, publicIp) {
  try {
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
      })
    });
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

  // 3. Post to reporting server (try until successful, then stop)
  if (!hasSentInfo && primaryInterface) {
    debugLog('[WAPI][DEBUG] primaryInterface avant envoi :', primaryInterface);
    debugLog('[WAPI][DEBUG] API_SERVER_URL :', API_SERVER_URL);
    const success = await sendConnectionToServer(primaryInterface.ip, primaryInterface.mac, publicIpVal);
    if (success) {
      hasSentInfo = true;
    }
  }
}

// Initialise diagnostics on load
window.addEventListener('DOMContentLoaded', () => {
  createNewTab();
  loadNetworkInfo();
  // Refresh network info every 30 seconds
  setInterval(loadNetworkInfo, 30000);

  // Menu button in header (UI) — open context menu as fallback
  const menuBtn = document.getElementById('menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      // Open context menu (defined in main.js)
      window.electronAPI.openContextMenu();
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

  webView.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.electronAPI.openContextMenu();
  });

  webView.addEventListener('ipc-message', (event) => {
    if (event.channel === 'show-context-menu') {
      window.electronAPI.openContextMenu();
    }
  });

  // Downloads UI
  const downloadsBtn = document.getElementById('downloads-btn');
  const downloadsPanel = document.getElementById('downloads-panel');
  const closeDownloadsBtn = document.getElementById('close-downloads-btn');
  const downloadsList = document.getElementById('downloads-list');

  if (downloadsBtn) {
    downloadsBtn.addEventListener('click', () => {
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
