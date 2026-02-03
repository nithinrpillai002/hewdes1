import React, { useState, useRef, useEffect } from 'react';
import { Send, Instagram } from 'lucide-react';
import { Conversation } from '../types';

interface ChatWindowProps {
  conversation: Conversation | null;
  onSendMessage: (text: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversation, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-crm-background text-crm-textSecondary h-full">
        <div className="bg-crm-surface p-6 rounded-full mb-4 shadow-sm">
          <Instagram size={48} className="text-crm-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2 text-crm-text">Instagram CRM</h2>
        <p className="max-w-md text-center">Select a conversation from the sidebar to start messaging.</p>
        <p className="mt-4 text-xs bg-crm-surface px-3 py-1 rounded border border-crm-border">
          Use <code>simulateWebhook()</code> in console to test
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-crm-background relative">
      {/* Header */}
      <div className="bg-crm-surface border-b border-crm-border p-4 flex items-center shadow-sm z-10">
        <img 
          src={conversation.profilePic} 
          alt={conversation.name} 
          className="w-10 h-10 rounded-full object-cover mr-3 border border-crm-border"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48' }}
        />
        <div>
          <h2 className="text-lg font-bold text-crm-text">{conversation.name}</h2>
          <p className="text-xs text-crm-textSecondary">@{conversation.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.messages.length === 0 && (
          <div className="text-center text-crm-textSecondary text-sm py-10">
            No messages yet.
          </div>
        )}
        {conversation.messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex w-full ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[70%] rounded-lg px-4 py-2 shadow-sm ${
                msg.type === 'sent' 
                  ? 'bg-crm-primary text-white rounded-br-none' 
                  : 'bg-crm-surface text-crm-text border border-crm-border rounded-bl-none'
              }`}
            >
              <div className="text-sm">{msg.text}</div>
              <div className={`text-[10px] mt-1 text-right ${
                msg.type === 'sent' ? 'text-white/70' : 'text-crm-textSecondary'
              }`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-crm-surface p-4 border-t border-crm-border">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-crm-background border border-crm-border rounded-full px-4 py-2 text-crm-text focus:outline-none focus:border-crm-primary transition-colors"
          />
          <button 
            type="submit" 
            disabled={!inputText.trim()}
            className="bg-crm-primary hover:bg-crm-primaryHover text-white p-2 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;