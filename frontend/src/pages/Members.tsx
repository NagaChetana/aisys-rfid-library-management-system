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
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Member } from '../types';

const INDIAN_PHONE_REGEX = /^(\+91[\-\s]?|91[\-\s]?|0)?[6-9]\d{9}$/;
const INTL_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

function validateMemberForm(data: {
  full_name: string;
  email: string;
  phone: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  // Full Name is mandatory
  const trimmedName = data.full_name.trim();
  if (!trimmedName) {
    errors.full_name = 'Full name is required.';
  }

  // Email is optional, but if provided must be valid format
  const trimmedEmail = data.email.trim();
  if (trimmedEmail) {
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address (e.g. patron@university.edu).';
    }
  }

  // Phone is optional, but if provided must be valid Indian or international number
  const trimmedPhone = data.phone.trim();
  if (trimmedPhone) {
    if (/[a-zA-Z]/.test(trimmedPhone)) {
      errors.phone = 'Phone number must not contain letters.';
    } else {
      const clean = trimmedPhone.replace(/[\s\-()]/g, '');
      const isIndianPattern =
        trimmedPhone.startsWith('+91') ||
        trimmedPhone.startsWith('91') ||
        (!trimmedPhone.startsWith('+') && clean.length === 10) ||
        (clean.length === 11 && clean.startsWith('0'));

      if (isIndianPattern) {
        if (!INDIAN_PHONE_REGEX.test(trimmedPhone) && !INDIAN_PHONE_REGEX.test(clean)) {
          errors.phone = 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210).';
        }
      } else if (trimmedPhone.startsWith('+')) {
        if (!INTL_PHONE_REGEX.test(clean)) {
          errors.phone = 'Please enter a valid international phone number with country code.';
        }
      } else {
        if (!INDIAN_PHONE_REGEX.test(clean)) {
          errors.phone = 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 98765 43210).';
        }
      }
    }
  }

  return errors;
}

function parseServerErrors(err: any): { fieldErrors: Record<string, string>; generalError: string | null } {
  const fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;

  if (!err) {
    return { fieldErrors, generalError: 'An unexpected error occurred.' };
  }

  let details: any = null;
  if (err.data && err.data.detail) {
    details = err.data.detail;
  } else if (typeof err.message === 'string') {
    const trimmed = err.message.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        details = Array.isArray(parsed) ? parsed : (parsed.detail || parsed);
      } catch {
        // Not JSON
      }
    }
  }

  if (Array.isArray(details)) {
    const unmapped: string[] = [];
    for (const item of details) {
      const rawMsg: string = item.msg || item.message || String(item);
      const cleanMsg = rawMsg.replace(/^(Value error,\s*|Assertion failed,\s*)/i, '').trim();

      let field: string | null = null;
      if (Array.isArray(item.loc) && item.loc.length > 0) {
        field = String(item.loc[item.loc.length - 1]);
      } else if (item.field) {
        field = String(item.field);
      }

      if (field && ['full_name', 'email', 'phone', 'smart_card_uid', 'membership_type', 'max_allowed_loans'].includes(field)) {
        fieldErrors[field] = cleanMsg;
      } else {
        unmapped.push(cleanMsg);
      }
    }

    if (unmapped.length > 0) {
      generalError = unmapped.join('. ');
    } else if (Object.keys(fieldErrors).length === 0) {
      generalError = 'Validation failed. Please verify the entered fields.';
    }
  } else if (typeof details === 'string') {
    generalError = details;
  } else if (err.message && typeof err.message === 'string') {
    generalError = err.message;
  } else {
    generalError = 'Failed to register member.';
  }

  return { fieldErrors, generalError };
}

