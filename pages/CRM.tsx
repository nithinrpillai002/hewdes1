

import React, { useState, useRef, useEffect } from 'react';
import { Product, AiRule, Message, Conversation, Tag } from '../types';
import { 
  Instagram, MessageCircle, Bot, Save, Plus, Trash, Send, Loader2, 
  Search, MoreVertical, Phone, MapPin, Tag as TagIcon, Zap, ZapOff,
  Settings as SettingsIcon, X, CheckCircle2, Lock, AlertTriangle, 
  Paperclip, Smile, Filter, Copy, Globe, Server, Inbox, UserPlus, ShoppingBag, ArrowRight
} from 'lucide-react';

interface CRMProps {
  products: Product[];
  rules: AiRule[];
  setRules: React.Dispatch<React.SetStateAction<AiRule[]>>;
}

const CRM: React.FC<CRMProps> = ({ products, rules, setRules }) => {
  // --- STATE ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'instagram' | 'whatsapp'>('all');
  const [inputText, setInputText] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevConversationsLength = useRef(0);

  // Settings State
  const [activeSettingsTab, setActiveSettingsTab] = useState<'instagram' | 'whatsapp'>('instagram');
  const [newRule, setNewRule] = useState('');

  // Derived State
  const activeChat = conversations.find(c => c.id === selectedChatId);
  const filteredConversations = conversations.filter(c => filter === 'all' || c.platform === filter);

  // --- POLLING & SCROLLING ---
  
  // Poll Server for real conversation state
  useEffect(() => {
      const fetchConversations = async () => {
          try {
              const res = await fetch('/api/conversations');
              if (res.ok) {
                  const data = await res.json();
                  setConversations(data);
                  
                  // Auto-select new chat logic
                  if (data.length > prevConversationsLength.current) {
                      // Assuming new chats are unshifted to the top (server behavior)
                      const newestChat = data[0];
                      if (newestChat && prevConversationsLength.current > 0) {
                          setSelectedChatId(newestChat.id);
                      }
                  }
                  prevConversationsLength.current = data.length;
              }
          } catch (e) {
              console.error("Polling error:", e);
          }
      };

      fetchConversations(); // Initial load
      const interval = setInterval(fetchConversations, 2000); // Poll every 2s for faster updates
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, activeChat?.id]);

  // --- HANDLERS ---
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

  // --- MESSAGE RENDERERS ---

  const renderMessageContent = (msg: Message) => {
      // 1. Generic Template (Carousel) - PDF 5.4
      if (msg.type === 'template' && msg.attachments?.[0]?.payload?.template_type === 'generic') {
          const elements = msg.attachments[0].payload.elements || [];
          return (
              <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide max-w-[300px] md:max-w-md">
                  {elements.map((el: any, idx: number) => (
                      <div key={idx} className="flex-shrink-0 w-48 bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 shadow-sm">
                          {el.image_url && (
                              <img src={el.image_url} alt={el.title} className="w-full h-32 object-cover" />
                          )}
                          <div className="p-3">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-white truncate">{el.title}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 truncate">{el.subtitle}</p>
                              <div className="space-y-1">
                                  {el.buttons?.map((btn: any, bIdx: number) => (
                                      <button key={bIdx} className="w-full py-1 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                          {btn.title}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          );
      }

      // 2. Image Attachment - PDF 4.2
      if (msg.type === 'image' && msg.attachments?.[0]?.payload?.url) {
          return (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600">
                  <img src={msg.attachments[0].payload.url} alt="Attachment" className="max-w-[200px] rounded-lg" />
              </div>
          );
      }

      // 3. Reaction - PDF 4.4
      if (msg.type === 'reaction') {
          return <span className="italic text-slate-500">{msg.content}</span>;
      }

      // 4. Quick Replies - PDF 5.2 (Mixed with Text)
      if (msg.type === 'quick_reply' || (msg.quick_replies && msg.quick_replies.length > 0)) {
          return (
              <div>
                  <div className="mb-2">{msg.content}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                      {msg.quick_replies?.map((qr, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white/20 dark:bg-black/20 border border-white/30 rounded-full text-xs font-medium cursor-default">
                              {qr.title}
                          </span>
                      ))}
                  </div>
              </div>
          );
      }

      // 5. Standard Text - PDF 4.1
      return <span>{msg.content}</span>;
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* --- COLUMN 1: CONVERSATION LIST --- */}
      <div className="w-80 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800 z-10">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Messages</h2>
             <div className="flex space-x-1">
                 <button 
                    onClick={() => setShowSettingsModal(true)} 
                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                 >
                    <SettingsIcon size={20} />
                 </button>
             </div>
          </div>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search customers..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
             <button onClick={() => setFilter('all')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>All</button>
             <button onClick={() => setFilter('instagram')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${filter === 'instagram' ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Insta</button>
             <button onClick={() => setFilter('whatsapp')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${filter === 'whatsapp' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>WA</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                  <Inbox size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-slate-800 dark:text-white font-semibold mb-1">No Messages Yet</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Simulate a webhook in Settings to start.
                  </p>
              </div>
          ) : (
              filteredConversations.map(chat => (
                <div 
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`group flex items-start p-4 cursor-pointer border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${selectedChatId === chat.id ? 'bg-indigo-50/60 dark:bg-slate-700/60 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
                >
                    <div className="relative mr-3">
                        <img src={chat.avatarUrl} alt={chat.customerName} className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-slate-600" />
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5">
                            {chat.platform === 'instagram' ? <Instagram size={14} className="text-pink-600" /> : <MessageCircle size={14} className="text-green-600" />}
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
                        <div className="ml-2 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                            {chat.unreadCount}
                        </div>
                    )}
                </div>
              ))
          )}
        </div>
      </div>

      {/* --- COLUMN 2: ACTIVE CHAT AREA --- */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 relative">
        {activeChat ? (
            <>
                {/* Chat Header */}
                <div className="h-16 px-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center">
                        <div className="mr-3">
                             <img src={activeChat.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{activeChat.customerName}</h3>
                            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                {activeChat.platform === 'instagram' ? <Instagram size={12} className="mr-1" /> : <MessageCircle size={12} className="mr-1" />}
                                <span className="capitalize">{activeChat.platform}</span>
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

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100 dark:bg-slate-950/50">
                    {activeChat.messages.map((msg) => {
                        const isUser = msg.role === 'user' && !msg.isHumanOverride; 
                        const isAi = msg.role === 'model';
                        const isHumanAgent = msg.isHumanOverride; 

                        return (
                            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-start' : 'justify-end'}`}>
                                <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
                                    
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-sm ${isUser ? 'mr-2' : 'ml-2'} ${isAi ? 'bg-indigo-600 text-white' : (isHumanAgent ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-white dark:bg-slate-700')}`}>
                                        {isAi ? <Bot size={16} /> : (isHumanAgent ? <Server size={14} /> : <span className="text-xs font-bold">{activeChat.customerName[0]}</span>)}
                                    </div>
                                    
                                    <div className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
                                        <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm relative group ${
                                            isUser 
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none' 
                                                : (isAi 
                                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                    : 'bg-indigo-500/90 text-white rounded-tr-none') 
                                        }`}>
                                            {renderMessageContent(msg)}
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

                {/* Input Area */}
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
                                className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-900/50 border-none rounded-xl text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={!inputText.trim()}
                            className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-all hover:scale-105"
                        >
                            <Send size={20} />
                        </button>
                    </form>
                    <div className="text-center mt-2">
                         <p className="text-[10px] text-slate-400">
                             {activeChat.isAiPaused ? 'AI is paused. You are chatting manually.' : 'User is waiting for AI response.'}
                         </p>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageCircle size={64} className="mb-4 opacity-20" />
                <p>Select a conversation to start messaging</p>
            </div>
        )}
      </div>

      {/* --- COLUMN 3: CUSTOMER DETAILS --- */}
      {activeChat && (
        <div className="w-72 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col overflow-y-auto">
            <div className="p-6 text-center border-b border-gray-100 dark:border-slate-700">
                <img src={activeChat.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-slate-50 dark:border-slate-700" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">{activeChat.customerName}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center mt-1">
                    <MapPin size={12} className="mr-1" /> Unknown Location
                </p>
                <div className="flex justify-center mt-4 space-x-2">
                    <button className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors">
                        <Phone size={16} />
                    </button>
                    <button className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors">
                        <MessageCircle size={16} />
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
                             ? "AI is currently disabled for this chat. You must reply manually." 
                             : "AI will automatically respond to new messages from this user."}
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