import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { workspaceApi } from '../services/workspaceApi';
import { UserProfile, WorkspaceRoom } from '../types';

interface WorkspaceSelectionProps {
  user: UserProfile;
  onSelectRoom: (room: WorkspaceRoom) => void;
  onLogout: () => void;
}

const QUICK_TEMPLATES = [
  {
    label: '🐍 Python ML Sandbox',
    name: 'Python Algorithm & Pyodide Lab',
    desc: 'In-browser Python execution with real-time Yjs collaboration',
  },
  {
    label: '⚡ QuickJS Microservice',
    name: 'Distributed JS Engine',
    desc: 'Async JavaScript/TypeScript sandbox with AI debugging',
  },
];

export const WorkspaceSelection: React.FC<WorkspaceSelectionProps> = ({
  user,
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
          : 'Could not load workspaces from backend server.'
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

  const userInitials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-obsidian-glow bg-grid-pattern text-slate-200 flex flex-col overflow-y-auto">
      {/* Glassmorphic Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#090a0f]/80 backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white">
                  Nexathon<span className="text-indigo-400">IDE</span>
                </h1>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  Cloud Workspaces
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Select an active collaborative room or provision a new environment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#141824] px-3 py-1">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: user.color }}
              >
                {userInitials}
              </div>
              <span className="text-xs font-medium text-white">{user.name}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#141824] px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-white/20 hover:bg-[#1c2234] hover:text-white transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 p-6 space-y-6">
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchRooms()}
              className="rounded-md bg-rose-500/20 border border-rose-500/30 px-3 py-1 font-medium text-rose-200 hover:bg-rose-500/30 transition"
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (4 cols): Create & Join Cards */}
          <div className="lg:col-span-4 space-y-5">
            {/* Create Workspace Card */}
            <form
              onSubmit={(e) => void handleCreateRoom(e)}
              className="rounded-2xl border border-white/10 bg-[#0f121d]/90 p-5 shadow-xl backdrop-blur-md space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FolderPlus className="h-4 w-4 text-indigo-400" />
                  <span>New Workspace</span>
                </div>
                <Sparkles className="h-3.5 w-3.5 text-indigo-400/70" />
              </div>

              {/* Quick Starter Templates */}
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Quick Fill Template
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setNewRoomName(tpl.name);
                        setNewRoomDesc(tpl.desc);
                      }}
                      className="rounded-md border border-white/10 bg-[#141824] px-2.5 py-1 text-[11px] text-slate-300 hover:border-indigo-500/50 hover:bg-[#1c2234] hover:text-white transition cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g., Distributed Systems Lab"
                  className="w-full rounded-lg border border-white/10 bg-[#141824] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Python & JS real-time session"
                  className="w-full rounded-lg border border-white/10 bg-[#141824] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(99,102,241,0.35)] hover:bg-indigo-500 disabled:opacity-50 transition cursor-pointer"
              >
                {isCreating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <TerminalSquare className="h-4 w-4" />
                )}
                <span>Create & Launch IDE →</span>
              </button>
            </form>

            {/* Direct Join Card */}
            <form
              onSubmit={(e) => void handleJoinById(e)}
              className="rounded-2xl border border-white/10 bg-[#0f121d]/90 p-5 shadow-xl backdrop-blur-md space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Hash className="h-4 w-4 text-emerald-400" />
                <span>Join by Room ID</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Paste a shared workspace ID from a teammate to sync immediately.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  placeholder="e.g. room_98a7bc..."
                  className="flex-1 rounded-lg border border-white/10 bg-[#141824] px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-white/10 bg-[#1c2234] px-4 py-2 text-xs font-semibold text-white hover:border-indigo-500/50 hover:bg-indigo-600 transition cursor-pointer"
                >
                  Join
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (8 cols): Active Workspaces Grid */}
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-[#0f121d]/90 p-5 shadow-xl backdrop-blur-md flex flex-col min-h-[460px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold text-white">
                  Available Workspaces
                </h2>
                <span className="rounded-full bg-[#1c2234] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-indigo-300">
                  {rooms.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void fetchRooms()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#141824] px-2.5 py-1 text-xs text-slate-300 hover:bg-[#1c2234] hover:text-white transition cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`}
                />
                <span>Refresh</span>
              </button>
            </div>

            {isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-xs text-slate-400">
                <Loader2 className="h-7 w-7 animate-spin mb-3 text-indigo-400" />
                <span>Syncing workspace directory from PostgreSQL...</span>
              </div>
            ) : rooms.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#141824]/40 p-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <FolderGit2 className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  No Workspaces Found
                </h3>
                <p className="mt-1 max-w-xs text-xs text-slate-400">
                  Create your first collaborative workspace using the panel on the left or select a starter template.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto pr-1">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-white/10 bg-[#141824]/90 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:bg-[#1c2234]/90 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          <h3 className="font-semibold text-sm text-white group-hover:text-indigo-300 transition truncate">
                            {room.name}
                          </h3>
                        </div>
                        <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                          #{room.id.slice(0, 8)}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                        {room.description || 'Collaborative multi-file workspace with Yjs & Cloud Terminal.'}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {new Date(room.updatedAt || room.createdAt).toLocaleDateString()}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-[0_0_12px_rgba(99,102,241,0.4)] transition">
                        <span>Launch IDE</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
