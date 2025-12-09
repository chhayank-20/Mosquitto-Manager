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

        // 1. Read existing file content to restore state
        try {
            const content = fs.readFileSync(this.logFile, 'utf-8');
            const lines = content.split('\n');
            console.log(`Restoring client state from ${lines.length} log lines...`);
            lines.forEach(line => this.parseLine(line));
            this.emitUpdate(); // Emit initial state
        } catch (error) {
            console.error('Error reading existing log file:', error);
        }

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
            if (line.includes('New client connected')) {
                // Regex to extract info
                // ... as client_id (p2, c1, k60, u'username').
                // ... as client_id (p2, c1, k60).  <-- anonymous

                const clientMatch = line.match(/as ([^ ]+) \(/);
                const ipMatch = line.match(/from ([^:]+)/);
                const userMatch = line.match(/u'([^']+)'/);

                if (clientMatch && ipMatch) {
                    const clientId = clientMatch[1];
                    const ip = ipMatch[1];
                    const username = userMatch ? userMatch[1] : undefined;

                    this.clients.set(clientId, {
                        id: clientId,
                        ip,
                        username,
                        connectedAt: new Date()
                    });
                    this.emitUpdate();
                }
            } else if (line.includes('disconnected') || line.includes('closed its connection') || line.includes('has exceeded timeout')) {
                // Client client_id disconnected.
                // Client client_id closed its connection.
                // Client client_id has exceeded timeout
                const match = line.match(/Client ([^ ]+) (disconnected|closed its connection|has exceeded timeout)/);
                if (match) {
                    const clientId = match[1];
                    this.clients.delete(clientId);
                    this.emitUpdate();
                }
            } else if (line.includes('already connected, closing old connection')) {
                // Client client_id already connected, closing old connection.
                // This means the OLD connection is closed, but a NEW "New client connected" line usually follows or precedes.
                // If we delete it here, we might delete the NEW connection if the logs are out of order or if the map key is same.
                // Actually, "New client connected" overwrites the Map entry.
                // So "closing old connection" doesn't need to delete, because the new one is authoritative.
                // BUT if the new one happened *before* this line in processing?
                // Usually "New client connected" comes *before* or *after*?
                // Log:
                // New client ... as mqttx...
                // Client mqttx... already connected, closing old connection.
                // If "New" comes first, we add it. Then "closing old" comes. If we delete, we lose the new one.
                // So we should IGNORE "closing old connection" because the "New client" event is the source of truth for the *active* session.
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
