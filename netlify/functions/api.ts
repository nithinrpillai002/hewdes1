import express, { Router } from 'express';
import serverless from 'serverless-http';

const api = express();
const router = Router();

// --- KIE API CONFIG ---
const KIE_API_KEY = "3a748f6c1558e84cf2ca54b22c393832";

// --- IN-MEMORY LOGGING ---
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

// --- Mock Delivery API (Indian Context) ---
const checkDeliveryAPI = async (pincode: string): Promise<string> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Basic validation for Indian Pincode (6 digits)
  const validPincode = /^[1-9][0-9]{5}$/.test(pincode);
  if (!validPincode) {
    return "That doesn't look like a valid pincode. Could you please double-check? It should be 6 digits.";
  }
  
  // Simulate delivery estimates based on region (first digit)
  const regionDigit = parseInt(pincode[0]);
  let days = 3;
  let regionName = "Metro City";
  
  if (regionDigit <= 3) { days = 2; regionName = "North/West India"; }
  else if (regionDigit <= 6) { days = 3; regionName = "South/Central India"; }
  else { days = 5; regionName = "East/North-East India"; }

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + days);
  
  const options = { weekday: 'long', month: 'short', day: 'numeric' } as const;
  // @ts-ignore
  const formattedDate = deliveryDate.toLocaleDateString('en-IN', options);
  
  return `Good news, we service ${regionName}! If you order now, it should reach you by ${formattedDate} (approx ${days} days).`;
};

// --- LOGIC ENGINE (Replaces GenAI) ---
const processKieLogic = async (message: string, products: any[], rules: any[], platform: string) => {
    const lowerMsg = message.toLowerCase();
    
    // 1. Delivery Check (Pincode)
    const pincodeMatch = message.match(/\b[1-9][0-9]{5}\b/);
    if (pincodeMatch) {
        const result = await checkDeliveryAPI(pincodeMatch[0]);
        return { text: result, action: `Checked Pincode: ${pincodeMatch[0]}` };
    }
    if (lowerMsg.includes('delivery') || lowerMsg.includes('ship') || lowerMsg.includes('reach')) {
        return { text: "I can check that for you! Could you please share your 6-digit pincode?", action: "Requested Pincode" };
    }

    // 2. Product Inquiry
    if (products && products.length > 0) {
        const foundProduct = products.find((p: any) => lowerMsg.includes(p.name.toLowerCase()) || lowerMsg.includes(p.category.toLowerCase()));
        if (foundProduct) {
            return { 
                text: `Yes, we have the ${foundProduct.name}! It costs ₹${foundProduct.price}. ${foundProduct.description}`, 
                action: `Found Product: ${foundProduct.name}`
            };
        }
    }
    
    // 3. Escalation
    if (lowerMsg.includes('human') || lowerMsg.includes('support') || lowerMsg.includes('talk to person') || lowerMsg.includes('help')) {
        addSystemLog('POST', '/api/chat', 200, `Escalation Triggered`, platform, { reason: 'User requested support' });
        return { text: "I've notified a human agent to take over. They will contact you shortly via email.", action: "Escalated to Human" };
    }

    // 4. Greetings
    if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey')) {
        return { text: `Hello! Welcome to Hewdes Gifts on ${platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}. How can I help you pick the perfect gift today? 🎁`, action: null };
    }

    // 5. Default / Fallback (using rules)
    const activeRules = rules ? rules.filter((r: any) => r.isActive) : [];
    if (activeRules.length > 0) {
        // Simple fallback to the first instruction rule just to show customization
        const instruction = activeRules.find((r: any) => r.type === 'instruction');
        if (instruction) {
             return { text: `I'm here to help! ${instruction.content}`, action: null };
        }
    }

    return { text: "I'm your Hewdes Gifts assistant. You can ask me about our products, check delivery times with your pincode, or ask for gift ideas!", action: null };
};

// --- ROUTES ---

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hewdes CRM (Netlify Function) is Running' });
});

router.get('/logs', (req, res) => {
  res.json(systemLogs);
});

// Chat Endpoint
router.post('/chat', async (req, res) => {
  try {
    const { history, currentMessage, products, rules, platform } = req.body;

    // Validate KIE Token (Hardcoded check as requested)
    if (KIE_API_KEY !== "3a748f6c1558e84cf2ca54b22c393832") {
         console.error("Invalid KIE API Configuration");
         return res.status(500).json({ text: "System Configuration Error." });
    }

    const response = await processKieLogic(currentMessage, products, rules, platform);
    
    res.json({ text: response.text, actionTaken: response.action });

  } catch (e: any) {
    console.error("Error in Backend:", e);
    res.status(500).json({ text: "Sorry, I'm having trouble connecting right now.", actionTaken: "Backend Error" });
  }
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
api.use('/api', router); // For /api/logs and /api/chat
api.use('/', router);    // For /health and /webhook

export const handler = serverless(api);