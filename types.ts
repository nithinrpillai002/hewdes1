

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number; // Internal cost for profit calculation
  description: string;
  leadTime: string; // e.g., "2-3 business days"
  imageUrl: string;
  category: string;
  inStock: boolean;
}

export interface AiRule {
  id: string;
  type: 'instruction' | 'restriction' | 'personality';
  content: string;
  isActive: boolean;
  platform: 'whatsapp' | 'instagram';
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'template';
  payload: {
    url?: string;
    template_type?: string;
    elements?: any[]; // For generic templates (product cards)
  };
}

export interface QuickReply {
  content_type: 'text';
  title: string;
  payload: string;
}

export interface MessageReaction {
  reaction: string; // e.g., 'love'
  emoji: string;
  action: 'react' | 'unreact';
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'developer' | 'assistant' | 'tool'; 
  content?: string; // Optional if it's purely an attachment
  timestamp: number;
  isHumanOverride?: boolean;
  type: 'text' | 'image' | 'template' | 'reaction' | 'quick_reply';
  attachments?: MessageAttachment[];
  quick_replies?: QuickReply[];
  reaction?: MessageReaction;
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface Conversation {
  id: string;
  igsid?: string; // Instagram Scoped User ID
  customerName: string;
  platform: 'whatsapp' | 'instagram';
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  tags: Tag[];
  isAiPaused: boolean;
  messages: Message[];
  avatarUrl?: string;
  status?: 'active' | 'resolved' | 'escalated';
}

export interface PlatformConfig {
  connected: boolean;
  appId?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  outcome: string;
  source: 'instagram' | 'whatsapp' | 'system';
  payload?: any;
}

export interface PlatformCredentials {
    appId: string;
    token: string;
    graphVersion?: string; // e.g., "v21.0"
}

export enum Page {
  ANALYTICS = 'analytics',
  CRM = 'crm',
  PRODUCTS = 'products',
  SETTINGS = 'settings',
  DEVELOPER = 'developer',
}