# Collaborative Terminal & Code Execution Architecture
**Assignee:** Ashish (Person 3)  
**Branch:** `terminal`

---

## 1. Executive Summary

This module implements two distinct execution environments for the Real-Time Collaborative IDE & Debugger:
1. **In-Browser Kernel Execution**:
   - WebAssembly-based **Pyodide** runtime for Python 3.12.
   - WebAssembly-based **QuickJS** runtime for JavaScript / TypeScript.
   - Secure execution in browser sandbox with stdout/stderr redirection, timeout cancellation guards, and error formatting.
2. **Multi-User Real-Time Collaborative Terminal Multiplexer**:
   - Centralized Input Broker pattern.
   - Exactly **one authoritative server-side PTY process** (`node-pty`) per collaborative project room.
   - Synchronized keystroke broadcast across all 4 participants over WebSockets.
   - Immediate cascading text output broadcast to all connected screens.
   - Scrollback buffer history replay for late joiners and reloads.
   - Docker container isolation with resource limits, with automatic graceful fallback to host pseudo-terminal if Docker is unavailable.
   - Multi-user presence badges, live collaborator typing indicators, and session restart/clear controls.

---

## 2. Centralized Input Broker Architecture

```text
[User 1 (xterm.js)] ---\
[User 2 (xterm.js)] ----+---> [Terminal WebSocket Hub] ---> [Authoritative Room PTY]
[User 3 (xterm.js)] ----+           (/ws/terminal)               (node-pty / Docker)
[User 4 (xterm.js)] ---/                   |                              |
       ^                                   |                              |
       |============= (Broadcast Output & Presence) <=====================|
```

### Key Principles:
1. **Single Source of Truth**: The terminal process is spawned **once per room**, not per user.
2. **Local Echo Suppressed**: `xterm.js` does not echo keystrokes locally. Every character is sent to the backend, written into the PTY stdin, and the stdout is broadcast back to all connected clients.
3. **Scrollback History Buffer**: The backend retains the last ~30,000 characters in memory. When User 2 or 3 joins a room 10 minutes later, the full active terminal screen is replayed instantly.
4. **Typing Indicators & Presence**: When User 1 types, the broker broadcasts a lightweight indicator: `Alice is typing...`, rendered in real-time in the terminal control bar.
5. **Abandoned Session Cleanup**: When all users leave a room, a 60-second grace timer begins. If no user reconnects within 60s, the PTY process and container are cleanly terminated.

---

## 3. Directory & Module Structure

```text
src/
├── execution/
│   ├── pythonRunner.ts         # Pyodide WebAssembly runtime loader & runner
│   └── executionOutput.ts      # Stdout/stderr sanitization & traceback parsing
├── components/
│   ├── Terminal.tsx            # Multi-user xterm.js UI with presence & controls
│   └── ExecutionPanel.tsx      # Browser code execution runner UI
└── server/
    └── terminal/
        ├── dockerRunner.ts     # Docker container lifecycle & host shell fallback
        ├── sessionManager.ts   # Multi-user room broker, scrollback buffer & presence
        └── terminalServer.ts   # WebSocket server (/ws/terminal) & REST management router
```

---

## 4. WebSocket & API Protocol Specification

### Endpoint: `ws://localhost:3001/ws/terminal?roomId={roomId}&userId={userId}&username={username}&color={color}`

### Client -> Server Messages:
| Action / Type | Payload / Data | Description |
| :--- | :--- | :--- |
| `terminal_input` / `input` | `{ payload: "n" }` | Raw keystroke or text input |
| `terminal_resize` / `resize` | `{ cols: 80, rows: 24 }` | Dynamic terminal dimensions |
| `terminal_restart` / `restart` | `{}` | Restarts backend PTY for the room |
| `ping` | `{}` | Heartbeat keep-alive |

### Server -> Client Broadcast Messages:
| Action / Type | Fields | Description |
| :--- | :--- | :--- |
| `terminal_connect` / `connect` | `shellType`, `isIsolated` | Welcome banner and container info |
| `terminal_output` / `output` | `payload` | Cascading streaming terminal output |
| `terminal_history` / `history` | `payload` | Replayed scrollback buffer for late joiners |
| `terminal_presence` / `presence`| `users`, `count` | Active users connected to terminal room |
| `terminal_typing` / `typing` | `userId`, `username`, `color` | Collaborative typing indicator |
| `terminal_exit` / `exit` | `exitCode` | PTY process termination notice |

---

## 5. Team Integration Contracts

### Contract with Person 1 (UI / UX):
- Mount `<TerminalComponent roomId={roomId} user={user} isVisible={true} />` in any panel or drawer.
- Mount `<ExecutionPanel file={activeFile} onExecutionComplete={(result) => ...} />` in the run drawer.
- Clean responsive layout with automatic container resize observers.

### Contract with Person 2 (Real-Time Collaboration):
- Pass the shared `roomId` and current authenticated `user` (`id`, `username`, `color`).
- Terminal presence operates seamlessly alongside editor Monaco/Yjs cursor presence.

### Contract with Person 4 (Backend / Environment):
- Environment variables:
  ```env
  PORT=3001
  ENABLE_DOCKER_ISOLATION=false   # Set to true when Docker daemon is running
  TERMINAL_DOCKER_IMAGE=alpine:latest
  TERMINAL_MEMORY_LIMIT=512m
  TERMINAL_CPU_LIMIT=1.0
  ```

---

## 6. How to Test

### 1. Test In-Browser Python Execution:
1. Open any `.py` file (e.g. `test.py`).
2. Add code:
   ```python
   def fibonacci(n):
       a, b = 0, 1
       for _ in range(n):
           yield a
           a, b = b, a + b

   print("Fibonacci sequence:", list(fibonacci(10)))
   ```
3. Click **Run Code** in the Execution tab.
4. Verify execution output appears with execution time in ms.
5. Test syntax errors and exceptions (e.g. `1 / 0`) and verify friendly traceback appears without crashing the UI.

### 2. Test Collaborative Terminal:
1. Start the backend: `npm run server:api`.
2. Open two browser windows / incognito tabs on `http://localhost:5173`.
3. Join the same Room ID with two different usernames (e.g., `Ashish` and `Ajay`).
4. Switch to the **Terminal** tab in both windows.
5. In Window 1, type `echo "Hello Collaborative Terminal"`.
6. Verify in Window 2:
   - Keystrokes appear simultaneously in real-time.
   - User avatar pill and typing indicator appear in the header.
   - Reconnecting or refreshing in Window 2 preserves terminal history.
