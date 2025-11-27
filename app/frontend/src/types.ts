export interface Listener {
    id: string;
    port: number;
    bind_address: string;
    protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';

    // TLS
    tls_version?: string;

    // Auth
    allow_anonymous: boolean;
    require_certificate: boolean;
    use_identity_as_username: boolean;
    password_file?: string;
    acl_profile?: string;
    enabled?: boolean; // Default true if undefined
    mount_point?: string;
    auth_option?: string; // UI helper: 'none' | 'password_file' | 'acl_file'
}

export interface User {
    username: string;
    password: string;
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
        username: string;
        rules: AclRule[];
    }[];
}

export interface GlobalSettings {
    persistence: boolean;
    persistence_location: string;
    log_dest: string;
    log_type: string[];
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

export interface BrokerStats {
    uptime: number;
    clientsTotal: number;
    clientsActive: number;
    messagesSent: number;
    messagesReceived: number;
    loadMessagesReceived1min: number;
    loadMessagesSent1min: number;
    bytesReceived: number;
    bytesSent: number;
}

export interface ConnectedClient {
    id: string;
    ip: string;
    username?: string;
    connectedAt: string; // Date string over wire
}
