
import { GoogleGenAI } from "@google/genai";

// --- IN-MEMORY STATE (Ephemeral per isolate) ---
// Note: In a serverless edge environment, global variables are not guaranteed 
// to persist across all requests, but often do within the same "warm" instance.
let conversationsStore: any[] = [];
let systemLogs: any[] = [];
const MAX_LOGS = 100;

// Dynamic Config State
let RUNTIME_IG_TOKEN = "";
let RUNTIME_GRAPH_VERSION = "v24.0";
const VERIFY_TOKEN = 'hewdes_rttf0kd11o1axrmc';

// --- MOCK PRODUCT CATALOG ---
const PRODUCT_CATALOG = [
    { id: '101', name: 'Custom Engraved Wooden Watch', price: 2499, description: 'Handcrafted sandalwood watch.', imageUrl: 'https://picsum.photos/400/400?random=1' },
    { id: '102', name: 'Personalized Leather Wallet', price: 1299, description: 'Genuine leather with embossing.', imageUrl: 'https://picsum.photos/400/400?random=2' },
    { id: '103', name: 'Ceramic Magic Photo Mug', price: 499, description: 'Reveals photo when hot.', imageUrl: 'https://picsum.photos/400/400?random=3' }
];

// --- HELPERS ---

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

const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
};

// --- INSTAGRAM API ---

