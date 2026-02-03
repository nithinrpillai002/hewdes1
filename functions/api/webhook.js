/**
 * Cloudflare Pages Function for Instagram Webhook
 * Handles both GET (verification/ping) and POST (data reception)
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Common Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS (CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // Handle GET (Verification & Ping)
  if (request.method === 'GET') {
    // Health Check / Ping
    if (url.searchParams.get('mode') === 'ping') {
      return new Response(
        JSON.stringify({ status: 'active', message: 'Cloudflare Function Live' }), 
        { status: 200, headers }
      );
    }

    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    // Check environment variable, fallback to default
    const VERIFY_TOKEN = env.WEBHOOK_VERIFY_TOKEN || 'instagram_crm_verify_token';

    if (mode === 'subscribe') {
      if (token === VERIFY_TOKEN) {
        // Return plain text challenge as required by Facebook
        return new Response(challenge, { 
          status: 200, 
          headers: { 'Access-Control-Allow-Origin': '*' } 
        });
      } else {
        return new Response('Forbidden: Invalid Verify Token', { status: 403, headers });
      }
    }
    
    return new Response('Invalid Request', { status: 400, headers });
  }

  // Handle POST (Incoming Messages)
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      
      // In a real app, you would process this data or push to a Durable Object / KV
      // For this demo, we just acknowledge receipt
      
      return new Response(JSON.stringify({ status: 'received' }), { status: 200, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers });
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers });
}