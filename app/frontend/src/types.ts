export interface Listener {
    id: string;
    port: number;
    bind_address: string;
    protocol: 'mqtt' | 'mqtts' | 'ws' | 'wss';

    // TLS
    cafile?: string;
    certfile?: string;
    keyfile?: string;
    tls_version?: string;

    // Auth
    allow_anonymous: boolean;
    require_certificate: boolean;
    use_identity_as_username: boolean;
    password_file?: string;
    acl_profile?: string;
}

export interface User {
    username: string;
    password: string;
    enabled: boolean;
}

export interface AclRule {
    type: 'topic' | 'pattern';
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
