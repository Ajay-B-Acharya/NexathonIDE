import React, { useState, useEffect, useCallback, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import { Terminal, Play, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { FileExplorer } from '../components/FileExplorer';
import { EditorPane } from '../components/EditorPane';
import { OutputPanel } from '../components/OutputPanel';
import { TerminalPanel } from '../components/TerminalPanel';
import { AIDebuggerPanel } from '../components/AIDebuggerPanel';
import { ConfirmModal } from '../components/ConfirmModal';
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
  onSwitchWorkspace: () => void;
  onLogout: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  room,
  user,
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

  const { connectionStatus, collaborators, applyContentToSharedDoc } =
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
      const result = await executionClient.executeCode(
        activeFile.content,
        activeFile.language
      );
      setExecutionResult(result);
    } finally {
      setIsRunning(false);
    }
  }, [activeFile]);

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

  return (
    <div className="flex h-screen w-screen flex-col bg-[#090a0f] text-slate-200 overflow-hidden">
      <TopBar
        roomName={room.name}
        roomId={room.id}
        user={user}
        connectionStatus={connectionStatus}
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
              className={`w-1 cursor-col-resize bg-[#0f121d] hover:bg-indigo-500 transition-colors ${
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
            onSelectTab={(file) => setActiveFileId(file.id)}
            onCloseTab={handleCloseTab}
            onLanguageChange={handleLanguageChange}
            onEditorReady={(editor, monaco) => {
              setEditorInstance(editor);
              setMonacoInstance(monaco);
            }}
          />

          {isBottomDrawerOpen && (
            <div
              onMouseDown={bottomDrawerResize.startResize}
              className={`h-1 cursor-row-resize bg-[#0f121d] hover:bg-indigo-500 transition-colors ${
                bottomDrawerResize.isDragging ? 'bg-indigo-500 shadow-[0_0_10px_#6366f1]' : ''
              }`}
              title="Drag to resize bottom panel"
            />
          )}

          {/* Bottom Drawer Navigation Bar */}
          <div className="flex h-9 shrink-0 items-center justify-between border-t border-white/10 bg-[#0f121d] px-3 select-none">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveBottomTab('output');
                  setIsBottomDrawerOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  isBottomDrawerOpen && activeBottomTab === 'output'
                    ? 'border-indigo-500 text-white bg-[#141824]/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
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
                    ? 'border-indigo-500 text-white bg-[#141824]/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
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
                    ? 'border-purple-500 text-white bg-purple-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-3 w-3 text-purple-400" />
                <span>AI Debugger</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsBottomDrawerOpen((prev) => !prev)}
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
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
