/**
 * Backward-Compatibility & Re-export Wrapper
 * 
 * The authoritative collaboration backend is located in:
 * `collaboration-backend/` (entry point: `collaboration-backend/server.ts`).
 * 
 * This file preserves backward compatibility for existing scripts, tests, and imports
 * without duplicating code or creating competing server processes.
 */

export * from '../../collaboration-backend/server.ts';
export {
  getOrCreateRoom,
  getRoom,
  getAllRooms,
  getRoomCount,
  type Room,
} from '../../collaboration-backend/collaboration/roomManager.ts';
export {
  extractRoomFromUrl as extractRoomName,
} from '../../collaboration-backend/config/roomConfig.ts';
