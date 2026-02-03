import { Product, AiRule, Message } from "../types";

// --- Mock Delivery API (Indian Context) ---
// This acts as the external API call you mentioned.
const checkDeliveryAPI = async (pincode: string): Promise<string> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Basic validation for Indian Pincode (6 digits)
  const validPincode = /^[1-9][0-9]{5}$/.test(pincode);
  if (!validPincode) {
    return "That doesn't look like a valid pincode. Could you please double-check? It should be 6 digits.";
  }
  
  // Simulate delivery estimates based on region (first digit)
  const regionDigit = parseInt(pincode[0]);
  let days = 3;
  let regionName = "Metro City";
  
  if (regionDigit <= 3) { days = 2; regionName = "North/West India"; }
  else if (regionDigit <= 6) { days = 3; regionName = "South/Central India"; }
  else { days = 5; regionName = "East/North-East India"; }

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + days);
  
  const options = { weekday: 'long', month: 'short', day: 'numeric' } as const;
  const formattedDate = deliveryDate.toLocaleDateString('en-IN', options);
  
  return `I've checked that for you. Good news, we service ${regionName}! If you order now, it should reach you by ${formattedDate} (approx ${days} days).`;
};

// --- API Configurations ---
const KIE_BASE_URL = "https://api.kie.ai/gemini-3-pro/v1/chat/completions";

// --- Tools Definition (JSON Schema) ---
const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "checkDelivery",
      description: "Checks delivery availability and estimated delivery date for a given Indian pincode.",
      parameters: {
        type: "object",
        properties: {
          pincode: {
            type: "string",
            description: "The 6-digit pincode of the customer's location in India."
          }
        },
        required: ["pincode"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "escalateToHuman",
      description: "Escalates the conversation to a human agent via email notification if the AI cannot answer or the query is complex.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "The reason why the AI cannot answer the query."
          },
          summary: {
            type: "string",
            description: "A brief summary of what the customer is asking."
          }
        },
        required: ["reason", "summary"]
      }
    }
  }
];

