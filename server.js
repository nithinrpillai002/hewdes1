
const express = require('express');
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

// --- VISUAL STARTUP BANNER ---
const BANNER = `
********************************************************************************
*  _    _  ______  _          ______   ______  _____   _____  _____  ______    *
* | |  | ||  ____|| |        |  ____| |  ____||  __ \\ |  __ \\|  __ \\|  ____|   *
* | |__| || |__   | |   __   | |__    | |__   | |__) || |__) || |__) || |__     *
* |  __  ||  __|  | |  /  \\  |  __|   |  __|  |  _  / |  _  / |  _  / |  __|    *
* | |  | || |____ | | / /\\ \\ | |____  | |____ | | \\ \\ | | \\ \\ | | \\ \\ | |____   *
* |_|  |_||______||_|/_/  \\_\\|______| |______||_|  \\_\\|_|  \\_\\|_|  \\_\\|______|  *
*                                                                              *
*                 SERVER STATUS: ONLINE & LISTENING                            *
********************************************************************************
`;

const app = express();
const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hewdes_rttf0kd11o1axrmc';

// --- MIDDLEWARE ---
app.enable('trust proxy'); 

// Extended Request Logging
app.use((req, res, next) => {
  const isWebhook = req.url.includes('/webhook');
  const isApi = req.url.includes('/api/');
  const isAsset = req.url.match(/\.(js|css|png|jpg|ico|tsx|ts|json)$/);

  if (isWebhook) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║ 📨 INCOMING WEBHOOK: ${req.method} ${req.originalUrl}`);
    console.log('╚════════════════════════════════════════════════════════════╝');
  } else if (isApi) {
    console.log(`[API] ${req.method} ${req.originalUrl}`);
  } else if (!isAsset) {
    console.log(`[ACCESS] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// INCREASED LIMIT FOR GITHUB PUSH PAYLOADS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// --- IN-MEMORY LOGGING SYSTEM ---
let systemLogs = [];
const MAX_LOGS = 50;

const addSystemLog = (method, url, status, outcome, source, payload) => {
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toISOString(),
    method,
    path: url,
    status,
    outcome,
    source,
    payload: payload || {}
  };
  
  systemLogs.unshift(logEntry);
  if (systemLogs.length > MAX_LOGS) systemLogs.pop();
  
  // Console feedback
  if (status >= 400) {
    console.error(`[LOG-ERROR] ${outcome}`);
  } else {
    console.log(`[LOG-SAVED] ${outcome}`);
  }
};

// --- WEBHOOK HANDLERS ---
const handleWebhookVerification = (req, res, platform) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log(`[${platform}] ✅ Webhook Verified`);
      addSystemLog('GET', req.url, 200, 'Verification Success', platform, req.query);
      res.status(200).send(challenge);
    } else {
      console.log(`[${platform}] ❌ Token Mismatch`);
      addSystemLog('GET', req.url, 403, 'Verification Failed', platform, req.query);
      res.sendStatus(403);
    }
  } else {
    addSystemLog('GET', req.url, 400, 'Missing Parameters', platform, req.query);
    res.sendStatus(400);
  }
};

const handleWebhookEvent = (req, res, platform) => {
  console.log(`[${platform}] 📦 Event Payload Received`);
  addSystemLog('POST', req.url, 200, 'Event Received', platform, req.body);
  res.status(200).send('EVENT_RECEIVED');
};

// --- API ROUTES ---
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hewdes CRM Server is Running' });
});

// Alias for common monitoring tools
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hewdes CRM Server is Running' });
});

