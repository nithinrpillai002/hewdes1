import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Moon, Sun, Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Server } from 'lucide-react';
import { SystemLog } from '../types';

interface SettingsProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ apiKey, setApiKey, darkMode, setDarkMode }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
        const response = await fetch('/api/logs');
        if (response.ok) {
            const data = await response.json();
            setLogs(data);
        }
    } catch (error) {
        console.error("Failed to fetch logs", error);
    } finally {
        setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
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
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Global Settings</h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Manage application-wide configurations, API keys, and system logs.</p>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
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

        {/* API Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                    <KeyRound size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">API Configurations</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Connect external services</p>
                </div>
            </div>
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-800 flex items-center">
                <ShieldCheck size={12} className="mr-1" /> Secure Storage
            </span>
            </div>
            
            <div className="p-8 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Kie API Key (Gemini 3 Flash)
                    </label>
                    <div className="relative">
                        <input 
                            type="password" 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full pl-4 pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400"
                        />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        This key powers the AI chat simulator for both WhatsApp and Instagram automation modules. 
                        Obtain your key from <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">kie.ai/api-key</a>.
                    </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
                    <strong>Note:</strong> Meta (Facebook/Instagram) credentials are configured within the specific automation modules in the CRM tab.
                </div>
            </div>
        </div>

        {/* Webhook Activity Logs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Webhook Activity Log</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Debug incoming requests from Meta</p>
                    </div>
                </div>
                <button 
                    onClick={fetchLogs}
                    disabled={loadingLogs}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                    title="Refresh Logs"
                >
                    <RefreshCw size={20} className={loadingLogs ? 'animate-spin' : ''} />
                </button>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="p-8 text-center">
                        <Server size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500 dark:text-slate-400">No logs captured yet.</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Incoming webhook requests will appear here.</p>
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