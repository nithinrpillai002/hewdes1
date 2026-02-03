import React from 'react';
import { Construction, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';

const Analytics: React.FC = () => {
  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Analytics Dashboard</h2>
      
      {/* Mock Stats to show layout intent */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 opacity-50 pointer-events-none select-none">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
              <DollarSign size={24} />
            </div>
            <span className="text-green-600 dark:text-green-400 text-sm font-bold">+12.5%</span>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Profit</h3>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">₹14,250.00</p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
              <TrendingUp size={24} />
            </div>
            <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">Last 30 Days</span>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Ad Spend (FB + GST)</h3>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">₹3,420.50</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
              <ShoppingCart size={24} />
            </div>
            <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">+5.2%</span>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Product Sales</h3>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">842 Units</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center p-10">
        <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full mb-6 text-amber-600 dark:text-amber-400">
            <Construction size={48} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Under Development</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          We are currently integrating with Facebook Ads Manager and your payment gateway to bring real-time analytics. Check back soon!
        </p>
      </div>
    </div>
  );
};

export default Analytics;