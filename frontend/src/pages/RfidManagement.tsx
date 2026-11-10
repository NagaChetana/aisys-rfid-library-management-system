import React, { useState, useEffect } from 'react';
import {
  Radio,
  Search,
  Plus,
  RefreshCw,
  History,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle,
  Tag,
  BookOpen,
  X,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { RfidTag, RfidTagHistory } from '../types';

export const RfidManagement: React.FC = () => {
  const [tags, setTags] = useState<RfidTag[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [readers, setReaders] = useState<any[]>([]);
  const [tagHealth, setTagHealth] = useState<any | null>(null);

  // Modals
  const [showTagModal, setShowTagModal] = useState<boolean>(false);
  const [showRetagModal, setShowRetagModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<RfidTagHistory[]>([]);
  const [selectedTagForHistory, setSelectedTagForHistory] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Tag Form
  const [tagItemId, setTagItemId] = useState<string>('');
  const [customTagUid, setCustomTagUid] = useState<string>('');
  const [tagEasBit, setTagEasBit] = useState<boolean>(true);
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagSuccess, setTagSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Retag Form
  const [retagItemId, setRetagItemId] = useState<string>('');
  const [newTagUid, setNewTagUid] = useState<string>('');
  const [retagReason, setRetagReason] = useState<string>('Damaged RFID tag replacement');
  const [retagError, setRetagError] = useState<string | null>(null);
  const [retagSuccess, setRetagSuccess] = useState<string | null>(null);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const data = await api.getRfidTags({
        q: search || undefined,
        status: statusFilter || undefined,
        limit: 50
      });
      setTags(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchTags, 250);
    return () => clearTimeout(timeout);
  }, [search, statusFilter]);

  useEffect(() => {
    async function loadTelemetry() {
      try {
        const [rList, hData] = await Promise.all([
          api.getReaderClients(),
          api.getTagHealthSummary()
        ]);
        setReaders(rList);
        setTagHealth(hData);
      } catch (e) {
        console.error(e);
      }
    }
    loadTelemetry();
  }, []);

  const generateRandomEpc = () => {
    const randomHex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
    return `E2801160${randomHex}`;
  };

  // Submit Tag Item
  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemIdNum = parseInt(tagItemId);
    if (!itemIdNum || isNaN(itemIdNum)) {
      setTagError('Please enter a valid physical Book Item Copy ID (DB Copy ID from Book Catalog).');
      return;
    }

    setIsSubmitting(true);
    setTagError(null);
    setTagSuccess(null);

    try {
      const res = await api.tagBookItem({
        book_item_id: itemIdNum,
        tag_uid: customTagUid ? customTagUid.trim().toUpperCase() : undefined,
        eas_bit: tagEasBit
      });
      setTagSuccess(`Item #${res.book_item_id} tagged with EPC ${res.tag_uid}`);
      setTagItemId('');
      setCustomTagUid('');
      fetchTags();
      setTimeout(() => setShowTagModal(false), 1200);
    } catch (err: any) {
      setTagError(err.message || 'Tag assignment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Retag Item
  const handleRetagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemIdNum = parseInt(retagItemId);
    if (!itemIdNum || isNaN(itemIdNum)) {
      setRetagError('Please enter a valid physical Book Item Copy ID (DB Copy ID from Book Catalog).');
      return;
    }

    setIsSubmitting(true);
    setRetagError(null);
    setRetagSuccess(null);

    try {
      const res = await api.retagBookItem({
        book_item_id: itemIdNum,
        new_tag_uid: newTagUid ? newTagUid.trim().toUpperCase() : undefined,
        reason: retagReason
      });
      setRetagSuccess(`Item #${res.book_item_id} re-tagged with EPC ${res.tag_uid}`);
      setRetagItemId('');
      setNewTagUid('');
      fetchTags();
      setTimeout(() => setShowRetagModal(false), 1200);
    } catch (err: any) {
      setRetagError(err.message || 'Retagging failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Tag History
  const openHistory = async (bookItemId?: number, tagUid?: string) => {
    setSelectedTagForHistory(tagUid || `Item #${bookItemId}`);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const data = await api.getTagHistory({
        book_item_id: bookItemId,
        tag_uid: tagUid
      });
      setHistoryList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">RFID Tag Management & Audit Trail</h1>
              <p className="text-xs text-slate-400">
                EPC Gen2 (ISO 18000-6C) tag encoding, duplicate prevention, and historical tag re-assignment logs (AC02, FR05).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCustomTagUid(generateRandomEpc());
              setTagError(null);
              setTagSuccess(null);
              setShowTagModal(true);
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign New Tag
          </button>
          <button
            onClick={() => {
              setNewTagUid(generateRandomEpc());
              setRetagError(null);
              setRetagSuccess(null);
              setShowRetagModal(true);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Re-tag / Replace
          </button>
          <button
            onClick={fetchTags}
            disabled={loading}
            title="Refresh tags registry"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reader Hardware Fleet & Tag Fleet Health (FR03, FR05) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tag Coverage</span>
            <Tag className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {tagHealth?.coverage_percentage || 0}%
          </div>
          <div className="text-[11px] text-slate-400">
            {tagHealth?.active_tags || 0} active EPC Gen2 tags bound
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>EAS Security State</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {tagHealth?.eas_armed_count || 0} Armed
          </div>
          <div className="text-[11px] text-slate-400">
            {tagHealth?.eas_disarmed_count || 0} checked-out disarmed
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Reader Gateways</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-400">
            {readers.filter(r => r.status === 'online').length} / {readers.length} Online
          </div>
          <div className="text-[11px] text-slate-400">
            Staff pads, handhelds & gates registered
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Fleet Health Grade</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">
            Grade {tagHealth?.rfid_health_grade || 'A'}
          </div>
          <div className="text-[11px] text-slate-400">
            {tagHealth?.frequency_band || '865-868 MHz ISO 18000-6C'}
          </div>
        </div>
      </div>

      {/* Connected Readers Quick Status */}
      {readers.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">Active Readers:</span>
          {readers.map(r => (
            <div key={r.reader_id} className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${r.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="font-medium text-white">{r.label}</span>
              <span className="font-mono text-[10px] text-slate-400">({r.ip_address})</span>
              <span className="text-[9px] px-1 bg-slate-800 text-cyan-300 rounded font-mono">{r.total_scans} reads</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Tag UID (EPC hex)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Tag Statuses</option>
            <option value="active">Active Only</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
          <span className="text-xs text-slate-400 font-mono">{total} tags</span>
        </div>
      </div>

      {/* Tags Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Tag UID (EPC Hex)</th>
                <th className="px-4 py-3 font-semibold">Linked Item</th>
                <th className="px-4 py-3 font-semibold">Book Title</th>
                <th className="px-4 py-3 font-semibold">Shelf Location</th>
                <th className="px-4 py-3 font-semibold">EAS Security Bit</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last Scanned</th>
                <th className="px-4 py-3 font-semibold text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    Loading registered tags...
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                    No RFID tags registered matching query.
                  </td>
                </tr>
              ) : (
                tags.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-500">#{t.id}</td>
                    <td className="px-4 py-3 font-bold text-cyan-300 tracking-wider">
                      {t.tag_uid}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {t.accession_number || (t.book_item_id ? `Item #${t.book_item_id}` : '—')}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-200 max-w-xs truncate">
                      {t.book_title || '—'}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400">
                      {t.shelf_location || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.eas_bit
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {t.eas_bit ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                        {t.eas_bit ? 'ARMED' : 'DISARMED'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400 text-[10px]">
                      {t.last_scanned_at ? new Date(t.last_scanned_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openHistory(t.book_item_id, t.tag_uid)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 ml-auto font-sans"
                      >
                        <History className="w-3 h-3 text-cyan-400" />
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSIGN TAG MODAL */}
      {showTagModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowTagModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-cyan-400" />
              Assign Unique RFID Tag (AC02, FR05)
            </h3>

            <form onSubmit={handleTagSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Book Item Copy ID (Database ID) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={tagItemId}
                  onChange={(e) => setTagItemId(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Tag UID / EPC (Hexadecimal) *</label>
                  <button
                    type="button"
                    onClick={() => setCustomTagUid(generateRandomEpc())}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-Generate Gen2 EPC
                  </button>
                </div>
                <input
                  type="text"
                  value={customTagUid}
                  onChange={(e) => setCustomTagUid(e.target.value.toUpperCase())}
                  placeholder="e.g. E2801160..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="easBit"
                  checked={tagEasBit}
                  onChange={(e) => setTagEasBit(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="easBit" className="text-slate-300">
                  Arm EAS Security Bit (Defaults to Armed/Protected)
                </label>
              </div>

              {tagError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{tagError}</span>
                </div>
              )}

              {tagSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{tagSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Registering Tag...' : 'Commit Tag Assignment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RETAG MODAL */}
      {showRetagModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowRetagModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              Re-tag Physical Copy (Replacement & Audit)
            </h3>

            <form onSubmit={handleRetagSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Book Item Copy ID (Database ID) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={retagItemId}
                  onChange={(e) => setRetagItemId(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Replacement Reason *
                </label>
                <select
                  value={retagReason}
                  onChange={(e) => setRetagReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Damaged RFID tag replacement">Damaged RFID tag replacement</option>
                  <option value="Antenna resonance degraded">Antenna resonance degraded</option>
                  <option value="Physical sticker peeled/worn">Physical sticker peeled/worn</option>
                  <option value="Chip communication failure">Chip communication failure</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">New Tag UID / EPC (Hexadecimal) *</label>
                  <button
                    type="button"
                    onClick={() => setNewTagUid(generateRandomEpc())}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={newTagUid}
                  onChange={(e) => setNewTagUid(e.target.value.toUpperCase())}
                  placeholder="e.g. E2801160..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              {retagError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{retagError}</span>
                </div>
              )}

              {retagSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{retagSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Processing Retag...' : 'Decommission Old & Activate New Tag'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY AUDIT MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowHistoryModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              RFID Tag Assignment Audit History
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Historical ledger for: <span className="font-mono text-cyan-300">{selectedTagForHistory}</span>
            </p>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Tag UID (EPC)</th>
                    <th className="px-3 py-2 font-semibold">Item ID</th>
                    <th className="px-3 py-2 font-semibold">Assigned At</th>
                    <th className="px-3 py-2 font-semibold">Deassigned At</th>
                    <th className="px-3 py-2 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        Loading history ledger...
                      </td>
                    </tr>
                  ) : historyList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        No previous historical assignments found.
                      </td>
                    </tr>
                  ) : (
                    historyList.map((h) => (
                      <tr key={h.id}>
                        <td className="px-3 py-2 text-cyan-300">{h.tag_uid}</td>
                        <td className="px-3 py-2">#{h.book_item_id}</td>
                        <td className="px-3 py-2 font-sans text-slate-400 text-[10px]">
                          {new Date(h.assigned_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-400 text-[10px]">
                          {h.deassigned_at ? new Date(h.deassigned_at).toLocaleString() : 'Currently Active'}
                        </td>
                        <td className="px-3 py-2 font-sans text-slate-300">
                          {h.deassignment_reason || '—'}
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
