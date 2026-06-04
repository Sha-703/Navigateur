// ============================================================
// VÉRIFICATION D'AUTHENTIFICATION
// ============================================================
function checkAuthentication() {
  const token = localStorage.getItem('wapi_auth_token');
  const expires = localStorage.getItem('wapi_auth_expires');

  // Vérifier si le token existe et n'a pas expiré
  if (!token || !expires || new Date(expires) <= new Date()) {
    // Token manquant ou expiré - rediriger vers la connexion
    localStorage.removeItem('wapi_auth_token');
    localStorage.removeItem('wapi_auth_expires');
    window.location.href = '/login.html';
    return false;
  }

  return true;
}

// Vérifier à la première charge
if (!checkAuthentication()) {
  // Arrêter le script si non authentifié
  throw new Error('Non authentifié');
}

// ============================================================

let users = [];
let selectedUser = null;

const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');

const searchIpInput = document.getElementById('search-ip');
const searchMacInput = document.getElementById('search-mac');
const searchDateInput = document.getElementById('search-date');

const statTotalEl = document.getElementById('stat-total');
const statUniqueEl = document.getElementById('stat-unique');

const detailsModal = document.getElementById('details-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalDetails = document.getElementById('modal-details');

// Fetch users from server API
async function fetchUsers() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('API request failed');
    users = await response.json();
    updateDashboard();
  } catch (error) {
    console.error('Failed to fetch users:', error);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444;">Impossible de se connecter au serveur.</td></tr>`;
  }
}

// Format ISO date to readable French format
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Update UI and apply filters
function updateDashboard() {
  const ipFilter = searchIpInput.value.trim().toLowerCase();
  const macFilter = searchMacInput.value.trim().toLowerCase();

  // Filter users
  const filtered = users.filter(user => {
    const matchesIp = user.localIp.toLowerCase().includes(ipFilter) || 
                      user.publicIp.toLowerCase().includes(ipFilter);
    const matchesMac = user.mac.toLowerCase().includes(macFilter);
    return matchesIp && matchesMac;
  });

  // Calculate global stats
  statTotalEl.textContent = users.reduce((sum, u) => sum + u.count, 0);
  statUniqueEl.textContent = users.length;

  // Render table
  tableBody.innerHTML = '';
  
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');

  filtered.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="mac-address">${user.mac}</span></td>
      <td><span class="ip-address">${user.localIp}</span></td>
      <td><span class="ip-address">${user.publicIp}</span></td>
      <td><strong>${user.count}</strong></td>
      <td class="date-val">${formatDate(user.lastSeen)}</td>
      <td><button class="details-btn" data-mac="${user.mac}">Voir Détails</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

// Show details modal for a user
function showUserDetails(mac) {
  const user = users.find(u => u.mac === mac);
  if (!user) return;

  selectedUser = user;

  // Build modal content
  let html = `
    <div class="detail-section">
      <div class="detail-header">Informations Utilisateur</div>
      <div class="detail-row">
        <span class="detail-label">Adresse MAC</span>
        <span class="detail-value">${user.mac}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">IP Locale</span>
        <span class="detail-value">${user.localIp}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">IP Publique</span>
        <span class="detail-value">${user.publicIp}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Nombre de Connexions</span>
        <span class="detail-value">${user.count}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Première Connexion</span>
        <span class="detail-value">${formatDate(user.firstSeen)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Dernière Connexion</span>
        <span class="detail-value">${formatDate(user.lastSeen)}</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-header">Historique des Connexions</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead style="background: rgba(0,0,0,0.3);">
          <tr>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);">Date / Heure</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);">IP Observée</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);">User Agent</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Sort connections by date (most recent first)
  const sortedConnections = [...user.connections].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  sortedConnections.forEach(conn => {
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 8px;">${formatDate(conn.timestamp)}</td>
        <td style="padding: 8px; font-family: monospace; color: #a5b4fc;">${conn.observedIp || 'N/A'}</td>
        <td style="padding: 8px; font-size: 11px; color: var(--text-muted);">${conn.userAgent || 'Unknown'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // Add URLs section if available
  if (user.urls && user.urls.length > 0) {
    html += `
    <div class="detail-section">
      <div class="detail-header">URLs Visitées (${user.urls.length})</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead style="background: rgba(0,0,0,0.3);">
          <tr>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);">Date / Heure</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.1);">URL</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Sort URLs by date (most recent first)
    const sortedUrls = [...user.urls].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedUrls.forEach(urlRecord => {
      const url = urlRecord.url || 'Unknown';
      const domain = url.includes('://') ? new URL(url).hostname : url;
      html += `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 8px;">${formatDate(urlRecord.timestamp)}</td>
          <td style="padding: 8px; font-size: 11px; word-break: break-all;">
            <a href="${url}" target="_blank" style="color: #a5b4fc; text-decoration: none;">${domain}</a>
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    </div>
    `;
  }

  modalDetails.innerHTML = html;
  detailsModal.classList.remove('hidden');
}

// Event Listeners
refreshBtn.addEventListener('click', fetchUsers);
searchIpInput.addEventListener('input', updateDashboard);
searchMacInput.addEventListener('input', updateDashboard);

closeModalBtn.addEventListener('click', () => {
  detailsModal.classList.add('hidden');
  selectedUser = null;
});

detailsModal.addEventListener('click', (e) => {
  if (e.target === detailsModal) {
    detailsModal.classList.add('hidden');
    selectedUser = null;
  }
});

// Delegate click for details buttons
tableBody.addEventListener('click', (e) => {
  const btn = e.target.closest('.details-btn');
  if (btn) {
    const mac = btn.getAttribute('data-mac');
    showUserDetails(mac);
  }
});

// Bouton déconnexion
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
      localStorage.removeItem('wapi_auth_token');
      localStorage.removeItem('wapi_auth_expires');
      window.location.href = '/login.html';
    }
  });
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  fetchUsers();
  // Auto-refresh every 10 seconds
  setInterval(fetchUsers, 10000);
});
