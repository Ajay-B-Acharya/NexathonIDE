# NexathonIDE: Real-Time Collaboration & Persistence Architecture Contract

**Version:** 1.0.0  
**Authors:** Person 2 (Real-Time Backend) in coordination with Person 4 (Database & Persistence) and Person 1 (Frontend / Monaco)  
**Date:** October 2026  

---

## 1. Overview & System Boundaries

NexathonIDE separates **in-flight ephemeral collaboration** from **durable file persistence**:

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT (BROWSER)                                 |
|                                                                                   |
|  Monaco Editor <====> MonacoBinding <====> Y.Doc (in-memory CRDT)                 |
|                             |                      |                              |
|                   y-websocket provider    REST Save / Auto-save                   |
+-----------------------------|----------------------|------------------------------+
                              | WebSocket            | HTTP REST
                              v (ws://...:1234)      v (http://...:3001)
+-------------------------------------------+  +------------------------------------+
|   PERSON 2: Real-Time Collab Backend      |  |  PERSON 4: API & Database Backend  |
|         (src/server/yjs-server.ts)        |  |     (src/server/api-server.ts)     |
|                                           |  |                                    |
| • Shared room-level Y.Doc instances       |  | • PostgreSQL storage:              |
| • Room isolation (workspace/file ID)      |  |   - Projects, Files, Users         |
| • Real-time CRDT update propagation       |  | • REST API endpoints:              |
| • Ephemeral Awareness (remote cursors)    |  |   - POST /api/rooms/:id/files      |
| • Connection lifecycle & cleanup          |  |   - PATCH /api/rooms/:id/files/:id |
|                                           |  | • Long-term file durability        |
+-------------------------------------------+  +------------------------------------+
```

---

## 2. Responsibilities by Role

### Person 2 (Real-Time Collaboration Backend)
* **Scope:** Live synchronization of shared document state across concurrent clients via WebSockets (`ws://localhost:1234`).
* **State Lifespan:** Ephemeral and in-memory. Document CRDT state lives in `rooms.get(roomName).doc` during the active server session.
* **Awareness:** Remote user presence, cursor locations, and active selections (`room.awareness`). Cleaned up immediately when clients disconnect.
* **Guarantees:**
  * Strict room isolation (no cross-room state leakage).
  * Deterministic convergence via Yjs CRDT algorithms.
  * Late joiners receive the current server document state.
  * Memory safety and malformed packet protection.

### Person 4 (Database, Persistence, & AI)
* **Scope:** Durable storage in PostgreSQL (`src/server/api-server.ts`, `src/server/init-db.ts`).
* **Source of Truth for Restarts:** When the server restarts or a room is cold, the initial document content must be sourced from PostgreSQL.
* **Save Actions:** Currently handled via explicit REST calls (`PATCH /api/rooms/:id/files/:path`) invoked by the frontend or auto-save debounce timers.

### Person 1 (Frontend UI/UX & Monaco Integration)
* **Scope:** Monaco editor binding (`useCollaborativeEditor.ts`, `CodeEditor.tsx`).
* **Lifecycle Rules:**
  * Must connect using `new WebsocketProvider(YJS_WS_URL, roomId, ydoc)`.
  * Must NOT destroy and recreate `Y.Doc` on every keystroke or local state change.
  * Monaco editor binding must attach to `doc.getText('codemirror')`.

---

## 3. Agreed Persistence Handshake (Future Phase Integration)

To seamlessly connect Person 2's live memory state with Person 4's PostgreSQL persistence without race conditions:

### A. Document Hydration (Cold Room Start)
1. When a client connects to room `workspace-123` and no room currently exists in `rooms`:
   * Person 2's server initializes `room = getOrCreateRoom('workspace-123')`.
   * *Future Enhancement:* If a persistence hook is registered, query the file's current text from PostgreSQL via Person 4's persistence adapter.
   * Apply the snapshot text to `room.doc.getText('codemirror').insert(0, initialDbContent)`.
   * Complete the Yjs sync step with the connecting client.

### B. Durable Snapshotting (Debounced Auto-Save)
1. Collaborative edits are synchronized instantaneously between clients via Yjs binary updates.
2. The collaboration server should **not** write to the database on every individual keystroke.
3. Instead, periodic snapshotting can occur via:
   * **Client-side periodic save:** Frontend continues calling `PATCH /api/rooms/:id/files/:path` on a 5-second debounce or explicit `Ctrl+S`.
   * **Server-side snapshot hook (optional):** Person 4 may provide an async callback `onRoomSnapshot(roomName, content: string)` called after room inactivity (e.g., 10 seconds of no edits).

### C. Server Restart Semantics
* In-flight unpersisted Yjs updates currently reside in server RAM.
* Until Phase 4 persistence integration is wired, documents do not survive server restarts unless persisted to the database via REST.
* Client-side reconnection automatically reconnects to the Yjs server when it comes back up, re-synchronizing any local edits.

---

## 4. Invariants

1. **No Direct Database Writes from yjs-server.ts:** `yjs-server.ts` does not directly manipulate PostgreSQL tables without an agreed, imported persistence adapter from Person 4.
2. **Protocol Compatibility:** All communication between frontend and `yjs-server.ts` adheres to the `y-websocket` binary framing (`messageSync = 0`, `messageAwareness = 1`, `messageQueryAwareness = 3`).
3. **Presence Non-Persistence:** Awareness states are strictly ephemeral and must never be saved to PostgreSQL.