async function fetchInstagramProfile(igsid: string, token: string) {
    if (!token) return null;
    
    const url = `https://graph.instagram.com/${RUNTIME_GRAPH_VERSION}/${igsid}?fields=name,username,profile_pic&access_token=${token}`;
    
    try {
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

async function callInstagramApi(payload: any, token: string) {
    if (!token) {
        addSystemLog('POST', 'https://graph.facebook.com/...', 400, 'Missing IG Token', 'instagram', payload);
        return;
    }

    const url = `https://graph.facebook.com/${RUNTIME_GRAPH_VERSION}/me/messages?access_token=${token}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await response.json();
        
        if (!response.ok) {
             addSystemLog('POST', url, response.status, 'Graph API Error', 'instagram', { request: payload, errorResponse: resData });
        } else {
             addSystemLog('POST', url, 200, 'Message Sent', 'instagram', { request: payload, response: resData });
        }
    } catch (e: any) {
        addSystemLog('POST', url, 500, 'Network Error', 'instagram', { error: e.message });
    }
}

// --- AI LOGIC ---

async function generateAiResponse(conversationHistory: any[], apiKey: string) {
    if (!apiKey) return "I can't think right now (Missing API Key).";

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const productContext = PRODUCT_CATALOG.map(p => 
            `ID: ${p.id}, Name: ${p.name}, Price: ₹${p.price}`
        ).join('\n');

        const systemInstruction = `
            You are "Hewdes Bot", the AI assistant for Hewdes Gifts.
            PRODUCT CATALOG: ${productContext}
            Rules: Clear, friendly text only. No Markdown. Keep it under 300 chars.
        `;

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

// --- MESSAGE FLOW ---

async function handleIncomingMessage(senderId: string, incomingData: any, env: any) {
    const token = RUNTIME_IG_TOKEN || env.IG_ACCESS_TOKEN;
    const apiKey = env.API_KEY;

    // 1. Profile Fetch
    const profileData = await fetchInstagramProfile(senderId, token);

    // 2. CRM Update
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
        // Move to top
        conversationsStore = conversationsStore.filter(c => c.id !== conversation.id);
        conversationsStore.unshift(conversation);
        conversation.unreadCount += 1;
    }

    // 3. Store User Message
    const userText = incomingData.message?.text || "[Attachment]";
    conversation.messages.push({
        id: Date.now().toString(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
        type: incomingData.message?.text ? 'text' : 'image'
    });
    conversation.lastMessage = userText;
    conversation.lastMessageTime = Date.now();

    // 4. AI Reply
    if (!conversation.isAiPaused && apiKey) {
        await callInstagramApi({ recipient: { id: senderId }, sender_action: 'typing_on' }, token);
        
        const aiText = await generateAiResponse(conversation.messages, apiKey);
        
        await callInstagramApi({ recipient: { id: senderId }, message: { text: aiText } }, token);
        
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

// --- MAIN HANDLER (Cloudflare Pages Function) ---

export const onRequest = async (context: any) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Initialize Runtime Config from Env if empty
    if (!RUNTIME_IG_TOKEN && env.IG_ACCESS_TOKEN) {
        RUNTIME_IG_TOKEN = env.IG_ACCESS_TOKEN;
    }

    // --- API ROUTES ---

    if (request.method === 'GET' && path === '/health') {
        return jsonResponse({ status: 'ok', message: 'Hewdes CRM (Cloudflare) Active' });
    }

    if (request.method === 'GET' && path === '/api/logs') {
        return jsonResponse(systemLogs);
    }

    if (request.method === 'GET' && path === '/api/conversations') {
        return jsonResponse(conversationsStore);
    }

    if (request.method === 'POST' && path === '/api/config') {
        const body: any = await request.json();
        if (body.igToken) RUNTIME_IG_TOKEN = body.igToken;
        if (body.graphVersion) RUNTIME_GRAPH_VERSION = body.graphVersion;
        addSystemLog('POST', path, 200, 'Config Updated', 'system', body);
        return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path.match(/\/api\/conversations\/.*\/message/)) {
        const id = path.split('/')[3];
        const body: any = await request.json();
        const conv = conversationsStore.find(c => c.id === id);
        
        if (conv) {
            conv.messages.push({
                id: Date.now().toString(),
                role: body.role || 'user',
                content: body.text,
                timestamp: Date.now(),
                isHumanOverride: true,
                type: 'text'
            });
            conv.lastMessage = body.text;
            conv.lastMessageTime = Date.now();
            conv.isAiPaused = true;
            
            // Send to Instagram
            const token = RUNTIME_IG_TOKEN || env.IG_ACCESS_TOKEN;
            await callInstagramApi({ recipient: { id: conv.igsid }, message: { text: body.text } }, token);
            
            return jsonResponse({ success: true });
        }
        return jsonResponse({ error: 'Not found' }, 404);
    }

    if (request.method === 'POST' && path.match(/\/api\/conversations\/.*\/pause/)) {
        const id = path.split('/')[3];
        const conv = conversationsStore.find(c => c.id === id);
        if (conv) {
            conv.isAiPaused = true;
            return jsonResponse({ success: true });
        }
        return jsonResponse({ error: 'Not found' }, 404);
    }

    // --- WEBHOOK ROUTES ---

    if (path === '/webhook/instagram') {
        // VERIFICATION
        if (request.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');
            
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                addSystemLog('GET', path, 200, 'Webhook Verified', 'instagram', Object.fromEntries(url.searchParams));
                return new Response(challenge, { status: 200 });
            }
            addSystemLog('GET', path, 403, 'Verification Failed', 'instagram', Object.fromEntries(url.searchParams));
            return new Response('Forbidden', { status: 403 });
        }

        // EVENT RECEIPT
        if (request.method === 'POST') {
            try {
                const body: any = await request.json();
                
                if (body.object === 'instagram' || body.object === 'page') {
                    if (Array.isArray(body.entry)) {
                        for (const entry of body.entry) {
                             const events = entry.messaging || entry.changes;
                             if (Array.isArray(events)) {
                                 for (const event of events) {
                                     const senderId = event.sender?.id || (event.value ? event.value.sender?.id : null);
                                     if (senderId && !event.message?.is_echo) {
                                         await handleIncomingMessage(senderId, event, env);
                                     }
                                 }
                             }
                        }
                    }
                }
                addSystemLog('POST', path, 200, 'Webhook Processed', 'instagram', body);
                return new Response('EVENT_RECEIVED', { status: 200 });
            } catch (e: any) {
                addSystemLog('POST', path, 500, 'Webhook Error', 'instagram', { error: e.message });
                return new Response('Error', { status: 500 });
            }
        }
    }

    // Fallthrough to static assets
    return context.next();
};
