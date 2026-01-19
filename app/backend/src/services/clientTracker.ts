import { Tail } from 'tail';
import fs from 'fs';

interface ConnectedClient {
    id: string;
    ip: string;
    username?: string;
    connectedAt: Date;
}

export class ClientTracker {
    private clients: Map<string, ConnectedClient> = new Map();
    private logFile: string;
    private tail: Tail | null = null;
    private onChange: (clients: ConnectedClient[]) => void;

    constructor(logFile: string, onChange: (clients: ConnectedClient[]) => void) {
        this.logFile = logFile;
        this.onChange = onChange;
    }

    public start() {
        // Ensure file exists
        if (!fs.existsSync(this.logFile)) {
            console.warn(`Log file ${this.logFile} does not exist yet. Waiting...`);
            try {
                fs.writeFileSync(this.logFile, '');
            } catch (e) {
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
        this.tail = new Tail(this.logFile, {
            useWatchFile: true,
            fsWatchOptions: { interval: 200 } // Check every 200ms
        });

        this.tail.on('line', (line: string) => {
            this.parseLine(line);
        });

        this.tail.on('error', (error: any) => {
            console.error('Tail error:', error);
        });
    }

    private parseLine(line: string) {
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
                } else {
                    console.log('[ClientTracker] Failed to match new connection format');
                }
            } else if (line.includes('disconnected') || line.includes('closed its connection') || line.includes('has exceeded timeout')) {
                const match = line.match(/Client ([^ ]+) (disconnected|closed its connection|has exceeded timeout)/);
                if (match) {
                    const clientId = match[1];
                    console.log(`[ClientTracker] Removing client: ${clientId}`);
                    if (this.clients.has(clientId)) {
                        this.clients.delete(clientId);
                        this.emitUpdate();
                    } else {
                        console.log(`[ClientTracker] Client ${clientId} not found in map to remove. Current keys: ${Array.from(this.clients.keys()).join(', ')}`);
                    }
                } else {
                    console.log('[ClientTracker] Failed to match disconnect format');
                }
            }
        } catch (e) {
            console.error('Error parsing log line:', line, e);
        }
    }

    private emitUpdate() {
        this.onChange(Array.from(this.clients.values()));
    }

    public getClients() {
        return Array.from(this.clients.values());
    }
}
