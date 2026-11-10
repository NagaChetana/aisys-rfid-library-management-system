import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BookCatalog } from './pages/BookCatalog';
import { VirtualBookshelf } from './pages/VirtualBookshelf';
import { Members } from './pages/Members';
import { Circulation } from './pages/Circulation';
import { RfidManagement } from './pages/RfidManagement';
import { RfidSimulator } from './pages/RfidSimulator';
import { Inventory } from './pages/Inventory';
import { SecurityGate } from './pages/SecurityGate';
import { DataMigration } from './pages/DataMigration';
import { ReportsView } from './pages/ReportsView';
import { AcquisitionsView } from './pages/AcquisitionsView';
import { UsersRolesView, AuditLogsView, SystemSettingsView } from './pages/AdminViews';
import { ShieldAlert } from 'lucide-react';

// Strict RBAC routing permissions
const ROLE_ALLOWED_TABS: Record<string, string[]> = {
  ADMIN: [
    'dashboard', 'catalog', 'bookshelf', 'acquisitions', 'members',
    'circulation', 'rfid-mgmt', 'simulator',
    'inventory', 'security-gate', 'reports', 'migration',
    'users', 'audit', 'settings'
  ],
  LIBRARIAN: [
    'dashboard', 'catalog', 'bookshelf', 'acquisitions', 'members',
    'circulation', 'rfid-mgmt', 'simulator',
    'inventory', 'security-gate', 'reports', 'migration'
  ],
  STAFF: [
    'dashboard', 'catalog', 'bookshelf', 'members', 'circulation'
  ],
};

const getInitialTab = (): string => {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  if (hash) return hash;
  const saved = localStorage.getItem('active_tab')?.trim();
  if (saved) return saved;
  return 'dashboard';
};

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);

  const userRole = user?.role_name || 'STAFF';
  const allowedTabs = ROLE_ALLOWED_TABS[userRole] || ROLE_ALLOWED_TABS.STAFF;

  const navigateTo = (tab: string) => {
    setCurrentTab(tab);
    window.location.hash = tab;
    localStorage.setItem('active_tab', tab);
  };

  // Sync hash changes (e.g. browser back/forward buttons)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (hash && hash !== currentTab) {
        setCurrentTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentTab]);

  // Once authentication loads, enforce RBAC on restored route or preserve valid route (NAV-01)
  useEffect(() => {
    if (user && !isLoading) {
      if (!allowedTabs.includes(currentTab)) {
        navigateTo('dashboard');
      } else {
        window.location.hash = currentTab;
        localStorage.setItem('active_tab', currentTab);
      }
    }
  }, [user, userRole, currentTab, allowedTabs, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Initializing AISYS RFID Library System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    // Defense-in-depth: Block unauthorized tab rendering
    if (!allowedTabs.includes(currentTab)) {
      return (
        <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-xl text-center space-y-4 max-w-lg mx-auto my-12 shadow-xl">
          <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-white">403 — Access Restricted</h3>
          <p className="text-xs text-slate-400">
            Your account role <span className="text-emerald-400 font-bold">({userRole})</span> is not authorized to access the module <code className="text-rose-300 font-mono">"{currentTab}"</code>.
          </p>
          <button
            onClick={() => navigateTo('dashboard')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateTo} />;
      case 'catalog':
        return <BookCatalog />;
      case 'bookshelf':
        return <VirtualBookshelf />;
      case 'acquisitions':
        return <AcquisitionsView />;
      case 'members':
        return <Members />;
      case 'users':
        return <UsersRolesView />;
      case 'audit':
        return <AuditLogsView />;
      case 'settings':
        return <SystemSettingsView />;

      // Batch 2 Features
      case 'circulation':
        return <Circulation />;
      case 'rfid-mgmt':
        return <RfidManagement />;
      case 'simulator':
        return <RfidSimulator />;

      // Batch 3 Features
      case 'inventory':
        return <Inventory />;
      case 'security-gate':
        return <SecurityGate />;
      case 'migration':
        return <DataMigration />;

      case 'reports':
        return <ReportsView />;

      default:
        return <Dashboard onNavigate={navigateTo} />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} setCurrentTab={navigateTo}>
      {renderContent()}
    </AppLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
