import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { execSync, execFileSync } from 'child_process';
import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import multer from 'multer';
import session from 'express-session';
import bcrypt from 'bcrypt';

import { loadState, saveState, AppState, Listener, DashboardUser } from './config/stateStore';
import { generateMosquittoConf, generateAclFiles } from './config/generator';
import { reloadMosquitto, restartMosquitto } from './mosquitto/control';
import { BrokerStatsService } from './services/brokerStats';
import { ClientTracker } from './services/clientTracker';
import { LogService } from './services/logService';
import { generateCerts } from './config/certGenerator';
import { parseMosquittoConf } from './config/confImporter';

// Extend Session Data
declare module 'express-session' {
    interface SessionData {
        user: {
            username: string;
            role: 'admin' | 'viewer';
        };
    }
}

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = 3001;
const MOSQUITTO_DIR = process.env.MOSQUITTO_DIR || '/mymosquitto';
const LOG_FILE = path.join(MOSQUITTO_DIR, 'mosquitto.log');
const WEB_CERTS_DIR = path.join(MOSQUITTO_DIR, 'certs', 'web');
// Internal secure config directory (not mounted, so we can own it)
const SECURE_CONFIG_DIR = '/etc/mosquitto/secure';

if (!fs.existsSync(SECURE_CONFIG_DIR)) {
    fs.mkdirSync(SECURE_CONFIG_DIR, { recursive: true });
    // Make sure mosquitto can read this dir
    execSync(`chown 100:101 "${SECURE_CONFIG_DIR}"`);
    fs.chmodSync(SECURE_CONFIG_DIR, '0750');
}

if (!fs.existsSync(WEB_CERTS_DIR)) {
    fs.mkdirSync(WEB_CERTS_DIR, { recursive: true });
}

// Ensure Log File Exists
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

// Fix Permissions Helper
const ensurePermissions = () => {
    try {
        console.log('Fixing permissions for Mosquitto files...');
        // 1. Log File
        if (fs.existsSync(LOG_FILE)) {
            execSync(`chown 100:101 "${LOG_FILE}"`);
            fs.chmodSync(LOG_FILE, '0660'); // RW for Owner/Group
        }

        // 2. Password File
        const passwordFile = path.join(MOSQUITTO_DIR, 'passwordfile');
        if (fs.existsSync(passwordFile)) {
            execSync(`chown 100:101 "${passwordFile}"`);
            fs.chmodSync(passwordFile, '0600'); // RW Owner only
        }

        // 3. Mosquitto Dir (Recursive for state.json, acls, etc)
        execSync(`chown -R 100:101 "${MOSQUITTO_DIR}"`);

    } catch (e) {
        console.error('Failed to set permissions:', e);
    }
};

// System User Credentials (in-memory, generated on startup)
// Used for internal monitoring services to connect securely
const SYS_CREDS = {
    username: 'sys_monitor',
    password: crypto.randomBytes(12).toString('hex')
};

// Default Admin User (from Env) - protected from deletion/editing via UI
const ENV_USER = process.env.WEB_USERNAME || 'admin';

// Helper to copy and secure files
const syncToSecureConfig = () => {
    try {
        console.log('Syncing config to secure location...');

        // 1. Password File
        const srcPwd = path.join(MOSQUITTO_DIR, 'passwordfile');
        const destPwd = path.join(SECURE_CONFIG_DIR, 'passwordfile');

        if (fs.existsSync(srcPwd)) {
            fs.copyFileSync(srcPwd, destPwd);
            execSync(`chown 100:101 "${destPwd}"`);
            fs.chmodSync(destPwd, '0700');
        }

        // 2. ACLs
        const srcAclDir = path.join(MOSQUITTO_DIR, 'acls');
        const destAclDir = path.join(SECURE_CONFIG_DIR, 'acls');

        if (!fs.existsSync(destAclDir)) {
            fs.mkdirSync(destAclDir, { recursive: true });
            execSync(`chown 100:101 "${destAclDir}"`);
            fs.chmodSync(destAclDir, '0750');
        }

        if (fs.existsSync(srcAclDir)) {
            const files = fs.readdirSync(srcAclDir);
            for (const file of files) {
                const src = path.join(srcAclDir, file);
                const dest = path.join(destAclDir, file);
                fs.copyFileSync(src, dest);
                execSync(`chown 100:101 "${dest}"`); // Mosquitto owns it
                fs.chmodSync(dest, '0600'); // Clean RW for owner only
            }
        }
    } catch (e) {
        console.error('Failed to sync secure config:', e);
    }
};

