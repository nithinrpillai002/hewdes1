
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- VISUAL STARTUP BANNER ---
const BANNER = `
********************************************************************************
*  _    _  ______  _          ______   ______  _____   _____  _____  ______    *
* | |  | ||  ____|| |        |  ____| |  ____||  __ \\ |  __ \\|  __ \\|  ____|   *
* | |__| || |__   | |   __   | |__    | |__   | |__) || |__) || |__) || |__     *
* |  __  ||  __|  | |  /  \\  |  __|   |  __|  |  _  / |  _  / |  _  / |  __|    *
* | |  | || |____ | | / /\\ \\ | |____  | |____ | | \\ \\ | | \\ \\ | | \\ \\ | |____   *
* |_|  |_||______||_|/_/  \\_\\|______| |______||_|  \\_\\|_|  \\_\\|_|  \\_\\|______|  *
*                                                                              *
*                 SERVER STATUS: ONLINE & LISTENING (INSTAGRAM ONLY)           *
********************************************************************************
`;

const app = express();
const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hewdes_rttf0kd11o1axrmc';

// --- GEMINI API CONFIGURATION ---
// Initialized with the environment variable API_KEY as per best practices.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- IN-MEMORY DATABASE ---
let conversationsStore = []; 
let systemLogs = [];
const MAX_LOGS = 50;

// --- DYNAMIC CONFIGURATION (In-Memory) ---
let IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || '';
let GRAPH_VERSION = "v24.0"; 

// --- PRODUCT CATALOG (Mock Database) ---
const PRODUCT_CATALOG = [
    { id: '101', name: 'Custom Engraved Wooden Watch', price: 2499, description: 'Handcrafted sandalwood watch.', imageUrl: 'https://picsum.photos/400/400?random=1' },
    { id: '102', name: 'Personalized Leather Wallet', price: 1299, description: 'Genuine leather with embossing.', imageUrl: 'https://picsum.photos/400/400?random=2' },
    { id: '103', name: 'Ceramic Magic Photo Mug', price: 499, description: 'Reveals photo when hot.', imageUrl: 'https://picsum.photos/400/400?random=3' }
];

// --- MIDDLEWARE ---
app.enable('trust proxy'); 

app.use((req, res, next) => {
  const isWebhook = req.url.includes('/webhook');
  const isApi = req.url.includes('/api/');
  
  if (isWebhook) {
    console.log(`\n[WEBHOOK] ${req.method} ${req.originalUrl}`);
  } else if (isApi) {
    console.log(`[API] ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- LOGGING HELPER ---
const addSystemLog = (method, url, status, outcome, source, payload) => {
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
  
  if (status >= 400) console.error(`[LOG-ERROR] ${outcome}`);
};

// --- REAL META API SENDER ---
async function callInstagramApi(payload) {
    if (!IG_ACCESS_TOKEN) {
        console.warn(`[API-OUT] No Instagram Access Token configured. Logging only.`);
        addSystemLog('POST', `https://graph.facebook.com/${GRAPH_VERSION}/me/messages`, 401, 'Missing IG Token', 'instagram', payload);
        return { success: false, error: 'Missing Access Token' };
    }

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${IG_ACCESS_TOKEN}`;

    try {
        console.log(`[API-OUT] Sending to Instagram:`, JSON.stringify(payload));
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        
        if (!response.ok) {
             addSystemLog('POST', url, response.status, 'Graph API Error', 'instagram', resData);
             console.error(`[API-OUT] Error:`, resData);
             return { success: false, error: resData };
        }

        addSystemLog('POST', url, 200, 'Message Sent Successfully', 'instagram', { request: payload, response: resData });
        return { success: true, data: resData };

    } catch (e) {
        addSystemLog('POST', url, 500, 'Network Error', 'instagram', { error: e.message });
        return { success: false, error: e.message };
    }
}


// --- INSTAGRAM API HELPER ---
async function fetchInstagramProfile(igsid) {
    if (!IG_ACCESS_TOKEN) return null;
    
    const url = `https://graph.instagram.com/${GRAPH_VERSION}/${igsid}?fields=name,username,profile_pic&access_token=${IG_ACCESS_TOKEN}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
    } catch (e) {
        return null;
    }
}

// --- PAYLOAD CONSTRUCTORS (TEXT ONLY) ---

const constructTextMessage = (recipientId, text) => {
    return {
        recipient: { id: recipientId },
        message: { text: text }
    };
};

const constructSenderAction = (recipientId, action) => {
    return {
        recipient: { id: recipientId },
        sender_action: action
    };
};

// --- AI LOGIC using @google/genai ---
async function generateAiResponse(conversationHistory, productCatalog) {
    try {
        const productContext = productCatalog.map(p => 
            `ID: ${p.id}, Name: ${p.name}, Price: ₹${p.price}, URL: ${p.imageUrl}`
        ).join('\n');

        const systemInstruction = `
            You are "Hewdes Bot", the AI assistant for Hewdes Gifts on Instagram.
            
            YOUR GOAL: Help customers find gifts, answer questions about products, and close sales.
            
            PRODUCT CATALOG:
            ${productContext}
            
            OUTPUT RULES:
            1. You must respond with clear, friendly TEXT only.
            2. Do NOT use JSON, Markdown code blocks, or HTML.
            3. Keep responses concise (under 300 characters is best for Instagram).
            4. If suggesting a product, mention its name and price.
            5. Do NOT try to create buttons or carousels. Just describe the items.
        `;

        // Filter and map history to Gemini format
        // Gemini expects roles: 'user' or 'model'
        const historyForModel = conversationHistory.slice(-5).map(m => {
            const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
            return { 
                role: role, 
                parts: [{ text: m.content || "" }] 
            };
        });

        // Use the official SDK to generate content
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: historyForModel,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7,
                maxOutputTokens: 300, 
            },
        });

        return response.text || "I'm having trouble thinking of a response.";

    } catch (e) {
        console.error("AI Generation Error:", e);
        return "I'm a bit busy right now. Please try again in a moment.";
    }
}

