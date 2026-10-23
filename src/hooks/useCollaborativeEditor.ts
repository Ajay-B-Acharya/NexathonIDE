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
  updateReservationRange: (reservationId: string, startLine: number, endLine: number) => void;
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

/**
 * Calculates a dynamic non-overlapping reservation window around currentLine:
 * - Strictly uses 10-line reservation ONLY if:
 *     (activeUserCount > 1) AND (totalLines >= 10 * activeUserCount)
 * - Otherwise (if single user or totalLines < 10 * activeUserCount):
 *     strictly uses 1-line reservation (currentLine..currentLine).
 * - When 10-line reservation is active, it strictly partitions lines so that
 *   active users do not overlap with one another.
 */
function calculateNonOverlappingDynamicWindow(
  currentLine: number,
  totalLines: number,
  activeUserCount: number,
  peerReservations: EditReservation[]
): { startLine: number; endLine: number } {
  const safeLine = Math.max(1, Math.min(currentLine, Math.max(1, totalLines)));

  // Strict condition: more than 1 user AND totalLines >= 10 * activeUserCount
  const canUse10LineWindow =
    activeUserCount > 1 && totalLines >= DYNAMIC_RESERVATION_LINES * activeUserCount;

  if (!canUse10LineWindow) {
    return { startLine: safeLine, endLine: safeLine };
  }

  // Filter and sort active peer reservations on this file
  const sortedPeers = [...peerReservations]
    .filter((r) => r.startLine <= totalLines && r.endLine >= 1)
    .sort((a, b) => a.startLine - b.startLine);

  let gapStart = 1;
  let gapEnd = totalLines;

  for (const peer of sortedPeers) {
    if (peer.endLine < safeLine) {
      gapStart = Math.max(gapStart, peer.endLine + 1);
    } else if (peer.startLine > safeLine) {
      gapEnd = Math.min(gapEnd, peer.startLine - 1);
      break;
    } else {
      // User is currently at or inside peer's reservation
      return { startLine: safeLine, endLine: safeLine };
    }
  }

  if (gapStart > gapEnd) {
    return { startLine: safeLine, endLine: safeLine };
  }

  const gapLength = gapEnd - gapStart + 1;

  if (gapLength < DYNAMIC_RESERVATION_LINES) {
    // Gap is smaller than 10 lines: use available gap to avoid any overlap
    return { startLine: gapStart, endLine: gapEnd };
  }

  // Desired 10-line window centered around safeLine
  let start = safeLine - 4;
  let end = start + DYNAMIC_RESERVATION_LINES - 1;

  if (start < gapStart) {
    start = gapStart;
    end = start + DYNAMIC_RESERVATION_LINES - 1;
  }
  if (end > gapEnd) {
    end = gapEnd;
    start = end - DYNAMIC_RESERVATION_LINES + 1;
  }

  start = Math.max(gapStart, start);
  end = Math.min(gapEnd, end);

  return { startLine: start, endLine: end };
}

