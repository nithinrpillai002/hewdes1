
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';
import { GoogleGenAI, Type } from "@google/genai";

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
*                 SERVER STATUS: ONLINE & LISTENING                            *
********************************************************************************
`;

const app = express();
const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hewdes_rttf0kd11o1axrmc';

// Initialize Google GenAI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'dummy_key_for_build' });

// --- IN-MEMORY DATABASE ---
let conversationsStore = []; 
let systemLogs = [];
const MAX_LOGS = 50;

// --- DYNAMIC CONFIGURATION (In-Memory) ---
// These allow the Settings page to update server behavior without restart
let IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || '';
let WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || '';

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

// --- INSTAGRAM API HELPER (PDF Requirement) ---
async function fetchInstagramProfile(igsid) {
    if (!IG_ACCESS_TOKEN) {
        console.log(`[IG-API] No Access Token set. Skipping profile fetch for ${igsid}.`);
        return null;
    }
    
    const url = `https://graph.instagram.com/v20.0/${igsid}?fields=name,username,profile_pic&access_token=${IG_ACCESS_TOKEN}`;
    
    try {
        console.log(`[IG-API] Fetching profile: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[IG-API] Failed to fetch profile: ${errorText}`);
            addSystemLog('GET', url, response.status, 'IG Profile Fetch Failed', 'instagram', { error: errorText });
            return null;
        }

        const data = await response.json();
        addSystemLog('GET', url, 200, 'IG Profile Fetched', 'instagram', data);
        return data; // Returns { name, username, profile_pic, id }
    } catch (e) {
        console.error(`[IG-API] Exception: ${e.message}`);
        return null;
    }
}

// --- INSTAGRAM PAYLOAD CONSTRUCTORS (Strictly per PDF Pages 15-18) ---

// PDF 5.1: Send Text Message
const constructTextMessage = (recipientId, text) => {
    return {
        recipient: { id: recipientId },
        message: { text: text }
    };
};

// PDF 5.2: Send Message with Quick Replies
const constructQuickReplyMessage = (recipientId, text, quickReplies) => {
    return {
        recipient: { id: recipientId },
        message: {
            text: text,
            quick_replies: quickReplies.map(qr => ({
                content_type: 'text',
                title: qr.title.substring(0, 20), // PDF Constraint: Title max 20 chars
                payload: qr.payload
            }))
        }
    };
};

// PDF 5.4: Send Generic Template (Product Card)
const constructGenericTemplate = (recipientId, elements) => {
    return {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: elements.slice(0, 10) // PDF Constraint: Max 10 elements
                }
            }
        }
    };
};

// PDF 5.5: React to Message (Sender Action)
const constructSenderAction = (recipientId, action) => {
    return {
        recipient: { id: recipientId },
        sender_action: action // e.g., 'typing_on', 'mark_seen'
    };
};

// --- AI LOGIC using @google/genai ---
async function generateAiResponse(conversationHistory, productCatalog) {
    try {
        const productContext = productCatalog.map(p => 
            `ID: ${p.id}, Name: ${p.name}, Price: ₹${p.price}, URL: ${p.imageUrl}`
        ).join('\n');

        const systemInstruction = `
            You are "Hewdes Bot", the AI assistant for Hewdes Gifts.
            
            YOUR GOAL: Help customers find gifts or answer questions.
            
            PRODUCT CATALOG:
            ${productContext}
            
            OUTPUT RULES:
            You must output a strictly valid JSON object adhering to this schema.
            Do NOT output markdown. Do NOT output plain text.
            
            Schema:
            {
                "intent": "TEXT_REPLY" | "SHOW_PRODUCTS" | "ASK_WITH_OPTIONS",
                "text": "The text message content",
                "productIds": ["id1", "id2"], // Only if intent is SHOW_PRODUCTS
                "options": [{"title": "Yes", "payload": "YES"}, {"title": "No", "payload": "NO"}] // Only if intent is ASK_WITH_OPTIONS
            }
        `;

        const historyForModel = conversationHistory.slice(-5).map(m => {
            const role = m.role === 'model' ? 'model' : 'user';
            const text = m.type === 'template' ? "Sent product cards" : (m.content || "");
            return { role, parts: [{ text }] };
        });

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: historyForModel.length > 0 ? historyForModel : [{ role: 'user', parts: [{ text: 'Hello' }] }],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                // Using responseSchema to enforce strict structure
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        intent: { type: Type.STRING, enum: ["TEXT_REPLY", "SHOW_PRODUCTS", "ASK_WITH_OPTIONS"] },
                        text: { type: Type.STRING },
                        productIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    payload: { type: Type.STRING }
                                },
                                required: ["title", "payload"]
                            }
                        }
                    },
                    required: ["intent", "text"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        return { intent: "TEXT_REPLY", text: "I apologize, I'm having trouble connecting right now." };

    } catch (e) {
        console.error("AI Generation Error:", e);
        return { intent: "TEXT_REPLY", text: "System is busy. Please try again later." };
    }
}

