import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Radio,
  CreditCard,
  Layers,
  Network,
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Play,
  Copy,
  Plus,
  Trash2,
  Sliders,
  Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { StaffScanResult, SmartCardTapResult } from '../types';

export const RfidSimulator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'staff-pad' | 'smart-card' | 'ncip' | 'sip2'>('staff-pad');

  // Staff Pad State
  const [padTags, setPadTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [readerId, setReaderId] = useState<string>('STAFF-PAD-01');
  const [enforceDedup, setEnforceDedup] = useState<boolean>(true);
  const [scanResult, setScanResult] = useState<StaffScanResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [registeredTags, setRegisteredTags] = useState<any[]>([]);

  // Smart Card Tap State
  const [cardUidInput, setCardUidInput] = useState<string>('SC-ADMIN-001');
  const [cardTapResult, setCardTapResult] = useState<SmartCardTapResult | null>(null);
  const [isTapping, setIsTapping] = useState<boolean>(false);

  // NCIP State
  const [ncipAction, setNcipAction] = useState<string>('LookupUser');
  const [ncipPayload, setNcipPayload] = useState<string>(
    JSON.stringify({ action: 'LookupUser', UserId: 'MEM-00001' }, null, 2)
  );
  const [ncipResponse, setNcipResponse] = useState<any>(null);
  const [isSendingNcip, setIsSendingNcip] = useState<boolean>(false);

  // SIP2 State
  const [sip2Frame, setSip2Frame] = useState<string>(
    '6300120261108    010000AOUNIVERSITY-LIB|AAMEM-00001|'
  );
  const [sip2Response, setSip2Response] = useState<any>(null);
  const [isSendingSip2, setIsSendingSip2] = useState<boolean>(false);

  // Load existing tags for quick-selection
  useEffect(() => {
    api.getRfidTags({ limit: 10 }).then((res) => {
      setRegisteredTags(res.items);
      if (res.items.length > 0 && padTags.length === 0) {
        setPadTags(res.items.slice(0, 2).map((t) => t.tag_uid));
      }
    }).catch(console.error);
  }, []);

  // Update NCIP template on dropdown change
  const handleNcipActionChange = (action: string) => {
    setNcipAction(action);
    if (action === 'LookupUser') {
      setNcipPayload(JSON.stringify({ action: 'LookupUser', UserId: 'MEM-00001' }, null, 2));
    } else if (action === 'CheckoutItem') {
      setNcipPayload(
        JSON.stringify(
          { action: 'CheckoutItem', UserId: 'MEM-00001', ItemId: 'ACC-000002' },
          null,
          2
        )
      );
    } else if (action === 'CheckinItem') {
      setNcipPayload(
        JSON.stringify({ action: 'CheckinItem', ItemId: 'ACC-000002' }, null, 2)
      );
    } else if (action === 'RenewItem') {
      setNcipPayload(
        JSON.stringify({ action: 'RenewItem', ItemId: 'ACC-000002' }, null, 2)
      );
    }
  };

  // Update SIP2 frame presets
  const handleSip2Preset = (msgType: string) => {
    if (msgType === '63') {
      setSip2Frame('6300120261108    010000AOUNIVERSITY-LIB|AAMEM-00001|');
    } else if (msgType === '11') {
      setSip2Frame('11N0N20261108    010000AOUNIVERSITY-LIB|AAMEM-00001|ABACC-000002|');
    } else if (msgType === '09') {
      setSip2Frame('09N20261108    010000AOUNIVERSITY-LIB|ABACC-000002|');
    } else if (msgType === '29') {
      setSip2Frame('2920261108    010000AOUNIVERSITY-LIB|AAMEM-00001|ABACC-000002|');
    }
  };

  // Staff Scan Handler
  const handleStaffScan = async () => {
    if (padTags.length === 0) return;
    setIsScanning(true);
    try {
      const res = await api.simulateStaffScan({
        reader_id: readerId,
        tag_uids: padTags,
        enforce_dedup: enforceDedup
      });
      setScanResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  // Add Tag to Pad
  const addTagToPad = (uid: string) => {
    const clean = uid.trim().toUpperCase();
    if (clean && !padTags.includes(clean)) {
      setPadTags([...padTags, clean]);
    }
    setTagInput('');
  };

  // Remove Tag from Pad
  const removeTagFromPad = (index: number) => {
    setPadTags(padTags.filter((_, idx) => idx !== index));
  };

  // Smart Card Tap Handler
  const handleCardTap = async (uidToTap?: string) => {
    const finalUid = (uidToTap || cardUidInput).trim().toUpperCase();
    if (!finalUid) return;
    setIsTapping(true);
    try {
      const res = await api.simulateSmartCardTap(finalUid);
      setCardTapResult(res);
      setCardUidInput(finalUid);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTapping(false);
    }
  };

  // NCIP Send Handler
  const handleSendNcip = async () => {
    setIsSendingNcip(true);
    setNcipResponse(null);
    try {
      const parsed = JSON.parse(ncipPayload);
      const res = await api.processNcip(parsed);
      setNcipResponse(res);
    } catch (err: any) {
      setNcipResponse({ error: err.message || 'Invalid JSON or Request failed' });
    } finally {
      setIsSendingNcip(false);
    }
  };

  // SIP2 Send Handler
  const handleSendSip2 = async () => {
    if (!sip2Frame.trim()) return;
    setIsSendingSip2(true);
    setSip2Response(null);
    try {
      const res = await api.processSip2(sip2Frame.trim());
      setSip2Response(res);
    } catch (err: any) {
      setSip2Response({ error: err.message || 'SIP2 processing failed' });
    } finally {
      setIsSendingSip2(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Hardware Reader Simulator & Interoperability</h1>
              <p className="text-xs text-slate-400">
                Simulated RFID desktop staff pad with sliding-window deduplication, smart card NFC tap, and NCIP 2.0 / SIP2 adapter testbeds (AC02, AC03, AC07).
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('staff-pad')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'staff-pad' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Staff Desktop Pad
          </button>
          <button
            onClick={() => setActiveTab('smart-card')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'smart-card' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Smart Card Tap
          </button>
          <button
            onClick={() => setActiveTab('ncip')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'ncip' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            NCIP 2.0 Adapter
          </button>
          <button
            onClick={() => setActiveTab('sip2')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'sip2' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            3M SIP2 Adapter
          </button>
        </div>
      </div>

      {/* TAB 1: STAFF DESKTOP PAD */}
      {activeTab === 'staff-pad' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-400" />
                  Staff Antenna Pad Reader (Simulated Gen2 Desktop Scanner)
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">Reader: {readerId}</span>
                </div>
              </div>

              {/* Tag Tray / Virtual Antenna Surface */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 border border-dashed border-slate-700 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Items Currently Placed on Virtual Antenna Pad ({padTags.length})
                    </span>
                    <button
                      onClick={() => setPadTags([])}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Clear Pad
                    </button>
                  </div>

                  {padTags.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Antenna surface is empty. Click a registered tag below or enter a custom EPC hex.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {padTags.map((uid, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-indigo-950/80 border border-indigo-500/40 px-2.5 py-1.5 rounded-lg text-xs font-mono text-indigo-200"
                        >
                          <span>{uid}</span>
                          <button
                            onClick={() => removeTagFromPad(idx)}
                            className="text-indigo-400 hover:text-rose-400"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Tag Row */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value.toUpperCase())}
                      placeholder="Add EPC Tag UID manually (e.g. E2801160...)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      onClick={() => addTagToPad(tagInput)}
                      disabled={!tagInput.trim()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium disabled:opacity-40"
                    >
                      + Add to Pad
                    </button>
                  </div>
                </div>

                {/* Quick Add registered tags */}
                {registeredTags.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1.5">
                      Quick Add Registered Book Tags:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {registeredTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => addTagToPad(t.tag_uid)}
                          className="px-2 py-1 bg-slate-800 hover:bg-indigo-900/50 hover:border-indigo-500/40 border border-slate-700 rounded text-[10px] text-slate-300 font-mono transition-colors"
                        >
                          + {t.book_title ? t.book_title.slice(0, 20) : t.tag_uid.slice(0, 12)}...
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Controls & Trigger */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enforceDedup}
                      onChange={(e) => setEnforceDedup(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0"
                    />
                    <span>Sliding-Window Deduplication (3000ms suppression window)</span>
                  </label>

                  <button
                    onClick={handleStaffScan}
                    disabled={isScanning || padTags.length === 0}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isScanning ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Trigger Antenna Scan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Scan Results Panel */}
            {scanResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Scan Result Summary
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-400 font-semibold font-mono">
                      Detected: {scanResult.total_detected}
                    </span>
                    <span className="text-amber-400 font-semibold font-mono">
                      Suppressed Duplicates: {scanResult.suppressed_duplicates}
                    </span>
                  </div>
                </div>

                {scanResult.items.length === 0 && scanResult.suppressed_duplicates > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs">
                    All scanned tags were identified as duplicates within the 3000ms sliding window and suppressed by the middleware deduplication filter.
                  </div>
                )}

                {scanResult.items.length > 0 && (
                  <div className="space-y-2">
                    {scanResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{item.book_title}</span>
                            {item.is_reference_only && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Reference
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>ACC: {item.accession_number}</span>
                            <span>BAR: {item.barcode}</span>
                            <span>EPC: {item.tag_uid}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'available'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.eas_bit
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {item.eas_bit ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                            EAS {item.eas_bit ? 'ARMED' : 'DISARMED'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Technical Info */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Deduplication Specs (AC02)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                When multiple items or stacks pass over the staff antenna, the tag reader emits burst events at high frequency (10-50 reads/sec).
              </p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span><strong>Sliding Window:</strong> 3000ms suppression key cache keyed by <code>(reader_id, tag_uid)</code>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                  <span><strong>Multi-Tag Anti-Collision:</strong> Allows multiple distinct EPC Gen2 tags to be read concurrently.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SMART CARD TAP */}
      {activeTab === 'smart-card' && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              13.56 MHz HF / NFC Smart Card Tap Simulator (AC07)
            </h2>
            <p className="text-xs text-slate-400">
              Emulates contactless smart card presentation at staff desks or self-service kiosks.
            </p>
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
              One-Click Card Presets:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleCardTap('SC-ADMIN-001')}
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Sarah Connor</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">ADMIN</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">SC-ADMIN-001</span>
              </button>

              <button
                onClick={() => handleCardTap('SC-STAFF-003')}
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Emma Watson</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">STAFF</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">SC-STAFF-003</span>
              </button>

              <button
                onClick={() => handleCardTap('CARD-ALICE-1001')}
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Alice Smith</span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono">PATRON</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">CARD-ALICE-1001 (Active)</span>
              </button>

              <button
                onClick={() => handleCardTap('CARD-BOB-1002')}
                className="p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Bob Jones</span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">BLOCKED</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">CARD-BOB-1002</span>
              </button>
            </div>
          </div>

          {/* Manual Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={cardUidInput}
              onChange={(e) => setCardUidInput(e.target.value.toUpperCase())}
              placeholder="Enter arbitrary Card UID (e.g. CARD-GUEST-999)"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              onClick={() => handleCardTap()}
              disabled={isTapping || !cardUidInput.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isTapping ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Simulate Tap'
              )}
            </button>
          </div>

          {/* Tap Result Card */}
          {cardTapResult && (
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Card Resolution Response
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                    cardTapResult.entity_type === 'staff'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : cardTapResult.entity_type === 'member'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  Type: {cardTapResult.entity_type}
                </span>
              </div>

              {cardTapResult.entity_type === 'staff' && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Staff Name</span>
                    <span className="font-semibold text-white">{cardTapResult.full_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">RBAC Role</span>
                    <span className="font-semibold text-emerald-400 font-mono">{cardTapResult.role}</span>
                  </div>
                </div>
              )}

              {cardTapResult.entity_type === 'member' && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Member</span>
                    <span className="font-semibold text-white">{cardTapResult.full_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{cardTapResult.membership_number}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Status</span>
                    <span
                      className={`font-bold ${
                        cardTapResult.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {cardTapResult.status?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Fines</span>
                    <span className="font-mono text-amber-400">${cardTapResult.fine_balance?.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {cardTapResult.entity_type === 'unknown' && (
                <div className="text-xs text-rose-300">
                  Card UID <span className="font-mono">{cardTapResult.smart_card_uid}</span> is not mapped to any staff or patron record.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NCIP 2.0 PROTOCOL ADAPTER */}
      {activeTab === 'ncip' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                NCIP 2.0 Mock Request (NISO Z39.83)
              </h2>
              <select
                value={ncipAction}
                onChange={(e) => handleNcipActionChange(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-300 font-mono"
              >
                <option value="LookupUser">LookupUser</option>
                <option value="CheckoutItem">CheckoutItem</option>
                <option value="CheckinItem">CheckinItem</option>
                <option value="RenewItem">RenewItem</option>
              </select>
            </div>

            <textarea
              rows={8}
              value={ncipPayload}
              onChange={(e) => setNcipPayload(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
            />

            <button
              onClick={handleSendNcip}
              disabled={isSendingNcip}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSendingNcip ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Dispatch NCIP 2.0 Envelope
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              NCIP 2.0 Adapter Envelope Response
            </h2>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 min-h-[200px] overflow-x-auto font-mono text-xs text-slate-300">
              {ncipResponse ? (
                <pre>{JSON.stringify(ncipResponse, null, 2)}</pre>
              ) : (
                <span className="text-slate-600">Send an NCIP message to view adapter response.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 3M SIP2 PROTOCOL ADAPTER */}
      {activeTab === 'sip2' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                3M SIP2 Socket Frame Request
              </h2>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleSip2Preset('63')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 rounded font-mono"
              >
                Msg 63: Patron Info
              </button>
              <button
                onClick={() => handleSip2Preset('11')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 rounded font-mono"
              >
                Msg 11: Checkout
              </button>
              <button
                onClick={() => handleSip2Preset('09')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 rounded font-mono"
              >
                Msg 09: Checkin
              </button>
              <button
                onClick={() => handleSip2Preset('29')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 rounded font-mono"
              >
                Msg 29: Renew
              </button>
            </div>

            <textarea
              rows={5}
              value={sip2Frame}
              onChange={(e) => setSip2Frame(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
            />

            <button
              onClick={handleSendSip2}
              disabled={isSendingSip2 || !sip2Frame.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSendingSip2 ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Transmit SIP2 Frame via Adapter Boundary
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              SIP2 Raw Response Frame & Checksum
            </h2>

            {sip2Response ? (
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Raw Response Frame:</span>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-amber-300 break-all">
                    {sip2Response.raw_response}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">2's Complement Checksum:</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-amber-400 font-mono text-xs font-bold rounded">
                    {sip2Response.checksum}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Parsed Domain Payload:</span>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300">
                    <pre>{JSON.stringify(sip2Response.parsed, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center text-slate-600 text-xs">
                Transmit a SIP2 frame to inspect the generated response and checksum.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
