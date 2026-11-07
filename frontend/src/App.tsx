import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { BookCatalog } from './pages/BookCatalog';
import { VirtualBookshelf } from './pages/VirtualBookshelf';
import { Members } from './pages/Members';
import { UsersRolesView, AuditLogsView, SystemSettingsView } from './pages/AdminViews';
import { Layers, Radio, ShieldAlert, Database, Repeat, Cpu, BarChart3 } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

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
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentTab} />;
      case 'catalog':
        return <BookCatalog />;
      case 'bookshelf':
        return <VirtualBookshelf />;
      case 'members':
        return <Members />;
      case 'users':
        return <UsersRolesView />;
      case 'audit':
        return <AuditLogsView />;
      case 'settings':
        return <SystemSettingsView />;

      // Batch 2 Placeholders
      case 'circulation':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Repeat className="w-12 h-12 text-amber-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">Circulation & Business Rules Engine</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Checkout, checkin, loan renewals, due-date inquiry, and enforcement of reference-book restrictions, blocked members, and fine limits ($15 cap) scheduled for <strong>Batch 2</strong>.
            </p>
          </div>
        );
      case 'rfid-mgmt':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Radio className="w-12 h-12 text-cyan-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">RFID Tag Management & History</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Tag assignment, duplicate prevention, and historical tag assignment tracking table scheduled for <strong>Batch 2</strong>.
            </p>
          </div>
        );
      case 'simulator':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Cpu className="w-12 h-12 text-indigo-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">Hardware Reader Simulator & Interoperability</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Virtual desktop staff pad reader, handheld antenna, and NCIP 2.0 & SIP2 adapter testbeds scheduled for <strong>Batch 2</strong>.
            </p>
          </div>
        );

      // Batch 3 Placeholders
      case 'inventory':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Layers className="w-12 h-12 text-cyan-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">Handheld Shelf Stock Inventory</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Missing and misplaced item detection with audible Web Audio scan beeps scheduled for <strong>Batch 3</strong>.
            </p>
          </div>
        );
      case 'security-gate':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">Security Gate & CCTV Surveillance</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Live EAS security-bit detection, mock CCTV frame capture, and alarm sirens scheduled for <strong>Batch 3</strong>.
            </p>
          </div>
        );
      case 'reports':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <BarChart3 className="w-12 h-12 text-emerald-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">Comprehensive Reports & Analytics</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Historical circulation velocity, fine ledgers, and CSV/JSON export scheduled for <strong>Batch 3</strong>.
            </p>
          </div>
        );
      case 'migration':
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Database className="w-12 h-12 text-violet-400 mx-auto opacity-75" />
            <h3 className="text-base font-bold text-white">20,000 Records Migration & Scoped Rollback</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Staging table ingestion, validation, count reconciliation, and atomic batch rollback scheduled for <strong>Batch 3</strong>.
            </p>
          </div>
        );

      default:
        return <Dashboard onNavigate={setCurrentTab} />;
    }
  };

  return (
    <AppLayout currentTab={currentTab} setCurrentTab={setCurrentTab}>
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
