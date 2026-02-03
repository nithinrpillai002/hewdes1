import React, { useState, useEffect } from 'react';
import { Settings } from '../types';
import { Save, AlertCircle, Key } from 'lucide-react';
import { api } from '../services/api';
import { DEFAULT_SETTINGS } from '../constants';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.fetchSettings();
      // Apply defaults if fields are missing (e.g. first load from empty KV)
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        webhookVerifyToken: data.webhookVerifyToken || DEFAULT_SETTINGS.webhookVerifyToken
      });
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to load settings. Server might be offline.' });
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.saveSettings(settings);
      setMsg({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof Settings, value: string) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;
  if (!settings) return <div className="p-8 text-center text-red-500">Error loading configuration</div>;

  return (
    <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">CRM Configuration</h2>
          
          {msg && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
              msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <AlertCircle className="w-5 h-5" />
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL (Read-only)</label>
              <input
                type="text"
                value={settings.webhookUrl}
                readOnly
                className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">Configure this in your Meta App Dashboard</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">App ID</label>
                <input
                  type="text"
                  value={settings.appId}
                  onChange={(e) => handleChange('appId', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Meta App ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verify Token</label>
                <input
                  type="text"
                  value={settings.webhookVerifyToken}
                  onChange={(e) => handleChange('webhookVerifyToken', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Your chosen secret token"
                />
                 <p className="mt-1 text-xs text-slate-500">Default: instagram-crm-verify-token</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Page Access Token</label>
              <textarea
                value={settings.pageAccessToken}
                onChange={(e) => handleChange('pageAccessToken', e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="EAA..."
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
               <div className="flex items-center gap-2 mb-2">
                 <Key className="w-4 h-4 text-indigo-600" />
                 <label className="block text-sm font-medium text-slate-700">KIE API Key</label>
               </div>
               <input
                  type="password"
                  value={settings.kieApiKey}
                  onChange={(e) => handleChange('kieApiKey', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="sk-..."
                />
                <p className="mt-1 text-xs text-slate-500">
                    Required for KIE Gemini 3 Pro. Get your key from <a href="https://kie.ai/api-key" target="_blank" className="text-indigo-600 hover:underline">kie.ai/api-key</a>.
                </p>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
