import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type * as Monaco from 'monaco-editor';
import { Terminal, Play, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { StatusBar } from '../components/StatusBar';
import { ThemeMode } from '../components/ThemeToggle';
import { FileExplorer } from '../components/FileExplorer';
import { EditorPane } from '../components/EditorPane';
import { OutputPanel } from '../components/OutputPanel';
import { TerminalPanel } from '../components/TerminalPanel';
import { AIDebuggerPanel } from '../components/AIDebuggerPanel';
import { AIAgentSidebar } from '../components/AIAgentSidebar';
import { ConfirmModal } from '../components/ConfirmModal';
import { FileConflictModal } from '../components/FileConflictModal';
import { ConnectionDiagnosticsModal } from '../components/ConnectionDiagnosticsModal';
import { workspaceApi, detectLanguageFromPath, FileConflictError } from '../services/workspaceApi';
import { extractParentAndName, generateAlternativeName } from '../utils/fileConflictUtils';
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
  ProposedPatch,
  ProjectProfile,
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
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(() => initialSavedUI?.isAgentSidebarOpen ?? false);

  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [aiErrorSeed, setAiErrorSeed] = useState<string>('');

  const [filePendingDelete, setFilePendingDelete] = useState<WorkspaceFile | null>(null);
  const [folderPendingDelete, setFolderPendingDelete] = useState<string | null>(null);
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [projectProfile, setProjectProfile] = useState<ProjectProfile | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ lineNumber: number; column: number } | null>(null);

  // Smart conflict resolution dialog state for concurrent creations
  const [conflictModalState, setConflictModalState] = useState<{
    isOpen: boolean;
    type: 'file' | 'folder';
    fullPath: string;
    parentPath: string;
    fileName: string;
    draftContent: string;
    suggestedCopyName: string;
    errorMessage: string | null;
    isSubmitting: boolean;
  } | null>(null);

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

  const agentSidebarResize = useResizablePanel({
    initialSize: 380,
    minSize: 280,
    maxSize: 620,
    direction: 'horizontal',
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
      isAgentSidebarOpen,
    });
  }, [room.id, openFileIds, activeFileId, activeBottomTab, isBottomDrawerOpen, isExplorerOpen, isAgentSidebarOpen]);

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

        // Fetch language-agnostic project profile
        void workspaceApi
          .getProjectProfile(room.id)
          .then((prof) => {
            if (isMounted) setProjectProfile(prof);
          })
          .catch(() => {});
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
    followState,
    lineLockNotice,
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

  const handleApplyAgentPatch = useCallback(
    async (patch: ProposedPatch) => {
      const cleanPatchPath = patch.filePath.replace(/^\/+/, '');
      const isActive =
        activeFile &&
        (activeFile.path.replace(/^\/+/, '') === cleanPatchPath ||
          activeFile.name === patch.filePath ||
          cleanPatchPath.endsWith(activeFile.path.replace(/^\/+/, '')));

      if (isActive) {
        applyContentToSharedDoc(patch.patchedContent);
      }

      const targetFile = files.find((f) => {
        const cleanPath = f.path.replace(/^\/+/, '');
        return cleanPath === cleanPatchPath || f.name === patch.filePath || cleanPatchPath.endsWith(cleanPath);
      });

      if (targetFile) {
        clearFileDraft(room.id, targetFile.id);
        latestContentRef.current[targetFile.id] = patch.patchedContent;
        setDbContentSnapshot((prev) => ({ ...prev, [targetFile.id]: patch.patchedContent }));
        setFiles((prev) =>
          prev.map((f) => (f.id === targetFile.id ? { ...f, content: patch.patchedContent } : f))
        );

        await workspaceApi.updateFile(room.id, targetFile.id, {
          content: patch.patchedContent,
          path: targetFile.path,
          name: targetFile.name,
          language: targetFile.language,
        });
      } else {
        const newFile = await workspaceApi.createFile(room.id, {
          path: patch.filePath,
          content: patch.patchedContent,
          language: detectLanguageFromPath(patch.filePath),
        });
        setFiles((prev) => [...prev, newFile]);
        handleSelectFile(newFile);
      }
    },
    [activeFile, files, room.id, applyContentToSharedDoc]
  );

  const handleCreateFile = async (path: string, initialContent: string = '') => {
    const cleanPath = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const language = detectLanguageFromPath(cleanPath);
    const idempotencyKey = `create_file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const created = await workspaceApi.createFile(room.id, {
        path: cleanPath,
        content: initialContent,
        language,
        idempotencyKey,
      });

      setFiles((prev) => {
        const withoutOld = prev.filter(
          (f) => f.id !== created.id && f.path.toLowerCase() !== created.path.toLowerCase()
        );
        return [...withoutOld, created];
      });

      latestContentRef.current[created.id] = created.content;
      setDbContentSnapshot((prev) => ({ ...prev, [created.id]: created.content }));
      setOpenFileIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setActiveFileId(created.id);
    } catch (err: any) {
      if (err instanceof FileConflictError || err?.status === 409 || err?.message?.includes('CONFLICT')) {
        // Concurrently created by a peer!
        // 1. Immediately reconcile file list from backend so the peer's file appears
        try {
          const latest = await workspaceApi.listFiles(room.id);
          setFiles((_current) => {
            const currentContentMap = latestContentRef.current;
            return latest.map((lf) => ({
              ...lf,
              content: currentContentMap[lf.id] ?? lf.content,
            }));
          });
        } catch {}

        // 2. Compute non-conflicting alternative suggestion in the parent folder
        const { parentPath, fileName } = extractParentAndName(cleanPath);
        const existingInParent = files
          .filter((f) => extractParentAndName(f.path).parentPath === parentPath)
          .map((f) => extractParentAndName(f.path).fileName);

        const suggestedCopyName = generateAlternativeName(fileName, existingInParent);

        // 3. Open Smart Conflict Resolution dialog
        setConflictModalState({
          isOpen: true,
          type: 'file',
          fullPath: cleanPath,
          parentPath,
          fileName,
          draftContent: initialContent,
          suggestedCopyName,
          errorMessage: null,
          isSubmitting: false,
        });

        throw err;
      }
      throw err;
    }
  };

  const handleRenameFile = async (file: WorkspaceFile, newPath: string) => {
    const cleanNewPath = newPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanNewPath || cleanNewPath === file.path) return;
    const newName = cleanNewPath.split('/').pop() || cleanNewPath;
    const newLanguage = detectLanguageFromPath(cleanNewPath);

    try {
      const updated = await workspaceApi.updateFile(room.id, file.id, {
        path: cleanNewPath,
        name: newName,
        language: newLanguage,
      });
      setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes('CONFLICT')) {
        const { parentPath, fileName } = extractParentAndName(cleanNewPath);
        const existingInParent = files
          .filter((f) => extractParentAndName(f.path).parentPath === parentPath)
          .map((f) => extractParentAndName(f.path).fileName);
        const suggested = generateAlternativeName(fileName, existingInParent);
        setConflictModalState({
          isOpen: true,
          type: 'file',
          fullPath: cleanNewPath,
          parentPath,
          fileName,
          draftContent: latestContentRef.current[file.id] || file.content,
          suggestedCopyName: suggested,
          errorMessage: `Cannot rename to "${fileName}" because an item already exists with that name.`,
          isSubmitting: false,
        });
      }
      throw err;
    }
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

  const handleCreateFolder = async (folderPath: string) => {
    const clean = folderPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!clean) return;
    const keepPath = `${clean}/.gitkeep`;
    const idempotencyKey = `create_folder_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const created = await workspaceApi.createFile(room.id, {
        path: keepPath,
        content: '',
        language: detectLanguageFromPath(keepPath),
        idempotencyKey,
      });

      setEmptyFolders((prev) => new Set(prev).add(clean));
      setFiles((prev) => {
        const withoutOld = prev.filter(
          (f) => f.id !== created.id && f.path.toLowerCase() !== created.path.toLowerCase()
        );
        return [...withoutOld, created];
      });
      latestContentRef.current[created.id] = created.content;
      setDbContentSnapshot((prev) => ({ ...prev, [created.id]: created.content }));
    } catch (err: any) {
      if (err instanceof FileConflictError || err?.status === 409 || err?.message?.includes('CONFLICT')) {
        try {
          const latest = await workspaceApi.listFiles(room.id);
          setFiles(latest);
        } catch {}

        const { parentPath, fileName } = extractParentAndName(clean);
        const existingFoldersInParent = Array.from(emptyFolders)
          .map((f) => extractParentAndName(f))
          .filter((f) => f.parentPath === parentPath)
          .map((f) => f.fileName);

        const suggestedCopyName = generateAlternativeName(fileName, existingFoldersInParent);

        setConflictModalState({
          isOpen: true,
          type: 'folder',
          fullPath: clean,
          parentPath,
          fileName,
          draftContent: '',
          suggestedCopyName,
          errorMessage: null,
          isSubmitting: false,
        });
        throw err;
      } else {
        console.warn('Backend folder placeholder notice:', err);
      }
    }
  };

  // Conflict Action Handlers
  const handleOpenExistingAfterConflict = useCallback(() => {
    if (!conflictModalState) return;
    const { fullPath, draftContent, type } = conflictModalState;

    if (draftContent && draftContent.trim().length > 0) {
      saveFileDraft(room.id, `conflict_backup_${fullPath}`, draftContent);
    }

    if (type === 'file') {
      const existing = files.find(
        (f) => f.path.toLowerCase() === fullPath.toLowerCase()
      );
      if (existing) {
        setOpenFileIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
        setActiveFileId(existing.id);
      }
    } else {
      setEmptyFolders((prev) => new Set(prev).add(fullPath));
    }

    setConflictModalState(null);
  }, [conflictModalState, files, room.id]);

  const handleResolveCreateCopy = useCallback(
    async (copyName: string) => {
      if (!conflictModalState) return;
      const { parentPath, draftContent, type } = conflictModalState;
      const targetPath = parentPath ? `${parentPath}/${copyName}` : copyName;

      setConflictModalState((prev) =>
        prev ? { ...prev, isSubmitting: true, errorMessage: null } : null
      );

      try {
        if (type === 'file') {
          await handleCreateFile(targetPath, draftContent);
        } else {
          await handleCreateFolder(targetPath);
        }
        setConflictModalState(null);
      } catch (_err: any) {
        const existingInParent = files
          .filter((f) => extractParentAndName(f.path).parentPath === parentPath)
          .map((f) => extractParentAndName(f.path).fileName);
        existingInParent.push(copyName);
        const nextSuggestion = generateAlternativeName(copyName, existingInParent);

        setConflictModalState((prev) =>
          prev
            ? {
                ...prev,
                isSubmitting: false,
                suggestedCopyName: nextSuggestion,
                errorMessage: `"${copyName}" was also just taken. Suggested: "${nextSuggestion}"`,
              }
            : null
        );
      }
    },
    [conflictModalState, files]
  );

  const handleResolveChooseName = useCallback(
    async (customName: string) => {
      if (!conflictModalState) return;
      const { parentPath, draftContent, type } = conflictModalState;
      const targetPath = parentPath ? `${parentPath}/${customName}` : customName;

      setConflictModalState((prev) =>
        prev ? { ...prev, isSubmitting: true, errorMessage: null } : null
      );

      try {
        if (type === 'file') {
          await handleCreateFile(targetPath, draftContent);
        } else {
          await handleCreateFolder(targetPath);
        }
        setConflictModalState(null);
      } catch (err: any) {
        setConflictModalState((prev) =>
          prev
            ? {
                ...prev,
                isSubmitting: false,
                errorMessage:
                  err instanceof Error
                    ? err.message
                    : `Failed to create "${customName}". It may already exist.`,
              }
            : null
        );
      }
    },
    [conflictModalState]
  );

  const handleCancelConflict = useCallback(() => {
    if (conflictModalState && conflictModalState.draftContent) {
      saveFileDraft(
        room.id,
        `conflict_backup_${conflictModalState.fullPath}`,
        conflictModalState.draftContent
      );
    }
    setConflictModalState(null);
  }, [conflictModalState, room.id]);

  const handleRenameFolder = async (oldFolderPath: string, newFolderPath: string) => {
    const cleanOld = oldFolderPath.replace(/^\/+/, '').replace(/\/+$/, '');
    const cleanNew = newFolderPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    const oldPrefix = cleanOld + '/';
    const newPrefix = cleanNew + '/';

    setEmptyFolders((prev) => {
      const next = new Set<string>();
      prev.forEach((f) => {
        if (f === cleanOld) next.add(cleanNew);
        else if (f.startsWith(oldPrefix)) next.add(f.replace(oldPrefix, newPrefix));
        else next.add(f);
      });
      return next;
    });

    const matchingFiles = files.filter((f) => f.path.startsWith(oldPrefix) || f.path === cleanOld);
    for (const file of matchingFiles) {
      const updatedPath = file.path.startsWith(oldPrefix)
        ? file.path.replace(oldPrefix, newPrefix)
        : cleanNew;
      const updatedName = updatedPath.split('/').pop() || updatedPath;
      const updatedLang = detectLanguageFromPath(updatedPath);
      try {
        const updated = await workspaceApi.updateFile(room.id, file.id, {
          path: updatedPath,
          name: updatedName,
          language: updatedLang,
        });
        setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
      } catch (err) {
        console.error('Failed to rename file in folder:', err);
      }
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderPendingDelete) return;
    const targetFolder = folderPendingDelete.replace(/^\/+/, '').replace(/\/+$/, '');
    const prefix = targetFolder + '/';

    setEmptyFolders((prev) => {
      const next = new Set(prev);
      next.delete(targetFolder);
      Array.from(next).forEach((f) => {
        if (f.startsWith(prefix)) next.delete(f);
      });
      return next;
    });

    const matchingFiles = files.filter((f) => f.path.startsWith(prefix) || f.path === targetFolder);
    const matchingIds = new Set(matchingFiles.map((f) => f.id));

    for (const file of matchingFiles) {
      try {
        await workspaceApi.deleteFile(room.id, file.id);
      } catch (err) {
        console.warn('Failed to delete file in folder:', err);
      }
    }

    setFiles((prev) => prev.filter((f) => !matchingIds.has(f.id)));
    setOpenFileIds((prev) => prev.filter((id) => !matchingIds.has(id)));
    if (activeFileId && matchingIds.has(activeFileId)) {
      const remaining = openFileIds.filter((id) => !matchingIds.has(id));
      setActiveFileId(remaining.length > 0 ? remaining[0] : null);
    }
    setFolderPendingDelete(null);
  };

  const handleLanguageChange = (file: WorkspaceFile, language: SupportedLanguage) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, language } : f))
    );
    void workspaceApi.updateFile(room.id, file.id, { language });
  };

  const isDark = theme === 'dark';

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
        collaborators={collaborators}
        isRunning={isRunning}
        isSaving={isSaving}
        saveStatus={saveStatus}
        hasUnsavedChanges={dirtyFileIds.size > 0}
        isExplorerOpen={isExplorerOpen}
        onFollowCollaborator={handleFollowCollaborator}
        onStopFollowing={stopFollowing}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        onRunCode={() => void handleRunCode()}
        onSaveFile={handleExplicitSave}
        onOpenAIDebugger={() => {
          setIsBottomDrawerOpen(true);
          setActiveBottomTab('ai-debugger');
        }}
        isAgentSidebarOpen={isAgentSidebarOpen}
        onToggleAgentSidebar={() => setIsAgentSidebarOpen((prev) => !prev)}
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
                emptyFolders={emptyFolders}
                activeFileId={activeFileId}
                dirtyFileIds={dirtyFileIds}
                onSelectFile={handleSelectFile}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRenameFile={handleRenameFile}
                onRenameFolder={handleRenameFolder}
                onRequestDeleteFile={(file) => setFilePendingDelete(file)}
                onRequestDeleteFolder={(folderPath) => setFolderPendingDelete(folderPath)}
                onRefresh={() => void handleRefreshWorkspace()}
                isRefreshing={isRefreshing}
                workspaceName={room.name}
              />
            </div>

            <div
              onMouseDown={sidebarResize.startResize}
              className={`w-1 cursor-col-resize theme-bg-surface-2 hover:bg-[#FF7057] transition-colors ${
                sidebarResize.isDragging ? 'bg-[#FF7057]' : ''
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
            followState={followState}
            lineLockNotice={lineLockNotice}
            currentUserId={user.id}
            theme={theme}
            onSelectTab={(file) => handleSelectFile(file)}
            onCloseTab={handleCloseTab}
            onLanguageChange={handleLanguageChange}
            onStopFollowing={stopFollowing}
            onEditorReady={(editor, monaco) => {
              setEditorInstance(editor);
              setMonacoInstance(monaco);
              editor.onDidChangeCursorPosition((e) => {
                setCursorPosition({ lineNumber: e.position.lineNumber, column: e.position.column });
              });
            }}
            onSwitchWorkspace={onSwitchWorkspace}
          />

          {isBottomDrawerOpen && (
            <div
              onMouseDown={bottomDrawerResize.startResize}
              className={`h-1 cursor-row-resize theme-bg-surface-2 hover:bg-[#FF7057] transition-colors ${
                bottomDrawerResize.isDragging ? 'bg-[#FF7057]' : ''
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
                    ? 'border border-[#FF7057] theme-bg-surface-2 text-[#FF7057] font-semibold'
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
                    ? 'border border-[#FF7057] theme-bg-surface-2 text-[#FF7057] font-semibold'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Terminal className="h-3 w-3 text-[#FF7057]" />
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
                    ? 'border border-[#FF7057] theme-bg-surface-2 text-[#FF7057] font-semibold'
                    : 'theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <Sparkles className="h-3 w-3 text-[#FF7057]" />
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

        {isAgentSidebarOpen && (
          <>
            <div
              onMouseDown={agentSidebarResize.startResize}
              className={`w-1 cursor-col-resize theme-bg-surface-2 hover:bg-[#FF7057] transition-colors shrink-0 ${
                agentSidebarResize.isDragging ? 'bg-[#FF7057]' : ''
              }`}
              title="Drag to resize AI Agent sidebar"
            />
            <div
              style={{ width: `${agentSidebarResize.size}px` }}
              className="h-full shrink-0 overflow-hidden border-l theme-border"
            >
              <AIAgentSidebar
                roomId={room.id}
                roomName={room.name}
                user={user}
                activeFile={activeFile}
                files={files}
                selectedCode={
                  editorInstance?.getModel()?.getValueInRange(editorInstance.getSelection()!) ||
                  undefined
                }
                selectedRange={
                  editorInstance?.getSelection()
                    ? {
                        startLine: editorInstance.getSelection()!.startLineNumber,
                        endLine: editorInstance.getSelection()!.endLineNumber,
                      }
                    : undefined
                }
                recentError={
                  executionResult?.stderr || executionResult?.error || undefined
                }
                projectProfile={projectProfile || undefined}
                isOpen={isAgentSidebarOpen}
                onClose={() => setIsAgentSidebarOpen(false)}
                onApplyPatch={handleApplyAgentPatch}
                onOpenFileInEditor={(filePath) => {
                  const cleanTarget = filePath.replace(/^\/+/, '');
                  const target = files.find(
                    (f) =>
                      f.path.replace(/^\/+/, '') === cleanTarget ||
                      f.name === filePath ||
                      cleanTarget.endsWith(f.path.replace(/^\/+/, ''))
                  );
                  if (target) handleSelectFile(target);
                }}
              />
            </div>
          </>
        )}
      </div>

      <StatusBar
        roomId={room.id}
        branch={room.branch}
        repositoryUrl={room.repositoryUrl}
        primaryLanguage={projectProfile?.primaryLanguage || room.primaryLanguage}
        connectionStatus={connectionStatus}
        isDocumentSynced={isDocumentSynced}
        isRefreshing={isRefreshing}
        refreshStatus={refreshStatus}
        onRefreshWorkspace={() => void handleRefreshWorkspace()}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        followState={followState}
        onStopFollowing={stopFollowing}
        cursorPosition={cursorPosition}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

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

      {folderPendingDelete && (
        <ConfirmModal
          isOpen={Boolean(folderPendingDelete)}
          title="Delete Folder"
          description={`Are you sure you want to permanently delete folder "${folderPendingDelete}" and all its contents? This will permanently remove all files inside this folder for all collaborators.`}
          confirmLabel="Delete Folder"
          variant="danger"
          onConfirm={() => void handleConfirmDeleteFolder()}
          onCancel={() => setFolderPendingDelete(null)}
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

      {conflictModalState && (
        <FileConflictModal
          isOpen={conflictModalState.isOpen}
          type={conflictModalState.type}
          itemName={conflictModalState.fileName}
          parentPath={conflictModalState.parentPath}
          suggestedCopyName={conflictModalState.suggestedCopyName}
          hasUnsavedDraft={Boolean(
            conflictModalState.draftContent && conflictModalState.draftContent.trim().length > 0
          )}
          draftSnippet={
            conflictModalState.draftContent
              ? conflictModalState.draftContent.slice(0, 150)
              : undefined
          }
          errorMessage={conflictModalState.errorMessage}
          isSubmitting={conflictModalState.isSubmitting}
          onOpenExisting={handleOpenExistingAfterConflict}
          onCreateCopy={handleResolveCreateCopy}
          onChooseName={handleResolveChooseName}
          onCancel={handleCancelConflict}
        />
      )}
    </div>
  );
};
