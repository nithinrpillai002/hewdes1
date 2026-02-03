import { GoogleGenAI, FunctionDeclaration, Type, Tool, Content } from "@google/genai";
import { Product, AiRule, Message } from "../types";

// --- Mock Delivery API (Indian Context) ---
const checkDeliveryAPI = async (pincode: string): Promise<string> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Basic validation for Indian Pincode (6 digits)
  const validPincode = /^[1-9][0-9]{5}$/.test(pincode);
  if (!validPincode) {
    return "That doesn't look like a valid pincode. Could you please double-check? It should be 6 digits.";
  }
  
  // Simulate delivery estimates based on region
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

// --- Tool Definitions using SDK Types ---
const checkDeliveryTool: FunctionDeclaration = {
  name: "checkDelivery",
  description: "Checks delivery availability and estimated delivery date for a given Indian pincode.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      pincode: {
        type: Type.STRING,
        description: "The 6-digit pincode of the customer's location in India."
      }
    },
    required: ["pincode"]
  }
};

const escalateTool: FunctionDeclaration = {
  name: "escalateToHuman",
  description: "Escalates the conversation to a human agent via email notification if the AI cannot answer or the query is complex.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: "The reason why the AI cannot answer the query."
      },
      summary: {
        type: Type.STRING,
        description: "A brief summary of what the customer is asking."
      }
    },
    required: ["reason", "summary"]
  }
};

export const generateGeminiResponse = async (
  apiKey: string,
  history: Message[],
  currentMessage: string,
  products: Product[],
  rules: AiRule[],
  platform: 'WhatsApp' | 'Instagram'
): Promise<{ text: string; actionTaken?: string }> => {
  
  if (!apiKey) {
    return { text: "System Error: API Key is missing. Please configure it in the CRM settings.", actionTaken: "Missing Config" };
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  // 1. Build Memory (Context)
  const activeRules = rules.filter(r => r.isActive).map(r => `- ${r.content}`).join('\n');
  const productCatalog = products.map(p => 
    `ITEM: ${p.name} (ID: ${p.id})
     PRICE: ₹${p.price}
     DETAILS: ${p.description}
     DISPATCH TIME: ${p.leadTime}
     CATEGORY: ${p.category}
     IN STOCK: ${p.inStock ? 'Yes' : 'No'}`
  ).join('\n---\n');

  // 2. Define System Instructions
  const systemInstruction = `
    You are NOT a bot. You are a helpful, warm, and human team member of "Hewdes Gifts".
    You are chatting with a customer on ${platform}.
    
    YOUR GOAL: Help the customer buy the right gift.
    
    CRITICAL INSTRUCTIONS:
    - Talk naturally. Use short sentences, casual language, and emojis where appropriate (🎁, ✨).
    - NEVER say "As an AI" or "I am a language model". Pretend to be human.
    - STRICTLY PRODUCT FOCUSED: If the user talks about politics, religion, or irrelevant topics, politely steer back to gifts.
    
    YOUR PRODUCT MEMORY (Inventory):
    ${productCatalog}
    
    YOUR BEHAVIORAL RULES:
    ${activeRules}
    
    CONVERSATION FLOWS:
    1. **Shipping**: If asked about delivery, YOU MUST ASK for the pincode. Then call 'checkDelivery'.
    2. **Stock**: Check the 'IN STOCK' status in your memory.
    3. **Unknowns**: If unsure, call 'escalateToHuman'.
    
    TONE: Indian English nuances (e.g., "No worries", "Sure thing"), empathetic, professional.
  `;

  // 3. Construct History for SDK
  // We strictly convert our internal Message format to the SDK Content format
  const contents: Content[] = history.slice(-10).map(msg => {
    let role = 'user';
    if (msg.role === 'model' || msg.role === 'assistant') role = 'model';
    // System messages are handled via systemInstruction, so we skip or map to user if critical, 
    // but usually history is just user/model turns.
    return {
      role: role,
      parts: [{ text: msg.content }]
    };
  });

  // Add the current message
  contents.push({
    role: 'user',
    parts: [{ text: currentMessage }]
  });

  try {
    // 4. Initial API Call
    const tools: Tool[] = [{ functionDeclarations: [checkDeliveryTool, escalateTool] }];
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        temperature: 0.7,
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return { text: "I'm having a bit of trouble connecting. One moment!", actionTaken: "Error" };
    }

    const modelPart = candidates[0].content.parts[0];
    
    // 5. Handle Function Calls
    // The SDK provides functionCalls in the response part
    if (response.functionCalls && response.functionCalls.length > 0) {
       const functionCall = response.functionCalls[0];
       const { name, args } = functionCall;
       const functionId = functionCall.id; // Usually needed for history alignment, but generateContent handles single turn mostly.

       let actionTaken = "";
       let functionResult = "";

       if (name === "checkDelivery") {
         const pincode = args['pincode'] as string;
         actionTaken = `Checking API for Pincode: ${pincode}`;
         functionResult = await checkDeliveryAPI(pincode);
       } else if (name === "escalateToHuman") {
         actionTaken = `Notifying Human: ${args['reason']}`;
         functionResult = `[System: Email sent to support@hewdesgifts.com with summary: ${args['summary']}. Inform the user.]`;
       }

       // 6. Send Function Response back to Gemini
       // We must simulate the turn: User -> Model (FunctionCall) -> User (FunctionResponse) -> Model (Final Answer)
       
       // Construct the request with the tool response
       const response2 = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
            ...contents,
            {
                role: 'model',
                parts: [modelPart] // The part containing the function call
            },
            {
                role: 'tool',
                parts: [{
                    functionResponse: {
                        name: name,
                        response: { result: functionResult },
                        id: functionId
                    }
                }]
            }
        ],
        config: {
            systemInstruction: systemInstruction,
            tools: tools
        }
       });

       const finalText = response2.candidates?.[0]?.content?.parts?.[0]?.text || "I've processed that request.";
       return { text: finalText, actionTaken };
    }

    return { text: modelPart.text || "I didn't catch that.", actionTaken: undefined };

  } catch (e) {
    console.error("Gemini SDK Error:", e);
    return { text: "My brain is a bit foggy (Network Error). Can you repeat that?", actionTaken: "Network Error" };
  }
};
