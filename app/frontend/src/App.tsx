import { useEffect, useState } from 'react';
import { Activity, Users as UsersIcon, Shield, Save, RefreshCw, Wifi, Settings as SettingsIcon, LogOut, UserPlus } from 'lucide-react';
import { getState, saveState, applyConfig, initSocket, getMe, logout } from './api';
import type { AppState, BrokerStats, ConnectedClient, CurrentUser } from './types';
import { cn } from './lib/utils';

import Dashboard from './components/Dashboard';
import Listeners from './components/Listeners';
import UsersList from './components/Users';
import AclsList from './components/Acls';
import Logs from './components/Logs';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { DashboardUsers } from './components/DashboardUsers';

import { ThemeToggle } from './components/ThemeToggle';



function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [state, setState] = useState<AppState | null>(null);
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [clients, setClients] = useState<ConnectedClient[]>([]);

  const [loading, setLoading] = useState(false); // Data loading
  const [activeTab, setActiveTab] = useState<'dashboard' | 'listeners' | 'users' | 'acls' | 'logs' | 'settings' | 'dashboard-users'>('dashboard');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  // 1. Check Auth on Mount
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    try {
      const { user } = await getMe();
      setUser(user);
      // If auth success, load data
      loadData();
    } catch {
      // Not authenticated
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Load Data (After Auth)
  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    if (user) {
      const socket = initSocket(
        (newStats) => setStats(newStats),
        (newClients) => setClients(newClients)
      );
      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getState();
      setState(data);
    } catch (error) {
      console.error('Failed to load state:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (user: CurrentUser) => {
    setUser(user);
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setState(null);
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

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-background text-foreground">Loading...</div>;

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading || !state) return <div className="flex h-screen items-center justify-center bg-background text-foreground">Loading Application Data...</div>;

  // Viewers cannot save/apply
  const isViewer = user.role === 'viewer';
  const isAdmin = user.role === 'admin';

  const NavItem = ({ id, icon: Icon, label, hidden = false }: { id: typeof activeTab, icon: React.ElementType, label: string, hidden?: boolean }) => {
    if (hidden) return null;
    return (
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
  };

  return (
    <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] overflow-hidden">
      <div className="hidden border-r bg-muted/40 md:block overflow-y-auto">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 sticky top-0 bg-muted/40 z-10">
            <div className="flex items-center gap-2 font-semibold">
              <Activity className="h-6 w-6 text-primary" />
              <span className="">Mosquitto Manager 💜</span>
            </div>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              <NavItem id="dashboard" icon={Activity} label="Dashboard" />
              <NavItem id="listeners" icon={Wifi} label="Listeners & Config" />
              <NavItem id="users" icon={UsersIcon} label="MQTT Users" />
              <NavItem id="acls" icon={Shield} label="Access Profiles" />
              <NavItem id="logs" icon={Activity} label="Logs" />
              <NavItem id="settings" icon={SettingsIcon} label="Settings" />

              {/* Admin Only Section */}
              {isAdmin && (
                <>
                  <div className="my-2 border-t border-border"></div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">ADMINISTRATION</div>
                  <NavItem id="dashboard-users" icon={UserPlus} label="Dashboard Users" />
                </>
              )}
            </nav>
          </div>
          <div className="mt-auto p-4 border-t">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {user.username[0].toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 shrink-0">
          <div className="w-full flex-1">
            <h1 className="text-lg font-semibold capitalize">
              {activeTab === 'dashboard-users' ? 'Dashboard Users' : activeTab}
            </h1>
          </div>
          <div className="flex gap-2">
            <ThemeToggle />

            {!isViewer && (
              <>
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
              </>
            )}
            {isViewer && (
              <div className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-muted text-muted-foreground h-9 px-4 py-2 cursor-not-allowed opacity-70">
                <Shield className="mr-2 h-4 w-4" />
                Read Only
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-background text-foreground">
          {activeTab === 'dashboard' && <Dashboard stats={stats} clients={clients} listeners={state?.listeners || []} />}
          {activeTab === 'listeners' && (
            <Listeners state={state} setState={setState} readOnly={isViewer} />
          )}
          {activeTab === 'users' && (
            <UsersList state={state} setState={setState} onSave={handleSave} readOnly={isViewer} />
          )}
          {activeTab === 'acls' && (
            <AclsList state={state} setState={setState} onSave={handleSave} readOnly={isViewer} />
          )}
          {activeTab === 'logs' && (
            <Logs />
          )}
          {activeTab === 'settings' && (
            <Settings
              onImportSuccess={loadData}
              onSave={handleSave}
              globalSettings={state.global_settings}
              onUpdateGlobalSettings={(settings) => setState({ ...state, global_settings: settings })}
              readOnly={isViewer}
            />
          )}
          {activeTab === 'dashboard-users' && isAdmin && (
            <DashboardUsers />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
