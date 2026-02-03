import React, { useEffect, useState } from 'react';
import { LogEntry } from '../types';
import { api } from '../services/api';
import { RefreshCw, ArrowDownLeft, ArrowUpRight, Activity } from 'lucide-react';

export const LogPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.fetchLogs();
      // Sort newest first
      setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Auto-refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 bg-slate-900 text-slate-200 p-4 overflow-hidden flex flex-col font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-lg">Server Debug Logs</h2>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-700 bg-slate-950 shadow-inner">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800 text-slate-400 text-xs sticky top-0">
                <tr>
                    <th className="p-3 font-medium">Time</th>
                    <th className="p-3 font-medium">Direction</th>
                    <th className="p-3 font-medium">Details</th>
                    <th className="p-3 font-medium text-right">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">No logs available</td>
                    </tr>
                ) : (
                    logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-900/50 transition-colors group">
                            <td className="p-3 whitespace-nowrap text-slate-500 text-xs">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="p-3">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    log.direction === 'INCOMING_WEBHOOK' 
                                    ? 'bg-emerald-950 text-emerald-400 border-emerald-900' 
                                    : 'bg-blue-950 text-blue-400 border-blue-900'
                                }`}>
                                    {log.direction === 'INCOMING_WEBHOOK' ? <ArrowDownLeft className="w-3 h-3"/> : <ArrowUpRight className="w-3 h-3"/>}
                                    {log.direction === 'INCOMING_WEBHOOK' ? 'IN' : 'OUT'}
                                </span>
                            </td>
                            <td className="p-3 max-w-xl">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-300">{log.method}</span>
                                        <span className="text-slate-400 truncate" title={log.url}>{log.url}</span>
                                    </div>
                                    <details className="group/details">
                                        <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-indigo-400 list-none flex items-center gap-1">
                                            <span className="group-open/details:hidden">▶ Show Payload</span>
                                            <span className="hidden group-open/details:inline">▼ Hide Payload</span>
                                        </summary>
                                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {log.requestBody && (
                                                <div className="bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto">
                                                    <div className="text-[10px] text-slate-500 mb-1">Request</div>
                                                    <pre className="text-[10px] text-slate-400">{log.requestBody.slice(0, 300) + (log.requestBody.length > 300 ? '...' : '')}</pre>
                                                </div>
                                            )}
                                             {log.responseBody && (
                                                <div className="bg-slate-900 p-2 rounded border border-slate-800 overflow-x-auto">
                                                    <div className="text-[10px] text-slate-500 mb-1">Response</div>
                                                    <pre className="text-[10px] text-slate-400">{log.responseBody.slice(0, 300) + (log.responseBody.length > 300 ? '...' : '')}</pre>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                </div>
                            </td>
                            <td className="p-3 text-right">
                                <span className={`font-mono font-bold ${log.status >= 400 ? 'text-red-400' : 'text-green-400'}`}>
                                    {log.status}
                                </span>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};
