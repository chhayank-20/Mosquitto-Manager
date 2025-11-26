"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const stateStore_1 = require("./config/stateStore");
const generator_1 = require("./config/generator");
const control_1 = require("./mosquitto/control");
const brokerStats_1 = require("./services/brokerStats");
const clientTracker_1 = require("./services/clientTracker");
const logService_1 = require("./services/logService");
const certGenerator_1 = require("./config/certGenerator");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;
const MOSQUITTO_DIR = process.env.MOSQUITTO_DIR || '/mymosquitto';
const LOG_FILE = path_1.default.join(MOSQUITTO_DIR, 'mosquitto.log');
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// Serve static frontend
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// --- Services ---
const statsService = new brokerStats_1.BrokerStatsService((stats) => {
    io.emit('stats', stats);
});
const clientTracker = new clientTracker_1.ClientTracker(LOG_FILE, (clients) => {
    io.emit('clients', clients);
});
const logService = new logService_1.LogService(LOG_FILE, (line) => {
    io.emit('logs', line);
});
// Start services
// Delay slightly to ensure broker might be up, or just start (it handles reconnect)
statsService.start();
clientTracker.start();
logService.start();
// --- API Routes ---
app.get('/api/state', (req, res) => {
    const state = (0, stateStore_1.loadState)();
    res.json(state);
});
app.post('/api/state', (req, res) => {
    try {
        const newState = req.body;
        (0, stateStore_1.saveState)(newState);
        res.json({ success: true, state: newState });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/apply', async (req, res) => {
    try {
        const state = (0, stateStore_1.loadState)();
        // Ensure directories exist
        if (!fs_1.default.existsSync(MOSQUITTO_DIR)) {
            fs_1.default.mkdirSync(MOSQUITTO_DIR, { recursive: true });
        }
        const aclDir = path_1.default.join(MOSQUITTO_DIR, 'acls');
        if (!fs_1.default.existsSync(aclDir)) {
            fs_1.default.mkdirSync(aclDir, { recursive: true });
        }
        // Generate files
        const mosquittoConf = (0, generator_1.generateMosquittoConf)(state);
        // Generate Password File using mosquitto_passwd
        const passwordFile = path_1.default.join(MOSQUITTO_DIR, 'passwordfile');
        // Create empty file or overwrite
        fs_1.default.writeFileSync(passwordFile, '');
        // Fix permissions (Mosquitto complains if world readable)
        fs_1.default.chmodSync(passwordFile, '0700');
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
                }
                catch (e) {
                    console.error(`Failed to add user ${user.username}:`, e);
                }
            }
        }
        const aclFiles = (0, generator_1.generateAclFiles)(state);
        fs_1.default.writeFileSync(path_1.default.join(MOSQUITTO_DIR, 'mosquitto.conf'), mosquittoConf);
        // Write ACL files
        for (const [filename, content] of Object.entries(aclFiles)) {
            fs_1.default.writeFileSync(path_1.default.join(aclDir, filename), content);
        }
        // Restart Mosquitto to apply all changes (listeners, etc.)
        // Since entrypoint.sh now loops, killing it will trigger a restart.
        await (0, control_1.restartMosquitto)();
        res.json({ success: true, message: 'Configuration applied. Mosquitto is restarting...' });
    }
    catch (error) {
        console.error('Error applying config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/logs', (req, res) => {
    try {
        if (fs_1.default.existsSync(LOG_FILE)) {
            // Read the file. For large files, this is bad, but for a simple broker log it's okay for now.
            // Better: use 'read-last-lines' or similar.
            // Let's read the whole file and slice the last 2000 lines.
            const content = fs_1.default.readFileSync(LOG_FILE, 'utf-8');
            const lines = content.split('\n');
            const lastLines = lines.slice(-2000);
            res.json({ logs: lastLines });
        }
        else {
            res.json({ logs: [] });
        }
    }
    catch (error) {
        console.error('Error reading logs:', error);
        res.status(500).json({ error: error.message });
    }
});
// ... existing code ...
app.post('/api/certs/generate', (req, res) => {
    try {
        const result = (0, certGenerator_1.generateCerts)();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
const multer_1 = __importDefault(require("multer"));
// ... existing imports ...
// Multer setup for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const certDir = path_1.default.join(MOSQUITTO_DIR, 'certs');
        if (!fs_1.default.existsSync(certDir)) {
            fs_1.default.mkdirSync(certDir, { recursive: true });
        }
        cb(null, certDir);
    },
    filename: (req, file, cb) => {
        // Keep original filename but sanitize?
        // For simplicity, keep original.
        cb(null, file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage });
// ... existing routes ...
app.post('/api/certs/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Return the absolute path to the file
    // We know it's in /mymosquitto/certs/filename
    const filePath = path_1.default.join(MOSQUITTO_DIR, 'certs', req.file.filename);
    res.json({ success: true, path: filePath });
});
app.get('/api/certs/download', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) {
        return res.status(400).send('Missing path parameter');
    }
    // Security check: Ensure path is within MOSQUITTO_DIR
    const resolvedPath = path_1.default.resolve(filePath);
    if (!resolvedPath.startsWith(path_1.default.resolve(MOSQUITTO_DIR))) {
        return res.status(403).send('Access denied');
    }
    if (!fs_1.default.existsSync(resolvedPath)) {
        return res.status(404).send('File not found');
    }
    res.download(resolvedPath);
});
app.get(/(.*)/, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
