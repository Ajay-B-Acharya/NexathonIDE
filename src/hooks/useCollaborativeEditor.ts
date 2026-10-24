import { useEffect, useRef, useState, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import { collaborationClient, FileCollaborationSession } from '../services/collaborationClient';
import {
  CollaboratorPresence,
  ConnectionStatus,
  FollowState,
  LineLockNotice,
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
  followState: FollowState | null;
  lineLockNotice: LineLockNotice | null;
  startFollowing: (targetUserId: string, targetUserName: string, targetUserColor: string, targetFile?: string) => void;
  stopFollowing: () => void;
  reconcileSession: () => void;
  applyContentToSharedDoc: (newFullContent: string) => void;
}

/**
 * Dynamically injects per-client cursor CSS styles so y-monaco awareness
 * cursors, selection highlights, and locked line indicators display cleanly.
 */
function syncCollaboratorCursorStyles(collaborators: CollaboratorPresence[]) {
  const styleId = 'nexathon-yjs-cursor-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const cursorRules = collaborators
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

  const lineLockRules = `
    .y-locked-line-bg {
      background-color: rgba(255, 112, 87, 0.08) !important;
      border-left: 3px solid #FF7057 !important;
    }
    .y-locked-line-glyph {
      position: relative;
      display: flex !important;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%23FF7057" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>');
      background-repeat: no-repeat;
      background-position: center center;
      cursor: not-allowed;
    }
  `;

  styleEl.textContent = `${cursorRules}\n${lineLockRules}`;
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
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [lineLockNotice, setLineLockNotice] = useState<LineLockNotice | null>(null);

  const bindingRef = useRef<MonacoBinding | null>(null);
  const sessionRef = useRef<FileCollaborationSession | null>(null);
  const modelsMapRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const lastFollowedLineRef = useRef<number | null>(null);
  const lockedDecorationsRef = useRef<string[]>([]);
  const lockedLinesMapRef = useRef<Map<number, { userId: string; userName: string; userColor: string }>>(new Map());
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Enforce readOnly on Monaco if current cursor or selection overlaps a peer-locked line
    const enforceLineLockReadOnly = (
      targetSelection?: Monaco.Selection | null,
      targetPosition?: Monaco.Position | null
    ) => {
      if (!editorInstance) return;
      const sel = targetSelection || editorInstance.getSelection();
      const pos = targetPosition || editorInstance.getPosition();
      if (!sel && !pos) return;

      const startLine = sel
        ? Math.min(sel.startLineNumber, sel.endLineNumber)
        : pos!.lineNumber;
      const endLine = sel
        ? Math.max(sel.startLineNumber, sel.endLineNumber)
        : pos!.lineNumber;

      let lockedBy: { line: number; userName: string; userColor: string } | null = null;
      for (let l = startLine; l <= endLine; l++) {
        const lock = lockedLinesMapRef.current.get(l);
        if (lock) {
          lockedBy = { line: l, userName: lock.userName, userColor: lock.userColor };
          break;
        }
      }

      if (lockedBy) {
        editorInstance.updateOptions({ readOnly: true });
        setLineLockNotice({
          line: lockedBy.line,
          userName: lockedBy.userName,
          userColor: lockedBy.userColor,
        });
      } else {
        editorInstance.updateOptions({ readOnly: false });
        setLineLockNotice(null);
      }
    };

    // Attach peer awareness listener & calculate active line locks
    const handleAwareness = () => {
      const states = session.provider.awareness.getStates();
      const list: CollaboratorPresence[] = [];
      const newLockedMap = new Map<number, { userId: string; userName: string; userColor: string }>();
      const currentNormActive = (activeFile.path || '').replace(/^\/+/, '');

      states.forEach((state, clientId) => {
        if (state && state.user) {
          const userObj = state.user as UserProfile;
          const targetActiveFile = state.activeFile as string | undefined;
          const targetCursor = state.cursor as { lineNumber: number; column: number } | null | undefined;
          const isTyping = Boolean(state.isTyping);
          const lastActive = (state.lastActive as number) || Date.now();
          const editingLine = state.editingLine as number | undefined;
          const editingTimestamp = (state.editingTimestamp as number) || 0;

          list.push({
            clientId,
            user: userObj,
            activeFile: targetActiveFile,
            cursor: targetCursor,
            isTyping,
            lastActive,
          });

          // Check if this collaborator locks a line for the local user:
          const targetNormFile = (targetActiveFile || '').replace(/^\/+/, '');
          if (userObj.id !== user.id && targetNormFile === currentNormActive) {
            const isEditingActive = editingTimestamp > 0 && Date.now() - editingTimestamp < 5000;
            const isTypingActive = isTyping || (Date.now() - lastActive < 4000);

            if (editingLine && isEditingActive) {
              newLockedMap.set(editingLine, {
                userId: userObj.id,
                userName: userObj.name,
                userColor: userObj.color || '#FF7057',
              });
            } else if (targetCursor?.lineNumber && isTypingActive) {
              newLockedMap.set(targetCursor.lineNumber, {
                userId: userObj.id,
                userName: userObj.name,
                userColor: userObj.color || '#FF7057',
              });
            }
          }
        }
      });

      setCollaborators(list);
      syncCollaboratorCursorStyles(list);
      lockedLinesMapRef.current = newLockedMap;

      // Update line lock decorations in Monaco
      if (editorInstance && monacoInstance) {
        const decorations: Monaco.editor.IModelDeltaDecoration[] = [];
        newLockedMap.forEach((info, lineNum) => {
          decorations.push({
            range: new monacoInstance.Range(lineNum, 1, lineNum, 1),
            options: {
              isWholeLine: true,
              className: 'y-locked-line-bg',
              glyphMarginClassName: 'y-locked-line-glyph',
              glyphMarginHoverMessage: {
                value: `🔒 **Line ${lineNum} locked by ${info.userName}**\n\n${info.userName} is actively typing here. Simultaneous edits on this line are restricted.`,
              },
              hoverMessage: {
                value: `🔒 **Line ${lineNum} locked by ${info.userName}**\n\nEditing on this line is disabled while ${info.userName} is typing.`,
              },
            },
          });
        });
        lockedDecorationsRef.current = editorInstance.deltaDecorations(
          lockedDecorationsRef.current,
          decorations
        );

        // Dynamically enforce read-only state if cursor/selection sits on a locked line
        enforceLineLockReadOnly();
      }
    };
    session.provider.awareness.on('change', handleAwareness);
    handleAwareness();

    // Periodic expiration timer for released line locks
    const lockExpiryInterval = setInterval(() => {
      if (lockedLinesMapRef.current.size > 0) {
        handleAwareness();
      }
    }, 1000);

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

    // Track local cursor position in awareness and enforce line lock
    const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
      enforceLineLockReadOnly(null, e.position);
      collaborationClient.updateLocalAwareness(session.provider, user, activeFile.path, {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    const selectionDisposable = editorInstance.onDidChangeCursorSelection((e) => {
      enforceLineLockReadOnly(e.selection, null);
    });

    // Broadcast typing awareness and guard line lock when local user edits
    const contentDisposable = editorInstance.onDidChangeModelContent((e) => {
      if (!e.isFlush && editorInstance.hasTextFocus()) {
        // Guard against modifications on locked lines
        const touchedLocked = e.changes.some((ch) => {
          const startL = ch.range.startLineNumber;
          const endL = ch.range.endLineNumber;
          for (let l = startL; l <= endL; l++) {
            if (lockedLinesMapRef.current.has(l)) return true;
          }
          return false;
        });

        if (touchedLocked) {
          editorInstance.trigger('lineLock', 'undo', null);
          enforceLineLockReadOnly();
          return;
        }

        const pos = editorInstance.getPosition();
        if (pos) {
          collaborationClient.updateLocalAwareness(
            session.provider,
            user,
            activeFile.path,
            { lineNumber: pos.lineNumber, column: pos.column },
            false,
            true,
            pos.lineNumber
          );
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          const cur = editorInstance.getPosition();
          collaborationClient.updateLocalAwareness(
            session.provider,
            user,
            activeFile.path,
            cur ? { lineNumber: cur.lineNumber, column: cur.column } : null,
            false,
            false,
            null
          );
        }, 3000);
      }
    });

    // Rapid keyboard interceptor to alert user immediately on keydown
    const keydownDisposable = editorInstance.onKeyDown((e) => {
      const selection = editorInstance.getSelection();
      const position = editorInstance.getPosition();
      if (!selection && !position) return;

      const startLine = selection
        ? Math.min(selection.startLineNumber, selection.endLineNumber)
        : position!.lineNumber;
      const endLine = selection
        ? Math.max(selection.startLineNumber, selection.endLineNumber)
        : position!.lineNumber;

      let lockedBy: { line: number; userName: string; userColor: string } | null = null;
      for (let l = startLine; l <= endLine; l++) {
        const lock = lockedLinesMapRef.current.get(l);
        if (lock) {
          lockedBy = { line: l, userName: lock.userName, userColor: lock.userColor };
          break;
        }
      }

      if (lockedBy) {
        const KeyCode = monacoInstance.KeyCode;
        const isNavigation =
          e.keyCode === KeyCode.UpArrow ||
          e.keyCode === KeyCode.DownArrow ||
          e.keyCode === KeyCode.LeftArrow ||
          e.keyCode === KeyCode.RightArrow ||
          e.keyCode === KeyCode.Home ||
          e.keyCode === KeyCode.End ||
          e.keyCode === KeyCode.PageUp ||
          e.keyCode === KeyCode.PageDown ||
          e.keyCode === KeyCode.Escape;

        const isCopyOrSelect =
          (e.ctrlKey || e.metaKey) &&
          (e.keyCode === KeyCode.KeyC || e.keyCode === KeyCode.KeyA);

        const isModifierOnly =
          e.keyCode === KeyCode.Ctrl ||
          e.keyCode === KeyCode.Shift ||
          e.keyCode === KeyCode.Alt ||
          e.keyCode === KeyCode.Meta;

        if (!isNavigation && !isCopyOrSelect && !isModifierOnly) {
          e.preventDefault();
          e.stopPropagation();
          enforceLineLockReadOnly(selection, position);
        }
      }
    });

    return () => {
      clearInterval(lockExpiryInterval);
      session.provider.off('status', handleStatus);
      session.provider.off('sync', handleSync);
      session.provider.awareness.off('change', handleAwareness);
      cursorDisposable.dispose();
      selectionDisposable.dispose();
      contentDisposable.dispose();
      keydownDisposable.dispose();
      session.ytext.unobserve(handleYTextObserver);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      if (editorInstance) {
        editorInstance.updateOptions({ readOnly: false });
        if (lockedDecorationsRef.current.length > 0) {
          editorInstance.deltaDecorations(lockedDecorationsRef.current, []);
          lockedDecorationsRef.current = [];
        }
      }
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomId, activeFile?.id, activeFile?.path, activeFile?.language, editorInstance, monacoInstance, user.id]);

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
    followState,
    lineLockNotice,
    startFollowing,
    stopFollowing,
    reconcileSession,
    applyContentToSharedDoc,
  };
}
