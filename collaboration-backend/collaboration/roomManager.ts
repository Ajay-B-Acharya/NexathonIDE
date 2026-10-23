import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { broadcastDocUpdate } from './syncHandler.ts';
import { broadcastAwarenessUpdate } from './awarenessHandler.ts';

export interface Room {
  name: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  clientStates: Map<WebSocket, Set<number>>;
  createdAt: number;
  lastActive: number;
}

const rooms = new Map<string, Room>();

/**
 * Retrieves an existing room or creates an isolated new collaboration room with Y.Doc and Awareness.
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

  // Wire document update broadcaster
  doc.on('update', (update: Uint8Array, origin: any) => {
    room!.lastActive = Date.now();
    broadcastDocUpdate(room!, update, origin);
  });

  // Wire awareness update broadcaster and client ID tracking
  awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
    room!.lastActive = Date.now();

    // Register added and updated client IDs with the originating WebSocket
    if (origin && room!.clientStates.has(origin)) {
      const controlled = room!.clientStates.get(origin)!;
      for (const id of added) controlled.add(id);
      for (const id of updated) controlled.add(id);
      for (const id of removed) controlled.delete(id);
    }

    const changedClients = added.concat(updated).concat(removed);
    broadcastAwarenessUpdate(room!, changedClients, origin);
  });

  rooms.set(roomName, room);
  console.log(`[RoomManager] Initialized room "${roomName}".`);
  return room;
}

export function getRoom(roomName: string): Room | undefined {
  return rooms.get(roomName);
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}

export function getRoomCount(): number {
  return rooms.size;
}

export function removeRoom(roomName: string): boolean {
  const room = rooms.get(roomName);
  if (!room) return false;

  for (const client of room.clients) {
    try {
      client.close(1000, 'Room closed');
    } catch {}
  }
  room.clients.clear();
  room.clientStates.clear();
  room.doc.destroy();
  room.awareness.destroy();
  return rooms.delete(roomName);
}

export function clearAllRooms(): void {
  for (const name of Array.from(rooms.keys())) {
    removeRoom(name);
  }
}
