import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Plus,
  History,
  Settings,
  PanelRightClose,
  Send,
  Square,
  RotateCcw,
  Paperclip,
  Terminal,
  FileCode,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Play,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { aiAgentApi } from '../services/aiAgentApi';
import { AIDiffViewer } from './AIDiffViewer';
import { AIAgentSettingsModal } from './AIAgentSettingsModal';
import type {
  UserProfile,
  WorkspaceFile,
  AIConversation,
  AIMessage,
  ProposedPatch,
  ProposedCommand,
  AIAgentContextPayload,
  AIAgentActivityStatus,
} from '../types';

interface AIAgentSidebarProps {
  roomId: string;
  roomName: string;
  user: UserProfile;
  activeFile: WorkspaceFile | null;
  files: WorkspaceFile[];
  selectedCode?: string;
  selectedRange?: { startLine: number; endLine: number };
  recentError?: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyPatch: (patch: ProposedPatch) => Promise<void>;
  onOpenFileInEditor?: (filePath: string) => void;
}

export const AIAgentSidebar: React.FC<AIAgentSidebarProps> = ({
  roomId,
  roomName,
  user,
  activeFile,
  files,
  selectedCode,
  selectedRange,
  recentError,
  isOpen,
  onClose,
  onApplyPatch,
  onOpenFileInEditor,
}) => {
  // State
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activityStatus, setActivityStatus] = useState<AIAgentActivityStatus>('idle');
  const [activityMessage, setActivityMessage] = useState<string>('');

  // Context attachment toggles
  const [attachActiveFile, setAttachActiveFile] = useState(true);
  const [attachSelection, setAttachSelection] = useState(Boolean(selectedCode));
  const [attachError, setAttachError] = useState(Boolean(recentError));

  // Drawers & Modals
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync attach selection when selectedCode changes
  useEffect(() => {
    if (selectedCode) {
      setAttachSelection(true);
    }
  }, [selectedCode]);

  useEffect(() => {
    if (recentError) {
      setAttachError(true);
    }
  }, [recentError]);

  // Load conversations list for this room & user
  const loadConversations = useCallback(async () => {
    try {
      const list = await aiAgentApi.listConversations(roomId, user.id);
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
      }
    } catch {}
  }, [roomId, user.id, activeConversationId]);

  useEffect(() => {
    if (isOpen) {
      void loadConversations();
    }
  }, [isOpen, loadConversations]);

  // Load messages whenever activeConversationId changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    aiAgentApi
      .getMessages(activeConversationId, user.id)
      .then((msgs) => {
        if (!isMounted) return;
        setMessages(msgs);
      })
      .catch(() => {
        if (!isMounted) return;
        setMessages([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeConversationId, user.id]);

  // Scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activityStatus]);

  // Handle creating a new conversation
  const handleNewConversation = async () => {
    try {
      const newConv = await aiAgentApi.createConversation(roomId, 'New Task', user.id);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setIsHistoryDrawerOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch {}
  };

  // Handle deleting a conversation
  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await aiAgentApi.deleteConversation(convId, user.id);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConversationId === convId) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch {}
  };

  // Send message
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt || isLoading) return;

    setInputText('');
    setIsLoading(true);
    setActivityStatus('thinking');
    setActivityMessage('Thinking...');

    // Build context payload
    const context: AIAgentContextPayload = {
      roomId,
      currentFilePath: attachActiveFile && activeFile ? activeFile.path : undefined,
      currentFileContent: attachActiveFile && activeFile ? activeFile.content : undefined,
      selectedCode: attachSelection && selectedCode ? selectedCode : undefined,
      selectedRange: attachSelection && selectedRange ? selectedRange : undefined,
      recentError: attachError && recentError ? recentError : undefined,
      openFilesList: files.map((f) => f.path),
      fileTree: files.map((f) => ({
        path: f.path,
        language: f.language,
        size: f.content.length,
      })),
    };

    // Optimistic user message in UI
    const tempUserMsg: AIMessage = {
      id: `temp_${Date.now()}`,
      conversationId: activeConversationId || 'temp',
      userId: user.id,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      setActivityStatus('reading_files');
      setActivityMessage('Analyzing project files and code context...');

      const response = await aiAgentApi.sendMessage(
        {
          roomId,
          conversationId: activeConversationId || undefined,
          prompt,
          context,
        },
        user.id
      );

      if (!activeConversationId && response.conversationId) {
        setActiveConversationId(response.conversationId);
        void loadConversations();
      }

      setMessages((prev) => [...prev, response.message]);
      setActivityStatus('completed');
      setActivityMessage('Completed.');
      setTimeout(() => setActivityStatus('idle'), 2000);
    } catch (err: any) {
      setActivityStatus('error');
      setActivityMessage(err?.message || 'Failed to complete agent turn');
      const errorAssistantMsg: AIMessage = {
        id: `err_${Date.now()}`,
        conversationId: activeConversationId || 'temp',
        userId: user.id,
        role: 'assistant',
        content: `Error: ${err?.message || 'AI request failed'}. Please check your AI Provider Settings.`,
        status: 'error',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorAssistantMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setActivityStatus('idle');
    setActivityMessage('');
  };

  // Execute an approved command
  const handleExecuteCommand = async (cmd: ProposedCommand, msgIndex: number) => {
    // Update command status to running
    setMessages((prev) => {
      const copy = [...prev];
      const m = copy[msgIndex];
      if (m?.proposedCommands) {
        m.proposedCommands = m.proposedCommands.map((c) =>
          c.id === cmd.id ? { ...c, status: 'running' } : c
        );
      }
      return copy;
    });

    setActivityStatus('running_command');
    setActivityMessage(`Running: ${cmd.command}`);

    try {
      const result = await aiAgentApi.executeCommand(
        {
          command: cmd.command,
          workingDir: cmd.workingDir,
        },
        user.id
      );

      setMessages((prev) => {
        const copy = [...prev];
        const m = copy[msgIndex];
        if (m?.proposedCommands) {
          m.proposedCommands = m.proposedCommands.map((c) =>
            c.id === cmd.id
              ? {
                  ...c,
                  status: result.exitCode === 0 ? 'completed' : 'failed',
                  output: result.stdout || result.stderr,
                  exitCode: result.exitCode,
                }
              : c
          );
        }
        return copy;
      });
      setActivityStatus('completed');
    } catch (err: any) {
      setMessages((prev) => {
        const copy = [...prev];
        const m = copy[msgIndex];
        if (m?.proposedCommands) {
          m.proposedCommands = m.proposedCommands.map((c) =>
            c.id === cmd.id
              ? {
                  ...c,
                  status: 'failed',
                  output: err?.message || 'Execution error',
                  exitCode: 1,
                }
              : c
          );
        }
        return copy;
      });
      setActivityStatus('error');
    } finally {
      setTimeout(() => setActivityStatus('idle'), 2500);
    }
  };

  // Reject a proposed command
  const handleRejectCommand = (cmd: ProposedCommand, msgIndex: number) => {
    setMessages((prev) => {
      const copy = [...prev];
      const m = copy[msgIndex];
      if (m?.proposedCommands) {
        m.proposedCommands = m.proposedCommands.map((c) =>
          c.id === cmd.id ? { ...c, status: 'rejected' } : c
        );
      }
      return copy;
    });
  };

  // Apply patch to workspace
  const handleApplyPatch = async (patch: ProposedPatch, msgIndex: number) => {
    setActivityStatus('preparing_patch');
    setActivityMessage(`Applying patch to ${patch.filePath}...`);

    await onApplyPatch(patch);

    // Update patch state in messages
    setMessages((prev) => {
      const copy = [...prev];
      const m = copy[msgIndex];
      if (m?.proposedPatches) {
        m.proposedPatches = m.proposedPatches.map((p) =>
          p.filePath === patch.filePath ? { ...p, status: 'applied' } : p
        );
      }
      return copy;
    });

    setActivityStatus('completed');
    setActivityMessage(`Patch applied to ${patch.filePath}. Synchronized via Yjs CRDT.`);
    setTimeout(() => setActivityStatus('idle'), 2500);
  };

  // Reject patch
  const handleRejectPatch = (patch: ProposedPatch, msgIndex: number) => {
    setMessages((prev) => {
      const copy = [...prev];
      const m = copy[msgIndex];
      if (m?.proposedPatches) {
        m.proposedPatches = m.proposedPatches.map((p) =>
          p.filePath === patch.filePath ? { ...p, status: 'rejected' } : p
        );
      }
      return copy;
    });
  };

  // Copy code block utility
  const handleCopyCode = (codeText: string, key: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(key);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Key down in input (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className="flex h-full w-full flex-col theme-bg-root theme-text-primary border-l theme-border select-none overflow-hidden relative"
      aria-label="Personal AI Coding Agent"
    >
      {/* 1. Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b theme-border px-3.5 theme-bg-surface-1">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF7057] text-white neu-button shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-xs theme-text-primary">
                Nexathon Agent
              </span>
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            </div>
            <span className="font-mono text-[10px] theme-text-muted leading-none">
              Private to @{user.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleNewConversation}
            title="Start New Conversation"
            className="p-1.5 rounded-lg border theme-border theme-bg-surface-2 hover:border-[#FF7057] theme-text-secondary hover:theme-text-primary transition cursor-pointer neu-button"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            title="Conversation History"
            className={`p-1.5 rounded-lg border theme-border transition cursor-pointer neu-button ${
              isHistoryDrawerOpen
                ? 'bg-[#FF7057] text-white'
                : 'theme-bg-surface-2 hover:border-[#FF7057] theme-text-secondary hover:theme-text-primary'
            }`}
          >
            <History className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="AI Provider Settings"
            className="p-1.5 rounded-lg border theme-border theme-bg-surface-2 hover:border-[#FF7057] theme-text-secondary hover:theme-text-primary transition cursor-pointer neu-button"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close AI Agent Sidebar"
            className="p-1.5 rounded-lg theme-text-muted hover:theme-text-primary transition cursor-pointer"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Conversation History Drawer Overlay */}
      {isHistoryDrawerOpen && (
        <div className="absolute top-12 left-0 right-0 z-30 max-h-72 overflow-y-auto border-b theme-border theme-bg-surface-1 p-2 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono theme-text-muted">
            <span>Your Private Conversations</span>
            <button
              type="button"
              onClick={handleNewConversation}
              className="text-[#FF7057] hover:underline cursor-pointer"
            >
              + New
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="p-3 text-center text-xs theme-text-muted">No previous conversations yet</div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setActiveConversationId(c.id);
                  setIsHistoryDrawerOpen(false);
                }}
                className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition ${
                  c.id === activeConversationId
                    ? 'bg-[#FF7057]/15 text-[#FF7057] font-semibold'
                    : 'hover:theme-bg-surface-2 theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <span className="truncate pr-2">{c.title || 'Conversation'}</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  title="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. Context Attachment Indicator Ribbon */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b theme-border theme-bg-surface-2/60 text-[10px] font-mono">
        <span className="theme-text-muted">Context:</span>

        {activeFile && (
          <button
            type="button"
            onClick={() => setAttachActiveFile(!attachActiveFile)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition cursor-pointer ${
              attachActiveFile
                ? 'border-[#FF7057]/40 bg-[#FF7057]/10 text-[#FF7057] font-semibold'
                : 'border-transparent theme-text-muted opacity-60'
            }`}
            title={attachActiveFile ? 'File attached to context' : 'Click to attach active file'}
          >
            <FileCode className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{activeFile.name}</span>
          </button>
        )}

        {selectedCode && (
          <button
            type="button"
            onClick={() => setAttachSelection(!attachSelection)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition cursor-pointer ${
              attachSelection
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-semibold'
                : 'border-transparent theme-text-muted opacity-60'
            }`}
            title="Selection range attached"
          >
            <span>Sel ({selectedRange?.startLine || '?'}-{selectedRange?.endLine || '?'})</span>
          </button>
        )}

        {recentError && (
          <button
            type="button"
            onClick={() => setAttachError(!attachError)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition cursor-pointer ${
              attachError
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-500 font-semibold'
                : 'border-transparent theme-text-muted opacity-60'
            }`}
            title="Error traceback attached"
          >
            <AlertCircle className="h-3 w-3" />
            <span>Error</span>
          </button>
        )}

        <span className="ml-auto theme-text-muted truncate max-w-[100px]" title={`Room: ${roomName}`}>
          {roomName}
        </span>
      </div>

      {/* 3. Real Agent Activity Status Banner */}
      {activityStatus !== 'idle' && (
        <div className="flex items-center justify-between px-3.5 py-1.5 bg-black/[0.03] dark:bg-white/[0.03] border-b theme-border text-xs">
          <div className="flex items-center gap-2">
            {activityStatus === 'completed' ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : activityStatus === 'error' ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
            ) : (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF7057]" />
            )}
            <span className="font-medium theme-text-secondary text-[11px]">
              {activityMessage || 'Working...'}
            </span>
          </div>

          {isLoading && (
            <button
              type="button"
              onClick={handleStopGeneration}
              className="text-[10px] font-mono text-rose-500 hover:underline cursor-pointer"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* 4. Conversation Message Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 select-text">
        {messages.length === 0 && !isLoading && (
          <div className="py-10 text-center space-y-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF7057]/15 text-[#FF7057] neu-card">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm theme-text-primary">
                Personal Autonomous Coding Agent
              </h4>
              <p className="mx-auto mt-1 max-w-xs text-xs theme-text-secondary leading-relaxed">
                Ask questions about this project, debug runtime errors, and propose reviewable diff patches.
              </p>
            </div>

            {/* Quick Prompt Starter Chips */}
            <div className="flex flex-col gap-1.5 pt-2 max-w-xs mx-auto text-left">
              <button
                type="button"
                onClick={() => void handleSendMessage('Explain the architecture and main functions in the current file.')}
                className="p-2 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057] text-xs theme-text-secondary hover:theme-text-primary transition cursor-pointer text-left"
              >
                💡 Explain active file architecture
              </button>
              {recentError && (
                <button
                  type="button"
                  onClick={() => void handleSendMessage(`Investigate and fix this runtime error:\n${recentError}`)}
                  className="p-2 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:border-rose-500 text-xs text-rose-500 transition cursor-pointer text-left"
                >
                  ⚡ Diagnose and patch recent runtime fault
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSendMessage('Review the code for potential bugs, edge cases, and type safety.')}
                className="p-2 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057] text-xs theme-text-secondary hover:theme-text-primary transition cursor-pointer text-left"
              >
                🔍 Audit code for edge-case faults
              </button>
              <button
                type="button"
                onClick={() => void handleSendMessage('Check test suites or run tests to verify implementation.')}
                className="p-2 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057] text-xs theme-text-secondary hover:theme-text-primary transition cursor-pointer text-left"
              >
                🧪 Propose test run command
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';

          return (
            <div key={msg.id || idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              {/* Message Originator Label */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono theme-text-muted">
                {isUser ? (
                  <>
                    <span className="font-semibold text-right">@{user.name}</span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: user.color || '#FF7057' }}
                    />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-[#FF7057]" />
                    <span className="font-semibold">Nexathon Agent</span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-[#FF7057] text-white rounded-tr-none shadow-xs'
                    : 'border theme-border theme-bg-surface-1 theme-text-primary rounded-tl-none neu-card'
                }`}
              >
                {/* Content rendering */}
                <div className="whitespace-pre-wrap font-sans break-words">{msg.content}</div>

                {/* Inline Proposed Patches with Diff Viewer */}
                {msg.proposedPatches && msg.proposedPatches.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {msg.proposedPatches.map((patch, pIdx) => {
                      const fileRecord = files.find((f) => f.path === patch.filePath);
                      const currentContent = fileRecord ? fileRecord.content : '';

                      return (
                        <AIDiffViewer
                          key={`${patch.filePath}_${pIdx}`}
                          patch={patch}
                          currentFileContent={currentContent}
                          onApply={(p) => handleApplyPatch(p, idx)}
                          onReject={(p) => handleRejectPatch(p, idx)}
                          onViewInEditor={onOpenFileInEditor}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Inline Proposed Terminal Commands */}
                {msg.proposedCommands && msg.proposedCommands.length > 0 && (
                  <div className="mt-3 space-y-2.5">
                    {msg.proposedCommands.map((cmd) => (
                      <div
                        key={cmd.id}
                        className="rounded-xl border theme-border theme-bg-surface-2 p-3 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between border-b theme-border pb-1.5">
                          <span className="font-mono text-[10px] uppercase font-bold text-[#FF7057] flex items-center gap-1">
                            <Terminal className="h-3 w-3" /> Proposed Command
                          </span>
                          <span className="font-mono text-[10px] theme-text-muted">
                            dir: {cmd.workingDir}
                          </span>
                        </div>

                        <div className="font-mono text-[11px] p-2 rounded-lg bg-black/10 dark:bg-black/50 theme-text-primary flex items-center justify-between">
                          <code>$ {cmd.command}</code>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(cmd.command, cmd.id)}
                            className="p-1 theme-text-muted hover:theme-text-primary cursor-pointer"
                          >
                            {copiedCodeIndex === cmd.id ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {cmd.reason && (
                          <p className="text-[11px] theme-text-secondary">{cmd.reason}</p>
                        )}

                        {/* Terminal Command Output Block */}
                        {cmd.output && (
                          <div className="mt-2 rounded-lg bg-black/20 dark:bg-black/80 p-2 font-mono text-[10px] max-h-36 overflow-y-auto">
                            <div className="theme-text-muted mb-1">
                              Exit code: {cmd.exitCode ?? 0}
                            </div>
                            <pre className="whitespace-pre-wrap text-emerald-400">
                              {cmd.output}
                            </pre>
                          </div>
                        )}

                        {/* Command Approval Buttons */}
                        {cmd.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleRejectCommand(cmd, idx)}
                              className="px-2.5 py-1 rounded-lg border theme-border hover:theme-bg-surface-1 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExecuteCommand(cmd, idx)}
                              className="px-3 py-1 rounded-lg bg-[#FF7057] hover:bg-[#F26049] text-white text-[11px] font-semibold flex items-center gap-1.5 neu-button transition cursor-pointer"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>Approve &amp; Run</span>
                            </button>
                          </div>
                        )}
                        {cmd.status === 'running' && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#FF7057] font-mono">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Executing command in environment...</span>
                          </div>
                        )}
                        {cmd.status === 'completed' && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 font-semibold">
                            <Check className="h-3 w-3" /> Execution Finished
                          </div>
                        )}
                        {cmd.status === 'failed' && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-rose-500 font-semibold">
                            <AlertCircle className="h-3 w-3" /> Command Returned Non-Zero Exit Code
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. Composer Area */}
      <div className="border-t theme-border p-3 theme-bg-surface-1 space-y-2 shrink-0">
        <div className="relative rounded-xl border theme-border theme-bg-surface-2 focus-within:border-[#FF7057] transition-all">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeFile
                ? `Ask agent about ${activeFile.name}... (Enter to send, Shift+Enter for newline)`
                : 'Ask agent to inspect, fix, or code... (Enter to send)'
            }
            rows={2}
            className="w-full resize-none bg-transparent p-2.5 text-xs theme-text-primary focus:outline-none placeholder:text-[var(--text-muted)] leading-relaxed"
          />

          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="text-[10px] font-mono theme-text-muted">
              Shift + Enter for new line
            </span>

            <div className="flex items-center gap-1.5">
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  title="Stop generation"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white transition cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!inputText.trim()}
                  title="Send to AI Agent (Enter)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF7057] hover:bg-[#F26049] text-white disabled:opacity-40 transition cursor-pointer neu-button"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal AI Settings Modal */}
      <AIAgentSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={user.id}
      />
    </aside>
  );
};
