import { useState, useRef, useEffect } from 'react';
import type { AppState, Listener } from '../types';
import { Plus, Trash2, Upload, Download, Shield, Lock, Settings, ChevronDown, ChevronUp, Power } from 'lucide-react';
import { uploadCert, getDownloadUrl } from '../api';
import { InfoTooltip } from './InfoTooltip';
import { cn } from '../lib/utils';

const UploadButton = ({ onUpload }: { onUpload: (path: string) => void }) => {
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const result = await uploadCert(e.target.files[0]);
                if (result.success && result.path) {
                    onUpload(result.path);
                } else {
                    alert('Upload failed');
                }
            } catch (err) {
                console.error(err);
                alert('Upload error');
            }
        }
    };

    return (
        <label className="cursor-pointer p-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 inline-flex items-center justify-center" title="Upload Certificate">
            <input type="file" className="hidden" onChange={handleFileChange} />
            <Upload className="h-4 w-4" />
        </label>
    );
};

const DownloadButton = ({ path }: { path: string }) => (
    <a
        href={getDownloadUrl(path)}
        download
        className="p-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 inline-flex items-center justify-center"
        title="Download Certificate"
    >
        <Download className="h-4 w-4" />
    </a>
);

interface Props {
    state: AppState;
    setState: (state: AppState) => void;
}

