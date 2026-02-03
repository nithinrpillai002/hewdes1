/**
 * Cloudflare Worker Backend for InstaCRM
 * Handles Instagram Webhooks, Graph API calls, and KIE Gemini 3 Pro AI analysis.
 */

// Fix: Define missing Cloudflare Workers types
interface KVNamespace {
  get(key: string, options?: { type: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<any>;
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface Env {
  CRM_KV: KVNamespace;
  APP_ID: string;
  WEBHOOK_VERIFY_TOKEN: string;
  PAGE_ACCESS_TOKEN: string;
  KIE_API_KEY: string;
}

const DEFAULT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: DEFAULT_HEADERS });
    }

    // API Routing
    if (url.pathname.startsWith('/api/')) {
      try {
        if (url.pathname === '/api/threads' && request.method === 'GET') {
          return await handleGetThreads(env);
        }
        if (url.pathname.startsWith('/api/threads/') && url.pathname.endsWith('/send') && request.method === 'POST') {
          const threadId = url.pathname.split('/')[3];
          return await handleSendMessage(request, env, threadId);
        }
        if (url.pathname.startsWith('/api/threads/') && request.method === 'GET') {
          const threadId = url.pathname.split('/')[3];
          return await handleGetThreadDetails(env, threadId);
        }
        if (url.pathname === '/api/settings' && request.method === 'GET') {
          return await handleGetSettings(env);
        }
        if (url.pathname === '/api/settings' && request.method === 'POST') {
          return await handleSaveSettings(request, env);
        }
        if (url.pathname === '/api/logs' && request.method === 'GET') {
          return await handleGetLogs(env);
        }
        if (url.pathname === '/api/ai/analyze' && request.method === 'POST') {
          return await handleAIAnalyze(request, env);
        }
        return new Response('Not Found', { status: 404, headers: DEFAULT_HEADERS });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: DEFAULT_HEADERS });
      }
    }

    // Webhook Routing
    if (url.pathname === '/webhook/instagram') {
      if (request.method === 'GET') {
        return handleWebhookVerification(request, env);
      }
      if (request.method === 'POST') {
        return await handleWebhookEvent(request, env);
      }
    }

    // If serving assets via Workers Assets (configured in wrangler.toml), this block is skipped for found assets.
    // If request falls through, return 404.
    return new Response('Not Found', { status: 404 });
  },
};

// --- Webhook Handlers ---

