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
// ENDPOINT : GET /auth/google
// Simule l'authentification Google (redirection + callback)
// En production, vous devriez utiliser google-auth-library
// ============================================================
app.get('/auth/google', (req, res) => {
  // Simulated Google OAuth response for demo
  // En production, implémenter l'OAuth flow réel avec Google
  const mockUser = {
    id: 'google-' + Math.random().toString(36).substr(2, 9),
    name: 'Demo User',
    email: 'user@gmail.com',
    picture: 'https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff',
    token: 'demo-token-' + Date.now()
  };
  
  // Retourner une page HTML qui envoie le message au parent
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Google Auth</title></head>
    <body>
      <h2>Connexion en cours...</h2>
      <script>
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_SUCCESS',
          user: ${JSON.stringify(mockUser)}
        }, '*');
        window.close();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   SERVEUR WAPI ACTIF`);
  console.log(`   Port : ${PORT}`);
  console.log(`   Environnement : ${NODE_ENV}`);
  console.log(`   Tableau de bord : http://localhost:${PORT}/admin`);
  console.log(`==================================================`);
});
