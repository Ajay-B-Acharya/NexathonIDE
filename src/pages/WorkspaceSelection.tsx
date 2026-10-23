import React, { useEffect, useState, useMemo } from 'react';
import {
  FolderPlus,
  FolderGit2,
  ArrowRight,
  Loader2,
  RefreshCw,
  LogOut,
  AlertCircle,
  Code2,
  Sparkles,
  Clock,
  Hash,
  TerminalSquare,
  Search,
  Copy,
  Check,
  Filter,
  User as UserIcon,
  Layers,
  Cpu,
  Database,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { workspaceApi } from '../services/workspaceApi';
import { UserProfile, WorkspaceRoom } from '../types';
import { ThemeMode, ThemeToggle } from '../components/ThemeToggle';
import { AmbientCollaborationCanvas } from '../components/AmbientCollaborationCanvas';

interface WorkspaceSelectionProps {
  user: UserProfile;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
  onSelectRoom: (room: WorkspaceRoom) => void;
  onLogout: () => void;
}

const QUICK_TEMPLATES = [
  {
    label: '🐍 Python ML & Pyodide',
    name: 'Python ML Algorithm Sandbox',
    desc: 'In-browser Pyodide WASM runtime with NumPy calculations and Yjs synchronization',
  },
  {
    label: '⚡ QuickJS Microservice',
    name: 'QuickJS Distributed Service',
    desc: 'High-speed isolated JavaScript execution worker with AI syntax guard',
  },
  {
    label: '🌐 Multi-Peer CRDT Lab',
    name: 'Collaborative Multi-File Sandbox',
    desc: 'Real-time collaborative editing with shared cloud terminal and automated diffing',
  },
];

export const WorkspaceSelection: React.FC<WorkspaceSelectionProps> = ({
  user,
  theme = 'dark',
  onToggleTheme,
  onSelectRoom,
  onLogout,
}) => {
  const [rooms, setRooms] = useState<WorkspaceRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'mine' | 'recent'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const fetchRooms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await workspaceApi.listRooms();
      setRooms(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not connect to Supabase PostgreSQL or API server.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const created = await workspaceApi.createRoom({
        name: newRoomName.trim(),
        description: newRoomDesc.trim() || undefined,
        ownerId: user.id,
      });
      onSelectRoom(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinById = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinRoomId.trim();
    if (!trimmed) return;

    setError(null);
    try {
      const room = await workspaceApi.getRoom(trimmed);
      onSelectRoom(room);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Workspace "${trimmed}" not found.`
      );
    }
  };

  const handleCopyRoomId = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomId);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const userInitials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Filtered rooms logic
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterCategory === 'mine') {
        return r.ownerId === user.id;
      }

      if (filterCategory === 'recent') {
        const createdDate = new Date(r.createdAt || r.updatedAt || Date.now()).getTime();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return createdDate > oneDayAgo;
      }

      return true;
    });
  }, [rooms, searchQuery, filterCategory, user.id]);

  return (
    <div className="relative min-h-screen theme-bg-root bg-obsidian-glow bg-grid-pattern theme-text-primary flex flex-col overflow-y-auto select-none">
      {/* Dynamic Ambient Constellation Mesh Background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <AmbientCollaborationCanvas theme={theme} />
      </div>

      {/* Top Ambient Glow Spotlights */}
      <div className="pointer-events-none fixed -top-40 left-1/2 h-80 w-[800px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[130px]" />

      {/* Executive Glassmorphic Navigation Bar */}
      <header className="sticky top-0 z-30 border-b theme-border theme-bg-glass backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Brand & Telemetry */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight theme-text-primary">
                  Nexathon<span className="text-indigo-400">IDE</span>
                </h1>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 font-mono">
                  Hub
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Supabase Pooler Connected
                </span>
              </div>
              <p className="text-[11px] theme-text-muted">
                Executive Workspace Directory & Real-Time CRDT Fleet
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {/* User Presence Badge */}
            <div className="flex items-center gap-2 rounded-full border theme-border theme-bg-surface-1 px-3 py-1 shadow-xs">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs"
                style={{
                  backgroundColor: user.color,
                  boxShadow: `0 0 8px ${user.color}80`,
                }}
              >
                {userInitials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold theme-text-primary leading-tight">{user.name}</div>
                {user.email && (
                  <div className="text-[10px] theme-text-muted leading-none truncate max-w-[140px]">
                    {user.email}
                  </div>
                )}
              </div>
            </div>

            {/* Theme Switcher */}
            {onToggleTheme && (
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            )}

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              title="Sign Out of NexathonIDE"
              className="inline-flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs font-medium theme-text-secondary hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-6 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchRooms()}
              className="rounded-md bg-rose-500/20 border border-rose-500/30 px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/30 transition cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (4 cols): Provision Workspace & Join ID */}
          <div className="lg:col-span-4 space-y-5">
            {/* Create Workspace Panel */}
            <form
              onSubmit={(e) => void handleCreateRoom(e)}
              className="rounded-2xl border theme-border theme-bg-glass p-5 theme-shadow backdrop-blur-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b theme-border pb-3">
                <div className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
                  <FolderPlus className="h-4 w-4 text-indigo-400" />
                  <span>Provision New Workspace</span>
                </div>
                <Sparkles className="h-4 w-4 text-indigo-400/80" />
              </div>

              {/* Starter Templates */}
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider theme-text-muted mb-2">
                  1-Click Starter Stacks
                </span>
                <div className="space-y-1.5">
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setNewRoomName(tpl.name);
                        setNewRoomDesc(tpl.desc);
                      }}
                      className="group flex w-full items-center justify-between rounded-lg border theme-border theme-bg-surface-2 p-2 text-left hover:border-indigo-500/40 hover:theme-bg-surface-1 transition cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-medium theme-text-primary group-hover:text-indigo-400 transition">
                          {tpl.label}
                        </div>
                        <div className="text-[10px] theme-text-muted line-clamp-1">{tpl.desc}</div>
                      </div>
                      <ArrowRight className="h-3 w-3 theme-text-muted group-hover:translate-x-1 group-hover:text-indigo-400 transition" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                  Workspace Title
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Distributed Algorithm Sandbox"
                  className="w-full rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-xs theme-text-primary placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium theme-text-secondary mb-1">
                  Description <span className="theme-text-muted">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Python & TypeScript CRDT sync session"
                  className="w-full rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-xs theme-text-primary placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition cursor-pointer"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TerminalSquare className="h-4 w-4" />
                )}
                <span>Launch Cloud IDE →</span>
              </button>
            </form>

            {/* Direct Join by Room ID */}
            <form
              onSubmit={(e) => void handleJoinById(e)}
              className="rounded-2xl border theme-border theme-bg-glass p-5 theme-shadow backdrop-blur-xl space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
                <Hash className="h-4 w-4 text-emerald-400" />
                <span>Join by Workspace ID</span>
              </div>
              <p className="text-[11px] theme-text-muted">
                Paste an active session ID or invite token from a teammate to connect immediately.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="e.g., room_8f2b1a9c..."
                  className="flex-1 rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 text-xs font-mono theme-text-primary placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition"
                />
                <button
                  type="submit"
                  className="rounded-lg border theme-border theme-bg-surface-1 px-4 py-2 text-xs font-semibold theme-text-primary hover:border-indigo-500 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                >
                  Join
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (8 cols): Interactive Workspaces Grid with Search */}
          <div className="lg:col-span-8 rounded-2xl border theme-border theme-bg-glass p-5 theme-shadow backdrop-blur-xl flex flex-col min-h-[500px]">
            {/* Directory Header Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b theme-border pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold theme-text-primary">
                  Active Workspace Directory
                </h2>
                <span className="rounded-full theme-bg-surface-2 border theme-border px-2.5 py-0.5 text-xs font-mono text-indigo-400">
                  {filteredRooms.length} of {rooms.length}
                </span>
              </div>

              {/* Refresh & Quick Actions */}
              <button
                type="button"
                onClick={() => void fetchRooms()}
                className="inline-flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs font-medium theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Sync Directory</span>
              </button>
            </div>

            {/* Search Input & Category Filters */}
            <div className="mb-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 theme-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter workspaces by title, ID, or description..."
                  className="w-full rounded-lg border theme-border theme-bg-surface-2 pl-9 pr-3.5 py-2 text-xs theme-text-primary placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    filterCategory === 'all'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('mine')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    filterCategory === 'mine'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Created by Me
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('recent')}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    filterCategory === 'recent'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'theme-text-muted hover:theme-text-primary'
                  }`}
                >
                  Recent (24h)
                </button>
              </div>
            </div>

            {/* Workspaces List / State */}
            {isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-20 text-xs theme-text-muted">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-indigo-400" />
                <span>Polling real-time workspaces from PostgreSQL & Supabase...</span>
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed theme-border theme-bg-surface-2/40 p-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <FolderGit2 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold theme-text-primary">
                  {searchQuery ? 'No Matching Workspaces' : 'No Workspaces Found'}
                </h3>
                <p className="mt-1 max-w-sm text-xs theme-text-muted">
                  {searchQuery
                    ? `No workspaces match "${searchQuery}". Clear your search query to see all rooms.`
                    : 'Create your first collaborative sandbox using the provisioning panel on the left.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-1">
                {filteredRooms.map((room) => {
                  const isOwner = room.ownerId === user.id;
                  const isCopied = copiedId === room.id;

                  return (
                    <div
                      key={room.id}
                      onClick={() => onSelectRoom(room)}
                      className="group relative flex cursor-pointer flex-col justify-between rounded-xl border theme-border theme-bg-surface-2 p-4.5 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/60 hover:theme-bg-surface-1 hover:shadow-[0_12px_35px_rgba(99,102,241,0.2)]"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                            </span>
                            <h3 className="font-semibold text-sm theme-text-primary group-hover:text-indigo-400 transition truncate max-w-[190px]">
                              {room.name}
                            </h3>
                          </div>

                          {/* Quick Copy Room ID */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyRoomId(room.id, e)}
                            title="Copy Room ID to clipboard"
                            className="inline-flex items-center gap-1 rounded border theme-border theme-bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono theme-text-muted hover:theme-text-primary hover:border-indigo-500/40 transition cursor-pointer"
                          >
                            {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            <span>{isCopied ? 'Copied' : `#${room.id.slice(0, 6)}`}</span>
                          </button>
                        </div>

                        {/* Description */}
                        <p className="text-xs theme-text-muted line-clamp-2 min-h-[32px] leading-relaxed">
                          {room.description || 'Collaborative multi-file workspace with real-time Yjs CRDTs & in-browser WASM.'}
                        </p>

                        {/* Tech Stack Pills */}
                        <div className="mt-3 flex flex-wrap gap-1 text-[10px] font-mono">
                          <span className="rounded theme-bg-surface-1 border theme-border px-1.5 py-0.5 theme-text-secondary">
                            Python 3.12
                          </span>
                          <span className="rounded theme-bg-surface-1 border theme-border px-1.5 py-0.5 theme-text-secondary">
                            QuickJS
                          </span>
                          <span className="rounded theme-bg-surface-1 border theme-border px-1.5 py-0.5 text-indigo-400">
                            Yjs CRDT
                          </span>
                        </div>
                      </div>

                      {/* Card Footer */}
                      <div className="mt-4 flex items-center justify-between border-t theme-border pt-3">
                        <div className="flex items-center gap-1.5 text-[11px] theme-text-muted">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(room.updatedAt || room.createdAt || Date.now()).toLocaleDateString()}</span>
                          {isOwner && (
                            <span className="ml-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-indigo-400">
                              You
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600/15 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-semibold text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(99,102,241,0.4)] transition">
                          <span>Launch IDE</span>
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
