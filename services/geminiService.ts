import { GoogleGenAI, FunctionDeclaration, Type, Content, Part } from "@google/genai";
import { Product, AiRule, Message } from "../types";

// Initialize the Gemini Client
// The API key must be available in process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Mock Delivery API (Indian Context) ---
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

// --- Tools Definition (Typed) ---
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

const escalateToHumanTool: FunctionDeclaration = {
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
  history: Message[],
  currentMessage: string,
  products: Product[],
  rules: AiRule[],
  platform: 'WhatsApp' | 'Instagram'
): Promise<{ text: string; actionTaken?: string }> => {
  
  if (!process.env.API_KEY) {
    // In a real app this might be handled by build-time env injection
    console.warn("API Key not found in process.env.API_KEY");
  }

  // 1. Build Memory (Context) & System Instruction
  const activeRules = rules.filter(r => r.isActive).map(r => `- ${r.content}`).join('\n');
  const productCatalog = products.map(p => 
    `ITEM: ${p.name} (ID: ${p.id})
     PRICE: ₹${p.price}
     DETAILS: ${p.description}
     DISPATCH TIME: ${p.leadTime}
     CATEGORY: ${p.category}
     IMAGE: ${p.imageUrl}
     IN STOCK: ${p.inStock ? 'Yes' : 'No'}`
  ).join('\n---\n');

  const systemInstruction = `
    You are NOT a bot. You are a helpful, warm, and human team member of "Hewdes Gifts".
    You are chatting with a customer on ${platform}.
    
    YOUR GOAL: Help the customer buy the right gift.
    
    CRITICAL INSTRUCTIONS:
    - Talk naturally. Use short sentences, casual language, and emojis where appropriate (🎁, ✨).
    - NEVER say "As an AI" or "I am a language model". Pretend to be human.
    - STRICTLY PRODUCT FOCUSED: If the user talks about politics, religion, or services we don't offer, politely steer back to gifts.
    
    YOUR PRODUCT MEMORY:
    ${productCatalog}
    
    YOUR BEHAVIORAL RULES:
    ${activeRules}
    
    FLOWS:
    1. **Delivery**: Ask for pincode. Call 'checkDelivery'.
    2. **Dispatch**: Check 'DISPATCH TIME' in memory.
    3. **Unknown**: Call 'escalateToHuman'.
  `;

  // 2. Map History to Gemini Content
  // Filter out system/developer messages as they go into systemInstruction or are ignored
  const contents: Content[] = history
    .filter(msg => msg.role === 'user' || msg.role === 'model' || msg.role === 'assistant')
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : (msg.role as 'user' | 'model'),
      parts: [{ text: msg.content }]
    }));

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: currentMessage }]
  });

  try {
    // 3. Initial API Call
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", 
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ functionDeclarations: [checkDeliveryTool, escalateToHumanTool] }]
      }
    });

    // 4. Handle Tool Calls
    const functionCalls = response.functionCalls;
    let actionTaken = undefined;

    if (functionCalls && functionCalls.length > 0) {
       const functionResponses: any[] = [];
       
       for (const call of functionCalls) {
         const { name, args } = call;
         let result = "";

         if (name === "checkDelivery") {
            const pincode = args['pincode'] as string;
            actionTaken = `Checking Pincode: ${pincode}`;
            result = await checkDeliveryAPI(pincode);
         } else if (name === "escalateToHuman") {
            const reason = args['reason'] as string;
            const summary = args['summary'] as string;
            actionTaken = `Notifying Human: ${reason}`;
            console.log(`[EMAIL SIMULATION] Escalate: ${summary}`);
            result = `[System: Email sent. Notify user.]`;
         }

         functionResponses.push({
            id: call.id,
            name: call.name,
            response: { result: result }
         });
       }

       // 5. Send Tool Responses back
       const secondResponse = await ai.models.generateContent({
         model: "gemini-3-pro-preview",
         contents: [
            ...contents, 
            response.candidates?.[0]?.content as Content, // Add the model's tool call message
            { role: 'user', parts: functionResponses } // Send the function responses
         ],
         config: { systemInstruction }
       });
       
       return { text: secondResponse.text || "", actionTaken };
    }

    return { text: response.text || "I'm not sure how to reply to that.", actionTaken };

  } catch (e) {
    console.error("Gemini API Error:", e);
    return { text: "My brain is a bit fuzzy right now (Network Error). Can you say that again?", actionTaken: "Error" };
  }
};