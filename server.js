
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

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
const HARDCODED_KIE_KEY = '3a748f6c1558e84cf2ca54b22c393832';

// --- IN-MEMORY DATABASE ---
// In a real app, use PostgreSQL/MongoDB as per PDF Section 6.2
let conversationsStore = []; 
let systemLogs = [];
const MAX_LOGS = 50;

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

// --- HELPER: KIE / Gemini API Call ---
async function callKieGemini(messages, apiKey) {
    const KIE_ENDPOINT = "https://api.kie.ai/gemini-3-flash/v1/chat/completions";
    
    // We strictly use tools or JSON mode to structure responses
    const body = {
        messages: messages,
        stream: false,
        response_format: { type: "json_object" } // Force JSON for predictable product recommendations
    };

    console.log(`[KIE-REQ] Sending to ${KIE_ENDPOINT}`);

    try {
        const response = await fetch(KIE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'User-Agent': 'Hewdes-CRM-Server/1.0'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`KIE API responded with ${response.status}: ${errText}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error(`[KIE-ERROR] Connection Failed:`, error);
        throw error;
    }
}

// --- SENDING MESSAGES (PDF Section 5) ---
// This function constructs payloads exactly as Instagram Graph API expects them.
const sendInstagramMessage = async (recipientId, content) => {
    // content can be a string (text) or an object (template/attachment)
    
    let payload = {
        recipient: { id: recipientId },
        message: {}
    };

    if (typeof content === 'string') {
        // PDF 5.1 Send Text Message
        payload.message = { text: content };
    } else if (content.type === 'template') {
        // PDF 5.4 Send Generic Template
        payload.message = {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: content.elements
                }
            }
        };
    } else if (content.quick_replies) {
        // PDF 5.2 Send with Quick Replies
        payload.message = {
            text: content.text,
            quick_replies: content.quick_replies
        };
    }

    // In a real app, we would POST to https://graph.facebook.com/v18.0/me/messages
    // Here we log it as an "Outgoing" event and store it in our in-memory DB for the UI
    addSystemLog('POST', `https://graph.facebook.com/v18.0/me/messages`, 200, 'Message Sent (Simulated)', 'instagram', payload);
    
    return payload; // Return so we can save to conversation store
};

// --- CORE LOGIC: Handle Incoming & AI Response ---
async function handleIncomingMessageFlow(platform, senderId, incomingData) {
    if (!senderId) return;

    // 1. CRM Lookup / Create (Section 6.2)
    let conversation = conversationsStore.find(c => c.igsid === senderId);
    
    if (!conversation) {
        conversation = {
            id: Date.now().toString(),
            igsid: senderId,
            customerName: `User ${senderId.slice(-4)}`,
            platform: platform,
            lastMessage: "",
            lastMessageTime: Date.now(),
            unreadCount: 0,
            tags: [{ id: 'new', label: 'New Lead', color: 'bg-blue-100 text-blue-700' }],
            isAiPaused: false,
            status: 'active',
            avatarUrl: `https://ui-avatars.com/api/?name=User+${senderId.slice(-4)}&background=random`,
            messages: []
        };
        conversationsStore.unshift(conversation);
    } else {
        // Reset unread count if we are about to respond? No, increment for agent.
        conversation.unreadCount += 1;
    }

    // 2. Process Specific Event Types (PDF Section 3 & 4)
    let userMessageContent = "";
    let messageType = 'text';
    let attachments = [];

    if (incomingData.message?.text) {
        // Standard Text (4.1)
        userMessageContent = incomingData.message.text;
    } 
    else if (incomingData.message?.attachments) {
        // Attachments (4.2)
        messageType = 'image'; // Simplifying for now
        userMessageContent = "Sent an attachment";
        attachments = incomingData.message.attachments.map(att => ({
            type: att.type,
            payload: att.payload
        }));
    }
    else if (incomingData.postback) {
        // Postback (4.5)
        userMessageContent = `[Clicked Button]: ${incomingData.postback.title}`;
    }
    else if (incomingData.reaction) {
        // Reaction (4.4)
        const react = incomingData.reaction;
        if (react.action === 'react') {
            // Find message and add reaction (Simplified: just logging as a message for now)
            userMessageContent = `Reacted ${react.emoji}`;
            messageType = 'reaction';
        }
    }

    // Update Conversation State
    conversation.lastMessage = userMessageContent;
    conversation.lastMessageTime = Date.now();
    
    conversation.messages.push({
        id: Date.now().toString(),
        role: 'user',
        content: userMessageContent,
        timestamp: Date.now(),
        type: messageType,
        attachments: attachments
    });

    // 3. AI Logic (PDF 6.3 & 7.4)
    if (!conversation.isAiPaused && messageType === 'text') {
        try {
            console.log(`[AI] Generating response for ${senderId}...`);
            
            // Context Awareness
            const productList = PRODUCT_CATALOG.map(p => `${p.id}: ${p.name} (₹${p.price})`).join('\n');
            
            const systemMessage = {
                role: "developer",
                content: [{ type: "text", text: `You are the AI assistant for Hewdes Gifts. 
                Your Goal: Sell gifts and answer questions.
                
                AVAILABLE PRODUCTS:
                ${productList}

                INSTRUCTIONS:
                1. If the user asks for products, return a JSON object with "type": "recommendation" and "productIds": ["id1", "id2"].
                2. If the user asks a general question, return JSON with "type": "text" and "message": "your response".
                3. Be concise and friendly.` }]
            };
            
            const userHistory = conversation.messages.slice(-5).map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: [{ type: "text", text: m.content || "[Non-text message]" }]
            }));

            const payload = [systemMessage, ...userHistory];
            const kieResponse = await callKieGemini(payload, HARDCODED_KIE_KEY);
            
            // Parse JSON Response
            let aiResponseRaw = kieResponse.choices?.[0]?.message?.content;
            let aiAction = { type: 'text', message: "I'm having trouble connecting right now." };
            
            try {
                if (typeof aiResponseRaw === 'string') {
                    // Clean up markdown code blocks if present
                    aiResponseRaw = aiResponseRaw.replace(/```json/g, '').replace(/```/g, '');
                    aiAction = JSON.parse(aiResponseRaw);
                }
            } catch (e) {
                console.error("Failed to parse AI JSON:", e);
                aiAction = { type: 'text', message: aiResponseRaw }; // Fallback to raw text
            }

            // Execute Response Strategy based on Type
            if (aiAction.type === 'recommendation' && aiAction.productIds) {
                // Construct Generic Template (PDF 5.4)
                const elements = aiAction.productIds.map(pid => {
                    const prod = PRODUCT_CATALOG.find(p => p.id === pid);
                    if (!prod) return null;
                    return {
                        title: prod.name,
                        subtitle: `₹${prod.price}`,
                        image_url: prod.imageUrl,
                        buttons: [
                            { type: "postback", title: "View Details", payload: `VIEW_${prod.id}` },
                            { type: "postback", title: "Add to Cart", payload: `ADD_${prod.id}` }
                        ]
                    };
                }).filter(Boolean);

                if (elements.length > 0) {
                    await sendInstagramMessage(senderId, { type: 'template', elements });
                    
                    // Store in DB
                    conversation.messages.push({
                        id: (Date.now() + 1).toString(),
                        role: 'model',
                        content: "Here are some recommendations:",
                        timestamp: Date.now(),
                        type: 'template',
                        attachments: [{ type: 'template', payload: { template_type: 'generic', elements } }]
                    });
                }
            } else {
                // Standard Text
                const responseText = aiAction.message || "How can I help?";
                await sendInstagramMessage(senderId, responseText);
                
                conversation.messages.push({
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    content: responseText,
                    timestamp: Date.now(),
                    type: 'text'
                });
                conversation.lastMessage = responseText;
            }

        } catch (e) {
            console.error("AI Auto-Reply Error:", e);
        }
    }
}

