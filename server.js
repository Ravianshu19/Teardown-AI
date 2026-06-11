/**
 * TeardownAI — Proxy Server
 * Sits between the browser and Anthropic API to handle CORS + API key injection.
 * Deploy on: Railway, Render, Fly.io, Vercel (serverless), or any Node host.
 *
 * Setup:
 *   npm install
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 */

const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const path     = require('path');
const fs       = require('fs');

// Load .env file manually if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index > -1) {
          const key = trimmed.substring(0, index).trim();
          let val = trimmed.substring(index + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (key) {
            process.env[key] = val;
          }
        }
      }
    });
  } catch (e) {
    console.error('Error reading .env file:', e.message);
  }
}

const app  = express();
const PORT = process.env.PORT || 3000;
const KEY      = process.env.ANTHROPIC_API_KEY || '';
const RZP_KEY  = process.env.RAZORPAY_KEY_ID     || 'rzp_test_SyRjWkQSmF4vn4';   // from dashboard.razorpay.com → Settings → API Keys
const RZP_SEC  = process.env.RAZORPAY_KEY_SECRET || '369647Ya8uijAO1Z5gxbI2Nl';   // keep secret — never send to browser

if (!KEY || KEY.includes('YOUR_KEY_HERE')) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set or is placeholder — /api/analyze will return 500');
}


// Allow requests from any origin (your hosted frontend)
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve the frontend HTML
app.use(express.static(path.join(__dirname, 'public')));

// ── Proxy endpoint ──
app.post('/api/analyze', async (req, res) => {
  if (!KEY) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message || 'Proxy error' });
  }
});

// ── Database and Auth Implementation ──
const DB_FILE = path.join(__dirname, 'database.json');

// Helper to load/save database
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading JSON database, resetting:', e);
    return { users: {} };
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving JSON database:', e);
  }
}

// Secure hashing using PBKDF2
function hashPassword(password, salt) {
  const crypto = require('crypto');
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Register User
app.post('/api/register', (req, res) => {
  const crypto = require('crypto');
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const db = loadDB();
  const lowerEmail = email.toLowerCase().trim();
  
  if (db.users[lowerEmail]) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const token = crypto.randomBytes(24).toString('hex');

  const isDeveloper = lowerEmail.includes('developer');
  db.users[lowerEmail] = {
    name,
    email: lowerEmail,
    passwordHash,
    salt,
    token,
    reports: isDeveloper ? [
      {name:'Notion',score:88,score_ux:85,score_market:82,score_moat:78,score_growth:86,score_revenue:80,score_retention:84,date:'Jun 3, 2025',ts:Date.now()-7200000, domain:'notion.so',  col:'ic-o',saved:true, note:''},
      {name:'Stripe',score:94,score_ux:90,score_market:88,score_moat:92,score_growth:86,score_revenue:92,score_retention:90,date:'May 28, 2025',ts:Date.now()-86400000,domain:'stripe.com',col:'ic-g',saved:true, note:'Great revenue model'},
      {name:'Figma', score:91,score_ux:92,score_market:85,score_moat:88,score_growth:84,score_revenue:82,score_retention:89,date:'May 25, 2025',ts:Date.now()-259200000,domain:'figma.com',col:'ic-b',saved:false,note:''}
    ] : [],
    plan: isDeveloper ? 'Pro' : 'Free',
    credits: isDeveloper ? 72 : 10,
    maxCreds: isDeveloper ? 100 : 10,
    team: isDeveloper ? [
      {initials: name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2), name: name + ' (Admin)', role: 'admin', tears: 0, lastActive: 'Online now', col: 'ic-g'},
      {initials:'AR',name:'Ananya R.', role:'member',tears:12,lastActive:'1 day ago',   col:'ic-b'},
      {initials:'MK',name:'Mohan K.', role:'member',tears:7, lastActive:'3 days ago',  col:'ic-o'},
    ] : [
      { initials: name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2), name: name + ' (Admin)', role: 'admin', tears: 0, lastActive: 'Online now', col: 'ic-g' }
    ]
  };

  saveDB(db);
  res.json({
    token,
    name,
    email: lowerEmail,
    plan: db.users[lowerEmail].plan,
    credits: db.users[lowerEmail].credits,
    maxCreds: db.users[lowerEmail].maxCreds,
    team: db.users[lowerEmail].team
  });
});

// Login User
app.post('/api/login', (req, res) => {
  const crypto = require('crypto');
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = loadDB();
  const lowerEmail = email.toLowerCase().trim();
  const user = db.users[lowerEmail];

  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  const checkHash = hashPassword(password, user.salt);
  if (checkHash !== user.passwordHash) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  user.token = token;
  saveDB(db);

  res.json({
    token,
    name: user.name,
    email: user.email,
    plan: user.plan || 'Free',
    credits: user.credits !== undefined ? user.credits : 10,
    maxCreds: user.maxCreds || 10,
    team: user.team || [
      { initials: user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2), name: user.name + ' (Admin)', role: 'admin', tears: 0, lastActive: 'Online now', col: 'ic-g' }
    ]
  });
});

