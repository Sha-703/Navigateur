let connections = [];

const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');

const searchIpInput = document.getElementById('search-ip');
const searchMacInput = document.getElementById('search-mac');
const searchDateInput = document.getElementById('search-date');

const statTotalEl = document.getElementById('stat-total');
const statUniqueEl = document.getElementById('stat-unique');

// Fetch connections from server API
async function fetchConnections() {
  try {
    const response = await fetch('/api/connections');
    if (!response.ok) throw new Error('API request failed');
    connections = await response.json();
    updateDashboard();
  } catch (error) {
    console.error('Failed to fetch connections:', error);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444;">Impossible de se connecter au serveur.</td></tr>`;
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
  const dateFilter = searchDateInput.value; // YYYY-MM-DD

  // Filter connections
  const filtered = connections.filter(conn => {
    // 1. IP Filter
    const matchesIp = conn.localIp.toLowerCase().includes(ipFilter) || 
                      conn.publicIp.toLowerCase().includes(ipFilter);
    
    // 2. MAC Filter
    const matchesMac = conn.mac.toLowerCase().includes(macFilter);

    // 3. Date Filter
    let matchesDate = true;
    if (dateFilter) {
      const connDateString = conn.timestamp.split('T')[0]; // Get YYYY-MM-DD portion
      matchesDate = (connDateString === dateFilter);
    }

    return matchesIp && matchesMac && matchesDate;
  });

  // Calculate global stats (always based on full dataset)
  statTotalEl.textContent = connections.length;
  
  const uniqueMacs = new Set(connections.map(c => c.mac));
  statUniqueEl.textContent = uniqueMacs.size;

  // Render table
  tableBody.innerHTML = '';
  
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');

  filtered.forEach(conn => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="date-val">${formatDate(conn.timestamp)}</td>
      <td><span class="mac-address">${conn.mac}</span></td>
      <td><span class="ip-address">${conn.localIp}</span></td>
      <td><span class="ip-address">${conn.publicIp}</span></td>
    `;
    tableBody.appendChild(tr);
  });
}

// Event Listeners
refreshBtn.addEventListener('click', fetchConnections);
searchIpInput.addEventListener('input', updateDashboard);
searchMacInput.addEventListener('input', updateDashboard);
searchDateInput.addEventListener('change', updateDashboard);

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  fetchConnections();
  // Auto-refresh every 10 seconds
  setInterval(fetchConnections, 10000);
});
