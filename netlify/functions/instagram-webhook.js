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

  // GET - Webhook Verification
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters;
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    // Get verify token from environment variable
    const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified');
      return {
        statusCode: 200,
        headers,
        body: challenge
      };
    } else {
      return {
        statusCode: 403,
        headers,
        body: 'Forbidden'
      };
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