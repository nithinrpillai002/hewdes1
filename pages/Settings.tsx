
import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Moon, Sun, Activity, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Server, PlayCircle, Wifi, WifiOff, Cloud, Download, FileJson, Container, Github, GitBranch, Loader2, AlertCircle } from 'lucide-react';
import { SystemLog } from '../types';

interface SettingsProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ apiKey, setApiKey, darkMode, setDarkMode }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Server Status State
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [simulating, setSimulating] = useState(false);

  // GitHub State
  const [githubConfig, setGithubConfig] = useState({
    token: '',
    owner: '',
    repo: ''
  });
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<{success: boolean; message: string} | null>(null);

  // Load GitHub config from local storage
  useEffect(() => {
    const saved = localStorage.getItem('github_config');
    if (saved) {
      setGithubConfig(JSON.parse(saved));
    }
  }, []);

  // Save GitHub config to local storage
  useEffect(() => {
    localStorage.setItem('github_config', JSON.stringify(githubConfig));
  }, [githubConfig]);

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
        // Try health endpoint
        const res = await fetch('/health', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
            setServerStatus('online');
        } else {
            console.warn('Server health check returned non-200:', res.status);
            setServerStatus('offline');
        }
    } catch (e) {
        console.error('Server health check connection failed:', e);
        setServerStatus('offline');
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
        const response = await fetch('/api/logs');
        if (response.ok) {
            const data = await response.json();
            setLogs(data);
            setServerStatus('online');
        } else {
            // If API logs fail, server might still be up but erroring
            checkServerStatus(); 
        }
    } catch (error) {
        console.error("Failed to fetch logs", error);
        setServerStatus('offline');
    } finally {
        setLoadingLogs(false);
    }
  };

  const simulateWebhook = async () => {
    setSimulating(true);
    const mockPayload = {
        object: "instagram",
        entry: [{
            id: "17841400000000",
            time: Date.now(),
            messaging: [{
                sender: { id: "123456789" },
                recipient: { id: "987654321" },
                message: { text: "Do you have this mug in red?" }
            }]
        }]
    };

    if (serverStatus === 'online') {
        // Send to real local server
        try {
            await fetch('/webhook/instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mockPayload)
            });
            // Refresh logs to show the new entry
            await fetchLogs();
        } catch (e) {
            console.error("Simulation failed", e);
        }
    } else {
        // Fallback: Create a fake local log so the user sees UI interaction
        const fakeLog: SystemLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            method: 'POST',
            path: '/webhook/instagram',
            status: 200,
            outcome: 'Event Received (Simulated)',
            source: 'instagram',
            payload: mockPayload
        };
        setLogs(prev => [fakeLog, ...prev]);
    }
    
    setTimeout(() => setSimulating(false), 500);
  };

  const handleGithubPush = async () => {
    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
        setPushStatus({ success: false, message: 'Please fill in all GitHub fields.' });
        return;
    }

    setIsPushing(true);
    setPushStatus(null);

    try {
        const response = await fetch('/api/github/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: githubConfig.token,
                owner: githubConfig.owner,
                repo: githubConfig.repo,
                message: `Update from CRM Settings - ${new Date().toLocaleString()}`
            })
        });

        // Safe parsing to handle non-JSON errors (like 413 Payload Too Large)
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Server response was not JSON:', text);
            // Attempt to extract helpful error from HTML
            if (text.includes('PayloadTooLargeError')) {
                throw new Error('Upload too large. The server body limit might be too small.');
            }
            throw new Error(`Server returned unexpected response (${response.status}). Check console.`);
        }

        if (response.ok) {
            setPushStatus({ success: true, message: `Successfully pushed code to ${githubConfig.owner}/${githubConfig.repo}` });
        } else {
            setPushStatus({ success: false, message: data.error || 'Failed to push code.' });
        }
    } catch (error: any) {
        setPushStatus({ success: false, message: error.message || 'Network error during push.' });
    } finally {
        setIsPushing(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
    fetchLogs();
    
    // Periodically check server status every 30 seconds
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (status >= 400) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
  };

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return <CheckCircle size={14} className="mr-1" />;
    return <XCircle size={14} className="mr-1" />;
  };

  // --- DEPLOYMENT GENERATOR LOGIC ---
  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadDockerfile = () => {
    const content = `# Use official Node.js runtime
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app source
COPY . .

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]`;
    downloadFile('Dockerfile', content);
  };

  const handleDownloadCloudBuild = () => {
    const content = `steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-docker.pkg.dev/$PROJECT_ID/hewdes-repo/hewdes-crm:latest', '.']

  # Push the container image to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-docker.pkg.dev/$PROJECT_ID/hewdes-repo/hewdes-crm:latest']

  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'hewdes-crm-service'
      - '--image'
      - 'us-docker.pkg.dev/$PROJECT_ID/hewdes-repo/hewdes-crm:latest'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

images:
  - 'us-docker.pkg.dev/$PROJECT_ID/hewdes-repo/hewdes-crm:latest'`;
    downloadFile('cloudbuild.yaml', content);
  };

  return (
    <div className="p-8 h-full max-w-4xl mx-auto overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Global Settings</h2>
            <p className="text-slate-500 dark:text-slate-400">Manage application-wide configurations.</p>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              serverStatus === 'online' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 border-green-200 dark:border-green-800' 
              : serverStatus === 'checking'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 border-yellow-200 dark:border-yellow-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 border-red-200 dark:border-red-800'
          }`}>
              {serverStatus === 'online' ? <Wifi size={14} /> : serverStatus === 'checking' ? <RefreshCw size={14} className="animate-spin" /> : <WifiOff size={14} />}
              <span className="uppercase">
                {serverStatus === 'online' ? 'Backend Online' : serverStatus === 'checking' ? 'Connecting...' : 'Backend Offline'}
              </span>
          </div>
      </div>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    {darkMode ? <Moon size={24} /> : <Sun size={24} />}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Appearance</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Customize how the app looks</p>
                </div>
            </div>
            </div>
            
            <div className="p-8 flex items-center justify-between">
                <div>
                    <p className="font-medium text-slate-800 dark:text-white">Dark Mode</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Reduce eye strain in low-light environments</p>
                </div>
                <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${darkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        {/* API Settings */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                    <KeyRound size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">API Configurations</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Connect external services</p>
                </div>
            </div>
            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-800 flex items-center">
                <ShieldCheck size={12} className="mr-1" /> Secure Storage
            </span>
            </div>
            
            <div className="p-8 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Kie API Key (Gemini 3 Flash)
                    </label>
                    <div className="relative">
                        <input 
                            type="password" 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full pl-4 pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm text-slate-900 dark:text-white placeholder-slate-400"
                        />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        This key powers the AI chat simulator.
                    </p>
                </div>
            </div>
        </div>

        {/* GitHub Integration */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white rounded-lg">
                        <Github size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">GitHub Integration</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Backup and sync app code</p>
                    </div>
                </div>
            </div>
            
            <div className="p-8 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start space-x-3 mb-4">
                    <AlertCircle size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                        Enter your Personal Access Token (Classic) with <strong>repo</strong> scope. This allows the app to commit changes directly to your repository.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Repo Owner / Username
                        </label>
                        <input 
                            type="text"
                            value={githubConfig.owner}
                            onChange={(e) => setGithubConfig({...githubConfig, owner: e.target.value})}
                            placeholder="e.g. hewdes"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Repository Name
                        </label>
                        <input 
                            type="text"
                            value={githubConfig.repo}
                            onChange={(e) => setGithubConfig({...githubConfig, repo: e.target.value})}
                            placeholder="e.g. crm-app"
                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Personal Access Token
                    </label>
                    <input 
                        type="password"
                        value={githubConfig.token}
                        onChange={(e) => setGithubConfig({...githubConfig, token: e.target.value})}
                        placeholder="ghp_..."
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="pt-2">
                    {pushStatus && (
                        <div className={`mb-4 p-3 rounded-lg text-xs flex items-center ${pushStatus.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                            {pushStatus.success ? <CheckCircle size={14} className="mr-2" /> : <AlertCircle size={14} className="mr-2" />}
                            {pushStatus.message}
                        </div>
                    )}
                    
                    <button 
                        onClick={handleGithubPush}
                        disabled={isPushing || !githubConfig.token}
                        className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 py-3 rounded-xl font-bold flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPushing ? (
                            <>
                                <Loader2 size={18} className="animate-spin mr-2" />
                                Pushing Code...
                            </>
                        ) : (
                            <>
                                <GitBranch size={18} className="mr-2" />
                                Push Latest Code to GitHub
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>

        {/* Server Deployment Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Cloud size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Cloud Deployment</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Docker & Google Cloud Run Setup</p>
                    </div>
                </div>
            </div>
            
            <div className="p-8">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center space-x-3 mb-3">
                            <Container size={20} className="text-blue-600 dark:text-blue-400" />
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Dockerfile</h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 h-8">
                            Standard Docker configuration for Node.js apps. Ready for local build or cloud.
                        </p>
                        <button 
                            onClick={handleDownloadDockerfile}
                            className="w-full py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-500 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                        >
                            <Download size={14} className="mr-2" /> Download Dockerfile
                        </button>
                    </div>

                    <div className="flex-1 p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center space-x-3 mb-3">
                            <FileJson size={20} className="text-orange-600 dark:text-orange-400" />
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Artifact Registry Config</h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 h-8">
                            Cloud Build YAML for pushing to <code>us-docker.pkg.dev</code>.
                        </p>
                        <button 
                            onClick={handleDownloadCloudBuild}
                            className="w-full py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:border-orange-500 dark:hover:border-orange-500 text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                        >
                            <Download size={14} className="mr-2" /> Download yaml
                        </button>
                    </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-xs border border-blue-100 dark:border-blue-800">
                    <strong>Deployment Tip:</strong> To use `us-docker.pkg.dev`, create a repository in Google Artifact Registry named `hewdes-repo` (or update the yaml) and run: <code className="bg-white dark:bg-slate-900 px-1 py-0.5 rounded ml-1">gcloud builds submit --config cloudbuild.yaml .</code>
                </div>
            </div>
        </div>

        {/* Webhook Activity Logs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Webhook Activity Log</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Real-time incoming requests from Meta</p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={simulateWebhook}
                        disabled={simulating}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center transition-colors shadow-sm"
                        title="Simulate a fake webhook event"
                    >
                        <PlayCircle size={14} className={`mr-2 ${simulating ? 'animate-spin' : ''}`} />
                        Simulate Event
                    </button>
                    <button 
                        onClick={fetchLogs}
                        disabled={loadingLogs}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                        title="Refresh Logs"
                    >
                        <RefreshCw size={20} className={loadingLogs ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="p-8 text-center">
                        <Server size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-slate-500 dark:text-slate-400">No logs captured yet.</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {serverStatus === 'offline' 
                                ? "Server is offline. Use 'Simulate Event' to test the UI." 
                                : "Incoming webhook requests will appear here."}
                        </p>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="group">
                            <div 
                                onClick={() => toggleLog(log.id)}
                                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={`w-2 h-2 rounded-full ${log.status >= 200 && log.status < 300 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{log.method}</span>
                                            <h4 className="font-medium text-slate-800 dark:text-white text-sm capitalize">{log.outcome}</h4>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            {new Date(log.timestamp).toLocaleTimeString()} • <span className="capitalize">{log.source}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className={`flex items-center px-2 py-1 rounded text-xs font-bold border ${getStatusColor(log.status)}`}>
                                        {getStatusIcon(log.status)}
                                        {log.status}
                                    </div>
                                    {expandedLogId === log.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                </div>
                            </div>
                            
                            {expandedLogId === log.id && (
                                <div className="px-10 pb-4 bg-slate-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
                                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3 overflow-hidden">
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Request Payload</p>
                                        <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                            {JSON.stringify(log.payload, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
