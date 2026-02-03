
import { GoogleGenAI } from "@google/genai";

// --- CONFIGURATION ---
const VERIFY_TOKEN = 'hewdes_rttf0kd11o1axrmc';
let RUNTIME_IG_TOKEN = "";
let RUNTIME_GRAPH_VERSION = "v24.0";
const MAX_LOGS = 100;

// --- MOCK PRODUCT CATALOG ---
const PRODUCT_CATALOG = [
    { id: '101', name: 'Custom Engraved Wooden Watch', price: 2499, description: 'Handcrafted sandalwood watch.', imageUrl: 'https://picsum.photos/400/400?random=1' },
    { id: '102', name: 'Personalized Leather Wallet', price: 1299, description: 'Genuine leather with embossing.', imageUrl: 'https://picsum.photos/400/400?random=2' },
    { id: '103', name: 'Ceramic Magic Photo Mug', price: 499, description: 'Reveals photo when hot.', imageUrl: 'https://picsum.photos/400/400?random=3' }
];

// --- DATABASE HELPERS ---

async function initializeDatabase(db: any) {
    await db.batch([
        db.prepare(`
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                igsid TEXT,
                customer_name TEXT,
                platform TEXT,
                last_message TEXT,
                last_message_time INTEGER,
                unread_count INTEGER,
                is_ai_paused INTEGER,
                avatar_url TEXT,
                tags TEXT,
                status TEXT
            )
        `),
        db.prepare(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                role TEXT,
                content TEXT,
                timestamp INTEGER,
                type TEXT,
                is_human_override INTEGER
            )
        `),
        db.prepare(`
            CREATE TABLE IF NOT EXISTS system_logs (
                id TEXT PRIMARY KEY,
                timestamp TEXT,
                method TEXT,
                path TEXT,
                status INTEGER,
                outcome TEXT,
                source TEXT,
                payload TEXT
            )
        `)
    ]);
}

async function addSystemLog(db: any, method: string, url: string, status: number, outcome: string, source: string, payload: any) {
    console.log(`[LOG] ${method} ${url} - ${outcome} (${status})`);
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    try {
        await db.prepare(`
            INSERT INTO system_logs (id, timestamp, method, path, status, outcome, source, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, 
            new Date().toISOString(), 
            method, 
            url, 
            status, 
            outcome, 
            source, 
            JSON.stringify(payload || {})
        ).run();
        
        // Cleanup old logs (keep last 100)
        // Note: D1 doesn't strictly support nested subqueries in DELETE in all versions, simple approach:
        // For production, run cleanup as a scheduled task.
    } catch (e) {
        console.error("Failed to write log to DB", e);
    }
}

// --- INSTAGRAM API ---

async function fetchInstagramProfile(igsid: string, token: string, db: any) {
    if (!token) return null;
    const url = `https://graph.instagram.com/${RUNTIME_GRAPH_VERSION}/${igsid}?fields=name,username,profile_pic&access_token=${token}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
             await addSystemLog(db, 'GET', url, response.status, 'Profile Fetch Failed', 'system', data);
             return null;
        }
        return data;
    } catch (e: any) {
        return null;
    }
}

async function callInstagramApi(payload: any, token: string, db: any) {
    if (!token) {
        await addSystemLog(db, 'POST', 'https://graph.facebook.com/...', 400, 'Missing IG Token', 'instagram', payload);
        return;
    }
    const url = `https://graph.facebook.com/${RUNTIME_GRAPH_VERSION}/me/messages?access_token=${token}`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Graph API Error", e);
    }
}

// --- AI LOGIC ---

