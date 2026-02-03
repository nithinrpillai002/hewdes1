import { Thread, Message, LogEntry, Settings, AIAnalysisResponse } from '../types';
import { MOCK_THREADS, MOCK_LOGS } from './mockData';
import { MOCK_DELAY_MS, DEFAULT_SETTINGS } from '../constants';

const USE_MOCK = false; // Set to false to try real backend
const API_BASE = '/api';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const api = {
  fetchThreads: async (): Promise<Thread[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY_MS);
      return [...MOCK_THREADS];
    }
    const res = await fetch(`${API_BASE}/threads`);
    if (!res.ok) throw new Error('Failed to fetch threads');
    return res.json();
  },

  fetchThreadDetails: async (threadId: string): Promise<Thread> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY_MS / 2);
      const t = MOCK_THREADS.find((t) => t.threadId === threadId);
      if (!t) throw new Error('Thread not found');
      return t;
    }
    const res = await fetch(`${API_BASE}/threads/${threadId}`);
    if (!res.ok) throw new Error('Failed to fetch thread details');
    return res.json();
  },

  sendMessage: async (threadId: string, text: string): Promise<Message> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY_MS);
      return {
        messageId: `m_${Date.now()}`,
        direction: 'OUTGOING',
        text,
        createdAt: new Date().toISOString(),
      };
    }
    const res = await fetch(`${API_BASE}/threads/${threadId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  fetchLogs: async (): Promise<LogEntry[]> => {
    if (USE_MOCK) {
      await delay(MOCK_DELAY_MS);
      return [...MOCK_LOGS];
    }
    const res = await fetch(`${API_BASE}/logs`);
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  fetchSettings: async (): Promise<Settings> => {
    if (USE_MOCK) {
      await delay(200);
      const stored = localStorage.getItem('mock_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    }
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) {
        // If settings endpoint fails (e.g. first run), return defaults locally so UI works
        console.warn("Failed to fetch settings, using defaults");
        return DEFAULT_SETTINGS;
    }
    return res.json();
  },

  saveSettings: async (settings: Settings): Promise<void> => {
    if (USE_MOCK) {
      await delay(500);
      localStorage.setItem('mock_settings', JSON.stringify(settings));
      return;
    }
    await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },

  analyzeThread: async (threadId: string, includeLogs: boolean): Promise<AIAnalysisResponse> => {
    if (USE_MOCK) {
      await delay(1500);
      return {
        analysis: `**Analysis for Thread ${threadId}**\n\nBased on the conversation, the user seems interested... (MOCK)`,
      };
    }
    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId, includeLogs }),
    });
    if (!res.ok) throw new Error('Failed to analyze thread');
    return res.json();
  },
};
