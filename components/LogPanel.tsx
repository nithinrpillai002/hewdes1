import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, onClear }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'incoming': return 'border-l-blue-500';
      case 'outgoing': return 'border-l-orange-500';
      case 'error': return 'border-l-red-500';
      default: return 'border-l-gray-300';
    }
  };

  const getTextColor = (type: string) => {
    if (type === 'error') return 'text-crm-error';
    return 'text-crm-text';
  };

  return (
    <div 
      id="logsPanel"
      className={`fixed bottom-0 right-0 w-[400px] bg-crm-surface shadow-2xl border-t border-l border-crm-border z-50 transition-all duration-300 flex flex-col ${isCollapsed ? 'h-10' : 'h-[300px]'}`}
    >
      <div 
        className="flex items-center justify-between p-2 bg-crm-background border-b border-crm-border cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-crm-textSecondary flex items-center gap-2">
          System Logs ({logs.length})
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="p-1 hover:bg-crm-border rounded text-crm-textSecondary hover:text-crm-error transition-colors"
            title="Clear logs"
          >
            <Trash2 size={12} />
          </button>
          <span className="text-crm-textSecondary">
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>
      
      {!isCollapsed && (
        <div 
          id="logsContent"
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-2 bg-crm-background font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="text-center text-crm-textSecondary py-8 italic">No logs yet...</div>
          ) : (
            logs.map(log => (
              <div 
                key={log.id} 
                className={`p-2 bg-crm-surface shadow-sm border-l-4 rounded-sm ${getBorderColor(log.type)}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-semibold ${getTextColor(log.type)}`}>{log.message}</span>
                  <span className="text-[10px] text-crm-textSecondary ml-2 whitespace-nowrap">{log.timestamp}</span>
                </div>
                {log.data && (
                  <pre className="mt-1 p-1 bg-crm-background rounded text-[10px] overflow-x-auto text-crm-textSecondary border border-crm-border">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LogPanel;