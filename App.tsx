import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, RefreshCw, Activity } from 'lucide-react';
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
  
  // Track processed event IDs to avoid duplicates during polling
  const processedEventIds = useRef<Set<string>>(new Set());

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
        const res = await fetch('/api/webhook?mode=ping');
        
        // Validate response type
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Endpoint returned non-JSON response. Check netlify.toml redirects.');
        }

        if (res.ok) {
          const data = await res.json();
          setServerStatus('connected');
          addLog('Server initialized: Connected to Functions', 'info', data);
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
      delete (window as any).simulateWebhook;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Polling Logic ---
  useEffect(() => {
    if (serverStatus !== 'connected') return;

    const pollEvents = async () => {
      try {
        const res = await fetch('/api/webhook?mode=events');
        if (res.ok) {
          const data = await res.json();
          if (data.events && Array.isArray(data.events)) {
            const events = data.events.reverse(); // Process oldest first
            
            let newEventsCount = 0;
            for (const event of events) {
              if (!processedEventIds.current.has(event._id)) {
                processedEventIds.current.add(event._id);
                newEventsCount++;
                
                addLog(`Server received webhook (${event._id.substring(0,6)})`, 'incoming', event.payload);
                await handleWebhook(event.payload);
              }
            }
          }
        }
      } catch (e) {
        // Silent fail polling
      }
    };

    const intervalId = setInterval(pollEvents, 3000);
    return () => clearInterval(intervalId);
  }, [serverStatus, addLog]);

  // --- Logic ---

  const handleSaveSettings = (newConfig: CrmConfig) => {
    setConfig(newConfig);
    localStorage.setItem('instagramCrmConfig', JSON.stringify(newConfig));
    addLog('Settings saved successfully', 'info');
  };

  const handleTestLoopback = async () => {
    addLog('Sending loopback test to server...', 'outgoing');
    try {
      const payload = {
        object: 'instagram',
        entry: [{
          id: 'TEST_LOOPBACK',
          time: Date.now(),
          messaging: [{
            sender: { id: 'TEST_USER' },
            recipient: { id: 'CRM_SYSTEM' },
            timestamp: Date.now(),
            message: { mid: 'loopback_' + Date.now(), text: 'This is a test message from loopback.' }
          }]
        }]
      };

      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addLog('Loopback sent. Waiting for poll...', 'success');
      } else {
        addLog(`Loopback failed: ${res.status}`, 'error');
      }
    } catch (e: any) {
      addLog(`Loopback error: ${e.message}`, 'error');
    }
  };

  const handleFetchServerLogs = async () => {
    try {
      const res = await fetch('/api/webhook?mode=events');
      if (res.ok) {
        const data = await res.json();
        addLog(`Fetched ${data.events.length} logs from server`, 'info');
        return data.events;
      }
      return [];
    } catch (e: any) {
      addLog(`Failed to fetch logs: ${e.message}`, 'error');
      return [];
    }
  };

  const getUserProfile = async (senderId: string): Promise<UserProfile> => {
    if (senderId === 'TEST_USER') {
      return { id: 'TEST_USER', name: 'Test User', username: 'tester', profile_pic: '' };
    }

    if (!config.bearerToken) {
      addLog('Bearer token missing - skipping profile fetch', 'info');
      return {
        id: senderId,
        name: `User ${senderId.substr(0, 5)}`,
        username: `user_${senderId.substr(0, 5)}`,
        profile_pic: `https://ui-avatars.com/api/?name=User+${senderId.substr(0, 5)}&background=random`
      };
    }

    const apiUrl = `/api/instagram`;
    addLog('Fetching user profile', 'outgoing', { senderId, action: 'getUserProfile' });

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
      if (data.error) throw new Error(data.error.message);
      
      addLog('User profile received', 'incoming', data);
      return data;
    } catch (error: any) {
      return {
        id: senderId,
        name: `User ${senderId.substr(0, 5)}`,
        username: `user_${senderId.substr(0, 5)}`,
        profile_pic: `https://ui-avatars.com/api/?name=User+${senderId.substr(0, 5)}&background=random`
      };
    }
  };

  const handleWebhook = async (payload: WebhookPayload) => {
    if (payload.object === 'instagram') {
      for (const entry of payload.entry) {
        if (!entry.messaging) continue;
        
        for (const messaging of entry.messaging) {
          const senderId = messaging.sender.id;
          const messageData = messaging.message;
          if (!messageData) continue; 

          setConversations(currentConvos => {
            const exists = currentConvos.find(c => c.id === senderId);
            if (exists) {
              const newMessage: any = {
                id: messageData.mid || 'msg_' + Date.now(),
                text: messageData.text,
                timestamp: messaging.timestamp || Date.now(),
                type: 'received'
              };
              
              if (exists.messages.some(m => m.id === newMessage.id)) return currentConvos;

              return currentConvos.map(c => {
                if (c.id === senderId) {
                  return { ...c, messages: [...c.messages, newMessage], lastMessage: messageData.text };
                }
                return c;
              });
            }
            return currentConvos;
          });

          const userProfile = await getUserProfile(senderId);
             
          setConversations(prev => {
            if (prev.find(c => c.id === senderId)) return prev;

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
            
            if (prev.length === 0) setActiveConversationId(newConvo.id);
            return [newConvo, ...prev];
          });
        }
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeConversationId) return;

    // Optimistic Update
    const tempId = 'msg_' + Date.now();
    const newMessage: any = { id: tempId, text: text, timestamp: Date.now(), type: 'sent' };

    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return { ...c, messages: [...c.messages, newMessage], lastMessage: text };
      }
      return c;
    }));

    if (!config.bearerToken) {
      addLog('Cannot send: Bearer token missing. Message added to UI only.', 'error');
      return;
    }

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
      
      if (result.error) throw new Error(result.error.message);
      
      addLog('Message sent successfully', 'incoming', result);
    } catch (error: any) {
      addLog(`Error sending message: ${error.message}`, 'error', error);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  let statusColor = 'bg-crm-error';
  let statusTitle = 'Server Disconnected';
  if (serverStatus === 'connected') {
    statusColor = config.bearerToken ? 'bg-crm-success' : 'bg-orange-500';
    statusTitle = config.bearerToken ? 'System Online' : 'Online - Token Missing';
  } else if (serverStatus === 'checking') {
    statusColor = 'bg-gray-400';
    statusTitle = 'Connecting...';
  }

  return (
    <div className="flex h-screen bg-crm-background text-crm-text overflow-hidden font-sans">
      <div className="w-80 flex flex-col border-r border-crm-border bg-crm-surface">
        <div className="p-4 border-b border-crm-border flex justify-between items-center bg-crm-surface">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-crm-primary" />
            <h1 className="font-bold text-lg">Instagram CRM</h1>
          </div>
          <div className="flex items-center gap-2">
             <div className="text-[10px] text-crm-textSecondary uppercase tracking-wide">
                {serverStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
             </div>
             <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`} title={statusTitle} />
          </div>
        </div>
        
        <ChatList 
          conversations={conversations} 
          activeId={activeConversationId} 
          onSelect={setActiveConversationId} 
        />
        
        <SettingsPanel 
          config={config} 
          onSave={handleSaveSettings}
          onTestLoopback={handleTestLoopback}
          onFetchServerLogs={handleFetchServerLogs}
        />
      </div>

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