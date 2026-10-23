/**
 * Dedicated Terminal WebSocket Server & HTTP Endpoints.
 * Part of Person 3's Terminal & Code Execution Module.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import express, { Router, type Request, type Response } from 'express';
import { sessionManager } from './sessionManager.js';

/**
 * Configure and attach the WebSocket server for collaborative terminals
 */
export function setupTerminalServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/terminal' });

  wss.on('connection', (ws: WebSocket, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const roomId = url.searchParams.get('roomId');
      const userId = url.searchParams.get('userId') || `user_${Math.random().toString(36).substring(2, 7)}`;
      const username = url.searchParams.get('username') || `User-${userId.substring(0, 4)}`;
      const color = url.searchParams.get('color') || '#4ec9b0';

      if (!roomId) {
        ws.close(4000, 'roomId query parameter is required');
        return;
      }

      // Attach client to centralized room session
      sessionManager.attachClient(roomId, {
        ws,
        userId,
        username,
        color,
      });

      // Handle incoming messages
      ws.on('message', (messageBuffer) => {
        const rawString = messageBuffer.toString();

        try {
          // Attempt parsing structured JSON protocol
          if (rawString.startsWith('{') && rawString.endsWith('}')) {
            const parsed = JSON.parse(rawString);

            // Handle input
            if (parsed.action === 'terminal_input' || parsed.type === 'input') {
              const inputData = parsed.payload ?? parsed.data;
              if (typeof inputData === 'string') {
                sessionManager.handleInput(roomId, userId, inputData);
              }
              return;
            }

            // Handle resize
            if (parsed.action === 'terminal_resize' || parsed.type === 'resize') {
              const cols = parsed.cols || parsed.payload?.cols;
              const rows = parsed.rows || parsed.payload?.rows;
              if (cols && rows) {
                sessionManager.handleResize(roomId, cols, rows);
              }
              return;
            }

            // Handle restart request
            if (parsed.action === 'terminal_restart' || parsed.type === 'restart') {
              sessionManager.restartSession(roomId);
              return;
            }

            // Handle heartbeat / keep-alive
            if (parsed.type === 'ping') {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              }
              return;
            }
          }

          // Fallback: If raw keystroke string was sent (e.g. from raw terminal stream or AttachAddon)
          sessionManager.handleInput(roomId, userId, rawString);
        } catch (err) {
          console.error(`[TerminalServer] Error handling message in room ${roomId}:`, err);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        sessionManager.detachClient(roomId, ws);
      });

      ws.on('error', (err) => {
        console.error(`[TerminalServer] WebSocket error in room ${roomId}:`, err);
        sessionManager.detachClient(roomId, ws);
      });
    } catch (err) {
      console.error('[TerminalServer] Connection initialization error:', err);
      ws.close(1011, 'Server error initializing terminal');
    }
  });

  return wss;
}

/**
 * Optional REST router for terminal status and management
 */
export function createTerminalRouter(): Router {
  const router = express.Router();

  // Status check for a room's terminal
  router.get('/status/:roomId', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId);
    const session = (sessionManager as any).sessions?.get(roomId);

    if (!session) {
      return res.json({
        active: false,
        roomId,
        connectedUsers: 0,
      });
    }

    res.json({
      active: true,
      roomId,
      shellType: session.process.shellType,
      isIsolated: session.process.isIsolated,
      connectedUsers: session.clients.size,
      cols: session.cols,
      rows: session.rows,
      createdAt: session.createdAt,
    });
  });

  // Restart terminal endpoint
  router.post('/restart/:roomId', (req: Request, res: Response) => {
    const roomId = String(req.params.roomId);
    try {
      sessionManager.restartSession(roomId);
      res.json({ success: true, message: `Terminal restarted for room ${roomId}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
