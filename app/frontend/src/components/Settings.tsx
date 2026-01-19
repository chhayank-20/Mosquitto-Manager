import { useRef, useState } from 'react';
import { Download, Upload, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { exportConfig, importConfig, uploadWebCerts, importLegacyConfig } from '../api';
import type { GlobalSettings as GlobalSettingsType } from '../types';

interface SettingsProps {
    onImportSuccess: () => void;
    onSave: () => Promise<void>;
    globalSettings: GlobalSettingsType;
    onUpdateGlobalSettings: (settings: GlobalSettingsType) => void;
    readOnly: boolean;
}

export const Settings: React.FC<SettingsProps> = ({ onImportSuccess, readOnly }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Web Certs State
    const keyInputRef = useRef<HTMLInputElement>(null);
    const legacyInputRef = useRef<HTMLInputElement>(null);
    const certInputRef = useRef<HTMLInputElement>(null);
    const [certStatus, setCertStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isUploadingCerts, setIsUploadingCerts] = useState(false);

    const handleExport = async () => {
        try {
            await exportConfig();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export configuration');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!confirm('WARNING: Importing a configuration will OVERWRITE your current settings (Listeners, Users, ACLs). This cannot be undone. Are you sure?')) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsImporting(true);
        setImportStatus(null);

        try {
            const result = await importConfig(file);
            setImportStatus({ type: 'success', message: result.message });
            // Clear input
            if (fileInputRef.current) fileInputRef.current.value = '';
            // Refresh parent state
            onImportSuccess();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setImportStatus({ type: 'error', message: errorMessage });
        } finally {
            setIsImporting(false);
        }
    };

    const handleCertUpload = async () => {
        const keyFile = keyInputRef.current?.files?.[0];
        const certFile = certInputRef.current?.files?.[0];

        if (!keyFile || !certFile) {
            setCertStatus({ type: 'error', message: 'Please select both Private Key and Certificate files.' });
            return;
        }

        setIsUploadingCerts(true);
        setCertStatus(null);

        try {
            await uploadWebCerts(keyFile, certFile);
            setCertStatus({ type: 'success', message: 'Certificates uploaded successfully! Please restart the container to apply changes.' });
            // Clear inputs
            if (keyInputRef.current) keyInputRef.current.value = '';
            if (certInputRef.current) certInputRef.current.value = '';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setCertStatus({ type: 'error', message: errorMessage });
        } finally {
            setIsUploadingCerts(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
            </div>

            {/* Global Configuration Section */}
            {/* <div className="bg-card text-card-foreground rounded-xl border shadow-sm">
                <div className="p-6 pb-4 flex justify-between items-center border-b">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Database className="h-5 w-5" /> Global Configuration
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Configure broker persistence and logging.
                        </p>
                    </div>
                    {!readOnly && (
                        isEditingGlobal ? (
                            <button
                                onClick={handleSaveGlobal}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
                            >
                                <Save className="h-4 w-4" /> Save Settings
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditingGlobal(true)}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors"
                            >
                                <Edit2 className="h-4 w-4" /> Edit Settings
                            </button>
                        )
                    )}
                </div>

                <div className="p-6 grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium flex items-center gap-2">
                                Persistence
                                <InfoTooltip content="Save messages to disk so they survive restarts" />
                            </label>
                            <p className="text-sm text-muted-foreground">Enable message durability.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={globalSettings.persistence}
                                disabled={readOnly || !isEditingGlobal}
                                onChange={(e) => updateGlobalSetting('persistence', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                            />
                            <span className={`text-sm ${(!isEditingGlobal || readOnly) ? 'text-muted-foreground' : ''}`}>Enable Persistence</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-medium flex items-center gap-2">
                            Persistence Location
                            <InfoTooltip content="Directory where persistence file is stored (internal)" />
                        </label>
                        <input
                            type="text"
                            value={globalSettings.persistence_location}
                            disabled
                            className="flex h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">Managed by Docker volume</p>
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-medium flex items-center gap-2">
                            Log Destination
                            <InfoTooltip content="Where Mosquitto should write logs" />
                        </label>
                        <input
                            type="text"
                            value={globalSettings.log_dest}
                            disabled={readOnly || !isEditingGlobal}
                            onChange={(e) => updateGlobalSetting('log_dest', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                </div>
            </div> */}

            <div className="bg-card text-card-foreground rounded-xl border shadow-sm">
                <div className="p-6 space-y-1">
                    <h3 className="text-lg font-semibold">Backup & Restore</h3>
                    <p className="text-sm text-muted-foreground">
                        Export your current configuration to a JSON file, or restore from a previous backup.
                    </p>
                </div>
                <div className="p-6 pt-0 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            Export Configuration
                        </button>

                        <div className="relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden"
                                disabled={readOnly}
                            />
                            <button
                                onClick={handleImportClick}
                                disabled={isImporting || readOnly}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Upload className="h-4 w-4" />
                                {isImporting ? 'Importing...' : 'Import Configuration'}
                            </button>
                        </div>
                    </div>

                    {importStatus && (
                        <div className={`p-4 rounded-md flex items-start gap-2 ${importStatus.type === 'success' ? 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300'
                            }`}>
                            {importStatus.type === 'success' ? (
                                <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                            ) : (
                                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                            )}
                            <div className="text-sm">{importStatus.message}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-card text-card-foreground rounded-xl border shadow-sm">
                <div className="p-6 space-y-1">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        Import Legacy Config (Migration)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Import an existing <code>mosquitto.conf</code> file. This will migrate Listeners, Persistence, and Logging settings.
                    </p>
                    <div className="p-2 text-xs bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 rounded border border-yellow-200 dark:border-yellow-800">
                        <strong>Warning:</strong> Users and ACLs are <u>NOT</u> imported (passwords are hashed differently). You must recreate them in the Users tab.
                    </div>
                </div>
                <div className="p-6 pt-0 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative">
                            <input
                                type="file"
                                ref={legacyInputRef}
                                disabled={readOnly}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    if (!confirm('This will OVERWRITE your current Listeners and Global Settings. Are you sure?')) {
                                        e.target.value = '';
                                        return;
                                    }

                                    try {
                                        const result = await importLegacyConfig(file);
                                        alert(result.message);
                                        // Reload page or refresh parent
                                        onImportSuccess(); // Re-use this to trigger reload
                                    } catch (err: unknown) {
                                        const errorMessage = err instanceof Error ? err.message : String(err);
                                        alert('Import failed: ' + errorMessage);
                                    }
                                    e.target.value = '';
                                }}
                                accept=".conf"
                                className="hidden"
                            />
                            <button
                                onClick={() => legacyInputRef.current?.click()}
                                disabled={readOnly}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Upload className="h-4 w-4" />
                                Import mosquitto.conf
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card text-card-foreground rounded-xl border shadow-sm">
                <div className="p-6 space-y-1">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Lock className="h-5 w-5" /> Web Interface Security (HTTPS)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Upload your own SSL certificates for the web interface. Requires restart.
                    </p>
                </div>
                <div className="p-6 pt-0 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Private Key (.key)
                            </label>
                            <input
                                type="file"
                                ref={keyInputRef}
                                accept=".key,.pem"
                                disabled={readOnly}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Certificate (.crt)
                            </label>
                            <input
                                type="file"
                                ref={certInputRef}
                                accept=".crt,.pem"
                                disabled={readOnly}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCertUpload}
                        disabled={isUploadingCerts || readOnly}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        <Upload className="h-4 w-4" />
                        {isUploadingCerts ? 'Uploading...' : 'Upload Certificates'}
                    </button>

                    {certStatus && (
                        <div className={`p-4 rounded-md flex items-start gap-2 ${certStatus.type === 'success' ? 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-300'
                            }`}>
                            {certStatus.type === 'success' ? (
                                <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                            ) : (
                                <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                            )}
                            <div className="text-sm">{certStatus.message}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