// --- CORE LOGIC: Handle Incoming & Dispatch Outgoing ---
async function handleIncomingMessageFlow(platform, senderId, incomingData) {
    if (!senderId) return;

    // 1. CRM Lookup / Create (Section 6.2)
    let conversation = conversationsStore.find(c => c.igsid === senderId);
    
    // "on receiving a message, it should open a new chat"
    // Fetch profile data ONLY if it's a new chat to save API calls, or if we want to refresh.
    if (!conversation) {
        let profileName = `User ${senderId.slice(-4)}`;
        let profileAvatar = `https://ui-avatars.com/api/?name=User+${senderId.slice(-4)}&background=random`;
        let igUsername = null;

        // --- INSTAGRAM PROFILE FETCH LOGIC ---
        if (platform === 'instagram') {
            const profileData = await fetchInstagramProfile(senderId);
            if (profileData) {
                if (profileData.name) profileName = profileData.name;
                else if (profileData.username) profileName = profileData.username;
                
                if (profileData.profile_pic) profileAvatar = profileData.profile_pic;
                igUsername = profileData.username;
            }
        }

        conversation = {
            id: Date.now().toString(),
            igsid: senderId,
            customerName: profileName,
            platform: platform,
            lastMessage: "",
            lastMessageTime: Date.now(),
            unreadCount: 0,
            tags: [
                { id: 'new', label: 'New Lead', color: 'bg-blue-100 text-blue-700' },
                ...(platform === 'instagram' ? [{ id: 'ig', label: 'Instagram', color: 'bg-pink-100 text-pink-700' }] : [])
            ],
            isAiPaused: false,
            status: 'active',
            avatarUrl: profileAvatar,
            messages: []
        };
        conversationsStore.unshift(conversation);
    } else {
        // Move to top to indicate recent activity
        conversationsStore = conversationsStore.filter(c => c.id !== conversation.id);
        conversationsStore.unshift(conversation);
        conversation.unreadCount += 1;
    }

    // 2. Process Specific Event Types (PDF Section 3 & 4)
    let userMessageContent = "";
    let messageType = 'text';

    if (incomingData.message?.text) {
        userMessageContent = incomingData.message.text;
    } 
    else if (incomingData.message?.attachments) {
        messageType = 'image';
        userMessageContent = "Sent an attachment";
    }
    else if (incomingData.postback) {
        userMessageContent = incomingData.postback.title || incomingData.postback.payload;
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

    // 3. AI Processing (Strict Output Formatting)
    if (!conversation.isAiPaused) {
        // Send Typing Indicator (PDF 5.6)
        const typingPayload = constructSenderAction(senderId, 'typing_on');
        addSystemLog('POST', 'https://graph.facebook.com/v18.0/me/messages', 200, 'Typing Indicator', platform, typingPayload);

        // Call Gemini
        const aiDecision = await generateAiResponse(conversation.messages, PRODUCT_CATALOG);
        let finalPayload = {};
        let storedMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            timestamp: Date.now(),
            content: aiDecision.text,
            type: 'text'
        };

        // Construct Payload based on Intent (PDF Specs)
        if (aiDecision.intent === 'SHOW_PRODUCTS' && aiDecision.productIds) {
            const elements = aiDecision.productIds.map(pid => {
                const prod = PRODUCT_CATALOG.find(p => p.id === pid);
                if (!prod) return null;
                return {
                    title: prod.name,
                    subtitle: `₹${prod.price}`,
                    image_url: prod.imageUrl,
                    buttons: [
                        { type: "postback", title: "View", payload: `VIEW_${prod.id}` },
                        { type: "postback", title: "Buy", payload: `ADD_${prod.id}` }
                    ]
                };
            }).filter(Boolean);

            if (elements.length > 0) {
                finalPayload = constructGenericTemplate(senderId, elements);
                storedMessage.type = 'template';
                storedMessage.attachments = [{
                    type: 'template',
                    payload: { template_type: 'generic', elements }
                }];
            } else {
                // Fallback to text if products not found
                finalPayload = constructTextMessage(senderId, aiDecision.text);
            }
        } 
        else if (aiDecision.intent === 'ASK_WITH_OPTIONS' && aiDecision.options) {
            finalPayload = constructQuickReplyMessage(senderId, aiDecision.text, aiDecision.options);
            storedMessage.type = 'quick_reply';
            storedMessage.quick_replies = aiDecision.options.map(o => ({
                content_type: 'text',
                title: o.title,
                payload: o.payload
            }));
        } 
        else {
            // Default TEXT_REPLY
            finalPayload = constructTextMessage(senderId, aiDecision.text);
        }

        // "Send" (Log and Store)
        addSystemLog('POST', 'https://graph.facebook.com/v18.0/me/messages', 200, 'Message Sent', platform, finalPayload);
        
        conversation.messages.push(storedMessage);
        conversation.lastMessage = storedMessage.content || "Sent an attachment";
    }
}