export default function Listeners({ state, setState }: Props) {
    const [expandedListeners, setExpandedListeners] = useState<Record<number, boolean>>({});
    const listenersEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll when a new listener is added
    useEffect(() => {
        if (state.listeners.length > 0) {
            // Check if the last listener is new (e.g., default values)
            // Or just scroll if the count increased. 
            // For simplicity, we'll scroll if the last listener is expanded (which we'll do on add)
            // Actually, let's just scroll to bottom if we just added one.
            // We can track previous length to know if added.
        }
    }, [state.listeners.length]);

    const updateSettings = (key: keyof AppState['global_settings'], value: any) => {
        setState({
            ...state,
            global_settings: { ...state.global_settings, [key]: value }
        });
    };

    const updateGlobalCerts = (key: 'cafile' | 'certfile' | 'keyfile', value: string) => {
        const currentCerts = state.global_settings.certificates || { cafile: '', certfile: '', keyfile: '' };
        updateSettings('certificates', { ...currentCerts, [key]: value });
    };

    const addListener = () => {
        const newListener: Listener = {
            id: `listener-${Date.now()}`,
            bind_address: '0.0.0.0',
            protocol: 'mqtt',
            port: 1883 + state.listeners.length,
            mount_point: '',
            auth_option: 'none',
            acl_profile: '',
            require_certificate: false,
            use_identity_as_username: false,
            allow_anonymous: true,
            enabled: true
        };
        const newListeners = [...state.listeners, newListener];
        setState({
            ...state,
            listeners: newListeners
        });

        // Expand the new listener
        setExpandedListeners(prev => ({ ...prev, [newListeners.length - 1]: true }));

        // Scroll to bottom after render
        setTimeout(() => {
            listenersEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const removeListener = (index: number) => {
        if (confirm('Are you sure you want to delete this listener?')) {
            const newListeners = [...state.listeners];
            newListeners.splice(index, 1);
            setState({ ...state, listeners: newListeners });
        }
    };

    const updateListener = (index: number, field: keyof Listener, value: any) => {
        const newListeners = [...state.listeners];
        newListeners[index] = { ...newListeners[index], [field]: value };
        setState({ ...state, listeners: newListeners });
    };

    const toggleExpand = (index: number) => {
        setExpandedListeners(prev => ({ ...prev, [index]: !prev[index] }));
    };

    return (
        <div className="space-y-8 pb-10">
            {/* Global Settings */}
            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <div className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Settings className="h-5 w-5" /> Global Settings
                    </h3>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <div className="space-y-0.5">
                                <label className="text-base font-medium flex items-center gap-2">
                                    Persistence
                                    <InfoTooltip content="Save messages to disk so they survive restarts" />
                                </label>
                                <p className="text-sm text-muted-foreground">Save messages to disk</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={state.global_settings.persistence}
                                    onChange={(e) => updateSettings('persistence', e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm">Enable Persistence</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-medium flex items-center gap-2">
                                Log Destination
                                <InfoTooltip content="Where Mosquitto should write logs (e.g., file /path/to/log)" />
                            </label>
                            <input
                                type="text"
                                value={state.global_settings.log_dest}
                                onChange={(e) => updateSettings('log_dest', e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="file /mosquitto/log/mosquitto.log"
                            />
                        </div>
                    </div>

                    <div className="border-t pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                <Lock className="h-4 w-4" /> Global Certificates (TLS)
                            </h4>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center">
                                    CA File
                                    <InfoTooltip content="Path to the Certificate Authority file" />
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={state.global_settings.certificates?.cafile || ''}
                                        onChange={(e) => updateGlobalCerts('cafile', e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="/path/to/ca.crt"
                                    />
                                    <UploadButton onUpload={(path) => updateGlobalCerts('cafile', path)} />
                                    {state.global_settings.certificates?.cafile && <DownloadButton path={state.global_settings.certificates.cafile} />}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center">
                                    Cert File
                                    <InfoTooltip content="Path to the server certificate file" />
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={state.global_settings.certificates?.certfile || ''}
                                        onChange={(e) => updateGlobalCerts('certfile', e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="/path/to/server.crt"
                                    />
                                    <UploadButton onUpload={(path) => updateGlobalCerts('certfile', path)} />
                                    {state.global_settings.certificates?.certfile && <DownloadButton path={state.global_settings.certificates.certfile} />}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center">
                                    Key File
                                    <InfoTooltip content="Path to the server private key file" />
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={state.global_settings.certificates?.keyfile || ''}
                                        onChange={(e) => updateGlobalCerts('keyfile', e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="/path/to/server.key"
                                    />
                                    <UploadButton onUpload={(path) => updateGlobalCerts('keyfile', path)} />
                                    {state.global_settings.certificates?.keyfile && <DownloadButton path={state.global_settings.certificates.keyfile} />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Listeners
                </h2>
                <button
                    onClick={addListener}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add Listener
                </button>
            </div>

            <div className="grid gap-6">
                {state.listeners.map((listener, idx) => (
                    <div key={idx} className={cn("rounded-xl border bg-card text-card-foreground shadow transition-all", !listener.enabled && "opacity-60 grayscale-[0.5]")}>
                        <div className="bg-muted/50 p-4 flex justify-between items-center border-b rounded-t-xl">
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                    {listener.protocol.toUpperCase()}
                                </div>
                                <span className="font-mono text-sm font-medium">Port {listener.port}</span>
                                {!listener.enabled && <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded font-medium">Disabled</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => updateListener(idx, 'enabled', !listener.enabled)}
                                    className={cn("p-2 rounded-md transition-colors", listener.enabled ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30" : "text-muted-foreground hover:bg-muted")}
                                    title={listener.enabled ? "Disable Listener" : "Enable Listener"}
                                >
                                    <Power className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => toggleExpand(idx)}
                                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                    title={expandedListeners[idx] ? "Collapse" : "Expand"}
                                >
                                    {expandedListeners[idx] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                <button
                                    onClick={() => removeListener(idx)}
                                    className="p-2 text-destructive hover:text-destructive/80 transition-colors"
                                    title="Delete Listener"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {expandedListeners[idx] && (
                            <div className="p-6 grid gap-6 md:grid-cols-2 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Network</h4>
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium flex items-center">
                                                Protocol
                                                <InfoTooltip content="Protocol to use (MQTT, MQTTS, WS, WSS)" />
                                            </label>
                                            <select
                                                value={listener.protocol}
                                                onChange={(e) => updateListener(idx, 'protocol', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="mqtt">MQTT</option>
                                                <option value="mqtts">MQTTS (TLS)</option>
                                                {/* <option value="ws">WebSockets</option>
                                                <option value="wss">WebSockets Secure (TLS)</option> */}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium flex items-center">
                                                Port
                                                <InfoTooltip content="Port number to listen on" />
                                            </label>
                                            <input
                                                type="number"
                                                value={listener.port}
                                                onChange={(e) => updateListener(idx, 'port', parseInt(e.target.value))}
                                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium flex items-center">
                                                Mount Point
                                                <InfoTooltip content="Isolate this listener to a specific topic prefix (optional)" />
                                            </label>
                                            <input
                                                type="text"
                                                value={listener.mount_point}
                                                onChange={(e) => updateListener(idx, 'mount_point', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                placeholder="Optional"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Security & Access</h4>
                                    <div className="grid gap-4">
                                        {/* <div className="space-y-2">
                                            <label className="text-sm font-medium flex items-center">
                                                Authentication
                                                <InfoTooltip content="Method to authenticate clients" />
                                            </label>
                                            <select
                                                value={listener.auth_option}
                                                onChange={(e) => updateListener(idx, 'auth_option', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="none">None</option>
                                                <option value="password_file">Password File</option>
                                                <option value="acl_file">ACL File</option>
                                            </select>
                                        </div> */}

                                        {(listener.protocol === 'mqtts' || listener.protocol === 'wss') ? (
                                            <div className="space-y-4">
                                                <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/10">
                                                    Using Global Certificates
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium flex items-center gap-2">
                                                        TLS Version
                                                        <InfoTooltip content="Specific TLS version to support (e.g., tlsv1.2)" />
                                                    </label>
                                                    <select
                                                        value={listener.tls_version || ''}
                                                        onChange={(e) => updateListener(idx, 'tls_version', e.target.value)}
                                                        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <option value="">Default</option>
                                                        <option value="tlsv1.3">TLS v1.3</option>
                                                        <option value="tlsv1.2">TLS v1.2</option>
                                                        <option value="tlsv1.1">TLS v1.1</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={listener.allow_anonymous}
                                                        onChange={(e) => updateListener(idx, 'allow_anonymous', e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <label className="text-sm font-medium flex items-center gap-2">
                                                        Allow Anonymous
                                                        <InfoTooltip content="Allow connections without username/password" />
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={listener.require_certificate}
                                                        onChange={(e) => updateListener(idx, 'require_certificate', e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <label className="text-sm font-medium flex items-center gap-2">
                                                        Require Client Certificates
                                                        <InfoTooltip content="Clients must present a valid certificate signed by the CA" />
                                                    </label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={listener.use_identity_as_username}
                                                        onChange={(e) => updateListener(idx, 'use_identity_as_username', e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <label className="text-sm font-medium flex items-center gap-2">
                                                        Use Identity as Username
                                                        <InfoTooltip content="Use the CN from the client certificate as the username" />
                                                    </label>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={listener.allow_anonymous}
                                                        onChange={(e) => updateListener(idx, 'allow_anonymous', e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    />
                                                    <label className="text-sm font-medium flex items-center">
                                                        Allow Anonymous
                                                        <InfoTooltip content="Allow connections without username/password" />
                                                    </label>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium flex items-center">
                                                Access Profile
                                                <InfoTooltip content="Select an Access Profile to control topic access" />
                                            </label>
                                            <select
                                                value={listener.acl_profile}
                                                onChange={(e) => updateListener(idx, 'acl_profile', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="">None</option>
                                                {state.acl_profiles.map((p, i) => (
                                                    <option key={i} value={p.name}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div ref={listenersEndRef} />
        </div>
    );
}
