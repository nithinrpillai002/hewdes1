import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import SettingsPanel from './components/SettingsPanel';
import ChatList from './components/ChatList';
import ChatWindow from './components/ChatWindow';
import LogPanel from './components/LogPanel';
import { CrmConfig, Conversation, LogEntry, LogType, WebhookPayload, UserProfile } from './types';

// Extend window definition for the simulation tool
declare global {
  interface Window {
    simulateWebhook: (customPayload?: any) => void;
  }
}

const DEFAULT_CONFIG: CrmConfig = {
  appId: '',
  bearerToken: '',
  webhookToken: 'instagram_crm_verify_token'
};

const App: React.FC = () => {
  const [config, setConfig] = useState<CrmConfig>(DEFAULT_CONFIG);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // --- Logging Helper ---
  const addLog = useCallback((message: string, type: LogType = 'info', data?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
      // Create deep copy and mask token if present in data
      data: data ? JSON.parse(JSON.stringify(data, (key, value) => {
        if ((key === 'access_token' || key === 'Authorization') && typeof value === 'string') {
          return 'TOKEN_HIDDEN';
        }
        return value;
      })) : undefined
    };
    
    setLogs(prev => [...prev, newLog]);
  }, []);

  // --- Initialization ---
  useEffect(() => {
    // Load settings
    const savedConfig = localStorage.getItem('instagramCrmConfig');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
    
    addLog('Client initialized', 'info');

    // Check Server Health
    const checkServer = async () => {
      try {
        addLog('Connecting to server...', 'info');
        // Cloudflare endpoint
        const res = await fetch('/api/webhook?mode=ping');
        
        // Handle non-JSON responses (like 404 HTML pages)
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Endpoint returned non-JSON response. Check server deployment.');
        }

        if (res.ok) {
          const data = await res.json();
          setServerStatus('connected');
          addLog('Server initialized: Cloudflare Functions active', 'info', data);
        } else {
          setServerStatus('error');
          addLog(`Server check failed: Status ${res.status}`, 'error');
        }
      } catch (e: any) {
        setServerStatus('error');
        addLog(`Server check failed: ${e.message}`, 'error');
      }
    };
    checkServer();

    // Setup global simulator
    window.simulateWebhook = (customPayload) => {
      const defaultPayload: WebhookPayload = {
        object: "instagram",
        entry: [{
          id: "17841405309211844",
          time: Date.now(),
          messaging: [{
            sender: { id: "123456789" + Math.floor(Math.random() * 1000) },
            recipient: { id: "987654321" },
            timestamp: Date.now(),
            message: {
              mid: "mid." + Date.now(),
              text: "Hello! This is a simulated webhook message."
            }
          }]
        }]
      };
      handleWebhook(customPayload || defaultPayload);
    };

    return () => {
      // Cleanup
      delete (window as any).simulateWebhook;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // --- Logic ---

  const handleSaveSettings = (newConfig: CrmConfig) => {
    setConfig(newConfig);
    localStorage.setItem('instagramCrmConfig', JSON.stringify(newConfig));
    addLog('Settings saved successfully', 'info');
  };

  const getUserProfile = async (senderId: string): Promise<UserProfile> => {
    if (!config.bearerToken) {
      addLog('Error: Bearer token not configured', 'error');
      // Return dummy data so the app still works in demo mode
      return {
        id: senderId,
        name: `User ${senderId.substr(0, 5)}`,
        username: `user_${senderId.substr(0, 5)}`,
        profile_pic: `https://ui-avatars.com/api/?name=User+${senderId.substr(0, 5)}&background=random`
      };
    }

    const apiUrl = `/api/instagram`;
    
    addLog('Fetching user profile', 'outgoing', { 
      senderId, 
      action: 'getUserProfile',
      endpoint: apiUrl
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getUserProfile',
          accessToken: config.bearerToken,
          userId: senderId
        })
      });
      
      const data = await response.json();
      addLog('User profile received', 'incoming', data);
      
      if (data.error) {
        throw new Error(data.error.message || 'Unknown API error');
      }

      return data;
    } catch (error: any) {
      addLog(`Error fetching profile: ${error.message}`, 'error', error);
      // Fallback
      return {
        id: senderId,
        name: `User ${senderId.substr(0, 5)}`,
        username: `user_${senderId.substr(0, 5)}`,
        profile_pic: `https://ui-avatars.com/api/?name=User+${senderId.substr(0, 5)}&background=random`
      };
    }
  };

  const handleWebhook = async (payload: WebhookPayload) => {
    addLog('Incoming webhook received', 'incoming', payload);

    if (payload.object === 'instagram') {
      for (const entry of payload.entry) {
        for (const messaging of entry.messaging) {
          const senderId = messaging.sender.id;
          const messageData = messaging.message;

          // Check if we already have this conversation
          setConversations(currentConvos => {
            const exists = currentConvos.find(c => c.id === senderId);
            
            if (exists) {
              // Update existing
              const newMessage: any = {
                id: messageData.mid || 'msg_' + Date.now(),
                text: messageData.text,
                timestamp: messaging.timestamp || Date.now(),
                type: 'received'
              };
              
              // Only add if not duplicate (simple check)
              const msgExists = exists.messages.some(m => m.id === newMessage.id);
              if (msgExists) return currentConvos;

              return currentConvos.map(c => {
                if (c.id === senderId) {
                  return {
                    ...c,
                    messages: [...c.messages, newMessage],
                    lastMessage: messageData.text
                  };
                }
                return c;
              });
            }
            return currentConvos; // If new, we handle async below
          });

          // If it's a new sender, we need to fetch profile first
          const exists = conversations.find(c => c.id === senderId);
          if (!exists) {
             const userProfile = await getUserProfile(senderId);
             
             const newConvo: Conversation = {
               id: senderId,
               name: userProfile.name || 'Unknown User',
               username: userProfile.username || senderId,
               profilePic: userProfile.profile_pic || 'https://via.placeholder.com/48',
               messages: [{
                 id: messageData.mid || 'msg_' + Date.now(),
                 text: messageData.text,
                 timestamp: messaging.timestamp || Date.now(),
                 type: 'received'
               }],
               lastMessage: messageData.text
             };

             setConversations(prev => {
               // Check again to avoid race conditions
               if (prev.find(c => c.id === senderId)) return prev;
               return [newConvo, ...prev];
             });

             // Auto select if it's the first one
             if (conversations.length === 0 && !activeConversationId) {
                setActiveConversationId(newConvo.id);
             }
          }
        }
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;

    // 1. Optimistic Update
    const tempId = 'msg_' + Date.now();
    const newMessage: any = {
      id: tempId,
      text: text,
      timestamp: Date.now(),
      type: 'sent'
    };

    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return {
          ...c,
          messages: [...c.messages, newMessage],
          lastMessage: text
        };
      }
      return c;
    }));

    if (!config.bearerToken) {
      addLog('Cannot send: Bearer token missing. Message added to UI only.', 'error');
      return;
    }

    // 2. API Call
    const apiUrl = `/api/instagram`;
    const payload = {
      action: 'sendMessage',
      accessToken: config.bearerToken,
      userId: activeConversationId,
      message: text
    };

    addLog('Sending message to Instagram', 'outgoing', { 
      url: apiUrl, 
      payload: { ...payload, accessToken: 'TOKEN_HIDDEN' }
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      addLog('Message sent successfully', 'incoming', result);

      if (result.error) {
         throw new Error(result.error.message);
      }
    } catch (error: any) {
      addLog(`Error sending message: ${error.message}`, 'error', error);
      alert(`Failed to send message: ${error.message}`);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  // Determine status indicator color
  let statusColor = 'bg-crm-error';
  let statusTitle = 'Server Disconnected';

  if (serverStatus === 'connected') {
    if (config.bearerToken) {
      statusColor = 'bg-crm-success';
      statusTitle = 'System Online & Authenticated';
    } else {
      statusColor = 'bg-orange-500';
      statusTitle = 'Server Online - Token Missing';
    }
  } else if (serverStatus === 'checking') {
    statusColor = 'bg-gray-400';
    statusTitle = 'Connecting...';
  }

  return (
    <div className="flex h-screen bg-crm-background text-crm-text overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border-r border-crm-border bg-crm-surface">
        <div className="p-4 border-b border-crm-border flex justify-between items-center bg-crm-surface">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-crm-primary" />
            <h1 className="font-bold text-lg">Instagram CRM</h1>
          </div>
          <div className={`w-3 h-3 rounded-full ${statusColor} transition-colors duration-500`} title={statusTitle} />
        </div>
        
        <ChatList 
          conversations={conversations} 
          activeId={activeConversationId} 
          onSelect={setActiveConversationId} 
        />
        
        <SettingsPanel config={config} onSave={handleSaveSettings} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative">
        <ChatWindow 
          conversation={activeConversation} 
          onSendMessage={handleSendMessage} 
        />
        <LogPanel logs={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  );
};

export default App;