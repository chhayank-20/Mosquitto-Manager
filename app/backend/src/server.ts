import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { loadState, saveState, AppState } from './config/stateStore';
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
const MOSQUITTO_DIR = process.env.MOSQUITTO_DIR || '/mymosquitto';
const LOG_FILE = path.join(MOSQUITTO_DIR, 'mosquitto.log');

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

// Serve static frontend
app.use(express.static(path.join(__dirname, '../public')));

// --- Services ---
const statsService = new BrokerStatsService((stats) => {
    io.emit('stats', stats);
});

const clientTracker = new ClientTracker(LOG_FILE, (clients) => {
    io.emit('clients', clients);
});

const logService = new LogService(LOG_FILE, (line: string) => {
    io.emit('logs', line);
});

// Start services
// Delay slightly to ensure broker might be up, or just start (it handles reconnect)
statsService.start();
clientTracker.start();
logService.start();

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
                    // We need to use execSync to ensure it's done before reload
                    const { execSync } = require('child_process');
                    // Escape username and password? For now assume simple.
                    // WARNING: Passing password in command line is visible in process list.
                    // But inside container it's less of a risk.
                    // Better would be to pipe it, but -b takes it as arg.
                    execSync(`mosquitto_passwd -b ${passwordFile} "${user.username}" "${user.password}"`);
                } catch (e) {
                    console.error(`Failed to add user ${user.username}:`, e);
                }
            }
        }

        // Ensure permissions are still correct after mosquitto_passwd
        if (fs.existsSync(passwordFile)) {
            fs.chmodSync(passwordFile, '0777');
        }

        const aclFiles = generateAclFiles(state);

        fs.writeFileSync(path.join(MOSQUITTO_DIR, 'mosquitto.conf'), mosquittoConf);

        // Write ACL files
        for (const [filename, content] of Object.entries(aclFiles)) {
            fs.writeFileSync(path.join(aclDir, filename), content);
        }

        // Restart Mosquitto to apply all changes (listeners, etc.)
        // Since entrypoint.sh now loops, killing it will trigger a restart.
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



import multer from 'multer';

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

app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Initialize state (creates state.json if missing)
    loadState();
});
