import React from 'react';
import { Page } from '../types';
import { LayoutDashboard, MessageSquareText, ShoppingBag, Settings, LogOut, Gift } from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const navItems = [
    { id: Page.ANALYTICS, label: 'Analytics', icon: LayoutDashboard },
    { id: Page.CRM, label: 'CRM Automation', icon: MessageSquareText },
    { id: Page.PRODUCTS, label: 'Product Details', icon: ShoppingBag },
  ];

  return (
    <div className="w-64 bg-white dark:bg-slate-800 h-screen border-r border-gray-200 dark:border-slate-700 flex flex-col fixed left-0 top-0 z-10 shadow-sm transition-colors duration-200">
      <div className="p-6 flex items-center space-x-3 border-b border-gray-100 dark:border-slate-700">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
          <Gift size={24} />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-slate-800 dark:text-white">Hewdes Gifts</h1>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Admin Panel</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
              <span>{item.label}</span>
              {item.id === Page.ANALYTICS && (
                <span className="ml-auto text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-0.5 px-2 rounded-full font-medium">DEV</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-slate-700 space-y-2">
        <button 
            onClick={() => onNavigate(Page.SETTINGS)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                currentPage === Page.SETTINGS 
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-medium' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>

        <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors">
          <LogOut size={20} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;