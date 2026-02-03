/**
 * Cloudflare Pages Function for Instagram API Proxy
 * Proxies requests to Graph API to avoid CORS issues and hide logic if needed
 */

export async function onRequest(context) {
  const { request } = context;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await request.json();
    const { action, accessToken, userId, message } = body;

    if (action === 'getUserProfile') {
      const fbUrl = `https://graph.facebook.com/v24.0/${userId}?fields=id,name,username,profile_pic&access_token=${accessToken}`;
      
      // Cloudflare Workers has native fetch
      const response = await fetch(fbUrl);
      const data = await response.json();
      
      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    if (action === 'sendMessage') {
      const fbUrl = `https://graph.facebook.com/v24.0/me/messages?access_token=${accessToken}`;
      
      const response = await fetch(fbUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: userId },
          message: { text: message }
        })
      });
      
      const data = await response.json();
      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}