app.get('/api/logs', (req, res) => {
  try {
    res.json(systemLogs);
  } catch (error) {
    console.error('Error serializing logs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- GITHUB INTEGRATION ENDPOINT ---
app.post('/api/github/push', async (req, res) => {
  const { token, owner, repo, message } = req.body;

  if (!token || !owner || !repo) {
    return res.status(400).json({ error: 'Missing GitHub credentials' });
  }

  // Files to Sync
  const filesToSync = [
    'server.js',
    'package.json',
    'index.html',
    'index.tsx',
    'types.ts',
    'metadata.json',
    'App.tsx',
    'components/Sidebar.tsx',
    'pages/Analytics.tsx',
    'pages/Products.tsx',
    'pages/CRM.tsx',
    'pages/Settings.tsx',
    'services/geminiService.ts'
  ];

  try {
    let pushedCount = 0;
    
    // Check if repo exists and we have access
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": "Hewdes-CRM" }
    });
    
    if (!checkRes.ok) {
        throw new Error(`Cannot access repository ${owner}/${repo}. Check token permissions.`);
    }

    for (const filePath of filesToSync) {
        const fullPath = path.join(__dirname, filePath);
        
        if (fs.existsSync(fullPath)) {
            // Read file content
            const content = fs.readFileSync(fullPath).toString('base64');
            
            // 1. Get current SHA (if exists)
            let sha = null;
            try {
                const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                    headers: { Authorization: `Bearer ${token}`, "User-Agent": "Hewdes-CRM" }
                });
                if (getRes.ok) {
                    const json = await getRes.json();
                    sha = json.sha;
                }
            } catch (e) {
                // Ignore errors here, file might not exist yet
            }

            // 2. Upload File (Create or Update)
            const body = {
                message: message || "Update from Hewdes CRM",
                content: content,
                branch: "main" // Assuming main branch
            };
            if (sha) body.sha = sha;

            const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: { 
                    Authorization: `Bearer ${token}`, 
                    "User-Agent": "Hewdes-CRM",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!putRes.ok) {
                const err = await putRes.json();
                console.error(`Failed to push ${filePath}:`, err);
            } else {
                pushedCount++;
            }
        }
    }

    res.json({ success: true, count: pushedCount });

  } catch (error) {
    console.error('GitHub Push Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook Routes
app.get('/webhook/instagram', (req, res) => handleWebhookVerification(req, res, 'instagram'));
app.post('/webhook/instagram', (req, res) => handleWebhookEvent(req, res, 'instagram'));
app.get('/webhook/whatsapp', (req, res) => handleWebhookVerification(req, res, 'whatsapp'));
app.post('/webhook/whatsapp', (req, res) => handleWebhookEvent(req, res, 'whatsapp'));

// --- EXPLICIT ROOT HANDLING ---
// Serve index.html explicitly for root to prevent ambiguity
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// --- FRONTEND SERVING (Transpilation) ---
app.use(async (req, res, next) => {
  if (req.method !== 'GET') return next();

  let relativePath = req.path;
  // If we got here and it's root, it might be caught above, but just in case:
  if (relativePath === '/') relativePath = '/index.html';

  const absolutePath = path.join(__dirname, relativePath);
  
  let filePathToServe = null;
  let loaderType = 'tsx';

  // Resolve extensionless imports
  if (!path.extname(absolutePath)) {
    if (fs.existsSync(absolutePath + '.tsx')) {
      filePathToServe = absolutePath + '.tsx';
      loaderType = 'tsx';
    } else if (fs.existsSync(absolutePath + '.ts')) {
      filePathToServe = absolutePath + '.ts';
      loaderType = 'ts';
    }
  } else if (fs.existsSync(absolutePath)) {
    filePathToServe = absolutePath;
    if (absolutePath.endsWith('.ts')) loaderType = 'ts';
    if (absolutePath.endsWith('.tsx')) loaderType = 'tsx';
  }

  if (filePathToServe && (loaderType === 'tsx' || loaderType === 'ts')) {
    try {
      const content = fs.readFileSync(filePathToServe, 'utf8');
      const result = esbuild.transformSync(content, {
        loader: loaderType,
        target: 'es2020',
        format: 'esm',
        jsx: 'automatic', 
      });
      
      res.set('Content-Type', 'application/javascript');
      return res.send(result.code);
    } catch (e) {
      console.error(`Transpilation Error for ${filePathToServe}:`, e);
      return res.status(500).send(`Transpilation Failed: ${e.message}`);
    }
  }

  next();
});

// Serve static files (css, images, etc.)
app.use(express.static(path.resolve(__dirname)));

// Fallback for client-side routing
app.get('*', (req, res) => {
  // If it's an asset request that failed, return 404
  if (req.url.match(/\.(js|css|png|jpg|ico|json|woff2)$/)) {
    return res.status(404).send('Not Found');
  }
  res.sendFile(path.resolve(__dirname, 'index.html'));
});

// --- SERVER START ---
app.listen(PORT, () => {
  console.log(BANNER);
  console.log(`[SYSTEM] Server listening on port ${PORT}`);
  console.log(`[SYSTEM] Webhook Endpoint: /webhook/instagram`);
});
