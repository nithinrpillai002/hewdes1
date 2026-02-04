

// --- CONFIGURATION ---
const VERIFY_TOKEN = 'hewdes_rttf0kd11o1axrmc';
const KIE_API_ENDPOINT = "https://api.kie.ai/gemini-3-flash/v1/chat/completions";

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
        `),
        db.prepare(`
            CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT
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
    } catch (e) {
        console.error("Failed to write log to DB", e);
    }
}

async function getConfig(db: any, key: string) {
    try {
        const res = await db.prepare("SELECT value FROM app_config WHERE key = ?").bind(key).first();
        return res ? res.value : null;
    } catch (e) { return null; }
}

async function setConfig(db: any, key: string, value: string) {
    await db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)").bind(key, value).run();
}

// --- INSTAGRAM API ---

async function fetchInstagramProfile(igsid: string, token: string, version: string, db: any) {
    if (!token) return null;
    const url = `https://graph.facebook.com/${version}/${igsid}?fields=name,username,profile_pic&access_token=${token}`;
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

async function callInstagramApi(payload: any, token: string, version: string, db: any) {
    if (!token) {
        await addSystemLog(db, 'POST', 'https://graph.facebook.com/...', 400, 'Missing IG Token', 'instagram', payload);
        console.error("Missing IG Token. Please configure it in Settings.");
        return;
    }
    const url = `https://graph.facebook.com/${version}/me/messages?access_token=${token}`;
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

// --- AI LOGIC (KIE API) ---

async function generateAiResponse(conversationHistory: any[], apiKey: string, customInstruction: string | null) {
    if (!apiKey) return "I can't think right now (Missing API Key).";
    
    try {
        // 1. Build Context
        const productContext = PRODUCT_CATALOG.map(p => 
            `- ${p.name} (ID: ${p.id}): ₹${p.price}. ${p.description}`
        ).join('\n');

        const basePersona = `You are Alex, a friendly and helpful sales assistant for "Hewdes Gifts". 
        Your goal is to have a natural conversation with the customer, answer their questions about products, and gently guide them to make a purchase.
        
        CATALOG DATA:
        ${productContext}
        
        GUIDELINES:
        - Be human-like, casual, and polite. Use emojis occasionally (e.g., 😊, 🎁).
        - Don't write long paragraphs. Keep it short and chatty like a real WhatsApp/Instagram message.
        - If they ask about a product, give the price and a detail, then ask if they want to order.
        - If they want to buy, ask for their shipping address or guide them to the website link.
        - NEVER mention you are an AI or a bot. Act like a person working at the shop.
        `;

        // 2. Handle Custom Instructions (Text or JSON Array)
        let formattedCustomInstructions = "";
        if (customInstruction) {
            try {
                // Try parsing as JSON array (new format)
                const parsed = JSON.parse(customInstruction);
                if (Array.isArray(parsed)) {
                    formattedCustomInstructions = parsed
                        .filter((i: any) => i.isActive)
                        .map((i: any) => `[${i.label.toUpperCase()}]: ${i.content}`)
                        .join('\n\n');
                } else {
                    // JSON but not array? Treat as string
                    formattedCustomInstructions = customInstruction;
                }
            } catch (e) {
                // Not JSON? Treat as plain text (legacy format)
                formattedCustomInstructions = customInstruction;
            }
        }

        const finalSystemPrompt = formattedCustomInstructions 
            ? `${basePersona}\n\nADDITIONAL INSTRUCTIONS:\n${formattedCustomInstructions}` 
            : basePersona;

        // 3. Format Messages for KIE API
        const messages = [
            { role: "developer", content: finalSystemPrompt }, // Using 'developer' role as per KIE docs
            ...conversationHistory.map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user', // Map internal 'model' to 'assistant'
                content: m.content || ""
            }))
        ];

        // 4. Call KIE API
        const response = await fetch(KIE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gemini-3-flash',
                messages: messages,
                stream: false,
                include_thoughts: false
            })
        });

        const data: any = await response.json();

        if (!response.ok) {
            console.error("KIE API Error:", data);
            return "I'm having a little trouble checking that right now. Can you ask me again in a moment?";
        }

        return data.choices?.[0]?.message?.content || "Thinking...";

    } catch (e) {
        console.error("AI Generation Error:", e);
        return "I'm a bit busy right now checking stock. One sec!";
    }
}

