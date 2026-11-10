import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Copy,
  CheckCircle2,
  Radio,
  Users,
  UserX,
  Repeat,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  Library
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../services/api';
import { DashboardStats } from '../types';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6'];

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState<boolean>(false);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null);

  const fetchStats = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    setRefreshSuccess(false);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to update dashboard stats:', err);
      const msg = err.message || 'Failed to update dashboard metrics';
      if (!stats) {
        setError(msg);
      } else {
        setRefreshError(msg);
        setTimeout(() => setRefreshError(null), 4000);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('http://127.0.0.1:8000/api/events/stream');
      const handleLiveEvent = () => {
        api.getDashboardStats().then(setStats).catch(console.error);
      };
      eventSource.addEventListener('circulation_checkout', handleLiveEvent);
      eventSource.addEventListener('circulation_checkin', handleLiveEvent);
      eventSource.addEventListener('gate_alarm', handleLiveEvent);
      eventSource.addEventListener('migration_executed', handleLiveEvent);
      eventSource.addEventListener('migration_rolled_back', handleLiveEvent);
    } catch (err) {
      console.error('Dashboard SSE connection error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-emerald-400" />
        <span>Loading Executive Library Analytics...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between">
        <span>{error || 'Unable to connect to backend server'}</span>
        <button
          onClick={fetchStats}
          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Bibliographic Titles',
      value: stats.total_titles,
      icon: BookOpen,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      tooltip: 'Unique catalog entries (MARC/ISBN distinct titles)'
    },
    {
      title: 'Physical Copies',
      value: stats.total_copies,
      icon: Copy,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      tooltip: 'Total barcode & accessioned physical units in collection'
    },
    {
      title: 'Available on Shelf',
      value: stats.available_copies,
      icon: CheckCircle2,
      color: 'text-emerald-300',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      tooltip: 'Copies physically present and ready for patron checkout'
    },
    {
      title: 'RFID Tag Coverage',
      value: `${stats.tag_coverage_percent}%`,
      icon: Radio,
      subtext: `${stats.tagged_copies} encoded items`,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      tooltip: 'Percentage of physical items paired with an active RFID tag'
    },
    {
      title: 'Active Patrons',
      value: stats.active_members,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      tooltip: 'Registered patrons in good standing with active borrowing privileges'
    },
    {
      title: 'Blocked Members',
      value: stats.blocked_members,
      icon: UserX,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      tooltip: 'Patrons restricted from borrowing due to unpaid fines or manual holds'
    },
    {
      title: 'Active Borrowed Loans',
      value: stats.active_loans,
      icon: Repeat,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      tooltip: 'Copies currently checked out and circulating'
    },
    {
      title: 'Unpaid Fines',
      value: `$${stats.total_unpaid_fines.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      tooltip: 'Cumulative outstanding fine balance across all patron accounts'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white">System Executive Dashboard</h2>
          <p className="text-xs text-slate-400">
            Real-time status of catalog, physical copies, RFID coverage, and patron circulation.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('catalog')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Book</span>
          </button>
          <button
            onClick={() => onNavigate('members')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Register Member</span>
          </button>
          <button
            onClick={() => onNavigate('bookshelf')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
          >
            <Library className="w-3.5 h-3.5" />
            <span>Virtual Shelf</span>
          </button>
          <button
            onClick={fetchStats}
            disabled={refreshing}
            title="Refresh metrics &amp; charts"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{refreshError}</span>
        </div>
      )}
      {refreshSuccess && (
        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Dashboard analytics and charts refreshed successfully.</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              title={kpi.tooltip}
              className={`p-4 rounded-xl border ${kpi.bg} bg-slate-900/90 backdrop-blur shadow-sm space-y-1.5 transition-all hover:border-slate-600 group cursor-default`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium group-hover:text-slate-200 transition-colors">{kpi.title}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className={`text-2xl font-bold tracking-tight ${kpi.color}`}>
                {kpi.value}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>{kpi.subtext || kpi.tooltip}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Bar Chart (DASH-01, DASH-04) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Holdings by Category (Dewey)</h3>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Copies Count</span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={stats.category_distribution}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  width={140}
                  tickLine={false}
                  tickFormatter={(val) => (val.length > 20 ? `${val.slice(0, 18)}…` : val)}
                />
                {/* cursor={false} removes unwanted white/grey hover highlight rectangle (DASH-04) */}
                <Tooltip
                  cursor={false}
                  wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-lg shadow-2xl text-xs space-y-1 backdrop-blur-sm pointer-events-none">
                          <p className="font-semibold text-white">{item.name}</p>
                          <p className="text-emerald-400 font-mono font-bold">
                            {item.count} <span className="text-[10px] text-slate-400 font-sans font-normal">copies catalogued</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shelf Location Distribution (Donut Chart + Separate Readable Legend) (DASH-02, DASH-03) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Copies by Shelf Location</h3>
              {selectedShelf && (
                <span className="text-[11px] text-cyan-400 font-mono block">Selected Shelf: {selectedShelf}</span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Inventory Distribution</span>
          </div>
          {stats.shelf_distribution.length > 0 ? (
            <div className="h-64 flex flex-col sm:flex-row items-center gap-4">
              {/* Donut Chart */}
              <div className="h-48 w-48 sm:h-full sm:w-1/2 flex-shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.shelf_distribution}
                      dataKey="count"
                      nameKey="shelf"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={72}
                      paddingAngle={3}
                      style={{ outline: 'none' }}
                      onClick={(entry) => setSelectedShelf(prev => prev === entry.shelf ? null : entry.shelf)}
                      onMouseEnter={(entry) => setSelectedShelf(entry.shelf)}
                    >
                      {stats.shelf_distribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke={selectedShelf === entry.shelf ? '#ffffff' : '#0f172a'}
                          strokeWidth={selectedShelf === entry.shelf ? 2 : 1}
                          style={{ outline: 'none', cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                    {/* Positioned non-overlapping clear tooltip (DASH-02) */}
                    <Tooltip
                      wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-lg shadow-2xl text-xs space-y-0.5 backdrop-blur-sm pointer-events-none">
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                                <span>{item.shelf}</span>
                              </div>
                              <div className="text-cyan-400 font-mono font-bold">
                                {item.count} <span className="text-[10px] text-slate-400 font-normal">copies</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Readable Legend List (Interactive with Click-to-Select) (DASH-03) */}
              <div className="flex-1 w-full overflow-y-auto max-h-56 pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                {stats.shelf_distribution.map((item, index) => {
                  const totalShelf = stats.shelf_distribution.reduce((acc, curr) => acc + curr.count, 0) || 1;
                  const pct = Math.round((item.count / totalShelf) * 100);
                  const color = COLORS[index % COLORS.length];
                  const isSelected = selectedShelf === item.shelf;
                  return (
                    <div
                      key={item.shelf}
                      onClick={() => setSelectedShelf(prev => prev === item.shelf ? null : item.shelf)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-cyan-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className={`truncate font-medium ${isSelected ? 'text-cyan-300 font-semibold' : 'text-slate-300'}`} title={item.shelf}>
                          {item.shelf}
                        </span>
                      </div>
                      <div className="font-mono text-slate-400 flex items-center space-x-1.5 flex-shrink-0">
                        <span className="font-semibold text-white">{item.count}</span>
                        <span className="text-[10px] text-slate-500 font-sans">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No shelf distribution data available.
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent Circulation Transactions</h3>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Real-time Audit Ledger
          </span>
        </div>

        {stats.recent_transactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No transactions recorded yet. Circulation check-outs and check-ins will appear here in real-time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Book Title</th>
                  <th className="py-2.5 px-3">Accession</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats.recent_transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold uppercase text-emerald-400">{t.type}</td>
                    <td className="py-2 px-3 text-slate-200">{t.book_title}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{t.accession_number}</td>
                    <td className="py-2 px-3 text-slate-300">{t.member_name}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-400">{t.date ? new Date(t.date).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
