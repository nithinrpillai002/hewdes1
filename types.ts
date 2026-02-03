export interface Message {
  messageId: string;
  direction: 'INCOMING' | 'OUTGOING';
  text: string;
  createdAt: string;
}

export interface Thread {
  threadId: string;
  igUserId: string;
  igUserName: string;
  igProfileImageUrl: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  messages: Message[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  direction: 'INCOMING_WEBHOOK' | 'OUTGOING_API';
  type: string;
  url: string;
  method: string;
  status: number;
  requestBody: string;
  responseBody: string;
}

export interface Settings {
  appId: string;
  webhookUrl: string;
  webhookVerifyToken: string;
  pageAccessToken: string;
  kieApiKey: string;
}

export interface AIAnalysisResponse {
  analysis: string;
}

// App State context
export type ViewState = 'chat' | 'settings' | 'logs';
