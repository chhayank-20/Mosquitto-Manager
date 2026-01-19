"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientTracker = void 0;
const tail_1 = require("tail");
const fs_1 = __importDefault(require("fs"));
class ClientTracker {
    constructor(logFile, onChange) {
        this.clients = new Map();
        this.tail = null;
        this.logFile = logFile;
        this.onChange = onChange;
    }
    start() {
        // Ensure file exists
        if (!fs_1.default.existsSync(this.logFile)) {
            console.warn(`Log file ${this.logFile} does not exist yet. Waiting...`);
            try {
                fs_1.default.writeFileSync(this.logFile, '');
            }
            catch (e) {
                console.error('Could not create log file:', e);
                return;
            }
        }
        console.log(`Tracking clients via log: ${this.logFile}`);
        console.log(`Tracking clients via log: ${this.logFile}`);
        // We do NOT read the existing file content on startup anymore.
        // This prevents stale clients (who didn't disconnect gracefully due to container kill)
        // from showing up as connected.
        // We start fresh and only track new events.
        this.emitUpdate(); // Emit empty state initially
        // 2. Start tailing for new events
        // Use useWatchFile: true (polling) for reliable file watching in Docker volumes
        this.tail = new tail_1.Tail(this.logFile, {
            useWatchFile: true,
            fsWatchOptions: { interval: 200 } // Check every 200ms
        });
        this.tail.on('line', (line) => {
            this.parseLine(line);
        });
        this.tail.on('error', (error) => {
            console.error('Tail error:', error);
        });
    }
    parseLine(line) {
        // Example logs:
        // 163...: New client connected from 172.18.0.1:56842 as mqtt-explorer-8348 (p2, c1, k60, u'admin').
        // 163...: Client mqtt-explorer-8348 disconnected.
        try {
            console.log(`[ClientTracker] Analyzing line: ${line}`);
            if (line.includes('New client connected')) {
                const clientMatch = line.match(/as ([^ ]+) \(/);
                const ipMatch = line.match(/from ([^:]+)/);
                const userMatch = line.match(/u'([^']+)'/);
                if (clientMatch && ipMatch) {
                    const clientId = clientMatch[1];
                    const ip = ipMatch[1];
                    const username = userMatch ? userMatch[1] : undefined;
                    console.log(`[ClientTracker] Adding client: ${clientId} (${ip}, ${username})`);
                    this.clients.set(clientId, {
                        id: clientId,
                        ip,
                        username,
                        connectedAt: new Date()
                    });
                    this.emitUpdate();
                }
                else {
                    console.log('[ClientTracker] Failed to match new connection format');
                }
            }
            else if (line.includes('disconnected') || line.includes('closed its connection') || line.includes('has exceeded timeout')) {
                const match = line.match(/Client ([^ ]+) (disconnected|closed its connection|has exceeded timeout)/);
                if (match) {
                    const clientId = match[1];
                    console.log(`[ClientTracker] Removing client: ${clientId}`);
                    if (this.clients.has(clientId)) {
                        this.clients.delete(clientId);
                        this.emitUpdate();
                    }
                    else {
                        console.log(`[ClientTracker] Client ${clientId} not found in map to remove. Current keys: ${Array.from(this.clients.keys()).join(', ')}`);
                    }
                }
                else {
                    console.log('[ClientTracker] Failed to match disconnect format');
                }
            }
        }
        catch (e) {
            console.error('Error parsing log line:', line, e);
        }
    }
    emitUpdate() {
        this.onChange(Array.from(this.clients.values()));
    }
    getClients() {
        return Array.from(this.clients.values());
    }
}
exports.ClientTracker = ClientTracker;
