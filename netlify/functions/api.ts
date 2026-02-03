
import express, { Router } from 'express';
import serverless from 'serverless-http';
import { GoogleGenAI } from "@google/genai";

const api = express();
const router = Router();

api.use(express.json() as any);
api.use(express.urlencoded({ extended: true }) as any);

// --- CONFIGURATION & STATE ---
// Note: In a real production serverless environment, in-memory storage is ephemeral.
// For persistent CRM data, you would connect to a database (MongoDB/Postgres).
// This in-memory store works for local 'netlify dev' or warm lambda executions.
let conversationsStore: any[] = [];
let systemLogs: any[] = [];
const MAX_LOGS = 100;

let IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || '';
let GRAPH_VERSION = "v24.0";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hewdes_rttf0kd11o1axrmc';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- PRODUCT CATALOG (Mock) ---
const PRODUCT_CATALOG = [
    { id: '101', name: 'Custom Engraved Wooden Watch', price: 2499, description: 'Handcrafted sandalwood watch.', imageUrl: 'https://picsum.photos/400/400?random=1' },
    { id: '102', name: 'Personalized Leather Wallet', price: 1299, description: 'Genuine leather with embossing.', imageUrl: 'https://picsum.photos/400/400?random=2' },
    { id: '103', name: 'Ceramic Magic Photo Mug', price: 499, description: 'Reveals photo when hot.', imageUrl: 'https://picsum.photos/400/400?random=3' }
];

// --- LOGGING HELPER ---
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

// --- INSTAGRAM API HELPERS ---

// 1. Fetch Profile (GET)
async function fetchInstagramProfile(igsid: string) {
    if (!IG_ACCESS_TOKEN) {
        addSystemLog('GET', `https://graph.instagram.com/${GRAPH_VERSION}/${igsid}`, 0, 'Skipped Profile Fetch (No Token)', 'system', { igsid });
        return null;
    }
    
    const url = `https://graph.instagram.com/${GRAPH_VERSION}/${igsid}?fields=name,username,profile_pic&access_token=${IG_ACCESS_TOKEN}`;
    
    try {
        addSystemLog('GET', url, 0, 'Fetching Profile Details', 'system', { targetId: igsid });
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
             addSystemLog('GET', url, response.status, 'Profile Fetch Failed', 'system', data);
             return null;
        }
        addSystemLog('GET', url, 200, 'Profile Details Received', 'system', data);
        return data;
    } catch (e: any) {
        addSystemLog('GET', url, 500, 'Profile Fetch Error', 'system', { error: e.message });
        return null;
    }
}

// 2. Send Message (POST)
async function callInstagramApi(payload: any) {
    if (!IG_ACCESS_TOKEN) {
        addSystemLog('POST', `https://graph.facebook.com/${GRAPH_VERSION}/me/messages`, 400, 'Missing IG Token', 'instagram', payload);
        return { success: false, error: 'Missing Access Token' };
    }

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${IG_ACCESS_TOKEN}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        
        if (!response.ok) {
             addSystemLog('POST', url, response.status, 'Graph API Error', 'instagram', { request: payload, errorResponse: resData });
             return { success: false, error: resData };
        }

        addSystemLog('POST', url, 200, 'Message Sent Successfully', 'instagram', { request: payload, response: resData });
        return { success: true, data: resData };

    } catch (e: any) {
        addSystemLog('POST', url, 500, 'Network Error', 'instagram', { error: e.message });
        return { success: false, error: e.message };
    }
}

const constructTextMessage = (recipientId: string, text: string) => ({
    recipient: { id: recipientId },
    message: { text: text }
});

const constructSenderAction = (recipientId: string, action: string) => ({
    recipient: { id: recipientId },
    sender_action: action
});

// --- AI LOGIC ---
async function generateAiResponse(conversationHistory: any[], productCatalog: any[]) {
    try {
        const productContext = productCatalog.map(p => 
            `ID: ${p.id}, Name: ${p.name}, Price: ₹${p.price}`
        ).join('\n');

        const systemInstruction = `
            You are "Hewdes Bot", the AI assistant for Hewdes Gifts on Instagram.
            PRODUCT CATALOG: ${productContext}
            Rules: Clear, friendly text only. No Markdown. Suggest products with prices.
        `;

        // Format history
        const historyForModel = conversationHistory.slice(-5).map(m => {
             const role = m.role === 'model' ? 'model' : 'user';
             return { role, parts: [{ text: m.content || "" }] };
        });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: historyForModel,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 300,
            },
        });

        return response.text || "I'm having trouble thinking of a response.";

    } catch (e) {
        console.error("AI Generation Error:", e);
        return "I'm a bit busy right now. Please try again later.";
    }
}

