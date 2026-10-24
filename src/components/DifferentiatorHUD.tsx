import React, { useState, useEffect } from 'react';
import { Eye, Cpu, Radio, Terminal, Sparkles, MessageSquare, X, Minus, ChevronUp } from 'lucide-react';
import { ThemeMode } from './ThemeToggle';

interface DifferentiatorHUDProps {
  theme?: ThemeMode;
  engineMode?: 'wasm' | 'pty';
  onEngineModeChange?: (mode: 'wasm' | 'pty') => void;
  topOffsetClass?: string;
}

export const DifferentiatorHUD: React.FC<DifferentiatorHUDProps> = ({
  theme = 'dark',
  engineMode: controlledEngineMode,
  onEngineModeChange,
  topOffsetClass = 'top-16',
}) => {
  const isDark = theme === 'dark';

  const [xRayMode, setXRayMode] = useState(false);
  const [internalEngineMode, setInternalEngineMode] = useState<'wasm' | 'pty'>('wasm');
  const activeEngineMode = controlledEngineMode !== undefined ? controlledEngineMode : internalEngineMode;

  // Individual banner minimize states
  const [minimizedCRDT, setMinimizedCRDT] = useState(false);
  const [minimizedWASM, setMinimizedWASM] = useState(false);
  const [minimizedPTY, setMinimizedPTY] = useState(false);

  // Scroll pop-out / pop-in and scaling physics
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastY = 0;
    let ticking = false;

    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = e.target as HTMLElement | Document | null;
          let currentY = 0;
          if (
            target &&
            'scrollTop' in target &&
            typeof (target as HTMLElement).scrollTop === 'number' &&
            (target as HTMLElement).scrollTop > 0
          ) {
            currentY = (target as HTMLElement).scrollTop;
          } else {
            currentY = window.scrollY || document.documentElement.scrollTop || 0;
          }

          setScrollY(currentY);

          const delta = currentY - lastY;

          // When scrolling down slowly or quickly beyond threshold, pop out top banner
          if (currentY > 40 && delta > 4) {
            setIsScrolledDown(true);
          } else if (delta < -4 || currentY <= 25) {
            // Scrolling up or near top -> pop banner back in
            setIsScrolledDown(false);
          }

          lastY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // When scrolling down, boxes become small slowly; when scrolling up, they enlarge slowly
  const isShrunk = scrollY > 50;

  const handleSelectEngine = (mode: 'wasm' | 'pty') => {
    setInternalEngineMode(mode);
    onEngineModeChange?.(mode);
  };

  // Figma-style '/' Cursor Chat state
  const [mousePos, setMousePos] = useState({ x: 400, y: 300 });
  const [cursorChatOpen, setCursorChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [activeBubble, setActiveBubble] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.classList.contains('inputarea');

      // Cmd+X or Ctrl+X toggles Architecture X-Ray HUD
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x' && !isInput) {
        e.preventDefault();
        setXRayMode((prev) => !prev);
      }

      // Press '/' to open Figma-style cursor chat
      if (e.key === '/' && !isInput && !cursorChatOpen) {
        e.preventDefault();
        setCursorChatOpen(true);
        setChatMessage('');
      }

      if (e.key === 'Escape') {
        setCursorChatOpen(false);
        setActiveBubble(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cursorChatOpen]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      setActiveBubble({
        text: chatMessage.trim(),
        x: mousePos.x,
        y: mousePos.y,
      });
      setCursorChatOpen(false);
      setChatMessage('');
      setTimeout(() => {
        setActiveBubble(null);
      }, 4000);
    } else {
      setCursorChatOpen(false);
    }
  };

  return (
    <>
      {/* ========================================================= */}
      {/* 1. TOP FLOATING DIFFERENTIATOR CONTROL PILL */}
      {/* Pops OUT when scrolling down; pops IN when scrolling up */}
      {/* ========================================================= */}
      <div
        className={`fixed ${topOffsetClass} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 p-1.5 rounded-2xl border shadow-2xl font-mono text-xs select-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolledDown
            ? '-translate-y-28 opacity-0 pointer-events-none scale-95'
            : 'translate-y-0 opacity-100 pointer-events-auto scale-100'
        } ${
          isDark
            ? 'border-[#242424] bg-[#000000] text-white'
            : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-card'
        }`}
      >
        {/* Hybrid Engine Clutch Switcher (WASM Edge <-> Cloud PTY) */}
        <div
          className={`flex items-center rounded-xl p-0.5 border ${
            isDark ? 'bg-[#0A0A0A] border-[#242424]' : 'bg-[#F1E8DA] border-[#E9DECE]'
          }`}
          title="Hybrid Engine Clutch: Switch instant local WebAssembly execution with cloud Linux PTY container"
        >
          <button
            type="button"
            onClick={() => handleSelectEngine('wasm')}
            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
              activeEngineMode === 'wasm'
                ? 'bg-[#FF7057] text-white'
                : 'theme-text-secondary hover:theme-text-primary'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>EDGE WASM (0ms)</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectEngine('pty')}
            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
              activeEngineMode === 'pty'
                ? 'bg-[#FF7057] text-white'
                : 'theme-text-secondary hover:theme-text-primary'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CLOUD PTY (:3001)</span>
          </button>
        </div>

        <div className={`h-4 w-px mx-1 ${isDark ? 'bg-[#242424]' : 'bg-[#E9DECE]'}`} />

        {/* Architecture X-Ray HUD Toggle */}
        <button
          type="button"
          onClick={() => setXRayMode(!xRayMode)}
          title="Toggle Technical Architecture X-Ray HUD (Shortcut: Cmd+X / Ctrl+X)"
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
            xRayMode
              ? 'border-[#FF7057] bg-[#FF7057]/15 text-[#FF7057]'
              : isDark
              ? 'border-transparent hover:bg-[#111111] text-[#B3B3B3]'
              : 'border-transparent hover:bg-[#F1E8DA] text-[#302820] font-bold'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>X-RAY HUD: {xRayMode ? 'ACTIVE' : 'OFF'}</span>
          <kbd className="hidden xl:inline-block px-1 rounded text-[9px] border theme-border opacity-70">
            ⌘X
          </kbd>
        </button>

        {/* Spatial Cursor Chat Hint */}
        <span className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-[11px] theme-text-muted font-semibold">
          Press <kbd className="px-1.5 py-0.5 rounded border theme-border theme-bg-surface-2 font-bold theme-text-primary">/</kbd> to Chat
        </span>
      </div>

      {/* ========================================================= */}
      {/* 2. FIGMA-STYLE FLOATING CURSOR CHAT BUBBLE */}
      {/* ========================================================= */}
      {cursorChatOpen && (
        <div
          className="fixed z-50 pointer-events-auto transition-transform duration-75"
          style={{ left: mousePos.x + 16, top: mousePos.y + 16 }}
        >
          <form
            onSubmit={handleSendChat}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl rounded-tl-xs bg-[#FF7057] text-white border border-[#F26049] neu-button font-mono text-xs font-bold min-w-[240px]"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <input
              autoFocus
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Broadcast to Yjs peers... (Enter ↵)"
              className="bg-transparent placeholder-white/70 text-white focus:outline-none w-full font-bold"
            />
            <button
              type="button"
              onClick={() => setCursorChatOpen(false)}
              className="p-0.5 hover:bg-black/10 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Active Broadcast Bubble */}
      {activeBubble && (
        <div
          className="fixed z-50 pointer-events-none transition-all duration-300 animate-in fade-in zoom-in-95"
          style={{ left: activeBubble.x + 16, top: activeBubble.y + 16 }}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl rounded-tl-xs bg-[#FF7057] text-white border border-[#F26049] neu-button font-mono text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>{activeBubble.text}</span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ARCHITECTURE X-RAY OVERLAY BANNERS (When X-Ray Mode is ON) */}
      {/* Positioned in side gutters (NO overlap with center text) */}
      {/* Becomes small slowly when scrolling down; enlarges slowly when scrolling up */}
      {/* ========================================================= */}
      {xRayMode && (
        <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden font-mono text-[11px]">
          {/* --------------------------------------------------------- */}
          {/* BANNER 1: Top-Left Yjs CRDT Inspector */}
          {/* Pops OUT and becomes completely invisible when scrolling down */}
          {/* --------------------------------------------------------- */}
          <div
            className={`absolute top-24 left-3 lg:left-6 xl:left-8 pointer-events-auto origin-top-left transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolledDown
                ? '-translate-y-20 -translate-x-12 opacity-0 pointer-events-none scale-90'
                : 'translate-y-0 translate-x-0 opacity-100 pointer-events-auto scale-100 shadow-2xl'
            }`}
          >
            {minimizedCRDT ? (
              <button
                type="button"
                onClick={() => setMinimizedCRDT(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${
                  isDark
                    ? 'border-[#242424] bg-[#000000] text-white'
                    : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-button'
                }`}
                title="Expand Yjs CRDT Telemetry"
              >
                <Radio className="w-3.5 h-3.5 text-[#FF7057] animate-ping" />
                <span className="font-bold">CRDT: 1.4KB</span>
                <ChevronUp className="w-3 h-3 rotate-180 opacity-70" />
              </button>
            ) : (
              <div
                className={`p-4 rounded-2xl border space-y-1.5 min-w-[270px] max-w-[310px] transition-all ${
                  isDark
                    ? 'border-[#242424] bg-[#000000] text-white'
                    : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3 font-bold text-[#FF7057] border-b theme-border pb-1.5">
                  <span className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 animate-ping" />
                    [X-RAY] YJS_CRDT_PROVIDER
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded theme-bg-surface-2 font-bold">v13.6</span>
                    <button
                      type="button"
                      onClick={() => setMinimizedCRDT(true)}
                      className="p-0.5 hover:theme-bg-surface-2 rounded cursor-pointer text-[#FF7057]"
                      title="Minimize card"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="theme-text-secondary font-medium">
                  Binary State Vector: <strong className="theme-text-primary font-bold">1,482 bytes</strong>
                </div>
                <div className="theme-text-secondary font-medium">
                  Conflict Resolution: <strong className="theme-text-primary font-bold">Sub-ms Lamport Merges</strong>
                </div>
                <div className="text-[10px] theme-text-muted font-medium">
                  Awareness Protocol: WebRTC + WebSocket :1234
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------- */}
          {/* BANNER 2: Mid-Left WASM Heap Inspector */}
          {/* --------------------------------------------------------- */}
          <div
            className={`absolute top-72 lg:top-76 left-3 lg:left-6 xl:left-8 pointer-events-auto origin-top-left transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolledDown
                ? 'translate-y-20 -translate-x-12 opacity-0 pointer-events-none scale-90'
                : 'translate-y-0 translate-x-0 opacity-100 pointer-events-auto scale-100'
            }`}
          >
            {minimizedWASM ? (
              <button
                type="button"
                onClick={() => setMinimizedWASM(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${
                  isDark
                    ? 'border-[#242424] bg-[#000000] text-white'
                    : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-button'
                }`}
                title="Expand Pyodide WASM Telemetry"
              >
                <Cpu className="w-3.5 h-3.5 text-[#FF7057]" />
                <span className="font-bold">WASM: 42.4MB</span>
                <ChevronUp className="w-3 h-3 rotate-180 opacity-70" />
              </button>
            ) : (
              <div
                className={`p-4 rounded-2xl border space-y-1.5 min-w-[270px] max-w-[310px] transition-all ${
                  isDark
                    ? 'border-[#242424] bg-[#000000] text-white'
                    : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3 font-bold text-[#FF7057] border-b theme-border pb-1.5">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5" />
                    [X-RAY] PYODIDE_WASM_SANDBOX
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded theme-bg-surface-2 font-bold">0.26.2</span>
                    <button
                      type="button"
                      onClick={() => setMinimizedWASM(true)}
                      className="p-0.5 hover:theme-bg-surface-2 rounded cursor-pointer text-[#FF7057]"
                      title="Minimize card"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="theme-text-secondary font-medium">
                  Linear Memory Heap: <strong className="theme-text-primary font-bold">42.4 MB</strong> (Worker)
                </div>
                <div className="theme-text-secondary font-medium">
                  Cold-Start Latency: <strong className="theme-text-primary font-bold">0.04s</strong> (Zero VM boot)
                </div>
                <div className="text-[10px] theme-text-muted font-medium">
                  Server Compute Cost: <strong className="theme-text-primary font-bold">$0.00 / execution</strong>
                </div>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------- */}
          {/* BANNER 3: Top-Right Node-PTY & AI Doctor Inspector */}
          {/* --------------------------------------------------------- */}
          <div
            className={`absolute top-24 right-3 lg:right-6 xl:right-8 pointer-events-auto origin-top-right transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolledDown
                ? '-translate-y-20 translate-x-12 opacity-0 pointer-events-none scale-90'
                : 'translate-y-0 translate-x-0 opacity-100 pointer-events-auto scale-100'
            }`}
          >
            {minimizedPTY ? (
              <button
                type="button"
                onClick={() => setMinimizedPTY(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all ${
                  isDark
                    ? 'border-[#242424] bg-[#000000] text-white'
                    : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-button'
                }`}
                title="Expand Node-PTY Telemetry"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#FF7057]" />
                <span className="font-bold">PTY: PID #4821</span>
                <ChevronUp className="w-3 h-3 rotate-180 opacity-70" />
              </button>
            ) : (
              <div
                className={`p-4 rounded-2xl border space-y-1.5 min-w-[270px] max-w-[310px] transition-all ${
                  isDark
                    ? 'border-[#242424] bg-[#000000] text-white'
                    : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3 font-bold text-[#FF7057] border-b theme-border pb-1.5">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    [X-RAY] PTY_DAEMON + AST_DOCTOR
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded theme-bg-surface-2 font-bold">Active</span>
                    <button
                      type="button"
                      onClick={() => setMinimizedPTY(true)}
                      className="p-0.5 hover:theme-bg-surface-2 rounded cursor-pointer text-[#FF7057]"
                      title="Minimize card"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="theme-text-secondary font-medium">
                  Cloud Shell: <strong className="theme-text-primary font-bold">node-pty PID #4821</strong>
                </div>
                <div className="theme-text-secondary font-medium">
                  AI Hook: <strong className="theme-text-primary font-bold">STDERR AST Interceptor</strong>
                </div>
                <div className="text-[10px] theme-text-muted font-medium">
                  Diff Guard: <strong className="theme-text-primary font-bold">Automatic Patch Generation</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DifferentiatorHUD;
