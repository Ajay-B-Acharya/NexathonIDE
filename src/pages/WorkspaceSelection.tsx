import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Terminal,
  Plus,
  Search,
  Cpu,
  Users,
  Sparkles,
  ArrowUpRight,
  Activity,
  FolderGit2,
  Command,
  Play,
  LogOut,
  Sliders,
  Check,
  Copy,
  Radio,
  Layers,
  Database,
  ArrowRight,
  Zap,
  X,
} from 'lucide-react';
import { workspaceApi } from '../services/workspaceApi';
import { getAccessibleRoomIds, addAccessibleRoomId } from '../services/refreshEngine';
import { UserProfile, WorkspaceRoom } from '../types';
import { ThemeMode, ThemeToggle } from '../components/ThemeToggle';
import { SpotlightCard } from '../components/react-bits/cards/SpotlightCard';
import { Folder } from '../components/react-bits/cards/Folder';
import { CountUp } from '../components/react-bits/text/CountUp';
import { DecryptedText } from '../components/react-bits/text/DecryptedText';
import { FloatingCommandDock } from '../components/FloatingCommandDock';
import { WorkspaceCreatorModal } from '../components/WorkspaceCreatorModal';
import { AdaptiveBackground } from '../components/AdaptiveBackground';

interface WorkspaceSelectionProps {
  user: UserProfile;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
  onSelectRoom: (room: WorkspaceRoom) => void;
  onLogout: () => void;
}

const RUNTIME_BLUEPRINTS = [
  {
    id: 'pyodide',
    title: 'Pyodide 3.12 Data Lab',
    tag: 'WASM // 0ms BOOT',
    desc: 'In-browser NumPy, Pandas & Matplotlib execution with zero server roundtrips.',
    color: '#00f0ff',
    accentText: 'text-cyan-500 dark:text-cyan-400',
    files: ['main.py', 'tensors.py', 'plot.py'],
  },
  {
    id: 'node-pty',
    title: 'Node-PTY Linux Container',
    tag: 'XTERM // WS:3001',
    desc: 'Full bidirectional bash shell with multiplexed xterm.js streams.',
    color: '#10b981',
    accentText: 'text-emerald-500 dark:text-emerald-400',
    files: ['server.ts', 'pty.sh', 'package.json'],
  },
  {
    id: 'quickjs',
    title: 'QuickJS + AI Debugger',
    tag: 'AST // GPT-4o PATCH',
    desc: 'Sandboxed ES2023 runtime paired with real-time traceback auto-patching.',
    color: '#f43f5e',
    accentText: 'text-rose-500 dark:text-rose-400',
    files: ['index.js', 'agent.ts', 'schema.sql'],
  },
];

