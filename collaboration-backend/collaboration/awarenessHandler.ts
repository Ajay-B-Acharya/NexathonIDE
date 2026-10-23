import { WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import { MESSAGE_AWARENESS, safeSend } from '../utils/protocolUtils.ts';
import type { Room } from './roomManager.ts';

/**
 * Transmits existing room awareness states to a newly connected client.
 */
export function sendInitialAwareness(ws: WebSocket, room: Room): void {
  const states = room.awareness.getStates();
  if (states.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys()))
    );
    safeSend(ws, encoding.toUint8Array(encoder));
  }
}

/**
 * Processes incoming awareness update binary payload from a client.
 */
export function handleAwarenessMessage(
  decoder: decoding.Decoder,
  room: Room,
  ws: WebSocket
): void {
  const update = decoding.readVarUint8Array(decoder);
  awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
}

/**
 * Handles client query for full awareness state.
 */
export function handleQueryAwarenessMessage(room: Room, ws: WebSocket): void {
  const states = room.awareness.getStates();
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys()))
  );
  safeSend(ws, encoding.toUint8Array(encoder));
}

/**
 * Broadcasts awareness changes (added, updated, removed) to other peers in the room.
 */
export function broadcastAwarenessUpdate(
  room: Room,
  changedClients: number[],
  origin: any
): void {
  if (changedClients.length === 0) return;

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients)
  );
  const message = encoding.toUint8Array(encoder);

  for (const client of room.clients) {
    if (client !== origin && client.readyState === WebSocket.OPEN) {
      safeSend(client, message);
    }
  }
}

/**
 * Safely removes awareness states for a disconnecting WebSocket client and notifies remaining peers.
 */
export function removeClientAwareness(room: Room, ws: WebSocket): void {
  const controlledIds = room.clientStates.get(ws);
  if (controlledIds && controlledIds.size > 0) {
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      Array.from(controlledIds),
      null // null origin broadcasts removal to all remaining clients in the room
    );
  }
}
