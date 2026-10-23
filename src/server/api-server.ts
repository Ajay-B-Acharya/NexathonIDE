import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import pty from 'node-pty';
import OpenAI from 'openai';
import { supabaseAdmin } from './supabase.js';
import { WorkspaceService } from './services/workspaceService.js';
import type { TerminalMessage, AIDebugRequest, AIDebugResponse } from './types.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TerminalSession {
  pty: pty.IPty;
  clients: Set<WebSocket>;
  roomId: string;
}

const terminalSessions = new Map<string, TerminalSession>();

function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
}

async function verifyDatabaseConnection() {
  try {
    const { error } = await supabaseAdmin.from('rooms').select('count', { count: 'exact', head: true });
    if (error) {
      console.warn('⚠️ Supabase connection warning:', error.message);
    } else {
      console.log('✅ Connected to Supabase managed PostgreSQL successfully');
    }
  } catch (err) {
    console.error('⚠️ Could not connect to Supabase:', err);
  }
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Users
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { username, avatarUrl, id } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = await WorkspaceService.upsertUser(username, avatarUrl, id);
    res.json(user);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = await WorkspaceService.getUser(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
});

// Rooms / Workspaces
app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const { name, ownerId, userId } = req.body;
    const effectiveOwnerId = ownerId || userId;
    if (!name || !effectiveOwnerId) {
      return res.status(400).json({ error: 'Name and ownerId are required' });
    }
    const room = await WorkspaceService.createWorkspace({ name, ownerId: effectiveOwnerId });
    res.status(201).json(room);
  } catch (error: any) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: error.message || 'Failed to create room' });
  }
});

app.get('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const id = String(req.params.id);
    const room = await WorkspaceService.getRoom(id, token);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error: any) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch room' });
  }
});

// Workspace Files
app.get('/api/rooms/:id/files', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const id = String(req.params.id);
    const files = await WorkspaceService.listFiles(id, token);
    res.json(files);
  } catch (error: any) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch files' });
  }
});

app.get('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const filePath = String(req.params.filePath);
    const file = await WorkspaceService.loadFile(roomId, filePath, token);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(file);
  } catch (error: any) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch file' });
  }
});

app.post('/api/rooms/:roomId/files', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const { path, content = '', language, expectedVersion } = req.body;
    const roomId = String(req.params.roomId);

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const savedFile = await WorkspaceService.saveFile({
      roomId,
      path,
      content,
      language,
      expectedVersion,
      userToken: token,
    });
    res.status(201).json(savedFile);
  } catch (error: any) {
    console.error('Error creating/updating file:', error);
    const status = error.message?.includes('CONFLICT') ? 409 : 500;
    res.status(status).json({ error: error.message || 'Failed to save file' });
  }
});

app.patch('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const filePath = String(req.params.filePath);
    const { content } = req.body;

    const updated = await WorkspaceService.updateFileContent(roomId, filePath, content, token);
    if (!updated) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: error.message || 'Failed to update file' });
  }
});

app.delete('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const filePath = String(req.params.filePath);

    await WorkspaceService.deleteFile(roomId, filePath, token);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// AI Debugger
app.post('/api/ai/debug', async (req: Request, res: Response) => {
  try {
    const { code, language, error, filePath }: AIDebugRequest = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'AI service not configured',
        explanation: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.',
        suggestedFix: null,
        confidence: 0,
      });
    }

    const prompt = `You are an expert programming assistant. Analyze the following code and error, then provide a clear explanation and suggested fix.

File: ${filePath}
Language: ${language}

Code:
\`\`\`${language}
${code}
\`\`\`

${error ? `Error:\n${error}\n` : ''}

Provide your response in JSON format:
{
  "explanation": "Clear explanation of the issue",
  "suggestedFix": "Fixed code snippet (only if you can provide a concrete fix)",
  "confidence": 0.95
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert debugging assistant. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const response = JSON.parse(completion.choices[0].message.content || '{}') as AIDebugResponse;
    res.json(response);
  } catch (error) {
    console.error('AI debug error:', error);
    res.status(500).json({
      error: 'AI debugging failed',
      explanation: 'Failed to get AI assistance. Please try again.',
      suggestedFix: null,
      confidence: 0,
    });
  }
});

// Terminal WebSocket
const wss = new WebSocketServer({ server: httpServer, path: '/ws/terminal' });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const roomId = url.searchParams.get('roomId');
  const userId = url.searchParams.get('userId');

  if (!roomId || !userId) {
    ws.close(4000, 'roomId and userId required');
    return;
  }

  let session = terminalSessions.get(roomId);

  if (!session) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: { ...process.env, TERM: 'xterm-color' },
    });

    session = { pty: ptyProcess, clients: new Set(), roomId };
    terminalSessions.set(roomId, session);

    ptyProcess.onData((data) => {
      const currentSession = terminalSessions.get(roomId);
      if (currentSession) {
        currentSession.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'output', data }));
          }
        });
      }
    });

    ptyProcess.onExit(() => {
      const currentSession = terminalSessions.get(roomId);
      if (currentSession) {
        currentSession.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'disconnect' }));
          }
        });
      }
      terminalSessions.delete(roomId);
    });
  }

  session.clients.add(ws);
  ws.send(JSON.stringify({ type: 'connect', data: `Connected to terminal for room ${roomId}\r\n` }));

  ws.on('message', (message) => {
    try {
      const msg: TerminalMessage = JSON.parse(message.toString());
      const currentSession = terminalSessions.get(roomId);
      if (!currentSession) return;
      if (msg.type === 'input' && msg.data) {
        currentSession.pty.write(msg.data);
      } else if (msg.type === 'resize' && msg.cols && msg.rows) {
        currentSession.pty.resize(msg.cols, msg.rows);
      }
    } catch (e) {
      console.error('Invalid terminal message:', e);
    }
  });

  ws.on('close', () => {
    const currentSession = terminalSessions.get(roomId);
    if (!currentSession) return;
    currentSession.clients.delete(ws);
    if (currentSession.clients.size === 0) {
      currentSession.pty.kill();
      terminalSessions.delete(roomId);
    }
  });
});

httpServer.listen(PORT, async () => {
  await verifyDatabaseConnection();
  console.log(`API server running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down API server...');
  for (const session of terminalSessions.values()) {
    session.pty.kill();
  }
  httpServer.close(() => {
    process.exit(0);
  });
});
