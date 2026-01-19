import { AppState, Listener, GlobalSettings } from './stateStore';

export const parseMosquittoConf = (confContent: string): Partial<AppState> => {
    const lines = confContent.split('\n');
    const newState: Partial<AppState> = {
        listeners: [],
        global_settings: {} as GlobalSettings
    };

    let currentListener: Listener | null = null;
    let persistence = false;
    let persistenceLocation = '/mymosquitto/data/';
    let logDest = '';

    // We strictly enforce the internal listener for backend service communication
    // This is NOT imported from the file but hardcoded/injected.
    const internalListener: Listener = {
        id: 'internal-10883',
        port: 10883,
        bind_address: '127.0.0.1',
        protocol: 'mqtt',
        allow_anonymous: false,
        require_certificate: false,
        use_identity_as_username: false,
        password_file: '/etc/mosquitto/secure/passwordfile',
        enabled: true
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const parts = trimmed.split(/\s+/);
        const key = parts[0];

        if (key === 'listener') {
            // listener port [bind_address]
            if (currentListener) {
                if (newState.listeners) newState.listeners.push(currentListener);
            }
            const port = parseInt(parts[1], 10);
            const bindAddress = parts[2] || '0.0.0.0';

            // Ignore if it conflicts with internal port (though unlikely in user config)
            if (port === 10883) return;

            currentListener = {
                id: `imported-${port}-${Date.now()}`,
                port: port,
                bind_address: bindAddress,
                protocol: 'mqtt', // Default, detected further via cafile etc if needed
                allow_anonymous: false, // Default secure, but check further
                require_certificate: false,
                use_identity_as_username: false,
                enabled: true
            };
        } else if (key === 'persistence') {
            persistence = parts[1] === 'true';
        } else if (key === 'persistence_location') {
            persistenceLocation = parts[1];
        } else if (key === 'log_dest') {
            // can be multiple, simple approach: take the last one or concat?
            // AppState only stores one string for now (simple UI)
            // If strictly file...
            logDest = `${parts[1]} ${parts.slice(2).join(' ')}`;
        } else if (currentListener) {
            // Listener specific settings
            if (key === 'allow_anonymous') {
                currentListener.allow_anonymous = parts[1] === 'true';
            } else if (key === 'password_file') {
                // We overwrite this to our internal secure path later, but conceptually we import the intent
                // Actually, we use the single global password file for all listeners in this simple manager.
                // So we ignore custom password files defined per listener and enforce the system one.
                // But we can flag that auth is required.
                currentListener.auth_option = 'password_file';
            } else if (key === 'cafile' || key === 'certfile' || key === 'keyfile') {
                // TLS detected
                if (currentListener.port === 8883) currentListener.protocol = 'mqtts';
                currentListener.require_certificate = true;
                // We don't import the actual paths because certificates need to be uploaded via UI to the right place
            }
        }
    });

    // Push last listener
    if (currentListener && newState.listeners) {
        newState.listeners.push(currentListener);
    }

    // Always ensure standard 1883 exists if not imported
    if (!newState.listeners?.find(l => l.port === 1883)) {
        newState.listeners?.push({
            id: 'default-1883',
            port: 1883,
            bind_address: '0.0.0.0',
            protocol: 'mqtt',
            allow_anonymous: true,
            require_certificate: false,
            use_identity_as_username: false,
            enabled: true
        });
    }

    // Inject internal listener
    newState.listeners?.push(internalListener);

    newState.global_settings = {
        persistence,
        persistence_location: persistenceLocation,
        log_dest: logDest || 'file /mymosquitto/mosquitto.log',
        log_type: ['error', 'warning', 'notice', 'information'] // Default
    };

    return newState;
};
