import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import * as http from 'http';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

export const PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT, 10) : 1234;

export const messageSync = 0;
export const messageAwareness = 1;
export const messageAuth = 2;
export const messageQueryAwareness = 3;

export interface Room {
  name: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  clientStates: Map<WebSocket, Set<number>>;
  createdAt: number;
  lastActive: number;
}

export const rooms = new Map<string, Room>();

/**
 * Safely send a binary message to a WebSocket client if it is open.
 */
export function send(ws: WebSocket, message: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(message, (err) => {
        if (err) {
          console.error('[Yjs Server] Error sending message to client:', err.message);
        }
      });
    } catch (err: any) {
      console.error('[Yjs Server] Exception while sending message:', err?.message || err);
    }
  }
}

/**
 * Retrieves an existing room or initializes a new isolated collaboration room.
 */
export function getOrCreateRoom(roomName: string, gc: boolean = true): Room {
  let room = rooms.get(roomName);
  if (room) {
    return room;
  }

  const doc = new Y.Doc({ gc });
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);

  room = {
    name: roomName,
    doc,
    awareness,
    clients: new Set<WebSocket>(),
    clientStates: new Map<WebSocket, Set<number>>(),
    createdAt: Date.now(),
    lastActive: Date.now(),
  };

  // Broadcast document updates to other clients in this room
  doc.on('update', (update: Uint8Array, origin: any) => {
    room!.lastActive = Date.now();
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const client of room!.clients) {
      if (client !== origin && client.readyState === WebSocket.OPEN) {
        send(client, message);
      }
    }
  });

  // Broadcast awareness updates to other clients in this room
  awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
    room!.lastActive = Date.now();

    // Track controlled awareness client IDs for the originating WebSocket
    if (origin && room!.clientStates.has(origin)) {
      const controlled = room!.clientStates.get(origin)!;
      for (const id of added) controlled.add(id);
      for (const id of updated) controlled.add(id);
      for (const id of removed) controlled.delete(id);
    }

    const changedClients = added.concat(updated).concat(removed);
    if (changedClients.length === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    );
    const message = encoding.toUint8Array(encoder);

    for (const client of room!.clients) {
      if (client !== origin && client.readyState === WebSocket.OPEN) {
        send(client, message);
      }
    }
  });

  rooms.set(roomName, room);
  console.log(`[Yjs Server] Room "${roomName}" created.`);
  return room;
}

/**
 * Extracts and decodes room name from the incoming URL.
 * Supports both path-based routing (/workspace-123) and query param (?room=workspace-123).
 * Rejects empty or invalid room names.
 */
export function extractRoomName(reqUrl: string | undefined, hostHeader: string | undefined): string | null {
  if (!reqUrl) return null;
  try {
    const parsedUrl = new URL(reqUrl, `http://${hostHeader || 'localhost'}`);
    let room = parsedUrl.searchParams.get('room');
    if (!room) {
      // Path-based extraction: strip leading/trailing slashes
      room = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');
    }
    if (!room) return null;

    room = decodeURIComponent(room).trim();
    return room.length > 0 ? room : null;
  } catch {
    return null;
  }
}

/**
 * Setup a WebSocket connection for Yjs collaboration within an isolated room.
 */
export function setupWSConnection(
  ws: WebSocket,
  req: http.IncomingMessage,
  { roomName, gc = true }: { roomName: string; gc?: boolean }
): void {
  const room = getOrCreateRoom(roomName, gc);
  room.clients.add(ws);
  room.clientStates.set(ws, new Set<number>());
  room.lastActive = Date.now();

  (ws as any).isAlive = true;

  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  // Step 1: Send initial SyncStep1 from server to client
  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, messageSync);
  syncProtocol.writeSyncStep1(syncEncoder, room.doc);
  send(ws, encoding.toUint8Array(syncEncoder));

  // Step 2: Send existing awareness states to the newly joined client
  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(awarenessStates.keys()))
    );
    send(ws, encoding.toUint8Array(awarenessEncoder));
  }

  // Handle incoming messages
  ws.on('message', (data: RawData) => {
    try {
      (ws as any).isAlive = true;
      room.lastActive = Date.now();

      const buf = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
      const decoder = decoding.createDecoder(buf);
      const encoder = encoding.createEncoder();
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
          if (encoding.length(encoder) > 1) {
            send(ws, encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          const awarenessUpdate = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, ws);
          break;
        }
        case messageQueryAwareness: {
          const queryEncoder = encoding.createEncoder();
          encoding.writeVarUint(queryEncoder, messageAwareness);
          encoding.writeVarUint8Array(
            queryEncoder,
            awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(room.awareness.getStates().keys()))
          );
          send(ws, encoding.toUint8Array(queryEncoder));
          break;
        }
        case messageAuth: {
          // Reserved for future auth handshake if required
          break;
        }
        default:
          console.warn(`[Yjs Server] Unknown message type: ${messageType} from room: ${room.name}`);
      }
    } catch (err: any) {
      console.error(`[Yjs Server] Error processing message in room "${room.name}":`, err?.message || err);
    }
  });

  // Cleanup on connection close or error
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;

    room.clients.delete(ws);
    const controlledIds = room.clientStates.get(ws);
    room.clientStates.delete(ws);
    room.lastActive = Date.now();

    if (controlledIds && controlledIds.size > 0) {
      // Remove awareness states associated with this disconnected client
      awarenessProtocol.removeAwarenessStates(
        room.awareness,
        Array.from(controlledIds),
        null // null origin notifies all remaining clients in the room
      );
    }

    console.log(`[Yjs Server] Client disconnected from room "${room.name}" (${room.clients.size} clients remaining).`);
  };

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    console.error(`[Yjs Server] WebSocket error in room "${room.name}":`, err.message);
    cleanup();
  });
}

// HTTP and WebSocket Server Initialization
export const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Yjs WebSocket Server Running');
});

export const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const roomName = extractRoomName(req.url, req.headers.host);
  if (!roomName) {
    console.warn(`[Yjs Server] Closing connection: Invalid or missing room identifier in URL: ${req.url}`);
    ws.close(4400, 'Invalid room name');
    return;
  }

  setupWSConnection(ws, req, { roomName, gc: true });
});

// Periodic ping/pong heartbeat to clean up stale connections
export const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws: WebSocket) => {
    if ((ws as any).isAlive === false) {
      ws.terminate();
      return;
    }
    (ws as any).isAlive = false;
    ws.ping();
  });
}, 30000);

heartbeatInterval.unref();

export function closeServer(): Promise<void> {
  clearInterval(heartbeatInterval);
  return new Promise((resolve) => {
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close(() => {
      server.close(() => {
        resolve();
      });
    });
  });
}

export function startServer(port: number = PORT): Promise<http.Server> {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Yjs WebSocket server running on port ${port}`);
      resolve(server);
    });
  });
}

// Start listening automatically only if executed directly as primary script
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('yjs-server.ts') ||
  process.argv[1].endsWith('yjs-server.js')
);

if (isMainModule) {
  startServer(PORT);
}

const gracefulShutdown = () => {
  console.log('Shutting down Yjs server...');
  closeServer().then(() => {
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);