import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Analytics from './pages/Analytics';
import Products from './pages/Products';
import CRM from './pages/CRM';
import Settings from './pages/Settings';
import { Page, Product, AiRule } from './types';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.CRM);
  
  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    // Check local storage or system preference on initial load
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved) return JSON.parse(saved);
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);
  
  // Lifted state for Products with Indian Pricing (INR)
  const [products, setProducts] = useState<Product[]>([
    {
      id: '101',
      name: 'Custom Engraved Wooden Watch',
      price: 2499,
      costPrice: 850,
      description: 'A beautiful handcrafted wooden watch made from sustainable sandalwood. Can be engraved with a personal message.',
      leadTime: '3-5 Business Days',
      imageUrl: 'https://picsum.photos/400/400?random=1',
      category: 'Watches',
      inStock: true
    },
    {
      id: '102',
      name: 'Personalized Leather Wallet',
      price: 1299,
      costPrice: 450,
      description: 'Premium genuine leather wallet. Features 6 card slots and a cash compartment. Free name embossing available.',
      leadTime: '1-2 Business Days',
      imageUrl: 'https://picsum.photos/400/400?random=2',
      category: 'Accessories',
      inStock: true
    },
    {
      id: '103',
      name: 'Ceramic Magic Photo Mug',
      price: 499,
      costPrice: 120,
      description: 'High-quality magic mug that reveals your photo when hot liquid is poured. Dishwasher safe.',
      leadTime: '1 Day',
      imageUrl: 'https://picsum.photos/400/400?random=3',
      category: 'Home',
      inStock: false
    }
  ]);

  // Lifted state for Rules with platform specificity
  const [rules, setRules] = useState<AiRule[]>([
    { id: 'r1', type: 'instruction', content: 'Always ask for the occasion (e.g., Diwali, Birthday) to offer better suggestions.', isActive: true, platform: 'whatsapp' },
    { id: 'r2', type: 'restriction', content: 'Do not offer discounts unless explicitly authorized in the product description.', isActive: true, platform: 'whatsapp' },
    { id: 'r3', type: 'instruction', content: 'Use lots of emojis and keep the tone very casual and trendy.', isActive: true, platform: 'instagram' },
    { id: 'r4', type: 'restriction', content: 'Direct users to the bio link for purchasing.', isActive: true, platform: 'instagram' }
  ]);

  const renderPage = () => {
    switch (currentPage) {
      case Page.ANALYTICS:
        return <Analytics />;
      case Page.PRODUCTS:
        return <Products products={products} setProducts={setProducts} />;
      case Page.CRM:
        return <CRM products={products} rules={rules} setRules={setRules} />;
      case Page.SETTINGS:
        return <Settings darkMode={darkMode} setDarkMode={setDarkMode} />;
      default:
        return <CRM products={products} rules={rules} setRules={setRules} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 ml-64 h-full overflow-hidden">
        {renderPage()}
      </main>
    </div>
  );
};

export default App;