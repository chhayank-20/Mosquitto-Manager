import { useState } from 'react';
import type { AppState, User } from '../types';
import { Plus, Trash2, Users as UsersIcon, Eye, EyeOff } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';


interface Props {
    state: AppState;
    setState: (state: AppState) => void;
    onSave: () => Promise<void>;
    readOnly: boolean;
}

export default function Users({ state, setState, onSave, readOnly }: Props) {
    const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});
    const [editingRow, setEditingRow] = useState<number | null>(null);

    const addUser = () => {
        const newUser: User = {
            username: `user${state.users.length + 1}`,
            password: 'password',
            enabled: true
        };
        setState({
            ...state,
            users: [...state.users, newUser]
        });
    };

    const removeUser = (index: number) => {
        if (confirm('Are you sure you want to delete this user?')) {
            const newUsers = [...state.users];
            newUsers.splice(index, 1);
            setState({ ...state, users: newUsers });
        }
    };

    const updateUser = (index: number, field: keyof User, value: string | boolean) => {
        const newUsers = [...state.users];
        newUsers[index] = { ...newUsers[index], [field]: value };
        setState({ ...state, users: newUsers });
    };

    const togglePassword = (index: number) => {
        setVisiblePasswords(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const handleSaveRow = async () => {
        await onSave();
        setEditingRow(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" /> Users
                </h2>
                {!readOnly && (
                    <button
                        onClick={addUser}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Add User
                    </button>
                )}
            </div>

            <div className="rounded-md border">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="h-12 px-4 align-middle font-medium">
                                <div className="flex items-center gap-2">
                                    Enabled
                                    <InfoTooltip content="Enable or disable this user account" />
                                </div>
                            </th>
                            <th className="h-12 px-4 align-middle font-medium">
                                <div className="flex items-center gap-2">
                                    Username
                                    <InfoTooltip content="Unique username for MQTT authentication" />
                                </div>
                            </th>
                            <th className="h-12 px-4 align-middle font-medium">
                                <div className="flex items-center gap-2">
                                    Password
                                    <InfoTooltip content="Password for this user" />
                                </div>
                            </th>
                            <th className="h-12 px-4 align-middle font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.users.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-4 text-center text-muted-foreground">No users defined</td>
                            </tr>
                        )}
                        {state.users.map((user, idx) => (
                            <tr key={idx} className="border-t hover:bg-muted/50 transition-colors">
                                <td className="p-4 align-middle">
                                    <input
                                        type="checkbox"
                                        checked={user.enabled}
                                        disabled={readOnly || editingRow !== idx}
                                        onChange={(e) => updateUser(idx, 'enabled', e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                                    />
                                </td>
                                <td className="p-4 align-middle">
                                    <input
                                        type="text"
                                        value={user.username}
                                        disabled={readOnly || editingRow !== idx}
                                        onChange={(e) => updateUser(idx, 'username', e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-w-[200px] disabled:border-transparent disabled:shadow-none disabled:px-0"
                                    />
                                </td>
                                <td className="p-4 align-middle">
                                    <div className="flex items-center gap-2 max-w-[300px]">
                                        <input
                                            type={visiblePasswords[idx] ? "text" : "password"}
                                            value={user.password}
                                            disabled={readOnly || editingRow !== idx}
                                            onChange={(e) => updateUser(idx, 'password', e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:border-transparent disabled:shadow-none disabled:px-0"
                                        />
                                        <button
                                            onClick={() => togglePassword(idx)}
                                            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                            title={visiblePasswords[idx] ? "Hide Password" : "Show Password"}
                                        >
                                            {visiblePasswords[idx] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </td>
                                <td className="p-4 align-middle text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {!readOnly && (
                                            <>
                                                {editingRow === idx ? (
                                                    <button
                                                        onClick={handleSaveRow}
                                                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
                                                    >
                                                        Save
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingRow(idx)}
                                                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => removeUser(idx)}
                                                    className="text-destructive hover:text-destructive/80 transition-colors p-2"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
