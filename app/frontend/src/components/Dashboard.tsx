import type { BrokerStats, ConnectedClient, Listener } from '../types';
import { Activity, Users, Clock, Server, Network } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
    stats: BrokerStats | null;
    clients: ConnectedClient[];
    listeners: Listener[];
}

export default function Dashboard({ stats, clients, listeners }: Props) {
    if (!stats) {
        return <div className="p-8 text-center text-muted-foreground">Waiting for broker stats...</div>;
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (seconds: number) => {
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    };

    const cards = [
        {
            title: 'Active Clients',
            value: stats.clientsActive,
            subValue: `Total: ${stats.clientsTotal}`,
            icon: Users,
            color: 'text-blue-500',
        },
        {
            title: 'Uptime',
            value: formatUptime(stats.uptime),
            icon: Clock,
            color: 'text-green-500',
        },
        {
            title: 'Messages (1min)',
            value: `${stats.loadMessagesReceived1min.toFixed(2)} / ${stats.loadMessagesSent1min.toFixed(2)}`,
            subValue: 'Rx / Tx',
            icon: Activity,
            color: 'text-orange-500',
        },
        {
            title: 'Traffic',
            value: formatBytes(stats.bytesReceived + stats.bytesSent),
            subValue: `Rx: ${formatBytes(stats.bytesReceived)} | Tx: ${formatBytes(stats.bytesSent)}`,
            icon: Server,
            color: 'text-purple-500',
        },
    ];

    return (
        <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card, i) => (
                    <div key={i} className="rounded-xl border bg-card text-card-foreground shadow p-6">
                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <h3 className="tracking-tight text-sm font-medium text-muted-foreground">{card.title}</h3>
                            <card.icon className={cn("h-4 w-4", card.color)} />
                        </div>
                        <div className="text-2xl font-bold">{card.value}</div>
                        {card.subValue && (
                            <p className="text-xs text-muted-foreground mt-1">{card.subValue}</p>
                        )}
                    </div>
                ))}
                <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <h3 className="tracking-tight text-sm font-medium text-muted-foreground">Active Ports</h3>
                        <Network className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-2 mt-2">
                        {listeners.map((l, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span className="font-medium">{l.protocol.toUpperCase()}</span>
                                <span className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{l.port}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow">
                <div className="p-6 flex flex-col space-y-1.5">
                    <h3 className="font-semibold leading-none tracking-tight">Connected Clients</h3>
                    <p className="text-sm text-muted-foreground">Real-time list of connected clients.</p>
                </div>
                <div className="p-6 pt-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Client ID</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">IP Address</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Username</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Connected At</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {clients.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">No clients connected</td>
                                    </tr>
                                )}
                                {clients.map((client) => (
                                    <tr key={client.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <td className="p-4 align-middle font-medium">{client.id}</td>
                                        <td className="p-4 align-middle">{client.ip}</td>
                                        <td className="p-4 align-middle">{client.username || <span className="text-muted-foreground italic">Anonymous</span>}</td>
                                        <td className="p-4 align-middle">{new Date(client.connectedAt).toLocaleTimeString()}</td>
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
