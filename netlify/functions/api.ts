import express, { Router } from 'express';
import serverless from 'serverless-http';

const api = express();
const router = Router();

// --- IN-MEMORY LOGGING (Note: Resets on Serverless Cold Start) ---
// In a real production app, use a database (Supabase/Firebase) for persistent logs.
let systemLogs: any[] = [];
const MAX_LOGS = 50;

const addSystemLog = (method: string, url: string, status: number, outcome: string, source: string, payload: any) => {
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    method,
    path: url,
    status,
    outcome,
    source,
    payload: payload || {}
  };
  
  systemLogs.unshift(logEntry);
  if (systemLogs.length > MAX_LOGS) systemLogs.pop();
};

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hewdes_rttf0kd11o1axrmc';

// --- ROUTES ---

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hewdes CRM (Netlify Function) is Running' });
});

router.get('/logs', (req, res) => {
  res.json(systemLogs);
});

// Webhook Verification (Instagram)
router.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      addSystemLog('GET', '/webhook/instagram', 200, 'Verification Success', 'instagram', req.query);
      res.status(200).send(challenge);
    } else {
      addSystemLog('GET', '/webhook/instagram', 403, 'Verification Failed', 'instagram', req.query);
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Webhook Event (Instagram)
router.post('/webhook/instagram', (req, res) => {
  addSystemLog('POST', '/webhook/instagram', 200, 'Event Received', 'instagram', req.body);
  res.status(200).send('EVENT_RECEIVED');
});

// Webhook Verification (WhatsApp)
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      addSystemLog('GET', '/webhook/whatsapp', 200, 'Verification Success', 'whatsapp', req.query);
      res.status(200).send(challenge);
    } else {
      addSystemLog('GET', '/webhook/whatsapp', 403, 'Verification Failed', 'whatsapp', req.query);
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Webhook Event (WhatsApp)
router.post('/webhook/whatsapp', (req, res) => {
  addSystemLog('POST', '/webhook/whatsapp', 200, 'Event Received', 'whatsapp', req.body);
  res.status(200).send('EVENT_RECEIVED');
});

// Mount router
api.use('/api', router); // For /api/logs
api.use('/', router);    // For /health and /webhook

export const handler = serverless(api);