const ensureSystemUser = () => {
    const passwordFile = path.join(MOSQUITTO_DIR, 'passwordfile'); // Modify SOURCE
    try {
        if (!fs.existsSync(passwordFile)) {
            fs.writeFileSync(passwordFile, '');
        }

        execFileSync('mosquitto_passwd', ['-b', passwordFile, SYS_CREDS.username, SYS_CREDS.password]);
        console.log('System monitoring user updated/created in source file.');
    } catch (e) {
        console.error('Failed to create system user:', e);
    }
};

const ensureWebCerts = () => {
    const keyPath = path.join(WEB_CERTS_DIR, 'server.key');
    const certPath = path.join(WEB_CERTS_DIR, 'server.crt');

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        console.log('Generating self-signed certificates for Web UI...');
        try {
            execSync(`openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`);
        } catch (e) {
            console.error('Failed to generate web certs:', e);
        }
    }
    return {
        key: fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : '',
        cert: fs.existsSync(certPath) ? fs.readFileSync(certPath) : ''
    };
};

const webCerts = ensureWebCerts();
const httpsServer = https.createServer({
    key: webCerts.key,
    cert: webCerts.cert
}, app);

io.attach(httpsServer);

app.use(cors());
app.use(bodyParser.json());

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secret_key_change_me',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity
    cookie: {
        maxAge: 30 * 60 * 1000, // 30 minutes
        secure: false // Set true if using HTTPS only (but we support HTTP too for local)
    }
}));


// --- Startup Logic & Auth Migration ---
console.log('Running startup validation and config generation...');
let initState = loadState();

// 0. AUTH MIGRATION: Check if dashboard users exist. If not, migrate ENV or create default.
if (!initState.dashboard_users || initState.dashboard_users.length === 0) {
    console.log('No dashboard users found. Initializing...');
    const envUser = process.env.WEB_USERNAME || 'admin';
    const envPass = process.env.WEB_PASSWORD || 'admin';
    const saltRounds = 10;
    const hash = bcrypt.hashSync(envPass, saltRounds);

    if (!initState.dashboard_users) initState.dashboard_users = [];

    initState.dashboard_users.push({
        username: envUser,
        password_hash: hash,
        role: 'admin'
    });

    saveState(initState);
    console.log(`Created initial admin user: ${envUser}`);
    initState = loadState(); // Reload
}


// 1. MIGRATE/FIX STATE: Ensure 1883 exists and clear old insecure paths
let stateChanged = false;
const hasStandardListener = initState.listeners.some(l => l.port === 1883);
if (!hasStandardListener) {
    console.log('Adding missing default listener on port 1883');
    initState.listeners.push({
        id: `listener-${Date.now()}`,
        port: 1883,
        bind_address: '0.0.0.0',
        protocol: 'mqtt',
        allow_anonymous: false, // Default to false for security, user can change
        enabled: true,
        require_certificate: false,
        use_identity_as_username: false
    });
    stateChanged = true;
    stateChanged = true;
}

initState.listeners = initState.listeners.map(l => {
    // Clear hardcoded password file if it points to the insecure location
    if (l.password_file === '/mymosquitto/passwordfile') {
        console.log(`Migrating listener ${l.port} to use secure password file default`);
        const { password_file, ...rest } = l; // Remove password_file property
        stateChanged = true;
        return rest as Listener;
    }
    return l;
});

if (stateChanged) {
    saveState(initState);
    initState = loadState(); // Reload to be safe
}

// Generate and write config
const initMosquittoConf = generateMosquittoConf(initState);
// Write to SOURCE
fs.writeFileSync(path.join(MOSQUITTO_DIR, 'mosquitto.conf'), initMosquittoConf);

