import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { AppState, CurrentUser, DashboardUser, BrokerStats, ConnectedClient } from './types';

const API_URL = import.meta.env.DEV ? 'http://localhost:3000/api' : '/api';
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';

// Add interceptor to handle 401s globally
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // If unauthorized, reload to trigger auth check / redirect to login
            // Only reload if we aren't already on the login page (or checking)
            // Ideally, clear user state
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

// Also wrap fetch for the same effect (since we use both)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (response.status === 401 && !args[0].toString().includes('/auth/me')) {
        // /auth/me 401 is expected on load, don't loop reload
        // But for other actions (save, apply), it means session died
        window.location.href = '/';
    }
    return response;
};

export const getState = async (): Promise<AppState> => {
    const response = await axios.get<AppState>(`${API_URL}/state`);
    return response.data;
};

// --- Auth ---

export const login = async (username: string, password: string): Promise<{ success: boolean; user?: CurrentUser; error?: string }> => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return response.json();
};

export const logout = async (): Promise<{ success: boolean; error?: string }> => {
    const response = await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
    return response.json();
};

export const getMe = async (): Promise<{ user: CurrentUser }> => {
    const response = await fetch(`${API_URL}/auth/me`);
    if (response.status === 401) throw new Error('Unauthorized');
    return response.json();
};

// --- Dashboard Users ---

export const getDashboardUsers = async (): Promise<DashboardUser[]> => {
    const response = await fetch(`${API_URL}/users/dashboard`);
    if (!response.ok) throw new Error('Failed to fetch dashboard users');
    return response.json();
};

export const addDashboardUser = async (user: { username: string; password: string; role: 'admin' | 'viewer' }) => {
    const response = await fetch(`${API_URL}/users/dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add user');
    }
    return response.json();
};

export const updateDashboardUser = async (username: string, updates: { password?: string; role?: 'admin' | 'viewer' }) => {
    const response = await fetch(`${API_URL}/users/dashboard/${username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update user');
    }
    return response.json();
};

export const deleteDashboardUser = async (username: string) => {
    const response = await fetch(`${API_URL}/users/dashboard/${username}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
    }
    return response.json();
};

// --- State ---

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

export const importLegacyConfig = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/settings/import-conf`, {
        method: 'POST',
        headers: {
            // 'Content-Type': 'multipart/form-data', // Fetch sets this automatically with boundary
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import legacy configuration');
    }
    return response.json();
};

export const uploadWebCerts = async (keyFile: File, certFile: File) => {
    const formData = new FormData();
    formData.append('key', keyFile);
    formData.append('cert', certFile);

    const response = await fetch(`${API_URL}/settings/web-certs`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload web certificates');
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
