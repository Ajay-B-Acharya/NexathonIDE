import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Code2,
  ArrowRight,
  Zap,
  Terminal,
  Cpu,
  ShieldCheck,
  GitBranch,
  Database,
  Layers,
  CheckCircle2,
  Users,
  Command,
  X,
  Menu,
  Loader2,
  Activity,
  Clock,
  Bug,
  Check,
  AlertTriangle,
  Lock,
  ChevronUp,
} from 'lucide-react';
import { UserProfile } from '../types';
import { AmbientCollaborationCanvas } from '../components/AmbientCollaborationCanvas';
import { AdaptiveBackground } from '../components/AdaptiveBackground';
import { ThemeMode, ThemeToggle } from '../components/ThemeToggle';
import { SpotlightCard } from '../components/react-bits/cards/SpotlightCard';
import { TiltedCard } from '../components/react-bits/cards/TiltedCard';
import { DecryptedText } from '../components/react-bits/text/DecryptedText';
import { ShinyText } from '../components/react-bits/text/ShinyText';
import { Squares } from '../components/react-bits/backgrounds/Squares';
import { StarBorder } from '../components/react-bits/animations/StarBorder';
import { ClickSpark } from '../components/react-bits/animations/ClickSpark';
import { SpeedBenchmarkWidget } from '../components/SpeedBenchmarkWidget';
import { TechStackMarquee } from '../components/TechStackMarquee';
import { TrueFocus } from '../components/react-bits/text/TrueFocus';
import { FolderOpen } from 'lucide-react';

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
  { hex: '#FF7057', name: 'Coral' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#ec4899', name: 'Rose' },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    setShowBackToTop(scrollTop > 400);
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Global Landing Keyboard Shortcuts (Cmd+K / Escape)
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
      className={`relative h-screen w-screen overflow-y-auto overflow-x-hidden theme-bg-root theme-text-primary select-none scroll-smooth ${
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
      <header className="sticky top-0 z-40 border-b theme-border bg-[var(--bg-root)]/90 backdrop-blur-xl transition-all duration-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
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

          {/* Center: Floating Capsule Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 rounded-full border theme-border theme-bg-surface-2 p-1 backdrop-blur-md">
            <a
              href="#live-sandbox"
              className="rounded-full px-4 py-1.5 text-xs font-semibold theme-text-secondary hover:theme-text-primary hover:bg-[#FFFCF6] dark:hover:bg-[#171717] transition-all"
            >
              Interactive Sandbox
            </a>
            <a
              href="#bento"
              className="rounded-full px-4 py-1.5 text-xs font-semibold theme-text-secondary hover:theme-text-primary hover:bg-[#FFFCF6] dark:hover:bg-[#171717] transition-all"
            >
              Core Architecture
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

            {/* Mobile Navigation Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden inline-flex items-center justify-center rounded-xl border theme-border p-2 theme-text-secondary hover:theme-text-primary hover:bg-white/[0.05] transition cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t theme-border bg-[var(--bg-root)]/95 backdrop-blur-2xl px-6 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col gap-2 text-sm font-medium">
              <a
                href="#live-sandbox"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.06] theme-text-secondary hover:theme-text-primary transition"
              >
                Interactive Sandbox
              </a>
              <a
                href="#bento"
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.06] theme-text-secondary hover:theme-text-primary transition"
              >
                Core Architecture
              </a>
            </nav>
            <div className="pt-2 border-t theme-border flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handlePrimaryCTA();
                }}
                className="text-xs font-semibold theme-text-primary hover:text-[#FF7057]"
              >
                {existingUser ? `Resume (${existingUser.name}) →` : 'Sign In / Sign Up →'}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. RECONSTRUCTED CLEAN & RESPONSIVE HERO SECTION */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-10 sm:pt-16 pb-6 text-center">
        {/* Master Headline */}
        <h1 className="mx-auto max-w-4xl text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight theme-text-primary leading-[1.14] sm:leading-[1.08] font-heading">
          Distributed Real-Time Coding.{' '}
          <span className="block mt-2 text-[#FF7057]">
            <span className="font-serif italic font-normal">Zero Cold Starts.</span> Pure In-Browser WASM.
          </span>
        </h1>

        {/* Clean, Persuasive Subheadline */}
        <p className="mx-auto mt-5 sm:mt-6 max-w-2xl text-sm sm:text-base md:text-lg font-normal leading-relaxed theme-text-secondary px-2">
          Conflict-free collaborative editing with CRDTs, instant in-browser Python &amp; JavaScript WebAssembly runtimes, and autonomous AI code guard rails.
        </p>

        {/* Reconstructed Responsive Action CTAs */}
        <div className="mt-8 sm:mt-9 flex items-center justify-center gap-3 w-full max-w-md sm:max-w-none mx-auto px-4">
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
        </div>

        {/* Unified Interactive Showcase IDE Container with Carousel Effect */}
        <div
          id="live-sandbox"
          className={`relative mx-auto mt-10 sm:mt-12 w-full max-w-5xl rounded-2xl border theme-border overflow-hidden transition-all duration-300 text-left ${
            isDark ? 'bg-[#080808]' : 'bg-[#FFF9F0] neu-card'
          }`}
        >
          {/* Top Chrome / Window Controls & Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b theme-border theme-bg-surface-2/60">
            {/* Left: macOS Dots + Mode Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 mr-1">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FF7057]/10 border border-[#FF7057]/20 text-[#FF7057] font-mono text-[11px] font-medium">
                <Users className="h-3 w-3 shrink-0" />
                <span>CRDT Mesh Live Sync</span>
              </div>
            </div>

            {/* Right: Active Peers & Engine Badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF7057]/10 border border-[#FF7057]/20 text-[#FF7057] font-mono text-[11px]">
                <Users className="w-3.5 h-3.5 text-[#FF7057]" />
                <span>2 Active Peers</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Pyodide WASM Active
              </div>
            </div>
          </div>

          {/* Multiplayer CRDT Mesh Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[360px] font-mono text-xs">
            {/* Code Editor */}
            <div className="md:col-span-7 p-5 bg-black/5 dark:bg-black/25 space-y-2.5 theme-text-primary">
              <p className="theme-text-muted"># Instant local execution via WebAssembly</p>
              <p>
                <span className="text-[#FF7057]">import</span> <span className="text-amber-500">numpy</span> <span className="text-[#FF7057]">as</span> np
              </p>
              <p>
                dataset = np.random.randn(1000)
              </p>
              <p>
                result = &#123;<span className="text-emerald-500">&quot;mean&quot;</span>: float(dataset.mean())&#125;
              </p>
              <p className="flex items-center">
                <span>print(f<span className="text-emerald-500">&quot;Calculated local variance: &#123;dataset.var():.4f&#125;&quot;</span>)</span>
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#FF7057] animate-pulse" />
              </p>
              <p className="theme-text-muted pt-2"># AI Diff Guard &amp; CRDT peer mesh synched</p>
            </div>

            {/* Live Terminal & Node-PTY Output */}
            <div className="md:col-span-5 p-5 bg-black/10 dark:bg-black/50 border-t md:border-t-0 md:border-l theme-border flex flex-col justify-between">
              <div className="space-y-1.5 font-mono">
                <p className="theme-text-muted">[yjs] Peer mesh synched (room: nexathon-prod)</p>
                <p className="text-emerald-500">&gt;&gt;&gt; Running in browser WebWorker thread...</p>
                <p className="text-[#FF7057]">&#123;&quot;mean&quot;: 0.0314, &quot;status&quot;: &quot;executed_wasm&quot;&#125;</p>
                <p className="theme-text-primary">Calculated local variance: 0.9982</p>
                <p className="text-emerald-500 flex items-center gap-1.5 pt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AST state vector converged (0 conflicts)</span>
                </p>
              </div>
              <div className="pt-4 border-t theme-border flex items-center justify-between text-[11px] theme-text-muted">
                <span>Latency: &lt;1ms (Local Silicon)</span>
                <span className="text-emerald-500 font-semibold">$0 server cost</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. BENTO GRID: FOUR ARCHITECTURAL PILLARS */}
      <section id="bento" className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#FF7057]">
            Core Engineering
          </span>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight theme-text-primary font-heading">
            Engineered for Systems-Level Reliability
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm theme-text-secondary">
            Four decoupled layers working together across WebSockets, REST, and WebAssembly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bento Card 1: CRDT */}
          <div className="group rounded-2xl border theme-border theme-bg-surface-1 p-5 transition-all duration-300 hover:border-[#FF7057]/50 neu-card relative">
            <div className="flex items-center justify-between mb-3">
              <span className="rounded bg-[#FF7057]/15 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#FF7057]">
                01 // CRDT
              </span>
              <Users className="h-4 w-4 text-[#FF7057]" />
            </div>
            <h3 className="text-sm font-bold theme-text-primary">
              Per-File Y.Doc Isolation
            </h3>
            <p className="mt-2 text-xs theme-text-secondary leading-relaxed">
              Every file binds to an isolated Yjs document key (<code className="font-mono text-[#FF7057]">${'{roomId}:${filePath}'}</code>). Teammates switch files freely with zero buffer collision.
            </p>
            <div className="mt-4 pt-2.5 border-t theme-border text-[11px] font-mono text-[#FF7057] flex items-center justify-between">
              <span>Awareness Cursors</span>
              <span>Sub-15ms</span>
            </div>
          </div>

          {/* Bento Card 2: WASM */}
          <div className="group rounded-2xl border theme-border theme-bg-surface-1 p-5 transition-all duration-300 hover:border-emerald-500/50 neu-card relative">
            <div className="flex items-center justify-between mb-3">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-emerald-500">
                02 // WASM
              </span>
              <Cpu className="h-4 w-4 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold theme-text-primary">
              Pyodide & QuickJS Sandbox
            </h3>
            <p className="mt-2 text-xs theme-text-secondary leading-relaxed">
              Executes Python 3.12 and JavaScript/TypeScript in isolated Web Workers. Complete stdout/stderr capture with a 10s watchdog timeout.
            </p>
            <div className="mt-4 pt-2.5 border-t theme-border text-[11px] font-mono text-emerald-500 flex items-center justify-between">
              <span>Client Compute</span>
              <span>100% Private</span>
            </div>
          </div>

          {/* Bento Card 3: PTY */}
          <div className="group rounded-2xl border theme-border theme-bg-surface-1 p-5 transition-all duration-300 hover:border-sky-500/50 neu-card relative">
            <div className="flex items-center justify-between mb-3">
              <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-sky-500">
                03 // PTY
              </span>
              <Terminal className="h-4 w-4 text-sky-500" />
            </div>
            <h3 className="text-sm font-bold theme-text-primary">
              Full-Duplex Node-PTY Stream
            </h3>
            <p className="mt-2 text-xs theme-text-secondary leading-relaxed">
              Native `@xterm/xterm` with ANSI colors and dynamic `cols/rows` SIGWINCH resize frames streaming over bidirectional WebSockets.
            </p>
            <div className="mt-4 pt-2.5 border-t theme-border text-[11px] font-mono text-sky-500 flex items-center justify-between">
              <span>Interactive Shell</span>
              <span>POSIX PTY</span>
            </div>
          </div>

          {/* Bento Card 4: AI Diff Guard */}
          <div className="group rounded-2xl border theme-border theme-bg-surface-1 p-5 transition-all duration-300 hover:border-[#FF7057]/50 neu-card relative">
            <div className="flex items-center justify-between mb-3">
              <span className="rounded bg-[#FF7057]/15 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#FF7057]">
                04 // AI GUARD
              </span>
              <ShieldCheck className="h-4 w-4 text-[#FF7057]" />
            </div>
            <h3 className="text-sm font-bold theme-text-primary">
              Atomic CRDT Patching
            </h3>
            <p className="mt-2 text-xs theme-text-secondary leading-relaxed">
              Pipes runtime traceback errors to AI diagnostics. Requires human confirmation in a side-by-side diff modal before committing changes.
            </p>
            <div className="mt-4 pt-2.5 border-t theme-border text-[11px] font-mono text-[#FF7057] flex items-center justify-between">
              <span>Guarded Mutations</span>
              <span>Zero-Hallucination</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SYSTEM TOPOLOGY BAR & FOOTER */}
      <footer className="relative z-10 border-t theme-border theme-bg-surface-1 py-10 px-6">
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

      {/* 8. FRICTIONLESS DEVELOPER IDENTITY MODAL */}
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
