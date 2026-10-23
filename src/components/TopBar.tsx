import React from 'react';
import {
  Play,
  Save,
  Sparkles,
  PanelLeft,
  WifiOff,
  Loader2,
  FolderGit2,
  LogOut,
  ChevronRight,
  RotateCw,
  Check,
  Shield,
  Eye,
} from 'lucide-react';
import { CollaboratorPresence, ConnectionStatus, FollowState, UserProfile } from '../types';
import { Collaborators } from './Collaborators';

interface TopBarProps {
  roomName: string;
  roomId: string;
  user: UserProfile;
  connectionStatus: ConnectionStatus;
  isDocumentSynced?: boolean;
  collaborators: CollaboratorPresence[];
  isRunning: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isExplorerOpen: boolean;
  isRefreshing?: boolean;
  refreshStatus?: 'idle' | 'success' | 'error';
  activeReservationsCount?: number;
  followState?: FollowState | null;
  onRefreshWorkspace?: () => void;
  onFollowCollaborator?: (userId: string, name: string, color: string) => void;
  onStopFollowing?: () => void;
  onToggleExplorer: () => void;
  onRunCode: () => void;
  onSaveFile: () => void;
  onOpenAIDebugger: () => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomName,
  roomId,
  user,
  connectionStatus,
  isDocumentSynced = false,
  collaborators,
  isRunning,
  isSaving,
  hasUnsavedChanges,
  isExplorerOpen,
  isRefreshing = false,
  refreshStatus = 'idle',
  activeReservationsCount = 0,
  followState,
  onRefreshWorkspace,
  onFollowCollaborator,
  onStopFollowing,
  onToggleExplorer,
  onRunCode,
  onSaveFile,
  onOpenAIDebugger,
  onSwitchWorkspace,
  onLogout,
}) => {
  const renderSyncRadarBadge = () => {
    if (connectionStatus === 'connected' && isDocumentSynced) {
      return (
        <div
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          title="Yjs Document Synchronized & Live"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Live Sync</span>
        </div>
      );
    }

    if (connectionStatus === 'connected' && !isDocumentSynced) {
      return (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-300"
          title="Connected to WebSocket, syncing CRDT document state..."
        >
          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          <span>Syncing Doc...</span>
        </div>
      );
    }

    if (connectionStatus === 'connecting') {
      return (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-[11px] font-medium text-amber-300"
          title="Connecting to collaboration server..."
        >
          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          <span>Connecting...</span>
        </div>
      );
    }

    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/40 px-2.5 py-1 text-[11px] font-medium text-rose-300"
        title="Disconnected from collaboration server"
      >
        <WifiOff className="h-3 w-3 text-rose-400" />
        <span>Offline</span>
      </div>
    );
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#090a0f]/85 px-3 backdrop-blur-md select-none z-20">
      {/* Left: Explorer Toggle, Workspace Switcher, Sync Badge & Reservations Badge */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleExplorer}
          title="Toggle File Explorer (Ctrl+B)"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer ${
            isExplorerOpen
              ? 'border-indigo-500/40 bg-[#1c2234] text-white shadow-[0_0_10px_rgba(99,102,241,0.15)]'
              : 'border-white/10 bg-[#141824] text-slate-400 hover:bg-[#1c2234] hover:text-white'
          }`}
        >
          <PanelLeft className="h-3.5 w-3.5" />
          <kbd className="hidden xl:inline-block rounded border border-white/10 bg-black/30 px-1 py-0.2 text-[9px] font-mono text-slate-400">
            ^B
          </kbd>
        </button>

        <button
          type="button"
          onClick={onSwitchWorkspace}
          title="Switch Workspace Room"
          className="group flex items-center gap-2 rounded-lg border border-white/10 bg-[#141824]/90 px-2.5 py-1 hover:border-indigo-500/40 hover:bg-[#1c2234] transition cursor-pointer"
        >
          <FolderGit2 className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-semibold text-white group-hover:text-indigo-200 transition max-w-[160px] truncate">
            {roomName}
          </span>
          <ChevronRight className="h-3 w-3 text-slate-500" />
          <span className="rounded bg-black/40 border border-white/5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            #{roomId.slice(0, 6)}
          </span>
        </button>

        {renderSyncRadarBadge()}

        {/* Edit Reservations Counter Pill */}
        {activeReservationsCount > 0 && (
          <div
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-300"
            title={`${activeReservationsCount} active code section reservation(s)`}
          >
            <Shield className="h-3 w-3 text-indigo-400" />
            <span>{activeReservationsCount} Reserved</span>
          </div>
        )}

        {/* Follow Mode Indicator Pill */}
        {followState && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300 animate-pulse"
            title={`Following ${followState.targetUserName}`}
          >
            <Eye className="h-3 w-3 text-cyan-400" />
            <span>Following {followState.targetUserName}</span>
            <button
              type="button"
              onClick={onStopFollowing}
              className="ml-1 text-cyan-400 hover:text-white underline text-[10px] cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Center: Command Bar Primary Actions */}
      <div className="flex items-center gap-2">
        {/* Safe Targeted Refresh Button */}
        <button
          type="button"
          onClick={onRefreshWorkspace}
          disabled={isRefreshing}
          title="Refresh Workspace Files & Reconcile Sync (Safe targeted refresh)"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50 ${
            refreshStatus === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : refreshStatus === 'error'
              ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
              : 'border-white/10 bg-[#141824] text-slate-300 hover:border-white/20 hover:bg-[#1c2234] hover:text-white'
          }`}
        >
          {isRefreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
          ) : refreshStatus === 'success' ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <RotateCw className="h-3.5 w-3.5 text-indigo-400" />
          )}
          <span>
            {isRefreshing
              ? 'Refreshing...'
              : refreshStatus === 'success'
              ? 'Refreshed'
              : 'Refresh'}
          </span>
        </button>

        {/* Save Action Button */}
        <button
          type="button"
          onClick={onSaveFile}
          disabled={isSaving}
          title="Save Active File to PostgreSQL (Ctrl+S)"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#141824] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-white/20 hover:bg-[#1c2234] hover:text-white disabled:opacity-50 transition cursor-pointer"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
          ) : (
            <Save className="h-3.5 w-3.5 text-indigo-400" />
          )}
          <span>Save</span>
          {hasUnsavedChanges && (
            <span
              className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
              title="Unsaved changes"
            />
          )}
          <kbd className="hidden md:inline-block rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            ⌘S
          </kbd>
        </button>

        {/* Run Code Button */}
        <button
          type="button"
          onClick={onRunCode}
          disabled={isRunning}
          title="Run Code in Browser Sandbox (Ctrl+Enter)"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          <span>{isRunning ? 'Running...' : 'Run Code'}</span>
          <kbd className="hidden md:inline-block rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[10px] font-mono text-emerald-100">
            ⌃↵
          </kbd>
        </button>

        {/* AI Debugger Button */}
        <button
          type="button"
          onClick={onOpenAIDebugger}
          title="Open AI Debugger & Diff Assistant"
          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] hover:from-purple-500 hover:to-indigo-500 transition cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-200" />
          <span className="hidden sm:inline">AI Debugger</span>
        </button>
      </div>

      {/* Right: Live Collaborator Avatars with Click-to-Follow & Logout */}
      <div className="flex items-center gap-3">
        <Collaborators
          collaborators={collaborators}
          currentUserId={user.id}
          followState={followState}
          onFollowCollaborator={onFollowCollaborator}
          onStopFollowing={onStopFollowing}
        />
        <div className="h-5 w-px bg-white/10" />
        <button
          type="button"
          onClick={onLogout}
          title={`Signed in as ${user.name} — Click to Sign Out`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#141824] p-1.5 text-xs text-slate-400 hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-300 transition cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
