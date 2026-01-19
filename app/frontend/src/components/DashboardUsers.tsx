import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Shield, User as UserIcon, Pencil, X } from 'lucide-react';

import { getDashboardUsers, addDashboardUser, deleteDashboardUser, updateDashboardUser } from '../api';

export const DashboardUsers: React.FC = () => {
    const [users, setUsers] = useState<{ username: string; role: string; is_default?: boolean }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form state
    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState<'admin' | 'viewer'>('viewer');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingUser, setEditingUser] = useState<string | null>(null);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await getDashboardUsers();
            setUsers(data);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError('Failed to load users: ' + errorMessage);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const startEdit = (user: { username: string; role: string }) => {
        setEditingUser(user.username);
        setFormUsername(user.username);
        setFormPassword(''); // Reset password for security/placeholder
        setFormRole(user.role as 'admin' | 'viewer');
        setError('');
    };

    const cancelEdit = () => {
        setEditingUser(null);
        setFormUsername('');
        setFormPassword('');
        setFormRole('viewer');
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            if (editingUser) {
                // Update mode
                await updateDashboardUser(editingUser, {
                    password: formPassword,
                    role: formRole
                });
            } else {
                // Add mode
                await addDashboardUser({
                    username: formUsername,
                    password: formPassword,
                    role: formRole
                });
            }

            // Success cleanup
            cancelEdit();
            loadUsers();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async (username: string) => {
        if (!confirm(`Are you sure you want to delete dashboard user "${username}"?`)) return;
        try {
            await deleteDashboardUser(username);
            loadUsers();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            alert(errorMessage);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Dashboard Users</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* User List */}
                <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <UserIcon className="h-5 w-5" /> Existing Users
                    </h3>

                    {loading ? (
                        <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : (
                        <div className="space-y-2">
                            {users.map(user => (
                                <div key={user.username} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {user.role === 'admin' ? <Shield className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm flex items-center gap-2">
                                                {user.username}
                                                {user.is_default && (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!user.is_default && (
                                            <>
                                                <button
                                                    onClick={() => startEdit(user)}
                                                    className="text-muted-foreground hover:text-primary p-2 hover:bg-muted rounded-md transition-colors"
                                                    title="Edit User"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user.username)}
                                                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                        {user.is_default && (
                                            <div className="px-2">
                                                <LockIcon className="h-4 w-4 text-muted-foreground opacity-50" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {users.length === 0 && <div className="text-sm text-muted-foreground">No users found.</div>}
                        </div>
                    )}
                </div>

                {/* Add/Edit User Form */}
                <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6 h-fit">
                    <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {editingUser ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                            {editingUser ? 'Edit User' : 'Add New User'}
                        </div>
                        {editingUser && (
                            <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <X className="h-3 w-3" /> Cancel
                            </button>
                        )}
                    </h3>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Username</label>
                            <input
                                type="text"
                                required
                                disabled={!!editingUser} // Cannot change username when editing
                                value={formUsername}
                                onChange={e => setFormUsername(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="jdoe"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <input
                                type="password"
                                required={!editingUser} // Required only for new users
                                value={formPassword}
                                onChange={e => setFormPassword(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <select
                                value={formRole}
                                onChange={e => setFormRole(e.target.value as 'admin' | 'viewer')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="viewer">Viewer (Read Only)</option>
                                <option value="admin">Admin (Full Access)</option>
                            </select>
                        </div>

                        {error && <div className="text-sm text-red-500">{error}</div>}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : (editingUser ? 'Update User' : 'Create User')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Simple Lock icon locally defined if not imported or use Lucide's Lock
function LockIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}
