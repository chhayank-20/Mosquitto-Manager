"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveState = exports.loadState = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = process.env.DATA_DIR || path_1.default.join(__dirname, '../../data');
const STATE_FILE = path_1.default.join(DATA_DIR, 'state.json');
const defaultState = {
    global_settings: {
        persistence: true,
        persistence_location: '/mymosquitto/data/',
        log_dest: 'file /mymosquitto/mosquitto.log',
        log_type: ['error', 'warning', 'notice', 'information'],
    },
    listeners: [
        {
            id: 'default-1883',
            port: 1883,
            bind_address: '0.0.0.0',
            protocol: 'mqtt',
            allow_anonymous: true,
            require_certificate: false,
            use_identity_as_username: false,
        }
    ],
    users: [],
    acl_profiles: [],
    dashboard_users: [],
};
const loadState = () => {
    try {
        if (!fs_1.default.existsSync(STATE_FILE)) {
            console.log('State file not found, creating default.');
            (0, exports.saveState)(defaultState);
            return defaultState;
        }
        const data = fs_1.default.readFileSync(STATE_FILE, 'utf-8');
        let parsed = JSON.parse(data);
        // Simple migration check: if old schema, reset or migrate. 
        // Since this is a dev tool, we'll just check for a key property of new schema.
        if (!parsed.global_settings) {
            console.warn('Detected old state schema. Resetting to new default.');
            (0, exports.saveState)(defaultState);
            return defaultState;
        }
        return parsed;
    }
    catch (error) {
        console.error('Error loading state:', error);
        return defaultState;
    }
};
exports.loadState = loadState;
const saveState = (state) => {
    try {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs_1.default.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }
    catch (error) {
        console.error('Error saving state:', error);
        throw error;
    }
};
exports.saveState = saveState;
