import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditReservation, UserProfile } from '../types';

import { getYjsWsUrl } from '../config/endpoints';

export interface FileCollaborationSession {
  docKey: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  ytext: Y.Text;
  reservationsMap: Y.Map<EditReservation>;
  serverUrl: string;
  destroy: () => void;
}

class CollaborationManager {
  private sessions = new Map<string, FileCollaborationSession>();
  private lastWsUrl: string = '';

  public getLastWsUrl(): string {
    return this.lastWsUrl || getYjsWsUrl();
  }

  /**
   * Creates or retrieves an isolated Y.Doc and WebsocketProvider per file: `${roomId}:${filePath}`
   * Ensuring switching files never overwrites or shares a single static Y.Doc buffer.
   */
  public getOrCreateFileSession(
    roomId: string,
    filePath: string,
    user: UserProfile,
    initialContent: string
  ): FileCollaborationSession {
    const normalizedPath = filePath.replace(/^\/+/, '');
    const docKey = `${roomId}:${normalizedPath}`;

    const existing = this.sessions.get(docKey);
    if (existing) {
      this.updateLocalAwareness(existing.provider, user, normalizedPath);
      // If already connected and synced but buffer is still empty, seed content
      if (existing.provider.synced && existing.ytext.length === 0 && initialContent.length > 0) {
        existing.ydoc.transact(() => {
          if (existing.ytext.length === 0) {
            existing.ytext.insert(0, initialContent);
          }
        });
      }
      return existing;
    }

    const wsUrl = getYjsWsUrl();
    this.lastWsUrl = wsUrl;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, docKey, ydoc, {
      connect: true,
      // Disable local browser BroadcastChannel to guarantee true client-server WebSocket transport
      disableBc: true,
      // Keep resyncInterval disabled (-1) so text updates flow exclusively over WebSocket messages
      resyncInterval: -1,
    });
    const ytext = ydoc.getText('monaco');

    // Seed initial content from DB only after initial sync if the Y.Text buffer is still empty
    const handleSync = (isSynced: boolean) => {
      if (isSynced && ytext.length === 0 && initialContent.length > 0) {
        ydoc.transact(() => {
          if (ytext.length === 0) {
            ytext.insert(0, initialContent);
          }
        });
      }
    };

    provider.on('sync', handleSync);
    this.updateLocalAwareness(provider, user, normalizedPath);

    const reservationsMap = ydoc.getMap<EditReservation>('edit_reservations');

    const session: FileCollaborationSession = {
      docKey,
      ydoc,
      provider,
      ytext,
      reservationsMap,
      serverUrl: wsUrl,
      destroy: () => {
        provider.off('sync', handleSync);
        provider.disconnect();
        provider.destroy();
        ydoc.destroy();
        this.sessions.delete(docKey);
      },
    };

    this.sessions.set(docKey, session);
    return session;
  }

  public getSession(roomId: string, filePath: string): FileCollaborationSession | undefined {
    const normalizedPath = filePath.replace(/^\/+/, '');
    const docKey = `${roomId}:${normalizedPath}`;
    return this.sessions.get(docKey);
  }

  public reconnectSession(roomId: string, filePath: string): boolean {
    const session = this.getSession(roomId, filePath);
    if (!session) return false;
    if (!session.provider.wsconnected) {
      session.provider.connect();
      return true;
    }
    return false;
  }

  public updateLocalAwareness(
    provider: WebsocketProvider,
    user: UserProfile,
    activeFile: string,
    cursor?: { lineNumber: number; column: number } | null,
    isInactive?: boolean,
    isTyping?: boolean
  ): void {
    provider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: user.color,
    });
    provider.awareness.setLocalStateField('activeFile', activeFile);
    if (cursor !== undefined) {
      provider.awareness.setLocalStateField('cursor', cursor);
    }
    if (isInactive !== undefined) {
      provider.awareness.setLocalStateField('isInactive', isInactive);
    }
    if (isTyping !== undefined) {
      provider.awareness.setLocalStateField('isTyping', isTyping);
    }
    provider.awareness.setLocalStateField('lastActive', Date.now());
  }

  public destroyAllSessions(): void {
    this.sessions.forEach((session) => session.destroy());
    this.sessions.clear();
  }
}

export const collaborationClient = new CollaborationManager();
