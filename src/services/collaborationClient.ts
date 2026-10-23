import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { CollaboratorPresence, ConnectionStatus, UserProfile } from '../types';

const YJS_WS_URL = (import.meta.env.VITE_YJS_WS_URL as string) || 'ws://localhost:1234';

export interface FileCollaborationSession {
  docKey: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  ytext: Y.Text;
  destroy: () => void;
}

class CollaborationManager {
  private sessions = new Map<string, FileCollaborationSession>();

  /**
   * Creates or retrieves an isolated Y.Doc and WebsocketProvider per file: `${roomId}:${filePath}`
   * Ensuring switching files never overwrites or shares a single static Y.Doc buffer.
   */
  public getOrCreateFileSession(
    roomId: string,
    filePath: string,
    user: UserProfile,
    initialContent: string,
    onStatusChange?: (status: ConnectionStatus) => void,
    onCollaboratorsChange?: (collaborators: CollaboratorPresence[]) => void,
    onSyncChange?: (isSynced: boolean) => void
  ): FileCollaborationSession {
    const normalizedPath = filePath.replace(/^\/+/, '');
    const docKey = `${roomId}:${normalizedPath}`;

    const existing = this.sessions.get(docKey);
    if (existing) {
      this.updateLocalAwareness(existing.provider, user, normalizedPath);
      if (onSyncChange) {
        onSyncChange(existing.provider.synced);
      }
      return existing;
    }

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(YJS_WS_URL, docKey, ydoc, {
      connect: true,
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
      if (onSyncChange) {
        onSyncChange(isSynced);
      }
    };

    provider.on('sync', handleSync);

    provider.on('status', (event: { status: string }) => {
      if (!onStatusChange) return;
      if (event.status === 'connected') onStatusChange('connected');
      else if (event.status === 'connecting') onStatusChange('connecting');
      else onStatusChange('disconnected');
    });

    this.updateLocalAwareness(provider, user, normalizedPath);

    const handleAwarenessUpdate = () => {
      if (!onCollaboratorsChange) return;
      const states = provider.awareness.getStates();
      const collaborators: CollaboratorPresence[] = [];

      states.forEach((state, clientId) => {
        if (state && state.user) {
          collaborators.push({
            clientId,
            user: state.user as UserProfile,
            activeFile: state.activeFile as string | undefined,
            cursor: state.cursor as { lineNumber: number; column: number } | null | undefined,
            isTyping: Boolean(state.isTyping),
            lastActive: (state.lastActive as number) || Date.now(),
          });
        }
      });

      onCollaboratorsChange(collaborators);
    };

    provider.awareness.on('change', handleAwarenessUpdate);
    handleAwarenessUpdate();

    const session: FileCollaborationSession = {
      docKey,
      ydoc,
      provider,
      ytext,
      destroy: () => {
        provider.awareness.off('change', handleAwarenessUpdate);
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

  public updateLocalAwareness(
    provider: WebsocketProvider,
    user: UserProfile,
    activeFile: string,
    cursor?: { lineNumber: number; column: number } | null
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
    provider.awareness.setLocalStateField('lastActive', Date.now());
  }

  public destroyAllSessions(): void {
    this.sessions.forEach((session) => session.destroy());
    this.sessions.clear();
  }
}

export const collaborationClient = new CollaborationManager();

