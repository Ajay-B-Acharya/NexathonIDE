import React, { useState } from 'react';
import {
  Play,
  Save,
  Sparkles,
  PanelLeft,
  Loader2,
  FolderGit2,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Check,
  Share2,
  Bot,
} from 'lucide-react';
import { CollaboratorPresence, UserProfile } from '../types';
import { Collaborators } from './Collaborators';

interface TopBarProps {
  roomName: string;
  roomId: string;
  user: UserProfile;
  collaborators: CollaboratorPresence[];
  isRunning: boolean;
  isSaving: boolean;
  saveStatus?: 'saved' | 'saving' | 'dirty' | 'error';
  hasUnsavedChanges: boolean;
  isExplorerOpen: boolean;
  onFollowCollaborator?: (userId: string, name: string, color: string, activeFile?: string) => void;
  onStopFollowing?: () => void;
  onToggleExplorer: () => void;
  onRunCode: () => void;
  onSaveFile: () => void;
  onOpenAIDebugger: () => void;
  isAgentSidebarOpen?: boolean;
  onToggleAgentSidebar?: () => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomName,
  roomId,
  user,
  collaborators,
  isRunning,
  isSaving,
  saveStatus = 'saved',
  hasUnsavedChanges,
  isExplorerOpen,
  onFollowCollaborator,
  onStopFollowing,
  onToggleExplorer,
  onRunCode,
  onSaveFile,
  onOpenAIDebugger,
  isAgentSidebarOpen = false,
  onToggleAgentSidebar,
  onSwitchWorkspace,
  onLogout,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b theme-border theme-bg-glass px-3 sm:px-4 backdrop-blur-md select-none z-20 transition-colors gap-3 overflow-hidden">
      {/* Left: Back/Exit, Explorer Toggle, Workspace Name */}
      <div className="flex items-center gap-2 shrink min-w-0">
        <button
          type="button"
          onClick={onSwitchWorkspace}
          title="Exit Workspace & Return to Dashboard"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 px-2.5 text-xs font-semibold theme-text-primary hover:border-[#FF7057]/50 hover:bg-[#FF7057]/10 hover:text-[#FF7057] transition cursor-pointer shrink-0 neu-button group shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Exit</span>
        </button>

        <button
          type="button"
          onClick={onToggleExplorer}
          title={`${isExplorerOpen ? 'Hide' : 'Show'} File Explorer (Ctrl+B)`}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition cursor-pointer shrink-0 shadow-2xs ${
            isExplorerOpen
              ? 'theme-bg-surface-2 text-[#FF7057] border theme-border font-bold'
              : 'theme-border border theme-bg-surface-2 theme-text-secondary hover:theme-text-primary hover:border-[#FF7057]/30'
          }`}
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Room / Workspace Selector Badge */}
        <button
          type="button"
          onClick={onSwitchWorkspace}
          title="Switch Workspace Room"
          className="group flex h-8 items-center gap-2 rounded-lg border theme-border theme-bg-surface-2 px-2.5 hover:border-[#FF7057]/50 hover:theme-bg-elevated transition cursor-pointer min-w-0 shadow-2xs"
        >
          <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-[#FF7057]" />
          <span className="text-xs font-bold theme-text-primary group-hover:text-[#FF7057] transition max-w-[140px] sm:max-w-[180px] md:max-w-[220px] truncate">
            {roomName}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 theme-text-secondary opacity-60" />
        </button>
      </div>

      {/* Middle: Save, Run, AI Debugger, AI Agent */}
      <div className="flex items-center gap-2 shrink-0 justify-center">
        {/* Save Active File Button */}
        <button
          type="button"
          onClick={onSaveFile}
          disabled={isSaving}
          title="Save Active File to Storage (Ctrl+S)"
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition cursor-pointer neu-button shadow-2xs shrink-0 ${
            saveStatus === 'error'
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-500 dark:text-rose-400'
              : saveStatus === 'saving' || isSaving
              ? 'border-[#FF7057]/30 bg-[#FF7057]/10 text-[#FF7057]'
              : hasUnsavedChanges || saveStatus === 'dirty'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
              : 'theme-border theme-bg-surface-2 theme-text-primary hover:border-[#FF7057]/40 hover:theme-bg-elevated'
          }`}
        >
          {isSaving || saveStatus === 'saving' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveStatus === 'saved' ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span>
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
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-pressed)] px-3.5 text-xs font-bold text-white disabled:opacity-50 transition cursor-pointer shadow-xs shrink-0"
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
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border theme-border theme-bg-surface-2 hover:border-[#FF7057] px-3 text-xs font-semibold text-[var(--accent-primary)] transition cursor-pointer shadow-2xs shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Debugger</span>
        </button>

        {/* Personal AI Agent Button */}
        {onToggleAgentSidebar && (
          <button
            type="button"
            onClick={onToggleAgentSidebar}
            title="Toggle Personal AI Coding Agent"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition cursor-pointer shadow-2xs shrink-0 ${
              isAgentSidebarOpen
                ? 'border-[#FF7057] bg-[#FF7057] text-white shadow-xs'
                : 'theme-border theme-bg-surface-2 hover:border-[#FF7057] text-[var(--accent-primary)]'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Agent</span>
          </button>
        )}
      </div>

      {/* Right: Share Button, Collaborator Avatars, Logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={handleCopyShareLink}
          title="Copy Live Collaboration URL to Clipboard"
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition cursor-pointer shadow-2xs shrink-0 ${
            copiedLink
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'theme-border theme-bg-surface-2 theme-text-secondary hover:theme-text-primary hover:border-[#FF7057] hover:theme-bg-elevated'
          }`}
        >
          {copiedLink ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share'}</span>
        </button>

        <Collaborators
          collaborators={collaborators}
          currentUserId={user.id}
          onFollowCollaborator={onFollowCollaborator}
          onStopFollowing={onStopFollowing}
        />

        <div className="h-5 w-px bg-[var(--border)] opacity-60 shrink-0" />

        <button
          type="button"
          onClick={onLogout}
          title={`Signed in as ${user.name} — Click to Sign Out`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border theme-border theme-bg-surface-2 text-xs theme-text-secondary hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer shadow-2xs shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
};