export const Members: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role_name === 'ADMIN';
  const canRegisterMember = user?.role_name === 'ADMIN' || user?.role_name === 'LIBRARIAN';

  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showCardModal, setShowCardModal] = useState<Member | null>(null);
  const [selectedMemberDetails, setSelectedMemberDetails] = useState<Member | null>(null);
  const [newCardUid, setNewCardUid] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

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
        limit: 250
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
    if (isSubmitting) return;

    setModalError(null);
    setFieldErrors({});

    // Client-side validation
    const errors = validateMemberForm(newMember);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: newMember.full_name.trim(),
        email: newMember.email.trim() || undefined,
        phone: newMember.phone.trim() || undefined,
        membership_type: newMember.membership_type,
        max_allowed_loans: newMember.max_allowed_loans,
        smart_card_uid: newMember.smart_card_uid.trim() || undefined,
      };

      const created = await api.createMember(payload);
      setShowRegisterModal(false);
      setNewMember({
        full_name: '',
        email: '',
        phone: '',
        membership_type: 'student',
        max_allowed_loans: 5,
        smart_card_uid: ''
      });
      setFieldErrors({});
      setSuccessNotification(`Patron "${created.full_name}" (${created.membership_number}) registered successfully.`);
      setTimeout(() => setSuccessNotification(null), 5000);
      fetchMembers();
    } catch (err: any) {
      const { fieldErrors: serverFieldErrors, generalError } = parseServerErrors(err);
      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors);
      }
      if (generalError) {
        setModalError(generalError);
      }
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
      {/* Success Notification Banner */}
      {successNotification && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span className="font-semibold">{successNotification}</span>
          </div>
          <button
            onClick={() => setSuccessNotification(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer min-w-[130px]"
            >
              <option value="">Status: All</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canRegisterMember && (
            <button
              onClick={() => {
                setModalError(null);
                setFieldErrors({});
                setShowRegisterModal(true);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Member</span>
            </button>
          )}
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
                  {isAdmin && <th className="py-3 px-4 text-right">Admin Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold">
                      <button
                        onClick={() => setSelectedMemberDetails(m)}
                        className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer focus:outline-none inline-flex items-center space-x-1"
                        title="Click to view patron details"
                      >
                        <span>{m.membership_number}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedMemberDetails(m)}
                        className="text-left group focus:outline-none"
                      >
                        <div className="font-semibold text-white group-hover:text-blue-300 transition-colors">{m.full_name}</div>
                        <div className="text-[11px] text-slate-400">{m.email || m.phone || 'No contact'}</div>
                      </button>
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
                    {isAdmin && (
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBlock(m.id);
                            }}
                            className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs transition-colors"
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnblock(m.id);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40 text-xs transition-colors"
                          >
                            Unblock
                          </button>
                        )}
                      </td>
                    )}
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
                onClick={() => {
                  setShowRegisterModal(false);
                  setFieldErrors({});
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} noValidate className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Patron's legal name..."
                  value={newMember.full_name}
                  onChange={(e) => {
                    setNewMember({ ...newMember, full_name: e.target.value });
                    if (fieldErrors.full_name) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.full_name;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3 py-1.5 bg-slate-950 border rounded text-white text-xs focus:outline-none transition-colors ${
                    fieldErrors.full_name
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                      : 'border-slate-700 focus:border-blue-500'
                  }`}
                />
                {fieldErrors.full_name && (
                  <p className="mt-1 text-[11px] text-rose-400 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{fieldErrors.full_name}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Email <span className="text-slate-500 text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="patron@university.edu"
                    value={newMember.email}
                    onChange={(e) => {
                      setNewMember({ ...newMember, email: e.target.value });
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.email;
                          return next;
                        });
                      }
                    }}
                    className={`w-full px-3 py-1.5 bg-slate-950 border rounded text-white text-xs focus:outline-none transition-colors ${
                      fieldErrors.email
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700 focus:border-blue-500'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-[11px] text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Phone <span className="text-slate-500 text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210 or 9876543210"
                    value={newMember.phone}
                    onChange={(e) => {
                      setNewMember({ ...newMember, phone: e.target.value });
                      if (fieldErrors.phone) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.phone;
                          return next;
                        });
                      }
                    }}
                    className={`w-full px-3 py-1.5 bg-slate-950 border rounded text-white text-xs focus:outline-none transition-colors ${
                      fieldErrors.phone
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700 focus:border-blue-500'
                    }`}
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-[11px] text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{fieldErrors.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Membership Type</label>
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
                  <label className="block text-slate-300 mb-1 font-medium">Max Loans</label>
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

              {isAdmin && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Initial Smart Card UID <span className="text-slate-500 text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CARD-PATRON-9001"
                    value={newMember.smart_card_uid}
                    onChange={(e) => {
                      setNewMember({ ...newMember, smart_card_uid: e.target.value });
                      if (fieldErrors.smart_card_uid) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.smart_card_uid;
                          return next;
                        });
                      }
                    }}
                    className={`w-full px-3 py-1.5 bg-slate-950 border rounded text-white text-xs focus:outline-none font-mono transition-colors ${
                      fieldErrors.smart_card_uid
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  />
                  {fieldErrors.smart_card_uid && (
                    <p className="mt-1 text-[11px] text-rose-400 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{fieldErrors.smart_card_uid}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(false);
                    setFieldErrors({});
                    setModalError(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <span>Register Patron</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Patron Details View (MEM-04) */}
      {selectedMemberDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{selectedMemberDetails.full_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedMemberDetails.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {selectedMemberDetails.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedMemberDetails.membership_number}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberDetails(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Membership Type</span>
                <span className="text-slate-200 capitalize font-medium text-sm mt-0.5 block">{selectedMemberDetails.membership_type}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Smart Card UID</span>
                <span className="text-cyan-300 font-mono text-sm mt-0.5 block">
                  {selectedMemberDetails.smart_card_uid || 'None assigned'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Email Address</span>
                <span className="text-slate-200 text-sm mt-0.5 block truncate" title={selectedMemberDetails.email || 'None'}>
                  {selectedMemberDetails.email || 'None registered'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Phone Number</span>
                <span className="text-slate-200 font-mono text-sm mt-0.5 block">
                  {selectedMemberDetails.phone || 'None registered'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Active Loans / Limit</span>
                <span className="text-slate-200 text-sm mt-0.5 block font-mono">
                  {selectedMemberDetails.active_loans_count} / {selectedMemberDetails.max_allowed_loans} max
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Fine Balance</span>
                <span className={`text-sm mt-0.5 block font-semibold ${selectedMemberDetails.fine_balance > 15 ? 'text-rose-400' : 'text-slate-200'}`}>
                  ${selectedMemberDetails.fine_balance.toFixed(2)}
                  {selectedMemberDetails.fine_balance > 15 && ' (Exceeds $15 Cap)'}
                </span>
              </div>

              <div className="col-span-2 bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Registration Timestamp</span>
                <span className="text-slate-300 text-xs mt-0.5 block font-mono">
                  {selectedMemberDetails.created_at ? new Date(selectedMemberDetails.created_at).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedMemberDetails(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
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
