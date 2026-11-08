import React, { useState, useEffect } from 'react';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertOctagon,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { MigrationBatch, MigrationValidationReport } from '../types';

export const DataMigration: React.FC = () => {
  const [batches, setBatches] = useState<MigrationBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<MigrationBatch | null>(null);
  const [report, setReport] = useState<MigrationValidationReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synthetic Generator State
  const [recordCount, setRecordCount] = useState<number>(20000);
  const [invalidCount, setInvalidCount] = useState<number>(100);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await api.getMigrationBatches({ limit: 20 });
      setBatches(data);
      if (data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0]);
        loadReport(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (batchId: number) => {
    try {
      const rep = await api.getMigrationReport(batchId);
      setReport(rep);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  // Generate 20,000 Synthetic Records
  const handleGenerateSynthetic = async () => {
    setIsProcessing(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      const batch = await api.generateSyntheticMigration(recordCount, invalidCount);
      setActionMessage(
        `Staged ${batch.total_records.toLocaleString()} synthetic records (${batch.valid_records.toLocaleString()} valid, ${batch.invalid_records} invalid detected).`
      );
      setSelectedBatch(batch);
      await loadBatches();
      await loadReport(batch.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Synthetic generation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Upload Custom CSV File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      const batch = await api.uploadMigrationCsv(file);
      setActionMessage(
        `Uploaded & staged file '${file.name}' with ${batch.total_records.toLocaleString()} records (${batch.valid_records.toLocaleString()} valid, ${batch.invalid_records} invalid).`
      );
      setSelectedBatch(batch);
      await loadBatches();
      await loadReport(batch.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'File upload failed');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // Execute Migration
  const handleExecuteMigration = async () => {
    if (!selectedBatch) return;
    setIsProcessing(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      const updated = await api.executeMigration(selectedBatch.id);
      setSelectedBatch(updated);
      setActionMessage(
        `Migration committed! Successfully added ${updated.migrated_records.toLocaleString()} books and copies tagged with batch ID #${updated.id}.`
      );
      await loadBatches();
      await loadReport(updated.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Migration execution failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Rollback Migration
  const handleRollback = async () => {
    if (!selectedBatch) return;
    if (!window.confirm(`Are you sure you want to rollback batch ${selectedBatch.batch_number}? Pre-existing library records will be preserved.`)) {
      return;
    }

    setIsProcessing(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.rollbackMigration(selectedBatch.id);
      setActionMessage(res.message);
      await loadBatches();
      const updated = await api.getMigrationBatches();
      const current = updated.find((b) => b.id === selectedBatch.id) || null;
      setSelectedBatch(current);
      if (current) await loadReport(current.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Rollback failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Data Migration & Scoped Rollback (FR10, NFR01, AC01)</h1>
              <p className="text-xs text-slate-400">
                Spreadsheet staging for ~20,000 library records, field validation, duplicate detection, atomic commit, and strictly scoped rollback.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadBatches}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      {actionMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Synthetic Generator & Batch History */}
        <div className="space-y-6">
          {/* Synthetic Generator Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                20,000-Record Staging Generator
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Generates ~20,000 synthetic bibliographic records in-memory, validates mandatory ISBN/Dewey fields, and stages them for atomic ingestion.
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Target Records</label>
                <input
                  type="number"
                  value={recordCount}
                  onChange={(e) => setRecordCount(parseInt(e.target.value) || 20000)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Invalid Injected</label>
                <input
                  type="number"
                  value={invalidCount}
                  onChange={(e) => setInvalidCount(parseInt(e.target.value) || 100)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
            </div>

            <button
              onClick={handleGenerateSynthetic}
              disabled={isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Stage ~20,000 Records
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-800">
              <label className="text-[10px] text-slate-400 block mb-1.5 font-medium">Or Upload Custom Spreadsheet (CSV):</label>
              <label className="w-full p-2.5 bg-slate-950 hover:bg-slate-800/60 border border-dashed border-slate-700 hover:border-indigo-500/50 rounded-lg text-center cursor-pointer transition-all flex items-center justify-center gap-2 text-xs text-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Choose .CSV File to Stage</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Historical Batches */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Migration Batches
            </h2>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {batches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBatch(b);
                    loadReport(b.id);
                  }}
                  className={`w-full p-3 rounded-lg text-left border transition-all text-xs ${
                    selectedBatch?.id === b.id
                      ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-[11px] truncate">{b.batch_number}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                        b.status === 'migrated'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : b.status === 'rolled_back'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
                    <span>Records: {b.total_records.toLocaleString()}</span>
                    <span>Valid: {b.valid_records.toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Batch Reconciliation & Execution Workbench */}
        <div className="lg:col-span-2 space-y-6">
          {selectedBatch ? (
            <div className="space-y-6">
              {/* Batch Overview & Reconciliation Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-white font-mono">{selectedBatch.batch_number}</h2>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      File: {selectedBatch.filename} | Created: {new Date(selectedBatch.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedBatch.status !== 'migrated' && selectedBatch.status !== 'rolled_back' ? (
                      <button
                        onClick={handleExecuteMigration}
                        disabled={isProcessing || selectedBatch.valid_records === 0}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Commit to Catalog ({selectedBatch.valid_records.toLocaleString()})
                      </button>
                    ) : selectedBatch.status === 'migrated' ? (
                      <button
                        onClick={handleRollback}
                        disabled={isProcessing}
                        className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-semibold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Scoped Rollback
                      </button>
                    ) : (
                      <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs font-mono">
                        Batch Rolled Back
                      </span>
                    )}
                  </div>
                </div>

                {/* Reconciliation Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Staged</span>
                    <span className="text-xl font-bold font-mono text-white">
                      {selectedBatch.total_records.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Valid Rows</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {selectedBatch.valid_records.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Invalid Rows</span>
                    <span className="text-xl font-bold font-mono text-rose-400">
                      {selectedBatch.invalid_records.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Status</span>
                    <span className="text-sm font-bold font-mono text-cyan-400 uppercase mt-1 block">
                      {selectedBatch.status}
                    </span>
                  </div>
                </div>

                {/* Rollback Safety Notice */}
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block mb-0.5">Scoped Rollback Guarantee (NFR01):</strong>
                    Rollback operations strictly remove only catalog books and physical copies bearing <code>migration_batch_id = {selectedBatch.id}</code>. Pre-existing catalog records and patron transaction histories are 100% preserved.
                  </div>
                </div>
              </div>

              {/* Row-Level Error Log Inspector */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-400" />
                    Row-Level Validation Error Report (Sample)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {report?.sample_errors.length || 0} issues shown
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Row #</th>
                        <th className="px-4 py-2.5 font-semibold">Title (if provided)</th>
                        <th className="px-4 py-2.5 font-semibold">Detected Violations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                      {report?.sample_errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="px-4 py-2.5 font-mono text-cyan-400 font-bold">#{err.row_number}</td>
                          <td className="px-4 py-2.5 font-semibold text-white">{err.title || '<Missing Title>'}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              {err.errors.map((eStr, eIdx) => (
                                <span
                                  key={eIdx}
                                  className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono"
                                >
                                  {eStr}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(!report || report.sample_errors.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                            {selectedBatch.invalid_records === 0
                              ? '100% of staged records passed schema validation without errors!'
                              : 'No error log entries available.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500 text-xs">
              No migration batch selected. Select a past batch or stage ~20,000 synthetic records.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
