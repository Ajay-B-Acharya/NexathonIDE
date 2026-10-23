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

const saveDebounceTimers = new Map<string, NodeJS.Timeout>();
const resPruneTimers = new Map<string, NodeJS.Timeout>();

async function tryLoadPersistedDoc(roomName: string, doc: Y.Doc) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomName);
  if (!isUUID) return;

  try {
    const { supabaseAdmin } = await import('../../src/server/supabase.js');
    if (!supabaseAdmin) return;
    const { data } = await supabaseAdmin
      .from('yjs_documents')
      .select('document_state')
      .eq('room_id', roomName)
      .single();

    if (data?.document_state) {
      const raw = data.document_state;
      const hex = typeof raw === 'string' && raw.startsWith('\\x') ? raw.slice(2) : raw;
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(hex, 'hex');
      Y.applyUpdate(doc, new Uint8Array(buf));
      console.log(`[RoomManager] Loaded persisted Supabase state for room: ${roomName}`);
    }
  } catch {
    // No previous state or error loading
  }
}

function scheduleDocSave(roomId: string, doc: Y.Doc) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
  if (!isUUID) return;

  const existingTimer = saveDebounceTimers.get(roomId);
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(async () => {
    try {
      const { supabaseAdmin } = await import('../../src/server/supabase.js');
      if (!supabaseAdmin) return;
      const state = Y.encodeStateAsUpdate(doc);
      const buffer = Buffer.from(state);
      await supabaseAdmin
        .from('yjs_documents')
        .upsert({
          room_id: roomId,
          document_state: '\\x' + buffer.toString('hex'),
          updated_at: new Date().toISOString(),
        });
      console.log(`[RoomManager] Saved state snapshot for room ${roomId}`);
    } catch (err) {
      console.error(`[RoomManager] Error saving document state for room ${roomId}:`, err);
    }
  }, 2000);

  saveDebounceTimers.set(roomId, timer);
}

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

  void tryLoadPersistedDoc(roomName, doc);

  // Wire document update broadcaster
  doc.on('update', (update: Uint8Array, origin: any) => {
    room!.lastActive = Date.now();
    scheduleDocSave(roomName, doc);
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

  // Wire reservation auto-expiry cleanup on the collaboration server
  const reservationsMap = doc.getMap('edit_reservations');
  const resPruneTimer = setInterval(() => {
    const now = Date.now();
    reservationsMap.forEach((res: any, key: string) => {
      if (res && res.expiresAt && res.expiresAt <= now) {
        reservationsMap.delete(key);
      }
    });
  }, 15000);
  resPruneTimers.set(roomName, resPruneTimer);

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

  const timer = resPruneTimers.get(roomName);
  if (timer) {
    clearInterval(timer);
    resPruneTimers.delete(roomName);
  }

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
