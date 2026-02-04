
import React, { useState, useEffect } from 'react';
import { Save, Key, MessageSquare, Sparkles, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, X } from 'lucide-react';

interface Instruction {
    id: string;
    label: string;
    content: string;
    isActive: boolean;
}

const AiSettings: React.FC = () => {
  const [kieApiKey, setKieApiKey] = useState('');
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<Partial<Instruction>>({ label: '', content: '', isActive: true });
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            setKieApiKey(data.kieApiKey || '');
            
            // Handle parsing of instructions which might be string or JSON array
            if (data.aiInstruction) {
                try {
                    const parsed = JSON.parse(data.aiInstruction);
                    if (Array.isArray(parsed)) {
                        setInstructions(parsed);
                    } else {
                        // Legacy single string support
                        setInstructions([{ 
                            id: 'legacy', 
                            label: 'General Instructions', 
                            content: data.aiInstruction, 
                            isActive: true 
                        }]);
                    }
                } catch (e) {
                     // Plain text string support
                     setInstructions([{ 
                        id: 'legacy', 
                        label: 'General Instructions', 
                        content: data.aiInstruction, 
                        isActive: true 
                    }]);
                }
            }
        }
    } catch (e) {
        console.error("Failed to load config", e);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    try {
        await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                kieApiKey: kieApiKey,
                aiInstruction: JSON.stringify(instructions)
            })
        });
        alert('AI Settings & Instructions Saved!');
    } catch (e) {
        console.error("Failed to sync config to server", e);
        alert('Failed to save settings.');
    }
  };

  const handleAddOrUpdateInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInstruction.label || !currentInstruction.content) return;

    if (editingId) {
        setInstructions(prev => prev.map(inst => 
            inst.id === editingId ? { ...inst, ...currentInstruction } as Instruction : inst
        ));
    } else {
        const newInst: Instruction = {
            id: Date.now().toString(),
            label: currentInstruction.label!,
            content: currentInstruction.content!,
            isActive: true
        };
        setInstructions(prev => [...prev, newInst]);
    }
    setShowModal(false);
    setEditingId(null);
    setCurrentInstruction({ label: '', content: '', isActive: true });
  };

  const openEditModal = (inst: Instruction) => {
      setEditingId(inst.id);
      setCurrentInstruction({ label: inst.label, content: inst.content, isActive: inst.isActive });
      setShowModal(true);
  };

  const deleteInstruction = (id: string) => {
      if (confirm('Are you sure you want to delete this instruction block?')) {
        setInstructions(prev => prev.filter(i => i.id !== id));
      }
  };

  const toggleInstruction = (id: string) => {
      setInstructions(prev => prev.map(inst => 
        inst.id === id ? { ...inst, isActive: !inst.isActive } : inst
      ));
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Configuration...</div>;

  return (
    <div className="p-8 h-full max-w-4xl mx-auto overflow-y-auto pb-24">
      <div className="flex justify-between items-end mb-8">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">AI Settings</h2>
            <p className="text-slate-500 dark:text-slate-400">Configure your AI Sales Persona and Model.</p>
        </div>
        <button 
            onClick={handleSaveAll}
            className="flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
            <Save size={18} className="mr-2" /> Save Changes
        </button>
      </div>

      <div className="space-y-8">
        {/* API Key Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-sm overflow-hidden p-8">
             <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Sparkles size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Model Configuration</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Gemini 3 Flash via KIE API</p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">KIE API Key</label>
                <div className="relative">
                    <Key size={16} className="absolute left-3 top-3 text-slate-400" />
                    <input 
                        type={showKey ? "text" : "password"}
                        value={kieApiKey}
                        onChange={(e) => setKieApiKey(e.target.value)}
                        placeholder="Paste your KIE API Key here..."
                        className="w-full pl-10 pr-16 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-2.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase">
                        {showKey ? 'Hide' : 'Show'}
                    </button>
                </div>
            </div>
        </div>

        {/* Instructions Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden p-8">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400 rounded-lg">
                        <MessageSquare size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Custom Instructions</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Define multiple rules for the AI personality.</p>
                    </div>
                </div>
                <button 
                    onClick={() => {
                        setEditingId(null);
                        setCurrentInstruction({ label: '', content: '', isActive: true });
                        setShowModal(true);
                    }}
                    className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-colors"
                >
                    <Plus size={16} className="mr-1" /> Add Instruction
                </button>
            </div>

            {instructions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                    <p className="text-slate-400 text-sm">No custom instructions added yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {instructions.map(inst => (
                        <div key={inst.id} className={`border rounded-xl p-4 transition-all ${inst.isActive ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-slate-700 opacity-60'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => toggleInstruction(inst.id)} className="text-indigo-600 dark:text-indigo-400 focus:outline-none">
                                        {inst.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-slate-400" />}
                                    </button>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{inst.label}</h4>
                                </div>
                                <div className="flex space-x-1">
                                    <button onClick={() => openEditModal(inst)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => deleteInstruction(inst.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 ml-10 line-clamp-2">{inst.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{editingId ? 'Edit Instruction' : 'Add New Instruction'}</h3>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                          <X size={20} />
                      </button>
                  </div>
                  <form onSubmit={handleAddOrUpdateInstruction} className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Label / Title</label>
                          <input 
                              type="text" 
                              required
                              value={currentInstruction.label}
                              onChange={e => setCurrentInstruction({...currentInstruction, label: e.target.value})}
                              placeholder="e.g. Tone of Voice, Refund Policy"
                              className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Instruction Content</label>
                          <textarea 
                              required
                              value={currentInstruction.content}
                              onChange={e => setCurrentInstruction({...currentInstruction, content: e.target.value})}
                              placeholder="e.g. Always be polite and use emojis. If asked about refunds, say..."
                              className="w-full px-4 py-2 border border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none"
                          />
                      </div>
                      <div className="flex justify-end pt-2">
                          <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg mr-2 font-medium text-sm">Cancel</button>
                          <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md">
                              {editingId ? 'Update' : 'Add'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default AiSettings;
