export interface Message {
  id: string;
  text: string;
  timestamp: number;
  type: 'sent' | 'received';
}

export interface Conversation {
  id: string;
  name: string;
  username: string;
  profilePic: string;
  messages: Message[];
  lastMessage?: string;
}

export interface CrmConfig {
  appId: string;
  bearerToken: string;
  webhookToken: string;
}

export type LogType = 'incoming' | 'outgoing' | 'info' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: LogType;
  data?: any;
}

export interface WebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message: {
        mid: string;
        text: string;
      };
    }>;
  }>;
}

export interface UserProfile {
  id: string;
  name?: string;
  username?: string;
  profile_pic?: string;
  error?: {
    message: string;
  };
}