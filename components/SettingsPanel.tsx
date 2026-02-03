import React, { useState, useEffect } from 'react';
import { Save, Info } from 'lucide-react';
import { CrmConfig } from '../types';

interface SettingsPanelProps {
  config: CrmConfig;
  onSave: (config: CrmConfig) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave }) => {
  const [localConfig, setLocalConfig] = useState<CrmConfig>(config);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    setLocalConfig(config);
    setWebhookUrl(window.location.origin + '/api/webhook');
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localConfig);
  };

  return (
    <div className="border-t border-crm-border p-4 bg-crm-surface">
      <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-crm-textSecondary">Configuration</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-crm-textSecondary mb-1">Instagram App ID</label>
          <input
            type="text"
            name="appId"
            value={localConfig.appId}
            onChange={handleChange}
            className="w-full bg-crm-background border border-crm-border rounded px-2 py-1 text-sm text-crm-text focus:outline-none focus:border-crm-primary"
            placeholder="App ID"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-crm-textSecondary mb-1">Page Access Token</label>
          <input
            type="password"
            name="bearerToken"
            value={localConfig.bearerToken}
            onChange={handleChange}
            className="w-full bg-crm-background border border-crm-border rounded px-2 py-1 text-sm text-crm-text focus:outline-none focus:border-crm-primary"
            placeholder="Token"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-crm-textSecondary mb-1">Webhook Verify Token</label>
          <input
            type="text"
            name="webhookToken"
            value={localConfig.webhookToken}
            onChange={handleChange}
            className="w-full bg-crm-background border border-crm-border rounded px-2 py-1 text-sm text-crm-text focus:outline-none focus:border-crm-primary"
            placeholder="Verify Token"
          />
          <div className="mt-1 flex items-start gap-1 text-[10px] text-crm-textSecondary">
            <Info size={10} className="mt-0.5 flex-shrink-0" />
            <span>Must match <strong>WEBHOOK_VERIFY_TOKEN</strong> in Cloudflare settings. Default: <code>instagram_crm_verify_token</code></span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-crm-textSecondary mb-1">Webhook URL (Read-only)</label>
          <div className="w-full bg-crm-background border border-crm-border rounded px-2 py-1 text-xs text-crm-textSecondary break-all select-all">
            {webhookUrl}
          </div>
        </div>
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-crm-primary hover:bg-crm-primaryHover text-white py-2 rounded text-sm font-medium transition-colors"
        >
          <Save size={16} />
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default SettingsPanel;