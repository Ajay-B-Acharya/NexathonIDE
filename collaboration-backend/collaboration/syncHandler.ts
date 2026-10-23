import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { MESSAGE_SYNC, safeSend } from '../utils/protocolUtils.ts';
import type { Room } from './roomManager.ts';

/**
 * Handles incoming Yjs sync protocol messages (Step 1, Step 2, and incremental updates).
 */
export function handleSyncMessage(
  decoder: decoding.Decoder,
  encoder: encoding.Encoder,
  room: Room,
  ws: WebSocket
): void {
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);

  // If readSyncMessage wrote a response (e.g. SyncStep2), send it back to the client
  if (encoding.length(encoder) > 1) {
    safeSend(ws, encoding.toUint8Array(encoder));
  }
}

/**
 * Transmits initial SyncStep1 from the server document to a newly connected client.
 */
export function sendInitialSync(ws: WebSocket, room: Room): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, room.doc);
  safeSend(ws, encoding.toUint8Array(encoder));
}

/**
 * Broadcasts an incremental document update to all other connected peers in the room.
 */
export function broadcastDocUpdate(room: Room, update: Uint8Array, origin: any): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);

  for (const client of room.clients) {
    if (client !== origin && client.readyState === WebSocket.OPEN) {
      safeSend(client, message);
    }
  }
}
