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

export interface UseCollaborativeEditorReturn {
  connectionStatus: ConnectionStatus;
  isDocumentSynced: boolean;
  collaborators: CollaboratorPresence[];
  reservations: EditReservation[];
  followState: FollowState | null;
  reserveLines: (startLine: number, endLine: number, taskDescription?: string) => boolean;
  releaseReservation: (reservationId: string) => void;
  updateReservationRange: (reservationId: string, startLine: number, endLine: number) => boolean;
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
  const [followState, setFollowState] = useState<FollowState | null>(null);

  const bindingRef = useRef<MonacoBinding | null>(null);
  const sessionRef = useRef<FileCollaborationSession | null>(null);
  const modelsMapRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const lastFollowedLineRef = useRef<number | null>(null);
  const reservationsRef = useRef<EditReservation[]>([]);
  reservationsRef.current = reservations;
  const decorationIdsRef = useRef<string[]>([]);

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
            lastActive: (state.lastActive as number) || Date.now(),
          });
        }
      });
      setCollaborators(list);
      syncCollaboratorCursorStyles(list);
    };
    session.provider.awareness.on('change', handleAwareness);
    handleAwareness();

    // Attach shared edit reservations listener
    const handleReservationsObserver = () => {
      const list: EditReservation[] = [];
      const now = Date.now();
      session.reservationsMap.forEach((res) => {
        if (res && res.filePath === activeFile.path && res.expiresAt > now) {
          list.push(res);
        }
      });
      list.sort((a, b) => a.startLine - b.startLine);
      setReservations(list);
    };
    session.reservationsMap.observe(handleReservationsObserver);
    handleReservationsObserver();

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

    // Track local cursor position in awareness
    const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
      collaborationClient.updateLocalAwareness(session.provider, user, activeFile.path, {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    // Model Content Guardian: If a local edit somehow occurs on a peer-reserved region, revert it immediately
    const contentDisposable = editorInstance.onDidChangeModelContent((e) => {
      const now = Date.now();
      const peerLocks = reservationsRef.current.filter(
        (r) => r.ownerId !== user.id && r.filePath === activeFile.path && r.expiresAt > now
      );
      if (peerLocks.length === 0) return;

      const hasUnauthorizedEdit = e.changes.some((change) => {
        const start = change.range.startLineNumber;
        const end = change.range.endLineNumber;
        return peerLocks.some((lock) => !(end < lock.startLine || start > lock.endLine));
      });

      if (hasUnauthorizedEdit) {
        // Instantly revert to Y.Text authoritative state
        const authoritative = session.ytext.toString();
        const curModel = editorInstance.getModel();
        if (curModel && curModel.getValue() !== authoritative) {
          curModel.setValue(authoritative);
        }
      }
    });

    return () => {
      session.provider.off('status', handleStatus);
      session.provider.off('sync', handleSync);
      session.provider.awareness.off('change', handleAwareness);
      session.reservationsMap.unobserve(handleReservationsObserver);
      cursorDisposable.dispose();
      contentDisposable.dispose();
      session.ytext.unobserve(handleYTextObserver);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomId, activeFile?.id, activeFile?.path, activeFile?.language, editorInstance, monacoInstance, user.id]);

  // Render Monaco visual decorations for active reservations (Teal for owner, Amber for peers)
  useEffect(() => {
    if (!editorInstance || !monacoInstance || !activeFile) return;

    const now = Date.now();
    const active = reservations.filter(
      (r) => r.filePath === activeFile.path && r.expiresAt > now
    );

    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    active.forEach((r) => {
      const isMine = r.ownerId === user.id;

      newDecorations.push({
        range: new monacoInstance.Range(r.startLine, 1, r.endLine, 1),
        options: {
          isWholeLine: true,
          className: isMine ? 'reservation-owner-line' : 'reservation-peer-line',
          glyphMarginClassName: isMine ? 'reservation-glyph-owner' : 'reservation-glyph-peer',
          glyphMarginHoverMessage: {
            value: isMine
              ? `🔒 **My Reserved Section** (Lines ${r.startLine}–${r.endLine})`
              : `🔒 **Reserved by ${r.ownerName}** (Lines ${r.startLine}–${r.endLine})\nProtected from unauthorized editing.`,
          },
          hoverMessage: {
            value: isMine
              ? `✨ **My Reserved Code Region** (Lines ${r.startLine}–${r.endLine})`
              : `🔒 **Reserved by ${r.ownerName}** (Lines ${r.startLine}–${r.endLine})\nProtected from unauthorized editing.`,
          },
        },
      });
    });

    decorationIdsRef.current = editorInstance.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, [reservations, editorInstance, monacoInstance, activeFile?.path, user.id]);

  // Periodic Lease Auto-Renewal & Expired Lease Cleanup
  useEffect(() => {
    const interval = window.setInterval(() => {
      const session = sessionRef.current;
      if (!session || !activeFile) return;
      const now = Date.now();

      session.reservationsMap.forEach((res, key) => {
        if (res.ownerId === user.id && res.filePath === activeFile.path) {
          // Fast auto-renew while actively connected
          session.reservationsMap.set(key, {
            ...res,
            expiresAt: now + 60_000,
          });
        } else if (res.expiresAt <= now) {
          session.reservationsMap.delete(key);
        }
      });
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [user.id, activeFile?.path]);

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
      if (!session || !activeFile) return false;
      const sLine = Math.max(1, Math.min(startLine, endLine));
      const eLine = Math.max(startLine, endLine);
      const now = Date.now();

      // Check non-overlapping with active peer reservations
      const hasConflict = reservationsRef.current.some(
        (r) =>
          r.ownerId !== user.id &&
          r.filePath === activeFile.path &&
          r.expiresAt > now &&
          !(eLine < r.startLine || sLine > r.endLine)
      );
      if (hasConflict) return false;

      // Delete any prior reservation owned by this user on this file
      session.reservationsMap.forEach((r, key) => {
        if (r.ownerId === user.id && r.filePath === activeFile.path) {
          session.reservationsMap.delete(key);
        }
      });

      const resId = `res_${user.id}_${Date.now()}`;
      const newRes: EditReservation = {
        id: resId,
        roomId,
        fileId: activeFile.id,
        filePath: activeFile.path,
        ownerId: user.id,
        ownerName: user.name,
        ownerColor: user.color || '#35B8A6',
        startLine: sLine,
        endLine: eLine,
        activeLine: sLine,
        createdAt: now,
        expiresAt: now + 60_000,
        taskDescription,
      };
      session.reservationsMap.set(resId, newRes);
      return true;
    },
    [roomId, activeFile, user]
  );

  const releaseReservation = useCallback((reservationId: string) => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.reservationsMap.has(reservationId)) {
      const res = session.reservationsMap.get(reservationId);
      if (res && res.ownerId === user.id) {
        session.reservationsMap.delete(reservationId);
      }
    }
  }, [user.id]);

  const updateReservationRange = useCallback(
    (reservationId: string, startLine: number, endLine: number) => {
      const session = sessionRef.current;
      if (!session || !activeFile) return false;
      const res = session.reservationsMap.get(reservationId);
      if (!res || res.ownerId !== user.id) return false;

      const sLine = Math.max(1, Math.min(startLine, endLine));
      const eLine = Math.max(startLine, endLine);
      const now = Date.now();

      // Verify non-overlapping with peers
      const hasConflict = reservationsRef.current.some(
        (r) =>
          r.id !== reservationId &&
          r.ownerId !== user.id &&
          r.filePath === activeFile.path &&
          r.expiresAt > now &&
          !(eLine < r.startLine || sLine > r.endLine)
      );
      if (hasConflict) return false;

      session.reservationsMap.set(reservationId, {
        ...res,
        startLine: sLine,
        endLine: eLine,
        expiresAt: now + 60_000,
      });
      return true;
    },
    [activeFile, user.id]
  );

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
    followState,
    reserveLines,
    releaseReservation,
    updateReservationRange,
    startFollowing,
    stopFollowing,
    reconcileSession,
    applyContentToSharedDoc,
  };
}
