import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import * as awarenessProtocol from 'y-protocols/awareness.js';
import type { User, CursorPosition, PresenceUser } from '../types';

const YJS_WS_URL = import.meta.env.VITE_YJS_WS_URL || 'ws://localhost:1234';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export function useCollaborativeEditor(roomId: string, user: User) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awareness, setAwareness] = useState<any>(null);
  const [connectedUsers, setConnectedUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<any>(null);
  const userColorsRef = useRef<Map<string, string>>(new Map());

  const getUserColor = useCallback((userId: string) => {
    if (!userColorsRef.current.has(userId)) {
      const colorIndex = userColorsRef.current.size % CURSOR_COLORS.length;
      userColorsRef.current.set(userId, CURSOR_COLORS[colorIndex]);
    }
    return userColorsRef.current.get(userId)!;
  }, []);

  useEffect(() => {
    if (!roomId || !user) return;

    const ydoc = new Y.Doc();
    setDoc(ydoc);

    const wsProvider = new WebsocketProvider(YJS_WS_URL, roomId, ydoc, {
      connect: true,
    });
    setProvider(wsProvider);
    setAwareness(wsProvider.awareness);

    wsProvider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    wsProvider.awareness.on('change', () => {
      const states = Array.from(wsProvider.awareness.getStates().entries());
      const users: PresenceUser[] = states
        .filter(([, state]: [number, any]) => state && state.user)
        .map(([clientId, state]: [number, any]) => ({
          ...state.user,
          cursor: state.cursor,
          lastActive: new Date(),
        }));
      setConnectedUsers(users);
    });

    wsProvider.awareness.setLocalStateField('user', {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      color: user.color,
      createdAt: user.createdAt,
    });

    return () => {
      wsProvider.awareness.setLocalStateField('user', null);
      wsProvider.destroy();
      ydoc.destroy();
      bindingRef.current?.destroy();
    };
  }, [roomId, user]);

  const bindEditor = useCallback((monacoEditor: any) => {
    if (!doc || !provider || editorRef.current === monacoEditor) return;
    
    editorRef.current = monacoEditor;
    
    if (bindingRef.current) {
      bindingRef.current.destroy();
    }
    
    bindingRef.current = new MonacoBinding(
      doc.getText('codemirror'),
      monacoEditor.getModel(),
      new Set([provider.awareness.clientID]),
      provider.awareness
    );
  }, [doc, provider]);

  const unbindEditor = useCallback(() => {
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    editorRef.current = null;
  }, []);

  const updateCursor = useCallback((position: { lineNumber: number; column: number } | null, selection?: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } | null) => {
    if (!awareness) return;
    
    awareness.setLocalStateField('cursor', position ? {
      userId: user.id,
      username: user.username,
      color: user.color,
      position,
      selection,
    } : null);
  }, [awareness, user]);

  const saveFile = useCallback(async (path: string, content: string) => {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}/files/${encodeURIComponent(path)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Failed to save file');
    return response.json();
  }, [roomId]);

  const createFile = useCallback(async (path: string, content: string = '', language?: string) => {
    const response = await fetch(`${API_URL}/api/rooms/${roomId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, language }),
    });
    if (!response.ok) throw new Error('Failed to create file');
    return response.json();
  }, [roomId]);

  return {
    doc,
    provider,
    awareness,
    connectedUsers,
    isConnected,
    bindEditor,
    unbindEditor,
    updateCursor,
    saveFile,
    createFile,
    getUserColor,
  };
}