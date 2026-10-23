import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type * as Monaco from 'monaco-editor';
import { Terminal, Play, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { ThemeMode } from '../components/ThemeToggle';
import { FileExplorer } from '../components/FileExplorer';
import { EditorPane } from '../components/EditorPane';
import { OutputPanel } from '../components/OutputPanel';
import { TerminalPanel } from '../components/TerminalPanel';
import { AIDebuggerPanel } from '../components/AIDebuggerPanel';
import { ConfirmModal } from '../components/ConfirmModal';
import { ConnectionDiagnosticsModal } from '../components/ConnectionDiagnosticsModal';
import { workspaceApi, detectLanguageFromPath } from '../services/workspaceApi';
import { executionClient } from '../services/executionClient';
import { useCollaborativeEditor } from '../hooks/useCollaborativeEditor';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useResizablePanel } from '../hooks/useResizablePanel';
import {
  getStoredWorkspaceUI,
  saveStoredWorkspaceUI,
  getFileDraft,
  saveFileDraft,
  clearFileDraft,
} from '../services/refreshEngine';
import {
  BottomTabType,
  ExecutionResult,
  SupportedLanguage,
  UserProfile,
  WorkspaceFile,
  WorkspaceRoom,
} from '../types';

interface WorkspaceProps {
  room: WorkspaceRoom;
  user: UserProfile;
  theme?: ThemeMode;
  onToggleTheme?: (theme: ThemeMode) => void;
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  room,
  user,
  theme = 'dark',
  onToggleTheme,
  onSwitchWorkspace,
  onLogout,
}) => {
  const initialSavedUI = useMemo(() => getStoredWorkspaceUI(room.id), [room.id]);

  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(() => new Set());
  const [dbContentSnapshot, setDbContentSnapshot] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');

  const [isExplorerOpen, setIsExplorerOpen] = useState(() => initialSavedUI?.isExplorerOpen ?? true);
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(() => initialSavedUI?.isBottomDrawerOpen ?? true);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabType>(() => initialSavedUI?.activeBottomTab ?? 'output');

  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [aiErrorSeed, setAiErrorSeed] = useState<string>('');

  const [filePendingDelete, setFilePendingDelete] = useState<WorkspaceFile | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const [editorInstance, setEditorInstance] =
    useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<typeof Monaco | null>(null);

  const autosaveTimerRef = useRef<Record<string, number>>({});
  const latestContentRef = useRef<Record<string, string>>({});

  const sidebarResize = useResizablePanel({
    initialSize: 260,
    minSize: 180,
    maxSize: 480,
    direction: 'horizontal',
  });

  const bottomDrawerResize = useResizablePanel({
    initialSize: 250,
    minSize: 120,
    maxSize: 520,
    direction: 'vertical',
    invert: true,
  });

  const activeFile = files.find((f) => f.id === activeFileId) || null;
  const openFiles = openFileIds
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is WorkspaceFile => Boolean(f));

  // Sync workspace UI layout and open tabs into persistent storage
  useEffect(() => {
    saveStoredWorkspaceUI(room.id, {
      openFileIds,
      activeFileId,
      activeBottomTab,
      isBottomDrawerOpen,
      isExplorerOpen,
    });
  }, [room.id, openFileIds, activeFileId, activeBottomTab, isBottomDrawerOpen, isExplorerOpen]);

  // Load files on room initial mount
  useEffect(() => {
    let isMounted = true;
    const loadWorkspaceFiles = async () => {
      try {
        const fetched = await workspaceApi.listFiles(room.id);
        if (!isMounted) return;

        const snapshots: Record<string, string> = {};
        const dirtySet = new Set<string>();
        fetched.forEach((f) => {
          snapshots[f.id] = f.content;
          latestContentRef.current[f.id] = f.content;
        });

        const filesWithDrafts = fetched.map((file) => {
          snapshots[file.id] = file.content;
          const draft = getFileDraft(room.id, file.id);
          if (draft !== null && draft !== file.content) {
            dirtySet.add(file.id);
            return { ...file, content: draft };
          }
          return file;
        });

        setFiles(filesWithDrafts);
        setDbContentSnapshot(snapshots);
        setDirtyFileIds(dirtySet);

        if (filesWithDrafts.length > 0) {
          const validOpen = initialSavedUI?.openFileIds?.filter((id) =>
            filesWithDrafts.some((f) => f.id === id)
          );

          if (validOpen && validOpen.length > 0) {
            setOpenFileIds(validOpen);
            const activeValid = Boolean(
              initialSavedUI?.activeFileId && validOpen.includes(initialSavedUI.activeFileId)
            );
            setActiveFileId(
              activeValid && initialSavedUI?.activeFileId
                ? initialSavedUI.activeFileId
                : validOpen[0]
            );
          } else {
            setOpenFileIds([filesWithDrafts[0].id]);
            setActiveFileId(filesWithDrafts[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load workspace files:', err);
      }
    };

    void loadWorkspaceFiles();
    return () => {
      isMounted = false;
      Object.values(autosaveTimerRef.current).forEach((timerId) =>
        window.clearTimeout(timerId)
      );
    };
  }, [room.id, initialSavedUI]);

  // Periodic peer file list reconciliation (detects files added/deleted by peers without manual refresh)
  useEffect(() => {
    const syncInterval = window.setInterval(async () => {
      try {
        const latest = await workspaceApi.listFiles(room.id);
        setFiles((current) => {
          // If length or file IDs changed, update file list while preserving local dirty edits
          const currentIds = new Set(current.map((f) => f.id));
          const latestIds = new Set(latest.map((f) => f.id));
          const hasChanges =
            current.length !== latest.length ||
            latest.some((f) => !currentIds.has(f.id)) ||
            current.some((f) => !latestIds.has(f.id));

          if (!hasChanges) return current;

          return latest.map((lf) => ({
            ...lf,
            content: latestContentRef.current[lf.id] ?? lf.content,
          }));
        });
      } catch {
        // Ignore background polling errors
      }
    }, 4000);

    return () => window.clearInterval(syncInterval);
  }, [room.id]);

  // Reliable Save with Exponential Backoff Retries
  const scheduleSaveWithRetry = useCallback(
    async (fileId: string, contentToSave: string, attempt = 1): Promise<void> => {
      setSaveStatus('saving');
      setIsSaving(true);
      try {
        const targetFile = files.find((f) => f.id === fileId);
        const filePath = targetFile?.path || fileId;
        const fileName = targetFile?.name || filePath.split('/').pop() || filePath;
        const fileLang = targetFile?.language || 'javascript';

        await workspaceApi.updateFile(room.id, fileId, {
          content: contentToSave,
          path: filePath,
          name: fileName,
          language: fileLang,
        });
clearFileDraft(room.id, fileId);
        setDbContentSnapshot((prev) => ({
          ...prev,
          [fileId]: contentToSave,
        }));

        setDirtyFileIds((prev) => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });

        setFiles((prevFiles) =>
          prevFiles.map((file) =>
            file.id === fileId ? { ...file, content: contentToSave } : file
          )
        );

        setSaveStatus('saved');
      } catch (err) {
        console.error(`Save attempt ${attempt} failed for file ${fileId}:`, err);
        if (attempt < 3) {
          const backoff = attempt * 600;
          setTimeout(() => {
            void scheduleSaveWithRetry(fileId, contentToSave, attempt + 1);
          }, backoff);
        } else {
          setSaveStatus('error');
        }
      } finally {
        setIsSaving(false);
      }
    },
    [room.id, files]
  );

  // Flush any pending debounced autosaves immediately
  const flushAutosave = useCallback(
    async (fileId?: string) => {
      const targetIds = fileId ? [fileId] : Object.keys(autosaveTimerRef.current);
      for (const id of targetIds) {
        if (autosaveTimerRef.current[id]) {
          window.clearTimeout(autosaveTimerRef.current[id]);
          delete autosaveTimerRef.current[id];
          const content = latestContentRef.current[id];
          if (content !== undefined && (dbContentSnapshot[id] ?? '') !== content) {
            await scheduleSaveWithRetry(id, content);
          }
        }
      }
    },
    [dbContentSnapshot, scheduleSaveWithRetry]
  );

  // Flush on page unload / refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushAutosave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushAutosave]);

  // High-performance Collaborative Content Change Handler
  const handleCollaborativeContentChange = useCallback(
    (fileId: string, newContent: string) => {
      latestContentRef.current[fileId] = newContent;

      saveFileDraft(room.id, fileId, newContent);

      setDirtyFileIds((prev) => {
        const isDirty = (dbContentSnapshot[fileId] ?? '') !== newContent;
        if (prev.has(fileId) === isDirty) return prev;
        const next = new Set(prev);
        if (isDirty) next.add(fileId);
        else next.delete(fileId);
        return next;
      });

      setSaveStatus('dirty');

      if (autosaveTimerRef.current[fileId]) {
        window.clearTimeout(autosaveTimerRef.current[fileId]);
      }

      // Fast 800ms autosave debounce (non-blocking)
      autosaveTimerRef.current[fileId] = window.setTimeout(() => {
        const currentContent = latestContentRef.current[fileId] ?? newContent;
        if ((dbContentSnapshot[fileId] ?? '') !== currentContent) {
          void scheduleSaveWithRetry(fileId, currentContent);
        }
      }, 800);
    },
    [dbContentSnapshot, scheduleSaveWithRetry]
  );

  // Cross-file Follow Mode switch handler
  const handleFollowFileChange = useCallback(
    (targetFilePath: string) => {
      const cleanTarget = targetFilePath.replace(/^\/+/, '');
      const target = files.find(
        (f) =>
          f.path.replace(/^\/+/, '') === cleanTarget ||
          cleanTarget.endsWith(f.path.replace(/^\/+/, ''))
      );
      if (target && target.id !== activeFileId) {
        setActiveFileId(target.id);
        if (!openFileIds.includes(target.id)) {
          setOpenFileIds((prev) => [...prev, target.id]);
        }
      }
    },
    [files, activeFileId, openFileIds]
  );

  const {
    connectionStatus,
    isDocumentSynced,
    collaborators,
    reservations,
    followState,
    reserveLines,
    releaseReservation,
    updateReservationRange,
    startFollowing,
    stopFollowing,
    reconcileSession,
    applyContentToSharedDoc,
  } = useCollaborativeEditor({
    roomId: room.id,
    activeFile,
    user,
    editorInstance,
    monacoInstance,
    onContentChange: handleCollaborativeContentChange,
    onFollowFileChange: handleFollowFileChange,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleRefreshWorkspace = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshStatus('idle');

    try {
      // 1. Refresh file metadata from API without discarding local dirty edits
      const latestFiles = await workspaceApi.listFiles(room.id);
      setFiles((currentFiles) => {
        const dirtyMap = new Map<string, string>();
        currentFiles.forEach((f) => {
          if (dirtyFileIds.has(f.id)) {
            dirtyMap.set(f.id, latestContentRef.current[f.id] ?? f.content);
          }
        });

        return latestFiles.map((f) => ({
          ...f,
          content: dirtyMap.has(f.id) ? dirtyMap.get(f.id)! : f.content,
        }));
      });

      // 2. Reconcile Yjs session and provider connection
      reconcileSession();

      setRefreshStatus('success');
      setTimeout(() => setRefreshStatus('idle'), 2500);
    } catch (err) {
      console.error('Workspace refresh notice:', err);
      setRefreshStatus('error');
      setTimeout(() => setRefreshStatus('idle'), 3000);
    } finally {
      setIsRefreshing(false);
    }
  }, [room.id, isRefreshing, dirtyFileIds, reconcileSession]);

  const handleExplicitSave = useCallback(() => {
    if (!activeFile) return;
    const content = latestContentRef.current[activeFile.id] ?? activeFile.content;
    void scheduleSaveWithRetry(activeFile.id, content);
  }, [activeFile, scheduleSaveWithRetry]);

  const handleRunCode = useCallback(async () => {
    if (!activeFile) return;
    // Flush pending save before running
    void flushAutosave(activeFile.id);

    setIsBottomDrawerOpen(true);
    setActiveBottomTab('output');
    setIsRunning(true);

    try {
      const codeToRun =
        (editorInstance ? editorInstance.getValue() : latestContentRef.current[activeFile.id]) ||
        activeFile.content ||
        '';
      const result = await executionClient.executeCode(codeToRun, activeFile.language);
      setExecutionResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, editorInstance, flushAutosave]);

  useKeyboardShortcuts({
    onSave: handleExplicitSave,
    onRun: () => void handleRunCode(),
    onToggleExplorer: () => setIsExplorerOpen((prev) => !prev),
  });

  const handleSelectFile = (file: WorkspaceFile) => {
    if (activeFileId && activeFileId !== file.id) {
      void flushAutosave(activeFileId);
    }
    if (!openFileIds.includes(file.id)) {
      setOpenFileIds((prev) => [...prev, file.id]);
    }
    setActiveFileId(file.id);
  };

  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void flushAutosave(fileId);
    const updatedOpen = openFileIds.filter((id) => id !== fileId);
    setOpenFileIds(updatedOpen);
    if (activeFileId === fileId) {
      setActiveFileId(
        updatedOpen.length > 0 ? updatedOpen[updatedOpen.length - 1] : null
      );
    }
  };

  const handleCreateFile = async (path: string) => {
    const language = detectLanguageFromPath(path);
    const created = await workspaceApi.createFile(room.id, {
      path,
      content: '',
      language,
    });
    setFiles((prev) => [...prev, created]);
    latestContentRef.current[created.id] = created.content;
    setDbContentSnapshot((prev) => ({ ...prev, [created.id]: created.content }));
    setOpenFileIds((prev) => [...prev, created.id]);
    setActiveFileId(created.id);
  };

  const handleRenameFile = async (file: WorkspaceFile, newPath: string) => {
    const newName = newPath.split('/').pop() || newPath;
    const newLanguage = detectLanguageFromPath(newPath);
    const updated = await workspaceApi.updateFile(room.id, file.id, {
      path: newPath,
      name: newName,
      language: newLanguage,
    });
    setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
  };

  const handleConfirmDeleteFile = async () => {
    if (!filePendingDelete) return;
    const targetId = filePendingDelete.id;
    try {
      await workspaceApi.deleteFile(room.id, targetId);
      setFiles((prev) => prev.filter((f) => f.id !== targetId));
      setOpenFileIds((prev) => prev.filter((id) => id !== targetId));
      if (activeFileId === targetId) {
        const remaining = openFileIds.filter((id) => id !== targetId);
        setActiveFileId(remaining.length > 0 ? remaining[0] : null);
      }
    } finally {
      setFilePendingDelete(null);
    }
  };

  const handleLanguageChange = (file: WorkspaceFile, language: SupportedLanguage) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, language } : f))
    );
    void workspaceApi.updateFile(room.id, file.id, { language });
  };

  const handleFollowCollaborator = useCallback(
    (targetUserId: string, name: string, color: string, activeFilePath?: string) => {
      startFollowing(targetUserId, name, color, activeFilePath);
      if (activeFilePath) {
        handleFollowFileChange(activeFilePath);
      }
    },
    [startFollowing, handleFollowFileChange]
  );

  return (
    <div className="flex h-screen w-screen flex-col theme-bg-root theme-text-primary overflow-hidden transition-colors">
      <TopBar
        roomName={room.name}
        roomId={room.id}
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        connectionStatus={connectionStatus}
        isDocumentSynced={isDocumentSynced}
        collaborators={collaborators}
        isRunning={isRunning}
        isSaving={isSaving}
        saveStatus={saveStatus}
        hasUnsavedChanges={dirtyFileIds.size > 0}
        isExplorerOpen={isExplorerOpen}
        isRefreshing={isRefreshing}
        refreshStatus={refreshStatus}
        activeReservationsCount={reservations.length}
        followState={followState}
        onRefreshWorkspace={() => void handleRefreshWorkspace()}
        onFollowCollaborator={handleFollowCollaborator}
        onStopFollowing={stopFollowing}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        onRunCode={() => void handleRunCode()}
        onSaveFile={handleExplicitSave}
        onOpenAIDebugger={() => {
          setIsBottomDrawerOpen(true);
          setActiveBottomTab('ai-debugger');
        }}
        onSwitchWorkspace={onSwitchWorkspace}
        onLogout={onLogout}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {isExplorerOpen && (
          <>
            <div
              style={{ width: `${sidebarResize.size}px` }}
              className="h-full shrink-0 overflow-hidden"
            >
              <FileExplorer
                files={files}
                activeFileId={activeFileId}
                dirtyFileIds={dirtyFileIds}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onRequestDeleteFile={(file) => setFilePendingDelete(file)}
              />
            </div>

            <div
              onMouseDown={sidebarResize.startResize}
              className={`w-1 cursor-col-resize theme-bg-surface-2 hover:bg-teal-500 transition-colors ${
                sidebarResize.isDragging ? 'bg-teal-500' : ''
              }`}
              title="Drag to resize sidebar"
            />
          </>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorPane
            openFiles={openFiles}
            activeFile={activeFile}
            dirtyFileIds={dirtyFileIds}
            reservations={reservations}
            followState={followState}
            currentUserId={user.id}
            theme={theme}
            onSelectTab={(file) => handleSelectFile(file)}
            onCloseTab={handleCloseTab}
            onLanguageChange={handleLanguageChange}
            onReserveSelection={reserveLines}
            onReleaseReservation={releaseReservation}
            onUpdateReservationRange={updateReservationRange}
            onStopFollowing={stopFollowing}
            onEditorReady={(editor, monaco) => {
              setEditorInstance(editor);
              setMonacoInstance(monaco);
            }}
          />

          {isBottomDrawerOpen && (
            <div
              onMouseDown={bottomDrawerResize.startResize}
              className={`h-1 cursor-row-resize theme-bg-surface-2 hover:bg-teal-500 transition-colors ${
                bottomDrawerResize.isDragging ? 'bg-teal-500' : ''
              }`}
              title="Drag to resize bottom panel"
            />
          )}

          {/* Bottom Drawer Navigation Bar */}
          <div className="flex h-9 shrink-0 items-center justify-between border-t theme-border theme-bg-surface-1 px-3 select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab('output');
                  setIsBottomDrawerOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'output'
? 'border theme-border theme-bg-surface-2 text-teal-600 dark:text-teal-400 font-semibold'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Play className="h-3 w-3 text-emerald-500" />
                <span>Execution Output</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab('terminal');
                  setIsBottomDrawerOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'terminal'
? 'border theme-border theme-bg-surface-2 text-teal-600 dark:text-teal-400 font-semibold'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Terminal className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                <span>Cloud Terminal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab('ai-debugger');
                  setIsBottomDrawerOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'ai-debugger'
? 'border theme-border theme-bg-surface-2 text-purple-400 font-semibold'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Sparkles className="h-3 w-3 text-purple-400" />
                <span>AI Debugger & Diff</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsBottomDrawerOpen((prev) => !prev)}
              className="rounded p-1 theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary transition cursor-pointer"
              title={isBottomDrawerOpen ? 'Collapse Bottom Panel' : 'Expand Bottom Panel'}
            >
              {isBottomDrawerOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Bottom Drawer Content */}
          {isBottomDrawerOpen && (
            <div
              style={{ height: `${bottomDrawerResize.size}px` }}
              className="shrink-0 overflow-hidden theme-bg-root"
            >
              {activeBottomTab === 'output' && (
                <OutputPanel
                  result={executionResult}
                  isRunning={isRunning}
                  onClearOutput={() => setExecutionResult(null)}
                  onSendErrorToAI={(err) => {
                    setAiErrorSeed(err);
                    setActiveBottomTab('ai-debugger');
                  }}
                />
              )}

              {activeBottomTab === 'terminal' && (
                <TerminalPanel
                  roomId={room.id}
                  user={user}
                  isVisible={isBottomDrawerOpen && activeBottomTab === 'terminal'}
                  theme={theme}
                />
              )}

              {activeBottomTab === 'ai-debugger' && (
                <AIDebuggerPanel
                  activeFile={
                    activeFile && editorInstance
                      ? { ...activeFile, content: editorInstance.getValue() }
                      : activeFile
                  }
                  initialError={aiErrorSeed}
                  onApplyFixToEditor={(newCode: string) => {
                    applyContentToSharedDoc(newCode);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {filePendingDelete && (
        <ConfirmModal
          isOpen={Boolean(filePendingDelete)}
          title="Delete File"
          description={`Are you sure you want to permanently delete "${filePendingDelete.name}"? This file will be removed for all collaborators.`}
          confirmLabel="Delete File"
          variant="danger"
          onConfirm={() => void handleConfirmDeleteFile()}
          onCancel={() => setFilePendingDelete(null)}
        />
      )}

      <ConnectionDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        roomId={room.id}
        activeFilePath={activeFile?.path}
        connectionStatus={connectionStatus}
        isDocumentSynced={isDocumentSynced}
        collaborators={collaborators}
        currentUser={user}
        onForceReconnect={reconcileSession}
      />
    </div>
  );
};
