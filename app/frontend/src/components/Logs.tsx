import { useEffect, useRef, useState } from 'react';
import { Terminal, Pause, Play, Trash2, History, Activity } from 'lucide-react';
import { initSocket, fetchLogs } from '../api';
import { cn } from '../lib/utils';

export default function Logs() {
    const [logs, setLogs] = useState<string[]>([]);
    const [paused, setPaused] = useState(false);
    const [mode, setMode] = useState<'live' | 'all'>('live');
    const logsEndRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<any>(null);

    // Initial fetch for "All" mode
    useEffect(() => {
        if (mode === 'all') {
            fetchLogs().then(initialLogs => {
                setLogs(initialLogs);
            });
        } else {
            // If switching to live, maybe we clear? Or just keep what we have?
            // User said "live logs will show the current logs only".
            // Let's clear when switching to live to be distinct.
            setLogs([]);
        }
    }, [mode]);

    useEffect(() => {
        const socket = initSocket(
            () => { },
            () => { },
            (line) => {
                if (!paused) {
                    setLogs(prev => {
                        // If in 'live' mode, we just append.
                        // If in 'all' mode, we also append (history + live updates).
                        // Limit to 2000 lines to match backend fetch limit roughly
                        const newLogs = [...prev, line];
                        if (newLogs.length > 2000) {
                            return newLogs.slice(-2000);
                        }
                        return newLogs;
                    });
                }
            }
        );
        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [paused]); // Re-init socket if paused changes? No, paused is handled in callback.
    // Actually, the callback closes over 'paused'. We need to use a ref for paused or dependency.
    // But initSocket returns a new socket every time.
    // Better: Use a ref for paused inside the callback, or just don't depend on paused in useEffect.

    // Fix: The callback passed to initSocket is created once. If 'paused' changes, the callback 
    // still sees the old 'paused' value if we don't recreate the socket or use a ref.
    // Let's use a ref for paused.
    const pausedRef = useRef(paused);
    useEffect(() => { pausedRef.current = paused; }, [paused]);

    useEffect(() => {
        // We need to re-establish socket if we want to update the callback closure?
        // Or better, make initSocket take a ref or the callback uses the ref.
        // Since we can't easily change initSocket signature deeply without breaking others (though we can),
        // let's just use the ref approach in the callback we pass.

        const socket = initSocket(
            () => { },
            () => { },
            (line) => {
                if (!pausedRef.current) {
                    setLogs(prev => {
                        const newLogs = [...prev, line];
                        if (newLogs.length > 2000) return newLogs.slice(-2000);
                        return newLogs;
                    });
                }
            }
        );
        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, []); // Run once on mount (and when mode changes? No, we want continuous stream)
    // If mode changes, we handle the *initial* state in the other useEffect. 
    // The stream should just keep appending.

    useEffect(() => {
        if (!paused) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, paused]);

    const clearLogs = () => setLogs([]);
    const togglePause = () => setPaused(!paused);

    return (
        <div className="space-y-4 h-[calc(100vh-12rem)] flex flex-col">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                        <Terminal className="h-5 w-5" /> Broker Logs
                    </h2>
                    <div className="flex items-center rounded-md border bg-muted p-1">
                        <button
                            onClick={() => setMode('live')}
                            className={cn(
                                "flex items-center gap-2 rounded-sm px-3 py-1 text-sm font-medium transition-colors",
                                mode === 'live' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                            )}
                        >
                            <Activity className="h-4 w-4" /> Live
                        </button>
                        <button
                            onClick={() => setMode('all')}
                            className={cn(
                                "flex items-center gap-2 rounded-sm px-3 py-1 text-sm font-medium transition-colors",
                                mode === 'all' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                            )}
                        >
                            <History className="h-4 w-4" /> All Logs
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={togglePause}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                    >
                        {paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                        onClick={clearLogs}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3 text-destructive"
                    >
                        <Trash2 className="h-4 w-4 mr-2" /> Clear
                    </button>
                </div>
            </div>

            <div className="flex-1 rounded-xl border bg-black text-green-400 font-mono text-xs p-4 overflow-auto shadow-inner">
                {logs.length === 0 && <div className="text-gray-500 italic">Waiting for logs...</div>}
                {logs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all border-b border-gray-900/50 py-0.5">
                        {log}
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
}
