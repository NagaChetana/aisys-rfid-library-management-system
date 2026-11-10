import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck,
  FileText,
  Settings as SettingsIcon,
  HardDrive,
  Shield,
  Activity,
  CheckCircle,
  RefreshCw,
  CreditCard,
  Save,
  Plus,
  Edit2,
  Power,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Database,
  Download,
  AlertTriangle,
  Bell,
  Printer,
  Mail,
  Send,
  History,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  SystemHealth, User, UserCreateRequest, UserUpdateRequest,
  DatabaseBackup, BackupValidationResult, OfflineVersionInfo, UpdateHistoryItem, NotificationRecord
} from '../types';

// ─── Role badge colour helper ──────────────────────────────────────────────
function RoleBadge({ role }: { role?: string }) {
  const r = role || 'STAFF';
  const colour =
    r === 'ADMIN'
      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
      : r === 'LIBRARIAN'
      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
      : 'bg-slate-700 text-slate-300 border-slate-600';
  return (
    <span className={`px-2 py-0.5 rounded border font-bold text-[10px] ${colour}`}>{r}</span>
  );
}

// ─── User Create / Edit Modal ─────────────────────────────────────────────
interface UserModalProps {
  existingUser?: User | null;
  roles: { id: number; name: string }[];
  onClose: () => void;
  onSaved: (u: User) => void;
}