function handleWebhookVerification(request: Request, env: Env): Response {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // Use token from KV settings or Env
  // For verify, we strictly read from Env first for security, or KV if flexible
  const verifyToken = env.WEBHOOK_VERIFY_TOKEN || 'instagram-crm-verify-token';

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

async function handleWebhookEvent(request: Request, env: Env): Promise<Response> {
  const bodyText = await request.text();
  await logEvent(env, 'INCOMING_WEBHOOK', 'INSTAGRAM_EVENT', '/webhook/instagram', 'POST', 200, bodyText, '');
  
  try {
    const payload = JSON.parse(bodyText);
    
    if (payload.object === 'instagram' || payload.object === 'page') {
      for (const entry of payload.entry || []) {
        // Handle messaging events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await processMessagingEvent(env, event);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error processing webhook', e);
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function processMessagingEvent(env: Env, event: any) {
  const senderId = event.sender?.id;
  const text = event.message?.text;
  const mid = event.message?.mid;
  const timestamp = event.timestamp;

  if (!senderId || !text) return;

  const threadId = `thread:${senderId}`;
  let thread: any = await env.CRM_KV.get(threadId, { type: 'json' });

  // Create new thread if not exists
  if (!thread) {
    const profile = await fetchInstagramProfile(env, senderId);
    thread = {
      threadId: senderId,
      igUserId: senderId,
      igUserName: profile.name || `User ${senderId}`,
      igProfileImageUrl: profile.profile_pic || '',
      messages: [],
      lastMessageAt: new Date(timestamp).toISOString(),
      lastMessagePreview: ''
    };
  }

  // Append message
  const newMessage = {
    messageId: mid || `m_${Date.now()}`,
    direction: 'INCOMING',
    text: text,
    createdAt: new Date(timestamp || Date.now()).toISOString()
  };

  thread.messages.push(newMessage);
  thread.lastMessagePreview = text;
  thread.lastMessageAt = newMessage.createdAt;

  // Save full thread
  await env.CRM_KV.put(threadId, JSON.stringify(thread));

  // Update thread list index
  await updateThreadList(env, thread);
}

// --- API Handlers ---

async function handleGetThreads(env: Env): Promise<Response> {
  const list = await env.CRM_KV.get('threads_index', { type: 'json' });
  return new Response(JSON.stringify(list || []), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

async function handleGetThreadDetails(env: Env, threadId: string): Promise<Response> {
  const thread = await env.CRM_KV.get(`thread:${threadId}`, { type: 'json' });
  if (!thread) return new Response('Thread not found', { status: 404, headers: DEFAULT_HEADERS });
  return new Response(JSON.stringify(thread), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

async function handleSendMessage(request: Request, env: Env, threadId: string): Promise<Response> {
  const body: any = await request.json();
  const text = body.text;

  if (!text) throw new Error("Message text required");

  // Get recipient ID (threadId is usually igUserId in this simple model)
  const recipientId = threadId;

  // Call Graph API
  const result = await sendGraphApiMessage(env, recipientId, text);

  // Update local thread
  const kvKey = `thread:${threadId}`;
  const thread: any = await env.CRM_KV.get(kvKey, { type: 'json' });
  
  const newMessage = {
    messageId: result.message_id || `req_${Date.now()}`,
    direction: 'OUTGOING',
    text: text,
    createdAt: new Date().toISOString()
  };

  if (thread) {
    thread.messages.push(newMessage);
    thread.lastMessagePreview = `You: ${text}`;
    thread.lastMessageAt = newMessage.createdAt;
    await env.CRM_KV.put(kvKey, JSON.stringify(thread));
    await updateThreadList(env, thread);
  }

  return new Response(JSON.stringify(newMessage), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

async function handleGetSettings(env: Env): Promise<Response> {
  const settings: any = (await env.CRM_KV.get('settings', { type: 'json' })) || {};
  
  // Mix in Env vars for security (don't return secrets if possible, but for editing UI we might need them)
  const merged = {
    appId: settings.appId || env.APP_ID || '',
    webhookUrl: 'https://' + (new URL(globalThis.location?.href || 'http://localhost')).host + '/webhook/instagram',
    webhookVerifyToken: settings.webhookVerifyToken || env.WEBHOOK_VERIFY_TOKEN || '',
    pageAccessToken: settings.pageAccessToken || env.PAGE_ACCESS_TOKEN || '',
    kieApiKey: settings.kieApiKey || env.KIE_API_KEY || ''
  };

  return new Response(JSON.stringify(merged), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

async function handleSaveSettings(request: Request, env: Env): Promise<Response> {
  const settings: any = await request.json();
  await env.CRM_KV.put('settings', JSON.stringify(settings));
  return new Response(JSON.stringify({ status: 'saved' }), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

async function handleGetLogs(env: Env): Promise<Response> {
  const logs = await env.CRM_KV.get('logs', { type: 'json' });
  return new Response(JSON.stringify(logs || []), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

// --- KIE API Integration ---

async function handleAIAnalyze(request: Request, env: Env): Promise<Response> {
  const body: any = await request.json();
  const threadId = body.threadId;

  const thread: any = await env.CRM_KV.get(`thread:${threadId}`, { type: 'json' });
  if (!thread) throw new Error("Thread not found");

  // Construct transcript
  const transcript = thread.messages.map((m: any) => 
    `${m.direction === 'INCOMING' ? 'User' : 'Agent'}: ${m.text}`
  ).join('\n');

  const settings: any = (await env.CRM_KV.get('settings', { type: 'json' })) || {};
  const apiKey = settings.kieApiKey || env.KIE_API_KEY;

  if (!apiKey) throw new Error("KIE API Key not configured");

  // Call KIE Gemini 3 Pro
  // Endpoint: https://api.kie.ai/gemini-3-pro/v1/chat/completions
  const kieUrl = "https://api.kie.ai/gemini-3-pro/v1/chat/completions";
  
  const systemPrompt = "You are a helpful CRM assistant. Analyze the conversation history. Summarize the user's intent, suggest the next best action, and recommend a tone for the reply.";

  const response = await fetch(kieUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      messages: [
        { 
          role: "developer", 
          content: [{ type: "text", text: systemPrompt }] 
        },
        { 
          role: "user", 
          content: [{ type: "text", text: `Here is the conversation transcript:\n\n${transcript}` }] 
        }
      ],
      stream: false
    })
  });

  const responseText = await response.text();
  await logEvent(env, 'OUTGOING_API', 'KIE_AI_ANALYSIS', kieUrl, 'POST', response.status, '...transcript...', responseText);

  if (!response.ok) {
    throw new Error(`AI API Error: ${response.status} ${responseText}`);
  }

  const data: any = JSON.parse(responseText);
  const analysis = data.choices?.[0]?.message?.content || "No analysis returned.";

  return new Response(JSON.stringify({ analysis }), { headers: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' } });
}

// --- Helpers ---

async function fetchInstagramProfile(env: Env, userId: string) {
  const settings: any = (await env.CRM_KV.get('settings', { type: 'json' })) || {};
  const token = settings.pageAccessToken || env.PAGE_ACCESS_TOKEN;
  
  if (!token) return { name: `User ${userId}` };

  try {
    const url = `https://graph.facebook.com/v24.0/${userId}?fields=name,profile_pic&access_token=${token}`;
    const res = await fetch(url);
    const data: any = await res.json();
    await logEvent(env, 'OUTGOING_API', 'INSTAGRAM_PROFILE', url, 'GET', res.status, '', JSON.stringify(data));
    return data;
  } catch (e) {
    return { name: `User ${userId}` };
  }
}

async function sendGraphApiMessage(env: Env, recipientId: string, text: string) {
  const settings: any = (await env.CRM_KV.get('settings', { type: 'json' })) || {};
  const token = settings.pageAccessToken || env.PAGE_ACCESS_TOKEN;

  if (!token) throw new Error("Page Access Token missing");

  const url = `https://graph.facebook.com/v24.0/me/messages`;
  const body = {
    recipient: { id: recipientId },
    message: { text: text },
    access_token: token
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const respText = await res.text();
  await logEvent(env, 'OUTGOING_API', 'SEND_MESSAGE', url, 'POST', res.status, JSON.stringify(body), respText);

  if (!res.ok) {
    throw new Error(`Graph API Error: ${respText}`);
  }

  return JSON.parse(respText);
}

async function updateThreadList(env: Env, thread: any) {
  let list: any[] = (await env.CRM_KV.get('threads_index', { type: 'json' })) || [];
  // Remove existing entry for this user
  list = list.filter((t: any) => t.igUserId !== thread.igUserId);
  // Add updated summary to top
  list.unshift({
    threadId: thread.threadId,
    igUserId: thread.igUserId,
    igUserName: thread.igUserName,
    igProfileImageUrl: thread.igProfileImageUrl,
    lastMessagePreview: thread.lastMessagePreview,
    lastMessageAt: thread.lastMessageAt
  });
  await env.CRM_KV.put('threads_index', JSON.stringify(list));
}

async function logEvent(env: Env, direction: string, type: string, url: string, method: string, status: number, reqBody: string, resBody: string) {
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    direction,
    type,
    url,
    method,
    status,
    requestBody: reqBody,
    responseBody: resBody
  };

  // Keep last 50 logs
  let logs: any[] = (await env.CRM_KV.get('logs', { type: 'json' })) || [];
  logs.unshift(entry);
  if (logs.length > 50) logs = logs.slice(0, 50);
  
  await env.CRM_KV.put('logs', JSON.stringify(logs));
  console.log(JSON.stringify(entry));
}