// --- WEBHOOK HANDLER (PDF Section 4) ---
const handleWebhookEvent = async (req, res, platform) => {
  const body = req.body;
  addSystemLog('POST', req.url, 200, 'Webhook Received', platform, body);

  // 1. Parse Standard Meta Payload (PDF 4.1)
  // Structure: object -> entry[] -> messaging[] OR changes[]
  if (body.object === 'instagram' || body.object === 'page') {
      if (Array.isArray(body.entry)) {
          for (const entry of body.entry) {
              
              // Handle Messaging Events (Messages, Postbacks, Reactions)
              if (Array.isArray(entry.messaging)) {
                  for (const event of entry.messaging) {
                      const senderId = event.sender?.id;
                      if (senderId) {
                          await handleIncomingMessageFlow(platform, senderId, event);
                      }
                  }
              }
              
              // Handle Changes (Comments, Mentions - PDF 4.8, 4.9)
              if (Array.isArray(entry.changes)) {
                  for (const change of entry.changes) {
                      // Logic for comments would go here
                      // value: { field: 'comments', value: { ... } }
                      console.log("Change event detected:", change.field);
                  }
              }
          }
      }
  }
  // 2. Handle User-Provided "Direct" Format (Legacy/Debug support from prompt)
  else if (body.field === 'messages' && body.value) {
      const senderId = body.value.sender?.id;
      // Map to standard event structure for unified processing
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

// Polling for Frontend
app.get('/api/conversations', (req, res) => {
    res.json(conversationsStore);
});

// Manual Message from Agent
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
        // PDF Section 6.4: Human Handoff - Pause AI if agent intervenes
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

// Existing Route Mappings
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
