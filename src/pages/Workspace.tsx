import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { WasmBootHud } from '../components/WasmBootHud';
import { workspaceApi, detectLanguageFromPath } from '../services/workspaceApi';
import { executionClient } from '../services/executionClient';
import { useCollaborativeEditor } from '../hooks/useCollaborativeEditor';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useResizablePanel } from '../hooks/useResizablePanel';
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
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [dirtyFileIds, setDirtyFileIds] = useState<Set<string>>(() => new Set());
  const [dbContentSnapshot, setDbContentSnapshot] = useState<Record<string, string>>({});

  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabType>('output');

  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [aiErrorSeed, setAiErrorSeed] = useState<string>('');

  const [filePendingDelete, setFilePendingDelete] = useState<WorkspaceFile | null>(null);

  const [editorInstance, setEditorInstance] =
    useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<typeof Monaco | null>(null);

  const autosaveTimerRef = useRef<Record<string, number>>({});

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

  useEffect(() => {
    let isMounted = true;
    const loadWorkspaceFiles = async () => {
      try {
        const fetched = await workspaceApi.listFiles(room.id);
        if (!isMounted) return;

        setFiles(fetched);
        const snapshots: Record<string, string> = {};
        fetched.forEach((f) => {
          snapshots[f.id] = f.content;
        });
        setDbContentSnapshot(snapshots);

        if (fetched.length > 0) {
          setOpenFileIds([fetched[0].id]);
          setActiveFileId(fetched[0].id);
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
  }, [room.id]);

  const persistFileToDatabase = useCallback(
    async (fileToSave: WorkspaceFile) => {
      setIsSaving(true);
      try {
        await workspaceApi.updateFile(room.id, fileToSave.id, {
          content: fileToSave.content,
          path: fileToSave.path,
          name: fileToSave.name,
          language: fileToSave.language,
        });
        setDbContentSnapshot((prev) => ({
          ...prev,
          [fileToSave.id]: fileToSave.content,
        }));
        setDirtyFileIds((prev) => {
          const next = new Set(prev);
          next.delete(fileToSave.id);
          return next;
        });
      } catch (err) {
        console.error('Failed to save file:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [room.id]
  );

  const handleCollaborativeContentChange = useCallback(
    (fileId: string, newContent: string) => {
      setFiles((prevFiles) =>
        prevFiles.map((file) =>
          file.id === fileId ? { ...file, content: newContent } : file
        )
      );

      setDirtyFileIds((prev) => {
        const next = new Set(prev);
        if (dbContentSnapshot[fileId] !== newContent) {
          next.add(fileId);
        } else {
          next.delete(fileId);
        }
        return next;
      });

      if (autosaveTimerRef.current[fileId]) {
        window.clearTimeout(autosaveTimerRef.current[fileId]);
      }

      autosaveTimerRef.current[fileId] = window.setTimeout(() => {
        setFiles((currentFiles) => {
          const target = currentFiles.find((f) => f.id === fileId);
          if (target && dbContentSnapshot[fileId] !== target.content) {
            void persistFileToDatabase(target);
          }
          return currentFiles;
        });
      }, 2500);
    },
    [dbContentSnapshot, persistFileToDatabase]
  );

  const { connectionStatus, isDocumentSynced, collaborators, applyContentToSharedDoc } =
    useCollaborativeEditor({
      roomId: room.id,
      activeFile,
      user,
      editorInstance,
      monacoInstance,
      onContentChange: handleCollaborativeContentChange,
    });

  const handleExplicitSave = useCallback(() => {
    if (!activeFile) return;
    if (autosaveTimerRef.current[activeFile.id]) {
      window.clearTimeout(autosaveTimerRef.current[activeFile.id]);
    }
    void persistFileToDatabase(activeFile);
  }, [activeFile, persistFileToDatabase]);

  const handleRunCode = useCallback(async () => {
    if (!activeFile) return;
    setIsBottomDrawerOpen(true);
    setActiveBottomTab('output');
    setIsRunning(true);

    try {
      const codeToRun = (editorInstance && activeFile ? editorInstance.getValue() : activeFile.content) || '';
      const result = await executionClient.executeCode(
        codeToRun,
        activeFile.language
      );
      setExecutionResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, editorInstance]);

  useKeyboardShortcuts({
    onSave: handleExplicitSave,
    onRun: () => void handleRunCode(),
    onToggleExplorer: () => setIsExplorerOpen((prev) => !prev),
  });

  const handleSelectFile = (file: WorkspaceFile) => {
    if (!openFileIds.includes(file.id)) {
      setOpenFileIds((prev) => [...prev, file.id]);
    }
    setActiveFileId(file.id);
  };

  const handleCloseTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleLanguageChange = (
    file: WorkspaceFile,
    language: SupportedLanguage
  ) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, language } : f))
    );
    void workspaceApi.updateFile(room.id, file.id, { language });
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`flex h-screen w-screen flex-col theme-bg-root theme-text-primary overflow-hidden transition-colors ${
        isDark ? 'dark' : 'light'
      }`}
      data-theme={theme}
    >
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
        hasUnsavedChanges={dirtyFileIds.size > 0}
        isExplorerOpen={isExplorerOpen}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        onRunCode={() => void handleRunCode()}
        onSaveFile={handleExplicitSave}
        onOpenAIDebugger={() => {
          setIsBottomDrawerOpen(true);
          setActiveBottomTab('ai-debugger');
        }}
        onSwitchWorkspace={onSwitchWorkspace}
        onLogout={onLogout}
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
              className={`w-1 cursor-col-resize theme-bg-surface-2 hover:bg-indigo-500 transition-colors ${
                sidebarResize.isDragging ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : ''
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
            theme={theme}
            onSelectTab={(file) => setActiveFileId(file.id)}
            onCloseTab={handleCloseTab}
            onLanguageChange={handleLanguageChange}
            onEditorReady={(editor, monaco) => {
              setEditorInstance(editor);
              setMonacoInstance(monaco);
            }}
            onSwitchWorkspace={onSwitchWorkspace}
          />

          {isBottomDrawerOpen && (
            <div
              onMouseDown={bottomDrawerResize.startResize}
              className={`h-1 cursor-row-resize theme-bg-surface-2 hover:bg-indigo-500 transition-colors ${
                bottomDrawerResize.isDragging ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : ''
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
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'output'
                    ? 'border-indigo-500 theme-text-primary bg-indigo-500/10'
                    : 'border-transparent theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Play className="h-3 w-3 text-emerald-400" />
                <span>Output Sandbox</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab('terminal');
                  setIsBottomDrawerOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'terminal'
                    ? 'border-indigo-500 theme-text-primary bg-indigo-500/10'
                    : 'border-transparent theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Terminal className="h-3 w-3 text-indigo-400" />
                <span>Cloud Terminal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab('ai-debugger');
                  setIsBottomDrawerOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'ai-debugger'
                    ? 'border-purple-500 theme-text-primary bg-purple-500/10'
                    : 'border-transparent theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Sparkles className="h-3 w-3 text-purple-400" />
                <span>AI Debugger</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsBottomDrawerOpen((prev) => !prev)}
              className="rounded-md p-1 theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary transition cursor-pointer"
              title={isBottomDrawerOpen ? 'Minimize Panel' : 'Expand Panel'}
            >
              {isBottomDrawerOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {isBottomDrawerOpen && (
            <div
              style={{ height: `${bottomDrawerResize.size}px` }}
              className="shrink-0 overflow-hidden"
            >
              {activeBottomTab === 'output' && (
                <OutputPanel
                  result={executionResult}
                  isRunning={isRunning}
                  onClearOutput={() => setExecutionResult(null)}
                  onSendErrorToAI={(errText) => {
                    setAiErrorSeed(errText);
                    setActiveBottomTab('ai-debugger');
                  }}
                />
              )}

              <div
                className={
                  activeBottomTab === 'terminal' ? 'h-full w-full' : 'hidden'
                }
              >
                <TerminalPanel
                  roomId={room.id}
                  user={user}
                  theme={theme}
                  isVisible={isBottomDrawerOpen && activeBottomTab === 'terminal'}
                />
              </div>

              {activeBottomTab === 'ai-debugger' && (
                <AIDebuggerPanel
                  activeFile={activeFile}
                  initialError={aiErrorSeed}
                  onApplyFixToEditor={(fixedCode) => {
                    applyContentToSharedDoc(fixedCode);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(filePendingDelete)}
        title="Delete File Permanently"
        description={
          filePendingDelete
            ? `Are you sure you want to delete "${filePendingDelete.path}" from this workspace? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete File"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleConfirmDeleteFile()}
        onCancel={() => setFilePendingDelete(null)}
      />
    </div>
  );
};
