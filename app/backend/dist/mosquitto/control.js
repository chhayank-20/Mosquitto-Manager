"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restartMosquitto = exports.reloadMosquitto = void 0;
const fs_1 = __importDefault(require("fs"));
const PID_FILE = '/run/mosquitto.pid';
const reloadMosquitto = async () => {
    return new Promise((resolve, reject) => {
        if (!fs_1.default.existsSync(PID_FILE)) {
            console.warn('Mosquitto PID file not found. Cannot reload.');
            return resolve(); // Or reject? For now, just warn.
        }
        const pid = fs_1.default.readFileSync(PID_FILE, 'utf-8').trim();
        if (!pid) {
            return reject(new Error('Mosquitto PID file is empty.'));
        }
        console.log(`Sending SIGHUP to Mosquitto (PID: ${pid})...`);
        // Check if process exists
        try {
            process.kill(parseInt(pid), 0);
        }
        catch (e) {
            return reject(new Error(`Mosquitto process ${pid} not running.`));
        }
        // Send SIGHUP
        try {
            process.kill(parseInt(pid), 'SIGHUP');
            console.log('Mosquitto reloaded successfully.');
            resolve();
        }
        catch (e) {
            console.error('Failed to reload Mosquitto:', e);
            reject(e);
        }
    });
};
exports.reloadMosquitto = reloadMosquitto;
const restartMosquitto = async () => {
    return new Promise((resolve, reject) => {
        if (!fs_1.default.existsSync(PID_FILE)) {
            // If not running, maybe we can't restart it easily unless we have a supervisor.
            // But if we are in the container loop, killing it might trigger restart.
            return reject(new Error('Mosquitto PID file not found. Cannot restart.'));
        }
        const pid = fs_1.default.readFileSync(PID_FILE, 'utf-8').trim();
        console.log(`Sending SIGTERM to Mosquitto (PID: ${pid}) to trigger restart...`);
        try {
            process.kill(parseInt(pid), 'SIGTERM');
            // The entrypoint script should handle the restart if we modify it.
            // But currently it exits the container.
            // We need to wait and see if it comes back? 
            // Actually, if we modify entrypoint to loop, we can just kill it.
            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
};
exports.restartMosquitto = restartMosquitto;