async function generateAiResponse(conversationHistory: any[], apiKey: string) {
    if (!apiKey) return "I can't think right now (Missing API Key).";
    try {
        const ai = new GoogleGenAI({ apiKey });
        const productContext = PRODUCT_CATALOG.map(p => `ID: ${p.id}, Name: ${p.name}, Price: ₹${p.price}`).join('\n');
        const systemInstruction = `You are "Hewdes Bot". CATALOG: ${productContext}. Rules: Friendly, under 300 chars.`;
        
        const historyForModel = conversationHistory.slice(-5).map(m => ({ 
            role: m.role === 'model' ? 'model' : 'user', 
            parts: [{ text: m.content || "" }] 
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: historyForModel,
            config: { systemInstruction, maxOutputTokens: 300 },
        });
        return response.text || "Thinking...";
    } catch (e) {
        console.error("AI Generation Error:", e);
        return "I'm a bit busy right now.";
    }
}

// --- MESSAGE FLOW ---

async function handleIncomingMessage(senderId: string, incomingData: any, env: any) {
    const db = env.hewdesdb;
    const token = RUNTIME_IG_TOKEN || env.IG_ACCESS_TOKEN;
    const apiKey = env.API_KEY;

    console.log(`[HANDLE] Processing message from ${senderId}`);

    // 1. Fetch or Create Conversation
    let conversation = await db.prepare("SELECT * FROM conversations WHERE igsid = ?").bind(senderId).first();
    
    if (!conversation) {
        // Fetch Profile
        const profileData = await fetchInstagramProfile(senderId, token, db);
        let profileName = `User ${senderId.slice(-4)}`;
        let profileAvatar = `https://ui-avatars.com/api/?name=User+${senderId.slice(-4)}&background=random`;

        if (profileData) {
            if (profileData.name) profileName = profileData.name;
            else if (profileData.username) profileName = profileData.username;
            if (profileData.profile_pic) profileAvatar = profileData.profile_pic;
        }

        const newId = Date.now().toString();
        const initialTags = JSON.stringify([{ id: 'new', label: 'New Lead', color: 'bg-blue-100 text-blue-700' }]);
        
        await db.prepare(`
            INSERT INTO conversations (id, igsid, customer_name, platform, last_message, last_message_time, unread_count, is_ai_paused, avatar_url, tags, status)
            VALUES (?, ?, ?, 'instagram', '', ?, 0, 0, ?, ?, 'active')
        `).bind(newId, senderId, profileName, Date.now(), profileAvatar, initialTags).run();

        conversation = await db.prepare("SELECT * FROM conversations WHERE id = ?").bind(newId).first();
    }

    // 2. Store User Message
    const userText = incomingData.message?.text || "[Attachment]";
    const msgId = Date.now().toString();
    
    await db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, type, is_human_override)
        VALUES (?, ?, 'user', ?, ?, ?, 0)
    `).bind(msgId, conversation.id, userText, Date.now(), incomingData.message?.text ? 'text' : 'image').run();

    // Update Conversation Metadata
    await db.prepare(`
        UPDATE conversations SET last_message = ?, last_message_time = ?, unread_count = unread_count + 1 WHERE id = ?
    `).bind(userText, Date.now(), conversation.id).run();

    // 3. AI Reply Logic
    if (!conversation.is_ai_paused && apiKey) {
        // Fetch recent messages for context
        const { results: history } = await db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC").bind(conversation.id).all();
        
        const aiText = await generateAiResponse(history, apiKey);
        
        // Send to Instagram
        await callInstagramApi({ recipient: { id: senderId }, message: { text: aiText } }, token, db);
        
        // Store AI Message
        const aiMsgId = (Date.now() + 1).toString();
        await db.prepare(`
            INSERT INTO messages (id, conversation_id, role, content, timestamp, type, is_human_override)
            VALUES (?, ?, 'model', ?, ?, 'text', 0)
        `).bind(aiMsgId, conversation.id, aiText, Date.now()).run();

        // Update Conversation Last Message
        await db.prepare(`
            UPDATE conversations SET last_message = ?, last_message_time = ? WHERE id = ?
        `).bind(aiText, Date.now(), conversation.id).run();
    }

    return { success: true, conversationId: conversation.id };
}

// --- MAIN HANDLER (Cloudflare Pages Function) ---

export const onRequest = async (context: any) => {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    const db = env.hewdesdb;

    if (!db) {
        return new Response(JSON.stringify({ error: "Database binding 'hewdesdb' not found." }), { status: 500 });
    }

    // Ensure Tables Exist (Simple check on every request for this setup)
    await initializeDatabase(db);

    // Config Init
    if (!RUNTIME_IG_TOKEN && env.IG_ACCESS_TOKEN) RUNTIME_IG_TOKEN = env.IG_ACCESS_TOKEN;

    const jsonResponse = (data: any, status = 200) => {
        return new Response(JSON.stringify(data), {
            status,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            }
        });
    };

    // --- API ROUTES ---

    if (request.method === 'GET' && path === '/health') {
        const count = await db.prepare("SELECT COUNT(*) as c FROM conversations").first();
        return jsonResponse({ status: 'ok', db_connected: true, conversation_count: count.c });
    }

    if (request.method === 'GET' && path === '/api/logs') {
        const { results } = await db.prepare("SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 50").all();
        const parsedLogs = results.map((log: any) => ({
            ...log,
            payload: JSON.parse(log.payload)
        }));
        return jsonResponse(parsedLogs);
    }

    if (request.method === 'GET' && path === '/api/conversations') {
        // Fetch all conversations
        const { results: conversations } = await db.prepare("SELECT * FROM conversations ORDER BY last_message_time DESC").all();
        
        // Hydrate with messages (Not efficient for huge datasets, but fine for CRM view)
        const fullConversations = await Promise.all(conversations.map(async (c: any) => {
            const { results: messages } = await db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC").bind(c.id).all();
            return {
                id: c.id,
                igsid: c.igsid,
                customerName: c.customer_name,
                platform: c.platform,
                lastMessage: c.last_message,
                lastMessageTime: c.last_message_time,
                unreadCount: c.unread_count,
                isAiPaused: !!c.is_ai_paused,
                avatarUrl: c.avatar_url,
                tags: JSON.parse(c.tags || '[]'),
                status: c.status,
                messages: messages.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                    type: m.type,
                    isHumanOverride: !!m.is_human_override
                }))
            };
        }));

        return jsonResponse(fullConversations);
    }

    if (request.method === 'POST' && path === '/api/config') {
        const body: any = await request.json();
        if (body.igToken) RUNTIME_IG_TOKEN = body.igToken;
        if (body.graphVersion) RUNTIME_GRAPH_VERSION = body.graphVersion;
        await addSystemLog(db, 'POST', path, 200, 'Config Updated', 'system', body);
        return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path.match(/\/api\/conversations\/.*\/message/)) {
        const id = path.split('/')[3];
        const body: any = await request.json();
        
        const conv = await db.prepare("SELECT * FROM conversations WHERE id = ?").bind(id).first();
        
        if (conv) {
            // Insert Message
            await db.prepare(`
                INSERT INTO messages (id, conversation_id, role, content, timestamp, type, is_human_override)
                VALUES (?, ?, ?, ?, ?, 'text', 1)
            `).bind(Date.now().toString(), id, body.role || 'user', body.text, Date.now()).run();

            // Update Conversation
            await db.prepare(`
                UPDATE conversations SET last_message = ?, last_message_time = ?, is_ai_paused = 1 WHERE id = ?
            `).bind(body.text, Date.now(), id).run();

            // Send to IG
            await callInstagramApi({ recipient: { id: conv.igsid }, message: { text: body.text } }, RUNTIME_IG_TOKEN, db);
            
            return jsonResponse({ success: true });
        }
        return jsonResponse({ error: 'Not found' }, 404);
    }

    if (request.method === 'POST' && path.match(/\/api\/conversations\/.*\/pause/)) {
        const id = path.split('/')[3];
        await db.prepare("UPDATE conversations SET is_ai_paused = 1 WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true });
    }

    // --- WEBHOOK ROUTES ---

    if (path === '/webhook/instagram') {
        // VERIFICATION
        if (request.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');
            
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                await addSystemLog(db, 'GET', path, 200, 'Webhook Verified', 'instagram', Object.fromEntries(url.searchParams));
                return new Response(challenge, { status: 200 });
            }
            return new Response('Forbidden', { status: 403 });
        }

        // EVENT RECEIPT
        if (request.method === 'POST') {
            const debugInfo: any = { processed: 0 };
            try {
                const body: any = await request.json();
                console.log(`[WEBHOOK] DB Persistent Handler. Payload Size: ${JSON.stringify(body).length}`);

                if (body.object === 'instagram' || body.object === 'page') {
                    if (Array.isArray(body.entry)) {
                        for (const entry of body.entry) {
                             const events = entry.messaging || entry.changes;
                             if (Array.isArray(events)) {
                                 for (const event of events) {
                                     const senderId = event.sender?.id || (event.value ? event.value.sender?.id : null);
                                     if (senderId && !event.message?.is_echo) {
                                         await handleIncomingMessage(String(senderId), event, env);
                                         debugInfo.processed++;
                                     }
                                 }
                             }
                        }
                    }
                }
                
                await addSystemLog(db, 'POST', path, 200, 'Webhook Processed & Saved to DB', 'instagram', { count: debugInfo.processed });
                
                return new Response(JSON.stringify({ 
                    status: 'EVENT_RECEIVED', 
                    persistence: 'D1_DATABASE',
                    processed: debugInfo.processed
                }), { status: 200, headers: {'Content-Type': 'application/json'} });

            } catch (e: any) {
                console.error(`[WEBHOOK] Error:`, e);
                await addSystemLog(db, 'POST', path, 500, 'Webhook Error', 'instagram', { error: e.message });
                return new Response(JSON.stringify({ error: e.message }), { status: 200 });
            }
        }
    }

    return context.next();
};
