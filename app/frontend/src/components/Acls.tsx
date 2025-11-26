import type { AppState, AclProfile, AclRule } from '../types';
import { Shield, Plus, Trash2, FileText } from 'lucide-react';


interface Props {
    state: AppState;
    setState: (state: AppState) => void;
}

export default function Acls({ state, setState }: Props) {
    const addProfile = () => {
        const newProfile: AclProfile = {
            name: `profile_${state.acl_profiles.length + 1}`,
            description: 'New Access Profile',
            users: []
        };
        setState({
            ...state,
            acl_profiles: [...state.acl_profiles, newProfile]
        });
    };

    const removeProfile = (index: number) => {
        const newProfiles = [...state.acl_profiles];
        newProfiles.splice(index, 1);
        setState({ ...state, acl_profiles: newProfiles });
    };

    const updateProfile = (index: number, field: keyof AclProfile, value: any) => {
        const newProfiles = [...state.acl_profiles];
        newProfiles[index] = { ...newProfiles[index], [field]: value };
        setState({ ...state, acl_profiles: newProfiles });
    };

    const addUserToProfile = (profileIndex: number) => {
        const newProfiles = [...state.acl_profiles];
        newProfiles[profileIndex].users.push({
            username: 'new_user',
            rules: [{ type: 'topic', access: 'readwrite', value: '#' }]
        });
        setState({ ...state, acl_profiles: newProfiles });
    };

    const removeUserFromProfile = (profileIndex: number, userIndex: number) => {
        const newProfiles = [...state.acl_profiles];
        newProfiles[profileIndex].users.splice(userIndex, 1);
        setState({ ...state, acl_profiles: newProfiles });
    };

    const updateUserInProfile = (profileIndex: number, userIndex: number, field: string, value: any) => {
        const newProfiles = [...state.acl_profiles];
        // @ts-ignore
        newProfiles[profileIndex].users[userIndex][field] = value;
        setState({ ...state, acl_profiles: newProfiles });
    };

    const updateRule = (profileIndex: number, userIndex: number, ruleIndex: number, field: keyof AclRule, value: any) => {
        const newProfiles = [...state.acl_profiles];
        newProfiles[profileIndex].users[userIndex].rules[ruleIndex] = {
            ...newProfiles[profileIndex].users[userIndex].rules[ruleIndex],
            [field]: value
        };
        setState({ ...state, acl_profiles: newProfiles });
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    <Shield className="h-5 w-5" /> ACL Profiles
                </h2>
                <button
                    onClick={addProfile}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                    <Plus className="mr-2 h-4 w-4" /> Create Profile
                </button>
            </div>

            <div className="grid gap-6">
                {state.acl_profiles.map((profile, pIdx) => (
                    <div key={pIdx} className="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
                        <div className="bg-muted/50 p-4 flex justify-between items-center border-b">
                            <div className="flex items-center gap-4 flex-1">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div className="flex flex-col gap-1 flex-1">
                                    <input
                                        type="text"
                                        value={profile.name}
                                        onChange={(e) => updateProfile(pIdx, 'name', e.target.value)}
                                        className="font-medium bg-transparent border-none p-0 focus:ring-0 h-auto text-base"
                                        placeholder="Profile Name"
                                    />
                                    <input
                                        type="text"
                                        value={profile.description}
                                        onChange={(e) => updateProfile(pIdx, 'description', e.target.value)}
                                        className="text-sm text-muted-foreground bg-transparent border-none p-0 focus:ring-0 h-auto"
                                        placeholder="Description"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => removeProfile(pIdx)}
                                className="text-destructive hover:text-destructive/80 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {profile.users.map((user, uIdx) => (
                                <div key={uIdx} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">User:</span>
                                            <input
                                                type="text"
                                                value={user.username}
                                                onChange={(e) => updateUserInProfile(pIdx, uIdx, 'username', e.target.value)}
                                                className="flex h-8 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeUserFromProfile(pIdx, uIdx)}
                                            className="text-xs text-destructive hover:underline"
                                        >
                                            Remove User
                                        </button>
                                    </div>

                                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                                        {user.rules.map((rule, rIdx) => (
                                            <div key={rIdx} className="flex gap-2 items-center">
                                                <select
                                                    value={rule.type}
                                                    onChange={(e) => updateRule(pIdx, uIdx, rIdx, 'type', e.target.value)}
                                                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                                                >
                                                    <option value="topic">Topic</option>
                                                    <option value="pattern">Pattern</option>
                                                </select>
                                                <select
                                                    value={rule.access}
                                                    onChange={(e) => updateRule(pIdx, uIdx, rIdx, 'access', e.target.value)}
                                                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                                                >
                                                    <option value="read">Read</option>
                                                    <option value="write">Write</option>
                                                    <option value="readwrite">Read/Write</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={rule.value}
                                                    onChange={(e) => updateRule(pIdx, uIdx, rIdx, 'value', e.target.value)}
                                                    className="flex-1 h-8 rounded-md border border-input bg-transparent px-3 text-xs"
                                                />
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => {
                                                const newProfiles = [...state.acl_profiles];
                                                newProfiles[pIdx].users[uIdx].rules.push({ type: 'topic', access: 'read', value: '' });
                                                setState({ ...state, acl_profiles: newProfiles });
                                            }}
                                            className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Plus className="h-3 w-3" /> Add Rule
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => addUserToProfile(pIdx)}
                                className="w-full py-2 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="h-4 w-4" /> Add User Block
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
