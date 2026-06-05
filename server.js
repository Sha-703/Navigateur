require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// Quand l'app est derrière un proxy (Render), activer trust proxy
app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_FILE = path.join(__dirname, 'connections-db.json');
const URLS_FILE = path.join(__dirname, 'urls-db.json');
const GOOGLE_CONFIG_FILE = path.join(__dirname, 'google-config.json');

// Helper to get Google OAuth config from environment or local JSON file
function getGoogleConfig() {
  let client_id = process.env.GOOGLE_CLIENT_ID;
  let client_secret = process.env.GOOGLE_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    try {
      if (fs.existsSync(GOOGLE_CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(GOOGLE_CONFIG_FILE, 'utf8'));
        if (data.client_id) client_id = data.client_id;
        if (data.client_secret) client_secret = data.client_secret;
      }
    } catch (error) {
      console.error('Error reading google-config.json:', error);
    }
  }

  return { client_id, client_secret };
}

// Mot de passe admin pour accéder au dashboard
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const TOKEN_EXPIRY_HOURS = 24; // Durée de validité du token (heures)

// ============================================================
// FONCTION : Géolocalisation IP
// Utilise l'API ip-api.com (gratuite, 45 req/min)
// ============================================================
async function geolocateIP(ipAddress) {
  try {
    // Ne pas géolocaliser les IPs privées ou invalides
    if (!ipAddress || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
      return { status: 'private_ip' };
    }

    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,city,lat,lon,isp`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        status: 'success',
        country: data.country,
        city: data.city,
        latitude: data.lat,
        longitude: data.lon,
        isp: data.isp
      };
    }
    return { status: 'failed' };
  } catch (error) {
    console.error('Erreur géolocalisation:', error.message);
    return { status: 'error', message: error.message };
  }
}

// Configuration CORS pour accepter les requêtes du client Electron
const corsOptions = {
  origin: function (origin, callback) {
    // En développement, accepter localhost et 127.0.0.1
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:*',
      'http://127.0.0.1:*',
      'https://server-navigateur.onrender.com',
      process.env.CLIENT_URL // URL du client Electron (ex: https://votre-app.com)
    ].filter(Boolean);

    // Si pas d'origin (app Electron) ou origin autorisé, accepter
    if (!origin || allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        return origin.startsWith(allowed.replace(':*', ''));
      }
      return origin === allowed;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// ENDPOINT : POST /api/login
// Authentifier l'utilisateur et retourner un token
// ============================================================
app.post('/api/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Mot de passe requis' });
  }

  // Vérifier le mot de passe
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  // Générer un token simple (en production, utiliser JWT)
  const token = Buffer.from(`${Date.now()}:${Math.random()}`).toString('base64');
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  res.json({
    success: true,
    token,
    expires,
    message: 'Authentification réussie'
  });
});

// Middleware pour vérifier le token lors de l'accès au dashboard
function authenticateToken(req, res, next) {
  // Récupérer le token du header ou des cookies
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  // Pour les requêtes GET /admin-panel/*, accepter aussi le token en localStorage (côté client)
  // Le vrai check se fera côté client
  
  if (!token) {
    // Token manquant - laisser passer, le client redirigera vers login
    return next();
  }

  // Token fourni - on pourrait valider ici en production
  next();
}

// Serve static files from the src directory (for admin dashboard)
app.use('/admin-panel', authenticateToken, express.static(path.join(__dirname, 'src')));

// Route to serve login.html
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'login.html'));
});

// Redirect from / and /admin to the login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/login.html');
});

// Serve other static files (login-renderer.js, etc) from src directory
app.use('/', express.static(path.join(__dirname, 'src'), {
  extensions: ['html', 'js', 'css']
}));

// Helper to read database
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return [];
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading DB file:', error);
    return [];
  }
}

// Helper to write database
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to DB file:', error);
  }
}

// Helper to read URLs database
function readUrlsDatabase() {
  try {
    if (!fs.existsSync(URLS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(URLS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading URLs DB file:', error);
    return [];
  }
}

// Helper to write URLs database
function writeUrlsDatabase(data) {
  try {
    fs.writeFileSync(URLS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to URLs DB file:', error);
  }
}

// Route to record a visited URL
app.post('/api/urls', (req, res) => {
  const { mac, url, timestamp } = req.body;

  if (!mac || !url) {
    return res.status(400).json({ error: 'mac and url are required' });
  }

  const db = readUrlsDatabase();
  const urlRecord = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    mac: mac.toUpperCase(),
    url,
    timestamp: timestamp || new Date().toISOString()
  };

  db.unshift(urlRecord);
  writeUrlsDatabase(db);

  console.log(`[+] URL enregistrée : MAC=${mac}, URL=${url}`);
  res.status(201).json({ success: true, record: urlRecord });
});

// Route to get all connections
app.get('/api/connections', (req, res) => {
  const db = readDatabase();
  const countByAddress = db.reduce((acc, conn) => {
    const key = conn.observedIp || conn.publicIp || conn.localIp || conn.mac;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const enriched = db.map(conn => ({
    ...conn,
    count: countByAddress[conn.observedIp || conn.publicIp || conn.localIp || conn.mac] || 1
  }));

  res.json(enriched);
});

// Route to get users summary (grouped by MAC) with geolocation
app.get('/api/users', (req, res) => {
  const db = readDatabase();
  const urlsDb = readUrlsDatabase();
  
  // Group by MAC to create unique users
  const usersByMac = db.reduce((acc, conn) => {
    const key = conn.mac;
    if (!acc[key]) {
      acc[key] = {
        mac: conn.mac,
        localIp: conn.localIp,
        publicIp: conn.publicIp,
        observedIp: conn.observedIp,
        count: 0,
        firstSeen: conn.timestamp,
        lastSeen: conn.timestamp,
        connections: [],
        urls: [],
        geolocation: conn.geolocation // Inclure la géolocalisation
      };
    }
    acc[key].count += 1;
    acc[key].lastSeen = conn.timestamp;
    acc[key].connections.push(conn);
    
    // Mettre à jour la géolocalisation si elle est disponible
    if (conn.geolocation && !acc[key].geolocation) {
      acc[key].geolocation = conn.geolocation;
    }
    
    return acc;
  }, {});

  // Attach URLs to each user
  urlsDb.forEach(urlRecord => {
    const userKey = urlRecord.mac;
    if (usersByMac[userKey]) {
      usersByMac[userKey].urls.push(urlRecord);
    }
  });

  const users = Object.values(usersByMac).sort((a, b) => 
    new Date(b.lastSeen) - new Date(a.lastSeen)
  );

  res.json(users);
});

// Route to save a connection with geolocation
app.post('/api/connections', async (req, res) => {
  const { localIp, mac, publicIp } = req.body;

  if (!localIp || !mac) {
    return res.status(400).json({ error: 'localIp and mac are required' });
  }

  const db = readDatabase();
  // IP observée par le serveur (peut provenir de X-Forwarded-For si proxy)
  const observedIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Créer la connexion de base
  const newConnection = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    localIp,
    mac: mac.toUpperCase(),
    publicIp: publicIp || 'Inconnu',
    observedIp,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown',
    geolocation: null // Sera rempli asynchronement
  };

  db.unshift(newConnection);
  writeDatabase(db);

  console.log(`[+] Nouvelle connexion enregistrée : IP=${localIp}, MAC=${mac}`);
  
  // Géolocaliser l'IP publique en arrière-plan (non-bloquant)
  if (publicIp && publicIp !== 'Inconnu') {
    geolocateIP(publicIp).then(geoData => {
      if (geoData.status === 'success') {
        newConnection.geolocation = {
          country: geoData.country,
          city: geoData.city,
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          isp: geoData.isp
        };
        writeDatabase(db); // Sauvegarder les données mises à jour
        console.log(`[🌍] Géolocalisation : ${newConnection.mac} → ${geoData.city}, ${geoData.country}`);
      }
    }).catch(err => console.error('[⚠️] Erreur géolocalisation:', err));
  }

  res.status(201).json({ success: true, connection: newConnection });
});

// Redirect from / and /admin to the login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/login.html');
});

// ============================================================
// ENDPOINT : GET /api/geolocation/:ip
// Retourne les données de géolocalisation pour une IP donnée
// ============================================================
app.get('/api/geolocation/:ip', async (req, res) => {
  const ipAddress = req.params.ip;
  
  if (!ipAddress) {
    return res.status(400).json({ error: 'IP address required' });
  }

  const geoData = await geolocateIP(ipAddress);
  res.json(geoData);
});

// ============================================================
// ENDPOINT : POST /api/sync
// Synchroniser les données de l'utilisateur (histoire, favoris, mots de passe)
// ============================================================
app.post('/api/sync', (req, res) => {
  try {
    const { userId, history, bookmarks, passwords } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    // Créer ou mettre à jour le fichier de sync de l'utilisateur
    const userSyncFile = path.join(__dirname, `user-sync-${userId}.json`);
    const syncData = {
      userId,
      history: history || [],
      bookmarks: bookmarks || [],
      passwords: passwords || [],
      syncedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(userSyncFile, JSON.stringify(syncData, null, 2));
    
    res.json({ success: true, message: 'Données synchronisées' });
  } catch (error) {
    console.error('Erreur sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ENDPOINTS : Google OAuth & Configuration
// ============================================================

// Route pour enregistrer la configuration Google OAuth
app.post('/auth/google/configure', (req, res) => {
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret) {
    return res.status(400).send('Le Client ID et le Client Secret sont requis.');
  }

  try {
    const config = { client_id: client_id.trim(), client_secret: client_secret.trim() };
    fs.writeFileSync(GOOGLE_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    
    // Tenter de mettre à jour le fichier .env si présent
    let envContent = '';
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (envContent.includes('GOOGLE_CLIENT_ID=')) {
      envContent = envContent.replace(/GOOGLE_CLIENT_ID=.*/g, `GOOGLE_CLIENT_ID=${config.client_id}`);
    } else {
      envContent += `\nGOOGLE_CLIENT_ID=${config.client_id}`;
    }
    
    if (envContent.includes('GOOGLE_CLIENT_SECRET=')) {
      envContent = envContent.replace(/GOOGLE_CLIENT_SECRET=.*/g, `GOOGLE_CLIENT_SECRET=${config.client_secret}`);
    } else {
      envContent += `\nGOOGLE_CLIENT_SECRET=${config.client_secret}`;
    }
    
    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
    
    // Mettre à jour l'environnement en mémoire
    process.env.GOOGLE_CLIENT_ID = config.client_id;
    process.env.GOOGLE_CLIENT_SECRET = config.client_secret;

    console.log('[+] Google OAuth configuré avec succès !');
    res.redirect('/auth/google');
  } catch (error) {
    console.error('Erreur lors de la configuration Google:', error);
    res.status(500).send(`Erreur serveur lors de la sauvegarde : ${error.message}`);
  }
});

// Route principale Google OAuth
app.get('/auth/google', (req, res) => {
  const { client_id, client_secret } = getGoogleConfig();
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;

  // Si non configuré, afficher le formulaire d'aide à la configuration (Design Premium)
  if (!client_id || !client_secret) {
    return res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configuration Google OAuth</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(22, 28, 45, 0.6);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --warning: #f59e0b;
      --input-bg: rgba(15, 23, 42, 0.8);
    }
    
    body {
      margin: 0;
      padding: 0;
      background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 40%),
                  radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.05), transparent 40%),
                  var(--bg);
      background-attachment: fixed;
      font-family: 'Outfit', sans-serif;
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }

    .container {
      width: 100%;
      max-width: 550px;
      padding: 24px;
      box-sizing: border-box;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #6366f1, #10b981);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .logo svg {
      width: 32px;
      height: 32px;
    }

    .logo h1 {
      font-size: 24px;
      margin: 0;
      font-weight: 700;
      background: linear-gradient(135deg, #fff 60%, #a5b4fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    h2 {
      font-size: 18px;
      margin-top: 0;
      margin-bottom: 16px;
      font-weight: 600;
      color: #fff;
    }

    p {
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1.6;
      margin-top: 0;
      margin-bottom: 20px;
    }

    .steps {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .step-item {
      font-size: 13.5px;
      line-height: 1.5;
      margin-bottom: 14px;
      padding-left: 28px;
      position: relative;
    }

    .step-item:last-child {
      margin-bottom: 0;
    }

    .step-number {
      position: absolute;
      left: 0;
      top: 1px;
      width: 18px;
      height: 18px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #a5b4fc;
      border-radius: 50%;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }

    .code-box {
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: monospace;
      font-size: 12px;
      color: #a5b4fc;
      word-break: break-all;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      gap: 12px;
    }

    .copy-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      transition: background 0.2s, border-color 0.2s;
      white-space: nowrap;
    }

    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #a5b4fc;
      letter-spacing: 0.5px;
    }

    input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--input-bg);
      border: 1px solid var(--border);
      color: #fff;
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input[type="text"]:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .btn-submit {
      width: 100%;
      padding: 14px;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 10px;
    }

    .btn-submit:hover {
      background: var(--primary-hover);
    }
    
    a {
      color: #818cf8;
      text-decoration: none;
      border-bottom: 1px dashed rgba(129, 140, 248, 0.4);
      transition: border-color 0.2s;
    }
    a:hover {
      border-bottom-color: #818cf8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.75-.57-1.3-1.37-1.67-2.23z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <h1>WAPI Browser</h1>
      </div>
      
      <h2>Configuration Google OAuth</h2>
      <p>Configurez la connexion à Google Cloud pour permettre aux utilisateurs de lier leur compte Gmail réel.</p>
      
      <div class="steps">
        <div class="step-item">
          <span class="step-number">1</span>
          Créez un projet sur la <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a>.
        </div>
        <div class="step-item">
          <span class="step-number">2</span>
          Configurez l'écran de consentement OAuth (User Type : Externe).
        </div>
        <div class="step-item">
          <span class="step-number">3</span>
          Créez des identifiants &rarr; **ID de client OAuth** (Application Web).
        </div>
        <div class="step-item">
          <span class="step-number">4</span>
          Ajoutez l'URL suivante dans les **URI de redirection autorisés** :
          <div class="code-box">
            <span id="redirect-uri">${redirectUri}</span>
            <button type="button" class="copy-btn" onclick="copyUri()">Copier</button>
          </div>
        </div>
      </div>
      
      <form action="/auth/google/configure" method="POST">
        <div class="form-group">
          <label for="client_id">GOOGLE CLIENT ID</label>
          <input type="text" id="client_id" name="client_id" placeholder="Ex: 123456-abcdef.apps.googleusercontent.com" required autocomplete="off">
        </div>
        <div class="form-group">
          <label for="client_secret">GOOGLE CLIENT SECRET</label>
          <input type="text" id="client_secret" name="client_secret" placeholder="Ex: GOCSPX-abcdef123..." required autocomplete="off">
        </div>
        <button type="submit" class="btn-submit">Enregistrer & démarrer la connexion</button>
      </form>
    </div>
  </div>
  
  <script>
    function copyUri() {
      const uriText = document.getElementById('redirect-uri').textContent;
      navigator.clipboard.writeText(uriText).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copié !';
        btn.style.background = 'var(--success)';
        btn.style.borderColor = 'transparent';
        setTimeout(() => {
          btn.textContent = 'Copier';
          btn.style.background = 'rgba(255, 255, 255, 0.05)';
          btn.style.borderColor = 'var(--border)';
        }, 1500);
      });
    }
  </script>
</body>
</html>
    `);
  }

  // Si configuré, rediriger vers l'écran Google OAuth officiel
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    prompt: 'select_account'
  }).toString();

  res.redirect(googleAuthUrl);
});

