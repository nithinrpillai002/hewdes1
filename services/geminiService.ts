import { Product, AiRule, Message } from "../types";

export const generateAIResponse = async (
  history: Message[],
  currentMessage: string,
  products: Product[],
  rules: AiRule[],
  platform: 'WhatsApp' | 'Instagram',
  apiKey: string
): Promise<{ text: string; actionTaken?: string }> => {
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history,
        currentMessage,
        products,
        rules,
        platform,
        apiKey // Pass the Key
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Backend Error Response:", errorData);
        throw new Error(errorData.text || `Server responded with ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      actionTaken: data.actionTaken
    };

  } catch (e: any) {
    console.error("AI Service Error:", e);
    return { text: `System Error: ${e.message}`, actionTaken: "Error" };
  }
};