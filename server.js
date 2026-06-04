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

// Configuration CORS pour accepter les requêtes du client Electron
const corsOptions = {
  origin: function (origin, callback) {
    // En développement, accepter localhost et 127.0.0.1
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:*',
      'http://127.0.0.1:*',
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

// Route to get users summary (grouped by MAC)
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
        urls: []
      };
    }
    acc[key].count += 1;
    acc[key].lastSeen = conn.timestamp;
    acc[key].connections.push(conn);
    
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

// Route to save a connection
app.post('/api/connections', (req, res) => {
  const { localIp, mac, publicIp } = req.body;

  if (!localIp || !mac) {
    return res.status(400).json({ error: 'localIp and mac are required' });
  }

  const db = readDatabase();
  // IP observée par le serveur (peut provenir de X-Forwarded-For si proxy)
  const observedIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const newConnection = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    localIp,
    mac: mac.toUpperCase(),
    publicIp: publicIp || 'Inconnu',
    observedIp,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown'
  };

  db.unshift(newConnection); // Add to the beginning of the array (most recent first)
  writeDatabase(db);

  console.log(`[+] Nouvelle connexion enregistrée : IP=${localIp}, MAC=${mac}`);
  res.status(201).json({ success: true, connection: newConnection });
});

// Redirect from / and /admin to the login page
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   SERVEUR WAPI ACTIF`);
  console.log(`   Port : ${PORT}`);
  console.log(`   Environnement : ${NODE_ENV}`);
  console.log(`   Tableau de bord : http://localhost:${PORT}/admin`);
  console.log(`==================================================`);
});
