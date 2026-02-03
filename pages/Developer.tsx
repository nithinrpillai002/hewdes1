import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Copy, Check, Terminal, FileJson, AlertCircle, User, Bot, ArrowDown, Code, Hash, Clock, Send as SendIcon, MessageSquare, Building2, Fingerprint, ArrowRight, Link as LinkIcon, Shield, Globe, Activity, Cloud, Server, Wifi } from 'lucide-react';

const DEFAULT_WEBHOOK_PAYLOAD = {
  "object": "instagram",
  "entry": [
    {
      "id": "17841400000000",
      "time": 1569262486134,
      "messaging": [
        {
          "sender": {
            "id": "1234567890"
          },
          "recipient": {
            "id": "17841400000000"
          },
          "timestamp": 1569262485349,
          "message": {
            "mid": "aWdfbWlkOjE...",
            "text": "Hello, I have a question about your product"
          }
        }
      ]
    }
  ]
};

const DEFAULT_PROFILE_RESPONSE = {
  "name": "John Doe",
  "profile_pic": "https://ui-avatars.com/api/?name=John+Doe&background=random",
  "id": "1234567890"
};

const Developer: React.FC = () => {
  // Inputs
  const [payload, setPayload] = useState(JSON.stringify(DEFAULT_WEBHOOK_PAYLOAD, null, 2));
  const [profileResponse, setProfileResponse] = useState(JSON.stringify(DEFAULT_PROFILE_RESPONSE, null, 2));
  const [accessToken, setAccessToken] = useState("EAAG...");
  const [manualUserId, setManualUserId] = useState("1234567890");
  const [graphVersion, setGraphVersion] = useState("v21.0");

  // State
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'profile'>('payload');

  // Diagnostics State
  const [healthStatus, setHealthStatus] = useState<{status: string, env: string, region: string, latency: number} | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Auto-update User ID when payload changes
  useEffect(() => {
    try {
        const parsed = JSON.parse(payload);
        const senderId = parsed.entry?.[0]?.messaging?.[0]?.sender?.id;
        if (senderId) setManualUserId(senderId);
    } catch (e) {}
  }, [payload]);

  const checkCloudRunHealth = async () => {
      setCheckingHealth(true);
      const start = Date.now();
      try {
          const res = await fetch('/api/health');
          const latency = Date.now() - start;
          if (res.ok) {
              const data = await res.json();
              setHealthStatus({ 
                  status: 'Online', 
                  env: data.environment || 'Unknown',
                  region: data.region || 'N/A',
                  latency: latency
              });
          } else {
              setHealthStatus({ status: 'Error', env: 'Unreachable', region: 'N/A', latency: latency });
          }
      } catch (e) {
          setHealthStatus({ status: 'Offline', env: 'Network Fail', region: 'N/A', latency: Date.now() - start });
      } finally {
          setCheckingHealth(false);
      }
  };

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      // Send data to server for real simulation
      const res = await fetch('/api/dev/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payload: payload,
            profileResponse: profileResponse,
            graphVersion: graphVersion,
            accessToken: accessToken
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
          throw new Error(data.error || "Server Simulation Failed");
      }
      
      setResult(data);

    } catch (e: any) {
      setResult({ error: e.message || "Invalid JSON or Logic Error" });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPayload(JSON.stringify(DEFAULT_WEBHOOK_PAYLOAD, null, 2));
    setProfileResponse(JSON.stringify(DEFAULT_PROFILE_RESPONSE, null, 2));
    setResult(null);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const FieldCard = ({ label, value, description, icon: Icon, colorClass }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-start space-x-3 mb-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group">
        <div className={`p-2 rounded-lg ${colorClass} group-hover:scale-110 transition-transform`}>
            <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
                <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-slate-500">string</span>
            </div>
            <div className="text-sm font-semibold text-slate-800 dark:text-white font-mono truncate mb-1" title={String(value)}>
                {value}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                {description}
            </p>
        </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    <Terminal className="text-indigo-500" />
                    Developer Flow
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Simulate webhook events. This injects data directly into the CRM for testing.
                </p>
            </div>
            <div className="flex space-x-3">
                <button 
                    onClick={handleReset}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center transition-colors"
                >
                    <RotateCcw size={16} className="mr-2" /> Reset
                </button>
                <button 
                    onClick={handleTest}
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md flex items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> Running...</span>
                    ) : (
                        <><Play size={18} className="mr-2 fill-current" /> Run Flow</>
                    )}
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: INPUT CONFIGURATION */}
        <div className="w-5/12 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
                <button 
                    onClick={() => setActiveTab('payload')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'payload' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <FileJson size={14} className="mr-2" /> Message Input
                </button>
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'profile' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50 dark:bg-purple-900/10' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <User size={14} className="mr-2" /> Profile Mock
                </button>
            </div>

            <div className="flex-1 relative">
                {activeTab === 'payload' ? (
                     <textarea 
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                        className="w-full h-full bg-slate-50 dark:bg-slate-900 p-6 font-mono text-sm text-slate-700 dark:text-slate-300 outline-none resize-none leading-relaxed"
                        spellCheck={false}
                    />
                ) : (
                    <div className="p-6 space-y-6 h-full overflow-y-auto">
                        
                        {/* Cloud Run Diagnostics Panel (Only visible on Profile Tab for space) */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700 mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center">
                                    <Cloud size={14} className="mr-2 text-sky-500" />
                                    Cloud Run Diagnostics
                                </h3>
                                <button 
                                    onClick={checkCloudRunHealth}
                                    disabled={checkingHealth}
                                    className="text-[10px] bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2 py-1 rounded-full font-medium flex items-center hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors"
                                >
                                    {checkingHealth ? 'Pinging...' : 'Test Connectivity'}
                                </button>
                            </div>
                            
                            {healthStatus ? (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-100 dark:border-slate-700">
                                        <span className="block text-slate-400 mb-0.5">Status</span>
                                        <span className={`font-bold ${healthStatus.status === 'Online' ? 'text-green-600' : 'text-red-600'}`}>
                                            {healthStatus.status}
                                        </span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-100 dark:border-slate-700">
                                        <span className="block text-slate-400 mb-0.5">Latency</span>
                                        <span className="font-mono text-slate-700 dark:text-slate-300">{healthStatus.latency}ms</span>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-2 rounded border border-gray-100 dark:border-slate-700 col-span-2">
                                        <span className="block text-slate-400 mb-0.5">Environment</span>
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-slate-800 dark:text-white">{healthStatus.env}</span>
                                            {healthStatus.env === 'Cloud Run' && <Check size={12} className="text-sky-500" />}
                                        </div>
                                        {healthStatus.region !== 'N/A' && (
                                            <span className="block mt-1 text-[10px] font-mono text-slate-400">{healthStatus.region}</span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 text-center py-2">
                                    Click to verify if backend is reachable.
                                </p>
                            )}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">GET Request Configuration</h3>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Graph API Version</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        list="api-versions"
                                        value={graphVersion}
                                        onChange={(e) => setGraphVersion(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-800 dark:text-white font-mono"
                                        placeholder="v21.0"
                                    />
                                    <Globe size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
                                    <datalist id="api-versions">
                                        <option value="v21.0" />
                                        <option value="v20.0" />
                                        <option value="v19.0" />
                                        <option value="v18.0" />
                                    </datalist>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Select standard or type custom version.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">IG User ID (IGSID)</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={manualUserId}
                                        onChange={(e) => setManualUserId(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-800 dark:text-white font-mono"
                                    />
                                    <Fingerprint size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Access Token</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={accessToken}
                                        onChange={(e) => setAccessToken(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm text-slate-800 dark:text-white font-mono"
                                    />
                                    <Shield size={14} className="absolute left-2.5 top-2.5 text-slate-400"/>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mock Success Response (JSON)</h3>
                            <textarea 
                                value={profileResponse}
                                onChange={(e) => setProfileResponse(e.target.value)}
                                className="w-full h-64 bg-slate-100 dark:bg-slate-800 p-4 font-mono text-sm text-slate-700 dark:text-slate-300 rounded-xl outline-none resize-none leading-relaxed border border-transparent focus:border-purple-500"
                                spellCheck={false}
                            />
                            <p className="text-xs text-slate-400 mt-2">
                                Edit this JSON to test how the CRM handles different user names or missing profile pictures.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* RIGHT: FLOW OUTPUT */}
        <div className="w-7/12 flex flex-col bg-slate-50 dark:bg-slate-900/30">
            {result && !result.error ? (
                <div className="flex-1 overflow-y-auto p-8">
                     
                     {/* Flow Step 1: Payload Analysis */}
                     <div className="flex gap-4 mb-2">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200 dark:border-blue-800">1</div>
                            <div className="w-0.5 flex-1 bg-gray-300 dark:bg-slate-700 my-2 min-h-[30px]"></div>
                        </div>
                        <div className="flex-1 pb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Processing Message Input Payload</h3>
                                <span className="text-[10px] font-mono text-slate-400">Step 1</span>
                            </div>
                            <div className="space-y-3">
                                <FieldCard 
                                    label="messaging[].sender.id"
                                    value={result.parsedFields.senderId}
                                    description="Captured Sender ID for Profile Lookup."
                                    icon={User}
                                    colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                                />
                                <FieldCard 
                                    label="messaging[].message.text"
                                    value={result.parsedFields.messageText}
                                    description="User's query."
                                    icon={MessageSquare}
                                    colorClass="bg-green-100 dark:bg-green-900/30 text-green-600"
                                />
                            </div>
                        </div>
                     </div>

                     {/* Visual Connector */}
                     <div className="flex gap-4 mb-2">
                        <div className="w-8 flex justify-center">
                           <ArrowDown size={16} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="flex-1 pb-4"></div>
                     </div>

                     {/* Flow Step 2: User Profile Retrieval */}
                     <div className="flex gap-4 mb-2">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold border border-purple-200 dark:border-purple-800">2</div>
                            <div className="w-0.5 flex-1 bg-gray-300 dark:bg-slate-700 my-2 min-h-[30px]"></div>
                        </div>
                        <div className="flex-1 pb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Retrieve User Profile Information</h3>
                                <span className="text-[10px] font-mono text-slate-400">Step 2</span>
                            </div>
                            
                            {/* GET Request Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-800/50 shadow-sm overflow-hidden mb-4">
                                <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 border-b border-purple-100 dark:border-purple-800 flex items-center">
                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide mr-2">GET</span>
                                    <span className="text-xs font-mono text-purple-600 dark:text-purple-400 truncate">graph.facebook.com/{graphVersion}/...</span>
                                </div>
                                <div className="p-4 bg-slate-900 overflow-x-auto">
                                    <code className="text-xs font-mono text-green-400 whitespace-nowrap">
                                        {result.profileRequest.url}
                                    </code>
                                </div>
                            </div>

                            {/* Response Visualization */}
                            <div className="flex gap-4">
                                <div className="flex-1 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Mock Response Body</h4>
                                    <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                        {JSON.stringify(result.profileRequest.mockResponse, null, 2)}
                                    </pre>
                                </div>
                                <div className="flex-1 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center justify-center flex-col">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">CRM Context Updated</h4>
                                    <img 
                                        src={result.profileRequest.mockResponse.profile_pic} 
                                        alt="Profile" 
                                        className="w-12 h-12 rounded-full border-2 border-purple-100 dark:border-purple-900 mb-2" 
                                    />
                                    <span className="font-bold text-sm text-slate-800 dark:text-white">{result.profileRequest.mockResponse.name}</span>
                                    <span className="text-xs text-slate-400">ID: {result.profileRequest.mockResponse.id}</span>
                                    <span className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-bold">Added to CRM ✓</span>
                                </div>
                            </div>
                        </div>
                     </div>

                     {/* Visual Connector */}
                     <div className="flex gap-4 mb-2">
                        <div className="w-8 flex justify-center">
                           <ArrowDown size={16} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="flex-1 pb-4"></div>
                     </div>

                     {/* Flow Step 3: AI Processing */}
                     <div className="flex gap-4 mb-2">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold border border-amber-200 dark:border-amber-800">3</div>
                            <div className="w-0.5 flex-1 bg-gray-300 dark:bg-slate-700 my-2 min-h-[30px]"></div>
                        </div>
                        <div className="flex-1 pb-8">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">AI Response Processing</h3>
                                <span className="text-[10px] font-mono text-slate-400">Step 3</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm relative overflow-hidden">
                                <div className="flex items-start gap-3 relative z-10">
                                    <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                        <Bot size={20} className="text-amber-500" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Gemini 3 Flash Output</span>
                                        <p className="text-lg font-medium text-slate-800 dark:text-white mt-1 whitespace-pre-wrap leading-relaxed">
                                            {result.aiResponse}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                     {/* Flow Step 4: Verification */}
                     <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 flex items-center justify-center font-bold border border-green-200 dark:border-green-800">4</div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">Visual Verification</h3>
                                <span className="text-[10px] font-mono text-slate-400">Final Check</span>
                            </div>

                            <div className="flex flex-col xl:flex-row gap-6">
                                {/* Visual Preview */}
                                <div className="w-[300px] bg-white dark:bg-slate-900 rounded-[2.5rem] border-8 border-slate-800 shadow-xl overflow-hidden relative flex flex-col shrink-0 mx-auto xl:mx-0">
                                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-lg z-20"></div>
                                    <div className="h-14 bg-slate-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 flex items-end pb-2 justify-center z-10">
                                        <span className="font-semibold text-slate-800 dark:text-white text-xs">Instagram</span>
                                    </div>
                                    <div className="flex-1 p-4 space-y-3 bg-slate-50 dark:bg-slate-950/50 overflow-y-auto">
                                        <div className="flex justify-end">
                                            <div className="bg-blue-500 text-white px-3 py-2 rounded-2xl rounded-tr-sm max-w-[85%] text-xs shadow-sm">
                                                {result.parsedFields.messageText}
                                            </div>
                                        </div>
                                        <div className="flex justify-start">
                                            <div className="bg-gray-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 rounded-2xl rounded-tl-sm max-w-[85%] text-xs shadow-sm">
                                                {result.aiResponse}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-12 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 p-2 flex items-center">
                                        <div className="w-full h-8 bg-gray-100 dark:bg-slate-700 rounded-full"></div>
                                    </div>
                                </div>

                                {/* Raw Output Toggle */}
                                <div className="flex-1">
                                    <button 
                                        onClick={() => setShowRawOutput(!showRawOutput)}
                                        className="w-full mb-3 flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center">
                                            <Code size={16} className="mr-2" />
                                            {showRawOutput ? "Hide Graph API Payload" : "Show Graph API Payload"}
                                        </span>
                                        <ArrowDown size={16} className={`text-slate-400 transition-transform ${showRawOutput ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {showRawOutput && (
                                        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
                                            <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                                                <span className="text-xs text-slate-400 font-mono">POST graph.facebook.com/messages</span>
                                            </div>
                                            <pre className="p-4 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(result.graphApiPayload, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                    
                                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/30">
                                        <h4 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1 flex items-center">
                                            <Check size={16} className="mr-1" /> Ready for Production
                                        </h4>
                                        <p className="text-xs text-green-700 dark:text-green-500">
                                            Profile data retrieval and message logic verified.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
                        <Terminal size={40} className="text-slate-300 dark:text-slate-600" />
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-1.5 shadow-sm border border-slate-100 dark:border-slate-700">
                            <Play size={16} className="text-indigo-500 ml-0.5" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Start Debug Flow</h3>
                    <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Click "Run Flow" to trace the full journey: Webhook Parsing → <strong>Profile Retrieval</strong> → AI Generation.
                    </p>
                    {result?.error && (
                         <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start text-left max-w-md animate-in fade-in slide-in-from-bottom-4">
                            <AlertCircle size={20} className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Flow Interrupted</h4>
                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">{result.error}</p>
                            </div>
                         </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Developer;