import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';
import { login } from '../api';
import type { CurrentUser } from '../types';

interface LoginProps {
    onLoginSuccess: (user: CurrentUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await login(username, password);
            if (result.success && result.user) {
                onLoginSuccess(result.user);
            } else {
                setError(result.error || 'Invalid credentials');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError('Login failed: ' + errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
            <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800">
                <div className="text-center">
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                        Mosquitto Manager
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Sign in to access the dashboard
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                required
                                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                            <input
                                type="password"
                                required
                                className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3 py-2 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900/50 text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>
                </form>
                <div className="text-center text-xs text-gray-400">
                    If this is your first time, use the credentials set in your environment variables.
                </div>
            </div>
        </div>
    );
};
