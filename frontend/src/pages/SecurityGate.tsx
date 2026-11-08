import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  Activity,
  Users,
  AlertTriangle,
  CheckCircle,
  Bell,
  RefreshCw,
  Eye,
  X,
  Play,
  Mail,
  Sliders,
  Radio
} from 'lucide-react';
import { api } from '../services/api';
import { GateEvent, GateStats, NotificationRecord } from '../types';

export const SecurityGate: React.FC = () => {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [stats, setStats] = useState<GateStats | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [alarmOnly, setAlarmOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Simulation State
  const [simTagUid, setSimTagUid] = useState<string>('');
  const [registeredTags, setRegisteredTags] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [alarmFlash, setAlarmFlash] = useState<boolean>(false);
  const [latestAlarm, setLatestAlarm] = useState<GateEvent | null>(null);

  // CCTV Modal
  const [selectedCctvUrl, setSelectedCctvUrl] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'events' | 'notifications'>('events');

  const loadData = async () => {
    try {
      const [eventsData, statsData, notifsData] = await Promise.all([
        api.getGateEvents({ alarm_only: alarmOnly, limit: 30 }),
        api.getGateStats(),
        api.getNotifications({ limit: 15 })
      ]);
      setEvents(eventsData.items);
      setStats(statsData);
      setNotifications(notifsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    api.getRfidTags({ limit: 12 }).then((r) => {
      setRegisteredTags(r.items);
      if (r.items.length > 0 && !simTagUid) {
        setSimTagUid(r.items[0].tag_uid);
      }
    }).catch(console.error);

    // Connect to Server-Sent Events (SSE) Stream (Module C)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('http://127.0.0.1:8000/api/events/stream');

      eventSource.addEventListener('gate_alarm', (e: MessageEvent) => {
        const data: GateEvent = JSON.parse(e.data);
        setLatestAlarm(data);
        setAlarmFlash(true);
        setTimeout(() => setAlarmFlash(false), 2500);
        loadData();
      });

      eventSource.addEventListener('gate_passage', () => {
        loadData();
      });

      eventSource.addEventListener('notification_dispatched', () => {
        api.getNotifications({ limit: 15 }).then(setNotifications).catch(console.error);
      });
    } catch (err) {
      console.error('SSE connection error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [alarmOnly]);

  // Trigger Gate Passage Simulation
  const handleSimulatePassage = async (tagUidToPass: string) => {
    if (!tagUidToPass.trim()) return;
    setIsSimulating(true);

    try {
      const results = await api.simulateGatePassage({
        reader_id: 'GATE-PEDESTAL-01',
        tag_uids: [tagUidToPass.trim().toUpperCase()],
        is_person_passing: true
      });

      if (results.some((r) => r.alarm_triggered)) {
        setAlarmFlash(true);
        setLatestAlarm(results[0]);
        setTimeout(() => setAlarmFlash(false), 2500);
      }
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Add Footfall count
  const handleRecordFootfall = async () => {
    try {
      await api.recordFootfall(1);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alarm Flash Overlay */}
      {alarmFlash && (
        <div className="p-4 bg-rose-600 text-white rounded-xl flex items-center justify-between shadow-2xl animate-pulse transition-all">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
            <div>
              <span className="font-extrabold text-sm uppercase tracking-wider block">
                SECURITY GATE ALARM TRIGGERED — UNAUTHORIZED ITEM REMOVAL
              </span>
              <span className="text-xs text-rose-100">
                Item: {latestAlarm?.book_title || 'Catalog Book'} | Accession: {latestAlarm?.accession_number || 'N/A'} | Tag: {latestAlarm?.tag_uid}
              </span>
            </div>
          </div>
          {latestAlarm?.cctv_image_url && (
            <button
              onClick={() => setSelectedCctvUrl(latestAlarm.cctv_image_url || null)}
              className="px-3 py-1.5 bg-white text-rose-700 font-bold rounded-lg text-xs flex items-center gap-1.5 hover:bg-rose-50"
            >
              <Camera className="w-4 h-4" /> View CCTV Snapshot
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">RFID Security Gate & CCTV Surveillance (FR07, AC06)</h1>
              <p className="text-xs text-slate-400">
                Pedestal antenna beam monitoring, real-time EAS security bit evaluation, automated alarm triggering, and mock CCTV incident snapshots.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRecordFootfall}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            +1 Footfall
          </button>
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Gate Status</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-bold text-emerald-400 font-mono">ARMED & ACTIVE</span>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Unauthorized Alarms</span>
          <span className="text-2xl font-bold font-mono text-rose-400 mt-1 block">
            {stats?.total_alarms || 0}
          </span>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Authorized Exits</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
            {stats?.total_authorized || 0}
          </span>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Cumulative Footfall</span>
          <span className="text-2xl font-bold font-mono text-cyan-400 mt-1 block">
            {stats?.today_footfall || 0}
          </span>
        </div>
      </div>

      {/* Simulator Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400" />
            Simulate Pedestrian Passage Through Pedestal A/B (AC06)
          </h2>
          <span className="text-xs text-slate-400 font-mono">Reader: GATE-PEDESTAL-01</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={simTagUid}
                onChange={(e) => setSimTagUid(e.target.value.toUpperCase())}
                placeholder="Enter Tag EPC hex..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
              />
              <button
                onClick={() => handleSimulatePassage(simTagUid)}
                disabled={isSimulating || !simTagUid.trim()}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSimulating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Simulate Exit Passage
                  </>
                )}
              </button>
            </div>

            {/* Quick Test Chips */}
            {registeredTags.length > 0 && (
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">
                  Quick-Pass Registered Tags:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {registeredTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSimTagUid(t.tag_uid);
                        handleSimulatePassage(t.tag_uid);
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                        t.eas_bit
                          ? 'bg-rose-950/60 border-rose-500/30 text-rose-300 hover:bg-rose-900/60'
                          : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      {t.eas_bit ? '🚨 Armed: ' : '✅ Disarmed: '}
                      {t.book_title ? t.book_title.slice(0, 16) : t.tag_uid.slice(0, 10)}...
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-2">
            <span className="font-semibold text-white block">Surveillance Logic:</span>
            <p className="text-[11px] leading-relaxed">
              If an item passes with <span className="text-rose-400 font-mono">EAS Bit = True</span>, the system identifies an unauthorized removal, activates the gate siren, captures a mock CCTV frame, and dispatches an automated incident notification.
            </p>
          </div>
        </div>
      </div>

      {/* Events / Notifications Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'events' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gate Passage Events ({events.length})
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'notifications' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Incident Notifications ({notifications.length})
            </button>
          </div>

          {activeTab === 'events' && (
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={alarmOnly}
                onChange={(e) => setAlarmOnly(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0"
              />
              Show alarms only
            </label>
          )}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'events' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Event Type</th>
                  <th className="px-4 py-2.5 font-semibold">Book Title / Accession</th>
                  <th className="px-4 py-2.5 font-semibold">Tag EPC</th>
                  <th className="px-4 py-2.5 font-semibold">EAS State</th>
                  <th className="px-4 py-2.5 font-semibold">CCTV Snapshot</th>
                  <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          e.alarm_triggered
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {e.event_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-white block">{e.book_title || 'Unknown'}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{e.accession_number || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-cyan-300 text-[10px]">{e.tag_uid}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          e.eas_bit_state
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {e.eas_bit_state ? 'ARMED' : 'DISARMED'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {e.cctv_image_url ? (
                        <button
                          onClick={() => setSelectedCctvUrl(e.cctv_image_url || null)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[10px] flex items-center gap-1 font-mono"
                        >
                          <Camera className="w-3 h-3 text-cyan-400" /> View Frame
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-[10px]">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Channel / Recipient</th>
                  <th className="px-4 py-2.5 font-semibold">Subject</th>
                  <th className="px-4 py-2.5 font-semibold">Attempts</th>
                  <th className="px-4 py-2.5 font-semibold">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 text-[11px]">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          n.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : n.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-white block">{n.recipient}</span>
                      <span className="text-[10px] text-slate-500 font-mono uppercase">{n.channel}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 max-w-sm truncate">{n.subject || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{n.attempts}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-[10px]">
                      {n.sent_at ? new Date(n.sent_at).toLocaleTimeString() : 'Queued'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CCTV Snapshot Modal */}
      {selectedCctvUrl && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedCctvUrl(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              Surveillance Camera Still Snapshot (Mock CCTV Feed)
            </h3>

            <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              <img
                src={`http://127.0.0.1:8000${selectedCctvUrl}`}
                alt="Security Gate CCTV Snapshot"
                className="w-full max-h-96 object-contain"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-2 text-center">
              Image Reference: {selectedCctvUrl} | Captured by Pedestal Beam Trigger
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
