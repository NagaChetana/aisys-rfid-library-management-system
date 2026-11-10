import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  RefreshCw,
  Filter,
  User,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { CirculationTransaction, DueDateEnquiryResult, Fine, Member } from '../types';

export const Circulation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'checkout' | 'checkin' | 'renew' | 'enquiry' | 'history' | 'fines'>('checkout');

  // Checkout State
  const [checkoutMember, setCheckoutMember] = useState<string>('MEM-00001');
  const [checkoutItem, setCheckoutItem] = useState<string>('ACC-000002');
  const [dueDays, setDueDays] = useState<number>(14);
  const [checkoutResult, setCheckoutResult] = useState<CirculationTransaction | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Patron Autocomplete State
  const [patronSuggestions, setPatronSuggestions] = useState<Member[]>([]);
  const [isSearchingPatron, setIsSearchingPatron] = useState<boolean>(false);
  const [showPatronDropdown, setShowPatronDropdown] = useState<boolean>(false);
  const [highlightedPatronIndex, setHighlightedPatronIndex] = useState<number>(-1);
  const patronDropdownRef = useRef<HTMLDivElement>(null);

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

  // History State with Search & Filtering
  const [transactions, setTransactions] = useState<CirculationTransaction[]>([]);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatus, setHistoryStatus] = useState<string>('all');
  const [historyProtocol, setHistoryProtocol] = useState<string>('all');
  const [activeLoansOnly, setActiveLoansOnly] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Fines State
  const [fines, setFines] = useState<Fine[]>([]);
  const [payingFineId, setPayingFineId] = useState<number | null>(null);
  const [fineActionMsg, setFineActionMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Patron Autocomplete query handler
  useEffect(() => {
    if (!checkoutMember || checkoutMember.trim().length === 0) {
      setPatronSuggestions([]);
      setShowPatronDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPatron(true);
      try {
        const res = await api.getMembers({ q: checkoutMember.trim(), limit: 7 });
        setPatronSuggestions(res.items || []);
        setShowPatronDropdown(true);
        setHighlightedPatronIndex(-1);
      } catch (e) {
        console.error('Patron search error:', e);
      } finally {
        setIsSearchingPatron(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [checkoutMember]);

  // Load History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getCirculationHistory({
        limit: 50,
        q: historySearch.trim() || undefined,
        status: historyStatus !== 'all' ? historyStatus : undefined,
        protocol: historyProtocol !== 'all' ? historyProtocol : undefined,
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

  const handlePayFine = async (fineId: number, remainingDue: number) => {
    if (!window.confirm(`Confirm fine payment and balance settlement of $${remainingDue.toFixed(2)}?`)) {
      return;
    }
    setPayingFineId(fineId);
    setFineActionMsg(null);
    try {
      await api.payFine(fineId, remainingDue);
      setFineActionMsg({ text: `Successfully settled $${remainingDue.toFixed(2)}. Patron balance updated.`, isError: false });
      await loadFines();
    } catch (err: any) {
      setFineActionMsg({ text: err.message || 'Failed to settle fine.', isError: true });
    } finally {
      setPayingFineId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      const timer = setTimeout(() => {
        loadHistory();
      }, 200);
      return () => clearTimeout(timer);
    } else if (activeTab === 'fines') {
      loadFines();
    }
  }, [activeTab, activeLoansOnly, historySearch, historyStatus, historyProtocol]);

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
                  <div className="relative" ref={patronDropdownRef}>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                      <span>Patron Membership Number or Smart Card UID *</span>
                      {isSearchingPatron && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Searching...
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={checkoutMember}
                        onChange={(e) => setCheckoutMember(e.target.value)}
                        onFocus={() => {
                          if (checkoutMember.trim().length > 0 && patronSuggestions.length > 0) {
                            setShowPatronDropdown(true);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (!showPatronDropdown || patronSuggestions.length === 0) return;
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlightedPatronIndex((prev) =>
                              prev < patronSuggestions.length - 1 ? prev + 1 : 0
                            );
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightedPatronIndex((prev) =>
                              prev > 0 ? prev - 1 : patronSuggestions.length - 1
                            );
                          } else if (e.key === 'Enter') {
                            if (highlightedPatronIndex >= 0 && patronSuggestions[highlightedPatronIndex]) {
                              e.preventDefault();
                              const sel = patronSuggestions[highlightedPatronIndex];
                              setCheckoutMember(sel.membership_number);
                              setShowPatronDropdown(false);
                            }
                          } else if (e.key === 'Escape') {
                            setShowPatronDropdown(false);
                          }
                        }}
                        placeholder="Search patron by name, membership #, or smart card..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                        required
                        autoComplete="off"
                      />
                      {checkoutMember && (
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutMember('');
                            setPatronSuggestions([]);
                            setShowPatronDropdown(false);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dynamic Patron Autocomplete Dropdown */}
                    {showPatronDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl z-40 max-h-64 overflow-y-auto divide-y divide-slate-800">
                        {patronSuggestions.length === 0 ? (
                          !isSearchingPatron && (
                            <div className="p-3 text-center text-xs text-slate-500 italic">
                              No matching patrons found.
                            </div>
                          )
                        ) : (
                          patronSuggestions.map((m, idx) => (
                            <div
                              key={m.id}
                              onMouseDown={() => {
                                setCheckoutMember(m.membership_number);
                                setShowPatronDropdown(false);
                              }}
                              onMouseEnter={() => setHighlightedPatronIndex(idx)}
                              className={`p-2.5 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                                highlightedPatronIndex === idx ? 'bg-amber-500/20 text-white' : 'hover:bg-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="flex flex-col min-w-0 pr-2">
                                <span className="font-semibold text-white truncate">{m.full_name}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span>{m.membership_number}</span>
                                  {m.smart_card_uid && <span>• Card: {m.smart_card_uid}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {m.fine_balance > 0 && (
                                  <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
                                    ${m.fine_balance.toFixed(2)}
                                  </span>
                                )}
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                                    m.status === 'active'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : m.status === 'blocked'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {m.status}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Circulation Audit Log & Transaction Registry
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time transaction history across Internal UI, NCIP 2.0, and 3M SIP2 protocol adapters.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  checked={activeLoansOnly}
                  onChange={(e) => setActiveLoansOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                />
                Active loans only
              </label>
              <button
                onClick={loadHistory}
                disabled={historyLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin text-amber-400' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Search & Filters Toolbar */}
          <div className="px-4 pb-2 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search accession #, book title, member name/ID, or TX #..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="returned">Returned</option>
                <option value="overdue">Overdue</option>
              </select>

              <select
                value={historyProtocol}
                onChange={(e) => setHistoryProtocol(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Sources</option>
                <option value="INTERNAL_UI">Internal UI</option>
                <option value="NCIP_2_0">NCIP 2.0</option>
                <option value="SIP2">3M SIP2</option>
              </select>
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
                  <th className="px-4 py-3 font-semibold">Security State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                        <span>Loading circulation transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Info className="w-5 h-5 text-slate-600 mb-1" />
                        <span className="font-semibold text-slate-400">No circulation transactions match the selected filters.</span>
                        <span className="text-[11px] text-slate-500 font-sans">Try clearing search terms or status filters.</span>
                      </div>
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
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-sans">
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
                            {tx.eas_bit ? 'Armed (Protected)' : 'Disarmed (Exit OK)'}
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-400" />
                Patron Fine Ledger &amp; Penalty Tracking
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Manage overdue penalty assessments, balance settlements, and payment audit logs (FR04, FR11).
              </p>
            </div>
            <button
              onClick={loadFines}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {fineActionMsg && (
            <div className={`mx-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              fineActionMsg.isError
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
            }`}>
              {fineActionMsg.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{fineActionMsg.text}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID</th>
                  <th className="px-4 py-3 font-semibold">Member</th>
                  <th className="px-4 py-3 font-semibold">Total Amount</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assessed Date</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                {fines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No fines recorded in system.
                    </td>
                  </tr>
                ) : (
                  fines.map((f) => {
                    const remainingDue = Math.max(0, f.amount - f.paid_amount);
                    return (
                      <tr key={f.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono text-slate-500">#{f.id}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-white block">{f.member_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{f.membership_number}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-400">${f.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">${f.paid_amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{f.reason}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              f.status === 'unpaid'
                                ? 'bg-rose-500/20 text-rose-300'
                                : f.status === 'partially_paid'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {f.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(f.assessed_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {f.status !== 'paid' && remainingDue > 0 ? (
                            <button
                              onClick={() => handlePayFine(f.id, remainingDue)}
                              disabled={payingFineId === f.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[10px] font-semibold transition-all flex items-center gap-1 shadow-sm"
                            >
                              {payingFineId === f.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              <span>Settle ${remainingDue.toFixed(2)}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-500" /> Settled
                            </span>
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
      )}
    </div>
  );
};
