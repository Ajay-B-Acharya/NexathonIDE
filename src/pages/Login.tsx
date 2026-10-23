import React, { useState, useEffect } from 'react';
import {
  Terminal,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Radio,
  MousePointer2,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { UserProfile } from '../types';
import {
  signInWithEmail,
  signUpWithEmail,
  sendPasswordResetEmail,
  updateUserPassword,
  supabase,
} from '../services/supabaseClient';
import { ThemeMode, ThemeToggle } from '../components/ThemeToggle';
import { AdaptiveBackground } from '../components/AdaptiveBackground';
import { SpotlightCard } from '../components/react-bits/cards/SpotlightCard';
import { Squares } from '../components/react-bits/backgrounds/Squares';
import { DecryptedText } from '../components/react-bits/text/DecryptedText';
import { Magnet } from '../components/react-bits/animations/Magnet';
import { StarBorder } from '../components/react-bits/animations/StarBorder';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  onBackToLanding?: () => void;
  onGuestDemo?: () => void;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
}

type AuthMode = 'crdt-handle' | 'signin' | 'signup' | 'forgot' | 'reset';

const CURSOR_COLORS = [
  { name: 'Cyber Cyan', hex: '#00f0ff', bg: 'bg-cyan-400', text: 'text-slate-950', ring: 'ring-cyan-400' },
  { name: 'Acid Emerald', hex: '#10b981', bg: 'bg-emerald-400', text: 'text-slate-950', ring: 'ring-emerald-400' },
  { name: 'Laser Rose', hex: '#f43f5e', bg: 'bg-rose-500', text: 'text-white', ring: 'ring-rose-500' },
  { name: 'Solar Amber', hex: '#f59e0b', bg: 'bg-amber-400', text: 'text-slate-950', ring: 'ring-amber-400' },
];

