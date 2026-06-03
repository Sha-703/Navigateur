require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_FILE = path.join(__dirname, 'connections-db.json');

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

// Serve static files from the src directory (for admin dashboard)
app.use('/admin-panel', express.static(path.join(__dirname, 'src')));

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

// Route to get all connections
app.get('/api/connections', (req, res) => {
  res.json(readDatabase());
});

// Route to save a connection
app.post('/api/connections', (req, res) => {
  const { localIp, mac, publicIp } = req.body;

  if (!localIp || !mac) {
    return res.status(400).json({ error: 'localIp and mac are required' });
  }

  const db = readDatabase();
  
  const newConnection = {
    id: '_' + Math.random().toString(36).substr(2, 9),
    localIp,
    mac: mac.toUpperCase(),
    publicIp: publicIp || 'Inconnu',
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown'
  };

  db.unshift(newConnection); // Add to the beginning of the array (most recent first)
  writeDatabase(db);

  console.log(`[+] Nouvelle connexion enregistrée : IP=${localIp}, MAC=${mac}`);
  res.status(201).json({ success: true, connection: newConnection });
});

// Redirect from / and /admin to the admin-panel path
app.get('/', (req, res) => {
  res.redirect('/admin-panel/admin.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin-panel/admin.html');
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   SERVEUR WAPI ACTIF`);
  console.log(`   Port : ${PORT}`);
  console.log(`   Environnement : ${NODE_ENV}`);
  console.log(`   Tableau de bord : http://localhost:${PORT}/admin`);
  console.log(`==================================================`);
});
