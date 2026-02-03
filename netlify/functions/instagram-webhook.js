exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET - Webhook Verification & Health Check
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    
    // Health Check / Ping
    if (params.mode === 'ping') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'active', message: 'Server is live' })
      };
    }

    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    // Get verify token from environment variable
    // Default matches the frontend default 'instagram_crm_verify_token' for easy setup
    const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'instagram_crm_verify_token';

    if (mode === 'subscribe') {
      if (token === VERIFY_TOKEN) {
        console.log(`Webhook verified successfully. Token: ${token}`);
        return {
          statusCode: 200,
          headers,
          body: challenge
        };
      } else {
        console.error(`Webhook verification failed. Received: "${token}", Expected: "${VERIFY_TOKEN}"`);
        console.error(`Tip: Set WEBHOOK_VERIFY_TOKEN in Netlify Environment Variables to match your Facebook configuration, or use "${VERIFY_TOKEN}" in Facebook.`);
        return {
          statusCode: 403,
          headers,
          body: 'Forbidden'
        };
      }
    }
  }

  // POST - Receive Messages
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // Process webhook (in production, you'd forward this to your frontend via websocket/polling)
      // For now, we'll log it
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'received' })
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: 'Method not allowed'
  };
};