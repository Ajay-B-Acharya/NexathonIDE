import { useEffect, useRef, useState, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import { collaborationClient, FileCollaborationSession } from '../services/collaborationClient';
import {
  CollaboratorPresence,
  ConnectionStatus,
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
  followState: FollowState | null;
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
  const [followState, setFollowState] = useState<FollowState | null>(null);

  const bindingRef = useRef<MonacoBinding | null>(null);
  const sessionRef = useRef<FileCollaborationSession | null>(null);
  const modelsMapRef = useRef<Map<string, Monaco.editor.ITextModel>>(new Map());
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
            lastActive: (state.lastActive as number) || Date.now(),
          });
        }
      });
      setCollaborators(list);
      syncCollaboratorCursorStyles(list);
    };
    session.provider.awareness.on('change', handleAwareness);
    handleAwareness();

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

    return () => {
      session.provider.off('status', handleStatus);
      session.provider.off('sync', handleSync);
      session.provider.awareness.off('change', handleAwareness);
      cursorDisposable.dispose();
      session.ytext.unobserve(handleYTextObserver);
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
    startFollowing,
    stopFollowing,
    reconcileSession,
    applyContentToSharedDoc,
  };
}
