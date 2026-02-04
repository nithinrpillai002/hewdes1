
import React, { useState, useEffect } from 'react';
import { Save, Key, MessageSquare, Sparkles, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, X, ArrowUp, ArrowDown, Cpu, Loader2, CheckCircle } from 'lucide-react';

interface Instruction {
    id: string;
    label: string;
    content: string;
    isActive: boolean;
}

const AiSettings: React.FC = () => {
  const [kieApiKey, setKieApiKey] = useState('');
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [models, setModels] = useState<string[]>(['gemini-3-flash']);
  const [newModel, setNewModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            
            // Models
            if (data.aiModels && Array.isArray(data.aiModels)) {
                setModels(data.aiModels);
            }

            // Instructions
            if (data.aiInstruction) {
                try {
                    const parsed = JSON.parse(data.aiInstruction);
                    if (Array.isArray(parsed)) {
                        setInstructions(parsed);
                    } else {
                        setInstructions([{ 
                            id: 'legacy', 
                            label: 'General Instructions', 
                            content: data.aiInstruction, 
                            isActive: true 
                        }]);
                    }
                } catch (e) {
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

  // Helper to save configuration to DB
  const persistConfig = async (overrideInstructions?: Instruction[], overrideModels?: string[], overrideKey?: string) => {
      setSaving(true);
      try {
        const body = {
            kieApiKey: overrideKey !== undefined ? overrideKey : kieApiKey,
            aiInstruction: JSON.stringify(overrideInstructions || instructions),
            aiModels: overrideModels || models
        };

        await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
      } catch (e) {
          console.error("Failed to save", e);
          alert("Failed to save changes to database.");
      } finally {
          setTimeout(() => setSaving(false), 500);
      }
  };

  // Manual save for API Key
  const handleManualSave = () => {
      persistConfig();
  };

  // --- MODEL MANAGEMENT ---
  const addModel = () => {
      if (newModel && !models.includes(newModel)) {
          const updated = [...models, newModel];
          setModels(updated);
          setNewModel('');
          persistConfig(undefined, updated);
      }
  };

  const removeModel = (index: number) => {
      const updated = [...models];
      updated.splice(index, 1);
      setModels(updated);
      persistConfig(undefined, updated);
  };

  const moveModel = (index: number, direction: 'up' | 'down') => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === models.length - 1)) return;
      const updated = [...models];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      setModels(updated);
      persistConfig(undefined, updated);
  };

  // --- INSTRUCTION MANAGEMENT ---
  const handleAddOrUpdateInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInstruction.label || !currentInstruction.content) return;

    let updatedInstructions: Instruction[];

    if (editingId) {
        updatedInstructions = instructions.map(inst => 
            inst.id === editingId ? { ...inst, ...currentInstruction } as Instruction : inst
        );
    } else {
        const newInst: Instruction = {
            id: Date.now().toString(),
            label: currentInstruction.label!,
            content: currentInstruction.content!,
            isActive: true
        };
        updatedInstructions = [...instructions, newInst];
    }

    setInstructions(updatedInstructions);
    setShowModal(false);
    setEditingId(null);
    setCurrentInstruction({ label: '', content: '', isActive: true });
    
    // Auto-save to DB
    persistConfig(updatedInstructions);
  };

  const openEditModal = (instruction: Instruction) => {
    setEditingId(instruction.id);
    setCurrentInstruction({ 
        label: instruction.label, 
        content: instruction.content, 
        isActive: instruction.isActive 
    });
    setShowModal(true);
  };

  const deleteInstruction = (id: string) => {
      if (confirm('Are you sure you want to delete this instruction block?')) {
        const updated = instructions.filter(i => i.id !== id);
        setInstructions(updated);
        persistConfig(updated);
      }
  };

  const toggleInstruction = (id: string) => {
      const updated = instructions.map(inst => 
        inst.id === id ? { ...inst, isActive: !inst.isActive } : inst
      );
      setInstructions(updated);
      persistConfig(updated);
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
            onClick={handleManualSave}
            disabled={saving}
            className={`flex items-center px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                saving 
                ? 'bg-slate-100 text-slate-500 cursor-wait' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
        >
            {saving ? (
                <>
                    <Loader2 size={18} className="mr-2 animate-spin" /> Saving...
                </>
            ) : (
                <>
                    <Save size={18} className="mr-2" /> Save Changes
                </>
            )}
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
                    <h3 className="font-bold text-slate-800 dark:text-white">API Configuration</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Access Key for KIE API</p>
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
                <p className="text-xs text-slate-400 mt-2">Click "Save Changes" after updating the API key.</p>
            </div>
        </div>

        {/* Model Hierarchy Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden p-8">
            <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Cpu size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Model Hierarchy & Fallback</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Define model priority. If the top model fails, the next one is used.</p>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700 mb-4">
                {models.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-4">No models configured. System will default to 'gemini-3-flash'.</p>
                ) : (
                    <ul className="space-y-2">
                        {models.map((model, index) => (
                            <li key={index} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
                                <div className="flex items-center">
                                    <span className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs font-bold rounded-full mr-3">
                                        {index + 1}
                                    </span>
                                    <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">{model}</span>
                                    {index === 0 && <span className="ml-3 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] uppercase font-bold rounded">Primary</span>}
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button 
                                        onClick={() => moveModel(index, 'up')} 
                                        disabled={index === 0}
                                        className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                    >
                                        <ArrowUp size={16} />
                                    </button>
                                    <button 
                                        onClick={() => moveModel(index, 'down')} 
                                        disabled={index === models.length - 1}
                                        className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                                    >
                                        <ArrowDown size={16} />
                                    </button>
                                    <div className="w-px h-4 bg-gray-200 dark:bg-slate-700 mx-1"></div>
                                    <button onClick={() => removeModel(index)} className="p-1 text-slate-400 hover:text-red-600">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex items-center space-x-2">
                <input 
                    type="text" 
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="e.g. gemini-2.5-flash"
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                    onClick={addModel}
                    disabled={!newModel}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                    Add Model
                </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
                Common models: <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">gemini-3-flash</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">gemini-3-pro</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">gemini-2.5-flash</code>
            </p>
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
                        <p className="text-sm text-slate-500 dark:text-slate-400">Define multiple rules for the AI personality. Auto-saves on change.</p>
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