export const WorkspaceSelection: React.FC<WorkspaceSelectionProps> = ({
  user,
  theme = 'dark',
  onToggleTheme,
  onSelectRoom,
  onLogout,
}) => {
  const isDark = theme === 'dark';

  const [rooms, setRooms] = useState<WorkspaceRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Terminal Modal state
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'nexathon-worker@cluster-01:~$ pty-daemon --status',
    '[OK] node-pty daemon active on ws://localhost:3001/pty (PID #4821)',
    '[OK] WebSockets binary stream ready. Click commands or type below:',
  ]);
  const [terminalCmd, setTerminalCmd] = useState('');

  // AI Diff Guard Diagnostics Modal state
  const [isAIDiffModalOpen, setIsAIDiffModalOpen] = useState(false);
  const [isDiffApplied, setIsDiffApplied] = useState(false);

  const executeTerminalCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    let output = '';
    const lower = trimmed.toLowerCase();
    if (lower === 'node -v' || lower === 'node --version') {
      output = 'v20.12.0';
    } else if (lower.includes('python')) {
      output = 'Python 3.12.3 (main, Pyodide WebAssembly & Linux node-pty)';
    } else if (lower === 'uname -a') {
      output = 'Linux nexathon-worker-crdt 6.5.0-35-generic x86_64 GNU/Linux';
    } else if (lower === 'ps aux' || lower === 'ps') {
      output = 'USER       PID %CPU %MEM    COMMAND\nworker       1  0.0  0.1    node src/server/index.js\nworker    4821  0.2  0.8    /bin/bash (node-pty)\nworker    4822  0.1  0.4    y-websocket-server :1234';
    } else if (lower.includes('yjs') || lower.includes('mesh')) {
      output = '[Yjs CRDT] State Vector: 1,482 bytes | Awareness: Active | Lamport Clock: v2.4';
    } else if (lower === 'clear') {
      setTerminalLogs([]);
      setTerminalCmd('');
      return;
    } else {
      output = `bash: ${trimmed}: command executed in cloud container`;
    }

    setTerminalLogs((prev) => [
      ...prev,
      `nexathon-worker@cluster-01:~$ ${trimmed}`,
      output,
    ]);
    setTerminalCmd('');
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts (Cmd+K to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const DEFAULT_STARTER_ROOMS: WorkspaceRoom[] = [
    {
      id: 'neural-net-wasm',
      name: 'neural-net-wasm',
      description: 'In-browser Pyodide 3.12 WASM runtime with NumPy calculations & Yjs sync',
      createdAt: new Date().toISOString(),
      updatedAt: 'LIVE NOW',
      ownerId: user.id,
    },
    {
      id: 'distributed-crdt-engine',
      name: 'distributed-crdt-engine',
      description: 'Real-time collaborative editing with shared cloud terminal and automated diffing',
      createdAt: new Date().toISOString(),
      updatedAt: '2m ago',
      ownerId: user.id,
    },
    {
      id: 'ai-traceback-fixer',
      name: 'ai-traceback-fixer',
      description: 'Sandboxed QuickJS ES2023 runtime paired with real-time AST auto-patching',
      createdAt: new Date().toISOString(),
      updatedAt: '14m ago',
      ownerId: user.id,
    },
  ];

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const list = await workspaceApi.listRooms();
      if (Array.isArray(list) && list.length > 0) {
        setRooms(list);
      } else {
        setRooms(DEFAULT_STARTER_ROOMS);
      }
    } catch {
      setRooms(DEFAULT_STARTER_ROOMS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
  }, []);

  const handleLaunchRoom = (roomId: string, name?: string) => {
    addAccessibleRoomId(user.id, roomId);
    const matched = rooms.find((r) => r.id === roomId);
    if (matched) {
      onSelectRoom(matched);
      return;
    }
    const newRoom: WorkspaceRoom = {
      id: roomId,
      name: name || roomId,
      description: 'Dynamic Collaborative CRDT + WASM Room',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: user.id,
    };
    onSelectRoom(newRoom);
  };

  const handleCliSpawn = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomInput.trim().replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || `room_${Date.now().toString(36)}`;
    handleLaunchRoom(clean, clean);
  };

  const handleCreatorModalSubmit = async (data: {
    name: string;
    description: string;
    runtime: string;
    memoryMb: number;
    threads: number;
    isPrivate: boolean;
  }) => {
    try {
      const created = await workspaceApi.createRoom({
        name: data.name,
        description: data.description,
        ownerId: user.id,
      });
      addAccessibleRoomId(user.id, created.id);
      onSelectRoom(created);
    } catch {
      const fallbackRoom: WorkspaceRoom = {
        id: `room_${Math.random().toString(36).substring(2, 10)}`,
        name: data.name,
        description: data.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: user.id,
      };
      addAccessibleRoomId(user.id, fallbackRoom.id);
      onSelectRoom(fallbackRoom);
    }
  };

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();
    return rooms.filter(
      (r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
  }, [rooms, search]);

  const copyRoomId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div
      className={`min-h-screen w-full select-none pb-28 relative overflow-x-hidden font-sans transition-colors duration-300 theme-bg-root theme-text-primary ${
        isDark ? 'dark' : 'light'
      }`}
      data-theme={theme}
    >
      {/* Theme-Adaptive Precision Micro-Dot Matrix + Spotlight */}
      <AdaptiveBackground variant="dashboard" theme={theme} />

      {/* ========================================================= */}
      {/* 1. COLLAPSED MONOSPACE TELEMETRY HEADER */}
      {/* ========================================================= */}
      <header className="relative z-10 border-b theme-border theme-bg-glass backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF7057]" />
            <span className="font-mono font-bold text-sm tracking-tight theme-text-primary">
              NEXATHON<span className="text-[#FF7057]">.CONTROL</span>
            </span>
            <span className="theme-text-muted font-mono hidden sm:inline">/</span>
            <span className="font-mono text-xs theme-text-secondary hidden sm:inline">workspaces</span>
          </div>

          {/* Center: Command Search Input */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl theme-bg-surface-2 border theme-border w-80 font-mono text-xs focus-within:border-[#FF7057] shadow-xs">
            <Search className="w-3.5 h-3.5 theme-text-muted shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter active nodes..."
              className="bg-transparent theme-text-primary focus:outline-none w-full"
            />
            <kbd className="px-1.5 py-0.5 text-[10px] rounded border theme-border theme-bg-surface-1 theme-text-muted">
              ⌘K
            </kbd>
          </div>

          {/* Right: Telemetry Badge + Theme Toggle + User Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 font-mono text-[11px] text-emerald-500 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              CRDT_MESH: 11ms
            </span>

            {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}

            <div className="h-5 w-px theme-border" />

            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs ring-1 ring-white/10"
              style={{ backgroundColor: user.color || '#6366f1' }}
              title={`Signed in as @${user.name}`}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>

            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              className="rounded-lg border theme-border theme-bg-surface-2 p-1.5 text-xs theme-text-secondary hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer shadow-xs"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Architectural Hairline Metric Ribbon */}
        <div className="border-t theme-border mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-4 divide-x theme-border font-mono">
          <div className="px-6 py-2.5 flex items-center justify-between">
            <span className="text-[11px] theme-text-muted uppercase">WASM_CACHE</span>
            <span className="text-xs sm:text-sm font-bold text-cyan-500 dark:text-cyan-400">
              <CountUp from={0} to={38.4} duration={0.9} /> MB
            </span>
          </div>
          <div className="px-6 py-2.5 flex items-center justify-between">
            <span className="text-[11px] theme-text-muted uppercase">ACTIVE_PEERS</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-500 dark:text-emerald-400">
              <CountUp from={0} to={6} duration={0.9} /> ONLINE
            </span>
          </div>
          <div className="px-6 py-2.5 flex items-center justify-between">
            <span className="text-[11px] theme-text-muted uppercase">PTY_DAEMON</span>
            <span className="text-xs sm:text-sm font-bold text-indigo-500 dark:text-indigo-400">PORT :3001</span>
          </div>
          <div className="px-6 py-2.5 flex items-center justify-between">
            <span className="text-[11px] theme-text-muted uppercase">AI_DIAGNOSTICS</span>
            <span className="text-xs sm:text-sm font-bold text-amber-500">GPT-4o READY</span>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN MISSION CONTROL CONTENT */}
      {/* ========================================================= */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-10 space-y-12">
        {/* ========================================================= */}
        {/* 2. INTERACTIVE RUNTIME SPAWNER WITH REACT BITS <Folder /> */}
        {/* ========================================================= */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-500 dark:text-cyan-400 font-semibold">
                01 // INITIALIZE NEW SANDBOX
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight theme-text-primary mt-1">
                Select Runtime Blueprint
              </h2>
            </div>

            {/* Direct CLI Spawner Bar & Advanced Modal Trigger */}
            <div className="flex items-center gap-2">
              <form
                onSubmit={handleCliSpawn}
                className="flex items-center gap-2 p-1 rounded-xl theme-bg-surface-2 border theme-border focus-within:border-[#FF7057] shadow-xs"
              >
                <span className="pl-3 font-mono text-xs text-[#FF7057] font-bold">$ mkdir</span>
                <input
                  type="text"
                  placeholder="custom-room-id"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  className="bg-transparent font-mono text-xs theme-text-primary focus:outline-none w-32 sm:w-40 font-medium"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#FF7057] hover:bg-[#F26049] text-white font-mono text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  SPAWN →
                </button>
              </form>

              <button
                type="button"
                onClick={() => setIsCreatorModalOpen(true)}
                title="Configure custom runtime with RAM, threads, and container sandbox options"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057] text-xs font-mono font-medium theme-text-primary transition cursor-pointer shadow-xs"
              >
                <Sliders className="w-3.5 h-3.5 text-[#FF7057]" />
                <span>Custom</span>
              </button>
            </div>
          </div>

          {/* 3 Interactive Blueprint Cards with 3D Pop-up Folder */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RUNTIME_BLUEPRINTS.map((bp) => (
              <SpotlightCard
                key={bp.id}
                spotlightColor={`${bp.color}25`}
                onClick={() => handleLaunchRoom(`${bp.id}-workspace`, bp.title)}
                className={`group p-6 rounded-2xl border theme-border hover:border-[#FF7057] cursor-pointer transition-all flex flex-col justify-between min-h-[230px] ${
                  isDark ? 'bg-[#000000]' : 'bg-[#FFF9F0] neu-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${bp.accentText}`}>
                      {bp.tag}
                    </span>
                    <h3 className="text-lg font-bold theme-text-primary mt-1 group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors">
                      {bp.title}
                    </h3>
                  </div>

                  {/* React Bits Interactive 3D Folder Component */}
                  <div className="scale-75 origin-top-right">
                    <Folder
                      size={0.88}
                      color={bp.color}
                      items={bp.files.map((file) => (
                        <div key={file} className="p-1 font-mono text-[8px] text-slate-900 font-bold truncate">
                          {file}
                        </div>
                      ))}
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-xs theme-text-secondary leading-relaxed">{bp.desc}</p>
                  <div className="mt-4 pt-3 border-t theme-border flex items-center justify-between font-mono text-[11px]">
                    <span className="theme-text-muted">Files: {bp.files.join(', ')}</span>
                    <span className={`flex items-center gap-1 font-bold ${bp.accentText}`}>
                      BOOT <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. ACTIVE MULTIPLAYER WORKSPACES WITH LIVE CONSOLE PREVIEW */}
        {/* ========================================================= */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-widest text-emerald-500 font-semibold">
                02 // ACTIVE CRDT CLUSTERS
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight theme-text-primary mt-1">
                Live Multiplayer Workspaces
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room, idx) => {
              const peers = ['JH', 'AD', 'AS'].slice(0, 2 + (idx % 2));
              const logs = [
                '>>> Epoch 50/50 — loss: 0.0142 (4.1ms WASM)',
                '$ y-websocket-server --port 1234 [Synced]',
                '[AI-Patch] Applied on line 84 (ZeroDivisionError)',
              ];
              const logSnippet = logs[idx % logs.length];

              return (
                <SpotlightCard
                  key={room.id}
                  spotlightColor={idx === 0 ? 'rgba(255, 112, 87, 0.18)' : idx === 1 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)'}
                  onClick={() => onSelectRoom(room)}
                  className={`p-6 rounded-2xl border theme-border hover:border-[#FF7057] transition-all cursor-pointer flex flex-col justify-between ${
                    isDark ? 'bg-[#000000]' : 'bg-[#FFF9F0] neu-card'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 font-mono text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">
                        CRDT Document Mesh
                      </span>
                      <span className="font-mono text-[10px] text-emerald-500 flex items-center gap-1 font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        LIVE NOW
                      </span>
                    </div>

                    <h3 className="text-lg font-mono font-bold theme-text-primary mt-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <FolderGit2 className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{room.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => copyRoomId(room.id, e)}
                        title="Copy Room ID"
                        className="rounded p-1 theme-text-muted hover:theme-text-primary transition shrink-0"
                      >
                        {copiedId === room.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </h3>

                    {/* Live Terminal Stream Snippet Inside Card (Kills Vibecoded Look!) */}
                    <div className="mt-4 p-2.5 rounded-xl border theme-border theme-bg-surface-2 font-mono text-[11px] theme-text-secondary truncate shadow-inner">
                      {logSnippet}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t theme-border flex items-center justify-between">
                    {/* Yjs Active Collaborator Avatars */}
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {peers.map((p, i) => (
                          <span
                            key={i}
                            className="w-6 h-6 rounded-full bg-indigo-600 border theme-border font-mono text-[10px] font-bold flex items-center justify-center text-white ring-1 ring-white/10"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      <span className="font-mono text-[11px] theme-text-muted">
                        {peers.length} peers
                      </span>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border theme-border theme-bg-surface-2 hover:bg-[#FF7057] hover:text-white font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      ATTACH <Play className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </section>
      </main>

      {/* macOS Command Dock placed firmly at the bottom of the page */}
      <footer className="mt-20 pb-14 flex flex-col items-center justify-center gap-3 relative z-20">
        <FloatingCommandDock
          theme={theme}
          isEmbedded={true}
          onNewWorkspace={() => setIsCreatorModalOpen(true)}
          onLaunchWasmLab={() => handleLaunchRoom('pyodide-data-lab', 'Pyodide 3.12 Data Lab')}
          onOpenTerminal={() => setIsTerminalModalOpen(true)}
          onOpenAIDiff={() => {
            setIsDiffApplied(false);
            setIsAIDiffModalOpen(true);
          }}
          onToggleTheme={onToggleTheme || (() => {})}
        />
        {/* Subtle status tag positioned BELOW the dock to ensure tooltips have clear air above */}
        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>QUICK ACTIONS DOCK // NEXATHON DESKTOP</span>
        </div>
      </footer>

      {/* Advanced Custom Workspace Creator Modal */}
      <WorkspaceCreatorModal
        isOpen={isCreatorModalOpen}
        onClose={() => setIsCreatorModalOpen(false)}
        onSubmit={handleCreatorModalSubmit}
      />

      {/* Interactive Node-PTY Terminal Daemon Modal */}
      {isTerminalModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 ${
          isDark ? 'bg-black/75 backdrop-blur-md' : 'bg-slate-900/40 backdrop-blur-md'
        }`}>
          <div className={`w-full max-w-2xl rounded-2xl border theme-border font-mono text-xs overflow-hidden flex flex-col transition-colors ${
            isDark
              ? 'bg-[#000000] text-white'
              : 'bg-[#FFF9F0] text-[#302820] neu-card'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b theme-border px-5 py-3.5 theme-bg-surface-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF7057] text-white">
                  <Terminal className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-2 theme-text-primary">
                    <span>Node-PTY Linux Terminal Container</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded border theme-border theme-bg-surface-1 text-[#FF7057] font-semibold">
                      WS :3001
                    </span>
                  </div>
                  <div className="text-[10px] theme-text-muted font-medium">
                    Active PID #4821 • xterm.js binary WebSocket stream
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTerminalModalOpen(false)}
                className="rounded-lg p-1.5 transition cursor-pointer theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Terminal Output Area */}
            <div className={`h-64 overflow-y-auto p-4 space-y-1.5 select-text font-mono ${
              isDark ? 'bg-[#000000] text-white' : 'bg-[#F1E8DA] text-[#302820]'
            }`}>
              {terminalLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed whitespace-pre-wrap ${
                    log.startsWith('nexathon-worker')
                      ? 'text-sky-400 font-bold'
                      : log.startsWith('[OK]')
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>

            {/* Quick Diagnostic Shortcut Chips */}
            <div className={`flex items-center gap-2 px-4 py-2 border-t overflow-x-auto text-[10px] ${
              isDark ? 'border-white/10 bg-[#0d121f]' : 'border-slate-200 bg-slate-50'
            }`}>
              <span className={`uppercase font-bold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Quick Run:
              </span>
              <button
                type="button"
                onClick={() => executeTerminalCommand('node -v')}
                className={`px-2 py-1 rounded border transition cursor-pointer shrink-0 font-bold ${
                  isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-sky-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-sky-700 shadow-xs'
                }`}
              >
                node -v
              </button>
              <button
                type="button"
                onClick={() => executeTerminalCommand('python3 --version')}
                className={`px-2 py-1 rounded border transition cursor-pointer shrink-0 font-bold ${
                  isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-cyan-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-cyan-700 shadow-xs'
                }`}
              >
                python3 --version
              </button>
              <button
                type="button"
                onClick={() => executeTerminalCommand('ps aux')}
                className={`px-2 py-1 rounded border transition cursor-pointer shrink-0 font-bold ${
                  isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-emerald-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-emerald-700 shadow-xs'
                }`}
              >
                ps aux
              </button>
              <button
                type="button"
                onClick={() => executeTerminalCommand('yjs-mesh')}
                className={`px-2 py-1 rounded border transition cursor-pointer shrink-0 font-bold ${
                  isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-purple-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-purple-700 shadow-xs'
                }`}
              >
                yjs-mesh
              </button>
              <button
                type="button"
                onClick={() => executeTerminalCommand('clear')}
                className={`px-2 py-1 rounded border transition cursor-pointer shrink-0 font-bold ${
                  isDark ? 'border-white/10 bg-white/5 hover:bg-white/10 text-rose-300' : 'border-slate-300 bg-white hover:bg-slate-100 text-rose-700 shadow-xs'
                }`}
              >
                clear
              </button>
            </div>

            {/* Interactive Terminal Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeTerminalCommand(terminalCmd);
              }}
              className={`flex items-center gap-2 border-t px-4 py-2.5 ${
                isDark ? 'border-[#242424] bg-[#0A0A0A]' : 'border-[#E9DECE] bg-[#FFF9F0]'
              }`}
            >
              <span className="font-bold select-none text-[#FF7057]">$</span>
              <input
                autoFocus
                type="text"
                value={terminalCmd}
                onChange={(e) => setTerminalCmd(e.target.value)}
                placeholder="Type bash command (e.g. ls, node -v, uname -a)..."
                className={`w-full bg-transparent font-mono text-xs focus:outline-none font-bold ${
                  isDark ? 'text-[#FFFFFF] placeholder:text-[#808080]' : 'text-[#302820] placeholder:text-[#8A7D6D]'
                }`}
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#FF7057] hover:bg-[#F26049] text-white font-bold text-xs transition cursor-pointer shrink-0 neu-button"
              >
                Execute
              </button>
            </form>

            {/* Modal Footer: Full Workspace Boot CTA */}
            <div className={`flex items-center justify-between border-t px-5 py-3.5 ${
              isDark ? 'border-[#242424] bg-[#000000]' : 'border-[#E9DECE] bg-[#F1E8DA]'
            }`}>
              <span className={`text-[11px] font-medium ${isDark ? 'text-[#B3B3B3]' : 'text-[#756858]'}`}>
                Want a full bidirectional xterm terminal IDE window?
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsTerminalModalOpen(false);
                  handleLaunchRoom('node-pty-linux', 'Node-PTY Linux Container');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF7057] hover:bg-[#F26049] text-white font-bold text-xs transition neu-button cursor-pointer"
              >
                <span>Launch Container Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autonomous AI Diff Guard & AST Diagnostics Modal */}
      {isAIDiffModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 ${
          isDark ? 'bg-black/80 backdrop-blur-md' : 'bg-[#302820]/30 backdrop-blur-md'
        }`}>
          <div className={`w-full max-w-2xl rounded-2xl border font-mono text-xs overflow-hidden flex flex-col transition-colors ${
            isDark
              ? 'border-[#242424] bg-[#000000] text-[#FFFFFF]'
              : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] neu-card'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b px-5 py-3.5 ${
              isDark ? 'border-[#242424] bg-[#0A0A0A]' : 'border-[#E9DECE] bg-[#F1E8DA]'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  isDark ? 'bg-[#FF7057]/15 text-[#FF7057]' : 'bg-[#FF7057] text-white neu-button'
                }`}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className={`font-bold flex items-center gap-2 ${isDark ? 'text-[#FFFFFF]' : 'text-[#302820]'}`}>
                    <span>AI Diff Guard & AST Diagnostic Engine</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                      isDark ? 'bg-[#FF7057]/15 text-[#FF7057] border-[#FF7057]/30' : 'bg-[#EFE3D2] text-[#302820] border-[#E9DECE]'
                    }`}>
                      GPT-4o + AST
                    </span>
                  </div>
                  <div className={`text-[10px] ${isDark ? 'text-[#808080]' : 'text-[#756858] font-medium'}`}>
                    Zero-Chatbot Autonomous Traceback Interception & Inline Patching
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAIDiffModalOpen(false)}
                className={`rounded-lg p-1.5 transition cursor-pointer ${
                  isDark ? 'text-[#808080] hover:bg-[#111111] hover:text-white' : 'text-[#756858] hover:bg-[#EFE3D2] hover:text-[#302820]'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Diagnostics Telemetry Metrics */}
            <div className={`grid grid-cols-3 gap-3 p-4 border-b text-[11px] ${
              isDark ? 'bg-[#000000] border-[#242424]' : 'bg-[#F7F1E7] border-[#E9DECE]'
            }`}>
              <div className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#242424] bg-[#0A0A0A]' : 'border-[#E9DECE] bg-[#FFF9F0] neu-card'
              }`}>
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#808080]' : 'text-[#756858]'}`}>AST Parser</div>
                <div className="font-bold mt-0.5 text-[#FF7057]">Tree-sitter Python / QuickJS</div>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#242424] bg-[#0A0A0A]' : 'border-[#E9DECE] bg-[#FFF9F0] neu-card'
              }`}>
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#808080]' : 'text-[#756858]'}`}>Diff Verification</div>
                <div className={`font-bold mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Myers Diff • Yjs CRDT Vector</div>
              </div>
              <div className={`p-2.5 rounded-xl border ${
                isDark ? 'border-[#242424] bg-[#0A0A0A]' : 'border-[#E9DECE] bg-[#FFF9F0] neu-card'
              }`}>
                <div className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#808080]' : 'text-[#756858]'}`}>Error Hook</div>
                <div className="font-bold mt-0.5 text-[#FF7057]">STDERR Exit Code Interceptor</div>
              </div>
            </div>

            {/* Traceback and Unified Diff Sandbox */}
            <div className={`p-5 space-y-4 overflow-y-auto max-h-72 ${
              isDark ? 'bg-[#000000]' : 'bg-[#FFF9F0]'
            }`}>
              <div>
                <div className="text-[10px] text-rose-500 uppercase font-bold mb-1.5 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Captured Runtime Traceback
                </div>
                <div className={`p-3.5 rounded-xl border text-[11px] font-mono leading-relaxed ${
                  isDark ? 'bg-[#0A0A0A] border-[#242424] text-rose-300' : 'bg-[#F1E8DA] border-[#E9DECE] text-rose-900'
                }`}>
                  <div className={isDark ? 'text-rose-300' : 'text-rose-800'}>Traceback (most recent call last):</div>
                  <div className={isDark ? 'text-rose-300' : 'text-rose-800'}>&nbsp;&nbsp;File &quot;engine.py&quot;, line 14, in compute_rate</div>
                  <div className={`font-bold ${isDark ? 'text-white' : 'text-[#302820]'}`}>&nbsp;&nbsp;&nbsp;&nbsp;return total_volume / rate</div>
                  <div className="text-rose-600 dark:text-rose-400 font-extrabold mt-1">ZeroDivisionError: float division by zero</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold mb-1.5 flex items-center justify-between">
                  <span>Autonomous Unified Diff Patch</span>
                  {isDiffApplied && (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                      <Check className="h-3 w-3" /> Patch Applied to Y.Doc
                    </span>
                  )}
                </div>
                <div className={`p-3.5 rounded-xl border font-mono text-[11px] leading-relaxed ${
                  isDark ? 'bg-[#0A0A0A] border-[#242424]' : 'bg-[#F1E8DA] border-[#E9DECE]'
                }`}>
                  <div className={isDark ? 'text-[#808080]' : 'text-[#756858] font-bold'}>@@ -13,3 +13,3 @@ def compute_rate(total_volume, rate):</div>
                  <div className={`px-1.5 py-0.5 rounded my-1 font-bold ${
                    isDark ? 'text-rose-400 bg-rose-500/10' : 'text-rose-700 bg-rose-100/80'
                  }`}>- &nbsp;&nbsp;return total_volume / rate</div>
                  <div className={`px-1.5 py-0.5 rounded my-1 font-bold ${
                    isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-700 bg-emerald-100/80'
                  }`}>+ &nbsp;&nbsp;return total_volume / max(rate, 1e-6)</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-between border-t px-5 py-3.5 ${
              isDark ? 'border-[#242424] bg-[#0A0A0A]' : 'border-[#E9DECE] bg-[#F1E8DA]'
            }`}>
              <button
                type="button"
                onClick={() => setIsDiffApplied(true)}
                disabled={isDiffApplied}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border transition text-xs font-bold cursor-pointer disabled:opacity-50 ${
                  isDark ? 'border-[#242424] bg-[#111111] text-[#FFFFFF] hover:bg-[#171717]' : 'border-[#E9DECE] bg-[#FFF9F0] text-[#302820] hover:bg-[#EFE3D2] neu-button'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isDiffApplied ? 'Patch Applied' : 'Simulate AST Patch'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAIDiffModalOpen(false);
                  handleLaunchRoom('ai-traceback-fixer', 'QuickJS + AI Debugger');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7057] hover:bg-[#F26049] text-white font-bold text-xs transition neu-button cursor-pointer"
              >
                <span>Launch QuickJS + AI Debugger Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSelection;
