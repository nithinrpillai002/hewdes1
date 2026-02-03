const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, accessToken, userId, message } = JSON.parse(event.body);

    if (action === 'getUserProfile') {
      // Fetch user profile from Instagram Graph API v24.0
      const url = `https://graph.facebook.com/v24.0/${userId}?fields=id,name,username,profile_pic&access_token=${accessToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (action === 'sendMessage') {
      // Send message via Instagram Graph API v24.0
      const url = `https://graph.facebook.com/v24.0/me/messages?access_token=${accessToken}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: userId },
          message: { text: message }
        })
      });
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};