// --- CORE MESSAGE PROCESSING ---
async function handleIncomingMessageFlow(senderId: string, incomingData: any) {
    if (!senderId) return;

    // 1. Fetch Profile
    let profileData = null;
    // We attempt fetch even if token might be bad, logic inside fetch handles null check
    profileData = await fetchInstagramProfile(senderId);

    // 2. CRM Lookup / Create or Update
    let conversation = conversationsStore.find(c => c.igsid === senderId);
    
    if (!conversation) {
        let profileName = `User ${senderId.slice(-4)}`;
        let profileAvatar = `https://ui-avatars.com/api/?name=User+${senderId.slice(-4)}&background=random`;

        if (profileData) {
            if (profileData.name) profileName = profileData.name;
            else if (profileData.username) profileName = profileData.username;
            if (profileData.profile_pic) profileAvatar = profileData.profile_pic;
        }

        conversation = {
            id: Date.now().toString(),
            igsid: senderId,
            customerName: profileName,
            platform: 'instagram',
            lastMessage: "",
            lastMessageTime: Date.now(),
            unreadCount: 0,
            tags: [{ id: 'new', label: 'New Lead', color: 'bg-blue-100 text-blue-700' }],
            isAiPaused: false,
            status: 'active',
            avatarUrl: profileAvatar,
            messages: []
        };
        conversationsStore.unshift(conversation);
    } else {
        if (profileData) {
             if (profileData.name) conversation.customerName = profileData.name;
             if (profileData.profile_pic) conversation.avatarUrl = profileData.profile_pic;
        }
        conversationsStore = conversationsStore.filter(c => c.id !== conversation.id);
        conversationsStore.unshift(conversation);
        conversation.unreadCount += 1;
    }

    // 3. Parse Content
    let userMessageContent = "";
    let messageType = 'text';

    if (incomingData.message?.text) {
        userMessageContent = incomingData.message.text;
    } else {
        userMessageContent = "[Media/Attachment]";
        messageType = 'image';
    }

    conversation.lastMessage = userMessageContent;
    conversation.lastMessageTime = Date.now();
    
    conversation.messages.push({
        id: Date.now().toString(),
        role: 'user',
        content: userMessageContent,
        timestamp: Date.now(),
        type: messageType
    });

    // 4. AI Response
    if (!conversation.isAiPaused) {
        await callInstagramApi(constructSenderAction(senderId, 'typing_on'));
        const aiText = await generateAiResponse(conversation.messages, PRODUCT_CATALOG);
        await callInstagramApi(constructTextMessage(senderId, aiText));
        
        conversation.messages.push({
            id: (Date.now() + 1).toString(),
            role: 'model',
            timestamp: Date.now(),
            content: aiText,
            type: 'text'
        });
        conversation.lastMessage = aiText;
    }
}

// --- API ROUTES ---

router.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Hewdes CRM (Netlify) Active' }));
router.get('/logs', (req, res) => res.json(systemLogs));

// CRM Routes
router.get('/conversations', (req, res) => {
    res.json(conversationsStore);
});

router.post('/conversations/:id/message', (req, res) => {
    const { text, role } = req.body;
    const conv = conversationsStore.find(c => c.id === req.params.id);
    if (conv) {
        conv.messages.push({
            id: Date.now().toString(),
            role: role || 'user',
            content: text,
            timestamp: Date.now(),
            isHumanOverride: true,
            type: 'text'
        });
        conv.lastMessage = text;
        conv.lastMessageTime = Date.now();
        conv.isAiPaused = true; 
        
        // Send actual message to user via Graph API
        callInstagramApi(constructTextMessage(conv.igsid, text));

        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Not found" });
    }
});

router.post('/conversations/:id/pause', (req, res) => {
    const conv = conversationsStore.find(c => c.id === req.params.id);
    if (conv) {
        conv.isAiPaused = true;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Conversation not found" });
    }
});

// Config Route (Allows updating Token from Settings Page)
router.post('/config', (req, res) => {
    const { igToken, graphVersion } = req.body;
    if (igToken !== undefined) {
        IG_ACCESS_TOKEN = igToken;
        // Also log this change so we know it happened
        addSystemLog('POST', '/api/config', 200, 'IG Token Updated Manually', 'system', { graphVersion });
    }
    if (graphVersion !== undefined) GRAPH_VERSION = graphVersion;
    res.json({ success: true, message: 'Configuration updated.' });
});

// --- WEBHOOK HANDLING ---
const handleWebhookEvent = async (req: any, res: any) => {
  const body = req.body;
  
  if (body.object) {
      addSystemLog('POST', req.url, 200, 'Webhook Received', 'instagram', body);
  }

  if (body.object === 'instagram' || body.object === 'page') {
      if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
              const events = entry.messaging || entry.changes;
              if (Array.isArray(events)) {
                  for (const event of events) {
                      const senderId = event.sender?.id || (event.value ? event.value.sender?.id : null);
                      if (senderId && !event.message?.is_echo) {
                          await handleIncomingMessageFlow(senderId, event);
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
      addSystemLog('GET', req.url, 403, 'Verification Failed', 'instagram', req.query);
      res.sendStatus(403);
  }
};

router.get('/webhook/instagram', handleWebhookVerification);
router.post('/webhook/instagram', handleWebhookEvent);

// Mount router
api.use('/api', router);
api.use('/', router); // Fallback for direct paths

export const handler = serverless(api);
