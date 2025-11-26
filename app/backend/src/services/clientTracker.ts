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
            // In a real app, we'd watch for file creation. 
            // For now, let's just try to create it or fail gracefully.
            try {
                fs.writeFileSync(this.logFile, '');
            } catch (e) {
                console.error('Could not create log file:', e);
                return;
            }
        }

        console.log(`Tracking clients via log: ${this.logFile}`);
        this.tail = new Tail(this.logFile);

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
            } else if (line.includes('disconnected')) {
                // Client client_id disconnected.
                const match = line.match(/Client ([^ ]+) disconnected/);
                if (match) {
                    const clientId = match[1];
                    this.clients.delete(clientId);
                    this.emitUpdate();
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