export const generateGeminiResponse = async (
  apiKey: string,
  history: Message[],
  currentMessage: string,
  products: Product[],
  rules: AiRule[],
  platform: 'WhatsApp' | 'Instagram'
): Promise<{ text: string; actionTaken?: string }> => {
  
  if (!apiKey) {
    return { text: "System Error: Kie API Key is missing. Please configure it in the CRM settings.", actionTaken: "Missing Config" };
  }

  // 1. Build Memory (Context)
  // Combine custom rules and product catalog into the system instruction
  const activeRules = rules.filter(r => r.isActive).map(r => `- ${r.content}`).join('\n');
  const productCatalog = products.map(p => 
    `ITEM: ${p.name} (ID: ${p.id})
     PRICE: ₹${p.price}
     DETAILS: ${p.description}
     DISPATCH TIME (Time to pack & ship): ${p.leadTime}
     CATEGORY: ${p.category}
     IMAGE: ${p.imageUrl}
     IN STOCK: ${p.inStock ? 'Yes' : 'No'}`
  ).join('\n---\n');

  // 2. Define System Persona & Instructions
  const systemInstruction = `
    You are NOT a bot. You are a helpful, warm, and human team member of "Hewdes Gifts".
    You are chatting with a customer on ${platform}.
    
    YOUR GOAL: Help the customer buy the right gift.
    
    CRITICAL INSTRUCTIONS:
    - Talk naturally. Use short sentences, casual language, and emojis where appropriate (🎁, ✨).
    - NEVER say "As an AI" or "I am a language model". Pretend to be human.
    - STRICTLY PRODUCT FOCUSED: If the user talks about politics, religion, life advice, or services we don't offer, politely decline and steer the conversation back to our gifts (e.g., "I'd love to chat, but I'm just here to help you find the perfect gift!").
    
    YOUR PRODUCT MEMORY (Inventory):
    ${productCatalog}
    
    YOUR BEHAVIORAL RULES (Refined by Owner):
    ${activeRules}
    
    STRICT CONVERSATION FLOWS:
    
    1. **Shipping/Delivery Queries**:
       - IF user asks "When will I get it?", "Delivery time?", or "Is shipping available?":
         - YOU MUST ASK: "Could you please share your pincode? I'll check the exact date for you."
         - DO NOT guess a date. Wait for the pincode.
         - Once you get the pincode, call the function 'checkDelivery'.
    
    2. **Dispatch/Shipping Time Queries**:
       - IF user asks "When will you ship it?" or "How long to pack?":
         - Check the 'DISPATCH TIME' in your Product Memory.
         - Answer naturally, e.g., "We usually pack and dispatch this personalized item within ${products[0]?.leadTime || '2 days'}."
    
    3. **Unknown/Complex Queries**:
       - IF you don't know the answer or it's a complaint:
         - Call function 'escalateToHuman'.
         - Tell the user: "Let me just double-check that with my manager to be 100% sure. I've sent them a message and will reply here shortly!"

    4. **Tone Guide**:
       - Use Indian English nuances (e.g., "No worries", "Sure thing").
       - Be empathetic but professional.
  `;

  // 3. Construct Message History for API
  const apiMessages = [
    {
      role: "developer",
      content: [{ type: "text", text: systemInstruction }]
    }
  ];

  // Append recent chat history (limit to last 10 to keep focus tight)
  history.slice(-10).forEach(msg => {
    let role = "user";
    if (msg.role === "model" || msg.role === "assistant") role = "assistant";
    if (msg.role === "system") role = "developer";
    
    apiMessages.push({
      role: role,
      content: [{ type: "text", text: msg.content }]
    });
  });

  // Append current user message
  apiMessages.push({
    role: "user",
    content: [{ type: "text", text: currentMessage }]
  });

  try {
    // 4. Initial API Call
    const payload = {
      model: "gemini-3-pro", 
      messages: apiMessages,
      tools: toolsDefinition,
      stream: false
    };

    const response = await fetch(KIE_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Kie API Error:", err);
      return { text: "I'm having a bit of trouble checking our system right now. Give me a sec!", actionTaken: "API Error" };
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // 5. Handle Tool Calls
    if (choice.finish_reason === "tool_calls" || (message.tool_calls && message.tool_calls.length > 0)) {
       const toolCall = message.tool_calls[0];
       const functionName = toolCall.function.name;
       const functionArgs = JSON.parse(toolCall.function.arguments);
       
       let actionTaken = "";
       let toolResultContent = "";

       if (functionName === "checkDelivery") {
         actionTaken = `Checking API for Pincode: ${functionArgs.pincode}`;
         toolResultContent = await checkDeliveryAPI(functionArgs.pincode);
       } else if (functionName === "escalateToHuman") {
         actionTaken = `Notifying Human: ${functionArgs.reason}`;
         console.log(`[EMAIL SIMULATION] To: support@hewdesgifts.com | Subject: ESCALATION | Body: ${functionArgs.summary}`);
         toolResultContent = `[System: Email sent. Tell the user you have notified the team and will respond via email/message later.]`;
       }

       // 6. Send Tool Result back to AI
       apiMessages.push(message); 
       apiMessages.push({
         role: "tool",
         tool_call_id: toolCall.id,
         content: toolResultContent 
       } as any);

       const secondResponse = await fetch(KIE_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gemini-3-pro",
          messages: apiMessages,
          tools: toolsDefinition,
          stream: false
        })
      });

      if (!secondResponse.ok) return { text: "Oops, something went wrong while checking that.", actionTaken: "Error" };
      
      const secondData = await secondResponse.json();
      return { 
        text: secondData.choices[0].message.content, 
        actionTaken 
      };
    }

    return { text: message.content || "Could you repeat that?", actionTaken: undefined };

  } catch (e) {
    console.error("Network/Service Error:", e);
    return { text: "My internet seems a bit spotty. Can you say that again?", actionTaken: "Network Error" };
  }
};