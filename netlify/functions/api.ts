
import express, { Router } from 'express';
import serverless from 'serverless-http';

const api = express();
const router = Router();

// --- CRITICAL: Enable JSON Parsing ---
// Fix: Cast middleware to any to avoid TypeScript overload mismatch errors with PathParams
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

// --- Local Helper Functions for Tools ---
const checkDeliveryAPI = async (pincode: string): Promise<string> => {
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
  const options = { weekday: 'long', month: 'short', day: 'numeric' } as const;
  // @ts-ignore
  const formattedDate = deliveryDate.toLocaleDateString('en-IN', options);
  return `Good news, we service ${regionName}! If you order now, it should reach you by ${formattedDate} (approx ${days} days).`;
};

// --- KIE API Integration ---
async function callKieGemini(messages: any[], apiKey: string) {
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

    const body = {
        messages: messages,
        stream: false,
        tools: tools
    };

    console.log(`[Netlify] POST ${KIE_ENDPOINT}`);

    try {
        const response = await fetch(KIE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`[Netlify] KIE Error ${response.status}:`, err);
            throw new Error(`KIE API Error: ${response.status} ${err}`);
        }

        return await response.json();
    } catch (error) {
        console.error("[Netlify] Fetch Failed:", error);
        throw error;
    }
}

// --- Chat Endpoint ---
router.post('/chat', async (req, res) => {
  try {
    // Add default values to destructuring
    const { history = [], currentMessage, products = [], rules = [], platform, apiKey } = req.body || {};
    const effectiveApiKey = apiKey || HARDCODED_KIE_KEY;

    if (!effectiveApiKey) {
        return res.status(500).json({ text: "Server Configuration Error: No API Key available." });
    }

    // Safely map products
    const productCatalog = Array.isArray(products) ? products.map((p: any) => 
      `ITEM: ${p.name} | PRICE: ${p.price} | STOCK: ${p.inStock ? 'Yes' : 'No'}`
    ).join('\n') : '';

    // Safely map rules
    const activeRules = Array.isArray(rules) ? rules.filter((r: any) => r.isActive).map((r: any) => `- ${r.content}`).join('\n') : '';

    const systemMessage = {
        role: "developer",
        content: [{ 
            type: "text", 
            text: `You are a helpful assistant for "Hewdes Gifts" on ${platform}. 
                   GOAL: Sell gifts. 
                   PRODUCTS:\n${productCatalog}\n
                   RULES:\n${activeRules}\n
                   If delivery asked, use checkDelivery with pincode.` 
        }]
    };

    // Safely filter history
    const conversationMessages = Array.isArray(history) ? history
        .filter((msg: any) => ['user', 'model', 'assistant', 'tool'].includes(msg.role))
        .map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: [{ type: "text", text: msg.content }]
        })) : [];

    conversationMessages.push({ role: "user", content: [{ type: "text", text: currentMessage }] });

    // Fix: Explicitly type payload as any[] to allow objects with 'tool_call_id' without TS inference errors
    const payload: any[] = [systemMessage, ...conversationMessages];

    let kieResponse = await callKieGemini(payload, effectiveApiKey);
    const choice = kieResponse.choices?.[0];
    const message = choice?.message;
    let finalAction = undefined;

    if (message && (choice.finish_reason === "tool_calls" || message.tool_calls)) {
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
                toolResult = "Support ticket created.";
                addSystemLog('POST', '/api/chat', 200, 'Escalation', platform, args);
            }
            payload.push({
                role: "tool", 
                tool_call_id: toolCall.id, 
                content: [{ type: "text", text: toolResult }]
            });
        }
        kieResponse = await callKieGemini(payload, effectiveApiKey);
    }

    const finalContent = kieResponse.choices?.[0]?.message?.content;
    let textResponse = "I'm not sure how to answer that.";
    if (typeof finalContent === 'string') textResponse = finalContent;
    else if (Array.isArray(finalContent)) textResponse = finalContent.map((c: any) => c.text).join(' ');

    // --- LOGGING ---
    addSystemLog('POST', '/api/chat', 200, 'Outgoing Chat & Response', platform || 'simulator', {
        input: currentMessage,
        response: textResponse,
        toolUsed: finalAction || 'None',
        tokenUsage: kieResponse.usage || 'N/A'
    });

    res.json({ text: textResponse, actionTaken: finalAction });

  } catch (e: any) {
    console.error("Error in Backend:", e);
    const msg = e.message || "Unknown error";
    addSystemLog('POST', '/api/chat', 500, 'Chat Failure', req.body?.platform || 'system', { error: msg });
    res.status(500).json({ text: `System Error: ${msg}`, actionTaken: "API Error" });
  }
});

// --- Standard Webhooks ---
router.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Hewdes CRM (Netlify Function) is Running' }));
router.get('/logs', (req, res) => res.json(systemLogs));

router.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      addSystemLog('GET', '/webhook/instagram', 200, 'Verification Success', 'instagram', req.query);
      res.status(200).send(challenge);
  } else {
      res.sendStatus(403);
  }
});

router.post('/webhook/instagram', (req, res) => {
  addSystemLog('POST', '/webhook/instagram', 200, 'Event Received', 'instagram', req.body);
  res.status(200).send('EVENT_RECEIVED');
});

router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
      addSystemLog('GET', '/webhook/whatsapp', 200, 'Verification Success', 'whatsapp', req.query);
      res.status(200).send(challenge);
  } else {
      res.sendStatus(403);
  }
});

router.post('/webhook/whatsapp', (req, res) => {
  addSystemLog('POST', '/webhook/whatsapp', 200, 'Event Received', 'whatsapp', req.body);
  res.status(200).send('EVENT_RECEIVED');
});

api.use('/api', router);
api.use('/', router);

export const handler = serverless(api);