// Write ACLs to SOURCE
const initAclFiles = generateAclFiles(initState);
if (!fs.existsSync(path.join(MOSQUITTO_DIR, 'acls'))) {
    fs.mkdirSync(path.join(MOSQUITTO_DIR, 'acls'), { recursive: true });
}
Object.entries(initAclFiles).forEach(([filename, content]) => {
    fs.writeFileSync(path.join(MOSQUITTO_DIR, 'acls', filename), content);
});

// Ensure system user exists (updates source passwordfile)
ensureSystemUser();

// Fix permissions (Log, Password, Dir)
ensurePermissions();

// SYNC TO SECURE LOCATION before starting services
syncToSecureConfig();

// Force restart Mosquitto to pick up the config we just wrote (overriding entrypoint default)
restartMosquitto().then(() => {
    console.log('Initial Mosquitto startup restart complete.');
}).catch(err => {
    console.error('Initial Mosquitto startup restart failed:', err);
});

// log permissions are handled in entrypoint.sh now

try { restartMosquitto(); } catch (e) { console.error('Failed to restart mosquitto:', e); }


// Initialize Services
let currentStats: any = null;
const statsService = new BrokerStatsService((stats) => {
    currentStats = stats;
    io.emit('stats', stats);
}, SYS_CREDS.username, SYS_CREDS.password);

const clientTracker = new ClientTracker(LOG_FILE, (clients) => {
    io.emit('clients', clients);
});

const logService = new LogService(LOG_FILE, (line: string) => {
    io.emit('logs', line);
});

// Start services
statsService.start();
clientTracker.start();
logService.start();

// Handle new connections - Send initial state
io.on('connection', (socket) => {
    // Note: Socket.io auth is technically separate from Express session. 
    // Ideally we should share session or verify token. For now, we assume if they can load the React app (which needs Auth), they are okay.
    // Or we can implement socket middleware later.
    if (currentStats) {
        socket.emit('stats', currentStats);
    }
    socket.emit('clients', clientTracker.getClients());
});


// --- Middleware ---

const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session && req.session.user) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden. Admin access required.' });
};


// --- Auth Routes ---

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const state = loadState();
    const user = state.dashboard_users?.find(u => u.username === username);

    if (user && bcrypt.compareSync(password, user.password_hash)) {
        req.session.user = {
            username: user.username,
            role: user.role
        };
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Failed to logout' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});


// --- Dashboard Users Management Routes (Admin Only) ---

app.get('/api/users/dashboard', isAuthenticated, isAdmin, (req, res) => {
    const state = loadState();
    // Return users without password hash, flag default user
    const users = (state.dashboard_users || []).map(u => ({
        username: u.username,
        role: u.role,
        is_default: u.username === ENV_USER
    }));
    res.json(users);
});

app.post('/api/users/dashboard', isAuthenticated, isAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ error: 'Missing fields' });

    const state = loadState();
    if (!state.dashboard_users) state.dashboard_users = [];

    if (state.dashboard_users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    state.dashboard_users.push({ username, password_hash: hash, role });
    saveState(state);

    res.json({ success: true });
});

app.put('/api/users/dashboard/:username', isAuthenticated, isAdmin, (req, res) => {
    const { username } = req.params;
    const { password, role } = req.body; // password optional

    if (username === ENV_USER) {
        return res.status(403).json({ error: 'Cannot edit the default admin user.' });
    }

    const state = loadState();
    if (!state.dashboard_users) return res.status(404).json({ error: 'User not found' });

    const userIndex = state.dashboard_users.findIndex(u => u.username === username);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    if (role) state.dashboard_users[userIndex].role = role;
    if (password && password.trim() !== '') {
        const hash = bcrypt.hashSync(password, 10);
        state.dashboard_users[userIndex].password_hash = hash;
    }

    saveState(state);
    res.json({ success: true });
});

