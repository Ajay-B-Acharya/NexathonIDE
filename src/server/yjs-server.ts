/**
 * Backward-Compatibility Wrapper
 * 
 * The authoritative collaboration backend has been migrated to the dedicated modular
 * folder: `collaboration-backend/` (entry point: `collaboration-backend/server.ts`).
 * 
 * This file re-exports the server implementation to preserve backward compatibility
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