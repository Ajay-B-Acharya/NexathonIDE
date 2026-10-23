/**
 * Centralized Multi-User Terminal Session Manager.
 * Part of Person 3's Terminal & Code Execution Module.
 * 
 * Implements the Centralized Input Broker pattern:
 * - Exactly ONE authoritative PTY process per collaborative room.
 * - Broadcasts PTY output to all connected team members simultaneously.
 * - Buffers scrollback history so late joiners see the current terminal state.
 * - Synchronizes active user presence and typing indicators.
 * - Cleans up abandoned terminal sessions after a grace period.
 */

import { WebSocket } from 'ws';
import { spawnTerminalProcess, type TerminalProcess } from './dockerRunner.js';

export interface TerminalClientInfo {
  ws: WebSocket;
  userId: string;
  username: string;
  color: string;
}

export interface ActiveSession {
  roomId: string;
  process: TerminalProcess;
  clients: Map<WebSocket, TerminalClientInfo>;
  scrollbackBuffer: string;
  abandonTimer: NodeJS.Timeout | null;
  lastTypingUser: { userId: string; username: string; timestamp: number } | null;
  cols: number;
  rows: number;
  createdAt: Date;
}

const MAX_SCROLLBACK_CHARS = 30_000; // ~1,000 lines of scrollback history
const ABANDONED_SESSION_GRACE_MS = 60_000; // 60 seconds grace period on disconnect

class TerminalSessionManager {
  private sessions = new Map<string, ActiveSession>();