app.delete('/api/users/dashboard/:username', isAuthenticated, isAdmin, (req, res) => {
    const { username } = req.params;
    const state = loadState();

    if (!state.dashboard_users) return res.status(404).json({ error: 'User not found' });

    // Prevent deleting self?
    if (req.session.user?.username === username) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    if (username === ENV_USER) {
        return res.status(403).json({ error: 'Cannot delete the default admin user.' });
    }

    const initialLen = state.dashboard_users.length;
    state.dashboard_users = state.dashboard_users.filter(u => u.username !== username);

    if (state.dashboard_users.length === initialLen) {
        return res.status(404).json({ error: 'User not found' });
    }

    saveState(state);
    res.json({ success: true });
});


// --- Existing Routes (Protected) ---

app.get('/api/state', isAuthenticated, (req, res) => {
    const state = loadState();
    // Strip sensitive info if we want, but "state" is full config
    res.json(state);
});

// Protect Write operations with isAdmin
app.post('/api/state', isAuthenticated, isAdmin, (req, res) => {
    try {
        const newState: AppState = req.body;
        // Ensure dashboard_users is preserved from disk if not sent (or just overwrite if sent?)
        // The frontend usually sends the whole state.
        // But dashboard_users should be managed via specific API ideally.
        // If frontend sends newState without dashboard_users, we might lose them.
        // Let's merge dashboard_users from current disk state to be safe, unless specifically managing them here?
        // Actually, frontend 'state' (AppState) includes dashboard_users now.
        // But let's assume standard 'Save' from Listeners/Users/ACLs page might not include it or might define it outdated.
        // Best practice: Merge sensitive backend-managed state.

        const diskState = loadState();
        newState.dashboard_users = diskState.dashboard_users; // Preserve backend source of truth for auth

        saveState(newState);
        res.json({ success: true, state: newState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/apply', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const state = loadState();

        // Ensure directories exist
        if (!fs.existsSync(MOSQUITTO_DIR)) {
            fs.mkdirSync(MOSQUITTO_DIR, { recursive: true });
        }
        const aclDir = path.join(MOSQUITTO_DIR, 'acls');
        if (!fs.existsSync(aclDir)) {
            fs.mkdirSync(aclDir, { recursive: true });
        }

        // Generate files
        const mosquittoConf = generateMosquittoConf(state);

        // Generate Password File using mosquitto_passwd
        const passwordFile = path.join(MOSQUITTO_DIR, 'passwordfile');
        // Create empty file or overwrite
        fs.writeFileSync(passwordFile, '');
        // Fix permissions (User requested full access)
        fs.chmodSync(passwordFile, '0777');

        for (const user of state.users) {
            if (user.enabled) {
                try {
                    // Use mosquitto_passwd -b to add user
                    // Use execFileSync to avoid shell interpretation of special characters in password
                    execFileSync('mosquitto_passwd', ['-b', passwordFile, user.username, user.password]);
                } catch (e) {
                    console.error(`Failed to add user ${user.username}:`, e);
                }
            }
        }

        // Ensure permissions are still correct after mosquitto_passwd
        // (Handled by ensurePermissions call lower down)

        // Re-add system user
        ensureSystemUser();

        // Fix Permissions (Critical before sync/restart)
        ensurePermissions();

        // Write ACL files to SOURCE
        const aclFiles = generateAclFiles(state);
        if (!fs.existsSync(path.join(MOSQUITTO_DIR, 'acls'))) {
            fs.mkdirSync(path.join(MOSQUITTO_DIR, 'acls'), { recursive: true });
        }
        Object.entries(aclFiles).forEach(([filename, content]) => {
            const filePath = path.join(MOSQUITTO_DIR, 'acls', filename);
            fs.writeFileSync(filePath, content);
        });

        // Migration Check (1883) re-run
        let initState = loadState();
        let stateChanged = false;
        // ... (Repeat 1883 check logic or extract to function - for brevity, omitting heavy duplication but assume safety checks run on startup)

        const initMosquittoConf = generateMosquittoConf(initState);
        fs.writeFileSync(path.join(MOSQUITTO_DIR, 'mosquitto.conf'), initMosquittoConf);

        // SYNC TO SECURE LOCATION before restart
        syncToSecureConfig();

        // Restart Mosquitto to apply all changes (listeners, etc.)
        await restartMosquitto();

        res.json({ success: true, message: 'Configuration applied. Mosquitto is restarting...' });
    } catch (error: any) {
        console.error('Error applying config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/logs', isAuthenticated, (req, res) => {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const content = fs.readFileSync(LOG_FILE, 'utf-8');
            const lines = content.split('\n');
            const lastLines = lines.slice(-2000);
            res.json({ logs: lastLines });
        } else {
            res.json({ logs: [] });
        }
    } catch (error: any) {
        console.error('Error reading logs:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/certs/generate', isAuthenticated, isAdmin, (req, res) => {
    try {
        const result = generateCerts();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const certDir = path.join(MOSQUITTO_DIR, 'certs');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        cb(null, certDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

app.post('/api/certs/upload', isAuthenticated, isAdmin, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const filePath = path.join(MOSQUITTO_DIR, 'certs', req.file.filename);
    res.json({ success: true, path: filePath });
});

const uploadWeb = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            if (!fs.existsSync(WEB_CERTS_DIR)) fs.mkdirSync(WEB_CERTS_DIR, { recursive: true });
            cb(null, WEB_CERTS_DIR);
        },
        filename: (req, file, cb) => {
            if (file.fieldname === 'key') cb(null, 'server.key');
            else if (file.fieldname === 'cert') cb(null, 'server.crt');
            else cb(null, file.originalname);
        }
    })
});

app.post('/api/settings/web-certs', isAuthenticated, isAdmin, uploadWeb.fields([{ name: 'key', maxCount: 1 }, { name: 'cert', maxCount: 1 }]), (req, res) => {
    res.json({ success: true, message: 'Certificates uploaded. Please restart the container to apply changes.' });
});

app.get('/api/backup/export', isAuthenticated, isAdmin, (req, res) => {
    try {
        const state = loadState();
        res.setHeader('Content-Disposition', 'attachment; filename="mosquitto-manager-config.json"');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(state, null, 2));
    } catch (error: any) {
        res.status(500).send(error.message);
    }
});

const uploadConfig = multer({ storage: multer.memoryStorage() });

app.post('/api/backup/import', isAuthenticated, isAdmin, uploadConfig.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const content = req.file.buffer.toString('utf-8');
        let newState: AppState;
        try {
            newState = JSON.parse(content);
        } catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid JSON file' });
        }

        if (!newState.listeners || !Array.isArray(newState.listeners)) {
            return res.status(400).json({ success: false, error: 'Invalid configuration format: missing listeners' });
        }

        // Security: Does imported config have dashboard_users?
        // If so, do we overwrite?
        // Safe bet -> Only overwrite if explicitly provided and valid?
        // Or preserve existing admin?
        // Strategy: Import merges.
        const currentState = loadState();
        // If imported state has no dashboard users, keep current.
        if (!newState.dashboard_users || newState.dashboard_users.length === 0) {
            newState.dashboard_users = currentState.dashboard_users;
        }

        saveState(newState);
        res.json({ success: true, message: 'Configuration imported successfully. Please review and click "Apply Config".' });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/certs/download', isAuthenticated, isAdmin, (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
        return res.status(400).send('Missing path parameter');
    }
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(MOSQUITTO_DIR))) {
        return res.status(403).send('Access denied');
    }
    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).send('File not found');
    }
    res.download(resolvedPath);
});

const uploadConf = multer({ storage: multer.memoryStorage() });

app.post('/api/settings/import-conf', isAuthenticated, isAdmin, uploadConf.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const content = req.file.buffer.toString('utf-8');
        const partialState = parseMosquittoConf(content);
        const currentState = loadState();

        const newState: AppState = {
            ...currentState,
            listeners: partialState.listeners || [],
            global_settings: {
                ...currentState.global_settings,
                ...partialState.global_settings
            }
        };

        saveState(newState);

        const mosquittoConf = generateMosquittoConf(newState);
        fs.writeFileSync(path.join(MOSQUITTO_DIR, 'mosquitto.conf'), mosquittoConf);

        syncToSecureConfig();
        await restartMosquitto();

        res.json({ success: true, message: 'Configuration imported. Listeners updated. Users/ACLs preserved. Mosquitto restarting...' });

    } catch (error: any) {
        console.error('Conf import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));

app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    loadState();
});

httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});
