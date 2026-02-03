import React from 'react';
import { Thread } from '../types';
import { MessageSquare, User, Wifi, WifiOff } from 'lucide-react';

interface SidebarProps {
  threads: Thread[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  isLoading: boolean;
  isServerLive: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ threads, selectedThreadId, onSelectThread, isLoading, isServerLive }) => {
  return (
    <div className="w-full md:w-80 h-full border-r border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-slate-800">Messages</h2>
        </div>
        <div className="flex items-center gap-1.5" title={isServerLive ? "Server Connected" : "Server Disconnected"}>
            <div className={`w-2 h-2 rounded-full ${isServerLive ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-red-500 shadow-sm shadow-red-200'}`}></div>
            <span className={`text-[10px] font-medium ${isServerLive ? 'text-green-600' : 'text-red-600'}`}>
                {isServerLive ? 'LIVE' : 'OFFLINE'}
            </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading && threads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading threads...</div>
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {isServerLive ? 'No active threads found' : 'Cannot connect to server'}
          </div>
        ) : (
          <ul>
            {threads.map((thread) => (
              <li
                key={thread.threadId}
                onClick={() => onSelectThread(thread.threadId)}
                className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedThreadId === thread.threadId ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                    {thread.igProfileImageUrl ? (
                      <img src={thread.igProfileImageUrl} alt={thread.igUserName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-semibold text-slate-800 truncate text-sm">{thread.igUserName}</h3>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${selectedThreadId === thread.threadId ? 'text-indigo-700' : 'text-slate-500'}`}>
                      {thread.lastMessagePreview}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
