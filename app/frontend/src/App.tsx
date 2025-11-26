import { useEffect, useState } from 'react';
import { Activity, Users as UsersIcon, Shield, Save, RefreshCw, Wifi } from 'lucide-react';
import { getState, saveState, applyConfig, initSocket } from './api';
import type { AppState, BrokerStats, ConnectedClient } from './types';
import { cn } from './lib/utils';

import Dashboard from './components/Dashboard';
import Listeners from './components/Listeners';
import UsersList from './components/Users';
import AclsList from './components/Acls';
import Logs from './components/Logs';

function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [clients, setClients] = useState<ConnectedClient[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'listeners' | 'users' | 'acls' | 'logs'>('dashboard');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadData();
    const socket = initSocket(
      (newStats) => setStats(newStats),
      (newClients) => setClients(newClients)
    );
    return () => {
      socket.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      const data = await getState();
      setState(data);
    } catch (error) {
      console.error('Failed to load state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!state) return;
    setSaving(true);
    try {
      await saveState(state);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await handleSave(); // Save first
      await applyConfig();
      alert('Configuration applied and Mosquitto reloaded!');
    } catch (error) {
      console.error('Failed to apply:', error);
      alert('Failed to apply configuration');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-background text-foreground">Loading...</div>;
  if (!state) return <div className="flex h-screen items-center justify-center bg-background text-foreground">Error loading state</div>;

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary",
        activeTab === id ? "bg-muted text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <div className="flex items-center gap-2 font-semibold">
              <Activity className="h-6 w-6 text-primary" />
              <span className="">Mosquitto Manager</span>
            </div>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <NavItem id="dashboard" icon={Activity} label="Dashboard" />
              <NavItem id="listeners" icon={Wifi} label="Listeners & Config" />
              <NavItem id="users" icon={UsersIcon} label="Users" />
              <NavItem id="acls" icon={Shield} label="Access Profiles" />
              <NavItem id="logs" icon={Activity} label="Logs" />
            </nav>
          </div>
          <div className="mt-auto p-4">
            {/* Footer or status */}
          </div>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <div className="w-full flex-1">
            <h1 className="text-lg font-semibold capitalize">{activeTab}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleApply}
              disabled={applying}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", applying && "animate-spin")} />
              {applying ? 'Applying...' : 'Apply Config'}
            </button>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background text-foreground">
          {activeTab === 'dashboard' && <Dashboard stats={stats} clients={clients} listeners={state?.listeners || []} />}
          {activeTab === 'listeners' && (
            <Listeners state={state} setState={setState} />
          )}
          {activeTab === 'users' && (
            <UsersList state={state} setState={setState} />
          )}
          {activeTab === 'acls' && (
            <AclsList state={state} setState={setState} />
          )}
          {activeTab === 'logs' && (
            <Logs />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