  /**
   * Get an existing session or create a new authoritative PTY session for the room
   */
  public getOrCreateSession(roomId: string, initialCols = 80, initialRows = 24): ActiveSession {
    let session = this.sessions.get(roomId);

    if (session) {
      // If an abandon timer is running (because users temporarily disconnected/refreshed), cancel it!
      if (session.abandonTimer) {
        clearTimeout(session.abandonTimer);
        session.abandonTimer = null;
        console.log(`[SessionManager] Reconnected to existing session for room ${roomId}. Cancelled abandon timer.`);
      }
      return session;
    }

    console.log(`[SessionManager] Creating new authoritative PTY session for room: ${roomId}`);
    const terminalProcess = spawnTerminalProcess({
      roomId,
      cols: initialCols,
      rows: initialRows,
    });

    session = {
      roomId,
      process: terminalProcess,
      clients: new Map(),
      scrollbackBuffer: '',
      abandonTimer: null,
      lastTypingUser: null,
      cols: initialCols,
      rows: initialRows,
      createdAt: new Date(),
    };

    // When the authoritative PTY outputs text, append to scrollback and broadcast to ALL room clients
    terminalProcess.pty.onData((data: string) => {
      this.handlePtyOutput(roomId, data);
    });

    // Handle unexpected process exit
    terminalProcess.pty.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
      console.log(`[SessionManager] PTY exited for room ${roomId} (code: ${exitCode}, signal: ${signal})`);
      this.broadcast(roomId, {
        type: 'output',
        action: 'terminal_output',
        payload: `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`,
        data: `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m\r\n`,
      });
      this.broadcast(roomId, {
        type: 'exit',
        action: 'terminal_exit',
        exitCode,
      });
      this.cleanupSession(roomId);
    });

    this.sessions.set(roomId, session);
    return session;
  }

  /**
   * Attach a user's WebSocket connection to the room's terminal
   */
  public attachClient(roomId: string, client: TerminalClientInfo): void {
    const session = this.getOrCreateSession(roomId);
    session.clients.set(client.ws, client);

    console.log(`[SessionManager] User ${client.username} (${client.userId}) attached to terminal ${roomId}. Total clients: ${session.clients.size}`);

    // Send connection acknowledgement and system status
    this.sendToClient(client.ws, {
      type: 'connect',
      action: 'terminal_connect',
      data: `\x1b[32m✔ Connected to shared terminal for room\x1b[0m (\x1b[36m${session.process.shellType}\x1b[0m)\r\n`,
      payload: `\x1b[32m✔ Connected to shared terminal for room\x1b[0m (\x1b[36m${session.process.shellType}\x1b[0m)\r\n`,
      shellType: session.process.shellType,
      isIsolated: session.process.isIsolated,
    });

    // Replay existing scrollback buffer so late joiners see the full current terminal screen
    if (session.scrollbackBuffer.length > 0) {
      this.sendToClient(client.ws, {
        type: 'history',
        action: 'terminal_history',
        data: session.scrollbackBuffer,
        payload: session.scrollbackBuffer,
      });
    }

    // Broadcast updated presence list to everyone in the room
    this.broadcastPresence(roomId);
  }

  /**
   * Detach a user's WebSocket on disconnect
   */
  public detachClient(roomId: string, ws: WebSocket): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const client = session.clients.get(ws);
    session.clients.delete(ws);

    if (client) {
      console.log(`[SessionManager] User ${client.username} detached from terminal ${roomId}. Remaining clients: ${session.clients.size}`);
    }

    // Broadcast updated presence
    this.broadcastPresence(roomId);

    // If no users remain connected, start grace period timer before shutting down PTY
    if (session.clients.size === 0) {
      console.log(`[SessionManager] No active clients in room ${roomId}. Starting ${ABANDONED_SESSION_GRACE_MS / 1000}s abandon timer.`);
      session.abandonTimer = setTimeout(() => {
        console.log(`[SessionManager] Abandon timer expired for room ${roomId}. Shutting down PTY process.`);
        this.terminateSession(roomId);
      }, ABANDONED_SESSION_GRACE_MS);
    }
  }

  /**
   * Handle incoming keystrokes from any user and pipe straight to the authoritative PTY
   */
  public handleInput(roomId: string, userId: string, rawInput: string): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    // Route input straight to single authoritative PTY process
    try {
      session.process.pty.write(rawInput);
    } catch (err) {
      console.error(`[SessionManager] Error writing to PTY for room ${roomId}:`, err);
    }

    // Broadcast typing indicator to all other users in the room
    const client = Array.from(session.clients.values()).find(c => c.userId === userId);
    if (client) {
      const now = Date.now();
      if (!session.lastTypingUser || session.lastTypingUser.userId !== userId || now - session.lastTypingUser.timestamp > 1500) {
        session.lastTypingUser = { userId, username: client.username, timestamp: now };
        this.broadcast(roomId, {
          type: 'typing',
          action: 'terminal_typing',
          userId,
          username: client.username,
          color: client.color,
        }, client.ws);
      }
    }
  }

  /**
   * Handle terminal resize events
   */
  public handleResize(roomId: string, cols: number, rows: number): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const safeCols = Math.max(20, Math.min(cols, 220));
    const safeRows = Math.max(5, Math.min(rows, 100));

    session.cols = safeCols;
    session.rows = safeRows;

    try {
      session.process.pty.resize(safeCols, safeRows);
    } catch {
      // Ignore resize errors if pty is transitioning
    }
  }

  /**
   * Restart the terminal session for a room
   */
  public restartSession(roomId: string): ActiveSession {
    console.log(`[SessionManager] Restarting terminal session for room ${roomId}`);
    const existing = this.sessions.get(roomId);
    const existingClients = existing ? Array.from(existing.clients.values()) : [];

    this.terminateSession(roomId);

    // Create fresh session
    const newSession = this.getOrCreateSession(roomId);

    // Re-attach existing clients
    for (const client of existingClients) {
      newSession.clients.set(client.ws, client);
    }

    this.broadcast(roomId, {
      type: 'output',
      action: 'terminal_output',
      data: '\r\n\x1b[36m[Terminal session restarted by collaborator]\x1b[0m\r\n',
      payload: '\r\n\x1b[36m[Terminal session restarted by collaborator]\x1b[0m\r\n',
    });

    this.broadcastPresence(roomId);
    return newSession;
  }

  /**
   * Terminate and clean up session
   */
  public terminateSession(roomId: string): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    if (session.abandonTimer) {
      clearTimeout(session.abandonTimer);
      session.abandonTimer = null;
    }

    try {
      if (session.process.cleanup) {
        session.process.cleanup();
      }
      session.process.pty.kill();
    } catch {
      // Process already terminated
    }

    this.sessions.delete(roomId);
    console.log(`[SessionManager] Session terminated for room ${roomId}`);
  }

  /**
   * Internal handler for PTY output
   */
  private handlePtyOutput(roomId: string, data: string): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    // Append to scrollback history buffer
    session.scrollbackBuffer += data;
    if (session.scrollbackBuffer.length > MAX_SCROLLBACK_CHARS) {
      session.scrollbackBuffer = session.scrollbackBuffer.slice(
        session.scrollbackBuffer.length - MAX_SCROLLBACK_CHARS
      );
    }

    // Broadcast cascading output to all connected team members
    const message = JSON.stringify({
      type: 'output',
      action: 'terminal_output',
      data,
      payload: data,
    });

    for (const [ws] of session.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Broadcast structured message to all clients in a room
   */
  public broadcast(roomId: string, msgObj: any, excludeWs?: WebSocket): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const payload = JSON.stringify(msgObj);
    for (const [ws] of session.clients) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Broadcast active users connected to this room's terminal
   */
  public broadcastPresence(roomId: string): void {
    const session = this.sessions.get(roomId);
    if (!session) return;

    const users = Array.from(session.clients.values()).map(c => ({
      userId: c.userId,
      username: c.username,
      color: c.color,
    }));

    this.broadcast(roomId, {
      type: 'presence',
      action: 'terminal_presence',
      users,
      count: users.length,
    });
  }

  /**
   * Safe send to a specific client
   */
  private sendToClient(ws: WebSocket, msgObj: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msgObj));
    }
  }

  /**
   * Clean up all active sessions on server shutdown
   */
  public shutdown(): void {
    console.log('[SessionManager] Shutting down all active terminal sessions...');
    for (const roomId of Array.from(this.sessions.keys())) {
      this.terminateSession(roomId);
    }
  }

  private cleanupSession(roomId: string): void {
    this.sessions.delete(roomId);
  }
}

export const sessionManager = new TerminalSessionManager();
