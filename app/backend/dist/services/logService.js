"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = void 0;
const tail_1 = require("tail");
const fs_1 = __importDefault(require("fs"));
class LogService {
    constructor(logFile, onLog) {
        this.tail = null;
        this.logFile = logFile;
        this.onLog = onLog;
    }
    start() {
        if (!fs_1.default.existsSync(this.logFile)) {
            try {
                fs_1.default.writeFileSync(this.logFile, '');
            }
            catch (e) {
                console.error('Could not create log file:', e);
                return;
            }
        }
        console.log(`Streaming logs from: ${this.logFile}`);
        // Use useWatchFile: true (polling) for reliable file watching in Docker volumes
        try {
            this.tail = new tail_1.Tail(this.logFile, {
                fromBeginning: true,
                useWatchFile: true,
                fsWatchOptions: { interval: 200 } // Check every 200ms
            });
            this.tail.on('line', (line) => {
                console.log('Log tail line:', line);
                this.onLog(line);
            });
            this.tail.on('error', (error) => {
                console.error('Log tail error:', error);
            });
            console.log('Log tail started successfully');
        }
        catch (error) {
            console.error('Failed to start log tail:', error);
        }
    }
}
exports.LogService = LogService;
