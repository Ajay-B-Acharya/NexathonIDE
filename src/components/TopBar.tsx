import React, { useState } from 'react';
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
  RotateCw,
  Check,
  Eye,
  Share2,
  AlertCircle,
  X,
} from 'lucide-react';
import { CollaboratorPresence, ConnectionStatus, FollowState, UserProfile } from '../types';
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
  saveStatus?: 'saved' | 'saving' | 'dirty' | 'error';
  hasUnsavedChanges: boolean;
  isExplorerOpen: boolean;
  isRefreshing?: boolean;
  refreshStatus?: 'idle' | 'success' | 'error';
  followState?: FollowState | null;
  onRefreshWorkspace?: () => void;
  onFollowCollaborator?: (userId: string, name: string, color: string, activeFile?: string) => void;
  onStopFollowing?: () => void;
  onToggleExplorer: () => void;
  onRunCode: () => void;
  onSaveFile: () => void;
  onOpenAIDebugger: () => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
  onOpenDiagnostics?: () => void;
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
  saveStatus = 'saved',
  hasUnsavedChanges,
  isExplorerOpen,
  isRefreshing = false,
  refreshStatus = 'idle',
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
  onOpenDiagnostics,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const renderConnectionStatus = () => {
    if (connectionStatus === 'connected' && isDocumentSynced) {
      return (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
          title="Yjs Document Synchronized & Live"
        >
          <span className="relative flex h-2 w-2">
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
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
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
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
          <span>Connecting...</span>
        </div>
      );
    }

    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-500"
        title="Disconnected from collaboration server"
      >
        <WifiOff className="h-3 w-3 text-rose-500" />
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
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Exit</span>
        </button>

        <button
          type="button"
          onClick={onToggleExplorer}
          title={`${isExplorerOpen ? 'Hide' : 'Show'} File Explorer (Ctrl+B)`}
          className={`rounded-lg p-1.5 transition cursor-pointer shrink-0 ${
            isExplorerOpen
              ? 'theme-bg-surface-2 text-indigo-500 dark:text-indigo-400 border theme-border'
              : 'theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2'
          }`}
        >
          <PanelLeft className="h-4 w-4" />
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

        {renderConnectionStatus()}

        {onRefreshWorkspace && (
          <button
            type="button"
            onClick={onRefreshWorkspace}
            disabled={isRefreshing}
            title="Sync & Refresh Workspace State (F5 / Ctrl+R)"
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 px-2 py-1 text-xs font-medium theme-text-secondary hover:theme-text-primary hover:theme-bg-elevated disabled:opacity-50 transition cursor-pointer"
          >
            <RotateCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
            <span className="text-[11px]">{refreshStatus === 'success' ? 'Synced' : 'Sync'}</span>
          </button>
        )}

        {onOpenDiagnostics && connectionStatus !== 'connected' && (
          <button
            type="button"
            onClick={onOpenDiagnostics}
            title="Open Connection Diagnostics"
            className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer animate-pulse"
          >
            <AlertCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Diagnose</span>
          </button>
        )}
      </div>

      {/* Middle: Save, Run, AI Debugger & Share Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Save Active File Button */}
        <button
          type="button"
          onClick={onSaveFile}
          disabled={isSaving}
          title="Save Active File to Storage (Ctrl+S)"
          className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition cursor-pointer shadow-xs ${
            saveStatus === 'error'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-500 dark:text-rose-400'
              : saveStatus === 'saving' || isSaving
              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
              : hasUnsavedChanges || saveStatus === 'dirty'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'theme-border theme-bg-surface-2 theme-text-primary hover:border-indigo-500/30 hover:theme-bg-elevated'
          }`}
        >
          {isSaving || saveStatus === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveStatus === 'saved' ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isSaving || saveStatus === 'saving'
              ? 'Saving...'
              : saveStatus === 'error'
              ? 'Save Failed'
              : hasUnsavedChanges || saveStatus === 'dirty'
              ? 'Save'
              : 'Saved'}
          </span>
          {hasUnsavedChanges && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        {/* Run Code Button */}
        <button
          type="button"
          onClick={onRunCode}
          disabled={isRunning}
          title="Run Code in Sandbox (Ctrl+Enter)"
          className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          <span>Run</span>
        </button>

        {/* AI Debugger Button */}
        <button
          type="button"
          onClick={onOpenAIDebugger}
          title="Open AI Debugger & AST Assistant"
          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/30 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.35)] hover:from-purple-500 hover:to-indigo-500 transition cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI Debugger</span>
        </button>

        {/* 1-Click Share & Invite Button */}
        <button
          type="button"
          onClick={handleCopyShareLink}
          title="Copy Live Collaboration URL to Clipboard"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-medium transition cursor-pointer shadow-xs ${
            copiedLink
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'theme-border theme-bg-surface-2 theme-text-secondary hover:theme-text-primary hover:border-indigo-500/30 hover:theme-bg-elevated'
          }`}
        >
          {copiedLink ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share'}</span>
        </button>
      </div>

      {/* Right: Live Collaborator Avatars with Click-to-Follow, Theme Toggle & Logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Collaborators
          collaborators={collaborators}
          currentUserId={user.id}
          followState={followState}
          onFollowCollaborator={onFollowCollaborator}
          onStopFollowing={onStopFollowing}
        />

        {followState && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-1 text-xs text-teal-600 dark:text-teal-300 animate-pulse"
            title={`Following ${followState.targetUserName}`}
          >
            <Eye className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" />
            <span className="max-w-[80px] truncate text-[11px] font-medium">
              @{followState.targetUserName}
            </span>
            <button
              type="button"
              onClick={onStopFollowing}
              className="ml-0.5 rounded p-0.5 text-teal-500 dark:text-teal-400 hover:text-white hover:bg-teal-800/40 transition cursor-pointer"
              title="Stop Following"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

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
