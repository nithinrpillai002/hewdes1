import React, { useState, useRef, useEffect } from 'react';
import { Thread, Message } from '../types';
import { Send, Sparkles } from 'lucide-react';

interface ChatViewProps {
  thread: Thread | null;
  onSendMessage: (text: string) => Promise<void>;
  onAnalyze: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({ thread, onSendMessage, onAnalyze }) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thread?.messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(inputText);
      setInputText('');
    } finally {
      setIsSending(false);
    }
  };

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <p className="mb-2">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-slate-200 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
            <img src={thread.igProfileImageUrl} alt={thread.igUserName} className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">{thread.igUserName}</h2>
            <p className="text-xs text-slate-500">Instagram Direct</p>
          </div>
        </div>
        <button
          onClick={onAnalyze}
          className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          AI Analysis
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {thread.messages.map((msg) => (
          <div
            key={msg.messageId}
            className={`flex w-full ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.direction === 'OUTGOING'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.direction === 'OUTGOING' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-100 text-slate-800 px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