// Validate Session
app.get('/api/session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();

  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  res.json({
    name: user.name,
    email: user.email,
    plan: user.plan || 'Free',
    credits: user.credits !== undefined ? user.credits : 10,
    maxCreds: user.maxCreds || 10,
    team: user.team || [
      { initials: user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2), name: user.name + ' (Admin)', role: 'admin', tears: 0, lastActive: 'Online now', col: 'ic-g' }
    ]
  });
});

// Get User Reports
app.get('/api/reports', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();

  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  res.json({ reports: user.reports || [] });
});

// Save User Report
app.post('/api/reports', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();

  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const report = req.body;
  if (!report || !report.name) {
    return res.status(400).json({ error: 'Invalid report data.' });
  }

  if (!report.id) {
    const crypto = require('crypto');
    report.id = Date.now().toString() + '_' + crypto.randomBytes(4).toString('hex');
  }
  report.ts = report.ts || Date.now();
  report.date = report.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Decrement user credit
  if (user.credits === undefined) user.credits = 10;
  if (user.credits > 0 && user.plan !== 'Pro') { // Pro tier has unlimited mock credits
    user.credits--;
  }

  // Increment tears count for admin in team
  user.team = user.team || [
    { initials: user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2), name: user.name + ' (Admin)', role: 'admin', tears: 0, lastActive: 'Online now', col: 'ic-g' }
  ];
  const admin = user.team.find(m => m.role === 'admin');
  if (admin) {
    admin.tears = (admin.tears || 0) + 1;
  }

  user.reports = (user.reports || []).filter(r => r.id !== report.id && r.name !== report.name);
  user.reports.unshift(report);

  saveDB(db);
  res.json({ success: true, report, credits: user.credits });
});

// Delete User Report
app.delete('/api/reports/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();

  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const reportId = req.params.id;
  user.reports = (user.reports || []).filter(r => r.id !== reportId);
  saveDB(db);

  res.json({ success: true });
});

// Verify Razorpay payment server-side (call this from your frontend after payment success)
app.post('/api/verify-payment', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();
  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const crypto = require('crypto');
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    return res.status(400).json({ error: 'Missing signature details or plan.' });
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto.createHmac('sha256', RZP_SEC).update(body).digest('hex');
  if (expected === razorpay_signature) {
    const normalizedPlan = plan.toLowerCase();
    user.plan = normalizedPlan === 'pro' ? 'Pro' : (normalizedPlan === 'student' ? 'Student' : 'Free');
    user.credits = normalizedPlan === 'pro' ? 500 : (normalizedPlan === 'student' ? 15 : 10);
    user.maxCreds = user.credits;
    saveDB(db);
    
    res.json({ verified: true, plan: user.plan, credits: user.credits, maxCreds: user.maxCreds });
  } else {
    res.status(400).json({ verified: false, error: 'Signature verification failed' });
  }
});

// Invite Team Member
app.post('/api/team/invite', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();
  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  user.team = user.team || [
    { initials: user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2), name: user.name + ' (Admin)', role: 'admin', tears: 0, lastActive: 'Online now', col: 'ic-g' }
  ];

  const lowerEmail = email.toLowerCase().trim();
  const exists = user.team.some(m => m.name.toLowerCase() === lowerEmail);
  if (exists) {
    return res.status(400).json({ error: 'Member already in team.' });
  }

  const cols = ['ic-b', 'ic-o', 'ic-g'];
  user.team.push({
    initials: lowerEmail[0].toUpperCase(),
    name: lowerEmail,
    role: 'member',
    tears: 0,
    lastActive: 'Invited',
    col: cols[user.team.length % 3]
  });

  saveDB(db);
  res.json({ success: true, team: user.team });
});

// Delete Team Member
app.delete('/api/team/:email', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  const token = authHeader.split(' ')[1];
  const db = loadDB();
  const user = Object.values(db.users).find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const targetEmail = req.params.email.toLowerCase().trim();
  user.team = (user.team || []).filter(m => m.role === 'admin' || m.name.toLowerCase() !== targetEmail);

  saveDB(db);
  res.json({ success: true, team: user.team });
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', razorpay: !!RZP_KEY, razorpayKey: RZP_KEY, anthropic: !!KEY }));

/* Always return JSON errors, never HTML */
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`TeardownAI proxy running on http://localhost:${PORT}`);
  console.log(`Anthropic key: ${KEY ? 'SET ✓' : 'MISSING ✗ — set ANTHROPIC_API_KEY in .env'}`);
  console.log(`Razorpay key:  ${RZP_KEY ? 'SET ✓' : 'MISSING ✗ — set RAZORPAY_KEY_ID in .env'}`);
});
