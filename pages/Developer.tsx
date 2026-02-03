
import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, Globe, Server, AlertTriangle, CheckCircle, RefreshCw, Activity, Terminal, User, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { SystemLog } from '../types';

const Developer: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Poll for logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/logs');
        if (response.ok) {
          const data = await response.json();
          setLogs(data);
        }
      } catch (error) {
        console.error("Failed to fetch traffic logs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getLogStyle = (log: SystemLog) => {
    // Incoming Webhooks
    if (log.path.includes('webhook') && log.method === 'POST') {
      return {
        icon: ArrowDown,
        color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
        label: 'INPUT',
        border: 'border-l-4 border-l-blue-500'
      };
    }
    // Outgoing to Graph API
    if (log.path.includes('graph.facebook.com') && log.method === 'POST') {
      return {
        icon: ArrowUp,
        color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
        label: 'OUTPUT',
        border: 'border-l-4 border-l-purple-500'
      };
    }
    // Internal Profile Fetch
    if (log.path.includes('graph.instagram.com') && log.method === 'GET') {
      return {
        icon: User,
        color: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
        label: 'PROFILE GET',
        border: 'border-l-4 border-l-slate-400'
      };
    }
    // Default
    return {
      icon: Activity,
      color: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
      label: 'SYSTEM',
      border: 'border-l-4 border-l-gray-300'
    };
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      
      {/* HEADER */}
      <div className="px-8 py-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Activity size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        Live Traffic Monitor
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Real-time view of API inputs, profile fetches, and outgoing responses.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <span className={`w-2 h-2 rounded-full ${loading ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
                 <span className="text-xs font-mono text-slate-400">{loading ? 'LIVE' : 'POLLING'}</span>
            </div>
        </div>
      </div>

      {/* LOG LIST */}
      <div className="flex-1 overflow-y-auto p-6">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Server size={48} className="mb-4 opacity-20" />
            <p>No traffic detected yet. Waiting for messages...</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-5xl mx-auto">
            {logs.map((log) => {
              const style = getLogStyle(log);
              const Icon = style.icon;
              const isError = log.status >= 400;

              return (
                <div 
                  key={log.id} 
                  className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden transition-all ${style.border} ${isError ? 'ring-2 ring-red-500/20' : ''}`}
                >
                  <div 
                    onClick={() => toggleLog(log.id)}
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    {/* Icon Box */}
                    <div className={`p-3 rounded-full shrink-0 ${style.color}`}>
                      <Icon size={20} />
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${isError ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                           {style.label}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                           {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                        {log.outcome}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5" title={log.path}>
                        {log.method} {log.path}
                      </p>
                    </div>

                    {/* Status Code */}
                    <div className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold font-mono ${
                      isError 
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {isError ? <AlertTriangle size={14} className="mr-1.5" /> : <CheckCircle size={14} className="mr-1.5" />}
                      {log.status === 0 ? '---' : log.status}
                    </div>

                    <div className="text-slate-400">
                        {expandedLogId === log.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedLogId === log.id && (
                    <div className="border-t border-gray-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center">
                                    <Terminal size={12} className="mr-1"/> Payload Data
                                </h4>
                                <div className="bg-white dark:bg-slate-950 rounded border border-gray-200 dark:border-slate-800 p-3 overflow-x-auto">
                                    <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                        {JSON.stringify(log.payload, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Developer;
