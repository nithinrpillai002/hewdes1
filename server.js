console.log('--- Starting server.js execution ---');

const express = require('express');
const path = require('path');
const app = express();

// --- ENV & CONSTANTS ---
const PORT = process.env.PORT || 8080;
// This token must match what you enter in the Meta/Facebook App Dashboard
const VERIFY_TOKEN = 'hewdes_rttf0kd11o1axrmc';

// --- IN-MEMORY LOGGING ---
const systemLogs = [];
const MAX_LOGS = 50;

const addLog = (req, status, outcome) => {
  const source = req.url.includes('instagram') ? 'instagram' : (req.url.includes('whatsapp') ? 'whatsapp' : 'system');
  
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.url.split('?')[0],
    status: status,
    outcome: outcome,
    source: source,
    payload: {
      query: req.query,
      body: req.body
    }
  };

  systemLogs.unshift(logEntry); // Add to beginning
  if (systemLogs.length > MAX_LOGS) {
    systemLogs.pop();
  }
};

// --- MIDDLEWARE ---

// 1. CORS Middleware (Crucial for Local Development with separate frontend/backend)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 2. Parse JSON for POST requests (Webhooks)
app.use(express.json());

// 3. Logging Middleware - Logs every single request hitting the server
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  // Log query params for debugging verification requests
  if (Object.keys(req.query).length > 0) {
    console.log('  Query Details:', JSON.stringify(req.query));
  }
  next();
});

// --- API ROUTES (Defined BEFORE static files) ---

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('Server is healthy and running.');
});

// GET LOGS Endpoint for Frontend Settings Page
app.get('/api/logs', (req, res) => {
  res.json(systemLogs);
});

// ==========================================
// INSTAGRAM WEBHOOKS
// ==========================================

// Verification Endpoint (GET)
app.get('/webhook/instagram', (req, res) => {
  console.log('>>> [INSTAGRAM] Incoming Verification Request');
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`    Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('>>> [INSTAGRAM] WEBHOOK_VERIFIED');
      addLog(req, 200, 'Verification Successful');
      // Respond with the challenge token to confirm verification. 
      // STRICT: Must be a string.
      res.status(200).send(challenge.toString());
    } else {
      console.error('>>> [INSTAGRAM] Verification Failed: Token Mismatch');
      console.error(`    Expected: ${VERIFY_TOKEN}, Received: ${token}`);
      addLog(req, 403, 'Verification Failed: Token Mismatch');
      res.sendStatus(403);
    }
  } else {
    console.error('>>> [INSTAGRAM] Verification Failed: Missing Parameters');
    addLog(req, 400, 'Verification Failed: Missing Parameters');
    res.status(400).send('Missing parameters');
  }
});

// Event Handler (POST)
app.post('/webhook/instagram', (req, res) => {
  console.log('>>> [INSTAGRAM] Incoming Event (POST)');
  const body = req.body;

  // Log the event payload safely
  try {
    console.log(JSON.stringify(body, null, 2));
  } catch (e) {
    console.log('Raw Body:', body);
  }

  // Acknowledge receipt immediately to avoid timeouts
  if (body.object === 'instagram' || body.object === 'page') {
    addLog(req, 200, 'Event Received');
    res.status(200).send('EVENT_RECEIVED');
  } else {
    addLog(req, 404, 'Invalid Event Object');
    res.sendStatus(404);
  }
});

// ==========================================
// WHATSAPP WEBHOOKS
// ==========================================

// Verification Endpoint (GET)
app.get('/webhook/whatsapp', (req, res) => {
  console.log('>>> [WHATSAPP] Incoming Verification Request');

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`    Mode: ${mode}, Token: ${token}, Challenge: ${challenge}`);

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('>>> [WHATSAPP] WEBHOOK_VERIFIED');
      addLog(req, 200, 'Verification Successful');
      // STRICT: Must be a string.
      res.status(200).send(challenge.toString());
    } else {
      console.error('>>> [WHATSAPP] Verification Failed: Token Mismatch');
      console.error(`    Expected: ${VERIFY_TOKEN}, Received: ${token}`);
      addLog(req, 403, 'Verification Failed: Token Mismatch');
      res.sendStatus(403);
    }
  } else {
    console.error('>>> [WHATSAPP] Verification Failed: Missing Parameters');
    addLog(req, 400, 'Verification Failed: Missing Parameters');
    res.status(400).send('Missing parameters');
  }
});

// Event Handler (POST)
app.post('/webhook/whatsapp', (req, res) => {
  console.log('>>> [WHATSAPP] Incoming Event (POST)');
  const body = req.body;

  if (body.object) {
    addLog(req, 200, 'Event Received');
    console.log(JSON.stringify(body, null, 2));
    res.status(200).send('EVENT_RECEIVED');
  } else {
    addLog(req, 404, 'Invalid Event Object');
    res.sendStatus(404);
  }
});

// --- STATIC FILES & FRONTEND ---
// Serve static files unconditionally to support both Local and Production environments.
// This allows 'node server.js' to serve the app locally at localhost:8080
app.use(express.static(path.resolve(__dirname)));

// Catch-all handler for React (SPA behavior)
// This MUST be the last route to prevent swallowing API requests
app.get('*', (req, res) => {
  // Only serve index.html for GET requests that accept HTML
  if (req.accepts('html')) {
    console.log('Serving index.html for path:', req.url);
    res.sendFile(path.resolve(__dirname, 'index.html'));
  } else {
    res.sendStatus(404);
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`\n--- Server Started on Port ${PORT} ---`);
  console.log(`Verify Token: ${VERIFY_TOKEN}`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`Instagram Webhook: http://localhost:${PORT}/webhook/instagram`);
  console.log(`WhatsApp Webhook: http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`API Logs: http://localhost:${PORT}/api/logs`);
  console.log('-------------------------------------\n');
});