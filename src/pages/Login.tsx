import React, { useState, useEffect } from 'react';
import {
  Terminal,
  ArrowRight,
  Lock,
  Mail,
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
import { DecryptedText } from '../components/react-bits/text/DecryptedText';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  onBackToLanding?: () => void;
  onGuestDemo?: () => void;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export const Login: React.FC<LoginProps> = ({
  onLogin,
  onBackToLanding,
  onGuestDemo,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isDark = theme === 'dark';

  // Auth mode (defaulting to signin)
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Credentials state
  const [name, setName] = useState('');
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
        const result = await signUpWithEmail(trimmedEmail, password, name.trim());
        if (result.requiresEmailConfirmation) {
          setInfoMsg(`Account registered for ${trimmedEmail}! Please check your email inbox to confirm.`);
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
      className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto font-sans select-none transition-colors duration-200 relative theme-bg-root theme-text-primary ${
        isDark ? 'dark' : 'light'
      }`}
      data-theme={theme}
    >
      {/* Theme-Adaptive Background */}
      <AdaptiveBackground variant="login" theme={theme} />

      {/* Main Centered Sign In / Sign Up Card */}
      <div className="relative z-10 w-full max-w-md my-auto">
        <SpotlightCard
          spotlightColor={isDark ? 'rgba(255, 112, 87, 0.12)' : 'rgba(255, 112, 87, 0.18)'}
          className={`w-full p-6 sm:p-8 rounded-2xl border theme-border transition-all duration-300 ${
            isDark ? 'bg-[#080808]' : 'bg-[#FFF9F0] neu-card'
          }`}
        >
          {/* Card Top Strip: Brand / Back Button + Theme Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              {onBackToLanding && (
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="flex items-center justify-center h-8 w-8 rounded-lg border theme-border theme-bg-surface-2 hover:border-[#FF7057] transition cursor-pointer neu-button"
                  title="Return to Landing Page"
                >
                  <ArrowLeft className="h-4 w-4 theme-text-secondary" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF7057] flex items-center justify-center text-white neu-button">
                  <Terminal className="w-4 h-4" />
                </div>
                <span className="font-mono font-bold tracking-tight theme-text-primary text-sm">
                  NEXATHON<span className="text-[#FF7057]">.IDE</span>
                </span>
              </div>
            </div>

            {onToggleTheme && (
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            )}
          </div>

          {/* Headline */}
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight theme-text-primary font-heading font-mono">
              <DecryptedText
                text={
                  authMode === 'signup'
                    ? 'CREATE_ACCOUNT'
                    : authMode === 'forgot'
                    ? 'RESET_ACCESS'
                    : authMode === 'reset'
                    ? 'NEW_PASSWORD'
                    : 'AUTHENTICATE'
                }
                animateOn="view"
                speed={30}
                maxIterations={10}
              />
            </h1>
            <p className="text-xs theme-text-secondary mt-1.5 font-medium">
              {authMode === 'signup'
                ? 'Join your team and start building collaboratively in real-time.'
                : authMode === 'forgot'
                ? 'Enter your email to receive a password recovery link.'
                : authMode === 'reset'
                ? 'Create a secure new password for your account.'
                : 'Sign in to access your collaborative workspaces and projects.'}
            </p>
          </div>

          {/* Mode Switcher Tabs (Sign In vs Sign Up) */}
          {authMode !== 'forgot' && authMode !== 'reset' && (
            <div className="flex rounded-xl p-1 border theme-border theme-bg-surface-2 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-[#FF7057] text-white neu-button'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-[#FF7057] text-white neu-button'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

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

          {/* Sign In & Sign Up Form */}
          {(authMode === 'signin' || authMode === 'signup') && (
            <form onSubmit={handleSupabaseAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5 font-medium">
                    Display Name / Handle
                  </label>
                  <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-[#FF7057] px-3.5 py-2 text-xs">
                    <UserIcon className="w-4 h-4 theme-text-muted mr-2 shrink-0" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. dev_architect"
                      className="bg-transparent theme-text-primary focus:outline-none w-full font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5 font-medium">
                  Email Address
                </label>
                <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-[#FF7057] px-3.5 py-2 text-xs">
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
                      onClick={() => {
                        setAuthMode('forgot');
                        setErrorMsg(null);
                        setInfoMsg(null);
                      }}
                      className="text-[10px] font-mono text-[#FF7057] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-[#FF7057] px-3.5 py-2 text-xs">
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
                className="w-full py-2.5 rounded-xl bg-[#FF7057] hover:bg-[#F26049] text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md neu-button disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {authMode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN'}
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
                <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-[#FF7057] px-3.5 py-2 text-xs">
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
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#FF7057] hover:bg-[#F26049] text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md neu-button disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'SEND RECOVERY LINK'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="w-full text-center text-xs font-mono text-[#FF7057] hover:underline cursor-pointer"
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
                <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-[#FF7057] px-3.5 py-2 text-xs">
                  <Lock className="w-4 h-4 theme-text-muted mr-2 shrink-0" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="bg-transparent theme-text-primary focus:outline-none w-full font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-mono text-[11px] uppercase theme-text-secondary mb-1.5">
                  Confirm New Password
                </label>
                <div className="flex items-center rounded-xl theme-bg-surface-1 border theme-border focus-within:border-[#FF7057] px-3.5 py-2 text-xs">
                  <Lock className="w-4 h-4 theme-text-muted mr-2 shrink-0" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="bg-transparent theme-text-primary focus:outline-none w-full font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-[#FF7057] hover:bg-[#F26049] text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md neu-button disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'UPDATE PASSWORD & LAUNCH'}
              </button>
            </form>
          )}

          {/* Optional Guest Demo Alternative */}
          {onGuestDemo && (authMode === 'signin' || authMode === 'signup') && (
            <div className="mt-5 pt-4 border-t theme-border">
              <button
                type="button"
                onClick={onGuestDemo}
                className="w-full py-2 px-3 rounded-xl border border-dashed theme-border hover:border-[#FF7057] font-mono text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer theme-text-secondary hover:theme-text-primary neu-button"
              >
                <Zap className="w-3.5 h-3.5 text-[#FF7057] fill-current" />
                <span>Continue as Guest Demo</span>
              </button>
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
};

export default Login;
