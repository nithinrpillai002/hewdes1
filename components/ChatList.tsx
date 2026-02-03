import React from 'react';
import { Conversation } from '../types';

interface ChatListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const ChatList: React.FC<ChatListProps> = ({ conversations, activeId, onSelect }) => {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-crm-textSecondary p-4 text-center text-sm">
        <p>No conversations yet.<br />Waiting for webhooks...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map(chat => (
        <div
          key={chat.id}
          onClick={() => onSelect(chat.id)}
          className={`flex items-center p-3 border-b border-crm-border cursor-pointer transition-colors ${
            activeId === chat.id ? 'bg-crm-background border-l-4 border-l-crm-primary' : 'hover:bg-crm-background border-l-4 border-l-transparent'
          }`}
        >
          <div className="flex-shrink-0 mr-3">
            <img 
              src={chat.profilePic} 
              alt={chat.name} 
              className="w-12 h-12 rounded-full object-cover border border-crm-border"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-crm-text truncate">{chat.name}</h4>
            <p className="text-xs text-crm-textSecondary truncate">{chat.lastMessage || 'No messages'}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatList;