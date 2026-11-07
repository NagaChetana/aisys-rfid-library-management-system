import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  CreditCard,
  Ban,
  CheckCircle,
  RefreshCw,
  X,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { Member } from '../types';

export const Members: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showCardModal, setShowCardModal] = useState<Member | null>(null);
  const [newCardUid, setNewCardUid] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Register Form
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    phone: '',
    membership_type: 'student',
    max_allowed_loans: 5,
    smart_card_uid: ''
  });

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await api.getMembers({
        q: search || undefined,
        status: statusFilter || undefined,
        limit: 50
      });
      setMembers(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchMembers, 250);
    return () => clearTimeout(timeout);
  }, [search, statusFilter]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.createMember(newMember);
      setShowRegisterModal(false);
      setNewMember({
        full_name: '',
        email: '',
        phone: '',
        membership_type: 'student',
        max_allowed_loans: 5,
        smart_card_uid: ''
      });
      fetchMembers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to register member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async (id: number) => {
    const reason = prompt('Enter reason for blocking this member:', 'Administrative suspension');
    if (reason === null) return;
    try {
      await api.blockMember(id, reason);
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to block member');
    }
  };

  const handleUnblock = async (id: number) => {
    try {
      await api.unblockMember(id);
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to unblock member');
    }
  };

  const handleAssignCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCardModal) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.assignMemberCard(showCardModal.id, newCardUid);
      setShowCardModal(null);
      setNewCardUid('');
      fetchMembers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to assign card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Patron Name, Member #, Email, Card UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="blocked">Blocked Only</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setModalError(null);
              setShowRegisterModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Member</span>
          </button>
          <button
            onClick={fetchMembers}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Total Registered Patrons: <strong className="text-white">{total}</strong>
          </span>
          <span className="text-blue-400 font-mono text-[11px]">Enforces AC04 Fine Limits & Block Rules</span>
        </div>

        {loading && members.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            Loading member profiles...
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No patrons found matching filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-800">
              <thead className="bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Member #</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Smart Card UID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Fine Balance</th>
                  <th className="py-3 px-4">Active Loans</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                      {m.membership_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{m.full_name}</div>
                      <div className="text-[11px] text-slate-400">{m.email || m.phone || 'No contact'}</div>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700">
                        {m.membership_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-300 text-[11px]">
                      {m.smart_card_uid ? (
                        <span className="inline-flex items-center space-x-1">
                          <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{m.smart_card_uid}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No card assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          m.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      <span className={m.fine_balance > 15 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        ${m.fine_balance.toFixed(2)}
                      </span>
                      {m.fine_balance > 15 && (
                        <span className="ml-1 text-[9px] text-rose-400 block font-normal">
                          Exceeds $15 Cap
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {m.active_loans_count} / {m.max_allowed_loans} max
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setModalError(null);
                          setNewCardUid(m.smart_card_uid || '');
                          setShowCardModal(m);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs transition-colors"
                      >
                        Card UID
                      </button>

                      {m.status === 'active' ? (
                        <button
                          onClick={() => handleBlock(m.id)}
                          className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs transition-colors"
                        >
                          Block
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnblock(m.id)}
                          className="px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 text-xs transition-colors"
                        >
                          Unblock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Register New Member */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <span>Register Library Member</span>
              </h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Patron's legal name..."
                  value={newMember.full_name}
                  onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="patron@university.edu"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1-555-0100"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Membership Type</label>
                  <select
                    value={newMember.membership_type}
                    onChange={(e) => setNewMember({ ...newMember, membership_type: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="researcher">Researcher</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Max Loans</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newMember.max_allowed_loans}
                    onChange={(e) =>
                      setNewMember({ ...newMember, max_allowed_loans: parseInt(e.target.value) || 5 })
                    }
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Initial Smart Card UID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CARD-PATRON-9001"
                  value={newMember.smart_card_uid}
                  onChange={(e) => setNewMember({ ...newMember, smart_card_uid: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Patron'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Smart Card UID */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-cyan-400" />
                <span>Assign Smart Card UID</span>
              </h3>
              <button
                onClick={() => setShowCardModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAssignCard} className="space-y-3 text-xs">
              <div>
                <p className="text-slate-300 mb-2">
                  Assigning 13.56MHz RFID/NFC Patron Badge to:{' '}
                  <strong className="text-white">{showCardModal.full_name}</strong> (
                  {showCardModal.membership_number})
                </p>
                <label className="block text-slate-400 mb-1">Smart Card UID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CARD-ALICE-1001"
                  value={newCardUid}
                  onChange={(e) => setNewCardUid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCardModal(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? 'Binding...' : 'Bind Smart Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
