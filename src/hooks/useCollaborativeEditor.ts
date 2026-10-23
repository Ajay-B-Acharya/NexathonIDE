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
  startFollowing: (targetUserId: string, targetUserName: string, targetUserColor: string) => void;
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
}: UseCollaborativeEditorOptions): UseCollaborativeEditorReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isDocumentSynced, setIsDocumentSynced] = useState<boolean>(false);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [reservations, setReservations] = useState<EditReservation[]>([]);
  const [activeConflictReservation, setActiveConflictReservation] = useState<EditReservation | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);

  const bindingRef = useRef<MonacoBinding | null>(null);
  const sessionRef = useRef<FileCollaborationSession | null>(null);
  const modelsMapRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const decorationIdsRef = useRef<string[]>([]);
  const lastFollowedLineRef = useRef<number | null>(null);

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  useEffect(() => {
    if (!editorInstance || !monacoInstance || !activeFile || !roomId) {
      return;
    }

    // Clean up previous file's MonacoBinding without destroying cached Y.Doc sessions prematurely
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
      activeFile.content,
      (status) => setConnectionStatus(status),
      (list) => {
        setCollaborators(list);
        syncCollaboratorCursorStyles(list);
      },
      (synced) => setIsDocumentSynced(synced)
    );

    sessionRef.current = session;

    // Synchronize edit reservations from CRDT shared map
    const updateReservationsFromMap = () => {
      const now = Date.now();
      const list: EditReservation[] = [];
      session.reservationsMap.forEach((res) => {
        if (res.expiresAt > now && res.filePath === activeFile.path) {
          list.push(res);
        }
      });
      setReservations(list);
    };

    updateReservationsFromMap();
    const handleReservationsObserver = () => {
      updateReservationsFromMap();
    };
    session.reservationsMap.observe(handleReservationsObserver);

    // If session is already synced and contains text, ensure model reflects it immediately
    if (session.provider.synced && session.ytext.length > 0) {
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

    // Observe Y.Text changes to update dirty indicators and trigger debounced autosave
    const handleYTextObserver = () => {
      onContentChangeRef.current(activeFile.id, session.ytext.toString());
    };
    session.ytext.observe(handleYTextObserver);

    // Track local cursor position in awareness and check for advisory reservation conflicts
    const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
      collaborationClient.updateLocalAwareness(session.provider, user, activeFile.path, {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });

      const now = Date.now();
      const conflict = reservations.find(
        (r) =>
          r.filePath === activeFile.path &&
          r.ownerId !== user.id &&
          r.expiresAt > now &&
          e.position.lineNumber >= r.startLine &&
          e.position.lineNumber <= r.endLine
      );
      setActiveConflictReservation(conflict || null);
    });

    return () => {
      cursorDisposable.dispose();
      session.ytext.unobserve(handleYTextObserver);
      session.reservationsMap.unobserve(handleReservationsObserver);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomId, activeFile?.id, activeFile?.path, activeFile?.language, editorInstance, monacoInstance, user]);

  // Render Monaco visual decorations for active reservations
  useEffect(() => {
    if (!editorInstance || !monacoInstance || !activeFile) return;

    const now = Date.now();
    const active = reservations.filter(
      (r) => r.filePath === activeFile.path && r.expiresAt > now
    );

    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = active.map((r) => {
      const isMine = r.ownerId === user.id;
      return {
        range: new monacoInstance.Range(r.startLine, 1, r.endLine, 1),
        options: {
          isWholeLine: true,
          className: isMine ? 'reservation-owner-line' : 'reservation-peer-line',
          glyphMarginClassName: isMine ? 'reservation-glyph-owner' : 'reservation-glyph-peer',
          glyphMarginHoverMessage: {
            value: isMine
              ? `🔒 **My Reserved Section** (Lines ${r.startLine}-${r.endLine})\nClick Release Section to unreserve.`
              : `🔒 **Reserved by ${r.ownerName}** (Lines ${r.startLine}-${r.endLine})${
                  r.taskDescription ? `\nTask: *${r.taskDescription}*` : ''
                }`,
          },
          hoverMessage: {
            value: isMine
              ? `🔒 **My Reserved Section** (Lines ${r.startLine}-${r.endLine})`
              : `🔒 **Reserved by ${r.ownerName}** (Lines ${r.startLine}-${r.endLine})`,
          },
        },
      };
    });

    decorationIdsRef.current = editorInstance.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, [reservations, editorInstance, monacoInstance, activeFile?.path, user.id]);

  // Periodic Lease Auto-Renewal for owned reservations & expired reservation cleanup
  useEffect(() => {
    const interval = window.setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      const now = Date.now();

      session.reservationsMap.forEach((res, key) => {
        if (res.ownerId === user.id) {
          // Auto-renew while owner is actively connected
          session.reservationsMap.set(key, {
            ...res,
            expiresAt: now + 60_000,
          });
        } else if (res.expiresAt <= now) {
          // Clean up expired peer lease
          session.reservationsMap.delete(key);
        }
      });
    }, 20_000);

    return () => window.clearInterval(interval);
  }, [user.id]);

  // Follow Mode: Smoothly scroll and reveal target collaborator's cursor
  useEffect(() => {
    if (!followState || !editorInstance || !monacoInstance) return;

    const target = collaborators.find((c) => c.user.id === followState.targetUserId);
    if (!target || !target.cursor) return;

    if (target.cursor.lineNumber !== lastFollowedLineRef.current) {
      lastFollowedLineRef.current = target.cursor.lineNumber;
      editorInstance.revealPositionInCenterIfOutsideViewport(
        { lineNumber: target.cursor.lineNumber, column: target.cursor.column },
        monacoInstance.editor.ScrollType.Smooth
      );
    }
  }, [collaborators, followState, editorInstance, monacoInstance]);

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
    (targetUserId: string, targetUserName: string, targetUserColor: string) => {
      setFollowState({
        targetUserId,
        targetUserName,
        targetUserColor,
        targetFile: activeFile?.path,
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