export const Login: React.FC<LoginProps> = ({
  onLogin,
  onBackToLanding,
  onGuestDemo,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';

  // Yjs multiplayer identity state
  const [handle, setHandle] = useState('dev_architect');
  const [selectedColor, setSelectedColor] = useState(CURSOR_COLORS[0]);

  // Auth mode (CRDT Handle vs Supabase Account)
  const [authMode, setAuthMode] = useState<AuthMode>('crdt-handle');

  // Supabase credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Detect Supabase recovery callback from email reset link
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setAuthMode('reset');
        setInfoMsg('Password recovery link verified! Please enter your new password.');
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {}
      }
    } catch {}

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('reset');
        setInfoMsg('Recovery session active. Enter your new password below.');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // 1-Click Instant CRDT Handle Login
  const handleCrdtLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = handle.trim() || 'dev_' + Math.random().toString(36).substring(2, 6);
    const guestUser: UserProfile = {
      id: `usr_${cleanHandle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36).slice(-4)}`,
      name: cleanHandle,
      color: selectedColor.hex,
    };
    onLogin(guestUser);
  };

  // Supabase Auth Submit
  const handleSupabaseAuthSubmit = async (e: React.FormEvent) => {
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
        const result = await signUpWithEmail(trimmedEmail, password, handle, selectedColor.hex);
        if (result.requiresEmailConfirmation) {
          setInfoMsg(`Account registered for ${trimmedEmail}! Please check your email inbox.`);
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
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Recovery Submit
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(trimmedEmail);
      setInfoMsg(`Password recovery link has been sent to ${trimmedEmail}!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send recovery link.');
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset Submit
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateUserPassword(newPassword);
      if (result.user) {
        setInfoMsg('Password updated successfully! Launching workspace...');
        setTimeout(() => onLogin(result.user!), 800);
      } else {
        setInfoMsg('Password updated! You can now sign in.');
        setAuthMode('signin');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden font-sans select-none transition-colors duration-300 relative ${
        isDark ? 'dark bg-[#06080e] text-slate-100' : 'light bg-[#f8fafc] text-slate-900'
      }`}
      data-theme={theme}
    >
      {/* Theme-Adaptive Cryptographic Topographical Mesh */}
      <AdaptiveBackground variant="login" theme={theme} />
      {/* ========================================================= */}
      {/* LEFT 7 COLUMNS: INTERACTIVE CANVAS + LIVE YJS CURSOR PREVIEW */}
      {/* ========================================================= */}
      <div className="hidden lg:flex lg:col-span-7 relative flex-col justify-between p-12 border-r theme-border overflow-hidden">
        {/* React Bits Interactive Squares Canvas Background */}
        <div className="absolute inset-0 opacity-40">
          <Squares
            direction="diagonal"
            speed={0.4}
            borderColor={isDark ? '#1e293b' : '#cbd5e1'}
            hoverFillColor={`${selectedColor.hex}25`}
          />
        </div>

        {/* Top Header: Brand Identity & Back to Landing */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="flex items-center justify-center h-8 w-8 rounded-lg border theme-border theme-bg-surface-2 hover:border-indigo-500/50 transition cursor-pointer"
                title="Return to Landing Page"
              >
                <ArrowLeft className="h-4 w-4 theme-text-secondary" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]">
                <Terminal className="w-4 h-4" />
              </div>
              <span className="font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100 text-sm">
                NEXATHON<span className="text-indigo-600 dark:text-indigo-400">.IDE</span>
                <span className="text-slate-600 dark:text-slate-400 text-xs font-semibold ml-2">// AUTH_GATE</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-600/30 dark:border-emerald-500/30 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 shadow-xs">
              <Radio className="w-3 h-3 animate-pulse" />
              YJS_MESH: ONLINE
            </span>
          </div>
        </div>

        {/* Center: Live Multiplayer Code Editor & Cursor Sandbox */}
        <div className="relative z-10 my-auto max-w-xl w-full">
          <div className="text-xs font-mono uppercase tracking-widest text-indigo-700 dark:text-indigo-400 font-bold mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>01 // LIVE MULTIPLAYER PRESENCE PREVIEW</span>
          </div>

          <div
            className={`p-6 rounded-2xl border backdrop-blur-xl shadow-2xl space-y-4 font-mono text-xs transition-all duration-300 ${
              isDark ? 'bg-[#090d16]/95 border-white/10' : 'bg-white/95 border-slate-300 shadow-xl'
            }`}
          >
            {/* Window title bar */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">session_preview.py</span>
              </div>
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-semibold">CRDT Peer Awareness</span>
            </div>

            {/* Simulated Code Lines */}
            <div className="space-y-2 py-3 leading-relaxed">
              <div className="text-slate-700 dark:text-slate-300 font-mono font-medium">1 &nbsp; async def initialize_wasm_worker():</div>
              <div className="relative flex items-center flex-wrap gap-y-2">
                <span className="text-slate-500 dark:text-slate-400">2 &nbsp; &nbsp;&nbsp;&nbsp;&nbsp;</span>
                <span
                  className="px-2 py-0.5 rounded border-l-2 font-mono transition-all duration-200"
                  style={{
                    backgroundColor: `${selectedColor.hex}18`,
                    borderColor: selectedColor.hex,
                    color: isDark ? '#ffffff' : '#0f172a',
                  }}
                >
                  await pyodide.loadPackage([&quot;numpy&quot;, &quot;pandas&quot;])
                </span>

                {/* Live Updating Collaborator Cursor (Reacts instantly to handle & color change!) */}
                <div className="ml-2.5 inline-flex items-center gap-1 transition-all duration-200 animate-in fade-in">
                  <MousePointer2
                    className="w-4 h-4 -rotate-12 transition-colors duration-200"
                    style={{ color: selectedColor.hex, fill: selectedColor.hex }}
                  />
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-md transition-colors duration-200 ${selectedColor.bg} ${selectedColor.text}`}
                  >
                    @{handle.trim() || 'developer'}
                  </span>
                </div>
              </div>
              <div className="text-slate-700 dark:text-slate-300 font-mono font-medium">3 &nbsp; &nbsp;&nbsp;&nbsp;&nbsp;return yjs_provider.connect()</div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-600 dark:text-slate-400 font-medium">Awareness Clock: Lamport v2.4</span>
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                ● Buffer Active (0ms lag)
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Telemetry Strip */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-white/10 font-mono text-xs">
          <div>
            <div className="text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">WASM RUNTIME</div>
            <div className="text-cyan-700 dark:text-cyan-400 font-extrabold mt-0.5">Pyodide 0.26.2 (0ms)</div>
          </div>
          <div>
            <div className="text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">SYNC PROTOCOL</div>
            <div className="text-emerald-700 dark:text-emerald-400 font-extrabold mt-0.5">Yjs CRDT + WS (:1234)</div>
          </div>
          <div>
            <div className="text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">SHELL DAEMON</div>
            <div className="text-indigo-700 dark:text-indigo-400 font-extrabold mt-0.5">Node-PTY xterm (:3001)</div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT 5 COLUMNS: CRYPTOGRAPHIC AUTHENTICATION GATE */}
      {/* ========================================================= */}
      <div className="lg:col-span-5 flex flex-col justify-center p-6 sm:p-12 relative theme-bg-root overflow-y-auto">
        <SpotlightCard
          spotlightColor={`${selectedColor.hex}22`}
          className={`w-full max-w-md mx-auto p-6 sm:p-8 rounded-2xl border theme-border theme-shadow backdrop-blur-2xl transition-all duration-300 ${
            isDark ? 'bg-[#0c1018]/90' : 'bg-white/95'
          }`}
        >
          {/* Card Top Strip: Gateway Badge + Theme Toggle */}
          <div className="flex items-center justify-between mb-6">
            <span className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-bold">
              SSH_GATEWAY // v2.4
            </span>
            {onToggleTheme && (
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            )}
          </div>

          {/* Decrypted Headline */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
              <DecryptedText
                text="INITIALIZE_SESSION"
                animateOn="view"
                speed={30}
                maxIterations={10}
              />
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 font-medium">
              Configure your multiplayer CRDT identity or connect with a persistent account.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl p-1 border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('crdt-handle');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                authMode === 'crdt-handle'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              1-Click Handle
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                authMode !== 'crdt-handle'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Supabase Auth
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-500">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* ========================================= */}
          {/* TAB 1: 1-CLICK CRDT MULTIPLAYER IDENTITY */}
          {/* ========================================= */}
          {authMode === 'crdt-handle' && (
            <div className="space-y-5">
              {/* 1-Click Guest Button */}
              {onGuestDemo && (
                <button
                  type="button"
                  onClick={onGuestDemo}
                  className="w-full py-2.5 px-4 rounded-xl border theme-border theme-bg-surface-2 hover:border-indigo-500/50 font-mono text-xs font-bold flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer theme-text-primary"
                >
                  <Zap className="w-4 h-4 text-emerald-500 fill-current" />
                  INSTANT 1-CLICK GUEST DEMO
                </button>
              )}

              <div className="flex items-center gap-3 my-4">
                <div className="h-px border-b border-slate-200 dark:border-white/10 flex-1" />
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                  OR CUSTOMIZE IDENTITY
                </span>
                <div className="h-px border-b border-slate-200 dark:border-white/10 flex-1" />
              </div>

              <form onSubmit={handleCrdtLogin} className="space-y-5">
                {/* Developer Handle Input */}
                <div>
                  <label className="block font-mono text-[11px] uppercase text-slate-800 dark:text-slate-200 mb-2 font-bold tracking-wide">
                    01 // DEVELOPER_HANDLE
                  </label>
                  <div className="flex items-center rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/15 focus-within:border-indigo-600 focus-within:ring-1 focus-within:ring-indigo-600 px-3.5 py-2.5 font-mono text-xs transition-colors shadow-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-bold select-none">nexathon://@</span>
                    <input
                      type="text"
                      required
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="bg-transparent text-slate-900 dark:text-white focus:outline-none w-full font-bold ml-1.5 placeholder:text-slate-400"
                      placeholder="username"
                    />
                  </div>
                </div>

                {/* Yjs Cursor Color Spectrum Selector */}
                <div>
                  <label className="block font-mono text-[11px] uppercase text-slate-800 dark:text-slate-200 mb-2 font-bold tracking-wide">
                    02 // YJS_CURSOR_SPECTRUM
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CURSOR_COLORS.map((color) => {
                      const isSelected = selectedColor.name === color.name;
                      return (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setSelectedColor(color)}
                          className={`py-2 px-2 rounded-lg border font-mono text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
                            isSelected
                              ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-950 dark:text-white shadow-sm ring-1 ring-indigo-500'
                              : 'border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:border-indigo-500/50'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="truncate">{color.name.split(' ')[1]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Magnet + StarBorder Submit CTA */}
                <div className="pt-2">
                  <Magnet padding={20} magnetStrength={2} className="w-full">
                    <StarBorder
                      type="submit"
                      color={selectedColor.hex}
                      speed="3s"
                      className="w-full cursor-pointer shadow-lg"
                    >
                      <span className="py-1 flex items-center justify-center gap-2 font-mono text-xs font-bold text-white">
                        MOUNT WORKSPACE <ArrowRight className="w-4 h-4" />
                      </span>
                    </StarBorder>
                  </Magnet>
                </div>
              </form>
            </div>
          )}

          {/* ========================================= */}
          {/* TAB 2: PERSISTENT SUPABASE ACCOUNT */}
          {/* ========================================= */}
          {authMode !== 'crdt-handle' && (
            <div>
              {/* Sub-Tabs: Sign In vs Sign Up */}
              {authMode !== 'forgot' && authMode !== 'reset' && (
                <div className="flex border-b theme-border mb-5">
                  <button
                    type="button"
                    onClick={() => setAuthMode('signin')}
                    className={`pb-2 px-3 text-xs font-mono font-semibold transition border-b-2 cursor-pointer ${
                      authMode === 'signin'
                        ? 'border-indigo-500 text-indigo-500'
                        : 'border-transparent theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className={`pb-2 px-3 text-xs font-mono font-semibold transition border-b-2 cursor-pointer ${
                      authMode === 'signup'
                        ? 'border-indigo-500 text-indigo-500'
                        : 'border-transparent theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Sign In & Sign Up Form */}
              {(authMode === 'signin' || authMode === 'signup') && (
                <form onSubmit={handleSupabaseAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5 font-medium">
                      Email Address
                    </label>
                    <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-indigo-500 px-3.5 py-2 text-xs">
                      <Mail className="w-4 h-4 theme-text-muted mr-2 shrink-0" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="bg-transparent theme-text-primary focus:outline-none w-full font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono text-[11px] uppercase theme-text-secondary font-medium">
                        Password
                      </label>
                      {authMode === 'signin' && (
                        <button
                          type="button"
                          onClick={() => setAuthMode('forgot')}
                          className="text-[10px] font-mono text-indigo-500 hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-indigo-500 px-3.5 py-2 text-xs">
                      <Lock className="w-4 h-4 theme-text-muted mr-2 shrink-0" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-transparent theme-text-primary focus:outline-none w-full font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="theme-text-muted hover:theme-text-primary cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {authMode === 'signup' ? 'REGISTER ACCOUNT' : 'AUTHENTICATE'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Forgot Password Form */}
              {authMode === 'forgot' && (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5">
                      Account Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-xl theme-bg-surface-1 border theme-border px-3.5 py-2 text-xs theme-text-primary font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SEND RECOVERY LINK'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signin')}
                    className="w-full text-center text-xs font-mono text-indigo-500 hover:underline cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}

              {/* Reset Password Form */}
              {authMode === 'reset' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full rounded-xl theme-bg-surface-1 border theme-border px-3.5 py-2 text-xs theme-text-primary font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl theme-bg-surface-1 border theme-border px-3.5 py-2 text-xs theme-text-primary font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'UPDATE PASSWORD & LAUNCH'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Security Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between font-mono text-[10px] text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> WebWorker Isolated
            </span>
            <span className="font-semibold">TLS 1.3 / CRDT Lamport</span>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};

export default Login;
