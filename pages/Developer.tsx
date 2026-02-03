
import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Check, Terminal, FileJson, AlertCircle, User, Bot, ArrowDown, Code, Send, MessageSquare, Fingerprint, Shield, Globe, Server, Database, Smartphone, Zap, Network, Globe2, Activity } from 'lucide-react';

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
  // Navigation
  const [activeMode, setActiveMode] = useState<'flow' | 'api'>('flow');

  // --- FLOW STATE ---
  const [payload, setPayload] = useState(JSON.stringify(DEFAULT_WEBHOOK_PAYLOAD, null, 2));
  const [profileResponse, setProfileResponse] = useState(JSON.stringify(DEFAULT_PROFILE_RESPONSE, null, 2));
  const [accessToken, setAccessToken] = useState("EAAG...");
  const [manualUserId, setManualUserId] = useState("1234567890");
  const [runOnServer, setRunOnServer] = useState(false);

  // Flow Execution State
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [flowStep, setFlowStep] = useState(0); 
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [activeTab, setActiveTab] = useState<'payload' | 'profile'>('payload');

  // --- API PLAYGROUND STATE ---
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiUrl, setApiUrl] = useState('/api/conversations');
  const [apiBody, setApiBody] = useState('{\n  "text": "Hello form API Tester"\n}');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);

  // Auto-update User ID when payload changes
  useEffect(() => {
    try {
        const parsed = JSON.parse(payload);
        const senderId = parsed.entry?.[0]?.messaging?.[0]?.sender?.id;
        if (senderId) setManualUserId(senderId);
    } catch (e) {}
  }, [payload]);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    setFlowStep(0);

    try {
      // Step 1: Webhook Parse (Common validation)
      const parsedPayload = JSON.parse(payload);
      const entry = parsedPayload.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (!messaging?.sender?.id || !messaging?.message?.text) {
          throw new Error("Invalid Webhook Structure: Could not find sender.id or message.text");
      }

      setFlowStep(1);
      
      if (runOnServer) {
          // --- SERVER MODE ---
          // Send real request to backend
          await new Promise(resolve => setTimeout(resolve, 500)); 
          
          setFlowStep(2); // Sending
          const res = await fetch('/webhook/instagram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload
          });

          setFlowStep(3); // Waiting for processing
          await new Promise(resolve => setTimeout(resolve, 800));

          // Fetch logs to see what happened
          const logsRes = await fetch('/api/logs');
          const logs = await logsRes.json();
          const relatedLogs = logs.slice(0, 5); // Get recent logs

          setFlowStep(4);
          setResult({
              mode: 'server',
              status: res.status,
              statusText: res.statusText,
              logs: relatedLogs,
              responseBody: await res.text()
          });

      } else {
          // --- CLIENT SIMULATION MODE ---
          
          // Step 2: Profile Lookup
          setFlowStep(2);
          let parsedProfile = null;
          try {
              parsedProfile = JSON.parse(profileResponse);
          } catch (e) {
              throw new Error("Invalid Profile Mock JSON");
          }
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Step 3: AI Processing
          setFlowStep(3);
          await new Promise(resolve => setTimeout(resolve, 1200));

          // Step 4: Response
          setFlowStep(4);
          
          const mockResult = {
              mode: 'client',
              parsedFields: {
                  object: parsedPayload.object || 'instagram',
                  entryId: entry?.id || 'UNKNOWN_ID',
                  entryTime: entry?.time || Date.now(),
                  senderId: messaging.sender.id,
                  recipientId: messaging.recipient?.id || 'UNKNOWN_RECIPIENT',
                  messageId: messaging.message.mid || 'UNKNOWN_MID',
                  messageText: messaging.message.text
              },
              profileRequest: {
                  url: `https://graph.facebook.com/v18.0/${manualUserId}?fields=name,profile_pic&access_token=${accessToken}`,
                  method: "GET",
                  mockResponse: parsedProfile
          },
              aiContext: {
                  userName: parsedProfile.name || "Unknown User",
                  userMessage: messaging.message.text
              },
              aiResponse: `Hi ${parsedProfile.name || 'there'}! I can definitely help you with that product inquiry.`,
              graphApiPayload: {
                  recipient: { id: messaging.sender.id },
                  message: { text: `Hi ${parsedProfile.name || 'there'}! I can definitely help you with that product inquiry.` }
              }
          };

          setResult(mockResult);
      }

    } catch (e: any) {
      setResult({ error: e.message || "Invalid JSON or Logic Error" });
    } finally {
      setLoading(false);
    }
  };

  const handleApiSend = async () => {
    setApiLoading(true);
    setApiResponse(null);
    try {
        const options: any = { method: apiMethod, headers: {'Content-Type': 'application/json'} };
        if (apiMethod !== 'GET' && apiMethod !== 'HEAD') {
            options.body = apiBody;
        }
        
        const start = Date.now();
        const res = await fetch(apiUrl, options);
        const time = Date.now() - start;
        
        let data;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            data = await res.text();
        }

        setApiResponse({
            status: res.status,
            statusText: res.statusText,
            time,
            data
        });
    } catch (e: any) {
        setApiResponse({ error: e.message });
    } finally {
        setApiLoading(false);
    }
  };

  const handleReset = () => {
    setPayload(JSON.stringify(DEFAULT_WEBHOOK_PAYLOAD, null, 2));
    setProfileResponse(JSON.stringify(DEFAULT_PROFILE_RESPONSE, null, 2));
    setResult(null);
    setFlowStep(0);
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

  const SystemMapNode = ({ icon: Icon, label, stepIndex, currentStep }: any) => {
    const isActive = currentStep === stepIndex;
    const isCompleted = currentStep > stepIndex;

    let statusClass = "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-slate-400";
    if (isActive) statusClass = "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/20 scale-110 ring-4 ring-indigo-500/10";
    if (isCompleted) statusClass = "bg-green-50 dark:bg-green-900/30 border-green-500 text-green-600 dark:text-green-400";

    return (
        <div className="flex flex-col items-center relative z-10 transition-all duration-500">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${statusClass}`}>
                <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
            </div>
            <span className={`mt-2 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                {label}
            </span>
        </div>
    );
  };

  const Connector = ({ active }: { active: boolean }) => (
    <div className="flex-1 h-0.5 mx-2 relative">
        <div className="absolute inset-0 bg-gray-200 dark:bg-slate-700"></div>
        <div className={`absolute inset-0 bg-indigo-500 transition-all duration-700 ease-in-out ${active ? 'w-full' : 'w-0'}`}></div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      
      {/* HEADER & TABS */}
      <div className="px-8 py-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    <Terminal className="text-indigo-500" />
                    Developer Tools
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Simulate flows and test API endpoints directly.
                </p>
            </div>
            {activeMode === 'flow' && (
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
                        className={`px-6 py-2 ${runOnServer ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-semibold rounded-lg shadow-md flex items-center transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {loading ? (
                            <span className="flex items-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> Running...</span>
                        ) : (
                            <><Play size={18} className="mr-2 fill-current" /> {runOnServer ? 'Run Live Test' : 'Run Simulation'}</>
                        )}
                    </button>
                </div>
            )}
        </div>
        
        <div className="flex space-x-6">
            <button 
                onClick={() => setActiveMode('flow')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeMode === 'flow' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <Network size={16} className="mr-2" /> Webhook Simulator
            </button>
            <button 
                onClick={() => setActiveMode('api')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center ${activeMode === 'api' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <Globe2 size={16} className="mr-2" /> API Playground
            </button>
        </div>
      </div>

      {activeMode === 'flow' && (
        <div className="flex-1 flex overflow-hidden">
            {/* LEFT: INPUT CONFIGURATION */}
            <div className="w-5/12 flex flex-col border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                
                {/* Mode Toggle */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                    <label className="flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center">
                            <div className={`p-2 rounded-lg mr-3 ${runOnServer ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/20' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20'}`}>
                                {runOnServer ? <Server size={18} /> : <Smartphone size={18} />}
                            </div>
                            <div>
                                <span className="block text-sm font-bold text-slate-700 dark:text-white">
                                    {runOnServer ? "Live Server Mode" : "Client Simulation Mode"}
                                </span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    {runOnServer ? "Sends POST to /webhook/instagram" : "Mocks logic in browser"}
                                </span>
                            </div>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${runOnServer ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${runOnServer ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                        <input type="checkbox" className="hidden" checked={runOnServer} onChange={e => setRunOnServer(e.target.checked)} />
                    </label>
                </div>

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
                        disabled={runOnServer}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center ${activeTab === 'profile' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50 dark:bg-purple-900/10' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'} ${runOnServer ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                            <div className="flex-1 flex flex-col">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mock Success Response (JSON)</h3>
                                <textarea 
                                    value={profileResponse}
                                    onChange={(e) => setProfileResponse(e.target.value)}
                                    className="w-full h-64 bg-slate-100 dark:bg-slate-800 p-4 font-mono text-sm text-slate-700 dark:text-slate-300 rounded-xl outline-none resize-none leading-relaxed border border-transparent focus:border-purple-500"
                                    spellCheck={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: FLOW OUTPUT */}
            <div className="w-7/12 flex flex-col bg-slate-50 dark:bg-slate-900/30">
                {/* --- VISUAL SYSTEM MAP --- */}
                <div className="p-8 pb-0">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-20 ${runOnServer ? 'from-orange-500 to-red-500' : 'from-indigo-500 via-purple-500 to-pink-500'}`}></div>
                        
                        <div className="flex items-center justify-between relative px-4">
                            <SystemMapNode icon={Smartphone} label="User" stepIndex={0} currentStep={flowStep} />
                            <Connector active={flowStep > 0} />
                            <SystemMapNode icon={Globe} label="Webhook" stepIndex={1} currentStep={flowStep} />
                            <Connector active={flowStep > 1} />
                            {runOnServer ? (
                                <>
                                    <SystemMapNode icon={Server} label="Server" stepIndex={2} currentStep={flowStep} />
                                    <Connector active={flowStep > 2} />
                                    <SystemMapNode icon={Activity} label="Logs" stepIndex={3} currentStep={flowStep} />
                                    <Connector active={flowStep > 3} />
                                    <SystemMapNode icon={Check} label="Done" stepIndex={4} currentStep={flowStep} />
                                </>
                            ) : (
                                <>
                                    <SystemMapNode icon={Database} label="Profile" stepIndex={2} currentStep={flowStep} />
                                    <Connector active={flowStep > 2} />
                                    <SystemMapNode icon={Zap} label="Gemini AI" stepIndex={3} currentStep={flowStep} />
                                    <Connector active={flowStep > 3} />
                                    <SystemMapNode icon={Send} label="Reply" stepIndex={4} currentStep={flowStep} />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {result ? (
                    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {result.mode === 'server' ? (
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-800 dark:text-white">Server Response</h3>
                                        <div className={`px-2 py-1 rounded text-xs font-bold ${result.status === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {result.status} {result.statusText}
                                        </div>
                                    </div>
                                    <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-900 p-4 rounded-xl text-slate-600 dark:text-slate-300">
                                        {result.responseBody}
                                    </pre>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white mb-4">Recent System Logs</h3>
                                    <div className="space-y-2">
                                        {result.logs && result.logs.map((log: any) => (
                                            <div key={log.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{log.method}</span>
                                                    <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="font-medium text-slate-700 dark:text-slate-300">{log.outcome}</div>
                                                <div className="text-xs text-slate-400 font-mono truncate">{log.path}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // CLIENT MOCK RESULTS
                            <>
                                <div className="flex gap-4 mb-2">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200 dark:border-blue-800">1</div>
                                        <div className="w-0.5 flex-1 bg-gray-300 dark:bg-slate-700 my-2 min-h-[30px]"></div>
                                    </div>
                                    <div className="flex-1 pb-8">
                                        <div className="space-y-3">
                                            <FieldCard label="sender.id" value={result.parsedFields.senderId} description="Sender ID" icon={User} colorClass="bg-blue-100 text-blue-600" />
                                            <FieldCard label="message.text" value={result.parsedFields.messageText} description="Message" icon={MessageSquare} colorClass="bg-green-100 text-green-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 flex items-center justify-center font-bold border border-green-200 dark:border-green-800">4</div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">AI Response</h4>
                                            <p className="text-slate-800 dark:text-white">{result.aiResponse}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <Terminal size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">
                            {loading ? 'Running...' : 'Ready to Test'}
                        </h3>
                        {result?.error && (
                            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                {result.error}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      )}

      {/* API PLAYGROUND MODE */}
      {activeMode === 'api' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                  <div className="flex flex-col h-full space-y-6">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
                              <Globe2 size={20} className="mr-2 text-indigo-500"/> Request
                          </h3>
                          
                          <div className="space-y-4">
                              <div className="flex space-x-2">
                                  <select 
                                      value={apiMethod}
                                      onChange={(e) => setApiMethod(e.target.value)}
                                      className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg font-mono font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                  >
                                      <option>GET</option>
                                      <option>POST</option>
                                      <option>PUT</option>
                                      <option>DELETE</option>
                                  </select>
                                  <input 
                                      type="text" 
                                      value={apiUrl}
                                      onChange={(e) => setApiUrl(e.target.value)}
                                      className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg font-mono text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                                      placeholder="/api/..."
                                  />
                              </div>
                              
                              <div className="flex-1 flex flex-col">
                                  <label className="text-xs font-bold text-slate-500 uppercase mb-2">Request Body (JSON)</label>
                                  <textarea 
                                      value={apiBody}
                                      onChange={(e) => setApiBody(e.target.value)}
                                      disabled={apiMethod === 'GET'}
                                      className={`w-full h-64 bg-slate-50 dark:bg-slate-900 p-4 font-mono text-sm text-slate-700 dark:text-slate-300 rounded-xl outline-none resize-none leading-relaxed border border-gray-200 dark:border-slate-700 focus:border-indigo-500 ${apiMethod === 'GET' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      spellCheck={false}
                                  />
                              </div>

                              <button 
                                  onClick={handleApiSend}
                                  disabled={apiLoading}
                                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center disabled:opacity-50"
                              >
                                  {apiLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Send size={18} className="mr-2"/> Send Request</>}
                              </button>
                          </div>
                      </div>
                  </div>

                  <div className="flex flex-col h-full">
                      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700 shadow-xl h-full flex flex-col">
                          <h3 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
                              <span className="flex items-center"><Activity size={20} className="mr-2 text-green-400"/> Response</span>
                              {apiResponse && (
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${apiResponse.status >= 200 && apiResponse.status < 300 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                      {apiResponse.status} {apiResponse.statusText}
                                  </span>
                              )}
                          </h3>
                          
                          {apiResponse ? (
                              <div className="flex-1 overflow-auto">
                                  <div className="text-xs text-slate-400 mb-2 font-mono">Time: {apiResponse.time}ms</div>
                                  <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
                                      {typeof apiResponse.data === 'object' ? JSON.stringify(apiResponse.data, null, 2) : apiResponse.data}
                                  </pre>
                              </div>
                          ) : (
                              <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                                  <Server size={48} className="mb-4 opacity-50" />
                                  <p>Waiting for request...</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Developer;
