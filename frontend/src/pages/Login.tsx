import React, { useState } from 'react';
import { Radio, CreditCard, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login, smartCardLogin } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [cardUid, setCardUid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardTap = async (uid: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await smartCardLogin(uid);
    } catch (err: any) {
      setError(err.message || 'Smart card authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const staffBadges = [
    { role: 'System Admin', name: 'Sarah Connor', uid: 'SC-ADMIN-001', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
    { role: 'Senior Librarian', name: 'John Doe', uid: 'SC-LIB-002', color: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' },
    { role: 'Desk Staff', name: 'Emma Watson', uid: 'SC-STAFF-003', color: 'border-violet-500/40 bg-violet-500/10 text-violet-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 font-sans text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center justify-center text-emerald-400 mb-2 shadow-lg shadow-emerald-500/5">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AISYS Intelligent RFID LMS</h1>
          <p className="text-xs text-slate-400">Library Management System • Candidate Prototype SOP</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="admin / librarian / staff"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In with Password'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-400 uppercase font-bold tracking-wider">
              Or Tap Smart Card
            </span>
          </div>

          {/* Simulated Smart Card Tap (AC07) */}
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>One-Click Smart Card Simulators:</span>
              <span className="font-mono text-cyan-400">13.56 MHz NFC</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {staffBadges.map((badge) => (
                <button
                  key={badge.uid}
                  type="button"
                  onClick={() => handleCardTap(badge.uid)}
                  className={`p-2.5 rounded-lg border flex items-center justify-between text-left hover:brightness-125 transition-all ${badge.color}`}
                >
                  <div className="flex items-center space-x-2.5">
                    <CreditCard className="w-4 h-4" />
                    <div>
                      <div className="text-xs font-semibold leading-tight">{badge.name}</div>
                      <div className="text-[10px] opacity-80">{badge.role}</div>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/30 border border-white/10">
                    {badge.uid}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter arbitrary Card UID..."
                  value={cardUid}
                  onChange={(e) => setCardUid(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => cardUid && handleCardTap(cardUid)}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-medium"
                >
                  Tap
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <p>Protected by RBAC • SHA-256 JWT Authentication</p>
          <p>Complies with AISYS SOP Sections 4 & 5 (NFR02, AC07)</p>
        </div>
      </div>
    </div>
  );
};
