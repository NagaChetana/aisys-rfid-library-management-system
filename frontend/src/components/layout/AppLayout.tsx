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
  Wifi,
  HardDrive,
  ShoppingBag,
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
  const { user, logout } = useAuth();
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

  const userRole = user?.role_name || 'STAFF';

  const allNavItems = [
    { section: 'Core Library' },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'catalog', label: 'Book Catalog & Copies', icon: BookOpen },
    { id: 'bookshelf', label: 'Virtual Bookshelf (OPAC)', icon: Library },
    { id: 'acquisitions', label: 'Acquisitions & Serials', icon: ShoppingBag, roles: ['ADMIN', 'LIBRARIAN'] },
    { id: 'members', label: 'Members & Cards', icon: Users },

    { section: 'RFID & Circulation' },
    { id: 'circulation', label: 'Circulation Desk', icon: Repeat },
    { id: 'rfid-mgmt', label: 'RFID Tag Management', icon: Radio, roles: ['ADMIN', 'LIBRARIAN'] },
    { id: 'simulator', label: 'Hardware Reader Simulator', icon: Cpu, roles: ['ADMIN', 'LIBRARIAN'] },

    { section: 'Surveillance & Operations' },
    { id: 'inventory', label: 'Shelf Stock Inventory', icon: Layers, roles: ['ADMIN', 'LIBRARIAN'] },
    { id: 'security-gate', label: 'Security Gate & CCTV', icon: ShieldAlert, roles: ['ADMIN', 'LIBRARIAN'] },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, roles: ['ADMIN', 'LIBRARIAN'] },
    { id: 'migration', label: 'Data Migration (20k)', icon: Database, roles: ['ADMIN', 'LIBRARIAN'] },

    { section: 'Administration' },
    { id: 'users', label: 'User & Role Access', icon: UserCheck, roles: ['ADMIN'] },
    { id: 'audit', label: 'System Audit Logs', icon: FileText, roles: ['ADMIN'] },
    { id: 'settings', label: 'System Settings', icon: Settings, roles: ['ADMIN'] },
  ];

  // Filter items and sections strictly based on authenticated role
  const navItems = React.useMemo(() => {
    const result: typeof allNavItems = [];
    let currentSection: (typeof allNavItems)[0] | null = null;
    let sectionItems: typeof allNavItems = [];

    for (const item of allNavItems) {
      if (item.section) {
        if (currentSection && sectionItems.length > 0) {
          result.push(currentSection);
          result.push(...sectionItems);
        }
        currentSection = item;
        sectionItems = [];
      } else {
        const isAllowed = !item.roles || item.roles.includes(userRole);
        if (isAllowed) {
          sectionItems.push(item);
        }
      }
    }
    if (currentSection && sectionItems.length > 0) {
      result.push(currentSection);
      result.push(...sectionItems);
    }
    return result;
  }, [userRole]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 xl:w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full select-none flex-shrink-0">
        {/* Logo Brand */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm tracking-wide text-white leading-tight truncate">AISYS RFID LMS</h1>
            <p className="text-[10px] text-emerald-400 font-medium">SOP Compliant • v1.0.0</p>
          </div>
        </div>

        {/* Navigation Menu (Independently scrollable) */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {navItems.map((item, idx) => {
            if (item.section) {
              return (
                <div key={idx} className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {item.section}
                </div>
              );
            }
            const Icon = item.icon!;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id!)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all text-left group ${
                  isActive
                    ? 'bg-emerald-600 text-white font-medium shadow-sm shadow-emerald-950/50'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} />
                <span className="truncate text-xs tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer — System Status */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex-shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>SQLite WAL Online</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">Air-gapped</span>
          </div>
          {health && (
            <div className="mt-1.5 text-[10px] text-slate-500 font-mono">
              DB: {health.database.file_size_kb} KB
            </div>
          )}
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
