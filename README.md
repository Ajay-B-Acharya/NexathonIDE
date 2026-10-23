# Real-Time Collaborative IDE & Debugger

A browser-based collaborative development environment with real-time code editing, shared terminal, in-browser code execution, and AI-powered debugging.

## Features

- **Real-time Collaborative Editing**: Multiple users can edit the same file simultaneously using Yjs CRDT
- **Shared Cloud Terminal**: Access a shared terminal session with other collaborators
- **In-Browser Code Execution**: Run Python (Pyodide) and JavaScript/TypeScript (QuickJS) directly in the browser
- **AI Debugging Assistant**: Get AI-powered error explanations and code fixes via OpenAI
- **Workspace Persistence**: Save and restore workspace files using PostgreSQL
- **User Presence**: See other collaborators' cursors and selections in real-time

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Editor**: Monaco Editor (VS Code's editor)
- **Collaboration**: Yjs, y-monaco, y-websocket
- **Terminal**: xterm.js with node-pty
- **Execution**: Pyodide (Python), QuickJS (JavaScript/TypeScript)
- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: PostgreSQL
- **AI**: OpenAI API

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- OpenAI API key (optional, for AI debugging)

## Quick Start

1. **Clone and install dependencies**
```bash
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your database URL and OpenAI API key
```

3. **Initialize the database**
```bash
npm run db:init
```

4. **Start all servers (development)**
```bash
npm run dev:all
```

This starts:
- Yjs WebSocket server on port 1234
- API server on port 3001
- Vite dev server on port 5173

Or start them individually:
```bash
# Terminal 1: Yjs WebSocket server
npm run server:yjs

# Terminal 2: API server
npm run server:api

# Terminal 3: Frontend dev server
npm run dev
```

5. **Open the IDE**
Navigate to `http://localhost:5173`

## Usage

1. **Sign in** with a username
2. **Create or join a workspace**
3. **Create files** in the file explorer
4. **Collaborate** - share the workspace URL with others
5. **Run code** - select a Python or JS/TS file and click "Run"
6. **Debug with AI** - if there's an error, switch to the AI panel and click "Debug with AI"
7. **Use terminal** - click the terminal icon in the bottom panel

## Project Structure

```
src/
├── components/          # React components
│   ├── Login.tsx           # Login screen
│   ├── RoomSelection.tsx   # Workspace selection
│   ├── IDELayout.tsx       # Main IDE layout
│   ├── CodeEditor.tsx      # Monaco editor with collaboration
│   ├── FileExplorer.tsx    # File tree view
│   ├── ExecutionPanel.tsx  # Code execution output
│   ├── AIDebugPanel.tsx    # AI debugging assistant
│   └── Terminal.tsx        # xterm.js terminal
├── hooks/
│   └── useCollaborativeEditor.ts  # Yjs collaboration hook
├── server/
│   ├── api-server.ts       # Express + WebSocket API server
│   ├── yjs-server.ts       # Yjs WebSocket sync server
│   ├── init-db.ts          # Database initialization
│   └── types.ts            # Server-side types
├── types/
│   └── index.ts            # Shared TypeScript types
└── App.tsx                 # Main app component
```

## Development

### Running Tests
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Architecture

### Real-time Collaboration (Yjs)
- Uses Yjs CRDT for conflict-free concurrent editing
- WebSocket server relays document updates between clients
- y-monaco binds Monaco Editor to Yjs documents
- Awareness protocol tracks cursor positions and selections

### Code Execution
- **Python**: Pyodide WebAssembly runtime loaded from CDN
- **JavaScript/TypeScript**: QuickJS WebAssembly runtime
- Execution is sandboxed in the browser (no server-side execution)

### Shared Terminal
- Node.js spawns a PTY process (bash/powershell)
- xterm.js frontend connects via WebSocket
- AttachAddon bridges terminal I/O to WebSocket

### AI Debugging
- Sends code + error context to OpenAI API
- Returns explanation and suggested fix
- User must manually apply fixes (no auto-apply)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/collaborative_ide` |
| `PORT` | API server port | `3001` |
| `Y_WEBSOCKET_PORT` | Yjs WebSocket server port | `1234` |
| `VITE_API_URL` | Frontend API base URL | `http://localhost:3001` |
| `VITE_YJS_WS_URL` | Frontend Yjs WebSocket URL | `ws://localhost:1234` |
| `OPENAI_API_KEY` | OpenAI API key for AI debugging | (optional) |

## License

MIT