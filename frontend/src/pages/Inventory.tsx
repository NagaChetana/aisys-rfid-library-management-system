import React, { useState, useEffect } from 'react';
import {
  Layers,
  Radio,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  Plus,
  ArrowRight,
  BookOpen,
  MapPin,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { InventorySession, InventorySessionDetail, InventoryScanItem, InventoryMissingItem } from '../types';

export const Inventory: React.FC = () => {
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [activeSession, setActiveSession] = useState<InventorySessionDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // New Session Form
  const [newSessionName, setNewSessionName] = useState<string>('Routine Morning Audit - CS Shelf 01');
  const [targetShelf, setTargetShelf] = useState<string>('CS-SHELF-01');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Scanning State
  const [scanInput, setScanInput] = useState<string>('');
  const [registeredTags, setRegisteredTags] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'misplaced' | 'missing'>('all');
  const [lastScanMessage, setLastScanMessage] = useState<string | null>(null);

  // Web Audio Synthetic Beeps (FR06 Audio Feedback)
  const playScanBeep = (type: 'correct' | 'misplaced' | 'unknown') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'correct') {
        // High-pitch pleasant chime (880Hz A5)
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        // Low double-buzz alert (220Hz A3)
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch {
      // AudioContext policy suppression fallback
    }
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getInventorySessions({ limit: 20 });
      setSessions(data.items);
      if (data.items.length > 0 && !activeSession) {
        // Load latest session detail
        const detail = await api.getInventorySession(data.items[0].id);
        setActiveSession(detail);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    api.getRfidTags({ limit: 12 }).then((r) => setRegisteredTags(r.items)).catch(console.error);
  }, []);

  // Create Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionName.trim() || !targetShelf.trim()) return;

    setIsCreating(true);
    try {
      const sess = await api.createInventorySession({
        session_name: newSessionName.trim(),
        target_shelf: targetShelf.trim()
      });
      const detail = await api.getInventorySession(sess.id);
      setActiveSession(detail);
      loadSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  // Perform Handheld Scan Sweep
  const handlePerformScan = async (uids: string[]) => {
    if (!activeSession || uids.length === 0) return;
    setIsScanning(true);
    setLastScanMessage(null);

    try {
      const res = await api.scanInventoryItems(activeSession.id, {
        tag_uids: uids,
        detected_shelf: activeSession.target_shelf
      });

      // Play audio cue
      if (res.misplaced > 0 || res.unknown_tags > 0) {
        playScanBeep('misplaced');
      } else if (res.correctly_located > 0) {
        playScanBeep('correct');
      }

      setLastScanMessage(
        `Scanned ${res.scanned_count} items (${res.correctly_located} correct, ${res.misplaced} misplaced, ${res.suppressed_duplicates} duplicates suppressed).`
      );

      // Refresh session detail
      const updated = await api.getInventorySession(activeSession.id);
      setActiveSession(updated);
      setScanInput('');
    } catch (err: any) {
      setLastScanMessage(err.message || 'Scan processing failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Complete Session
  const handleCompleteSession = async () => {
    if (!activeSession) return;
    try {
      const finished = await api.completeInventorySession(activeSession.id);
      setActiveSession(finished);
      loadSessions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Handheld Shelf Stock Inventory (FR06, AC05)</h1>
              <p className="text-xs text-slate-400">
                Bulk RFID antenna sweeping, duplicate scan suppression, misplaced item detection, and missing-book identification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              soundEnabled
                ? 'bg-slate-800 border-cyan-500/30 text-cyan-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            {soundEnabled ? 'Audio Chimes ON' : 'Muted'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Session Controls & History */}
        <div className="space-y-6">
          {/* New Session Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              Start New Inventory Session
            </h2>

            <form onSubmit={handleCreateSession} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Session Audit Name *</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Shelf Location *</label>
                <div className="relative">
                  <select
                    value={targetShelf}
                    onChange={(e) => setTargetShelf(e.target.value)}
                    className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-white focus:outline-none focus:border-cyan-500 cursor-pointer text-xs sm:text-sm"
                  >
                    <option value="CS-SHELF-01">CS-SHELF-01 (Computer Science)</option>
                    <option value="CS-SHELF-02">CS-SHELF-02 (AI & Data Systems)</option>
                    <option value="MATH-SHELF-01">MATH-SHELF-01 (Mathematics)</option>
                    <option value="PHYS-SHELF-01">PHYS-SHELF-01 (Physics)</option>
                    <option value="REF-SHELF-01">REF-SHELF-01 (Reference Restricted)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isCreating ? 'Initializing...' : 'Launch Stock Verification Session'}
              </button>
            </form>
          </div>

          {/* Past Sessions List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Recent Inventory Sessions
            </h2>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={async () => {
                    const detail = await api.getInventorySession(s.id);
                    setActiveSession(detail);
                  }}
                  className={`w-full p-3 rounded-lg text-left border transition-all text-xs ${
                    activeSession?.id === s.id
                      ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="truncate">{s.session_name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        s.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                    <span>Shelf: {s.target_shelf}</span>
                    <span>Scanned: {s.total_scanned}/{s.total_expected}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Active Session Workbench */}
        <div className="lg:col-span-2 space-y-6">
          {activeSession ? (
            <div className="space-y-6">
              {/* Session Overview Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-white">{activeSession.session_name}</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1 font-mono text-cyan-400">
                        <MapPin className="w-3.5 h-3.5" /> Target Shelf: {activeSession.target_shelf}
                      </span>
                      <span>Started: {new Date(activeSession.started_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeSession.status === 'in_progress' ? (
                      <button
                        onClick={handleCompleteSession}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Finalize & Mark Missing
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded text-xs font-semibold">
                        Audit Finalized
                      </span>
                    )}
                  </div>
                </div>

                {/* Aggregate Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Expected Items</span>
                    <span className="text-xl font-bold font-mono text-white">{activeSession.total_expected}</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Scanned</span>
                    <span className="text-xl font-bold font-mono text-cyan-400">{activeSession.total_scanned}</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Misplaced Books</span>
                    <span className="text-xl font-bold font-mono text-amber-400">{activeSession.total_misplaced}</span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Missing Books</span>
                    <span className="text-xl font-bold font-mono text-rose-400">{activeSession.total_missing}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Audit Coverage</span>
                    <span className="font-mono">
                      {activeSession.total_expected > 0
                        ? Math.min(100, Math.round((activeSession.total_scanned / activeSession.total_expected) * 100))
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          activeSession.total_expected > 0
                            ? Math.min(100, (activeSession.total_scanned / activeSession.total_expected) * 100)
                            : 0
                        }%`
                      }}
                    />
                  </div>
                </div>

                {/* Handheld Scanner Sweep Simulator */}
                {activeSession.status === 'in_progress' && (
                  <div className="p-4 bg-slate-950 border border-dashed border-slate-700 rounded-xl space-y-3">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      Simulate Handheld RFID Wand Sweep over Shelf
                    </span>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                        placeholder="Paste or enter Tag EPC hex..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <button
                        onClick={() => handlePerformScan([scanInput.trim()])}
                        disabled={isScanning || !scanInput.trim()}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg text-xs disabled:opacity-40"
                      >
                        Scan Tag
                      </button>
                    </div>

                    {/* Quick Sweep Pills */}
                    {registeredTags.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400">
                            Quick-Sweep Handheld Antenna over Registered Books:
                          </span>
                          <button
                            onClick={() => handlePerformScan(registeredTags.slice(0, 5).map((t) => t.tag_uid))}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            Batch Sweep 5 Tags
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {registeredTags.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handlePerformScan([t.tag_uid])}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900/40 hover:border-cyan-500/30 border border-slate-700 rounded text-[10px] text-slate-300 font-mono transition-colors"
                            >
                              + {t.book_title ? t.book_title.slice(0, 16) : t.tag_uid.slice(0, 8)}...
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastScanMessage && (
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-cyan-300 font-mono">
                        {lastScanMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Discrepancy Tabs & Item Tables */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 flex items-center gap-2 bg-slate-950/60">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Scanned ({activeSession.scans.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('misplaced')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === 'misplaced' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Misplaced Discrepancies ({activeSession.total_misplaced})
                  </button>
                  <button
                    onClick={() => setActiveTab('missing')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === 'missing' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Missing Books ({activeSession.missing_items.length})
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {activeTab !== 'missing' ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Status</th>
                          <th className="px-4 py-2.5 font-semibold">Title / Accession</th>
                          <th className="px-4 py-2.5 font-semibold">Tag EPC</th>
                          <th className="px-4 py-2.5 font-semibold">Expected Shelf</th>
                          <th className="px-4 py-2.5 font-semibold">Detected Shelf</th>
                          <th className="px-4 py-2.5 font-semibold">Scanned At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                        {activeSession.scans
                          .filter((s) => (activeTab === 'misplaced' ? s.scan_status === 'misplaced' : true))
                          .map((s) => (
                            <tr key={s.id} className="hover:bg-slate-800/40">
                              <td className="px-4 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                    s.scan_status === 'correct'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : s.scan_status === 'misplaced'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {s.scan_status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="font-semibold text-white block">{s.book_title}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{s.accession_number || '—'}</span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-cyan-300 text-[10px]">{s.tag_uid}</td>
                              <td className="px-4 py-2.5 font-mono text-slate-400">{s.expected_shelf || '—'}</td>
                              <td className="px-4 py-2.5 font-mono text-white">{s.detected_shelf}</td>
                              <td className="px-4 py-2.5 text-slate-500 text-[10px]">
                                {new Date(s.scanned_at).toLocaleTimeString()}
                              </td>
                            </tr>
                          ))}
                        {activeSession.scans.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                              No items scanned yet in this session.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Accession</th>
                          <th className="px-4 py-2.5 font-semibold">Book Title</th>
                          <th className="px-4 py-2.5 font-semibold">Barcode</th>
                          <th className="px-4 py-2.5 font-semibold">Expected Shelf</th>
                          <th className="px-4 py-2.5 font-semibold">Tag EPC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                        {activeSession.missing_items.map((m) => (
                          <tr key={m.book_item_id} className="hover:bg-slate-800/40">
                            <td className="px-4 py-2.5 font-mono text-rose-300 font-bold">{m.accession_number}</td>
                            <td className="px-4 py-2.5 font-semibold text-white">{m.title}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">{m.barcode}</td>
                            <td className="px-4 py-2.5 font-mono text-amber-300">{m.expected_shelf}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-400 text-[10px]">{m.tag_uid || 'Untagged'}</td>
                          </tr>
                        ))}
                        {activeSession.missing_items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              {activeSession.status === 'completed'
                                ? 'No missing books detected on this shelf!'
                                : 'Complete the session to run the missing book reconciliation audit.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
              No inventory session selected. Select an existing session or launch a new stock verification session.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
