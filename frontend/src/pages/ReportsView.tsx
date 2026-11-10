import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  RefreshCw,
  Repeat,
  Radio,
  Users,
  DollarSign,
  ShieldAlert,
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';

type ReportTab = 'circulation' | 'tagged-items' | 'members' | 'fines' | 'gate' | 'audit';

export const ReportsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('circulation');
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingCsv, setDownloadingCsv] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{ total: number; records: any[] }>({ total: 0, records: [] });
  const [filterValue, setFilterValue] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);

  const fetchReport = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let res: { total: number; records: any[] } = { total: 0, records: [] };
      if (activeTab === 'circulation') {
        res = await api.getCirculationReport({ transaction_type: filterValue || undefined, limit });
      } else if (activeTab === 'tagged-items') {
        res = await api.getTaggedItemsReport({ status: filterValue || undefined, limit });
      } else if (activeTab === 'members') {
        res = await api.getMembersReport({ status: filterValue || undefined, limit });
      } else if (activeTab === 'fines') {
        res = await api.getFinesReport({ status: filterValue || undefined, limit });
      } else if (activeTab === 'gate') {
        const alarmOnly = filterValue === 'alarms' ? true : undefined;
        res = await api.getGateEventsReport({ alarm_only: alarmOnly, limit });
      } else if (activeTab === 'audit') {
        res = await api.getOperatorActivityReport({ action: filterValue || undefined, limit });
      }
      setReportData(res || { total: 0, records: [] });
    } catch (err: any) {
      console.error('Failed to load report', err);
      setErrorMessage(err.message || 'Failed to load report dataset');
      setReportData({ total: 0, records: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, filterValue, limit]);

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
    setFilterValue('');
    setReportData({ total: 0, records: [] });
    setLoading(true);
  };

  const handleDownloadCsv = async () => {
    let endpoint = '';
    const q = new URLSearchParams({ format: 'csv', limit: limit.toString() });
    if (filterValue) {
      if (activeTab === 'circulation') q.append('transaction_type', filterValue);
      if (activeTab === 'tagged-items') q.append('status', filterValue);
      if (activeTab === 'members') q.append('status', filterValue);
      if (activeTab === 'fines') q.append('status', filterValue);
      if (activeTab === 'gate' && filterValue === 'alarms') q.append('alarm_only', 'true');
      if (activeTab === 'audit') q.append('action', filterValue);
    }

    if (activeTab === 'circulation') endpoint = `/api/reports/circulation?${q.toString()}`;
    else if (activeTab === 'tagged-items') endpoint = `/api/reports/tagged-items?${q.toString()}`;
    else if (activeTab === 'members') endpoint = `/api/reports/members?${q.toString()}`;
    else if (activeTab === 'fines') endpoint = `/api/reports/fines?${q.toString()}`;
    else if (activeTab === 'gate') endpoint = `/api/reports/gate-events?${q.toString()}`;
    else if (activeTab === 'audit') endpoint = `/api/reports/operator-activity?${q.toString()}`;

    setDownloadingCsv(true);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        throw new Error(`Failed to export CSV: ${res.status} ${res.statusText}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      setErrorMessage(err.message || 'Failed to download CSV');
    } finally {
      setDownloadingCsv(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Comprehensive Reports & Usage Ledgers (FR08, AC08)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time filterable intelligence, historical velocity analysis, and authenticated one-click CSV export.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
            title="Export Current View as CSV"
          >
            {downloadingCsv ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{downloadingCsv ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => handleTabChange('circulation')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'circulation'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Circulation Velocity</span>
        </button>

        <button
          onClick={() => handleTabChange('tagged-items')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'tagged-items'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Tagged Items & EAS</span>
        </button>

        <button
          onClick={() => handleTabChange('members')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'members'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Member Roster</span>
        </button>

        <button
          onClick={() => handleTabChange('fines')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'fines'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Fines Ledger</span>
        </button>

        <button
          onClick={() => handleTabChange('gate')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'gate'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Security Gate Alarms</span>
        </button>

        <button
          onClick={() => handleTabChange('audit')}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'audit'
              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Operator Activity</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400 font-medium">Filter by Status / Type:</span>

          {activeTab === 'circulation' && (
            <div className="relative inline-block">
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Transactions</option>
                <option value="checkout">Checkouts Only</option>
                <option value="checkin">Returns Only</option>
                <option value="renew">Renewals Only</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {activeTab === 'tagged-items' && (
            <div className="relative inline-block">
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-cyan-500"
              >
                <option value="">All Tag States</option>
                <option value="active">Active Tags</option>
                <option value="damaged">Damaged Tags</option>
                <option value="decommissioned">Decommissioned Tags</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {activeTab === 'members' && (
            <div className="relative inline-block">
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-purple-500"
              >
                <option value="">All Members</option>
                <option value="active">Active Status</option>
                <option value="blocked">Blocked Status</option>
                <option value="suspended">Suspended Status</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {activeTab === 'fines' && (
            <div className="relative inline-block">
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-amber-500"
              >
                <option value="">All Fine Statuses</option>
                <option value="unpaid">Unpaid Only</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {activeTab === 'gate' && (
            <div className="relative inline-block">
              <select
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-rose-500"
              >
                <option value="">All Gate Events</option>
                <option value="alarms">Alarms Triggered Only</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {activeTab === 'audit' && (
            <input
              type="text"
              placeholder="Search action keyword..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
          )}
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span>Row Limit:</span>
          <div className="relative inline-block">
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-slate-500"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <span className="font-mono text-emerald-400 font-semibold pl-2">
            Total Records: {reportData.total}
          </span>
        </div>
      </div>

      {/* Table Data View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
            <p className="text-xs">Loading report dataset...</p>
          </div>
        ) : reportData.records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No records found matching current report criteria.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs divide-y divide-slate-800 font-sans">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                {activeTab === 'circulation' && (
                  <tr>
                    <th className="py-3 px-4">Tx ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Accession</th>
                    <th className="py-3 px-4">Book Title</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Checkout Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Return Date</th>
                    <th className="py-3 px-4 text-center">Renewals</th>
                  </tr>
                )}

                {activeTab === 'tagged-items' && (
                  <tr>
                    <th className="py-3 px-4">Tag EPC UID</th>
                    <th className="py-3 px-4">Accession</th>
                    <th className="py-3 px-4">Book Title</th>
                    <th className="py-3 px-4">Shelf Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">EAS Bit</th>
                    <th className="py-3 px-4">Last Scanned</th>
                  </tr>
                )}

                {activeTab === 'members' && (
                  <tr>
                    <th className="py-3 px-4">Card / Member ID</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Max Allowance</th>
                    <th className="py-3 px-4 text-right">Fine Balance</th>
                  </tr>
                )}

                {activeTab === 'fines' && (
                  <tr>
                    <th className="py-3 px-4">Fine ID</th>
                    <th className="py-3 px-4">Patron Name</th>
                    <th className="py-3 px-4">Member #</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reason</th>
                  </tr>
                )}

                {activeTab === 'gate' && (
                  <tr>
                    <th className="py-3 px-4">Event ID</th>
                    <th className="py-3 px-4">Reader Antenna</th>
                    <th className="py-3 px-4">Accession Number</th>
                    <th className="py-3 px-4">Tag UID</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap min-w-[130px]">Alarm Status</th>
                    <th className="py-3 px-4">CCTV Frame</th>
                  </tr>
                )}

                {activeTab === 'audit' && (
                  <tr>
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">Resource ID</th>
                    <th className="py-3 px-4">Actor ID</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                )}
              </thead>

              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {activeTab === 'circulation' &&
                  reportData.records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono text-slate-400">#{r.id}</td>
                      <td className="py-2.5 px-4 font-semibold capitalize text-emerald-400">{r.transaction_type}</td>
                      <td className="py-2.5 px-4 font-mono text-cyan-400">{r.accession_number}</td>
                      <td className="py-2.5 px-4 font-medium text-white">{r.title}</td>
                      <td className="py-2.5 px-4 text-slate-300">{r.member_name}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{r.checkout_date ? new Date(r.checkout_date).toLocaleDateString() : '-'}</td>
                      <td className="py-2.5 px-4 text-amber-400 text-[11px] font-semibold">{r.due_date ? new Date(r.due_date).toLocaleDateString() : '-'}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{r.return_date ? new Date(r.return_date).toLocaleDateString() : 'Active'}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{r.renewal_count}</td>
                    </tr>
                  ))}

                {activeTab === 'tagged-items' &&
                  reportData.records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono text-cyan-300 text-[11px]">{r.tag_uid}</td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400">{r.accession_number}</td>
                      <td className="py-2.5 px-4 text-white font-medium">{r.title}</td>
                      <td className="py-2.5 px-4 text-slate-300">{r.shelf_location}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.eas_bit ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {r.eas_bit ? 'ARMED' : 'DISARMED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{r.last_scanned_at ? new Date(r.last_scanned_at).toLocaleString() : 'Never'}</td>
                    </tr>
                  ))}

                {activeTab === 'members' &&
                  reportData.records.map((r, i) => {
                    const fineBal = Number(r?.fine_balance ?? 0);
                    const safeFine = isNaN(fineBal) ? 0 : fineBal;
                    return (
                      <tr key={r?.membership_number || i} className="hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 font-mono text-purple-400">{r?.membership_number || '—'}</td>
                        <td className="py-2.5 px-4 font-medium text-white">{r?.full_name || '—'}</td>
                        <td className="py-2.5 px-4 text-slate-400">{r?.email || 'N/A'}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            r?.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {r?.status || 'unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono">{r?.max_allowed_loans ?? '—'}</td>
                        <td className={`py-2.5 px-4 text-right font-mono font-semibold ${safeFine > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ${safeFine.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}

                {activeTab === 'fines' &&
                  reportData.records.map((r, i) => {
                    const amount = Number(r?.amount ?? 0);
                    const paid = Number(r?.paid_amount ?? 0);
                    const safeAmount = isNaN(amount) ? 0 : amount;
                    const safePaid = isNaN(paid) ? 0 : paid;
                    return (
                      <tr key={r?.id || i} className="hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 font-mono text-slate-400">#{r?.id || '—'}</td>
                        <td className="py-2.5 px-4 text-white font-medium">{r?.member_name || '—'}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-400">{r?.membership_number || '—'}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-400">${safeAmount.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-400">${safePaid.toFixed(2)}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            r?.status === 'unpaid' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {r?.status || 'unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 text-[11px]">{r?.reason || '—'}</td>
                      </tr>
                    );
                  })}

                {activeTab === 'gate' &&
                  reportData.records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono text-slate-400">#{r.id}</td>
                      <td className="py-2.5 px-4 font-medium text-cyan-300">{r.reader_id}</td>
                      <td className="py-2.5 px-4 font-mono text-emerald-400">{r.accession_number || 'N/A'}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">{r.tag_uid}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap min-w-[130px]">
                        <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wider whitespace-nowrap ${
                          r?.alarm_triggered ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {r?.alarm_triggered ? 'ALARM FIRED' : 'AUTHORIZED'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[10px] font-mono">{r.cctv_image_path || 'No snapshot'}</td>
                    </tr>
                  ))}

                {activeTab === 'audit' &&
                  reportData.records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      <td className="py-2.5 px-4 font-mono text-slate-400">#{r.id}</td>
                      <td className="py-2.5 px-4 font-semibold text-indigo-400">{r.action}</td>
                      <td className="py-2.5 px-4 text-slate-300 uppercase text-[10px]">{r.resource_type}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{r.resource_id}</td>
                      <td className="py-2.5 px-4 text-slate-400">{r.actor_user_id || 'System'}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{new Date(r.timestamp).toLocaleString()}</td>
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