// --- WEBHOOK HANDLER (PDF Section 4) ---
const handleWebhookEvent = async (req, res, platform) => {
  const body = req.body;
  addSystemLog('POST', req.url, 200, 'Webhook Received', platform, body);

  // Parse Standard Meta Payload (PDF 4.1)
  if (body.object === 'instagram' || body.object === 'page') {
      if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
              if (Array.isArray(entry.messaging)) {
                  for (const event of entry.messaging) {
                      const senderId = event.sender?.id;
                      if (senderId) {
                          await handleIncomingMessageFlow(platform, senderId, event);
                      }
                  }
              }
          }
      }
  }
  // Support for legacy/simulated simple format
  else if (body.field === 'messages' && body.value) {
      const senderId = body.value.sender?.id;
      const simulatedEvent = {
          sender: body.value.sender,
          message: body.value.message,
          timestamp: body.value.timestamp
      };
      if (senderId) {
           await handleIncomingMessageFlow(platform, senderId, simulatedEvent);
      }
  }

  res.status(200).send('EVENT_RECEIVED');
};

const handleWebhookVerification = (req, res, platform) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      addSystemLog('GET', req.url, 200, 'Verification Success', platform, req.query);
      res.status(200).send(challenge);
  } else {
      addSystemLog('GET', req.url, 403, 'Verification Failed', platform, req.query);
      res.sendStatus(403);
  }
};

// --- API ROUTES ---

app.get('/api/conversations', (req, res) => {
    res.json(conversationsStore);
});

// Endpoint to update tokens from Settings UI
app.post('/api/config', (req, res) => {
    const { igToken, waToken } = req.body;
    if (igToken !== undefined) {
        IG_ACCESS_TOKEN = igToken;
        console.log(`[CONFIG] IG Token updated via API.`);
    }
    if (waToken !== undefined) WA_ACCESS_TOKEN = waToken;
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

app.get('/webhook/instagram', (req, res) => handleWebhookVerification(req, res, 'instagram'));
app.post('/webhook/instagram', (req, res) => handleWebhookEvent(req, res, 'instagram'));
app.get('/webhook/whatsapp', (req, res) => handleWebhookVerification(req, res, 'whatsapp'));
app.post('/webhook/whatsapp', (req, res) => handleWebhookEvent(req, res, 'whatsapp'));

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
  console.log(`[SYSTEM] In-Memory DB Active. Send webhooks to /webhook/instagram`);
});
