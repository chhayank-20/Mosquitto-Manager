import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

export interface Listener {
    id: string;
    port: number;
    bind_address: string; // e.g. "0.0.0.0" or "10.10.131.131"
    protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';

    // TLS
    tls_version?: string;
    mount_point?: string;
    auth_option?: string;

    // Auth
    allow_anonymous: boolean;
    require_certificate: boolean;
    use_identity_as_username: boolean;
    password_file?: string; // Usually fixed to /etc/mosquitto/passwd but configurable
    acl_profile?: string; // Name of the ACL profile to use
    enabled?: boolean;
}

export interface User {
    username: string;
    password: string; // Plaintext for now, generator handles hashing if needed
    enabled: boolean;
}

export interface AclRule {
    type: 'topic';
    access: 'read' | 'write' | 'readwrite';
    value: string;
}

export interface AclProfile {
    name: string;
    description?: string;
    users: {
        username: string; // Reference to a User or external CN
        rules: AclRule[];
    }[];
}

export interface GlobalSettings {
    persistence: boolean;
    persistence_location: string;
    log_dest: string;
    log_type: string[]; // error, warning, notice, etc.
    certificates?: {
        cafile: string;
        certfile: string;
        keyfile: string;
    };
}

export interface AppState {
    global_settings: GlobalSettings;
    listeners: Listener[];
    users: User[];
    acl_profiles: AclProfile[];
}

const defaultState: AppState = {
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
};

export const loadState = (): AppState => {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            console.log('State file not found, creating default.');
            saveState(defaultState);
            return defaultState;
        }
        const data = fs.readFileSync(STATE_FILE, 'utf-8');
        let parsed = JSON.parse(data);

        // Simple migration check: if old schema, reset or migrate. 
        // Since this is a dev tool, we'll just check for a key property of new schema.
        if (!parsed.global_settings) {
            console.warn('Detected old state schema. Resetting to new default.');
            saveState(defaultState);
            return defaultState;
        }

        return parsed;
    } catch (error) {
        console.error('Error loading state:', error);
        return defaultState;
    }
};

export const saveState = (state: AppState): void => {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error saving state:', error);
        throw error;
    }
};
