
import express, { Router } from 'express';
import serverless from 'serverless-http';

const api = express();
const router = Router();

api.use(express.json() as any);
api.use(express.urlencoded({ extended: true }) as any);

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
const HARDCODED_KIE_KEY = '3a748f6c1558e84cf2ca54b22c393832';
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || ''; 
const GRAPH_VERSION = "v21.0";

// --- Real Meta API Call (Text Only) ---
async function sendToInstagram(recipientId: string, text: string) {
    if (!IG_ACCESS_TOKEN) {
        addSystemLog('POST', 'META_API', 400, 'Missing IG Token', 'instagram', { text });
        return;
    }

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${IG_ACCESS_TOKEN}`;
    const payload = {
        recipient: { id: recipientId },
        message: { text: text }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (!response.ok) {
            addSystemLog('POST', url, response.status, 'Meta API Error', 'instagram', data);
        } else {
            addSystemLog('POST', url, 200, 'Message Sent', 'instagram', { payload, response: data });
        }
    } catch (e: any) {
        addSystemLog('POST', url, 500, 'Fetch Error', 'instagram', { error: e.message });
    }
}

// --- KIE API Integration (Simple Text) ---
async function callKieGemini(messages: any[], apiKey: string) {
    const KIE_ENDPOINT = "https://api.kie.ai/gemini-3-flash/v1/chat/completions";
    
    // Simplified: No Tools, just text
    const body = {
        messages: messages,
        stream: false
    };

    try {
        const response = await fetch(KIE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`KIE API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[Netlify] Fetch Failed:", error);
        throw error;
    }
}

// --- Chat Endpoint (Manual Testing) ---
router.post('/chat', async (req, res) => {
  try {
    const { history = [], currentMessage, products = [], apiKey } = req.body || {};
    const effectiveApiKey = apiKey || HARDCODED_KIE_KEY;

    const productCatalog = Array.isArray(products) ? products.map((p: any) => 
      `${p.name} - ₹${p.price}`
    ).join('\n') : '';

    const systemMessage = {
        role: "developer",
        content: [{ 
            type: "text", 
            text: `You are a helpful assistant for Hewdes Gifts on Instagram. 
                   PRODUCTS:\n${productCatalog}\n
                   Keep answers short and friendly.` 
        }]
    };

    const conversationMessages = Array.isArray(history) ? history
        .map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: [{ type: "text", text: msg.content }]
        })) : [];

    conversationMessages.push({ role: "user", content: [{ type: "text", text: currentMessage }] });

    const payload: any[] = [systemMessage, ...conversationMessages];

    let kieResponse = await callKieGemini(payload, effectiveApiKey);
    const finalContent = kieResponse.choices?.[0]?.message?.content;
    let textResponse = "I'm not sure how to answer that.";
    
    if (typeof finalContent === 'string') textResponse = finalContent;

    res.json({ text: textResponse });

  } catch (e: any) {
    res.status(500).json({ text: `System Error: ${e.message}` });
  }
});

// --- Webhook Auto-Reply Logic ---
const processWebhookMessage = async (senderId: string, text: string) => {
    if (!text || !senderId) return;

    try {
        const systemMessage = {
            role: "developer",
            content: [{ type: "text", text: "You are the automated assistant for Hewdes Gifts. Be helpful, concise, and friendly." }]
        };
        const userMessage = { role: "user", content: [{ type: "text", text }] };
        
        const kieResponse = await callKieGemini([systemMessage, userMessage], HARDCODED_KIE_KEY);
        
        let replyText = "Thank you for your message!";
        const finalContent = kieResponse.choices?.[0]?.message?.content;
        if (typeof finalContent === 'string') replyText = finalContent;

        await sendToInstagram(senderId, replyText);

    } catch (e: any) {
        addSystemLog('INTERNAL', 'processWebhookMessage', 500, 'Auto-Reply Failed', 'instagram', { error: e.message });
    }
};

const handleWebhookEvent = async (req: any, res: any) => {
  const body = req.body;
  addSystemLog('POST', req.url, 200, 'Webhook Received', 'instagram', body);

  if (body.object === 'page' || body.object === 'instagram') {
      if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
              const webhookEvents = entry.messaging || entry.changes;
              if (Array.isArray(webhookEvents)) {
                  for (const event of webhookEvents) {
                      const senderId = event.sender?.id || (event.value ? event.value.sender?.id : null);
                      const messageText = event.message?.text || (event.value ? event.value.message?.text : null);
                      if (senderId && messageText && !event.message?.is_echo) {
                          await processWebhookMessage(senderId, messageText);
                      }
                  }
              }
          }
      }
  }

  res.status(200).send('EVENT_RECEIVED');
};

const handleWebhookVerification = (req: any, res: any) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      addSystemLog('GET', req.url, 200, 'Verification Success', 'instagram', req.query);
      res.status(200).send(challenge);
  } else {
      res.sendStatus(403);
  }
};

router.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Hewdes CRM (Netlify) Active' }));
router.get('/logs', (req, res) => res.json(systemLogs));
router.get('/webhook/instagram', handleWebhookVerification);
router.post('/webhook/instagram', handleWebhookEvent);

api.use('/api', router);
api.use('/', router);

export const handler = serverless(api);
