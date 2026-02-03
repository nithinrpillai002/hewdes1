import { Product, AiRule, Message } from "../types";

export const generateAIResponse = async (
  history: Message[],
  currentMessage: string,
  products: Product[],
  rules: AiRule[],
  platform: 'WhatsApp' | 'Instagram'
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
        platform
      }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      actionTaken: data.actionTaken
    };

  } catch (e) {
    console.error("AI Service Error:", e);
    return { text: "I'm having trouble connecting to the server right now. Please try again later.", actionTaken: "Network Error" };
  }
};