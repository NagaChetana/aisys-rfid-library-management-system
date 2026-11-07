import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Library,
  Users,
  Repeat,
  Radio,
  Cpu,
  Layers,
  ShieldAlert,
  BarChart3,
  Database,
  UserCheck,
  FileText,
  Settings,
  LogOut,
  CreditCard,
  Wifi,
  HardDrive
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SystemHealth } from '../../types';

interface AppLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentTab, setCurrentTab, children }) => {
  const { user, logout, smartCardLogin } = useAuth();
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const data = await api.getSystemHealth();
        setHealth(data);
      } catch {
        // silent fallback
      }
    }
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { section: 'Core Library' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, batch: 'B1' },
    { id: 'catalog', label: 'Book Catalog & Copies', icon: BookOpen, batch: 'B1' },
    { id: 'bookshelf', label: 'Virtual Bookshelf (OPAC)', icon: Library, batch: 'B1' },
    { id: 'members', label: 'Members & Cards', icon: Users, batch: 'B1' },

    { section: 'RFID & Interoperability' },
    { id: 'circulation', label: 'Circulation Desk', icon: Repeat, batch: 'B2', disabledNote: 'Batch 2' },
    { id: 'rfid-mgmt', label: 'RFID Tag Management', icon: Radio, batch: 'B2', disabledNote: 'Batch 2' },
    { id: 'simulator', label: 'Hardware Reader Simulator', icon: Cpu, batch: 'B2', disabledNote: 'Batch 2' },

    { section: 'Surveillance & Operations' },
    { id: 'inventory', label: 'Shelf Stock Inventory', icon: Layers, batch: 'B3', disabledNote: 'Batch 3' },
    { id: 'security-gate', label: 'Security Gate & CCTV', icon: ShieldAlert, batch: 'B3', disabledNote: 'Batch 3' },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, batch: 'B3', disabledNote: 'Batch 3' },
    { id: 'migration', label: 'Data Migration (20k)', icon: Database, batch: 'B3', disabledNote: 'Batch 3' },

    { section: 'Administration' },
    { id: 'users', label: 'User & Role Access', icon: UserCheck, batch: 'B1' },
    { id: 'audit', label: 'System Audit Logs', icon: FileText, batch: 'B1' },
    { id: 'settings', label: 'System Settings', icon: Settings, batch: 'B1' },
  ];

  const quickStaffCards = [
    { name: 'Admin', uid: 'SC-ADMIN-001' },
    { name: 'Librarian', uid: 'SC-LIB-002' },
    { name: 'Staff', uid: 'SC-STAFF-003' },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between select-none">
        <div>
          {/* Logo Brand */}
          <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white leading-tight">AISYS RFID LMS</h1>
              <p className="text-[10px] text-emerald-400 font-medium">SOP Compliant • v1.0.0</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)] text-sm">
            {navItems.map((item, idx) => {
              if (item.section) {
                return (
                  <div key={idx} className="pt-3 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {item.section}
                  </div>
                );
              }
              const Icon = item.icon!;
              const isActive = currentTab === item.id;
              const isB1 = item.batch === 'B1';

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id!)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-left ${
                    isActive
                      ? 'bg-emerald-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {!isB1 && (
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/20">
                      {item.disabledNote}
                    </span>
                  )}
                  {isB1 && (
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">
                      Ready
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info & Smart card quick tap */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <CreditCard className="w-3 h-3 text-cyan-400" />
              <span>Simulate Badge Tap</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {quickStaffCards.map((sc) => (
              <button
                key={sc.uid}
                onClick={() => smartCardLogin(sc.uid)}
                title={`Switch to ${sc.name} (${sc.uid})`}
                className={`text-[10px] py-1 px-1 rounded text-center border font-mono transition-all ${
                  user?.smart_card_uid === sc.uid
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              >
                {sc.name}
              </button>
            ))}
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>SQLite WAL Online</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">Air-gapped</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-base font-semibold text-white capitalize">
              {navItems.find((i) => i.id === currentTab)?.label || 'Library Administration'}
            </h2>
            <div className="hidden sm:flex items-center space-x-2 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-3 h-3 mr-1" /> Standalone Active
              </span>
              {health && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  <HardDrive className="w-3 h-3 mr-1 text-slate-400" />
                  DB: {health.database.file_size_kb} KB
                </span>
              )}
            </div>
          </div>

          {/* Current User & Actions */}
          <div className="flex items-center space-x-4">
            {user && (
              <div className="flex items-center space-x-3 text-right">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center space-x-1.5 justify-end">
                    <span>{user.full_name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {user.role_name || 'STAFF'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Badge: {user.smart_card_uid || 'No Card'}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
                  {user.username.slice(0, 2).toUpperCase()}
                </div>
              </div>
            )}

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
};
