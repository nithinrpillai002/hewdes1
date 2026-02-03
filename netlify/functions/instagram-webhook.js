// Simple in-memory store for recent webhooks (note: this is ephemeral in serverless)
// This allows the frontend to poll and see what the server received for debugging/demo purposes
let webhookHistory = [];

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET - Verification, Health Check, and Event Polling
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    
    // 1. Event Polling (Frontend asks: "Did you get anything?")
    if (params.mode === 'events') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          count: webhookHistory.length,
          events: webhookHistory
        })
      };
    }

    // 2. Health Check / Ping
    if (params.mode === 'ping') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'active', message: 'Server is live' })
      };
    }

    // 3. Facebook Webhook Verification
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];
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
        return {
          statusCode: 403,
          headers,
          body: 'Forbidden'
        };
      }
    }
    
    // Default response for bare GET
    return {
      statusCode: 200,
      headers,
      body: 'Instagram Webhook Endpoint. Configure this URL in Facebook Developer Portal.'
    };
  }

  // POST - Receive Messages
  if (event.httpMethod === 'POST') {
    try {
      // Log headers to debug content-type issues or missing signatures
      console.log('Incoming Webhook Headers:', JSON.stringify(event.headers));
      
      const body = JSON.parse(event.body);
      
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // Add to in-memory history for frontend polling
      const eventLog = {
        _id: Date.now().toString() + Math.random().toString().slice(2, 6),
        receivedAt: new Date().toISOString(),
        method: 'POST',
        headers: event.headers,
        payload: body
      };
      
      // Add to start of array
      webhookHistory.unshift(eventLog);
      
      // Keep only last 50 events
      if (webhookHistory.length > 50) {
        webhookHistory = webhookHistory.slice(0, 50);
      }
      
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
        body: JSON.stringify({ error: 'Internal server error', details: error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: 'Method not allowed'
  };
};