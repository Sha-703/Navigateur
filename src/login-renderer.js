// ============================================================
// login-renderer.js — Logique de connexion au dashboard
// ============================================================

const API_SERVER_URL = 'http://localhost:3000';
const SERVER_PROD = 'https://server-navigateur.onrender.com';

// Détecter si on est en production ou développement
function getApiUrl() {
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isDev ? API_SERVER_URL : SERVER_PROD;
}

const form = document.getElementById('login-form');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const loginBtn = document.getElementById('login-btn');

// Afficher un message d'erreur
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
  
  // Auto-masquer après 5 secondes
  setTimeout(() => {
    errorMessage.classList.remove('show');
  }, 5000);
}

// Soumettre le formulaire
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const password = passwordInput.value.trim();
  if (!password) {
    showError('Le mot de passe est requis.');
    return;
  }

  // Bloquer le bouton pendant la requête
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="loading"></span> Connexion...';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 secondes

    const response = await fetch(`${getApiUrl()}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.status === 401) {
      showError('Mot de passe incorrect.');
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Connexion';
      return;
    }

    if (!response.ok) {
      showError('Erreur serveur. Veuillez réessayer.');
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Connexion';
      return;
    }

    const data = await response.json();
    
    // Stocker le token en localStorage
    if (data.token) {
      localStorage.setItem('wapi_auth_token', data.token);
      localStorage.setItem('wapi_auth_expires', data.expires);
    }

    // Rediriger vers le dashboard
    window.location.href = '/admin-panel/admin.html';

  } catch (error) {
    console.error('[LOGIN] Erreur:', error.message);
    
    if (error.name === 'AbortError') {
      showError('Connexion au serveur expirée. Réessayez.');
    } else {
      showError('Impossible de se connecter. Vérifiez votre connexion.');
    }
    
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Connexion';
  }
});

// Permettre Entrée pour valider
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    form.dispatchEvent(new Event('submit'));
  }
});

// Vérifier si déjà connecté au chargement
window.addEventListener('load', () => {
  const token = localStorage.getItem('wapi_auth_token');
  const expires = localStorage.getItem('wapi_auth_expires');
  
  if (token && expires && new Date(expires) > new Date()) {
    // Token valide, rediriger vers le dashboard
    window.location.href = '/admin-panel/admin.html';
  }
});
