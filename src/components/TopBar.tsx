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
  ArrowLeft,
} from 'lucide-react';
import { CollaboratorPresence, ConnectionStatus, UserProfile } from '../types';
import { Collaborators } from './Collaborators';
import { ThemeToggle, ThemeMode } from './ThemeToggle';

interface TopBarProps {
  roomName: string;
  roomId: string;
  user: UserProfile;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
  connectionStatus: ConnectionStatus;
  isDocumentSynced?: boolean;
  collaborators: CollaboratorPresence[];
  isRunning: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  isExplorerOpen: boolean;
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
  theme,
  onToggleTheme,
  connectionStatus,
  isDocumentSynced = false,
  collaborators,
  isRunning,
  isSaving,
  hasUnsavedChanges,
  isExplorerOpen,
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
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
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
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-500"
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
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-500"
          title="Connecting to collaboration server..."
        >
          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          <span>Connecting...</span>
        </div>
      );
    }

    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-500"
        title="Disconnected from collaboration server"
      >
        <WifiOff className="h-3 w-3 text-rose-400" />
        <span>Offline</span>
      </div>
    );
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b theme-border theme-bg-glass px-3 backdrop-blur-md select-none z-20 transition-colors gap-2">
      {/* Left: Back/Exit, Explorer Toggle, Workspace Switcher & Radar Sync Badge */}
      <div className="flex items-center gap-2 shrink min-w-0">
        {/* Prominent Back / Exit to Dashboard Button */}
        <button
          type="button"
          onClick={onSwitchWorkspace}
          title="Exit Workspace & Return to Dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 px-2.5 py-1.5 text-xs font-semibold theme-text-primary hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer shrink-0 shadow-xs group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 text-indigo-500 dark:text-indigo-400" />
          <span className="font-semibold">Exit</span>
        </button>

        <div className="h-4 w-px theme-border shrink-0" />

        <button
          type="button"
          onClick={onToggleExplorer}
          title="Toggle File Explorer (Ctrl+B)"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition cursor-pointer shrink-0 ${
            isExplorerOpen
              ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 font-semibold shadow-xs'
              : 'theme-border theme-bg-surface-2 theme-text-secondary hover:theme-bg-elevated hover:theme-text-primary'
          }`}
        >
          <PanelLeft className="h-3.5 w-3.5" />
          <kbd className="hidden 2xl:inline-block rounded border theme-border theme-bg-surface-1 px-1 py-0.2 text-[9px] font-mono theme-text-secondary">
            ^B
          </kbd>
        </button>

        <button
          type="button"
          onClick={onSwitchWorkspace}
          title="Switch Workspace Room"
          className="group flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 px-2.5 py-1 hover:border-indigo-500/40 hover:theme-bg-elevated transition cursor-pointer min-w-0"
        >
          <FolderGit2 className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
          <span className="text-xs font-semibold theme-text-primary group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition max-w-[100px] sm:max-w-[150px] truncate">
            {roomName}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 theme-text-secondary opacity-60" />
          <span className="hidden sm:inline-block shrink-0 rounded border theme-border theme-bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono theme-text-secondary">
            #{roomId.slice(0, 6)}
          </span>
        </button>

        <div className="shrink-0">
          {renderSyncRadarBadge()}
        </div>
      </div>

      {/* Center: Command Bar Primary Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Save Action Button */}
        <button
          type="button"
          onClick={onSaveFile}
          disabled={isSaving}
          title="Save Active File to PostgreSQL (Ctrl+S)"
          className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border theme-border theme-bg-surface-2 px-2.5 sm:px-3 py-1.5 text-xs font-medium theme-text-primary hover:border-indigo-500/30 hover:theme-bg-elevated disabled:opacity-50 transition cursor-pointer shadow-xs"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 dark:text-indigo-400" />
          ) : (
            <Save className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
          )}
          <span className="hidden sm:inline">Save</span>
          {hasUnsavedChanges && (
            <span
              className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
              title="Unsaved changes"
            />
          )}
          <kbd className="hidden md:inline-block rounded border theme-border theme-bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono theme-text-secondary">
            ⌘S
          </kbd>
        </button>

        {/* Run Code Button */}
        <button
          type="button"
          onClick={onRunCode}
          disabled={isRunning}
          title="Run Code in Browser Sandbox (Ctrl+Enter)"
          className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          <span>{isRunning ? 'Running...' : 'Run Code'}</span>
          <kbd className="hidden md:inline-block rounded border border-white/20 bg-black/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-100">
            ⌃↵
          </kbd>
        </button>

        {/* AI Debugger Button */}
        <button
          type="button"
          onClick={onOpenAIDebugger}
          title="Open AI Debugger & Diff Assistant"
          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] hover:from-purple-500 hover:to-indigo-500 transition cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-200" />
          <span className="hidden sm:inline">AI Debugger</span>
        </button>
      </div>

      {/* Right: Live Collaborator Avatars, Theme Toggle & Logout */}
      <div className="flex items-center gap-2 shrink-0">
        <Collaborators collaborators={collaborators} currentUserId={user.id} />
        
        {theme && onToggleTheme && (
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        )}

        <div className="h-5 w-px theme-border" />

        <button
          type="button"
          onClick={onLogout}
          title={`Signed in as ${user.name} — Click to Sign Out`}
          className="inline-flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 p-1.5 text-xs theme-text-secondary hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer shadow-xs shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
