import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Code2,
  ArrowRight,
  Zap,
  GitBranch,
  Database,
  Layers,
  Command,
  X,
  ChevronUp,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { UserProfile } from '../types';
import { AmbientCollaborationCanvas } from '../components/AmbientCollaborationCanvas';
import { AdaptiveBackground } from '../components/AdaptiveBackground';
import { ThemeMode, ThemeToggle } from '../components/ThemeToggle';

interface LandingProps {
  existingUser: UserProfile | null;
  theme: ThemeMode;
  onToggleTheme: (nextTheme: ThemeMode) => void;
  onCompleteOnboarding: (user: UserProfile) => void;
  onInstantGuestDemo: () => Promise<void>;
  onResumeSession: () => void;
  onNavigateToLogin: () => void;
}

const CURSOR_COLORS = [
  { name: 'Teal', hex: '#35B8A6' },
  { name: 'Coral', hex: '#FF7057' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Rose', hex: '#F43F5E' },
];

export const Landing: React.FC<LandingProps> = ({
  existingUser,
  theme,
  onToggleTheme,
  onCompleteOnboarding,
  onInstantGuestDemo,
  onResumeSession,
  onNavigateToLogin,
}) => {
  const isDark = theme === 'dark';

  // Onboarding Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [handleName, setHandleName] = useState('');
  const [selectedColor, setSelectedColor] = useState(CURSOR_COLORS[0].hex);
  const [isLaunchingDemo, setIsLaunchingDemo] = useState(false);

  // Scroll Progress and Back-to-Top State
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    setScrollProgress(progress);
    setShowBackToTop(scrollTop > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Global Landing Keyboard Shortcuts (Cmd+K to login/resume, Esc to close modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (existingUser) {
          onResumeSession();
        } else {
          onNavigateToLogin();
        }
      }

      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [existingUser, onResumeSession, onNavigateToLogin]);

  const handlePrimaryCTA = () => {
    if (existingUser) {
      onResumeSession();
    } else {
      onNavigateToLogin();
    }
  };

  const handleGuestDemoClick = async () => {
    setIsLaunchingDemo(true);
    try {
      await onInstantGuestDemo();
    } finally {
      setIsLaunchingDemo(false);
    }
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handleName.trim();
    if (!trimmed) return;

    const newUser: UserProfile = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      name: trimmed,
      color: selectedColor,
    };
    setIsModalOpen(false);
    onCompleteOnboarding(newUser);
  };

  const previewHandle = handleName.trim() || 'John';
  const previewInitials = previewHandle.slice(0, 2).toUpperCase();

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`relative min-h-screen w-screen overflow-y-auto overflow-x-hidden theme-bg-root theme-text-primary select-none scroll-smooth flex flex-col justify-between ${
        isDark ? 'dark' : 'light'
      }`}
      data-theme={theme}
    >
      {/* Real-time Scroll Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
        className="fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none bg-transparent"
      >
        <div
          className="h-full bg-[#FF7057] transition-[width] duration-75 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Theme-Adaptive CAD Grid + Aurora Background */}
      <AdaptiveBackground variant="landing" theme={theme} />

      {/* Clean Architectural Grid Background & Ambient Canvas */}
      <AmbientCollaborationCanvas theme={theme} />

      {/* 1. COMMAND HEADER */}
      <header className="sticky top-0 z-40 border-b theme-border bg-[var(--bg-root)]/90 backdrop-blur-xl transition-all duration-200 shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3.5">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="#" className="group flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF7057] text-white shadow-xs transition-transform duration-200 group-hover:scale-105 neu-button">
                <Code2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight theme-text-primary font-heading">
                    Nexathon<span className="text-[#FF7057]">IDE</span>
                  </span>
                </div>
              </div>
            </a>
          </div>

          {/* Center: Navigation Link */}
          <nav className="hidden sm:flex items-center">
            <a
              href="#about"
              className="rounded-full px-4 py-1.5 text-xs font-semibold border theme-border theme-bg-surface-2 theme-text-secondary hover:theme-text-primary hover:border-[#FF7057]/40 transition-all"
            >
              About Us
            </a>
          </nav>

          {/* Right: Theme Toggle + Auth / Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            <button
              type="button"
              onClick={handlePrimaryCTA}
              className="group relative inline-flex items-center gap-2 rounded-xl bg-[#FF7057] hover:bg-[#F26049] px-4 py-2 text-xs font-semibold text-white neu-button hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>
                {existingUser ? `Resume (${existingUser.name})` : 'Sign In / Sign Up'}
              </span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center flex flex-col items-center justify-center">
        {/* Master Headline */}
        <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight theme-text-primary leading-[1.14] sm:leading-[1.08] font-heading">
          Distributed Real-Time Coding.{' '}
          <span className="block mt-2 text-[#FF7057]">
            <span className="font-serif italic font-normal">Zero Cold Starts.</span> Pure In-Browser WASM.
          </span>
        </h1>

        {/* Clean, Persuasive Subheadline */}
        <p className="mx-auto mt-5 sm:mt-6 max-w-2xl text-sm sm:text-base md:text-lg font-normal leading-relaxed theme-text-secondary px-2">
          Conflict-free collaborative editing with CRDTs, instant in-browser Python &amp; JavaScript WebAssembly runtimes, and autonomous AI code guard rails.
        </p>

        {/* Action CTAs */}
        <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-3 w-full max-w-md sm:max-w-none mx-auto px-4">
          <button
            type="button"
            onClick={handlePrimaryCTA}
            className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#FF7057] hover:bg-[#F26049] px-6 py-3.5 text-sm font-semibold text-white neu-button hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
          >
            <span>
              {existingUser ? `Resume Workspace (${existingUser.name})` : 'Sign In / Sign Up'}
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={handleGuestDemoClick}
            disabled={isLaunchingDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057]/50 px-5 py-3.5 text-sm font-semibold theme-text-primary hover:text-[#FF7057] transition-all cursor-pointer min-h-[44px] disabled:opacity-50 neu-button"
          >
            <Zap className="h-4 w-4 text-[#FF7057]" />
            <span>Instant Guest Demo</span>
          </button>
        </div>
      </section>

      {/* 3. ABOUT US SECTION */}
      <section id="about" className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16 w-full">
        <div className="rounded-2xl border theme-border theme-bg-surface-1 p-6 sm:p-10 md:p-12 neu-card backdrop-blur-md">
          {/* Header Block */}
          <div className="max-w-3xl">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#FF7057]">
              ABOUT NEXATHONIDE
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight theme-text-primary font-heading leading-tight">
              Building a Better Way to Code Together.
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed theme-text-secondary">
              NexathonIDE is a collaborative development environment designed to help developers work on code together in real time. By bringing shared editing, collaborative workflows, and code execution into one workspace, NexathonIDE aims to make teamwork more connected, efficient, and accessible.
            </p>
          </div>

          {/* Three Concise Value Pillars */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 pt-8 border-t theme-border">
            {/* Pillar 01 */}
            <div className="flex flex-col justify-between rounded-xl border theme-border theme-bg-surface-2 p-5 sm:p-6 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-[#FF7057]">01</span>
                  <Users className="h-4 w-4 text-[#FF7057] opacity-80" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">
                  Real-Time Collaboration
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed theme-text-secondary">
                  Enable developers to work together in a shared coding environment, with changes and collaborator activity reflected in real time.
                </p>
              </div>
            </div>

            {/* Pillar 02 */}
            <div className="flex flex-col justify-between rounded-xl border theme-border theme-bg-surface-2 p-5 sm:p-6 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-[#FF7057]">02</span>
                  <Code2 className="h-4 w-4 text-[#FF7057] opacity-80" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">
                  Integrated Development
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed theme-text-secondary">
                  Bring collaborative editing and supported code execution workflows together in one environment, reducing the need to switch between separate tools.
                </p>
              </div>
            </div>

            {/* Pillar 03 */}
            <div className="flex flex-col justify-between rounded-xl border theme-border theme-bg-surface-2 p-5 sm:p-6 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-[#FF7057]">03</span>
                  <ShieldCheck className="h-4 w-4 text-[#FF7057] opacity-80" />
                </div>
                <h3 className="text-sm font-bold theme-text-primary">
                  Reliability by Design
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed theme-text-secondary">
                  Focus on synchronization consistency, isolated workspaces, and predictable collaboration behavior as the foundation of the development experience.
                </p>
              </div>
            </div>
          </div>

          {/* Project Identity Element & Verified GitHub Link */}
          <div className="mt-8 pt-6 border-t theme-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs theme-text-secondary">
            <span className="font-medium text-center sm:text-left">
              Designed for developers. Built around collaboration.
            </span>
            <a
              href="https://github.com/Ajay-B-Acharya/NexathonIDE"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#FF7057] hover:underline"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub Repository</span>
            </a>
          </div>
        </div>
      </section>

      {/* 4. SYSTEM TOPOLOGY BAR & FOOTER */}
      <footer className="relative z-10 border-t theme-border theme-bg-surface-1 py-10 px-6 shrink-0 mt-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs theme-text-muted">
          <div className="flex items-center gap-2.5">
            <Code2 className="h-4 w-4 text-[#FF7057]" />
            <span className="font-bold theme-text-primary">NexathonIDE</span>
            <span>• Distributed Collaborative IDE & Autonomous Debugger</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-[#FF7057]" />
              React 19 + Monaco
            </span>
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5 text-emerald-500" />
              Yjs CRDT
            </span>
            <span className="inline-flex items-center gap-1">
              <Database className="h-3.5 w-3.5 text-amber-500" />
              PostgreSQL
            </span>
          </div>
        </div>
      </footer>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full border theme-border theme-bg-surface-1 theme-text-primary shadow-md hover:border-[#FF7057] hover:text-[#FF7057] hover:scale-105 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7057]"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}

      {/* FRICTIONLESS DEVELOPER IDENTITY MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl border theme-border theme-bg-surface-1 p-6 neu-card">
            <div className="flex items-center justify-between border-b theme-border pb-3.5 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF7057]/15 text-[#FF7057] ring-1 ring-[#FF7057]/30">
                  <Command className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold theme-text-primary">
                    Initialize Collaborator Session
                  </h3>
                  <p className="text-[11px] theme-text-muted">
                    Broadcasts via y-protocols/awareness to active peers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 theme-text-muted hover:theme-text-primary transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Live Awareness Cursor Preview */}
            <div className="mb-5 flex items-center justify-between rounded-xl border theme-border theme-bg-surface-2 px-3.5 py-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: selectedColor }}
                >
                  {previewInitials}
                </div>
                <span className="text-xs font-mono font-semibold theme-text-primary">
                  {previewHandle}
                </span>
              </div>
              <div className="flex items-center">
                <div
                  className="h-4 w-0.5"
                  style={{ backgroundColor: selectedColor }}
                />
                <span
                  className="rounded-r px-2 py-0.5 text-[10px] font-mono font-semibold text-white"
                  style={{ backgroundColor: selectedColor }}
                >
                  {previewHandle} • Ln 14
                </span>
              </div>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1.5">
                  Developer Handle
                </label>
                <input
                  type="text"
                  required
                  value={handleName}
                  onChange={(e) => setHandleName(e.target.value)}
                  placeholder="e.g., John"
                  autoFocus
                  className="w-full rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-sm theme-text-primary placeholder:text-[var(--text-muted)] focus:border-[#FF7057] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1.5">
                  Awareness Cursor Color
                </label>
                <div className="flex items-center justify-between rounded-lg border theme-border theme-bg-surface-2 p-2">
                  {CURSOR_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      className={`h-6 w-6 rounded-full transition-transform cursor-pointer ${
                        selectedColor === c.hex
                          ? 'scale-110 ring-2 ring-[#FF7057] ring-offset-2'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      aria-label={`Select color ${c.name}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    void handleGuestDemoClick();
                  }}
                  className="flex-1 rounded-lg border theme-border theme-bg-surface-2 py-2 text-xs font-semibold theme-text-secondary hover:theme-text-primary transition cursor-pointer neu-button"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-[#FF7057] fill-current" />
                    Instant Guest
                  </span>
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-[#FF7057] hover:bg-[#F26049] py-2 text-xs font-semibold text-white neu-button transition cursor-pointer"
                >
                  Continue to Rooms →
                </button>
              </div>

              <div className="pt-2 text-center border-t theme-border mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    onNavigateToLogin();
                  }}
                  className="text-xs text-[#FF7057] hover:underline transition cursor-pointer"
                >
                  Or sign in with Supabase Email & Password →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
