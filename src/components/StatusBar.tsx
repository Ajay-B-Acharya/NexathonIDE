import React from 'react';
import {
  GitBranch,
  RotateCw,
  AlertCircle,
  Eye,
  X,
  Loader2,
  WifiOff,
} from 'lucide-react';
import { ConnectionStatus, FollowState } from '../types';
import { ThemeToggle, ThemeMode } from './ThemeToggle';

interface StatusBarProps {
  roomId: string;
  branch?: string;
  repositoryUrl?: string;
  primaryLanguage?: string;
  connectionStatus: ConnectionStatus;
  isDocumentSynced?: boolean;
  isRefreshing?: boolean;
  refreshStatus?: 'idle' | 'success' | 'error';
  onRefreshWorkspace?: () => void;
  onOpenDiagnostics?: () => void;
  followState?: FollowState | null;
  onStopFollowing?: () => void;
  cursorPosition?: { lineNumber: number; column: number } | null;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  roomId,
  branch,
  repositoryUrl,
  primaryLanguage,
  connectionStatus,
  isDocumentSynced = false,
  isRefreshing = false,
  refreshStatus = 'idle',
  onRefreshWorkspace,
  onOpenDiagnostics,
  followState,
  onStopFollowing,
  cursorPosition,
  theme,
  onToggleTheme,
}) => {
  const renderConnectionPill = () => {
    if (connectionStatus === 'connected' && isDocumentSynced) {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition cursor-default"
          title="Yjs CRDT Document Synchronized & Live"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
          <span>Live Sync</span>
        </div>
      );
    }

    if (connectionStatus === 'connected' && !isDocumentSynced) {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-amber-500 hover:bg-amber-500/10 transition cursor-default"
          title="Connecting to WebSocket, syncing CRDT document state..."
        >
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
          <span>Syncing Doc...</span>
        </div>
      );
    }

    if (connectionStatus === 'connecting') {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-amber-500 hover:bg-amber-500/10 transition cursor-default"
          title="Connecting to collaboration server..."
        >
          <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
          <span>Connecting...</span>
        </div>
      );
    }

    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium text-rose-500 hover:bg-rose-500/10 transition cursor-default"
        title="Disconnected from collaboration server"
      >
        <WifiOff className="h-3 w-3 text-rose-500" />
        <span>Offline</span>
      </div>
    );
  };

  return (
    <footer
      className="flex h-7 shrink-0 items-center justify-between border-t theme-border theme-bg-surface-1 px-3 select-none text-xs font-mono theme-text-secondary z-20 overflow-hidden"
      aria-label="Workspace Status Bar"
    >
      {/* Left: Branch, Connection Status, Diagnostics, Sync & Refresh, Language */}
      <div className="flex items-center gap-2 min-w-0">
        {branch && (
          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:theme-bg-surface-2 transition cursor-pointer text-[11px]"
            title={repositoryUrl ? `Git Remote: ${repositoryUrl}` : `Active Branch: ${branch}`}
          >
            <GitBranch className="h-3 w-3 text-[#FF7057] shrink-0" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[120px]">
              {branch}
            </span>
          </div>
        )}

        <div className="h-3.5 w-px bg-[var(--border)] opacity-60 shrink-0" />

        {renderConnectionPill()}

        {onOpenDiagnostics && connectionStatus !== 'connected' && (
          <button
            type="button"
            onClick={onOpenDiagnostics}
            title="Open Connection Diagnostics"
            className="inline-flex items-center gap-1 rounded bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-500 dark:text-rose-400 transition cursor-pointer animate-pulse shrink-0"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Diagnose</span>
          </button>
        )}

        {onRefreshWorkspace && (
          <button
            type="button"
            onClick={onRefreshWorkspace}
            disabled={isRefreshing}
            title="Sync & Refresh Workspace State (F5 / Ctrl+R)"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:theme-bg-surface-2 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-50 transition cursor-pointer text-[11px] shrink-0"
          >
            <RotateCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-[#FF7057]' : ''}`} />
            <span>{refreshStatus === 'success' ? 'Synced' : 'Sync'}</span>
          </button>
        )}

        {primaryLanguage && (
          <>
            <div className="h-3.5 w-px bg-[var(--border)] opacity-60 shrink-0 hidden sm:block" />
            <div
              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-[#FF7057] hover:theme-bg-surface-2 transition cursor-default shrink-0"
              title={`Project Primary Language: ${primaryLanguage}`}
            >
              {primaryLanguage}
            </div>
          </>
        )}
      </div>

      {/* Right: Follow State, Cursor Line/Col, Theme Toggle, Room Tag */}
      <div className="flex items-center gap-2 shrink-0">
        {followState && (
          <div
            className="inline-flex items-center gap-1.5 rounded bg-[#FF7057]/10 border border-[#FF7057]/30 px-2 py-0.5 text-[11px] text-[#FF7057] font-semibold animate-pulse shrink-0"
            title={`Following ${followState.targetUserName}'s viewport`}
          >
            <Eye className="h-3 w-3 text-[#FF7057]" />
            <span className="truncate max-w-[90px]">@{followState.targetUserName}</span>
            {onStopFollowing && (
              <button
                type="button"
                onClick={onStopFollowing}
                className="ml-0.5 rounded-full p-0.5 hover:bg-[#FF7057] hover:text-white transition cursor-pointer"
                title="Stop Following"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}

        {cursorPosition && (
          <span
            className="hidden md:inline-block px-2 py-0.5 rounded text-[11px] theme-text-muted hover:theme-text-primary transition cursor-default"
            title="Current Cursor Line & Column"
          >
            Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}
          </span>
        )}

        <div className="h-3.5 w-px bg-[var(--border)] opacity-60 shrink-0" />

        {theme && onToggleTheme && (
          <div className="shrink-0 flex items-center">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        )}

        <span
          className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] theme-text-muted opacity-60 truncate"
          title={`Room Session ID: ${roomId}`}
        >
          #{roomId.slice(0, 6)}
        </span>
      </div>
    </footer>
  );
};
