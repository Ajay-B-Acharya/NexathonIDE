import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import * as http from 'http';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { extractRoomFromUrl, DEFAULT_ROOM_CONFIG } from '../config/roomConfig.ts';
import { getOrCreateRoom, type Room } from './roomManager.ts';
import { handleSyncMessage, sendInitialSync } from './syncHandler.ts';
import {
  handleAwarenessMessage,
  handleQueryAwarenessMessage,
  sendInitialAwareness,
  removeClientAwareness,
} from './awarenessHandler.ts';
import {
  MESSAGE_SYNC,
  MESSAGE_AWARENESS,
  MESSAGE_AUTH,
  MESSAGE_QUERY_AWARENESS,
  toUint8Array,
} from '../utils/protocolUtils.ts';

interface TrackedSocket extends WebSocket {
  isAlive?: boolean;
}

let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Initializes and attaches connection handling to the WebSocket server.
 */
export function registerConnectionHandler(wss: WebSocketServer): void {
  wss.on('connection', (ws: TrackedSocket, req: http.IncomingMessage) => {
    handleConnection(ws, req);
  });

  startHeartbeat(wss);
}

/**
 * Handles a newly established WebSocket client connection.
 */
export function handleConnection(ws: TrackedSocket, req: http.IncomingMessage): void {
  const validation = extractRoomFromUrl(req.url, req.headers.host);
  if (!validation.valid) {
    console.warn(`[ConnectionHandler] Rejected connection: ${validation.error} (URL: ${req.url})`);
    ws.close(4400, validation.error || 'Invalid room identifier');
    return;
  }

  const roomName = validation.roomName;
  const room = getOrCreateRoom(roomName, DEFAULT_ROOM_CONFIG.gcEnabled);

  room.clients.add(ws);
  room.clientStates.set(ws, new Set<number>());
  room.lastActive = Date.now();

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // 1. Initial document synchronization handshake
  sendInitialSync(ws, room);

  // 2. Initial awareness state propagation
  sendInitialAwareness(ws, room);

  // 3. Process incoming binary messages
  ws.on('message', (data: RawData) => {
    try {
      ws.isAlive = true;
      room.lastActive = Date.now();

      const buf = toUint8Array(data);
      const decoder = decoding.createDecoder(buf);
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC:
          handleSyncMessage(decoder, encoder, room, ws);
          break;
        case MESSAGE_AWARENESS:
          handleAwarenessMessage(decoder, room, ws);
          break;
        case MESSAGE_QUERY_AWARENESS:
          handleQueryAwarenessMessage(room, ws);
          break;
        case MESSAGE_AUTH:
          // Reserved for future token authorization handshake
          break;
        default:
          console.warn(`[ConnectionHandler] Unrecognized message type: ${messageType} in room "${roomName}"`);
      }
    } catch (err: any) {
      console.error(`[ConnectionHandler] Malformed message from room "${roomName}":`, err?.message || err);
    }
  });

  // 4. Safe disconnection handling
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    room.clients.delete(ws);
    removeClientAwareness(room, ws);
    room.clientStates.delete(ws);
    room.lastActive = Date.now();

    console.log(
      `[ConnectionHandler] Client disconnected from room "${roomName}" (${room.clients.size} clients remaining)`
    );
  };

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    console.error(`[ConnectionHandler] Socket error in room "${roomName}":`, err.message);
    cleanup();
  });
}

/**
 * Starts periodic heartbeat check to prune dead / unresponsive sockets.
 */
export function startHeartbeat(
  wss: WebSocketServer,
  intervalMs: number = DEFAULT_ROOM_CONFIG.heartbeatIntervalMs
): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client: WebSocket) => {
      const socket = client as TrackedSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, intervalMs);

  heartbeatTimer.unref();
}

/**
 * Stops the heartbeat timer upon server shutdown.
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
