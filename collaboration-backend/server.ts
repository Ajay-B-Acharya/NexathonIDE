import http from 'http';
import { WebSocketServer } from 'ws';
import { DEFAULT_ROOM_CONFIG } from './config/roomConfig.ts';
import { registerConnectionHandler, stopHeartbeat } from './collaboration/connectionHandler.ts';
import { getRoomCount, clearAllRooms } from './collaboration/roomManager.ts';

export const PORT = DEFAULT_ROOM_CONFIG.port;

export const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'collaboration-backend',
        activeRooms: getRoomCount(),
        uptime: process.uptime(),
      })
    );
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NexathonIDE Collaboration Server Running\n');
});

export const wss = new WebSocketServer({ server });

// Attach default safety error listeners to prevent unhandled node event crashes
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Collaboration Server] Port ${PORT} already occupied; active collaboration server instance detected.`);
  } else {
    console.error('[Collaboration Server] HTTP server error:', err?.message || err);
  }
});

wss.on('error', (err: any) => {
  console.warn('[Collaboration Server] WebSocket server error:', err?.message || err);
});

// Register connection routing and heartbeats
registerConnectionHandler(wss);

/**
 * Start the collaboration server on the given port.
 */
export function startServer(port: number = PORT): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const errorHandler = (err: any) => {
      reject(err);
    };
    server.once('error', errorHandler);
    server.listen(port, '0.0.0.0', () => {
      server.removeListener('error', errorHandler);
      console.log(`[Collaboration Server] Listening on ws://0.0.0.0:${port}`);
      resolve(server);
    });
  });
}

/**
 * Gracefully shuts down the collaboration server and releases all socket connections.
 */
export function stopServer(): Promise<void> {
  stopHeartbeat();
  return new Promise((resolve) => {
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch {}
    }
    clearAllRooms();
    wss.close(() => {
      server.close(() => {
        console.log('[Collaboration Server] Stopped successfully.');
        resolve();
      });
    });
  });
}

// Auto-start only when executed as the main script
const isMainScript = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isMainScript) {
  startServer(PORT).catch((err) => {
    if (err?.code !== 'EADDRINUSE') {
      console.error('[Collaboration Server] Startup failed:', err?.message || err);
    }
  });
}

const handleShutdown = async () => {
  console.log('\n[Collaboration Server] Shutting down...');
  await stopServer();
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
