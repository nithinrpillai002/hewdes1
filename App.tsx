import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { SettingsPanel } from './components/SettingsPanel';
import { LogPanel } from './components/LogPanel';
import { AIPanel } from './components/AIPanel';
import { Thread, ViewState } from './types';
import { api } from './services/api';
import { Settings, MessageSquare, Activity } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('chat');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isServerLive, setIsServerLive] = useState(false);

  // Poll for thread updates
  useEffect(() => {
    loadThreads();
    const interval = setInterval(loadThreads, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  const loadThreads = async () => {
    try {
      if (threads.length === 0) setIsLoadingThreads(true);
      const data = await api.fetchThreads();
      // Only update if changed deep comparison in real app, simplistic here
      setThreads(data);
      setIsServerLive(true);
    } catch (e) {
      console.error("Failed to load threads", e);
      setIsServerLive(false);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const selectedThread = threads.find((t) => t.threadId === selectedThreadId) || null;

  const handleSendMessage = async (text: string) => {
    if (!selectedThreadId) return;
    try {
      const newMsg = await api.sendMessage(selectedThreadId, text);
      // Optimistic update
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === selectedThreadId
            ? {
                ...t,
                messages: [...t.messages, newMsg],
                lastMessagePreview: newMsg.text,
                lastMessageAt: newMsg.createdAt,
              }
            : t
        )
      );
    } catch (e) {
      console.error("Failed to send", e);
      alert("Failed to send message");
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Navigation Sidebar (Narrow) */}
      <nav className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-6 z-20 flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
            <MessageSquare className="w-6 h-6 text-white" />
        </div>
        
        <button
          onClick={() => setView('chat')}
          className={`p-3 rounded-xl transition-all ${view === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Chats"
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        <button
          onClick={() => setView('logs')}
          className={`p-3 rounded-xl transition-all ${view === 'logs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Server Logs"
        >
          <Activity className="w-6 h-6" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setView('settings')}
          className={`p-3 rounded-xl transition-all ${view === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'chat' && (
          <>
            <Sidebar
              threads={threads}
              selectedThreadId={selectedThreadId}
              onSelectThread={setSelectedThreadId}
              isLoading={isLoadingThreads}
              isServerLive={isServerLive}
            />
            <ChatView
              thread={selectedThread}
              onSendMessage={handleSendMessage}
              onAnalyze={() => setShowAI(true)}
            />
          </>
        )}

        {view === 'settings' && <SettingsPanel />}
        
        {view === 'logs' && <LogPanel />}
      </div>

      {/* AI Modal */}
      {showAI && selectedThreadId && (
        <AIPanel threadId={selectedThreadId} onClose={() => setShowAI(false)} />
      )}
    </div>
  );
};

export default App;