// --- MESSAGE FLOW ---

async function handleIncomingMessage(senderId: string, incomingData: any, env: any) {
    const db = env.hewdesdb;
    
    // Retrieve Configuration from DB
    const dbToken = await getConfig(db, 'ig_token');
    const dbVersion = await getConfig(db, 'graph_version');
    const kieApiKey = await getConfig(db, 'kie_api_key');
    const aiInstruction = await getConfig(db, 'ai_instruction');
    
    const token = dbToken || env.IG_ACCESS_TOKEN;
    const graphVersion = dbVersion || "v24.0";

    console.log(`[HANDLE] Processing message from ${senderId}`);

    // 1. Fetch or Create Conversation
    let conversation = await db.prepare("SELECT * FROM conversations WHERE igsid = ?").bind(senderId).first();
    
    if (!conversation) {
        const profileData = await fetchInstagramProfile(senderId, token, graphVersion, db);
        let profileName = `User ${senderId.slice(-4)}`;
        let profileAvatar = `https://ui-avatars.com/api/?name=User+${senderId.slice(-4)}&background=random`;

        if (profileData) {
            if (profileData.name) profileName = profileData.name;
            else if (profileData.username) profileName = profileData.username;
            if (profileData.profile_pic) profileAvatar = profileData.profile_pic;
            
            await addSystemLog(db, 'INFO', 'ProfileFetch', 200, `Fetched profile for ${senderId}`, 'instagram', profileData);
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
    // NOTE: This function is only called if 'message' object exists, ensuring we don't store read receipts as [Attachment]
    const text = incomingData.message?.text;
    const attachments = incomingData.message?.attachments;
    let userText = "";
    let msgType = "text";

    if (text) {
        userText = text;
    } else if (attachments && attachments.length > 0) {
        userText = "[Attachment]";
        msgType = "image";
    } else {
        // Fallback for weird sticker/media cases that are not read/delivery
        userText = "[Media]";
        msgType = "image";
    }

    const msgId = Date.now().toString();
    
    await db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, type, is_human_override)
        VALUES (?, ?, 'user', ?, ?, ?, 0)
    `).bind(msgId, conversation.id, userText, Date.now(), msgType).run();

    // Update Conversation Metadata
    await db.prepare(`
        UPDATE conversations SET last_message = ?, last_message_time = ?, unread_count = unread_count + 1 WHERE id = ?
    `).bind(userText, Date.now(), conversation.id).run();

    // 3. AI Reply Logic
    if (!conversation.is_ai_paused && kieApiKey) {
        const { results: history } = await db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC").bind(conversation.id).all();
        
        // Pass the custom instruction from DB
        const aiText = await generateAiResponse(history, kieApiKey, aiInstruction);
        
        await callInstagramApi({ recipient: { id: senderId }, message: { text: aiText } }, token, graphVersion, db);
        
        const aiMsgId = (Date.now() + 1).toString();
        await db.prepare(`
            INSERT INTO messages (id, conversation_id, role, content, timestamp, type, is_human_override)
            VALUES (?, ?, 'model', ?, ?, 'text', 0)
        `).bind(aiMsgId, conversation.id, aiText, Date.now()).run();

        await db.prepare(`
            UPDATE conversations SET last_message = ?, last_message_time = ? WHERE id = ?
        `).bind(aiText, Date.now(), conversation.id).run();
    } else if (!kieApiKey && !conversation.is_ai_paused) {
         await addSystemLog(db, 'WARN', 'AI_REPLY', 400, 'KIE API Key Missing', 'system', null);
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

    await initializeDatabase(db);

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
        const { results: conversations } = await db.prepare("SELECT * FROM conversations ORDER BY last_message_time DESC").all();
        
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

    if (request.method === 'GET' && path === '/api/config') {
        // Return sensitive config for the admin UI to display/edit
        // In a real production app, you might want to mask the API key
        const kieApiKey = await getConfig(db, 'kie_api_key');
        const aiInstruction = await getConfig(db, 'ai_instruction');
        const igToken = await getConfig(db, 'ig_token');
        const graphVersion = await getConfig(db, 'graph_version');
        
        return jsonResponse({
            kieApiKey: kieApiKey || '',
            aiInstruction: aiInstruction || '',
            igToken: igToken || '',
            graphVersion: graphVersion || 'v24.0'
        });
    }

    if (request.method === 'POST' && path === '/api/config') {
        const body: any = await request.json();
        // Save IG settings
        if (body.igToken !== undefined) await setConfig(db, 'ig_token', body.igToken);
        if (body.graphVersion !== undefined) await setConfig(db, 'graph_version', body.graphVersion);
        
        // Save AI settings
        if (body.kieApiKey !== undefined) await setConfig(db, 'kie_api_key', body.kieApiKey);
        if (body.aiInstruction !== undefined) await setConfig(db, 'ai_instruction', body.aiInstruction);
        
        await addSystemLog(db, 'POST', path, 200, 'Config Updated', 'system', body);
        return jsonResponse({ success: true });
    }

    if (request.method === 'DELETE' && path.match(/\/api\/conversations\/.+/)) {
        const id = path.split('/')[3];
        // Hard Delete
        await db.batch([
            db.prepare("DELETE FROM conversations WHERE id = ?").bind(id),
            db.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(id)
        ]);
        await addSystemLog(db, 'DELETE', path, 200, 'Conversation Deleted', 'system', { id });
        return jsonResponse({ success: true });
    }

    if (request.method === 'POST' && path.match(/\/api\/conversations\/.*\/message/)) {
        const id = path.split('/')[3];
        const body: any = await request.json();
        
        // Fetch config for outgoing message - Priority: DB > Env
        const dbToken = await getConfig(db, 'ig_token');
        const dbVersion = await getConfig(db, 'graph_version');
        const token = dbToken || env.IG_ACCESS_TOKEN;
        const version = dbVersion || "v24.0";

        const conv = await db.prepare("SELECT * FROM conversations WHERE id = ?").bind(id).first();
        
        if (conv) {
            await db.prepare(`
                INSERT INTO messages (id, conversation_id, role, content, timestamp, type, is_human_override)
                VALUES (?, ?, ?, ?, ?, 'text', 1)
            `).bind(Date.now().toString(), id, body.role || 'user', body.text, Date.now()).run();

            await db.prepare(`
                UPDATE conversations SET last_message = ?, last_message_time = ?, is_ai_paused = 1 WHERE id = ?
            `).bind(body.text, Date.now(), id).run();

            await callInstagramApi({ recipient: { id: conv.igsid }, message: { text: body.text } }, token, version, db);
            
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
                                     
                                     // FILTER: Only process actual messages, ignore read receipts/deliveries/echoes
                                     if (senderId && event.message && !event.message.is_echo && !event.delivery && !event.read) {
                                         await handleIncomingMessage(String(senderId), event, env);
                                         debugInfo.processed++;
                                     }
                                 }
                             }
                        }
                    }
                }
                
                await addSystemLog(db, 'POST', path, 200, 'Webhook Processed & Saved to DB', 'instagram', { count: debugInfo.processed });
                return new Response(JSON.stringify({ status: 'EVENT_RECEIVED', processed: debugInfo.processed }), { status: 200 });

            } catch (e: any) {
                console.error(`[WEBHOOK] Error:`, e);
                await addSystemLog(db, 'POST', path, 500, 'Webhook Error', 'instagram', { error: e.message });
                return new Response(JSON.stringify({ error: e.message }), { status: 200 });
            }
        }
    }

    return context.next();
};
