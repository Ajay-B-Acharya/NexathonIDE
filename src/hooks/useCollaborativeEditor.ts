import { useEffect, useRef, useState, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import { collaborationClient, FileCollaborationSession } from '../services/collaborationClient';
import {
  CollaboratorPresence,
  ConnectionStatus,
  EditReservation,
  FollowState,
  UserProfile,
  WorkspaceFile,
} from '../types';

interface UseCollaborativeEditorOptions {
  roomId: string;
  activeFile: WorkspaceFile | null;
  user: UserProfile;
  editorInstance: Monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof Monaco | null;
  onContentChange: (fileId: string, newContent: string) => void;
  onFollowFileChange?: (targetFilePath: string) => void;
}

interface UseCollaborativeEditorReturn {
  connectionStatus: ConnectionStatus;
  isDocumentSynced: boolean;
  collaborators: CollaboratorPresence[];
  reservations: EditReservation[];
  activeConflictReservation: EditReservation | null;
  followState: FollowState | null;
  reserveLines: (startLine: number, endLine: number, taskDescription?: string) => void;
  releaseReservation: (reservationId: string) => void;
  startFollowing: (targetUserId: string, targetUserName: string, targetUserColor: string, targetFile?: string) => void;
  stopFollowing: () => void;
  reconcileSession: () => void;
  applyContentToSharedDoc: (newFullContent: string) => void;
}

/**
 * Dynamically injects per-client cursor CSS styles so y-monaco awareness
 * cursors and selection highlights display each user's unique color & username pill.
 */
function syncCollaboratorCursorStyles(collaborators: CollaboratorPresence[]) {
  const styleId = 'nexathon-yjs-cursor-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const rules = collaborators
    .map(({ clientId, user }) => {
      const safeName = user.name.replace(/"/g, '\\"');
      const color = user.color || '#3b82f6';
      return `
        .yRemoteSelection-${clientId} {
          background-color: ${color}33 !important;
        }
        .yRemoteSelectionHead-${clientId} {
          position: absolute;
          border-left: 2px solid ${color} !important;
          border-top: 2px solid ${color} !important;
          border-bottom: 2px solid ${color} !important;
          height: 100%;
          box-sizing: border-box;
        }
        .yRemoteSelectionHead-${clientId}::after {
          content: "${safeName}";
          position: absolute;
          top: -18px;
          left: -2px;
          background-color: ${color};
          color: #ffffff;
          font-size: 10px;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 3px 3px 3px 0;
          white-space: nowrap;
          pointer-events: none;
          z-index: 50;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
      `;
    })
    .join('\n');

  styleEl.textContent = rules;
}

const DYNAMIC_RESERVATION_LINES = 10;
const INACTIVITY_TIMEOUT_MS = 15_000;

/**
 * Calculates a 10-line dedicated workspace section centered around the user's cursor.
 * For files under 10 lines, reserves the exact active line.
 */
function calculateDynamicWindow(
  currentLine: number,
  totalLines: number
): { startLine: number; endLine: number } {
  if (totalLines <= DYNAMIC_RESERVATION_LINES) {
    return { startLine: currentLine, endLine: currentLine };
  }

  let start = Math.max(1, currentLine - 2);
  let end = start + DYNAMIC_RESERVATION_LINES - 1;

  if (end > totalLines) {
    end = Math.max(totalLines, currentLine);
    start = Math.max(1, end - DYNAMIC_RESERVATION_LINES + 1);
  }

  return { startLine: start, endLine: end };
}

/**
 * Dynamically injects CSS rules for each user's reserved 10-line window, active line,
 * and colored status tag to give every collaborator an unmistakable unique visual identity.
 */
function syncCollaboratorReservationStyles(
  reservations: EditReservation[],
  currentUserId: string
) {
  const styleId = 'nexathon-dynamic-reservation-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const rules = reservations
    .map((r) => {
      const isMine = r.ownerId === currentUserId;
      const color = r.ownerColor || (isMine ? '#6366f1' : '#f59e0b');
      const safeId = r.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeName = (r.ownerName || 'Collaborator').replace(/"/g, '\\"');
      const activeLineNum = r.activeLine || r.startLine;

      return `
        .res-window-${safeId} {
          background-color: ${color}14 !important;
          border-left: 3px solid ${color}88 !important;
          position: relative;
        }
        .res-active-line-${safeId} {
          background-color: ${color}28 !important;
          border-left: 4px solid ${color} !important;
          box-shadow: inset 0 0 12px ${color}20;
          position: relative;
        }
        .res-active-line-${safeId}::after {
          content: "👤 ${safeName} (Ln ${activeLineNum})";
          position: absolute;
          right: 14px;
          top: 0;
          bottom: 0;
          margin: auto 0;
          height: 18px;
          line-height: 18px;
          background-color: ${color};
          color: #ffffff;
          font-size: 10px;
          font-family: 'JetBrains Mono', ui-sans-serif, system-ui, sans-serif;
          font-weight: 600;
          padding: 0 6px;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0.95;
          z-index: 10;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .res-glyph-${safeId} {
          background-color: ${color} !important;
          border-radius: 50%;
          width: 8px !important;
          height: 8px !important;
          margin-left: 4px;
          margin-top: 5px;
          box-shadow: 0 0 6px ${color};
        }
      `;
    })
    .join('\n');

  styleEl.textContent = rules;
}

export function useCollaborativeEditor({
  roomId,
  activeFile,
  user,
  editorInstance,
  monacoInstance,
  onContentChange,
  onFollowFileChange,
}: UseCollaborativeEditorOptions): UseCollaborativeEditorReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isDocumentSynced, setIsDocumentSynced] = useState<boolean>(false);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [reservations, setReservations] = useState<EditReservation[]>([]);
  const [activeConflictReservation, setActiveConflictReservation] = useState<EditReservation | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const lastLocalActivityRef = useRef<number>(Date.now());
  const isInactiveRef = useRef<boolean>(false);

  const bindingRef = useRef<MonacoBinding | null>(null);
  const sessionRef = useRef<FileCollaborationSession | null>(null);
  const modelsMapRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const decorationIdsRef = useRef<string[]>([]);
  const lastFollowedLineRef = useRef<number | null>(null);

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const onFollowFileChangeRef = useRef(onFollowFileChange);
  onFollowFileChangeRef.current = onFollowFileChange;

  useEffect(() => {
    if (!editorInstance || !monacoInstance || !activeFile || !roomId) {
      return;
    }

    // Clean up previous file's MonacoBinding without destroying cached Y.Doc sessions
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const fileKey = `${roomId}:${activeFile.path}`;

    // Get or create a dedicated Monaco ITextModel per file URI so undo/redo & view state remain file-scoped
    const modelUri = monacoInstance.Uri.parse(`inmemory://nexathon/${roomId}/${activeFile.path}`);
    let model = monacoInstance.editor.getModel(modelUri);
    if (!model) {
      model = monacoInstance.editor.createModel(
        activeFile.content,
        activeFile.language,
        modelUri
      );
      modelsMapRef.current.set(fileKey, model);
    } else if (model.getLanguageId() !== activeFile.language) {
      monacoInstance.editor.setModelLanguage(model, activeFile.language);
    }

    editorInstance.setModel(model);

    // Connect or reuse the per-file Yjs session (`${roomId}:${file.path}`)
    const session = collaborationClient.getOrCreateFileSession(
      roomId,
      activeFile.path,
      user,
      activeFile.content
    );

    sessionRef.current = session;

    // Attach real-time connection status listener
    const handleStatus = (event: { status: string }) => {
      if (event.status === 'connected') setConnectionStatus('connected');
      else if (event.status === 'connecting') setConnectionStatus('connecting');
      else setConnectionStatus('disconnected');
    };
    session.provider.on('status', handleStatus);
    if (session.provider.wsconnected) {
      setConnectionStatus('connected');
    }

    // Attach document sync listener
    const handleSync = (isSynced: boolean) => {
      setIsDocumentSynced(isSynced);
    };
    session.provider.on('sync', handleSync);
    setIsDocumentSynced(session.provider.synced);

    // Attach peer awareness listener
    const handleAwareness = () => {
      const states = session.provider.awareness.getStates();
      const list: CollaboratorPresence[] = [];
      states.forEach((state, clientId) => {
        if (state && state.user) {
          list.push({
            clientId,
            user: state.user as UserProfile,
            activeFile: state.activeFile as string | undefined,
            cursor: state.cursor as { lineNumber: number; column: number } | null | undefined,
            isTyping: Boolean(state.isTyping),
            isInactive: Boolean(state.isInactive),
            lastActive: (state.lastActive as number) || Date.now(),
          });
        }
      });
      setCollaborators(list);
      syncCollaboratorCursorStyles(list);
      updateReservationsFromMap();
    };
    session.provider.awareness.on('change', handleAwareness);
    handleAwareness();

    // Synchronize edit reservations from CRDT shared map
    const updateReservationsFromMap = () => {
      const now = Date.now();
      const states = session.provider.awareness.getStates();
      const connectedUserIds = new Set<string>();
      const inactiveUserIds = new Set<string>();

      states.forEach((state) => {
        if (state && state.user && state.user.id) {
          connectedUserIds.add(state.user.id);
          if (state.isInactive) {
            inactiveUserIds.add(state.user.id);
          }
        }
      });

      const list: EditReservation[] = [];
      session.reservationsMap.forEach((res, key) => {
        // If owner disconnected/left the codebase, immediately prune reservation from shared map
        if (!connectedUserIds.has(res.ownerId)) {
          session.reservationsMap.delete(key);
          return;
        }

        // If owner is inactive and this is an automatic cursor window reservation, prune it
        if (inactiveUserIds.has(res.ownerId) && (res.isAutomatic || key.startsWith('auto_'))) {
          session.reservationsMap.delete(key);
          return;
        }

        // If local user is inactive and this is local user's auto reservation, prune it
        if (res.ownerId === user.id && isInactiveRef.current && (res.isAutomatic || key.startsWith('auto_'))) {
          session.reservationsMap.delete(key);
          return;
        }

        if (res.expiresAt > now && res.filePath === activeFile.path) {
          list.push(res);
        }
      });
      setReservations(list);

      // Clear any conflict banner if the blocking reservation was released/pruned
      setActiveConflictReservation((prev) => {
        if (!prev) return null;
        const stillActive = list.find((r) => r.id === prev.id);
        return stillActive || null;
      });
    };

    updateReservationsFromMap();
    const handleReservationsObserver = () => {
      updateReservationsFromMap();
    };
    session.reservationsMap.observe(handleReservationsObserver);

    // Ensure model reflects current Y.Text before binding to prevent blank flash
    if (session.ytext.length > 0) {
      if (model.getValue() !== session.ytext.toString()) {
        model.setValue(session.ytext.toString());
      }
    }

    // Bind Y.Text to the file's dedicated Monaco model and Awareness
    const binding = new MonacoBinding(
      session.ytext,
      model,
      new Set([editorInstance]),
      session.provider.awareness
    );
    bindingRef.current = binding;

    // Observe Y.Text changes for dirty tracking and debounced autosave
    const handleYTextObserver = () => {
      onContentChangeRef.current(activeFile.id, session.ytext.toString());
    };
    session.ytext.observe(handleYTextObserver);

    // Local activity handler: touches lastLocalActivityRef, resets isInactive, updates dynamic 10-line reservation
    const markLocalActivity = (cursorPos?: { lineNumber: number; column: number }) => {
      lastLocalActivityRef.current = Date.now();
      if (isInactiveRef.current) {
        isInactiveRef.current = false;
        session.provider.awareness.setLocalStateField('isInactive', false);
      }

      const currentLine = cursorPos
        ? cursorPos.lineNumber
        : editorInstance.getPosition()?.lineNumber || 1;
      const currentColumn = cursorPos
        ? cursorPos.column
        : editorInstance.getPosition()?.column || 1;
      const totalLines = editorInstance.getModel()?.getLineCount() || 1;

      collaborationClient.updateLocalAwareness(
        session.provider,
        user,
        activeFile.path,
        { lineNumber: currentLine, column: currentColumn },
        false
      );

      // Dynamically calculate and reserve 10-line workspace block centered around user's line
      const dynWindow = calculateDynamicWindow(currentLine, totalLines);
      const autoResId = `auto_${user.id}_${activeFile.id}`;
      const existing = session.reservationsMap.get(autoResId);

      if (
        !existing ||
        existing.startLine !== dynWindow.startLine ||
        existing.endLine !== dynWindow.endLine ||
        existing.activeLine !== currentLine
      ) {
        session.reservationsMap.set(autoResId, {
          id: autoResId,
          roomId,
          fileId: activeFile.id,
          filePath: activeFile.path,
          ownerId: user.id,
          ownerName: user.name,
          ownerColor: user.color,
          startLine: dynWindow.startLine,
          endLine: dynWindow.endLine,
          activeLine: currentLine,
          createdAt: existing?.createdAt || Date.now(),
          expiresAt: Date.now() + 30_000,
          isAutomatic: true,
          taskDescription: `Active Workspace (Lines ${dynWindow.startLine}–${dynWindow.endLine})`,
        });
      }

      const now = Date.now();
      const conflict = reservations.find(
        (r) =>
          r.filePath === activeFile.path &&
          r.ownerId !== user.id &&
          r.expiresAt > now &&
          currentLine >= r.startLine &&
          currentLine <= r.endLine
      );
      setActiveConflictReservation(conflict || null);
    };

    const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
      markLocalActivity({ lineNumber: e.position.lineNumber, column: e.position.column });
    });

    const keyDisposable = editorInstance.onKeyDown(() => {
      markLocalActivity();
    });

    const mouseDisposable = editorInstance.onMouseDown(() => {
      markLocalActivity();
    });

    // Seed initial reservation on mount
    markLocalActivity();

    return () => {
      // Release automatic reservation when switching away from this file
      const autoResId = `auto_${user.id}_${activeFile.id}`;
      if (session.reservationsMap.has(autoResId)) {
        session.reservationsMap.delete(autoResId);
      }

      session.provider.off('status', handleStatus);
      session.provider.off('sync', handleSync);
      session.provider.awareness.off('change', handleAwareness);
      cursorDisposable.dispose();
      keyDisposable.dispose();
      mouseDisposable.dispose();
      session.ytext.unobserve(handleYTextObserver);
      session.reservationsMap.unobserve(handleReservationsObserver);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomId, activeFile?.id, activeFile?.path, activeFile?.language, editorInstance, monacoInstance, user.id]);

  // Render Monaco visual decorations for active reservations (both 10-line window & active line)
  useEffect(() => {
    if (!editorInstance || !monacoInstance || !activeFile) return;

    const now = Date.now();
    const active = reservations.filter(
      (r) => r.filePath === activeFile.path && r.expiresAt > now
    );

    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    active.forEach((r) => {
      const isMine = r.ownerId === user.id;
      const safeId = r.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const activeLineNum = r.activeLine || r.startLine;

      // 1. 10-line workspace window decoration
      newDecorations.push({
        range: new monacoInstance.Range(r.startLine, 1, r.endLine, 1),
        options: {
          isWholeLine: true,
          className: `res-window-${safeId}`,
          glyphMarginClassName: `res-glyph-${safeId}`,
          glyphMarginHoverMessage: {
            value: isMine
              ? `🔒 **My Reserved 10-Line Workspace** (Lines ${r.startLine}–${r.endLine})\nActive editing Line ${activeLineNum}.`
              : `🔒 **Reserved by ${r.ownerName}** (Lines ${r.startLine}–${r.endLine})\nCurrently editing Line ${activeLineNum}. Locked to prevent conflicts.`,
          },
          hoverMessage: {
            value: isMine
              ? `✨ **My Active 10-Line Workspace** (Lines ${r.startLine}–${r.endLine})`
              : `🔒 **Reserved by ${r.ownerName}** (Lines ${r.startLine}–${r.endLine})\nEditing locked in this section until ${r.ownerName} leaves.`,
          },
        },
      });

      // 2. Exact current active line highlight with real-time presence tag
      if (activeLineNum >= r.startLine && activeLineNum <= r.endLine) {
        newDecorations.push({
          range: new monacoInstance.Range(activeLineNum, 1, activeLineNum, 1),
          options: {
            isWholeLine: true,
            className: `res-active-line-${safeId}`,
          },
        });
      }
    });

    syncCollaboratorReservationStyles(active, user.id);

    decorationIdsRef.current = editorInstance.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, [reservations, editorInstance, monacoInstance, activeFile?.path, user.id]);

  // Periodic Lease Auto-Renewal, Inactivity check, and expired/departed peer reservation cleanup
  useEffect(() => {
    const interval = window.setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      const now = Date.now();

      // Check inactivity locally
      const idleTime = now - lastLocalActivityRef.current;
      if (idleTime >= INACTIVITY_TIMEOUT_MS && !isInactiveRef.current) {
        isInactiveRef.current = true;
        session.provider.awareness.setLocalStateField('isInactive', true);
        const autoResId = `auto_${user.id}_${activeFile?.id}`;
        if (session.reservationsMap.has(autoResId)) {
          session.reservationsMap.delete(autoResId);
        }
      }

      const states = session.provider.awareness.getStates();
      const connectedUserIds = new Set<string>();
      const inactiveUserIds = new Set<string>();
      states.forEach((state) => {
        if (state && state.user && state.user.id) {
          connectedUserIds.add(state.user.id);
          if (state.isInactive) {
            inactiveUserIds.add(state.user.id);
          }
        }
      });

      session.reservationsMap.forEach((res, key) => {
        // If owner disconnected (left the codebase), prune immediately
        if (!connectedUserIds.has(res.ownerId)) {
          session.reservationsMap.delete(key);
          return;
        }

        // If owner is inactive and this is an automatic reservation, prune immediately
        if (inactiveUserIds.has(res.ownerId) && (res.isAutomatic || key.startsWith('auto_'))) {
          session.reservationsMap.delete(key);
          return;
        }

        if (res.ownerId === user.id) {
          if (!isInactiveRef.current) {
            // Auto-renew while owner is actively connected and NOT inactive
            session.reservationsMap.set(key, {
              ...res,
              expiresAt: now + 30_000,
            });
          } else if (res.isAutomatic || key.startsWith('auto_')) {
            session.reservationsMap.delete(key);
          }
        } else if (res.expiresAt <= now) {
          session.reservationsMap.delete(key);
        }
      });
    }, 2_500);

    return () => window.clearInterval(interval);
  }, [user.id, activeFile?.id]);

  // Clean up reservations when leaving the page or closing tab
  useEffect(() => {
    const handleLeave = () => {
      const session = sessionRef.current;
      if (session) {
        session.reservationsMap.forEach((res, key) => {
          if (res.ownerId === user.id) {
            session.reservationsMap.delete(key);
          }
        });
        try {
          session.provider.awareness.setLocalState(null);
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);

    return () => {
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      handleLeave();
    };
  }, [user.id]);

  // Follow Mode: Smoothly scroll and reveal target collaborator's cursor
  useEffect(() => {
    if (!followState || !editorInstance || !monacoInstance) return;

    const target = collaborators.find((c) => c.user.id === followState.targetUserId);
    if (!target) return;

    // If followed collaborator is in a different file, request file switch
    if (target.activeFile && activeFile && target.activeFile !== activeFile.path) {
      onFollowFileChangeRef.current?.(target.activeFile);
      return;
    }

    if (!target.cursor) return;

    if (target.cursor.lineNumber !== lastFollowedLineRef.current) {
      lastFollowedLineRef.current = target.cursor.lineNumber;
      editorInstance.revealPositionInCenterIfOutsideViewport(
        { lineNumber: target.cursor.lineNumber, column: target.cursor.column },
        monacoInstance.editor.ScrollType.Smooth
      );
    }
  }, [collaborators, followState, editorInstance, monacoInstance, activeFile?.path]);

  // Break out of Follow Mode on Escape
  useEffect(() => {
    if (!editorInstance) return;
    const keyDisposable = editorInstance.onKeyDown((e) => {
      if (e.keyCode === 9 /* Escape key in Monaco */) {
        setFollowState(null);
        lastFollowedLineRef.current = null;
      }
    });
    return () => keyDisposable.dispose();
  }, [editorInstance]);

  // Dispose all sessions and models when leaving the workspace completely
  useEffect(() => {
    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      modelsMapRef.current.forEach((model) => model.dispose());
      modelsMapRef.current.clear();
      collaborationClient.destroyAllSessions();
    };
  }, []);

  const reserveLines = useCallback(
    (startLine: number, endLine: number, taskDescription?: string) => {
      const session = sessionRef.current;
      if (!session || !activeFile) return;

      const resId = `res_${Math.random().toString(36).substring(2, 9)}`;
      const newRes: EditReservation = {
        id: resId,
        roomId,
        fileId: activeFile.id,
        filePath: activeFile.path,
        ownerId: user.id,
        ownerName: user.name,
        ownerColor: user.color,
        startLine: Math.min(startLine, endLine),
        endLine: Math.max(startLine, endLine),
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        taskDescription,
      };

      session.reservationsMap.set(resId, newRes);
    },
    [roomId, activeFile, user]
  );

  const releaseReservation = useCallback((reservationId: string) => {
    const session = sessionRef.current;
    if (!session) return;
    session.reservationsMap.delete(reservationId);
  }, []);

  const startFollowing = useCallback(
    (targetUserId: string, targetUserName: string, targetUserColor: string, targetFile?: string) => {
      setFollowState({
        targetUserId,
        targetUserName,
        targetUserColor,
        targetFile: targetFile || activeFile?.path,
      });
    },
    [activeFile?.path]
  );

  const stopFollowing = useCallback(() => {
    setFollowState(null);
    lastFollowedLineRef.current = null;
  }, []);

  const reconcileSession = useCallback(() => {
    if (!roomId || !activeFile) return;
    collaborationClient.reconnectSession(roomId, activeFile.path);

    const session = sessionRef.current;
    if (session && editorInstance) {
      const model = editorInstance.getModel();
      if (model && session.provider.synced && session.ytext.length > 0) {
        if (model.getValue() !== session.ytext.toString()) {
          model.setValue(session.ytext.toString());
        }
      }
    }
  }, [roomId, activeFile, editorInstance]);

  const applyContentToSharedDoc = useCallback((newFullContent: string) => {
    const session = sessionRef.current;
    if (!session) return;

    session.ydoc.transact(() => {
      session.ytext.delete(0, session.ytext.length);
      session.ytext.insert(0, newFullContent);
    });
  }, []);

  return {
    connectionStatus,
    isDocumentSynced,
    collaborators,
    reservations,
    activeConflictReservation,
    followState,
    reserveLines,
    releaseReservation,
    startFollowing,
    stopFollowing,
    reconcileSession,
    applyContentToSharedDoc,
  };
}