const UserModal: React.FC<UserModalProps> = ({ existingUser, roles, onClose, onSaved }) => {
  const isEdit = !!existingUser;
  const [form, setForm] = useState({
    username: existingUser?.username ?? '',
    full_name: existingUser?.full_name ?? '',
    email: existingUser?.email ?? '',
    role_id: existingUser?.role_id ?? (roles[0]?.id ?? 1),
    smart_card_uid: existingUser?.smart_card_uid ?? '',
    password: '',
    confirm_password: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEdit && !form.password.trim()) {
      setError('Password is required for new accounts.');
      return;
    }
    if (form.password && form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      let saved: User;
      if (isEdit) {
        const payload: UserUpdateRequest = {};
        if (form.full_name.trim()) payload.full_name = form.full_name.trim();
        if (form.email.trim()) payload.email = form.email.trim();
        if (form.role_id) payload.role_id = Number(form.role_id);
        payload.smart_card_uid = form.smart_card_uid.trim() || undefined;
        if (form.password.trim()) payload.password = form.password.trim();
        saved = await api.updateAdminUser(existingUser!.id, payload);
      } else {
        const payload: UserCreateRequest = {
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          role_id: Number(form.role_id),
          smart_card_uid: form.smart_card_uid.trim() || undefined,
        };
        saved = await api.createAdminUser(payload);
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err.message || 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="font-bold text-white text-sm">
            {isEdit ? `Edit Account — ${existingUser!.username}` : 'Create New Employee Account'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Username — readonly on edit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required={!isEdit}
                disabled={isEdit}
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="e.g. jsmith"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Role</label>
              <select
                required
                value={form.role_id}
                onChange={(e) => set('role_id', Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="e.g. jsmith@library.local"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Smart Card Badge UID <span className="text-slate-500 normal-case">(optional)</span>
            </label>
            <input
              type="text"
              value={form.smart_card_uid}
              onChange={(e) => set('smart_card_uid', e.target.value.toUpperCase())}
              placeholder="e.g. SC-EMP-004"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {isEdit ? 'New Password' : 'Password'}{' '}
                {isEdit && <span className="text-slate-500 normal-case">(leave blank to keep)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required={!isEdit}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 pr-9 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-slate-200"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Confirm Password</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={(e) => set('confirm_password', e.target.value)}
                placeholder="Repeat password"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center space-x-1.5 transition-colors"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isEdit ? 'Save Changes' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Users & Roles View ───────────────────────────────────────────────────
export const UsersRolesView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalUser, setModalUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.listAdminUsers(), api.getRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openCreate = () => { setModalUser(null); setShowModal(true); };
  const openEdit = (u: User) => { setModalUser(u); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleSaved = (saved: User) => {
    setShowModal(false);
    setSuccessMsg(`Account "${saved.username}" ${modalUser ? 'updated' : 'created'} successfully.`);
    setTimeout(() => setSuccessMsg(null), 4000);
    loadAll();
  };

  const handleToggle = async (u: User) => {
    if (!window.confirm(`${u.is_active ? 'Deactivate' : 'Activate'} account "${u.username}"?`)) return;
    setToggling(u.id);
    try {
      await api.toggleAdminUserStatus(u.id);
      setSuccessMsg(`Account "${u.username}" ${u.is_active ? 'deactivated' : 'activated'}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadAll();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status.');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-5">
      {showModal && (
        <UserModal
          existingUser={modalUser}
          roles={roles}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <span>Staff Users &amp; Role-Based Access Control (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Individual employee accounts, server-enforced role privileges, and Smart Card NFC credentials (NFR02, AC07).
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-900/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Account</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs divide-y divide-slate-800">
          <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px]">
            <tr>
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Smart Card Badge</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                  Loading accounts…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">No user accounts found.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className={`hover:bg-slate-800/40 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{u.full_name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{u.username} • {u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <RoleBadge role={u.role_name} />
                  </td>
                  <td className="py-3 px-4 font-mono text-cyan-300">
                    {u.smart_card_uid ? (
                      <span className="flex items-center space-x-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{u.smart_card_uid}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">No badge bound</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit account"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggle(u)}
                        disabled={toggling === u.id}
                        title={u.is_active ? 'Deactivate account' : 'Activate account'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.is_active
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-700'
                            : 'text-slate-500 hover:text-emerald-400 hover:bg-slate-700'
                        }`}
                      >
                        {toggling === u.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Power className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-500 px-1">
        <span className="text-emerald-400">●</span> Authentication is enforced server-side. Roles are assigned from the database — the frontend cannot override them.
        Smart card simulation is available on the <strong className="text-slate-400">Login page only</strong>.
      </div>
    </div>
  );
};

// ─── Audit Logs View ──────────────────────────────────────────────────────
export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterAction, setFilterAction] = useState<string>('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(200);
      setLogs(data);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = filterAction
    ? logs.filter((l) => l.action?.toLowerCase().includes(filterAction.toLowerCase()))
    : logs;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Immutable System Audit Logs (ADMIN Only)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Cryptographically timestamped trail for cataloguing, circulation, tagging, member security, and auth events (NFR01, NFR02).
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            onClick={fetchLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing <strong className="text-white">{filtered.length}</strong> immutable log events</span>
          <span className="font-mono text-[10px] text-cyan-400">Tamper-Evident WAL Ledger</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-800">
            <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Log ID</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Resource</th>
                <th className="py-2.5 px-3">Target ID</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No audit events found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors font-mono text-[11px]">
                    <td className="py-2.5 px-3 text-slate-400">#{log.id}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{log.resource_type}</td>
                    <td className="py-2.5 px-3 text-slate-400">{log.resource_id || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">
                      {log.actor_user_id ? `User #${log.actor_user_id}` : 'System'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans text-[10px] max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── System Settings View ─────────────────────────────────────────────────
export const SystemSettingsView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role_name === 'ADMIN';

  const [activeSection, setActiveSection] = useState<'params' | 'backups' | 'updates' | 'notifications'>('params');

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({
    max_fine_limit: '15.0',
    loan_period_days: '14',
    grace_period_days: '2',
    fine_rate_per_day: '0.50',
    duplicate_event_window_ms: '3000'
  });
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Backup & Restore State (AC10, FR11)
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState<boolean>(false);
  const [backupNote, setBackupNote] = useState<string>('');
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [validatingBackup, setValidatingBackup] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, BackupValidationResult>>({});
  const [restoreModalFile, setRestoreModalFile] = useState<string | null>(null);
  const [restoreConfirmationText, setRestoreConfirmationText] = useState<string>('');
  const [restoring, setRestoring] = useState<boolean>(false);
  const [backupMsg, setBackupMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Offline Updates State (AC09, FR12)
  const [versionInfo, setVersionInfo] = useState<OfflineVersionInfo | null>(null);
  const [updateHistory, setUpdateHistory] = useState<UpdateHistoryItem[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState<boolean>(false);

  // Notifications State (FR09)
  const [adapters, setAdapters] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [sendingTest, setSendingTest] = useState<boolean>(false);
  const [testForm, setTestForm] = useState({
    channel: 'email',
    recipient: 'patron@example.local',
    subject: 'Overdue Notice Simulation',
    body: 'Automated notice: Please return your borrowed items to avoid overdue fines.'
  });
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const fetchConfig = async () => {
    try {
      const data = await api.getSystemHealth();
      setHealth(data);
      const s = await api.getSystemSettings();
      if (Array.isArray(s)) {
        const mapped: Record<string, string> = {};
        s.forEach((item: any) => { mapped[item.key] = item.value; });
        setSettings(prev => ({ ...prev, ...mapped }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBackups = async () => {
    if (!isAdmin) return;
    setLoadingBackups(true);
    try {
      const data = await api.listBackups();
      setBackups(data);
    } catch (err: any) {
      setBackupMsg({ text: err.message || 'Failed to load backups.', isError: true });
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchUpdates = async () => {
    setLoadingUpdates(true);
    try {
      const v = await api.getApplicationVersion();
      setVersionInfo(v);
      if (isAdmin) {
        const h = await api.getUpdateHistory();
        setUpdateHistory(Array.isArray(h) ? h : []);
      }
    } catch (err) {
      console.error('Failed to load offline update history', err);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const fetchNotificationsData = async () => {
    setLoadingNotifications(true);
    try {
      const ad = await api.getNotificationAdapters();
      if (ad && ad.adapters) setAdapters(ad.adapters);
      const notifs = await api.getNotifications({ limit: 25 });
      setNotifications(notifs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchUpdates();
    if (isAdmin) {
      fetchBackups();
      fetchNotificationsData();
    }
  }, [isAdmin]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      await api.updateSystemSettings(settings);
      setSuccessMsg("System configuration updated successfully. Business rules recalculated.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to save settings: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Create Backup
  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setCreatingBackup(true);
    setBackupMsg(null);
    try {
      const res = await api.createBackup(backupNote || undefined);
      setBackupNote('');
      setBackupMsg({
        text: `Consistent online backup created: ${res.filename} (${(res.size_bytes / 1024).toFixed(1)} KB, SHA-256 verified).`,
        isError: false
      });
      await fetchBackups();
    } catch (err: any) {
      setBackupMsg({ text: err.message || 'Failed to create backup.', isError: true });
    } finally {
      setCreatingBackup(false);
    }
  };

  // Validate Backup
  const handleValidateBackup = async (filename: string) => {
    setValidatingBackup(filename);
    try {
      const res = await api.validateBackup(filename);
      setValidationResults(prev => ({ ...prev, [filename]: res }));
      setBackupMsg({
        text: `Backup ${filename} validation: ${res.is_valid ? 'PASSED (Integrity OK, SHA-256 match)' : 'FAILED (Hash mismatch)'}.`,
        isError: !res.is_valid
      });
    } catch (err: any) {
      setBackupMsg({ text: err.message || 'Validation request failed.', isError: true });
    } finally {
      setValidatingBackup(null);
    }
  };

  // Restore Backup
  const handleConfirmRestore = async () => {
    if (!restoreModalFile || restoreConfirmationText !== 'RESTORE') {
      alert("Please type 'RESTORE' to confirm this disaster recovery operation.");
      return;
    }
    setRestoring(true);
    try {
      const res = await api.restoreBackup(restoreModalFile);
      setRestoreModalFile(null);
      setRestoreConfirmationText('');
      setBackupMsg({
        text: `Database successfully restored from ${res.restored_from || restoreModalFile}. System state verified.`,
        isError: false
      });
      await fetchConfig();
      await fetchBackups();
    } catch (err: any) {
      setBackupMsg({ text: err.message || 'Failed to restore backup.', isError: true });
    } finally {
      setRestoring(false);
    }
  };

  // Retry Notification
  const handleRetryNotification = async (id: number) => {
    setRetryingId(id);
    setNotificationMsg(null);
    try {
      await api.retryNotification(id);
      setNotificationMsg({ text: `Notification #${id} redelivery dispatched via adapter gateway.`, isError: false });
      await fetchNotificationsData();
    } catch (err: any) {
      setNotificationMsg({ text: err.message || 'Failed to retry notification.', isError: true });
    } finally {
      setRetryingId(null);
    }
  };

  // Send Test Notification
  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setNotificationMsg(null);
    try {
      await api.sendTestNotification({
        channel: testForm.channel,
        recipient: testForm.recipient,
        subject: testForm.subject,
        body: testForm.body
      });
      setNotificationMsg({
        text: `Test ${testForm.channel.toUpperCase()} dispatch sent successfully to ${testForm.recipient}.`,
        isError: false
      });
      await fetchNotificationsData();
    } catch (err: any) {
      setNotificationMsg({ text: err.message || 'Failed to send test notification.', isError: true });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-emerald-400" />
            <span>System Administration &amp; Operational Health</span>
          </h2>
          <p className="text-xs text-slate-400">
            Disaster recovery, air-gapped lifecycle, automated dispatch gateways, and business rules (AC09, AC10, FR09, FR11, FR12).
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSection('params')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeSection === 'params'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Parameters
          </button>
          <button
            onClick={() => setActiveSection('backups')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center space-x-1 ${
              activeSection === 'backups'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backups &amp; DR</span>
          </button>
          <button
            onClick={() => { setActiveSection('updates'); fetchUpdates(); }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center space-x-1 ${
              activeSection === 'updates'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Offline Lifecycle</span>
          </button>
          <button
            onClick={() => setActiveSection('notifications')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center space-x-1 ${
              activeSection === 'notifications'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Dispatch &amp; Print</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Database Status</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 capitalize">
            {health?.database.status || 'Connected'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Journal: {health?.database.journal_mode || 'WAL'} • Size: {health?.database.file_size_kb || 0} KB
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Offline Deployment</span>
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-400">Air-Gapped Ready</div>
          <div className="text-[11px] text-slate-400 font-mono">
            Zero cloud/Redis dependencies • Provider-neutral
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>SOP Compliance</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white">AISYS SOP 2026</div>
          <div className="text-[11px] text-emerald-400 font-mono">
            Version: {versionInfo?.version || health?.version || '1.0.0-rc1'}
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: BUSINESS PARAMETERS ─────────────────────────── */}
      {activeSection === 'params' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Dynamic Circulation &amp; RFID Business Parameters (FR11)</h3>
              <p className="text-xs text-slate-400">Adjust loan durations, fine caps, and RFID read windows in real time.</p>
            </div>
            {isAdmin && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all flex items-center space-x-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Configuration</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-medium">Max Unpaid Fine Limit (AC04 Cap) ($)</span>
              <input
                type="number"
                step="0.5"
                disabled={!isAdmin}
                value={settings.max_fine_limit || '15.0'}
                onChange={e => setSettings({ ...settings, max_fine_limit: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-rose-400 font-mono focus:outline-none focus:border-rose-500 disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400">Patrons with balance &gt; limit are blocked from checkout.</p>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-medium">Standard Borrowing Period (Days)</span>
              <input
                type="number"
                disabled={!isAdmin}
                value={settings.loan_period_days || '14'}
                onChange={e => setSettings({ ...settings, loan_period_days: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-emerald-400 font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400">Due date calculated automatically at checkout.</p>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-medium">RFID Sliding-Window Deduplication (ms)</span>
              <input
                type="number"
                step="500"
                disabled={!isAdmin}
                value={settings.duplicate_event_window_ms || '3000'}
                onChange={e => setSettings({ ...settings, duplicate_event_window_ms: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-cyan-400 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400">Suppresses duplicate tag reads within configured window.</p>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-medium">Daily Overdue Penalty Fee ($)</span>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={settings.fine_rate_per_day || '0.50'}
                onChange={e => setSettings({ ...settings, fine_rate_per_day: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-md text-sm text-amber-400 font-mono focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
              <p className="text-[10px] text-slate-400">Assessed daily after grace period expiration upon check-in.</p>
            </div>
          </div>
        </form>
      )}

      {/* ─── SECTION 2: BACKUPS & DISASTER RECOVERY (AC10, FR11) ─────────── */}
      {activeSection === 'backups' && (
        <div className="space-y-6">
          {/* Create Backup Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Consistent Online SQLite Database Backup (AC10, FR11)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Creates safe point-in-time snapshot using sqlite3.backup API with companion SHA-256 integrity metadata.
                </p>
              </div>
              <button
                onClick={fetchBackups}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                title="Refresh Backups"
              >
                <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {backupMsg && (
              <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                backupMsg.isError
                  ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
              }`}>
                {backupMsg.isError ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <span>{backupMsg.text}</span>
              </div>
            )}

            {isAdmin ? (
              <form onSubmit={handleCreateBackup} className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Optional backup note / reason (e.g., Pre-maintenance snapshot)..."
                  value={backupNote}
                  onChange={e => setBackupNote(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={creatingBackup}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center justify-center space-x-1.5 shrink-0"
                >
                  {creatingBackup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Generate Snapshot</span>
                </button>
              </form>
            ) : (
              <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-400 border border-slate-800">
                <Lock className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                Backup creation and restoration are restricted to System Administrators.
              </div>
            )}
          </div>

          {/* Backups List Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Available Backups (<strong className="text-white">{backups.length}</strong>)</span>
              <span className="font-mono text-[10px] text-emerald-400">SQLite3 Backup API • SHA-256 Digest</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-800">
                <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Filename &amp; Note</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">Created At</th>
                    <th className="py-2.5 px-3">SHA-256 Checksum</th>
                    <th className="py-2.5 px-3">Integrity</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-[11px]">
                  {loadingBackups ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                        Scanning backup archive...
                      </td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No database backups found. Click "Generate Snapshot" to create the first point-in-time backup.
                      </td>
                    </tr>
                  ) : (
                    backups.map(b => {
                      const vRes = validationResults[b.filename];
                      return (
                        <tr key={b.filename} className="hover:bg-slate-800/40 transition-colors font-mono">
                          <td className="py-2.5 px-3">
                            <span className="text-white font-semibold block">{b.filename}</span>
                            <span className="text-[10px] text-slate-400 font-sans">{b.note || 'Manual backup'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {(b.size_bytes / 1024).toFixed(1)} KB
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                            {new Date(b.created_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]" title={b.sha256}>
                            {b.sha256 ? `${b.sha256.substring(0, 16)}...` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            {vRes ? (
                              vRes.is_valid ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ✓ Verified
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  ✗ Mismatch
                                </span>
                              )
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                Unchecked
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2 font-sans">
                            <button
                              onClick={() => handleValidateBackup(b.filename)}
                              disabled={validatingBackup === b.filename}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-all inline-flex items-center space-x-1"
                            >
                              {validatingBackup === b.filename ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 text-cyan-400" />
                              )}
                              <span>Verify</span>
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setRestoreModalFile(b.filename);
                                  setRestoreConfirmationText('');
                                }}
                                className="px-2 py-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded text-[10px] font-semibold transition-all inline-flex items-center space-x-1"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>Restore</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Restore Confirmation Dialog Modal */}
          {restoreModalFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-rose-500/50 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center space-x-3 text-rose-400">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <h3 className="text-base font-bold text-white">Confirm Disaster Recovery Restore</h3>
                </div>

                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-200 space-y-2">
                  <p className="font-semibold">
                    CAUTION: You are about to restore the database from snapshot:
                  </p>
                  <p className="font-mono text-[11px] text-white bg-slate-950 p-2 rounded border border-rose-900">
                    {restoreModalFile}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    This will replace the live SQLite database tables with this backup snapshot. Any records created after this backup will be reverted.
                  </p>
                </div>

                <div className="space-y-1.5 text-xs">
                  <label className="text-slate-400 block">
                    Type <strong className="text-white font-mono">RESTORE</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    value={restoreConfirmationText}
                    onChange={e => setRestoreConfirmationText(e.target.value)}
                    placeholder="RESTORE"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white font-mono tracking-widest text-center focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => {
                      setRestoreModalFile(null);
                      setRestoreConfirmationText('');
                    }}
                    disabled={restoring}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRestore}
                    disabled={restoreConfirmationText !== 'RESTORE' || restoring}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all flex items-center space-x-1.5"
                  >
                    {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>Execute Restore</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SECTION 3: OFFLINE LIFECYCLE & UPDATES (AC09, FR12) ─────────── */}
      {activeSection === 'updates' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Offline Lifecycle &amp; Air-Gapped Packaging (AC09, FR12)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Verified offline tar.gz package installer with SHA-256 integrity validation, automated pre-update snapshots, and atomic rollback.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Current Version</span>
                <span className="text-base font-bold text-white font-mono">{versionInfo?.version || '1.0.0-rc1'}</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Air-Gap Status</span>
                <span className="text-base font-bold text-emerald-400">100% Offline Ready</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">SOP Standard</span>
                <span className="text-base font-bold text-cyan-400">AISYS Candidate SOP</span>
              </div>
            </div>
          </div>

          {/* Update History Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Offline Update &amp; Rollback History Log</span>
              <span className="font-mono text-[10px] text-cyan-400">Audit Trail: .system_update_history.json</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-800">
                <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">From Version</th>
                    <th className="py-2.5 px-3">To Version</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-[11px] font-mono">
                  {loadingUpdates ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                        Loading update logs...
                      </td>
                    </tr>
                  ) : updateHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        Base version 1.0.0-rc1 deployed. No subsequent offline patches applied.
                      </td>
                    </tr>
                  ) : (
                    updateHistory.map((item, idx) => {
                      const rawAction = item?.action || (item as any)?.event || 'apply';
                      const isApply = String(rawAction).toLowerCase().includes('apply');
                      const actionText = isApply ? 'APPLY' : 'ROLLBACK';
                      const ts = item?.timestamp || (item as any)?.applied_at || (item as any)?.rolled_back_at;
                      const displayDate = ts ? new Date(ts).toLocaleString() : '—';
                      const fromVer = item?.from_version || (item as any)?.previous_version || '—';
                      const toVer = item?.to_version || (item as any)?.target_version || (item as any)?.restored_version || '—';
                      const statusStr = item?.status || (isApply ? 'SUCCESS' : 'ROLLED_BACK');
                      const detailsStr = item?.details
                        ? (typeof item.details === 'object' ? JSON.stringify(item.details) : String(item.details))
                        : '—';

                      return (
                        <tr key={item?.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400 font-sans">{displayDate}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isApply
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            }`}>
                              {actionText}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{fromVer}</td>
                          <td className="py-2.5 px-3 text-white font-semibold">{toVer}</td>
                          <td className="py-2.5 px-3 text-emerald-400">{statusStr}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans text-[10px] max-w-xs truncate" title={detailsStr}>
                            {detailsStr}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 4: NOTIFICATION ADAPTERS & DISPATCH (FR09) ─────────── */}
      {activeSection === 'notifications' && (
        <div className="space-y-6">
          {notificationMsg && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              notificationMsg.isError
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
            }`}>
              {notificationMsg.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{notificationMsg.text}</span>
            </div>
          )}

          {/* Registered Adapters Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span>Registered Notification Adapters &amp; Thermal Slip Printers (FR09)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Provider-neutral multi-channel dispatch layer: SMTP email, SMS gateway, and ESC/POS thermal receipt slip printer.
                </p>
              </div>
              <button
                onClick={fetchNotificationsData}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                title="Refresh Queue"
              >
                <RefreshCw className={`w-4 h-4 ${loadingNotifications ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {adapters.map((ad, idx) => (
                <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white capitalize flex items-center gap-1.5">
                      {ad.channel === 'email' ? <Mail className="w-3.5 h-3.5 text-cyan-400" /> :
                       ad.channel === 'sms' ? <Send className="w-3.5 h-3.5 text-amber-400" /> :
                       <Printer className="w-3.5 h-3.5 text-emerald-400" />}
                      {ad.channel} Gateway
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      {ad.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{ad.provider}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Total Dispatches: {ad.sent_count ?? ad.printed_slips ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Dispatch Form */}
          {isAdmin && (
            <form onSubmit={handleSendTestNotification} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Simulate / Send Test Notice</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Channel</label>
                  <select
                    value={testForm.channel}
                    onChange={e => setTestForm({ ...testForm, channel: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="email">Email (Mock SMTP)</option>
                    <option value="sms">SMS Gateway</option>
                    <option value="thermal_print">Thermal Slip Printer (ESC/POS)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Recipient / Target</label>
                  <input
                    type="text"
                    value={testForm.recipient}
                    onChange={e => setTestForm({ ...testForm, recipient: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Subject</label>
                  <input
                    type="text"
                    value={testForm.subject}
                    onChange={e => setTestForm({ ...testForm, subject: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <input
                  type="text"
                  placeholder="Notification message body..."
                  value={testForm.body}
                  onChange={e => setTestForm({ ...testForm, body: e.target.value })}
                  className="flex-1 mr-3 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center space-x-1.5 shrink-0"
                >
                  {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Dispatch Notice</span>
                </button>
              </div>
            </form>
          )}

          {/* Recent Notifications Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Notification Dispatch Queue (<strong className="text-white">{notifications.length}</strong>)</span>
              <span className="font-mono text-[10px] text-emerald-400">Auto Retry Engine Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs divide-y divide-slate-800">
                <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Subject / Body</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-[11px]">
                  {notifications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No notifications in queue.
                      </td>
                    </tr>
                  ) : (
                    notifications.map(n => (
                      <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500">#{n.id}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 uppercase">
                            {n.channel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-mono text-[10px]">{n.recipient}</td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={n.body}>
                          <span className="font-semibold block text-white">{n.subject}</span>
                          <span className="text-[10px] text-slate-400">{n.body}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            n.status === 'sent'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : n.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {n.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {n.status === 'failed' && (
                            <button
                              onClick={() => handleRetryNotification(n.id)}
                              disabled={retryingId === n.id}
                              className="px-2 py-1 bg-amber-600/80 hover:bg-amber-500 text-white rounded text-[10px] font-semibold transition-all inline-flex items-center space-x-1"
                            >
                              {retryingId === n.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                              <span>Retry</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
