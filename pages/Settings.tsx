import React, { useEffect, useState } from 'react';
import { ShieldCheck, Moon, Sun, Activity, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Server, PlayCircle, Wifi, WifiOff, Cloud, Key } from 'lucide-react';
import { SystemLog } from '../types';

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

  // KIE API Key State
  const [kieApiKey, setKieApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
        // Pre-fill with the known key if empty, to help the user start immediately
        const existing = localStorage.getItem('kie_api_key');
        if (existing) return existing;
        return '3a748f6c1558e84cf2ca54b22c393832'; 
    }
    return '3a748f6c1558e84cf2ca54b22c393832';
  });
  const [showKey, setShowKey] = useState(false);

  // Initialize the key in local storage if not present
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('kie_api_key')) {
        localStorage.setItem('kie_api_key', '3a748f6c1558e84cf2ca54b22c393832');
    }
  }, []);

  const handleSaveKey = () => {
    localStorage.setItem('kie_api_key', kieApiKey);
    alert('API Key Saved!');
  };

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
        // Try health endpoint - routed via Netlify redirects
        const res = await fetch('/health', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
            setServerStatus('online');
        } else {
            console.warn('Server health check returned non-200:', res.status);
            setServerStatus('offline');
        }
    } catch (e) {
        console.error('Server health check connection failed:', e);
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
            id: "17841400000000",
            time: Date.now(),
            messaging: [{
                sender: { id: "123456789" },
                recipient: { id: "987654321" },
                message: { text: "Do you have this mug in red?" }
            }]
        }]
    };

    if (serverStatus === 'online') {
        // Send to real local server / Netlify function
        try {
            await fetch('/webhook/instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockPayload)
            });
            // Refresh logs to show the new entry
            await fetchLogs();
        } catch (e) {
            console.error("Simulation failed", e);
        }
    } else {
        // Fallback: Create a fake local log so the user sees UI interaction
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
    
    // Periodically check server status every 30 seconds
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

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return <CheckCircle size={14} className="mr-1" />;
    return <XCircle size={14} className="mr-1" />;
  };

  return (
    <div className="p-8 h-full max-w-4xl mx-auto overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Global Settings</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage application-wide configurations.</p>
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

      <div className="space-y-6">
        
        {/* AI Configuration */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
             <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Key size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">AI Configuration (KIE API)</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your connection to Gemini 3 Flash</p>
                    </div>
                </div>
            </div>
            <div className="p-8">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">KIE API Key</label>
                <div className="flex space-x-2">
                    <div className="relative flex-1">
                        <input 
                            type={showKey ? "text" : "password"}
                            value={kieApiKey}
                            onChange={(e) => setKieApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-indigo-600"
                        >
                            {showKey ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <button 
                        onClick={handleSaveKey}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                        Save Key
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                    Get your key from <a href="https://kie.ai/api-key" target="_blank" className="text-indigo-500 hover:underline">kie.ai/api-key</a>. This key is stored locally in your browser and sent securely to the backend.
                </p>
            </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400 rounded-lg">
                    {darkMode ? <Moon size={24} /> : <Sun size={24} />}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Appearance</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Customize how the app looks</p>
                </div>
            </div>
            </div>
            
            <div className="p-8 flex items-center justify-between">
                <div>
                    <p className="font-medium text-slate-800 dark:text-white">Dark Mode</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Reduce eye strain in low-light environments</p>
                </div>
                <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${darkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        {/* System Activity & API Logs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">System Activity & API Logs</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Outgoing chats and incoming webhooks</p>
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
                        title="Refresh Logs"
                    >
                        <RefreshCw size={20} className={loadingLogs ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 text-center border-b border-blue-100 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-300 flex items-center justify-center">
                        <Cloud size={12} className="mr-1"/> 
                        Note: On Netlify, these logs may reset after inactivity due to Serverless function restarts.
                    </p>
                </div>

                {logs.length === 0 ? (
                    <div className="p-8 text-center">
                        <Server size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500 dark:text-slate-400">No logs captured yet.</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {serverStatus === 'offline' 
                                ? "Server is offline. Use 'Simulate Event' to test the UI." 
                                : "Incoming webhook requests and chat logs will appear here."}
                        </p>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="group">
                            <div 
                                onClick={() => toggleLog(log.id)}
                                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={`w-2 h-2 rounded-full ${log.status >= 200 && log.status < 300 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{log.method}</span>
                                            <h4 className="font-medium text-slate-800 dark:text-white text-sm capitalize">{log.outcome}</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {new Date(log.timestamp).toLocaleTimeString()} • <span className="capitalize">{log.source}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className={`flex items-center px-2 py-1 rounded text-xs font-bold border ${getStatusColor(log.status)}`}>
                                        {getStatusIcon(log.status)}
                                        {log.status}
                                    </div>
                                    {expandedLogId === log.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                </div>
                            </div>
                            
                            {expandedLogId === log.id && (
                                <div className="px-10 pb-4 bg-slate-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
                                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 overflow-hidden">
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Request Payload</p>
                                        <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
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
  );
};

export default Settings;