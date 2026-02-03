import React, { useState } from 'react';
import { Product } from '../types';
import { Plus, Search, Package, Clock, DollarSign, Image as ImageIcon, Trash2, Tag } from 'lucide-react';

interface ProductsProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

const Products: React.FC<ProductsProps> = ({ products, setProducts }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: 0,
    costPrice: 0,
    description: '',
    leadTime: '1-2 Days',
    inStock: true,
    category: 'Gifts'
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;

    const product: Product = {
      id: Date.now().toString(),
      name: newProduct.name,
      price: Number(newProduct.price),
      costPrice: Number(newProduct.costPrice) || 0,
      description: newProduct.description || '',
      leadTime: newProduct.leadTime || '1-2 Days',
      imageUrl: newProduct.imageUrl || `https://picsum.photos/400/400?random=${Date.now()}`,
      category: newProduct.category || 'Gifts',
      inStock: newProduct.inStock || true
    };

    setProducts(prev => [...prev, product]);
    setShowAddForm(false);
    setNewProduct({ name: '', price: 0, costPrice: 0, description: '', leadTime: '1-2 Days', inStock: true, category: 'Gifts' });
  };

  const handleDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Product Details</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage your catalog. This data powers the AI's responses.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center space-x-2 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span>Add Product</span>
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Add New Product</h3>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Close</button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Product Name</label>
                  <input 
                    required
                    type="text" 
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Personalized Mug"
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
                   <input 
                    type="text" 
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Gifts"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selling Price (₹)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      required
                      type="number" 
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cost Price (₹) <span className="text-xs font-normal text-slate-400">(Internal)</span></label>
                  <div className="relative">
                    <Tag size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="number" 
                      value={newProduct.costPrice}
                      onChange={e => setNewProduct({...newProduct, costPrice: parseFloat(e.target.value)})}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
                <textarea 
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  placeholder="Detailed description of the product..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Lead Time (Shipment)</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      value={newProduct.leadTime}
                      onChange={e => setNewProduct({...newProduct, leadTime: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 2-3 Business Days"
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">AI uses this to answer "When will it ship?"</p>
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Image URL</label>
                   <div className="relative">
                    <ImageIcon size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                      type="text" 
                      value={newProduct.imageUrl}
                      onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="https://..."
                    />
                   </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-6 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg font-medium">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-slate-600">
            <Package size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No products added yet. Add your first product to train the AI.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              <div className="h-48 overflow-hidden relative group">
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold shadow-sm text-slate-800 dark:text-white">
                  ₹{product.price.toLocaleString('en-IN')}
                </div>
                {product.costPrice && (
                    <div className="absolute top-3 left-3 bg-slate-900/50 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        Cost: ₹{product.costPrice.toLocaleString('en-IN')}
                    </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">{product.name}</h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-2 flex-1">{product.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <Clock size={14} className="mr-2" />
                    <span>Lead Time: <span className="font-semibold text-slate-700 dark:text-slate-300">{product.leadTime}</span></span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <Package size={14} className="mr-2" />
                    <span>In Stock: <span className={`font-semibold ${product.inStock ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{product.inStock ? 'Yes' : 'No'}</span></span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-50 dark:border-slate-700 flex justify-end">
                  <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-sm flex items-center">
                    <Trash2 size={16} className="mr-1" /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;