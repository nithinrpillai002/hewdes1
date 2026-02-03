
import React, { useState, useRef, useEffect } from 'react';
import { Product, AiRule, Message, Conversation, Tag } from '../types';
import { generateAIResponse } from '../services/geminiService';
import { 
  Instagram, MessageCircle, Bot, Save, Plus, Trash, Send, Loader2, 
  Search, MoreVertical, Phone, MapPin, Tag as TagIcon, Zap, ZapOff,
  Settings as SettingsIcon, X, CheckCircle2, Lock, AlertTriangle, 
  Paperclip, Smile, Filter, Copy, Globe, Server, Inbox, UserPlus
} from 'lucide-react';

interface CRMProps {
  products: Product[];
  rules: AiRule[];
  setRules: React.Dispatch<React.SetStateAction<AiRule[]>>;
}

const CRM: React.FC<CRMProps> = ({ products, rules, setRules }) => {
  // --- STATE ---
  // Start with empty conversations as requested (No dummy data)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'instagram' | 'whatsapp'>('all');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false); // AI Typing indicator
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [activeSettingsTab, setActiveSettingsTab] = useState<'instagram' | 'whatsapp'>('instagram');
  const [waConfig, setWaConfig] = useState(() => JSON.parse(localStorage.getItem('wa_config') || '{"id":"","token":""}'));
  const [igConfig, setIgConfig] = useState(() => JSON.parse(localStorage.getItem('ig_config') || '{"id":"","token":""}'));
  const [newRule, setNewRule] = useState('');

  // Derived State
  const activeChat = conversations.find(c => c.id === selectedChatId);
  const filteredConversations = conversations.filter(c => filter === 'all' || c.platform === filter);

  // --- EFFECTS ---
  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, isTyping]);

  useEffect(() => {
    localStorage.setItem('wa_config', JSON.stringify(waConfig));
  }, [waConfig]);

  useEffect(() => {
    localStorage.setItem('ig_config', JSON.stringify(igConfig));
  }, [igConfig]);

  // --- HANDLERS ---
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const simulateIncomingMessage = () => {
    const names = ["Aarav Patel", "Diya Sharma", "Vihaan Singh", "Ananya Gupta", "Rohan Mehta", "Ishita Reddy"];
    const msgs = [
        "Hey, do you have this in blue?", 
        "Where is my order #123?", 
        "Love the product! Can I order another?", 
        "Hi, I have a question about shipping.",
        "Is this item customizable?",
        "Do you ship to Bangalore?"
    ];
    const platforms: ('instagram' | 'whatsapp')[] = ['instagram', 'whatsapp'];
    
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
    const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
    
    const newId = Date.now().toString();
    const newConv: Conversation = {
      id: newId,
      customerName: randomName,
      platform: randomPlatform,
      lastMessage: randomMsg,
      lastMessageTime: Date.now(),
      unreadCount: 1,
      tags: [{ id: `t-${newId}`, label: 'New Inquiry', color: 'bg-blue-100 text-blue-700' }],
      isAiPaused: false,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(randomName)}&background=random&color=fff`,
      messages: [
        { id: `m-${Date.now()}`, role: 'user', content: randomMsg, timestamp: Date.now() }
      ]
    };
    
    setConversations(prev => [newConv, ...prev]);
    if (!selectedChatId) setSelectedChatId(newId);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeChat) return;

    const currentChatId = activeChat.id;
    const userMessageContent = inputText;

    // 1. Add User/Agent Message
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user', // We mark agent messages as user role for the AI context, but flag them visually
      content: userMessageContent,
      timestamp: Date.now(),
      isHumanOverride: true // Mark as sent by human agent from CRM
    };

    updateConversation(currentChatId, {
      lastMessage: userMessageContent,
      lastMessageTime: Date.now(),
      messages: [...activeChat.messages, newMessage]
    });

    setInputText('');

    // 2. If AI is NOT paused, generate response
    if (!activeChat.isAiPaused) {
      setIsTyping(true);
      
      const apiKey = localStorage.getItem('kie_api_key') || '';
      const platformRules = rules.filter(r => r.platform === activeChat.platform);
      const platformLabel = activeChat.platform === 'instagram' ? 'Instagram' : 'WhatsApp';

      // Simulate network delay for realism
      setTimeout(async () => {
        try {
          // Construct history for AI (exclude system prompts if needed, handled in service)
          const history = activeChat.messages.concat(newMessage);
          
          const aiResponse = await generateAIResponse(
            history,
            'Generate a response based on the previous message context', // Trigger generation
            products,
            platformRules,
            platformLabel,
            apiKey
          );

          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: aiResponse.text,
            timestamp: Date.now()
          };

          // Update conversation with bot response only if the chat hasn't been paused in the meantime
          setConversations(prev => prev.map(c => {
            if (c.id === currentChatId && !c.isAiPaused) {
               return {
                 ...c,
                 lastMessage: aiResponse.text,
                 lastMessageTime: Date.now(),
                 messages: [...c.messages, newMessage, botMessage]
               };
            }
            return c;
          }));

        } catch (error) {
          console.error("AI Error", error);
        } finally {
          setIsTyping(false);
        }
      }, 1000); // 1s visual delay
    }
  };

  const updateConversation = (id: string, updates: Partial<Conversation>) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const toggleAiStatus = () => {
    if (activeChat) {
      updateConversation(activeChat.id, { isAiPaused: !activeChat.isAiPaused });
    }
  };

  const deleteTag = (tagId: string) => {
    if(activeChat) {
        updateConversation(activeChat.id, { 
            tags: activeChat.tags.filter(t => t.id !== tagId) 
        });
    }
  };

  const addTag = () => {
    if(activeChat) {
        const newTag: Tag = { id: Date.now().toString(), label: 'Follow Up', color: 'bg-yellow-100 text-yellow-700' };
        updateConversation(activeChat.id, { tags: [...activeChat.tags, newTag] });
    }
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selectedChatId === id) setSelectedChatId(null);
  };

  // --- SETTINGS HELPERS ---
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    const rule: AiRule = {
      id: Date.now().toString(),
      type: 'instruction',
      content: newRule,
      isActive: true,
      platform: activeSettingsTab
    };
    setRules(prev => [...prev, rule]);
    setNewRule('');
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  // --- RENDERERS ---

  const renderSettingsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Automation Settings</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configure connection and AI behavior</p>
          </div>
          <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-gray-100 dark:border-slate-700">
          <button 
            onClick={() => setActiveSettingsTab('instagram')}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 ${activeSettingsTab === 'instagram' ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50 dark:bg-pink-900/20' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <Instagram size={16} /> <span>Instagram</span>
          </button>
          <button 
            onClick={() => setActiveSettingsTab('whatsapp')}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 ${activeSettingsTab === 'whatsapp' ? 'text-green-600 border-b-2 border-green-600 bg-green-50 dark:bg-green-900/20' : 'text-slate-500 dark:text-slate-400'}`}
          >
            <MessageCircle size={16} /> <span>WhatsApp</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Connection Config */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center">
                    <Server size={18} className="mr-2 text-indigo-500" /> 
                    API Connection
                </h3>
                {activeSettingsTab === 'instagram' ? (
                     <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="Instagram Account ID"
                            value={igConfig.id}
                            onChange={e => setIgConfig({...igConfig, id: e.target.value})}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                        />
                        <input 
                            type="password" 
                            placeholder="Access Token"
                            value={igConfig.token}
                            onChange={e => setIgConfig({...igConfig, token: e.target.value})}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                        />
                         <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                             <span>Callback URL: <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded">{window.location.origin}/webhook/instagram</code></span>
                             <button className="text-indigo-600 hover:underline">Verify</button>
                         </div>
                     </div>
                ) : (
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="Phone Number ID"
                            value={waConfig.id}
                            onChange={e => setWaConfig({...waConfig, id: e.target.value})}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input 
                            type="password" 
                            placeholder="Access Token"
                            value={waConfig.token}
                            onChange={e => setWaConfig({...waConfig, token: e.target.value})}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500"
                        />
                         <div className="flex justify-between items-center text-xs text-slate-500 mt-2">
                             <span>Callback URL: <code className="bg-gray-100 dark:bg-slate-700 px-1 py-0.5 rounded">{window.location.origin}/webhook/whatsapp</code></span>
                             <button className="text-indigo-600 hover:underline">Verify</button>
                         </div>
                    </div>
                )}
            </div>

            {/* 2. Rules Config */}
            <div>
                 <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center">
                    <Bot size={18} className="mr-2 text-indigo-500" /> 
                    AI Instructions
                </h3>
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {rules.filter(r => r.platform === activeSettingsTab).length === 0 ? (
                        <p className="text-sm text-slate-400 italic">No rules yet.</p>
                    ) : (
                        rules.filter(r => r.platform === activeSettingsTab).map(rule => (
                            <div key={rule.id} className="flex justify-between items-start bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-gray-100 dark:border-slate-700">
                                <span className="text-sm text-slate-700 dark:text-slate-300">{rule.content}</span>
                                <button onClick={() => deleteRule(rule.id)} className="text-slate-400 hover:text-red-500 ml-2">
                                    <Trash size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <form onSubmit={handleAddRule} className="flex gap-2">
                    <input 
                        type="text" 
                        value={newRule}
                        onChange={e => setNewRule(e.target.value)}
                        placeholder="e.g. Always respond with 'Namaste'..."
                        className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        <Plus size={20} />
                    </button>
                </form>
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      {/* --- COLUMN 1: CONVERSATION LIST --- */}
      <div className="w-80 border-r border-gray-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800 z-10">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Messages</h2>
             <div className="flex space-x-1">
                 <button 
                    onClick={simulateIncomingMessage}
                    title="Simulate Incoming Message (Test)"
                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-700 rounded-full transition-colors"
                 >
                    <UserPlus size={20} />
                 </button>
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
             <button 
                onClick={() => setFilter('all')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
             >
                All
             </button>
             <button 
                onClick={() => setFilter('instagram')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${filter === 'instagram' ? 'bg-white dark:bg-slate-700 text-pink-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
             >
                Insta
             </button>
             <button 
                onClick={() => setFilter('whatsapp')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${filter === 'whatsapp' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
             >
                WA
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                  <Inbox size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                  <h3 className="text-slate-800 dark:text-white font-semibold mb-1">No Messages Yet</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Conversations will appear here when customers contact you.
                  </p>
                  <button 
                    onClick={simulateIncomingMessage}
                    className="text-xs bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-slate-600 transition-colors"
                  >
                      Simulate Incoming Message
                  </button>
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
                        <div className="flex items-center space-x-2">
                            {chat.tags.map(tag => (
                                <span key={tag.id} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tag.color}`}>
                                    {tag.label}
                                </span>
                            ))}
                        </div>
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
                        <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100 dark:bg-slate-950/50">
                    <div className="text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full">Today</span>
                    </div>
                    
                    {activeChat.messages.map((msg) => {
                        const isUser = msg.role === 'user' && !msg.isHumanOverride; // External Customer
                        const isAi = msg.role === 'model';
                        const isHumanAgent = msg.isHumanOverride; // You from CRM

                        return (
                            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-start' : 'justify-end'}`}>
                                <div className={`flex max-w-[70%] ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
                                    {/* Avatar for bot or user */}
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-sm ${isUser ? 'mr-2' : 'ml-2'} ${isAi ? 'bg-indigo-600 text-white' : (isHumanAgent ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' : 'bg-white dark:bg-slate-700')}`}>
                                        {isAi ? <Bot size={16} /> : (isHumanAgent ? <Server size={14} /> : <span className="text-xs font-bold">{activeChat.customerName[0]}</span>)}
                                    </div>
                                    
                                    <div className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
                                        <div className={`px-4 py-3 rounded-2xl text-sm shadow-sm relative group ${
                                            isUser 
                                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none' 
                                                : (isAi 
                                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                    : 'bg-indigo-500/90 text-white rounded-tr-none') // Human Agent style
                                        }`}>
                                            {msg.content}
                                            {/* Human Override Badge */}
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
                    
                    {isTyping && (
                         <div className="flex justify-end">
                            <div className="flex flex-row-reverse items-end">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center ml-2 mb-1">
                                    <Bot size={16} className="text-white" />
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-3 rounded-2xl rounded-tr-none border border-indigo-100 dark:border-indigo-800 flex space-x-1">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-0"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-300"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <button type="button" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <Paperclip size={20} />
                        </button>
                         <button type="button" className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <Smile size={20} />
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
                             {activeChat.isAiPaused ? 'AI is paused. You are chatting manually.' : 'Sending a message will simulate user input. AI will respond automatically.'}
                         </p>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageCircle size={64} className="mb-4 opacity-20" />
                <p>Select a conversation to start messaging</p>
                <div className="mt-4">
                     <button 
                        onClick={simulateIncomingMessage}
                        className="text-xs bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                      >
                          Start Test Chat
                      </button>
                </div>
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
                    <MapPin size={12} className="mr-1" /> Mumbai, India
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
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                        {activeChat.tags.map(tag => (
                            <span key={tag.id} className={`text-xs px-2 py-1 rounded-md font-medium flex items-center ${tag.color}`}>
                                {tag.label}
                                <button onClick={() => deleteTag(tag.id)} className="ml-1 opacity-50 hover:opacity-100"><X size={10} /></button>
                            </span>
                        ))}
                        <button onClick={addTag} className="text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors flex items-center">
                            <Plus size={10} className="mr-1" /> Add
                        </button>
                    </div>
                </div>

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
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Last Order</h4>
                    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg p-3 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                             <span className="text-xs font-bold text-slate-800 dark:text-white">#ORD-9821</span>
                             <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Delivered</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Custom Engraved Watch</p>
                        <p className="text-xs text-slate-400">Oct 24, 2024</p>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Settings Modal Overlay */}
      {showSettingsModal && renderSettingsModal()}
    </div>
  );
};

export default CRM;
