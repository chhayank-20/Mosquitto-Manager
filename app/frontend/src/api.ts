import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { AppState, BrokerStats, ConnectedClient } from './types';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';

export const getState = async (): Promise<AppState> => {
    const response = await axios.get<AppState>(`${API_URL}/state`);
    return response.data;
};

export const applyConfig = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await fetch(`${API_URL}/apply`, {
        method: 'POST',
    });
    return response.json();
};

export const fetchLogs = async (): Promise<string[]> => {
    const response = await fetch(`${API_URL}/logs`);
    const data = await response.json();
    return data.logs || [];
};

export const generateCerts = async (): Promise<{ success: boolean; paths?: { ca: string; serverCert: string; serverKey: string } }> => {
    const response = await fetch(`${API_URL}/certs/generate`, { method: 'POST' });
    return response.json();
};

export const uploadCert = async (file: File): Promise<{ success: boolean; path?: string; error?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/certs/upload`, {
        method: 'POST',
        body: formData,
    });
    return response.json();
};

export const getDownloadUrl = (path: string): string => {
    return `${API_URL}/certs/download?path=${encodeURIComponent(path)}`;
};

export const exportConfig = async () => {
    const response = await fetch(`${API_URL}/backup/export`, {
    });
    if (!response.ok) {
        throw new Error('Failed to export configuration');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mosquitto-manager-config.json';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

export const importConfig = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/backup/import`, {
        method: 'POST',
        headers: {
            // 'Content-Type': 'multipart/form-data', // Fetch sets this automatically with boundary
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import configuration');
    }
    return response.json();
};

export const saveState = async (state: AppState): Promise<void> => {
    await axios.post(`${API_URL}/state`, state);
};

export const initSocket = (
    onStats: (stats: BrokerStats) => void,
    onClients: (clients: ConnectedClient[]) => void,
    onLog?: (line: string) => void
): Socket => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
        console.log('Connected to backend socket');
    });

    socket.on('stats', (stats: BrokerStats) => {
        onStats(stats);
    });

    socket.on('clients', (clients: ConnectedClient[]) => {
        onClients(clients);
    });

    if (onLog) {
        socket.on('logs', (line: string) => {
            onLog(line);
        });
    }

    return socket;
};
