import { Tail } from 'tail';
import fs from 'fs';

export class LogService {
    private logFile: string;
    private tail: Tail | null = null;
    private onLog: (line: string) => void;

    constructor(logFile: string, onLog: (line: string) => void) {
        this.logFile = logFile;
        this.onLog = onLog;
    }

    public start() {
        if (!fs.existsSync(this.logFile)) {
            try {
                fs.writeFileSync(this.logFile, '');
            } catch (e) {
                console.error('Could not create log file:', e);
                return;
            }
        }

        console.log(`Streaming logs from: ${this.logFile}`);
        this.tail = new Tail(this.logFile, { fromBeginning: true }); // Send existing logs too? Maybe just tail.

        this.tail.on('line', (line: string) => {
            this.onLog(line);
        });

        this.tail.on('error', (error: any) => {
            console.error('Log tail error:', error);
        });
    }
}
