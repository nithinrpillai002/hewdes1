import React, { useState, useRef, useEffect } from 'react';
import { Product, AiRule, Message } from '../types';
import { generateAIResponse } from '../services/geminiService';
import { Instagram, MessageCircle, Bot, Save, Plus, Trash, Send, Loader2, ChevronDown, ChevronRight, Globe, Copy, CheckCircle2, AlertTriangle, Smartphone, Pencil, Lock, Server, HelpCircle, ExternalLink, RefreshCw, BookOpen } from 'lucide-react';

interface CRMProps {
  products: Product[];
  rules: AiRule[];
  setRules: React.Dispatch<React.SetStateAction<AiRule[]>>;
}

const CRM: React.FC<CRMProps> = ({ products, rules, setRules }) => {
  // Main Platform Tab
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'whatsapp'>('instagram');
  
  // Section Toggles inside platform
  const [openSection, setOpenSection] = useState<{connection: boolean; training: boolean}>({
    connection: true,
    training: true
  });
  const [showGuide, setShowGuide] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', content: 'Namaste! Welcome to Hewdes Gifts. How can I assist you today?', timestamp: Date.now() }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [newRule, setNewRule] = useState('');

  // Settings for connection - Loaded from LocalStorage
  const [waConfig, setWaConfig] = useState(() => {
    const saved = localStorage.getItem('wa_config');
    return saved ? JSON.parse(saved) : { id: '', token: '' };
  });

  const [igConfig, setIgConfig] = useState(() => {
    const saved = localStorage.getItem('ig_config');
    return saved ? JSON.parse(saved) : { id: '', token: '' };
  });

  // Webhook Configuration State
  const [currentOrigin, setCurrentOrigin] = useState('');
  // HARDCODED TOKEN TO MATCH SERVER.JS
  const verifyToken = 'hewdes_rttf0kd11o1axrmc'; 

  useEffect(() => {
    // Detect environment
    if (typeof window !== 'undefined') {
        setCurrentOrigin(window.location.origin);
    }
  }, []);

  // Locking state (UI only) - initialize locked if data exists
  const [isWaLocked, setIsWaLocked] = useState(() => !!(waConfig.id && waConfig.token));
  const [isIgLocked, setIsIgLocked] = useState(() => !!(igConfig.id && igConfig.token));

  // Save Configs to LocalStorage
  useEffect(() => {
    localStorage.setItem('wa_config', JSON.stringify(waConfig));
  }, [waConfig]);

  useEffect(() => {
    localStorage.setItem('ig_config', JSON.stringify(igConfig));
  }, [igConfig]);
  
  // Verification States
  const [isVerifyingWa, setIsVerifyingWa] = useState(false);
  const [waConnectionStatus, setWaConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);

  const toggleSection = (section: 'connection' | 'training') => {
    setOpenSection(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, actionStatus]);

  // Reset chat when switching platforms
  useEffect(() => {
    setMessages([{ id: '1', role: 'model', content: 'Namaste! Welcome to Hewdes Gifts. How can I assist you today?', timestamp: Date.now() }]);
  }, [activePlatform]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isTyping) return;

    // Use key from settings or empty string (server will use fallback)
    const apiKey = localStorage.getItem('kie_api_key') || '';

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);
    setActionStatus(null);

    // Filter rules for the active platform
    const platformRules = rules.filter(r => r.platform === activePlatform);
    const platformLabel = activePlatform === 'instagram' ? 'Instagram' : 'WhatsApp';

    const response = await generateAIResponse(
      messages, 
      userMsg.content, 
      products, 
      platformRules, 
      platformLabel,
      apiKey
    );

    if (response.actionTaken) {
        setActionStatus(response.actionTaken);
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      content: response.text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  const handleSaveInstagram = () => {
    if (igConfig.id && igConfig.token) {
        setIsIgLocked(true);
    }
  };

  const handleVerifyWhatsApp = async () => {
    if (!waConfig.id || !waConfig.token) {
        setWaConnectionStatus({ success: false, message: "Please enter both Phone Number ID and Access Token." });
        return;
    }
    
    setIsVerifyingWa(true);
    setWaConnectionStatus(null);
    
    try {
        // Attempt to fetch phone number details from Graph API
        const response = await fetch(`https://graph.facebook.com/v21.0/${waConfig.id}?fields=id,display_phone_number,quality_rating`, {
            headers: { 'Authorization': `Bearer ${waConfig.token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            setWaConnectionStatus({ 
                success: true, 
                message: `Verified! Connected to +${data.display_phone_number || '91 XXXXX XXXXX'}` 
            });
            setIsWaLocked(true); // Lock on success
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Invalid credentials.");
        }
    } catch (error: any) {
        setWaConnectionStatus({ 
            success: false, 
            message: `Error: ${error.message}. Try deploying to Cloud Run if testing connection.` 
        });
    } finally {
        setIsVerifyingWa(false);
    }
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    const rule: AiRule = {
      id: Date.now().toString(),
      type: 'instruction',
      content: newRule,
      isActive: true,
      platform: activePlatform
    };
    setRules(prev => [...prev, rule]);
    setNewRule('');
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderSetupGuide = () => (
    <div className="bg-white dark:bg-slate-700 p-5 rounded-lg mb-6 border border-indigo-100 dark:border-slate-600 shadow-sm animate-fadeIn">
        <h4 className="font-bold text-indigo-700 dark:text-indigo-300 mb-4 flex items-center text-sm uppercase tracking-wide">
            <BookOpen size={16} className="mr-2" />
            How to Connect {activePlatform === 'instagram' ? 'Instagram' : 'WhatsApp'}
        </h4>
        
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">1</span>
                <div>
                    <p className="font-semibold text-slate-800 dark:text-white">Go to Meta Developers</p>
                    <p>Open <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">developers.facebook.com</a> and select your app.</p>
                </div>
            </div>

            <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">2</span>
                <div>
                    <p className="font-semibold text-slate-800 dark:text-white">Configure Webhook</p>
                    <p>On the sidebar, find <strong>{activePlatform === 'instagram' ? 'Instagram' : 'WhatsApp'}</strong> → <strong>Configuration</strong>.</p>
                    <p>Find the "Webhook" section and click <strong>Edit</strong>.</p>
                </div>
            </div>

            <div className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">3</span>
                <div>
                    <p className="font-semibold text-slate-800 dark:text-white">Enter Callback Details</p>
                    <p><strong>Callback URL:</strong> Copy the URL from the "Webhook Setup" box below.</p>
                    <p><strong>Verify Token:</strong> Copy the token <code>{verifyToken}</code> below.</p>
                </div>
            </div>
        </div>
    </div>
  );

  const renderWebhookSection = (platform: 'instagram' | 'whatsapp') => {
    const isLocalhost = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');
    const webhookUrl = `${currentOrigin}/webhook/${platform}`;

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm relative overflow-hidden mt-4">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <Globe size={100} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex items-center justify-between mb-3 relative z-10">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center">
                    <Server size={16} className="mr-2 text-indigo-600 dark:text-indigo-400" />
                    Webhook Setup (Backend)
                </h4>
                <button 
                    onClick={() => setShowGuide(!showGuide)}
                    className="text-xs flex items-center text-indigo-600 dark:text-indigo-400 hover:underline bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm"
                >
                    <HelpCircle size={14} className="mr-1" />
                    {showGuide ? 'Hide Guide' : 'Show Guide'}
                </button>
            </div>

            {showGuide && renderSetupGuide()}
            
            <div className="relative z-10 space-y-4">
                {isLocalhost && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800 flex items-start space-x-2">
                         <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                         <div className="text-xs text-red-800 dark:text-red-300">
                            <strong>Localhost Detected:</strong> Webhook verification will FAIL on localhost.
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Callback URL (HTTPS)</label>
                    <div className="flex">
                        <input 
                            type="text" 
                            readOnly
                            value={webhookUrl}
                            className={`flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-l-lg text-xs font-mono shadow-sm outline-none focus:ring-1 focus:ring-indigo-500 ${isLocalhost ? 'text-red-500 border-red-200' : 'text-slate-600 dark:text-slate-300 border-gray-300 dark:border-slate-600'}`}
                        />
                        <button 
                            onClick={() => copyToClipboard(webhookUrl)}
                            className="px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-l-0 border-gray-300 dark:border-slate-600 rounded-r-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
                            title="Copy URL"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                </div>
                <div>
                        <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Verify Token</label>
                        <div className="flex">
                        <input 
                            type="text" 
                            readOnly
                            value={verifyToken} 
                            className="flex-1 px-3 py-1.5 bg-gray-100 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 rounded-lg text-xs text-slate-600 dark:text-slate-300 font-mono shadow-sm outline-none font-bold"
                        />
                        <button 
                            onClick={() => copyToClipboard(verifyToken)}
                            className="ml-2 px-3 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm"
                            title="Copy Token"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Left Panel: CRM Modules */}
      <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-slate-700">
        
        {/* Module Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button 
            onClick={() => setActivePlatform('instagram')}
            className={`flex-1 py-4 flex items-center justify-center space-x-2 text-sm font-semibold transition-colors ${
                activePlatform === 'instagram' 
                ? 'text-pink-600 border-b-2 border-pink-600 bg-pink-50/50 dark:bg-pink-900/20' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <Instagram size={18} /> <span>Instagram</span>
          </button>
          <button 
            onClick={() => setActivePlatform('whatsapp')}
            className={`flex-1 py-4 flex items-center justify-center space-x-2 text-sm font-semibold transition-colors ${
                activePlatform === 'whatsapp' 
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50 dark:bg-green-900/20' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            <MessageCircle size={18} /> <span>WhatsApp</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900 space-y-4">
            
            {/* 1. Connection Module */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                <button 
                    onClick={() => toggleSection('connection')}
                    className="w-full px-5 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${activePlatform === 'instagram' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                            {activePlatform === 'instagram' ? <Instagram size={20} /> : <Smartphone size={20} />}
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Connection Settings</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">API Credentials & Webhooks</p>
                        </div>
                    </div>
                    {openSection.connection ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </button>
                
                {openSection.connection && (
                    <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-slate-700 animate-fadeIn">
                        {activePlatform === 'instagram' ? (
                             <div className="space-y-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                    <p><strong>Note:</strong> Instagram Automation requires both an Account ID and an Access Token to manage Direct Messages via the Graph API.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        Instagram Account ID {isIgLocked && <Lock size={12} className="inline ml-1" />}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={igConfig.id}
                                        onChange={e => setIgConfig({...igConfig, id: e.target.value})}
                                        disabled={isIgLocked}
                                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white outline-none transition-all ${isIgLocked ? 'opacity-60 cursor-not-allowed border-gray-200 dark:border-slate-700' : 'border-gray-200 dark:border-slate-600 focus:border-pink-500 focus:ring-1 focus:ring-pink-500'}`}
                                        placeholder="Enter Account ID"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        Access Token {isIgLocked && <Lock size={12} className="inline ml-1" />}
                                    </label>
                                    <input 
                                        type="password" 
                                        value={igConfig.token}
                                        onChange={e => setIgConfig({...igConfig, token: e.target.value})}
                                        disabled={isIgLocked}
                                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white outline-none transition-all ${isIgLocked ? 'opacity-60 cursor-not-allowed border-gray-200 dark:border-slate-700' : 'border-gray-200 dark:border-slate-600 focus:border-pink-500 focus:ring-1 focus:ring-pink-500'}`}
                                        placeholder="EAA..."
                                    />
                                </div>

                                <div className="flex space-x-3">
                                    {isIgLocked ? (
                                        <>
                                            <button 
                                                disabled
                                                className="flex-1 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-bold text-sm flex items-center justify-center cursor-default"
                                            >
                                                <CheckCircle2 size={16} className="mr-2" /> Saved
                                            </button>
                                            <button 
                                                onClick={() => setIsIgLocked(false)}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                                title="Edit Credentials"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={handleSaveInstagram}
                                            className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center"
                                        >
                                            <Save size={16} className="mr-2" /> Save & Connect
                                        </button>
                                    )}
                                </div>

                                {renderWebhookSection('instagram')}
                             </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        Phone Number ID {isWaLocked && <Lock size={12} className="inline ml-1" />}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={waConfig.id}
                                        onChange={e => setWaConfig({...waConfig, id: e.target.value})}
                                        disabled={isWaLocked}
                                        placeholder="e.g. 10000000000"
                                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white outline-none transition-all ${isWaLocked ? 'opacity-60 cursor-not-allowed border-gray-200 dark:border-slate-700' : 'border-gray-200 dark:border-slate-600 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                                        Access Token {isWaLocked && <Lock size={12} className="inline ml-1" />}
                                    </label>
                                    <input 
                                        type="password" 
                                        value={waConfig.token}
                                        onChange={e => setWaConfig({...waConfig, token: e.target.value})}
                                        disabled={isWaLocked}
                                        placeholder="EAAG..."
                                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border rounded-lg text-sm text-slate-900 dark:text-white outline-none transition-all ${isWaLocked ? 'opacity-60 cursor-not-allowed border-gray-200 dark:border-slate-700' : 'border-gray-200 dark:border-slate-600 focus:border-green-500 focus:ring-1 focus:ring-green-500'}`}
                                    />
                                </div>
                                
                                {waConnectionStatus && (
                                    <div className={`p-3 rounded-lg flex items-start space-x-2 text-xs ${waConnectionStatus.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                                        {waConnectionStatus.success ? <CheckCircle2 size={14} className="mt-0.5" /> : <AlertTriangle size={14} className="mt-0.5" />}
                                        <span>{waConnectionStatus.message}</span>
                                    </div>
                                )}

                                <div className="flex space-x-3">
                                    {isWaLocked ? (
                                        <>
                                            <button 
                                                disabled
                                                className="flex-1 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-bold text-sm flex items-center justify-center cursor-default"
                                            >
                                                <CheckCircle2 size={16} className="mr-2" /> Saved
                                            </button>
                                            <button 
                                                onClick={() => setIsWaLocked(false)}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                                title="Edit Credentials"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={handleVerifyWhatsApp}
                                            disabled={isVerifyingWa}
                                            className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center"
                                        >
                                            {isVerifyingWa ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                                            Test & Save
                                        </button>
                                    )}
                                </div>

                                {renderWebhookSection('whatsapp')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. AI Training Module */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                <button 
                    onClick={() => toggleSection('training')}
                    className="w-full px-5 py-4 flex items-center justify-between bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                            <Bot size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">AI Behavior & Memory</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Teach the AI what to say (and what NOT to say)</p>
                        </div>
                    </div>
                    {openSection.training ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </button>

                {openSection.training && (
                    <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-slate-700 animate-fadeIn">
                        <div className="bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4 mb-4">
                            <h5 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">How to train the AI:</h5>
                            <ul className="list-disc list-inside text-xs text-indigo-700 dark:text-indigo-400 space-y-1">
                                <li>Add specific answers for common questions.</li>
                                <li>Set restrictions (e.g., "Never promise delivery before 24 hours").</li>
                                <li>Define the personality (e.g., "Be super excited about gifts!").</li>
                            </ul>
                        </div>

                        <div className="space-y-2 mb-4">
                            {rules.filter(r => r.platform === activePlatform).length === 0 ? (
                                <p className="text-center text-slate-400 text-xs py-4 italic">No custom rules added for {activePlatform} yet.</p>
                            ) : (
                                rules.filter(r => r.platform === activePlatform).map(rule => (
                                    <div key={rule.id} className="flex items-start justify-between bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-3 rounded-lg shadow-sm group hover:border-indigo-100 dark:hover:border-indigo-800 transition-colors">
                                        <div className="flex-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{rule.type}</span>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{rule.content}</p>
                                        </div>
                                        <button onClick={() => deleteRule(rule.id)} className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-2">
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <form onSubmit={handleAddRule} className="flex flex-col space-y-2">
                             <input 
                                type="text" 
                                value={newRule}
                                onChange={e => setNewRule(e.target.value)}
                                placeholder={`e.g., If they ask for discounts, say use code HEWDES10`}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center text-sm font-medium">
                                <Plus size={16} className="mr-1" /> Add Rule to Memory
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Simulation Chat */}
            <div className="flex justify-center p-4">
                 <p className="text-center text-[10px] text-slate-400">
                    AI Agent connected via KIE Gemini 3 Flash API.
                </p>
            </div>

        </div>
      </div>

      {/* Right Panel: Simulation Chat */}
      <div className="w-1/2 flex flex-col bg-slate-100 dark:bg-slate-950 border-l border-gray-200 dark:border-slate-800 relative">
        <div className="absolute top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 border-b border-gray-200 dark:border-slate-800 z-10 flex justify-between items-center transition-colors">
            <div>
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                    {activePlatform === 'instagram' ? <Instagram size={16} className="mr-2 text-pink-600" /> : <MessageCircle size={16} className="mr-2 text-green-600" />}
                    Live Simulator
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Testing context: {activePlatform === 'instagram' ? 'Instagram DM' : 'WhatsApp (+91)'}</p>
            </div>
            <div className="flex items-center space-x-2">
                 <button 
                    onClick={() => setMessages([{ id: '1', role: 'model', content: 'Namaste! Welcome to Hewdes Gifts. How can I assist you today?', timestamp: Date.now() }])}
                    className="text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300 transition-colors flex items-center"
                >
                    <RefreshCw size={12} className="mr-1" /> Reset
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-20 space-y-4">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : (msg.role === 'system' ? 'justify-center' : 'justify-start')}`}>
                    {msg.role === 'system' ? (
                        <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-800">{msg.content}</span>
                    ) : (
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? (activePlatform === 'instagram' ? 'bg-pink-600 text-white rounded-br-none' : 'bg-green-600 text-white rounded-br-none')
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-gray-100 dark:border-slate-700'
                        }`}>
                            {msg.content}
                        </div>
                    )}
                </div>
            ))}
            
            {actionStatus && (
                <div className="flex justify-start">
                     <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs px-3 py-1.5 rounded-full flex items-center animate-pulse">
                        <Loader2 size={12} className="mr-2 animate-spin" />
                        System Action: {actionStatus}
                     </div>
                </div>
            )}

            {isTyping && !actionStatus && (
                 <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-gray-100 dark:border-slate-700 shadow-sm flex space-x-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-0"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-300"></div>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 transition-colors">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
                <input 
                    type="text" 
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    placeholder={`Message as ${activePlatform === 'instagram' ? 'Instagram' : 'WhatsApp'} user...`}
                    disabled={isTyping}
                    className={`flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white transition-all disabled:opacity-50 ${activePlatform === 'instagram' ? 'focus:ring-2 focus:ring-pink-500' : 'focus:ring-2 focus:ring-green-500'}`}
                />
                <button 
                    type="submit" 
                    disabled={!inputMessage.trim() || isTyping}
                    className={`disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors shadow-sm ${activePlatform === 'instagram' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                    <Send size={20} />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default CRM;