// Route de callback Google OAuth
app.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('[Google OAuth] Erreur reçue de Google:', error);
    return res.send(renderAuthErrorPage(`Erreur retournée par Google : ${error}`));
  }
  
  if (!code) {
    return res.status(400).send('Le code d\'autorisation Google est manquant.');
  }

  const { client_id, client_secret } = getGoogleConfig();
  if (!client_id || !client_secret) {
    return res.status(500).send('Configuration Google OAuth incomplète.');
  }

  const redirectUri = `${req.protocol}://${req.get('host')}/auth/google/callback`;

  try {
    // Échanger le code contre un access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('[Google OAuth] L\'échange de code a échoué:', errText);
      return res.send(renderAuthErrorPage(`Échec lors de l'obtention des accès auprès de Google : ${errText}`));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Récupérer les informations de profil utilisateur Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!profileResponse.ok) {
      const errText = await profileResponse.text();
      console.error('[Google OAuth] Erreur récupération profil:', errText);
      return res.send(renderAuthErrorPage(`Échec lors de la récupération des détails de votre profil : ${errText}`));
    }

    const profileData = await profileResponse.json();

    // Formater l'objet utilisateur
    const user = {
      id: 'google-' + profileData.sub,
      name: profileData.name,
      email: profileData.email,
      picture: profileData.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=6366f1&color=fff`,
      token: accessToken
    };

    console.log(`[+] Connexion réussie pour l'utilisateur Gmail : ${user.name} (${user.email})`);

    // Afficher l'écran de succès et renvoyer les données à la fenêtre parente (Electron)
    res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Connexion Réussie</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      font-family: 'Outfit', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(22, 28, 45, 0.6);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 32px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      max-width: 400px;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: #6366f1;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
      display: inline-block;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h2 { margin: 0 0 10px 0; color: #fff; }
    p { color: #9ca3af; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Connexion réussie !</h2>
    <p>Transfert en cours vers le navigateur WAPI...</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: 'GOOGLE_AUTH_SUCCESS',
        user: ${JSON.stringify(user)}
      }, '*');
      setTimeout(() => {
        window.close();
      }, 800);
    } else {
      document.querySelector('.spinner').style.display = 'none';
      document.querySelector('h2').textContent = 'Connexion active';
      document.querySelector('p').textContent = 'Vous pouvez fermer cette fenêtre maintenant.';
    }
  </script>
</body>
</html>
    `);
  } catch (error) {
    console.error('[Google OAuth] Erreur inattendue:', error);
    res.send(renderAuthErrorPage(`Erreur lors du traitement : ${error.message}`));
  }
});

// Helper pour afficher une page d'erreur esthétique
function renderAuthErrorPage(errorMessage) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Erreur de connexion</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #0b0f19;
      color: #f3f4f6;
      font-family: 'Outfit', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: rgba(22, 28, 45, 0.6);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 32px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      max-width: 450px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h2 { margin: 0 0 10px 0; color: #ef4444; }
    p { color: #9ca3af; font-size: 14px; line-height: 1.5; word-break: break-word; }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: #6366f1;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h2>Échec de la connexion</h2>
    <p>${errorMessage}</p>
    <a href="/auth/google" class="btn">Réessayer</a>
  </div>
</body>
</html>
  `;
}

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   SERVEUR WAPI ACTIF`);
  console.log(`   Port : ${PORT}`);
  console.log(`   Environnement : ${NODE_ENV}`);
  console.log(`   Tableau de bord : http://localhost:${PORT}/admin`);
  console.log(`==================================================`);
});
