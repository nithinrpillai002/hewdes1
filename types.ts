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
  platform: 'whatsapp' | 'instagram'; // Added platform specificity
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system' | 'developer' | 'assistant'; 
  content: string;
  timestamp: number;
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

export enum Page {
  ANALYTICS = 'analytics',
  CRM = 'crm',
  PRODUCTS = 'products',
  SETTINGS = 'settings', // New Settings page
}