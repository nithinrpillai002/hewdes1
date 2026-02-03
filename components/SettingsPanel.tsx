import React, { useState, useEffect } from 'react';
import { Save, Info, Activity, RefreshCw, Server, Send } from 'lucide-react';
import { CrmConfig } from '../types';

interface SettingsPanelProps {
  config: CrmConfig;
  onSave: (config: CrmConfig) => void;
  onTestLoopback: () => Promise<void>;
  onFetchServerLogs: () => Promise<any[]>;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onSave, onTestLoopback, onFetchServerLogs }) => {
  const [localConfig, setLocalConfig] = useState<CrmConfig>(config);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [debugLogs, setDebugLogs] = useState<any[] | null>(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

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

  const handleFetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await onFetchServerLogs();
      setDebugLogs(logs);
    } catch (e) {
      console.error(e);
      setDebugLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  return (
    <div className="border-t border-crm-border bg-crm-surface flex flex-col max-h-[50vh]">
      <div className="p-4 overflow-y-auto">
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
              <span>Must match <strong>WEBHOOK_VERIFY_TOKEN</strong> in Netlify settings. Default: <code>instagram_crm_verify_token</code></span>
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

        <div className="mt-6 pt-4 border-t border-crm-border">
          <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-crm-textSecondary flex items-center gap-2">
            <Activity size={14} /> Server Diagnostics
          </h3>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={onTestLoopback}
              className="flex flex-col items-center justify-center p-2 bg-crm-background hover:bg-crm-border border border-crm-border rounded text-crm-text transition-colors text-xs"
            >
              <Send size={16} className="mb-1 text-orange-500" />
              Test Loopback
            </button>
            <button
              onClick={handleFetchLogs}
              className="flex flex-col items-center justify-center p-2 bg-crm-background hover:bg-crm-border border border-crm-border rounded text-crm-text transition-colors text-xs"
            >
              <Server size={16} className="mb-1 text-blue-500" />
              Fetch Logs
            </button>
          </div>

          {debugLogs && (
            <div className="mt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium">Server History ({debugLogs.length})</span>
                <button onClick={() => setDebugLogs(null)} className="text-[10px] text-crm-textSecondary hover:underline">Close</button>
              </div>
              <div className="bg-crm-background border border-crm-border rounded p-2 h-40 overflow-y-auto text-[10px] font-mono">
                {isLoadingLogs ? (
                  <div className="text-center py-4">Loading...</div>
                ) : debugLogs.length === 0 ? (
                  <div className="text-center py-4 text-crm-textSecondary">No events found on server.</div>
                ) : (
                  debugLogs.map((log, i) => (
                    <div key={i} className="mb-2 pb-2 border-b border-crm-border last:border-0">
                      <div className="text-crm-primary font-bold">{log.receivedAt}</div>
                      <div className="truncate text-crm-textSecondary">{JSON.stringify(log.payload)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;