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

import { loadState, saveState, AppState, Listener } from './config/stateStore';
import { generateMosquittoConf, generateAclFiles } from './config/generator';
import { reloadMosquitto, restartMosquitto } from './mosquitto/control';
import { BrokerStatsService } from './services/brokerStats';
import { ClientTracker } from './services/clientTracker';
import { LogService } from './services/logService';
import { generateCerts } from './config/certGenerator';

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

// System User Credentials (in-memory, generated on startup)
// Used for internal monitoring services to connect securely
const SYS_CREDS = {
    username: 'sys_monitor',
    password: crypto.randomBytes(12).toString('hex')
};

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

// Helper to fix permissions
// const fixPermissions = (filePath: string) => { ... }; // Unused for source files now as they are just backups

const ensureSystemUser = () => {
    const passwordFile = path.join(MOSQUITTO_DIR, 'passwordfile'); // Modify SOURCE
    try {
        if (!fs.existsSync(passwordFile)) {
            fs.writeFileSync(passwordFile, '');
        }
        // Just make sure we can write to it
        // execSync(`chown 100:101 "${passwordFile}"`); // Maybe not needed if we are root and write it
        // fs.chmodSync(passwordFile, '0666'); // Let us write. We copy to secure later.

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

io.on('connection', (socket) => {
    // Send initial state immediately upon connection
    // accessing the statsService instance requires moving it up or making it singleton?
    // It's defined below. Services should arguably be initialized before server starts or at least before we handle connections?
    // Move service initialization UP.

    // Actually, services are initialized before `server.listen` but AFTER `io` creation.
    // The `io.on` callback runs when client connects. At that point services exist.
    // BUT `statsService` variable is defined below. 
    // We need to reorder code or use a getter.
    // Let's rely on hoisting or just move this block DOWN after services are created.
});


app.use(cors());
app.use(bodyParser.json());

// Basic Auth Middleware
app.use((req, res, next) => {
    const user = process.env.WEB_USERNAME;
    const pass = process.env.WEB_PASSWORD;

    if (!user || !pass) {
        return next();
    }

    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && password && login === user && password === pass) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Mosquitto Manager"');
    res.status(401).send('Authentication required.');
});

// Need helper to expose getters
let currentStats: any = null;
const statsService = new BrokerStatsService((stats) => {
    currentStats = stats;
    io.emit('stats', stats);
}, SYS_CREDS.username, SYS_CREDS.password);

const clientTracker = new ClientTracker(LOG_FILE, (clients) => {
    io.emit('clients', clients);
});

// --- Startup Logic ---
// 1. Regenerate config from state on startup to ensure secure paths are used
console.log('Running startup validation and config generation...');
let initState = loadState();

// MIGRATE/FIX STATE: Ensure 1883 exists and clear old insecure paths
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
} else {
    // Force enable 1883 if it exists but disabled (Common issue if state drifted)
    initState.listeners = initState.listeners.map(l => {
        if (l.port === 1883 && !l.enabled) {
            console.log('Re-enabling listener on port 1883');
            stateChanged = true;
            return { ...l, enabled: true } as Listener;
        }
        return l;
    });
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

// SYNC TO SECURE LOCATION before starting services
syncToSecureConfig();

// log permissions are handled in entrypoint.sh now

// We should RESTART to apply listener changes (reload SIGHUP doesn't support adding listeners)
// entrypoint.sh loop will handle the restart after we kill it
try { restartMosquitto(); } catch (e) { console.error('Failed to restart mosquitto:', e); }

const logService = new LogService(LOG_FILE, (line: string) => {
    io.emit('logs', line);
});

// Start services
statsService.start();
clientTracker.start();
logService.start();

// Handle new connections - Send initial state
io.on('connection', (socket) => {
    // Send latest known stats
    if (currentStats) {
        socket.emit('stats', currentStats);
    }
    // Send current clients
    socket.emit('clients', clientTracker.getClients());
});

// --- API Routes ---
app.get('/api/state', (req, res) => {
    const state = loadState();
    res.json(state);
});

app.post('/api/state', (req, res) => {
    try {
        const newState: AppState = req.body;
        saveState(newState);
        res.json({ success: true, state: newState });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/apply', async (req, res) => {
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
        if (fs.existsSync(passwordFile)) {
            fs.chmodSync(passwordFile, '0777');
        }

        // Re-add system user because we just rewrote the password file (if user list was rebuilt)
        // Actually, we executed mosquitto_passwd -b for each user, which appends/modifies.
        // But we initialized passwordFile with empty string at line 152!
        // So yes, sys_monitor is GONE. We must re-add it.
        ensureSystemUser();

        // Write ACL files to SOURCE
        const aclFiles = generateAclFiles(state);
        if (!fs.existsSync(path.join(MOSQUITTO_DIR, 'acls'))) {
            fs.mkdirSync(path.join(MOSQUITTO_DIR, 'acls'), { recursive: true });
        }
        Object.entries(aclFiles).forEach(([filename, content]) => {
            const filePath = path.join(MOSQUITTO_DIR, 'acls', filename);
            fs.writeFileSync(filePath, content);
        });

        // --- Services ---
        // 1. Regenerate config from state on startup to ensure secure paths are used
        let initState = loadState();

        // MIGRATE/FIX STATE: Ensure 1883 exists and clear old insecure paths
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

        const initMosquittoConf = generateMosquittoConf(initState);
        // Write to SOURCE
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

app.get('/api/logs', (req, res) => {
    try {
        if (fs.existsSync(LOG_FILE)) {
            // Read the file. For large files, this is bad, but for a simple broker log it's okay for now.
            // Better: use 'read-last-lines' or similar.
            // Let's read the whole file and slice the last 2000 lines.
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



// ... existing code ...

app.post('/api/certs/generate', (req, res) => {
    try {
        const result = generateCerts();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});





// ... existing imports ...

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const certDir = path.join(MOSQUITTO_DIR, 'certs');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        cb(null, certDir);
    },
    filename: (req, file, cb) => {
        // Keep original filename but sanitize?
        // For simplicity, keep original.
        cb(null, file.originalname);
    }
});
const upload = multer({ storage });

// ... existing routes ...

app.post('/api/certs/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Return the absolute path to the file
    // We know it's in /mymosquitto/certs/filename
    const filePath = path.join(MOSQUITTO_DIR, 'certs', req.file.filename);
    res.json({ success: true, path: filePath });
});

// Upload Web UI Certs
const uploadWeb = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            if (!fs.existsSync(WEB_CERTS_DIR)) fs.mkdirSync(WEB_CERTS_DIR, { recursive: true });
            cb(null, WEB_CERTS_DIR);
        },
        filename: (req, file, cb) => {
            // Force filenames to be server.key and server.crt based on field name
            if (file.fieldname === 'key') cb(null, 'server.key');
            else if (file.fieldname === 'cert') cb(null, 'server.crt');
            else cb(null, file.originalname);
        }
    })
});

