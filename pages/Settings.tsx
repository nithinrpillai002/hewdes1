
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Moon, Sun, Activity, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Server, PlayCircle, Wifi, WifiOff, Cloud, Database, Lock, Save, Eye, EyeOff, Send, Globe, Link as LinkIcon } from 'lucide-react';
import { SystemLog, PlatformCredentials } from '../types';

interface SettingsProps {
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ darkMode, setDarkMode }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Server Status State
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [simulating, setSimulating] = useState(false);

  // Platform Credentials State (Instagram Only)
  const [igCreds, setIgCreds] = useState<PlatformCredentials>(() => JSON.parse(localStorage.getItem('ig_creds') || '{"appId":"","token":"","graphVersion":"v24.0"}'));
  const [showTokens, setShowTokens] = useState(false);

  const WEBHOOK_VERIFY_TOKEN = 'hewdes_rttf0kd11o1axrmc';
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setWebhookUrl(`${window.location.origin}/webhook/instagram`);
    }
  }, []);

  const handleSaveCreds = async () => {
    if (!igCreds.graphVersion) igCreds.graphVersion = "v24.0";

    localStorage.setItem('ig_creds', JSON.stringify(igCreds));
    
    try {
        await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                igToken: igCreds.token, 
                graphVersion: igCreds.graphVersion 
            })
        });
        alert('Instagram Credentials Synced!');
    } catch (e) {
        console.error("Failed to sync config to server", e);
        alert('Credentials saved locally, but failed to sync to server.');
    }
  };

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
        const res = await fetch('/health', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
            setServerStatus('online');
        } else {
            setServerStatus('offline');
        }
    } catch (e) {
        setServerStatus('offline');
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
        const response = await fetch('/api/logs');
        if (response.ok) {
            const data = await response.json();
            setLogs(data);
            setServerStatus('online');
        } else {
            checkServerStatus(); 
        }
    } catch (error) {
        console.error("Failed to fetch logs", error);
        setServerStatus('offline');
    } finally {
        setLoadingLogs(false);
    }
  };

  const simulateWebhook = async () => {
    setSimulating(true);
    const mockPayload = {
        object: "instagram",
        entry: [{
            id: igCreds.appId || "17841400000000",
            time: Date.now(),
            messaging: [{
                sender: { id: "123456789" },
                recipient: { id: igCreds.appId || "17841400000000" },
                timestamp: Date.now(),
                message: { 
                    mid: "m_mid." + Date.now(),
                    text: "Is this product in stock?" 
                }
            }]
        }]
    };

    if (serverStatus === 'online') {
        try {
            await fetch('/webhook/instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockPayload)
            });
            setTimeout(fetchLogs, 1000); 
        } catch (e) {
            console.error("Simulation failed", e);
        }
    } else {
        const fakeLog: SystemLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            method: 'POST',
            path: '/webhook/instagram',
            status: 200,
            outcome: 'Event Received (Simulated)',
            source: 'instagram',
            payload: mockPayload
        };
        setLogs(prev => [fakeLog, ...prev]);
    }
    setTimeout(() => setSimulating(false), 500);
  };

  useEffect(() => {
    checkServerStatus();
    fetchLogs();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (status >= 400) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="p-8 h-full max-w-4xl mx-auto overflow-y-auto pb-24">
      <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Settings</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage your CRM configuration.</p>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              serverStatus === 'online' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-800' 
              : serverStatus === 'checking'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-800'
          }`}>
              {serverStatus === 'online' ? <Wifi size={14} /> : serverStatus === 'checking' ? <RefreshCw size={14} className="animate-spin" /> : <WifiOff size={14} />}
              <span className="uppercase">
                {serverStatus === 'online' ? 'Backend Online' : serverStatus === 'checking' ? 'Connecting...' : 'Backend Offline'}
              </span>
          </div>
      </div>

      <div className="space-y-8">

        {/* --- SECTION 1: GLOBAL SETTINGS --- */}
        <div>
             <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                <Globe size={20} className="mr-2 text-slate-500" />
                Platform Configuration
            </h3>

            <div className="space-y-6">
                
                {/* Response API Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                                <Send size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Instagram Response API</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Configure where the AI sends the reply.</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Graph API Version</label>
                                <select 
                                    value={igCreds.graphVersion || 'v24.0'}
                                    onChange={(e) => setIgCreds({...igCreds, graphVersion: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                >
                                    <option value="v18.0">v18.0 (Legacy)</option>
                                    <option value="v19.0">v19.0 (Stable)</option>
                                    <option value="v20.0">v20.0</option>
                                    <option value="v21.0">v21.0</option>
                                    <option value="v24.0">v24.0 (Latest)</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                            <div className="flex items-center text-slate-400 mb-2 border-b border-slate-700 pb-2">
                                <Globe size={12} className="mr-2" />
                                <span className="font-bold">OUTPUT PREVIEW</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex">
                                    <span className="text-purple-400 w-16">POST</span>
                                    <span className="text-green-400">
                                        https://graph.facebook.com/{igCreds.graphVersion || 'v24.0'}/me/messages
                                    </span>
                                </div>
                                <div className="flex">
                                    <span className="text-blue-400 w-16">Header</span>
                                    <span className="text-slate-300">Authorization: Bearer {igCreds.token ? `${igCreds.token.substring(0, 10)}...` : 'YOUR_ACCESS_TOKEN'}</span>
                                </div>
                                <div className="flex mt-2">
                                    <span className="text-yellow-400 w-16">Body</span>
                                    <span className="text-slate-300">
        {`{
        "recipient": { "id": "USER_ID" },
        "message": { "text": "Hello world!" }
        }`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Webhook Configuration */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">
                                <Database size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Webhook Integration</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Connect your Instagram App</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 space-y-6">
                        
                        {/* Webhook URL */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center">
                                <LinkIcon size={14} className="mr-2" /> Webhook Callback URL
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Paste this URL into the "Callback URL" field in the Meta App Dashboard.
                            </p>
                            <div className="flex items-center space-x-2">
                                <code className="flex-1 bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 font-mono text-sm text-indigo-600 dark:text-indigo-400">
                                    {webhookUrl || 'Loading...'}
                                </code>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        {/* Secret Key */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
                                <Lock size={14} className="mr-2" /> Webhook Secret Key
                            </h4>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
                                Paste this into the "Verify Token" field in the Meta App Dashboard.
                            </p>
                            <div className="flex items-center space-x-2">
                                <code className="flex-1 bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700 font-mono text-sm text-slate-600 dark:text-slate-300">
                                    {WEBHOOK_VERIFY_TOKEN}
                                </code>
                                <button 
                                    onClick={() => navigator.clipboard.writeText(WEBHOOK_VERIFY_TOKEN)}
                                    className="px-3 py-2 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center">
                                Instagram Graph API Credentials
                            </h4>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Page ID / App ID</label>
                                <input 
                                    type="text" 
                                    value={igCreds.appId}
                                    onChange={(e) => setIgCreds({...igCreds, appId: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Access Token</label>
                                <div className="relative">
                                    <input 
                                        type={showTokens ? "text" : "password"}
                                        value={igCreds.token}
                                        onChange={(e) => setIgCreds({...igCreds, token: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-pink-500 outline-none pr-10"
                                    />
                                    <button onClick={() => setShowTokens(!showTokens)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                                        {showTokens ? <EyeOff size={14}/> : <Eye size={14}/>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={handleSaveCreds}
                                className="flex items-center px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors"
                            >
                                <Save size={16} className="mr-2" /> Save Credentials
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Logs */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">System Activity Logs</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Inspect raw payloads</p>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button 
                                onClick={simulateWebhook}
                                disabled={simulating}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center transition-colors shadow-sm"
                                title="Simulate a fake webhook event"
                            >
                                <PlayCircle size={14} className={`mr-2 ${simulating ? 'animate-spin' : ''}`} />
                                Simulate Event
                            </button>
                            <button 
                                onClick={fetchLogs}
                                disabled={loadingLogs}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                            >
                                <RefreshCw size={20} className={loadingLogs ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
                        {logs.length === 0 ? (
                            <div className="p-8 text-center">
                                <Server size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                                <p className="text-slate-500 dark:text-slate-400">No logs captured yet.</p>
                            </div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="group">
                                    <div 
                                        onClick={() => toggleLog(log.id)}
                                        className={`p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${expandedLogId === log.id ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className={`w-2 h-2 rounded-full ${log.status >= 200 && log.status < 300 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div className="min-w-0">
                                                <div className="flex items-center space-x-2">
                                                    <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase ${log.path.includes('webhook') ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                        {log.method}
                                                    </span>
                                                    <h4 className="font-medium text-slate-800 dark:text-white text-sm truncate max-w-[200px] md:max-w-md">{log.outcome}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                                    {new Date(log.timestamp).toLocaleTimeString()} • {log.path}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className={`hidden md:flex items-center px-2 py-1 rounded text-xs font-bold border ${getStatusColor(log.status)}`}>
                                                {log.status === 200 ? <CheckCircle size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
                                                {log.status}
                                            </div>
                                            {expandedLogId === log.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </div>
                                    </div>
                                    
                                    {expandedLogId === log.id && (
                                        <div className="px-4 md:px-10 pb-4 pt-0 bg-slate-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 transition-all">
                                            <div className="mt-2 bg-white dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-700 p-0 overflow-hidden shadow-inner">
                                                <pre className="p-3 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                                    {JSON.stringify(log.payload, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
