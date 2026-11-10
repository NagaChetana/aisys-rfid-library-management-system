import React, { useState } from 'react';
import { Radio, CreditCard, Lock, User as UserIcon, AlertCircle, Eye, EyeOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login, smartCardLogin } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cardUid, setCardUid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError('Please enter your account password.');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
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
      setError(err.message || 'Smart card authentication failed. Card not bound to active staff account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const staffBadges = [
    {
      role: 'System Administrator',
      name: 'Sarah Connor',
      uid: 'SC-ADMIN-001',
      badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
    },
    {
      role: 'Senior Librarian',
      name: 'John Doe',
      uid: 'SC-LIB-002',
      badgeClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
    },
    {
      role: 'Circulation Desk Staff',
      name: 'Emma Watson',
      uid: 'SC-STAFF-003',
      badgeClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20'
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 font-sans text-slate-100 selection:bg-emerald-500 selection:text-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center justify-center text-emerald-400 mb-2 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AISYS Intelligent RFID LMS</h1>
          <p className="text-xs text-slate-400 font-medium">
            Next-Generation Library Automation • Production SOP Prototype
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5 shadow-lg shadow-rose-950/20 transition-all animate-in fade-in slide-in-from-top-1"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span className="flex-1 font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Staff Account Username
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder-slate-500"
                  placeholder="admin / librarian / staff"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-input" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder-slate-500 font-sans"
                  placeholder="Enter staff password..."
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 focus:outline-none p-0.5 rounded"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 focus:ring-2 focus:ring-emerald-400 focus:outline-none text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In with Password</span>
              )}
            </button>
          </form>

          {/* Clean Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] text-slate-400 uppercase font-bold tracking-wider shrink-0">
              Or Tap Smart Card Badge
            </span>
          </div>

          {/* Simulated Smart Card Tap (AC07) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-medium text-slate-300 flex items-center space-x-1.5">
                <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulated Smart-Card NFC Authentication</span>
              </span>
              <span className="font-mono text-[10px] text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                13.56 MHz
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {staffBadges.map((badge) => (
                <button
                  key={badge.uid}
                  type="button"
                  onClick={() => handleCardTap(badge.uid)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-left transition-all ${badge.badgeClass} focus:outline-none focus:ring-2 focus:ring-cyan-400`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-950/60 border border-white/10 flex items-center justify-center shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight truncate">{badge.name}</div>
                      <div className="text-[10px] opacity-75 truncate">{badge.role}</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950/80 border border-white/10 shrink-0 ml-2">
                    {badge.uid}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom UID Input */}
            <div className="pt-1.5">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Enter manual 13.56 MHz UID..."
                  value={cardUid}
                  onChange={(e) => setCardUid(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => cardUid && handleCardTap(cardUid)}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 focus:ring-2 focus:ring-cyan-400 focus:outline-none text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-cyan-950/40"
                >
                  Tap Card
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <p>Protected by RBAC • SHA-256 JWT Tokenized Security</p>
          <p className="text-slate-400 text-[10px]">Complies with AISYS SOP Sections 4 & 5 (NFR02, AC07)</p>
        </div>
      </div>
    </div>
  );
};
