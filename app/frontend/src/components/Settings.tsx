import React, { useRef, useState } from 'react';
import { Download, Upload, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { exportConfig, importConfig, uploadWebCerts } from '../api';

interface SettingsProps {
    onImportSuccess: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onImportSuccess }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Web Certs State
    const keyInputRef = useRef<HTMLInputElement>(null);
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
        } catch (error: any) {
            setImportStatus({ type: 'error', message: error.message });
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
        } catch (error: any) {
            setCertStatus({ type: 'error', message: error.message });
        } finally {
            setIsUploadingCerts(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
            </div>

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
                            />
                            <button
                                onClick={handleImportClick}
                                disabled={isImporting}
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
                        <Lock className="h-5 w-5" /> Web Interface Security (HTTPS)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Upload your own SSL certificates for the web interface (Port 3001). Requires restart.
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
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCertUpload}
                        disabled={isUploadingCerts}
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