// --- CORE LOGIC: Handle Incoming & Dispatch Outgoing ---
async function handleIncomingMessageFlow(senderId, incomingData) {
    if (!senderId) return;

    // 1. CRM Lookup / Create
    let conversation = conversationsStore.find(c => c.igsid === senderId);
    
    if (!conversation) {
        let profileName = `User ${senderId.slice(-4)}`;
        let profileAvatar = `https://ui-avatars.com/api/?name=User+${senderId.slice(-4)}&background=random`;
        let igUsername = null;

        // Fetch Real Profile
        const profileData = await fetchInstagramProfile(senderId);
        if (profileData) {
            if (profileData.name) profileName = profileData.name;
            else if (profileData.username) profileName = profileData.username;
            if (profileData.profile_pic) profileAvatar = profileData.profile_pic;
            igUsername = profileData.username;
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
        conversationsStore = conversationsStore.filter(c => c.id !== conversation.id);
        conversationsStore.unshift(conversation);
        conversation.unreadCount += 1;
    }

    // 2. Parse Incoming Content
    let userMessageContent = "";
    let messageType = 'text';

    if (incomingData.message?.text) {
        userMessageContent = incomingData.message.text;
    } else {
        userMessageContent = "[Media/Attachment Sent]";
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

    // 3. AI Processing (Text Only)
    if (!conversation.isAiPaused) {
        // Send Typing Indicator
        await callInstagramApi(constructSenderAction(senderId, 'typing_on'));

        // Generate AI Response
        const aiText = await generateAiResponse(conversation.messages, PRODUCT_CATALOG);

        // Send Text Response
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

// --- WEBHOOK HANDLER ---
const handleWebhookEvent = async (req, res) => {
  const body = req.body;
  
  // Log receipt
  if (body.object) {
      addSystemLog('POST', req.url, 200, 'Webhook Received', 'instagram', body);
  }

  // Parse Instagram Payload
  if (body.object === 'instagram' || body.object === 'page') {
      if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
              if (Array.isArray(entry.messaging)) {
                  for (const event of entry.messaging) {
                      const senderId = event.sender?.id;
                      // Ignore echoes (messages sent by the page)
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

const handleWebhookVerification = (req, res) => {
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

// --- API ROUTES ---

app.get('/api/conversations', (req, res) => {
    res.json(conversationsStore);
});

// Endpoint to update tokens from Settings UI
app.post('/api/config', (req, res) => {
    const { igToken, graphVersion } = req.body;
    if (igToken !== undefined) {
        IG_ACCESS_TOKEN = igToken;
        console.log(`[CONFIG] IG Token updated.`);
    }
    if (graphVersion !== undefined) GRAPH_VERSION = graphVersion;

    res.json({ success: true, message: 'Configuration updated in memory.' });
});

app.post('/api/conversations/:id/message', (req, res) => {
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
        
        // Human Override -> Send via Graph API
        callInstagramApi(constructTextMessage(conv.igsid, text));

        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Not found" });
    }
});

app.post('/api/conversations/:id/pause', (req, res) => {
    const conv = conversationsStore.find(c => c.id === req.params.id);
    if (conv) {
        conv.isAiPaused = true;
        conv.status = 'active'; 
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Conversation not found" });
    }
});

// --- DEVELOPER SIMULATION ENDPOINT ---
app.post('/api/dev/simulate', async (req, res) => {
    try {
        const body = req.body;
        // Basic extraction for simulation - expects standard Meta/Instagram format
        let senderId = null;
        let messageText = null;

        // Extract specifics based on the table requirements
        const entry = body.entry?.[0];
        const messaging = entry?.messaging?.[0];

        if (messaging) {
            senderId = messaging.sender?.id;
            messageText = messaging.message?.text;
        }

        if (!senderId || !messageText) {
             return res.status(400).json({ error: "Invalid Webhook Format. Could not find sender.id or message.text" });
        }

        // Detailed Parsing for Developer UI
        const parsedFields = {
            object: body.object,
            entryId: entry?.id,
            entryTime: entry?.time,
            senderId: messaging?.sender?.id,
            recipientId: messaging?.recipient?.id,
            messageId: messaging?.message?.mid,
            messageText: messaging?.message?.text
        };

        // Construct a single turn history for simulation
        // const history = [{ role: 'user', content: messageText, type: 'text', timestamp: Date.now() }];
        
        // BYPASS AI CALL: Return static response as requested for developer testing
        const aiText = "AI Response";
        
        // Construct the output payload that would be sent to Graph API
        const graphPayload = constructTextMessage(senderId, aiText);

        res.json({
            parsedFields, // Return the detailed breakout
            aiResponse: aiText,
            graphApiPayload: graphPayload
        });

    } catch (e) {
        console.error("Simulation Error", e);
        res.status(500).json({ error: e.message });
    }
});

// Single Webhook Endpoint for Instagram
app.get('/webhook/instagram', handleWebhookVerification);
app.post('/webhook/instagram', handleWebhookEvent);

// Removed WhatsApp Routes
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Hewdes CRM Server is Running' }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Hewdes CRM Server is Running' }));
app.get('/api/logs', (req, res) => res.json(systemLogs));

app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// Frontend Serving
app.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();
  let relativePath = req.path;
  if (relativePath === '/') relativePath = '/index.html';
  const absolutePath = path.join(__dirname, relativePath);
  let filePathToServe = null;
  let loaderType = 'tsx';
  
  if (!path.extname(absolutePath)) {
    if (fs.existsSync(absolutePath + '.tsx')) { filePathToServe = absolutePath + '.tsx'; loaderType = 'tsx'; }
    else if (fs.existsSync(absolutePath + '.ts')) { filePathToServe = absolutePath + '.ts'; loaderType = 'ts'; }
  } else if (fs.existsSync(absolutePath)) {
    filePathToServe = absolutePath;
    if (absolutePath.endsWith('.ts')) loaderType = 'ts';
    if (absolutePath.endsWith('.tsx')) loaderType = 'tsx';
  }
  
  if (filePathToServe && (loaderType === 'tsx' || loaderType === 'ts')) {
    try {
      const content = fs.readFileSync(filePathToServe, 'utf8');
      const result = esbuild.transformSync(content, { loader: loaderType, target: 'es2020', format: 'esm', jsx: 'automatic' });
      res.set('Content-Type', 'application/javascript');
      return res.send(result.code);
    } catch (e) { return res.status(500).send(`Transpilation Failed: ${e.message}`); }
  }
  next();
});

app.use(express.static(path.resolve(__dirname)));
app.get('*', (req, res) => {
  if (req.url.match(/\.(js|css|png|jpg|ico|json|woff2)$/)) return res.status(404).send('Not Found');
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(BANNER);
  console.log(`[SYSTEM] Server listening on port ${PORT}`);
  console.log(`[SYSTEM] Instagram CRM Mode Active.`);
});
