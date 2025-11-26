import type { AppState, User } from '../types';
import { Users as UsersIcon, Plus, Trash2, Key } from 'lucide-react';

interface Props {
    state: AppState;
    setState: (state: AppState) => void;
}

export default function Users({ state, setState }: Props) {
    const addUser = () => {
        const newUser: User = {
            username: `user_${state.users.length + 1}`,
            password: 'password',
            enabled: true,
        };
        setState({
            ...state,
            users: [...state.users, newUser]
        });
    };

    const removeUser = (index: number) => {
        const newUsers = [...state.users];
        newUsers.splice(index, 1);
        setState({ ...state, users: newUsers });
    };

    const updateUser = (index: number, field: keyof User, value: any) => {
        const newUsers = [...state.users];
        newUsers[index] = { ...newUsers[index], [field]: value };
        setState({ ...state, users: newUsers });
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" /> Users
                </h2>
                <button
                    onClick={addUser}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                    <Plus className="mr-2 h-4 w-4" /> Add User
                </button>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <div className="p-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px]">Enabled</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Username</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Password</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {state.users.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">No users defined</td>
                                    </tr>
                                )}
                                {state.users.map((user, idx) => (
                                    <tr key={idx} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <td className="p-4 align-middle">
                                            <input
                                                type="checkbox"
                                                checked={user.enabled}
                                                onChange={(e) => updateUser(idx, 'enabled', e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                        </td>
                                        <td className="p-4 align-middle">
                                            <input
                                                type="text"
                                                value={user.username}
                                                onChange={(e) => updateUser(idx, 'username', e.target.value)}
                                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="relative">
                                                <Key className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    value={user.password}
                                                    onChange={(e) => updateUser(idx, 'password', e.target.value)}
                                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-8 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle text-right">
                                            <button
                                                onClick={() => removeUser(idx)}
                                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
