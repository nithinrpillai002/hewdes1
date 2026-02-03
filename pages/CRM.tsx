
import React, { useState, useRef, useEffect } from 'react';
import { Product, AiRule, Message, Conversation } from '../types';
import { 
  Instagram, Bot, Send, Search, Settings as SettingsIcon, 
  Trash, MapPin, Zap, ZapOff, Paperclip, Phone, MessageCircle, Inbox, RefreshCw
} from 'lucide-react';

interface CRMProps {
  products: Product[];
  rules: AiRule[];
  setRules: React.Dispatch<React.SetStateAction<AiRule[]>>;
}

const CRM: React.FC<CRMProps> = ({ products }) => {
  // --- STATE ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevConversationsLength = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Derived State
  const activeChat = conversations.find(c => c.id === selectedChatId);

  // --- POLLING & SCROLLING ---
  const fetchConversations = async () => {
      setIsRefreshing(true);
      try {
          const res = await fetch('/api/conversations');
          if (res.ok) {
              const data = await res.json();
              setConversations(data);
              
              if (data.length > prevConversationsLength.current) {
                  const newestChat = data[0];
                  if (newestChat && prevConversationsLength.current > 0) {
                      setSelectedChatId(newestChat.id);
                  }
              }
              prevConversationsLength.current = data.length;
          }
      } catch (e) {
          console.error("Polling error:", e);
      } finally {
          setIsRefreshing(false);
      }
  };

  useEffect(() => {
      fetchConversations(); 
      const interval = setInterval(fetchConversations, 3000); 
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, activeChat?.id]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const currentChatId = activeChat.id;
    const userMessageContent = inputText;
    setInputText('');

    // Optimistic Update
    const optimisticMsg: Message = {
        id: Date.now().toString(),
        role: 'user', 
        content: userMessageContent,
        timestamp: Date.now(),
        isHumanOverride: true,
        type: 'text'
    };
    
    setConversations(prev => prev.map(c => {
        if (c.id === currentChatId) {
            return {
                ...c,
                messages: [...c.messages, optimisticMsg],
                isAiPaused: true 
            };
        }
        return c;
    }));

    // Send to Backend
    try {
        await fetch(`/api/conversations/${currentChatId}/message`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                text: userMessageContent,
                role: 'user' 
            })
        });
    } catch (e) {
        console.error("Failed to send message", e);
    }
  };

  const toggleAiStatus = async () => {
    if (activeChat) {
        const newState = !activeChat.isAiPaused;
        setConversations(prev => prev.map(c => c.id === activeChat.id ? {...c, isAiPaused: newState} : c));
        if (newState === true) {
             await fetch(`/api/conversations/${activeChat.id}/pause`, { method: 'POST' });
        }
    }
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selectedChatId === id) setSelectedChatId(null);
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      
      {/* --- COLUMN 1: CONVERSATION LIST (SIDE TABLE A) --- */}
      <div className="w-80 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800 z-10">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Instagram DMs</h2>
             <button 
                onClick={fetchConversations}
                className={`p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`}
                title="Force Refresh List"
             >
                <RefreshCw size={16} />
             </button>
          </div>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search customers..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                  <Inbox size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-slate-800 dark:text-white font-semibold mb-1">No Messages</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Waiting for incoming webhooks...
                  </p>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs rounded border border-amber-200 dark:border-amber-800">
                      <strong>Tip:</strong> If 'curl' works but this list is empty, Cloudflare is recycling the server memory. A database is required for persistent production use.
                  </div>
              </div>
          ) : (
              conversations.map(chat => (
                <div 
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`group flex items-start p-4 cursor-pointer border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${selectedChatId === chat.id ? 'bg-indigo-50/60 dark:bg-slate-700/60 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
                >
                    <div className="relative mr-3">
                        <img src={chat.avatarUrl} alt={chat.customerName} className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-slate-600" />
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5">
                            <Instagram size={14} className="text-pink-600" />
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                            <h4 className={`text-sm font-semibold truncate ${selectedChatId === chat.id ? 'text-indigo-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>{chat.customerName}</h4>
                            <div className="flex items-center space-x-1">
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                    {new Date(chat.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <button 
                                    onClick={(e) => handleDeleteConversation(chat.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-400 transition-opacity"
                                >
                                    <Trash size={12} />
                                </button>
                            </div>
                        </div>
                        <p className={`text-xs truncate mb-2 ${selectedChatId === chat.id ? 'text-indigo-700/80 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                            {chat.messages[chat.messages.length - 1]?.role === 'user' && !chat.messages[chat.messages.length - 1]?.isHumanOverride ? '' : 'You: '}{chat.lastMessage}
                        </p>
                    </div>
                    {chat.unreadCount > 0 && (
                        <div className="ml-2 w-5 h-5 bg-pink-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                            {chat.unreadCount}
                        </div>
                    )}
                </div>
              ))
          )}
        </div>
      </div>

      {/* --- COLUMN 2: ACTIVE CHAT AREA (SIDE TABLE B) --- */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 relative">
        {activeChat ? (
            <>
                <div className="h-16 px-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center">
                        <div className="mr-3">
                             <img src={activeChat.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{activeChat.customerName}</h3>
                            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                <Instagram size={12} className="mr-1" />
                                <span>Instagram User</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border transition-all ${activeChat.isAiPaused ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                            <div className={`w-2 h-2 rounded-full ${activeChat.isAiPaused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`}></div>
                            <span className={`text-xs font-bold uppercase tracking-wider ${activeChat.isAiPaused ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                                {activeChat.isAiPaused ? 'AI Paused' : 'AI Active'}
                            </span>
                            <button onClick={toggleAiStatus} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                {activeChat.isAiPaused ? <ZapOff size={14} /> : <Zap size={14} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100 dark:bg-slate-950/50">
                    {activeChat.messages.map((msg) => {
                        const isUser = msg.role === 'user' && !msg.isHumanOverride; 
                        const isAi = msg.role === 'model';
                        const isHumanAgent = msg.isHumanOverride; 

                        return (
                            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-start' : 'justify-end'}`}>
                                <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
                                    
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-sm ${isUser ? 'mr-2' : 'ml-2'} ${isAi ? 'bg-pink-600 text-white' : (isHumanAgent ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-white dark:bg-slate-700')}`}>
                                        {isAi ? <Bot size={16} /> : (isHumanAgent ? <Instagram size={14} /> : <span className="text-xs font-bold">{activeChat.customerName[0]}</span>)}
                                    </div>
                                    
                                    <div className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
                                        <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm relative group ${
                                            isUser 
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none' 
                                                : (isAi 
                                                    ? 'bg-pink-600 text-white rounded-tr-none' 
                                                    : 'bg-pink-500/90 text-white rounded-tr-none') 
                                        }`}>
                                            <span>{msg.content}</span>
                                            {isHumanAgent && <span className="absolute -top-2 -left-2 text-[8px] bg-slate-800 text-white px-1 py-0.5 rounded shadow">Agent</span>}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <button type="button" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <Paperclip size={20} />
                        </button>
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="Type a message..." 
                                className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-900/50 border-none rounded-xl text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-pink-500/50"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={!inputText.trim()}
                            className="p-3 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-all hover:scale-105"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Instagram size={64} className="mb-4 opacity-20" />
                <p>Select a conversation to start messaging</p>
            </div>
        )}
      </div>

      {/* --- COLUMN 3: CUSTOMER DETAILS (SIDE TABLE C) --- */}
      {activeChat && (
        <div className="w-72 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col overflow-y-auto">
            <div className="p-6 text-center border-b border-gray-100 dark:border-slate-700">
                <img src={activeChat.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-slate-50 dark:border-slate-700" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{activeChat.customerName}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center mt-1">
                    <MapPin size={12} className="mr-1" /> Instagram User
                </p>
                <div className="flex justify-center mt-4 space-x-2">
                    <button className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-pink-600 transition-colors">
                        <Instagram size={16} />
                    </button>
                </div>
            </div>

            <div className="p-6">
                <div className="mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Automation Control</h4>
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">AI Auto-Reply</span>
                            <button 
                                onClick={toggleAiStatus}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!activeChat.isAiPaused ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${!activeChat.isAiPaused ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            {activeChat.isAiPaused 
                             ? "AI is disabled. Reply manually." 
                             : "AI is active for this chat."}
                        </p>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">CRM ID</h4>
                     <p className="text-xs font-mono text-slate-500 break-all bg-gray-50 dark:bg-slate-900 p-2 rounded">
                        {activeChat.igsid || 'N/A'}
                     </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CRM;
