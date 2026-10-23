import { WebSocket } from 'ws';
import type { RawData } from 'ws';

/**
 * Standard Yjs WebSocket protocol message identifiers
 * Compatible with y-websocket client protocol.
 */
export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_AUTH = 2;
export const MESSAGE_QUERY_AWARENESS = 3;

/**
 * Safely send binary payload to a WebSocket client if connection is OPEN.
 */
export function safeSend(ws: WebSocket, message: Uint8Array): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(message, (err) => {
        if (err) {
          console.error('[ProtocolUtils] Failed to send frame to WebSocket:', err.message);
        }
      });
    } catch (err: any) {
      console.error('[ProtocolUtils] Exception in safeSend:', err?.message || err);
    }
  }
}

/**
 * Normalize incoming raw WebSocket buffer/data into a Uint8Array.
 */
export function toUint8Array(data: RawData): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data);
}