/**
 * Dynamically injects CSS rules for each user's reserved window, active line,
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
      const color = r.ownerColor || (isMine ? '#14b8a6' : '#f59e0b');
      const safeId = r.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeName = (r.ownerName || 'Collaborator').replace(/"/g, '\\"');
      const activeLineNum = r.activeLine || r.startLine;

      if (isMine) {
        return `
          .res-window-${safeId} {
            background-color: ${color}12 !important;
            border-left: 3px solid ${color}aa !important;
            position: relative;
          }
          .res-active-line-${safeId} {
            background-color: ${color}20 !important;
            border-left: 4px solid ${color} !important;
            box-shadow: inset 0 0 10px ${color}15;
            position: relative;
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
      }

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
          right: 18px;
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

  const bindingRef = useRef<MonacoBinding | null>(null);
  const sessionRef = useRef<FileCollaborationSession | null>(null);
  const modelsMapRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
  const decorationIdsRef = useRef<string[]>([]);
  const lastFollowedLineRef = useRef<number | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awarenessThrottleRef = useRef<number>(0);
  const lastActiveLineRef = useRef<number>(1);

  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const onFollowFileChangeRef = useRef(onFollowFileChange);
  onFollowFileChangeRef.current = onFollowFileChange;

  // Debounced reservation updater fired strictly when user stops typing / moving cursor
  const handleUserStoppedTyping = useCallback(
    (targetLine: number) => {
      const session = sessionRef.current;
      if (!session || !activeFile || !editorInstance) return;

      // Broadcast typing finished in awareness
      collaborationClient.updateLocalAwareness(
        session.provider,
        user,
        activeFile.path,
        {
          lineNumber: targetLine,
          column: editorInstance.getPosition()?.column || 1,
        },
        false
      );

      const autoResId = `auto_${user.id}_${activeFile.id}`;
      // If user holds an active manual reservation, do not overwrite it with auto-reservation
      const myManualRes = Array.from(session.reservationsMap.values()).find(
        (r) => r.ownerId === user.id && r.filePath === activeFile.path && !r.isAutomatic
      );
      if (myManualRes) return;

      const totalLines = editorInstance.getModel()?.getLineCount() || 1;

      // Determine active users on this file from awareness
      const activeFileUsers = new Set<string>();
      session.provider.awareness.getStates().forEach((state) => {
        if (state && state.user && (state.user as UserProfile).id) {
          if (!state.activeFile || state.activeFile === activeFile.path) {
            activeFileUsers.add((state.user as UserProfile).id);
          }
        }
      });
      activeFileUsers.add(user.id);
      const activeCount = activeFileUsers.size;

      // Collect active peer reservations
      const now = Date.now();
      const peerReservations: EditReservation[] = [];
      session.reservationsMap.forEach((r) => {
        if (r.ownerId !== user.id && r.filePath === activeFile.path && r.expiresAt > now) {
          peerReservations.push(r);
        }
      });

      const dynWindow = calculateNonOverlappingDynamicWindow(
        targetLine,
        totalLines,
        activeCount,
        peerReservations
      );

      const existing = session.reservationsMap.get(autoResId);
      if (
        !existing ||
        existing.startLine !== dynWindow.startLine ||
        existing.endLine !== dynWindow.endLine ||
        existing.activeLine !== targetLine
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
          activeLine: targetLine,
          createdAt: existing?.createdAt || Date.now(),
          expiresAt: Date.now() + 15_000,
          isAutomatic: true,
          taskDescription:
            dynWindow.startLine === dynWindow.endLine
              ? `Active Line ${dynWindow.startLine}`
              : `Workspace Block (Lines ${dynWindow.startLine}–${dynWindow.endLine})`,
        });
      }

      const conflict = peerReservations.find(
        (r) => targetLine >= r.startLine && targetLine <= r.endLine
      );
      setActiveConflictReservation(conflict || null);
    },
    [roomId, activeFile, user, editorInstance]
  );

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

    // Synchronize edit reservations from CRDT shared map with strict ghost pruning
    const updateReservationsFromMap = (activeUserIds?: Set<string>) => {
      const now = Date.now();
      const list: EditReservation[] = [];

      let validUserIds = activeUserIds;
      if (!validUserIds) {
        validUserIds = new Set<string>();
        session.provider.awareness.getStates().forEach((state) => {
          if (state && state.user && (state.user as UserProfile).id) {
            if (!state.activeFile || state.activeFile === activeFile.path) {
              validUserIds!.add((state.user as UserProfile).id);
            }
          }
        });
        validUserIds.add(user.id);
      }

      session.reservationsMap.forEach((res, key) => {
        // 1. Purge expired leases
        if (res.expiresAt <= now) {
          session.reservationsMap.delete(key);
          return;
        }

        // 2. Ghost prevention: Purge automatic reservations if owner is no longer active on this file
        if (res.isAutomatic && !validUserIds!.has(res.ownerId)) {
          session.reservationsMap.delete(key);
          return;
        }

        // 3. Must match active file
        if (res.filePath !== activeFile.path) {
          return;
        }

        // 4. Update owner name & color from fresh awareness state
        const liveState = Array.from(session.provider.awareness.getStates().values()).find(
          (s) => (s.user as UserProfile)?.id === res.ownerId
        );

        list.push({
          ...res,
          ownerName: (liveState?.user as UserProfile)?.name || res.ownerName,
          ownerColor: (liveState?.user as UserProfile)?.color || res.ownerColor,
        });
      });

      setReservations(list);
    };

    // Attach peer awareness listener and immediate ghost-purge
    const handleAwareness = () => {
      const states = session.provider.awareness.getStates();
      const list: CollaboratorPresence[] = [];
      const activeUserIds = new Set<string>();

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

          if (!state.activeFile || state.activeFile === activeFile.path) {
            activeUserIds.add((state.user as UserProfile).id);
          }
        }
      });

      activeUserIds.add(user.id);

      setCollaborators(list);
      syncCollaboratorCursorStyles(list);
      updateReservationsFromMap(activeUserIds);
    };

    session.provider.awareness.on('change', handleAwareness);
    handleAwareness();

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

    // Initialize reservation on initial mount
    const initLine = editorInstance.getPosition()?.lineNumber || 1;
    lastActiveLineRef.current = initLine;
    handleUserStoppedTyping(initLine);

    // Track local cursor position in awareness with lag-free throttled broadcast
    const cursorDisposable = editorInstance.onDidChangeCursorPosition((e) => {
      const currentLine = e.position.lineNumber;
      lastActiveLineRef.current = currentLine;

      const now = Date.now();
      if (now - awarenessThrottleRef.current > 120) {
        awarenessThrottleRef.current = now;
        collaborationClient.updateLocalAwareness(session.provider, user, activeFile.path, {
          lineNumber: currentLine,
          column: e.position.column,
        });
      }

      // Debounce reservation update: only update when user pauses/stops typing or navigating!
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        handleUserStoppedTyping(currentLine);
      }, 280);
    });

    // Track content edits: set typing state and debounce reservation update until typing finishes
    const contentDisposable = editorInstance.onDidChangeModelContent(() => {
      collaborationClient.updateLocalAwareness(
        session.provider,
        user,
        activeFile.path,
        {
          lineNumber: lastActiveLineRef.current,
          column: editorInstance.getPosition()?.column || 1,
        },
        true
      );

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        handleUserStoppedTyping(lastActiveLineRef.current);
      }, 320);
    });

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      // Release automatic reservation when switching away from this file
      const autoResId = `auto_${user.id}_${activeFile.id}`;
      if (session.reservationsMap.has(autoResId)) {
        session.reservationsMap.delete(autoResId);
      }

      session.provider.off('status', handleStatus);
      session.provider.off('sync', handleSync);
      session.provider.awareness.off('change', handleAwareness);
      cursorDisposable.dispose();
      contentDisposable.dispose();
      session.ytext.unobserve(handleYTextObserver);
      session.reservationsMap.unobserve(handleReservationsObserver);
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    };
  }, [roomId, activeFile?.id, activeFile?.path, activeFile?.language, editorInstance, monacoInstance, user.id, handleUserStoppedTyping]);

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

  // Periodic Lease Auto-Renewal for owned reservations & fast expired reservation cleanup (5s/15s)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const session = sessionRef.current;
      if (!session) return;
      const now = Date.now();

      session.reservationsMap.forEach((res, key) => {
        if (res.ownerId === user.id) {
          // Fast auto-renew while actively connected
          session.reservationsMap.set(key, {
            ...res,
            expiresAt: now + 15_000,
          });
        } else if (res.expiresAt <= now) {
          // Clean up expired peer lease immediately
          session.reservationsMap.delete(key);
        }
      });
    }, 5_000);

    return () => window.clearInterval(interval);
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

      // Clean up auto reservation so user's manual reservation takes precedence
      const autoResId = `auto_${user.id}_${activeFile.id}`;
      if (session.reservationsMap.has(autoResId)) {
        session.reservationsMap.delete(autoResId);
      }

      const resId = `res_${Math.random().toString(36).substring(2, 9)}`;
      const clampedStart = Math.min(startLine, endLine);
      const clampedEnd = Math.max(startLine, endLine);

      const newRes: EditReservation = {
        id: resId,
        roomId,
        fileId: activeFile.id,
        filePath: activeFile.path,
        ownerId: user.id,
        ownerName: user.name,
        ownerColor: user.color,
        startLine: clampedStart,
        endLine: clampedEnd,
        activeLine: clampedStart,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        isAutomatic: false,
        taskDescription:
          taskDescription || `Reserved Section (Lines ${clampedStart}–${clampedEnd})`,
      };

      session.reservationsMap.set(resId, newRes);
    },
    [roomId, activeFile, user]
  );

  const updateReservationRange = useCallback(
    (reservationId: string, startLine: number, endLine: number) => {
      const session = sessionRef.current;
      if (!session || !activeFile) return;

      const existing = session.reservationsMap.get(reservationId);
      if (!existing) return;

      const clampedStart = Math.min(startLine, endLine);
      const clampedEnd = Math.max(startLine, endLine);

      session.reservationsMap.set(reservationId, {
        ...existing,
        startLine: clampedStart,
        endLine: clampedEnd,
        isAutomatic: false, // User customized this range manually!
        expiresAt: Date.now() + 60_000,
        taskDescription: `Custom Reserved Range (Lines ${clampedStart}–${clampedEnd})`,
      });
    },
    [activeFile]
  );

  const releaseReservation = useCallback(
    (reservationId: string) => {
      const session = sessionRef.current;
      if (!session) return;
      session.reservationsMap.delete(reservationId);
      handleUserStoppedTyping(lastActiveLineRef.current);
    },
    [handleUserStoppedTyping]
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
    activeConflictReservation,
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
