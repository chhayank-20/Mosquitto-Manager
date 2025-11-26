import type { AppState, Listener } from '../types';
import { Settings, Wifi, Shield, Lock, Plus, Trash2, Upload, Download } from 'lucide-react';
import { generateCerts, uploadCert, getDownloadUrl } from '../api';
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
        <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9">
            <input type="file" className="hidden" onChange={handleFileChange} />
            <Upload className="h-4 w-4" />
        </label>
    );
};

const DownloadButton = ({ path }: { path: string }) => {
    return (
        <a
            href={getDownloadUrl(path)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
        >
            <Download className="h-4 w-4" />
        </a>
    );
};

interface Props {
    state: AppState;
    setState: (state: AppState) => void;
}

export default function Listeners({ state, setState }: Props) {
    const updateSettings = (key: keyof AppState['global_settings'], value: any) => {
        setState({
            ...state,
            global_settings: { ...state.global_settings, [key]: value }
        });
    };

    const addListener = () => {
        const newListener: Listener = {
            id: `listener-${Date.now()}`,
            port: 1884,
            bind_address: '0.0.0.0',
            protocol: 'mqtt',
            allow_anonymous: false,
            require_certificate: false,
            use_identity_as_username: false,
        };
        setState({
            ...state,
            listeners: [...state.listeners, newListener]
        });
    };

    const removeListener = (index: number) => {
        const newListeners = [...state.listeners];
        newListeners.splice(index, 1);
        setState({ ...state, listeners: newListeners });
    };

    const updateListener = (index: number, field: keyof Listener, value: any) => {
        const newListeners = [...state.listeners];
        newListeners[index] = { ...newListeners[index], [field]: value };
        setState({ ...state, listeners: newListeners });
    };

    

    return (
        <div className="space-y-8">
            {/* Global Settings */}
            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2 border-b">
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold leading-none tracking-tight">Global Settings</h3>
                    </div>
                </div>
                <div className="p-6 grid gap-6 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium">Persistence</label>
                            <p className="text-sm text-muted-foreground">Save messages to disk</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={state.global_settings.persistence}
                            onChange={(e) => updateSettings('persistence', e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Log Destination</label>
                        <input
                            type="text"
                            value={state.global_settings.log_dest}
                            onChange={(e) => updateSettings('log_dest', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            {/* Listeners */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                        <Wifi className="h-5 w-5" /> Listeners
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
                        <div key={listener.id} className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
                            <div className="bg-muted/50 p-4 flex justify-between items-center border-b">
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-2 w-2 rounded-full", (listener.protocol === 'mqtts' || listener.protocol === 'wss') ? "bg-green-500" : "bg-orange-500")} />
                                    <span className="font-medium">Port {listener.port}</span>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded font-medium",
                                        (listener.protocol === 'ws' || listener.protocol === 'wss') ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    )}>
                                        {listener.protocol.toUpperCase()}
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeListener(idx)}
                                    className="text-destructive hover:text-destructive/80 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Network</h4>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Port</label>
                                        <input
                                            type="number"
                                            value={listener.port}
                                            onChange={(e) => updateListener(idx, 'port', parseInt(e.target.value))}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Bind Address</label>
                                        <input
                                            type="text"
                                            value={listener.bind_address}
                                            onChange={(e) => updateListener(idx, 'bind_address', e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Protocol</label>
                                        <select
                                            value={listener.protocol}
                                            onChange={(e) => updateListener(idx, 'protocol', e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="mqtt">MQTT</option>
                                            <option value="mqtts">MQTTS</option>
                                            <option value="ws">WS</option>
                                            <option value="wss">WSS</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Security */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Lock className="h-3 w-3" /> Security (TLS)
                                    </h4>

                                    {(listener.protocol === 'mqtts' || listener.protocol === 'wss') ? (
                                        <>
                                            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">TLS Configured via Protocol</span>
                                                    
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">CA File</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={listener.cafile || ''}
                                                        onChange={(e) => updateListener(idx, 'cafile', e.target.value)}
                                                        placeholder="/etc/mosquitto/certs/ca.crt"
                                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    <UploadButton onUpload={(path) => updateListener(idx, 'cafile', path)} />
                                                    {listener.cafile && <DownloadButton path={listener.cafile} />}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Cert File</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={listener.certfile || ''}
                                                        onChange={(e) => updateListener(idx, 'certfile', e.target.value)}
                                                        placeholder="/etc/mosquitto/certs/server.crt"
                                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    <UploadButton onUpload={(path) => updateListener(idx, 'certfile', path)} />
                                                    {listener.certfile && <DownloadButton path={listener.certfile} />}
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Key File</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={listener.keyfile || ''}
                                                        onChange={(e) => updateListener(idx, 'keyfile', e.target.value)}
                                                        placeholder="/etc/mosquitto/certs/server.key"
                                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    <UploadButton onUpload={(path) => updateListener(idx, 'keyfile', path)} />
                                                    {listener.keyfile && <DownloadButton path={listener.keyfile} />}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-muted-foreground italic p-4 border rounded-md">
                                            Select MQTTS or WSS protocol to enable TLS configuration.
                                        </div>
                                    )}
                                </div>

                                {/* Auth */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                        <Shield className="h-3 w-3" /> Authentication
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={listener.allow_anonymous}
                                                onChange={(e) => updateListener(idx, 'allow_anonymous', e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <label className="text-sm font-medium">Allow Anonymous</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={listener.require_certificate}
                                                onChange={(e) => updateListener(idx, 'require_certificate', e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <label className="text-sm font-medium">Require Client Certificates</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={listener.use_identity_as_username}
                                                onChange={(e) => updateListener(idx, 'use_identity_as_username', e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <label className="text-sm font-medium">Use Identity as Username</label>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <label className="text-sm font-medium">Access Profile</label>
                                            <select
                                                value={listener.acl_profile || ''}
                                                onChange={(e) => updateListener(idx, 'acl_profile', e.target.value)}
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <option value="">None</option>
                                                {state.acl_profiles.map(p => (
                                                    <option key={p.name} value={p.name}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