app.post('/api/settings/web-certs', uploadWeb.fields([{ name: 'key', maxCount: 1 }, { name: 'cert', maxCount: 1 }]), (req, res) => {
    // We expect both files, or at least one.
    // After upload, we should probably restart the backend to pick up new certs?
    // Or just let the user manually restart container?
    // For now, just save.
    res.json({ success: true, message: 'Certificates uploaded. Please restart the container to apply changes.' });
});

// --- Backup & Restore ---

app.get('/api/backup/export', (req, res) => {
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

app.post('/api/backup/import', uploadConfig.single('file'), async (req, res) => {
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

        // Basic validation
        if (!newState.listeners || !Array.isArray(newState.listeners)) {
            return res.status(400).json({ success: false, error: 'Invalid configuration format: missing listeners' });
        }

        // Save the new state
        saveState(newState);

        // We DO NOT auto-apply. We let the user review and click "Apply" in the UI.
        // This is safer.

        res.json({ success: true, message: 'Configuration imported successfully. Please review and click "Apply Config".' });
    } catch (error: any) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/certs/download', (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) {
        return res.status(400).send('Missing path parameter');
    }

    // Security check: Ensure path is within MOSQUITTO_DIR
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(MOSQUITTO_DIR))) {
        return res.status(403).send('Access denied');
    }

    if (!fs.existsSync(resolvedPath)) {
        return res.status(404).send('File not found');
    }

    res.download(resolvedPath);
});

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, '../public')));

app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Initialize state (creates state.json if missing)
    loadState();
});

httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});
