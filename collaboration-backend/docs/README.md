# NexathonIDE Real-Time Collaboration Backend

This module provides the dedicated, modular real-time collaboration backend for NexathonIDE using Yjs CRDTs and WebSocket communication.

---

## 1. Modular Directory Structure

```text
collaboration-backend/
├── server.ts                       # Server entry point, HTTP /health endpoint, and lifecycle
├── config/
│   └── roomConfig.ts              # Room settings, default options, and URL identifier validation
├── collaboration/
│   ├── roomManager.ts             # Isolated room lifecycle, Y.Doc storage, and client tracking
│   ├── syncHandler.ts             # Yjs sync protocol (Step 1, Step 2, incremental edit broadcast)
│   ├── awarenessHandler.ts        # Presence, remote cursor tracking, and disconnect purge
│   └── connectionHandler.ts       # Socket routing, message framing, and heartbeat pings
├── utils/
│   └── protocolUtils.ts           # Binary framing constants and safe WebSocket sender
├── test/
│   └── collaboration.test.ts      # Automated test suite (all 10 real-time collaboration scenarios)
├── docs/
│   └── README.md                  # This architecture and operations documentation
└── tsconfig.json                  # Dedicated TypeScript compiler configuration
```

---

## 2. Core Responsibilities by Module

| Module | Responsibility |
|---|---|
| [`server.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/server.ts) | Initializes HTTP and WebSocket servers, handles graceful shutdown, and serves `/health`. |
| [`roomConfig.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/config/roomConfig.ts) | Extracts and validates room identifiers from paths (`/room-id`) and queries (`?room=id`). Rejects malformed room names. |
| [`roomManager.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/collaboration/roomManager.ts) | Maintains independent `Y.Doc` and `Awareness` instances per room. Guarantees zero cross-room data leakage. |
| [`syncHandler.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/collaboration/syncHandler.ts) | Implements the standard `y-websocket` binary synchronization protocol with incremental updates. |
| [`awarenessHandler.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/collaboration/awarenessHandler.ts) | Relays ephemeral awareness states (presence, cursors) and ensures disconnected client states are promptly purged. |
| [`connectionHandler.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/collaboration/connectionHandler.ts) | Registers connection listeners, parses binary frames, performs 30-second ping/pong heartbeats, and guards against malformed packets. |
| [`protocolUtils.ts`](file:///c:/Users/ADARSH%20ACHARYA/Desktop/PROJECTS/shreedevi/NexathonIDE/collaboration-backend/utils/protocolUtils.ts) | Contains `safeSend()`, message constants (`MESSAGE_SYNC = 0`, `MESSAGE_AWARENESS = 1`), and buffer helpers. |

---

## 3. Protocol & Connection Contract

The backend is fully compatible with the frontend `WebsocketProvider` (`y-websocket`):

* **Connection URL:** `ws://localhost:1234/<room-name>` (or `ws://localhost:1234/?room=<room-name>`)
* **Message Framing:**
  * `0`: Document Sync protocol (Yjs CRDT state vectors & updates)
  * `1`: Awareness protocol (ephemeral user metadata, cursor positions, selections)
  * `2`: Authentication protocol
  * `3`: Query awareness protocol
* **Safety:** Malformed frames are trapped without crashing the server or terminating other connections.

---

## 4. Operational Commands

### Start the Collaboration Backend Independently
```bash
npm run dev:collab
```
Listens on `ws://localhost:1234` by default (configurable via `Y_WEBSOCKET_PORT`).

### Run Automated Collaboration Tests
```bash
npm run test:collab
```
Executes all 10 automated test scenarios:
1. Two clients connect to the same room.
2. Client A edits and Client B receives the update.
3. Client B edits and Client A receives the update.
4. Concurrent edits converge.
5. A late joiner receives existing document content.
6. Different rooms remain isolated.
7. Awareness updates propagate within the same room.
8. Awareness does not leak across rooms.
9. Disconnect cleanup removes the appropriate awareness state.
10. The server handles malformed input without terminating unexpectedly.

---

## 5. Team Boundaries & Persistence

* **Person 2 (Real-Time Backend):** Manages this dedicated directory (`collaboration-backend/`). State is in-memory and real-time.
* **Person 4 (PostgreSQL Persistence):** Manages `api-server.ts` and `init-db.ts`. Document persistence across server restarts will be bridged via debounced REST snapshots as defined in `docs/PERSISTENCE_CONTRACT.md`.
* **Person 1 (Frontend):** Manages Monaco editor bindings. Must connect using standard `y-websocket` provider to `ws://localhost:1234/<roomId>`.
