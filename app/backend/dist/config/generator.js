"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAclFiles = exports.generatePasswordFile = exports.generateMosquittoConf = void 0;
const generateMosquittoConf = (state) => {
    const lines = [];
    // Global settings
    lines.push('# ============================');
    lines.push('# Global Mosquitto Settings');
    lines.push('# ============================');
    lines.push('');
    lines.push('per_listener_settings true'); // Crucial for advanced config
    if (state.global_settings.persistence) {
        lines.push('persistence true');
        lines.push(`persistence_location ${state.global_settings.persistence_location}`);
        lines.push('autosave_interval 1800');
    }
    else {
        lines.push('persistence false');
    }
    lines.push('sys_interval 2'); // Publish $SYS stats every 2 seconds
    // Logging
    lines.push(`log_dest ${state.global_settings.log_dest}`);
    lines.push('log_dest stdout'); // Always log to stdout for Docker
    for (const type of state.global_settings.log_type) {
        lines.push(`log_type ${type}`);
    }
    lines.push('');
    // Listeners
    state.listeners.forEach(l => {
        if (l.enabled === false)
            return; // Skip disabled listeners
        lines.push(`# ===========================================================`);
        lines.push(`# Listener: ${l.id}`);
        lines.push(`# ===========================================================`);
        lines.push(`listener ${l.port} ${l.bind_address}`);
        // Protocol
        if (l.protocol === 'ws' || l.protocol === 'wss') {
            lines.push('protocol websockets');
        }
        else {
            lines.push('protocol mqtt');
        }
        // TLS
        // TLS
        if (l.protocol === 'mqtts' || l.protocol === 'wss') {
            if (state.global_settings.certificates) {
                if (state.global_settings.certificates.cafile)
                    lines.push(`cafile ${state.global_settings.certificates.cafile}`);
                if (state.global_settings.certificates.certfile)
                    lines.push(`certfile ${state.global_settings.certificates.certfile}`);
                if (state.global_settings.certificates.keyfile)
                    lines.push(`keyfile ${state.global_settings.certificates.keyfile}`);
            }
            if (l.tls_version)
                lines.push(`tls_version ${l.tls_version}`);
        }
        // Auth
        lines.push(`allow_anonymous ${l.allow_anonymous}`);
        if (l.require_certificate)
            lines.push('require_certificate true');
        if (l.use_identity_as_username)
            lines.push('use_identity_as_username true');
        // Password file (global or specific, but usually one file for all users)
        // If allow_anonymous is false, we generally need a password file unless using certs
        if (!l.allow_anonymous || l.password_file) {
            // Default to standard location if not specified but auth is on
            // Use secure internal location to avoid permission issues with mounted volumes
            const pwdFile = l.password_file ? l.password_file : '/etc/mosquitto/secure/passwordfile';
            lines.push(`password_file ${pwdFile}`);
        }
        // ACL
        if (l.acl_profile) {
            lines.push(`acl_file /etc/mosquitto/secure/acls/${l.acl_profile}.conf`);
        }
        lines.push('');
    });
    // Internal Listener for Backend Services (Stats, etc.)
    lines.push('# ===========================================================');
    lines.push('# Internal Listener (Backend)');
    lines.push('# ===========================================================');
    lines.push('listener 10883 127.0.0.1');
    lines.push('allow_anonymous false');
    lines.push('password_file /etc/mosquitto/secure/passwordfile');
    lines.push('');
    return lines.join('\n') + '\n';
};
exports.generateMosquittoConf = generateMosquittoConf;
const generatePasswordFile = (state) => {
    // Simple user:password format (plaintext/hashed)
    return state.users
        .filter(u => u.enabled)
        .map(u => `${u.username}:${u.password}`)
        .join('\n') + '\n';
};
exports.generatePasswordFile = generatePasswordFile;
const generateAclFiles = (state) => {
    const files = {};
    for (const profile of state.acl_profiles) {
        const lines = [];
        lines.push(`# Access Profile: ${profile.name}`);
        if (profile.description)
            lines.push(`# ${profile.description}`);
        lines.push('');
        for (const userEntry of profile.users) {
            lines.push(`user ${userEntry.username}`);
            for (const rule of userEntry.rules) {
                if (rule.type === 'topic') {
                    lines.push(`topic ${rule.access} ${rule.value}`);
                }
            }
            lines.push('');
        }
        files[`${profile.name}.conf`] = lines.join('\n');
    }
    return files;
};
exports.generateAclFiles = generateAclFiles;
