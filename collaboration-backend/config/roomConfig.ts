/**
 * Collaboration Room Configuration & Identifier Validation
 */

export interface RoomConfig {
  port: number;
  heartbeatIntervalMs: number;
  maxRoomNameLength: number;
  gcEnabled: boolean;
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  port: process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT, 10) : 1234,
  heartbeatIntervalMs: 30000,
  maxRoomNameLength: 512,
  gcEnabled: true,
};

export interface RoomValidationResult {
  valid: boolean;
  roomName: string;
  error?: string;
}

/**
 * Validates a room name according to safety and length constraints.
 * Rejects empty, whitespace-only, or overly long names.
 */
export function validateRoomName(
  candidate: string | null | undefined,
  maxLength: number = DEFAULT_ROOM_CONFIG.maxRoomNameLength
): RoomValidationResult {
  if (!candidate) {
    return { valid: false, roomName: '', error: 'Room name cannot be empty' };
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return { valid: false, roomName: '', error: 'Room name cannot be whitespace-only' };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      roomName: '',
      error: `Room name exceeds maximum length of ${maxLength} characters`,
    };
  }

  return { valid: true, roomName: trimmed };
}

/**
 * Extracts and validates the room identifier from incoming HTTP/WebSocket request URL.
 * Supports both path-based routing (/workspace-123), proxied paths (/yjs/workspace-123),
 * and query-based routing (?room=workspace-123).
 */
export function extractRoomFromUrl(
  reqUrl: string | undefined,
  hostHeader: string | undefined
): RoomValidationResult {
  if (!reqUrl) {
    return { valid: false, roomName: '', error: 'Missing request URL' };
  }

  try {
    const parsed = new URL(reqUrl, `http://${hostHeader || 'localhost'}`);
    let candidate = parsed.searchParams.get('room');

    if (!candidate) {
      // Path-based format: e.g. /workspace-123 or /yjs/workspace-123
      candidate = parsed.pathname.replace(/^\/+|\/+$/g, '');
    }

    if (!candidate) {
      return { valid: false, roomName: '', error: 'No room name provided in path or query' };
    }

    // Normalize proxied prefixes (e.g. from Vite dev server or reverse proxy)
    if (candidate.startsWith('yjs/')) {
      candidate = candidate.slice(4);
    } else if (candidate.startsWith('collab/')) {
      candidate = candidate.slice(7);
    }

    const decoded = decodeURIComponent(candidate);
    return validateRoomName(decoded);
  } catch (err: any) {
    return { valid: false, roomName: '', error: `Failed to parse URL: ${err?.message || err}` };
  }
}
