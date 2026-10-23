import React, { useState } from 'react';
import {
  Code2,
  ArrowRight,
  Sparkles,
  Terminal,
  Cpu,
  ShieldCheck,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Zap,
} from 'lucide-react';
import type { UserProfile } from '../types';
import { signInWithEmail, signUpWithEmail } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  onBackToLanding?: () => void;
  onGuestDemo?: () => void;
}

const PRESET_COLORS = [
  { hex: '#6366f1', name: 'Indigo' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ec4899', name: 'Rose' },
  { hex: '#a855f7', name: 'Violet' },
  { hex: '#06b6d4', name: 'Cyan' },
];

export const Login: React.FC<LoginProps> = ({
  onLogin,
  onBackToLanding,
  onGuestDemo,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const previewName = displayName.trim() || email.split('@')[0] || 'Developer';
  const previewInitials = previewName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleToggleMode = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        const handle = displayName.trim() || trimmedEmail.split('@')[0];
        const result = await signUpWithEmail(trimmedEmail, password, handle, selectedColor);

        if (result.requiresEmailConfirmation) {
          setInfoMsg(
            `Account registered for ${trimmedEmail}! Please check your email to confirm your account, or ask your project admin to disable email confirmation in Supabase Dashboard.`
          );
        } else if (result.user) {
          onLogin(result.user);
        } else {
          setInfoMsg('Account created successfully! You can now sign in.');
          setAuthMode('signin');
        }
      } else {
        const result = await signInWithEmail(trimmedEmail, password);
        if (result.user) {
          onLogin(result.user);
        }
      }
    } catch (err: any) {
      console.error('Supabase authentication error:', err);
      let userFriendlyMessage = err.message || 'Authentication failed. Please check your credentials.';
      if (userFriendlyMessage.toLowerCase().includes('invalid login credentials')) {
        userFriendlyMessage = 'Invalid email or password. Please verify your credentials or create an account.';
      } else if (userFriendlyMessage.toLowerCase().includes('email not confirmed')) {
        userFriendlyMessage = 'Email address not yet confirmed. Please verify your email inbox or sign in as guest.';
      } else if (userFriendlyMessage.toLowerCase().includes('user already registered')) {
        userFriendlyMessage = 'An account with this email already exists. Please switch to Sign In.';
      }
      setErrorMsg(userFriendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center theme-bg-root bg-obsidian-glow bg-grid-pattern p-4 theme-text-primary select-none overflow-y-auto">
      {/* Ambient Top Spotlight */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[650px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px]" />

      {/* Top Back to Landing / Home Navigation */}
      {onBackToLanding && (
        <div className="w-full max-w-md mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="inline-flex items-center gap-1.5 text-xs theme-text-secondary hover:theme-text-primary transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </button>
          <div className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Supabase Auth Online
          </div>
        </div>
      )}

      {/* Main Glassmorphic Card */}
      <div className="relative w-full max-w-md rounded-2xl border theme-border theme-bg-glass p-7 theme-shadow backdrop-blur-xl">
        {/* Subtle Top Edge Highlight */}
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-1 ring-white/20">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight theme-text-primary">
              Nexathon<span className="text-indigo-400">IDE</span>
            </h1>
            <p className="text-xs theme-text-muted">
              Secure Supabase Authentication • Real-Time CRDTs
            </p>
          </div>
        </div>

        {/* Auth Mode Switcher Tabs */}
        <div className="mb-5 grid grid-cols-2 rounded-xl border theme-border theme-bg-surface-2 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleToggleMode('signin')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 transition-all cursor-pointer ${
              authMode === 'signin'
                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode('signup')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 transition-all cursor-pointer ${
              authMode === 'signup'
                ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                : 'theme-text-muted hover:theme-text-primary'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Error Notification Alert */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {/* Informational / Confirmation Alert */}
        {infoMsg && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1 leading-relaxed">{infoMsg}</div>
          </div>
        )}

        {/* Live Collaborator Presence Preview Box (in Sign Up mode) */}
        {authMode === 'signup' && (
          <div className="mb-5 rounded-xl border theme-border theme-bg-surface-2 p-3 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider theme-text-muted">
                Yjs Presence Badge
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                CRDT Ready
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border theme-border theme-bg-surface-1 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md transition-all duration-200"
                  style={{
                    backgroundColor: selectedColor,
                    boxShadow: `0 0 10px ${selectedColor}66`,
                  }}
                >
                  {previewInitials}
                </div>
                <div>
                  <div className="text-xs font-semibold theme-text-primary">{previewName}</div>
                  <div className="text-[10px] font-mono theme-text-muted">
                    src/main.py • Active Peer
                  </div>
                </div>
              </div>

              {/* Simulated Monaco Yjs Cursor Flag */}
              <div className="flex items-center">
                <div
                  className="h-4 w-0.5"
                  style={{ backgroundColor: selectedColor }}
                />
                <span
                  className="rounded-r px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs transition-colors duration-200"
                  style={{ backgroundColor: selectedColor }}
                >
                  {previewName}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sign In & Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium theme-text-secondary mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 theme-text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                autoComplete="email"
                className="w-full rounded-lg border theme-border theme-bg-surface-2 pl-9 pr-3.5 py-2.5 text-sm theme-text-primary placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium theme-text-secondary">
                Password
              </label>
              {authMode === 'signup' && (
                <span className="text-[10px] theme-text-muted">Min. 6 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 theme-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full rounded-lg border theme-border theme-bg-surface-2 pl-9 pr-10 py-2.5 text-sm theme-text-primary placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Additional Sign Up Fields */}
          {authMode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1.5">
                  Developer Display Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 theme-text-muted" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Alex Carter"
                    className="w-full rounded-lg border theme-border theme-bg-surface-2 pl-9 pr-3.5 py-2.5 text-sm theme-text-primary placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-2">
                  Awareness Cursor Color
                </label>
                <div className="flex items-center justify-between gap-2 rounded-lg border theme-border theme-bg-surface-2 p-2">
                  {PRESET_COLORS.map((c) => {
                    const isSelected = selectedColor === c.hex;
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        title={c.name}
                        className={`group relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0f121d]'
                            : 'opacity-70 hover:scale-105 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: c.hex,
                          boxShadow: isSelected ? `0 0 14px ${c.hex}` : undefined,
                        }}
                        aria-label={`Select cursor color ${c.name}`}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_25px_rgba(99,102,241,0.55)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating with Supabase...</span>
              </>
            ) : authMode === 'signin' ? (
              <>
                <span>Sign In to Cloud IDE</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            ) : (
              <>
                <span>Create Account & Launch</span>
                <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
              </>
            )}
          </button>
        </form>

        {/* Guest Demo Divider */}
        {onGuestDemo && (
          <div className="mt-5 pt-4 border-t theme-border">
            <button
              type="button"
              onClick={onGuestDemo}
              className="flex w-full items-center justify-center gap-2 rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-xs font-semibold theme-text-secondary hover:border-emerald-500/40 hover:text-emerald-400 hover:theme-bg-surface-1 transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Instant 1-Click Guest Demo (No Password Needed)</span>
            </button>
          </div>
        )}

        {/* Footer Feature Badges */}
        <div className="mt-5 flex items-center justify-between border-t theme-border pt-4 text-[11px] theme-text-muted">
          <span className="inline-flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            WASM Runtimes
          </span>
          <span className="inline-flex items-center gap-1">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            Node-PTY Stream
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
            JWT Session Guard
          </span>
        </div>
      </div>
    </div>
  );
};
