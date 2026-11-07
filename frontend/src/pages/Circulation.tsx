import React, { useState, useEffect } from 'react';
import {
  Repeat,
  CheckCircle,
  AlertCircle,
  Search,
  Clock,
  ShieldCheck,
  ShieldAlert,
  DollarSign,
  ArrowRight,
  BookOpen,
  UserCheck,
  Calendar,
  Layers,
  History,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { CirculationTransaction, DueDateEnquiryResult, Fine } from '../types';

export const Circulation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkout' | 'checkin' | 'renew' | 'enquiry' | 'history' | 'fines'>('checkout');

  // Checkout State
  const [checkoutMember, setCheckoutMember] = useState<string>('MEM-00001');
  const [checkoutItem, setCheckoutItem] = useState<string>('ACC-000002');
  const [dueDays, setDueDays] = useState<number>(14);
  const [checkoutResult, setCheckoutResult] = useState<CirculationTransaction | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Checkin State
  const [checkinItem, setCheckinItem] = useState<string>('');
  const [checkinResult, setCheckinResult] = useState<CirculationTransaction | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState<boolean>(false);

  // Renew State
  const [renewItem, setRenewItem] = useState<string>('');
  const [renewDays, setRenewDays] = useState<number>(14);
  const [renewResult, setRenewResult] = useState<CirculationTransaction | null>(null);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

  // Due Date Enquiry State
  const [enquiryQuery, setEnquiryQuery] = useState<string>('');
  const [enquiryResult, setEnquiryResult] = useState<DueDateEnquiryResult | null>(null);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const [isEnquiring, setIsEnquiring] = useState<boolean>(false);

  // History & Fines State
  const [transactions, setTransactions] = useState<CirculationTransaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [activeLoansOnly, setActiveLoansOnly] = useState<boolean>(true);

  // Load History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getCirculationHistory({
        limit: 50,
        active_only: activeLoansOnly
      });
      setTransactions(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load Fines
  const loadFines = async () => {
    try {
      const data = await api.getFines({});
      setFines(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    } else if (activeTab === 'fines') {
      loadFines();
    }
  }, [activeTab, activeLoansOnly]);

  // Handle Checkout
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutMember || !checkoutItem) return;

    setIsCheckingOut(true);
    setCheckoutError(null);
    setCheckoutResult(null);

    try {
      const res = await api.checkout({
        membership_number: checkoutMember.trim(),
        accession_number: checkoutItem.trim(),
        due_days: dueDays,
        protocol: 'INTERNAL_UI'
      });
      setCheckoutResult(res);
      setCheckoutItem('');
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed due to circulation rules violation');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Handle Checkin
  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinItem) return;

    setIsCheckingIn(true);
    setCheckinError(null);
    setCheckinResult(null);

    try {
      const res = await api.checkin({
        accession_number: checkinItem.trim(),
        protocol: 'INTERNAL_UI'
      });
      setCheckinResult(res);
      setCheckinItem('');
    } catch (err: any) {
      setCheckinError(err.message || 'Checkin failed');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle Renew
  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewItem) return;

    setIsRenewing(true);
    setRenewError(null);
    setRenewResult(null);

    try {
      const res = await api.renew({
        accession_number: renewItem.trim(),
        additional_days: renewDays,
        protocol: 'INTERNAL_UI'
      });
      setRenewResult(res);
    } catch (err: any) {
      setRenewError(err.message || 'Renewal failed');
    } finally {
      setIsRenewing(false);
    }
  };

  // Handle Due Date Enquiry
  const handleEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enquiryQuery) return;

    setIsEnquiring(true);
    setEnquiryError(null);
    setEnquiryResult(null);

    try {
      const res = await api.dueDateEnquiry({
        accession_number: enquiryQuery.trim()
      });
      setEnquiryResult(res);
    } catch (err: any) {
      setEnquiryError(err.message || 'Loan record not found or item not currently on loan');
    } finally {
      setIsEnquiring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Circulation & Business Rules Engine</h1>
              <p className="text-xs text-slate-400">
                Atomic transactions, real-time EAS bit manipulation, and strict enforcement of reference-only, blocked patron, and fine cap rules (AC03, AC04).
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'checkout' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Issue / Checkout
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'checkin' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Return / Checkin
          </button>
          <button
            onClick={() => setActiveTab('renew')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'renew' ? 'bg-indigo-500 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Renewal
          </button>
          <button
            onClick={() => setActiveTab('enquiry')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'enquiry' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Due Date Enquiry
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'history' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Loan History
          </button>
          <button
            onClick={() => setActiveTab('fines')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'fines' ? 'bg-rose-500 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Fines Registry
          </button>
        </div>
      </div>

      {/* TAB 1: CHECKOUT / ISSUE */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Book Issue Desk (Atomic Checkout)
              </h2>

              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Patron Membership Number or Smart Card UID *
                    </label>
                    <input
                      type="text"
                      value={checkoutMember}
                      onChange={(e) => setCheckoutMember(e.target.value)}
                      placeholder="e.g. MEM-00001 or CARD-ALICE-1001"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCheckoutMember('MEM-00001')}
                        className="text-[10px] text-slate-400 hover:text-amber-400 underline"
                      >
                        Alice (Active)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutMember('MEM-00002')}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Bob (Blocked Test)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutMember('MEM-00003')}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        Charlie ($18.50 Fine Test)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Book Copy Accession Number, Barcode, or Tag EPC *
                    </label>
                    <input
                      type="text"
                      value={checkoutItem}
                      onChange={(e) => setCheckoutItem(e.target.value)}
                      placeholder="e.g. ACC-000002 or BAR-000002"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setCheckoutItem('ACC-000002')}
                        className="text-[10px] text-slate-400 hover:text-amber-400 underline"
                      >
                        Clean Arch (Avail)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutItem('ACC-000001')}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        ACC-000001 (Reference-Only Test)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Loan Duration (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={dueDays}
                      onChange={(e) => setDueDays(parseInt(e.target.value) || 14)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isCheckingOut}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isCheckingOut ? (
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Execute Issue Transaction
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Error Alert */}
              {checkoutError && (
                <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block mb-0.5">Circulation Rule Violation:</span>
                    <span>{checkoutError}</span>
                  </div>
                </div>
              )}

              {/* Success Card */}
              {checkoutResult && (
                <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      Checkout Completed Successfully
                    </span>
                    <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                      TX #{checkoutResult.id}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Item / Accession</span>
                      <span className="font-mono font-semibold text-white">{checkoutResult.accession_number}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Borrower</span>
                      <span className="font-semibold text-white">{checkoutResult.member_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Due Date</span>
                      <span className="font-semibold text-amber-400">
                        {new Date(checkoutResult.due_date || '').toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">RFID Security Bit</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                        <ShieldCheck className="w-3 h-3" />
                        EAS Disarmed (Exit OK)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Rules Legend */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-cyan-400" />
                Active Circulation Rules (AC04)
              </h3>
              <ul className="space-y-3 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Reference-Only Guard:</strong> Items flagged as reference-only (e.g. ACC-000001) are strictly barred from removal.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Blocked / Suspended Members:</strong> Any patron in blocked/suspended status is disallowed from borrowing.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">Fine Threshold Cap ($15.00):</strong> Members carrying unpaid fines &gt; $15.00 (e.g. Charlie Brown) are denied loans.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <div>
                    <strong className="text-white">EAS Bit Automation:</strong> On checkout, middleware sets EAS=False (disarmed). On check-in, EAS=True (armed).
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHECKIN / RETURN */}
      {activeTab === 'checkin' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Book Return Desk (Atomic Check-in & EAS Re-arming)
          </h2>

          <form onSubmit={handleCheckin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Scan or Enter Accession Number, Barcode, or RFID Tag UID *
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={checkinItem}
                  onChange={(e) => setCheckinItem(e.target.value)}
                  placeholder="e.g. ACC-000002 or EPC Hex"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
                <button
                  type="submit"
                  disabled={isCheckingIn}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isCheckingIn ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Process Return
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {checkinError && (
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{checkinError}</span>
            </div>
          )}

          {checkinResult && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  Return Processed Successfully
                </span>
                <span className="font-mono text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                  Item Back to Available
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Accession</span>
                  <span className="font-mono font-semibold text-white">{checkinResult.accession_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Returned By</span>
                  <span className="font-semibold text-white">{checkinResult.member_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">RFID Security Bit</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                    <ShieldAlert className="w-3 h-3" />
                    EAS Armed (Protected)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Overdue Fine</span>
                  <span className="font-semibold text-rose-400">${checkinResult.fine_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RENEWAL */}
      {activeTab === 'renew' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-indigo-400" />
            Loan Renewal Service (AC03)
          </h2>

          <form onSubmit={handleRenew} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Accession Number or RFID Tag UID *
                </label>
                <input
                  type="text"
                  value={renewItem}
                  onChange={(e) => setRenewItem(e.target.value)}
                  placeholder="e.g. ACC-000002"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Extension Days
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={renewDays}
                  onChange={(e) => setRenewDays(parseInt(e.target.value) || 14)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isRenewing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isRenewing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Repeat className="w-4 h-4" />
                  Confirm Renewal
                </>
              )}
            </button>
          </form>

          {renewError && (
            <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{renewError}</span>
            </div>
          )}

          {renewResult && (
            <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-300 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-400">
                  <CheckCircle className="w-4 h-4" />
                  Loan Successfully Renewed
                </span>
                <span className="font-mono text-[11px] bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">
                  Renewal #{renewResult.renewal_count}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-indigo-500/20 text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-500 block">Accession</span>
                  <span className="font-mono font-semibold text-white">{renewResult.accession_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Borrower</span>
                  <span className="font-semibold text-white">{renewResult.member_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Extended Due Date</span>
                  <span className="font-semibold text-indigo-300">
                    {new Date(renewResult.due_date || '').toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DUE DATE ENQUIRY */}
      {activeTab === 'enquiry' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400" />
            Patron Due-Date & Overdue Enquiry (FR04)
          </h2>

          <form onSubmit={handleEnquiry} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Enter Book Accession Number or RFID Tag UID
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={enquiryQuery}
                  onChange={(e) => setEnquiryQuery(e.target.value)}
                  placeholder="e.g. ACC-000002"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
                <button
                  type="submit"
                  disabled={isEnquiring}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isEnquiring ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Lookup Loan Status
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {enquiryError && (
            <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-xs flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <span>{enquiryError}</span>
            </div>
          )}

          {enquiryResult && (
            <div className="mt-4 p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white">{enquiryResult.book_title}</h3>
                  <span className="font-mono text-xs text-slate-400">Accession: {enquiryResult.accession_number}</span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    enquiryResult.is_overdue
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {enquiryResult.is_overdue ? `OVERDUE (${enquiryResult.days_overdue} days)` : 'LOAN ACTIVE / OK'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Borrower</span>
                  <span className="font-semibold text-white">{enquiryResult.member_name}</span>
                  <span className="text-[10px] text-slate-400 block font-mono">({enquiryResult.membership_number})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Checkout Date</span>
                  <span className="text-slate-300">
                    {new Date(enquiryResult.checkout_date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Due Date</span>
                  <span className="font-semibold text-amber-400">
                    {new Date(enquiryResult.due_date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Estimated Fine</span>
                  <span className={`font-bold ${enquiryResult.estimated_fine > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    ${enquiryResult.estimated_fine.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: TRANSACTION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              Circulation Audit Log & Transaction Registry
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLoansOnly}
                  onChange={(e) => setActiveLoansOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                />
                Active loans only
              </label>
              <button
                onClick={loadHistory}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Borrower</th>
                  <th className="px-4 py-3 font-semibold">Protocol</th>
                  <th className="px-4 py-3 font-semibold">Due Date</th>
                  <th className="px-4 py-3 font-semibold">Status / Return Date</th>
                  <th className="px-4 py-3 font-semibold">EAS Bit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Loading circulation records...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No circulation records found.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-500">#{tx.id}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            tx.transaction_type === 'checkout'
                              ? 'bg-amber-500/20 text-amber-300'
                              : tx.transaction_type === 'checkin'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block font-sans">{tx.book_title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{tx.accession_number}</span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className="text-white block">{tx.member_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{tx.membership_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          {tx.protocol}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-amber-300">
                        {tx.due_date ? new Date(tx.due_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {tx.return_date ? (
                          <span className="text-emerald-400">Returned {new Date(tx.return_date).toLocaleDateString()}</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">Active Loan</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tx.eas_bit !== undefined ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              tx.eas_bit
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {tx.eas_bit ? 'ARMED' : 'DISARMED'}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: FINES REGISTRY */}
      {activeTab === 'fines' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-rose-400" />
              Patron Fine Ledger & Penalty Tracking
            </h2>
            <button
              onClick={loadFines}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assessed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                {fines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No fines recorded in system.
                    </td>
                  </tr>
                ) : (
                  fines.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-slate-500">#{f.id}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white block">{f.member_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{f.membership_number}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-rose-400">${f.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-300">{f.reason}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            f.status === 'unpaid'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(f.assessed_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
