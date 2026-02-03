
const express = require('express');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

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

// --- MIDDLEWARE ---
app.enable('trust proxy'); 

// Extended Request Logging
app.use((req, res, next) => {
  const isWebhook = req.url.includes('/webhook');
  const isApi = req.url.includes('/api/');
  const isAsset = req.url.match(/\.(js|css|png|jpg|ico|tsx|ts|json)$/);

  if (isWebhook) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║ 📨 INCOMING WEBHOOK: ${req.method} ${req.originalUrl}`);
    console.log('╚════════════════════════════════════════════════════════════╝');
  } else if (isApi) {
    console.log(`[API] ${req.method} ${req.originalUrl}`);
  } else if (!isAsset) {
    console.log(`[ACCESS] ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- IN-MEMORY LOGGING SYSTEM ---
let systemLogs = [];
const MAX_LOGS = 50;

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
  
  // Console feedback
  if (status >= 400) {
    console.error(`[LOG-ERROR] ${outcome}`);
  } else {
    console.log(`[LOG-SAVED] ${outcome}`);
  }
};

// --- CHAT HELPERS (LOCAL IMPLEMENTATION) ---
const checkDeliveryAPI = async (pincode) => {
  await new Promise(resolve => setTimeout(resolve, 800));
  const validPincode = /^[1-9][0-9]{5}$/.test(pincode);
  if (!validPincode) return "That doesn't look like a valid pincode. Could you please double-check? It should be 6 digits.";
  
  const regionDigit = parseInt(pincode[0]);
  let days = 3;
  let regionName = "Metro City";
  if (regionDigit <= 3) { days = 2; regionName = "North/West India"; }
  else if (regionDigit <= 6) { days = 3; regionName = "South/Central India"; }
  else { days = 5; regionName = "East/North-East India"; }

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + days);
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  const formattedDate = deliveryDate.toLocaleDateString('en-IN', options);
  
  return `Good news, we service ${regionName}! If you order now, it should reach you by ${formattedDate} (approx ${days} days).`;
};

// --- KIE API Integration ---
async function callKieGemini(messages, apiKey) {
    const KIE_ENDPOINT = "https://api.kie.ai/gemini-3-flash/v1/chat/completions";
    
    const tools = [
        {
            type: "function",
            function: {
                name: "checkDelivery",
                description: "Checks delivery availability and estimated delivery date for a given Indian pincode.",
                parameters: {
                    type: "object",
                    properties: { pincode: { type: "string", description: "The 6-digit pincode." } },
                    required: ["pincode"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "escalateToHuman",
                description: "Escalates the conversation to a human agent.",
                parameters: {
                    type: "object",
                    properties: { reason: { type: "string" }, summary: { type: "string" } },
                    required: ["reason", "summary"]
                }
            }
        }
    ];

    try {
        const response = await fetch(KIE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages: messages, tools: tools, stream: false })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("KIE API Error:", err);
            throw new Error(`KIE API Error: ${response.status} ${err}`);
        }
        return await response.json();
    } catch (error) { throw error; }
}

// --- API ROUTES ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hewdes CRM Server is Running' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hewdes CRM Server is Running' });
});

app.get('/api/logs', (req, res) => {
  res.json(systemLogs);
});

// CHAT ROUTE (Now implemented locally)
app.post('/api/chat', async (req, res) => {
  try {
    const { history, currentMessage, products, rules, platform, apiKey } = req.body;
    const effectiveApiKey = apiKey || HARDCODED_KIE_KEY;

    if (!effectiveApiKey) {
        return res.status(500).json({ text: "Server Configuration Error: No API Key available." });
    }

    const productCatalog = products ? products.map((p) => 
      `ITEM: ${p.name} | PRICE: ₹${p.price} | DETAILS: ${p.description} | STOCK: ${p.inStock ? 'Yes' : 'No'}`
    ).join('\n') : '';

    const activeRules = rules ? rules.filter((r) => r.isActive).map((r) => `- ${r.content}`).join('\n') : '';

    const systemMessage = {
        role: "developer",
        content: [{ type: "text", text: `You are a helpful assistant for "Hewdes Gifts" on ${platform}. GOAL: Help customers buy gifts. PRODUCTS:\n${productCatalog}\nRULES:\n${activeRules}\nIf asked about delivery, ALWAYS ask for a pincode and use checkDelivery.` }]
    };

    const conversationMessages = history
        .filter((msg) => msg.role === 'user' || msg.role === 'model' || msg.role === 'assistant')
        .map((msg) => ({
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: [{ type: "text", text: msg.content }]
        }));

    conversationMessages.push({ role: "user", content: [{ type: "text", text: currentMessage }] });
    const payload = [systemMessage, ...conversationMessages];

    let kieResponse = await callKieGemini(payload, effectiveApiKey);
    const choice = kieResponse.choices[0];
    const message = choice.message;
    let finalAction = undefined;

    if (choice.finish_reason === "tool_calls" || message.tool_calls) {
        payload.push(message);
        for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            let toolResult = "";
            if (functionName === "checkDelivery") {
                finalAction = `Checking Pincode: ${args.pincode}`;
                toolResult = await checkDeliveryAPI(args.pincode);
            } else if (functionName === "escalateToHuman") {
                finalAction = `Escalating: ${args.reason}`;
                toolResult = "Support ticket created. Agent notified.";
                addSystemLog('POST', '/api/chat', 200, 'Escalation', platform, args);
            }
            payload.push({
                role: "tool", tool_call_id: toolCall.id, content: [{ type: "text", text: toolResult }]
            });
        }
        kieResponse = await callKieGemini(payload, effectiveApiKey);
    }

    const finalContent = kieResponse.choices[0].message.content;
    let textResponse = "";
    if (typeof finalContent === 'string') textResponse = finalContent;
    else if (Array.isArray(finalContent)) textResponse = finalContent.map(c => c.text).join(' ');
    
    res.json({ text: textResponse, actionTaken: finalAction });
  } catch (e) {
    console.error("Error in Backend:", e);
    res.status(500).json({ text: "Sorry, I'm having trouble connecting to the AI brain right now.", actionTaken: "API Error" });
  }
});

// Webhook Routes
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
const handleWebhookEvent = (req, res, platform) => {
  addSystemLog('POST', req.url, 200, 'Event Received', platform, req.body);
  res.status(200).send('EVENT_RECEIVED');
};

app.get('/webhook/instagram', (req, res) => handleWebhookVerification(req, res, 'instagram'));
app.post('/webhook/instagram', (req, res) => handleWebhookEvent(req, res, 'instagram'));
app.get('/webhook/whatsapp', (req, res) => handleWebhookVerification(req, res, 'whatsapp'));
app.post('/webhook/whatsapp', (req, res) => handleWebhookEvent(req, res, 'whatsapp'));

// --- EXPLICIT ROOT HANDLING ---
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// --- FRONTEND SERVING (Transpilation) ---
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
  console.log(`[SYSTEM] Chat Endpoint: /api/chat`);
});