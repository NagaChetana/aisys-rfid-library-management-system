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

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
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
    { title: 'Bibliographic Titles', value: stats.total_titles, icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: 'Physical Copies', value: stats.total_copies, icon: Copy, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { title: 'Available on Shelf', value: stats.available_copies, icon: CheckCircle2, color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { title: 'RFID Tag Coverage', value: `${stats.tag_coverage_percent}%`, icon: Radio, subtext: `${stats.tagged_copies} encoded items`, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
    { title: 'Active Patrons', value: stats.active_members, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { title: 'Blocked Members', value: stats.blocked_members, icon: UserX, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    { title: 'Active Borrowed Loans', value: stats.active_loans, icon: Repeat, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { title: 'Unpaid Fines', value: `$${stats.total_unpaid_fines.toFixed(2)}`, icon: DollarSign, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
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
            title="Refresh metrics"
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`p-4 rounded-xl border ${kpi.bg} bg-slate-900/90 backdrop-blur shadow-sm space-y-1.5`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium">{kpi.title}</span>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className={`text-2xl font-bold tracking-tight ${kpi.color}`}>
                {kpi.value}
              </div>
              {kpi.subtext && (
                <div className="text-[10px] text-slate-400 font-medium">{kpi.subtext}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Holdings by Category (Dewey)</h3>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Copies Count</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.category_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(val) => (val.length > 14 ? `${val.slice(0, 12)}...` : val)}
                />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shelf Location Distribution */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Copies by Shelf Location</h3>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Inventory Distribution</span>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {stats.shelf_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.shelf_distribution}
                    dataKey="count"
                    nameKey="shelf"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.shelf} (${entry.count})`}
                    labelLine={false}
                  >
                    {stats.shelf_distribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">No shelf distribution data available.</div>
            )}
          </div>
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
            No transactions recorded yet. Circulation operations will appear here in Batch 2.
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
