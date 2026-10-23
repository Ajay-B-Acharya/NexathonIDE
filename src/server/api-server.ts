import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { supabaseAdmin } from './supabase.js';
import { WorkspaceService, getLanguageFromPath } from './services/workspaceService.js';
import type { AIDebugRequest, AIDebugResponse } from './types.js';
import { createTerminalRouter, setupTerminalServer } from './terminal/terminalServer.js';
import { sessionManager } from './terminal/sessionManager.js';

try {
  process.loadEnvFile();
} catch {}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());
app.use('/api/terminal', createTerminalRouter());

// AI Provider Setup: Groq (ultra-fast inference via OpenAI-compatible endpoint)
const groqApiKey = process.env.GROQ_API_KEY;
const isRealGroqKey = Boolean(
  groqApiKey &&
  !groqApiKey.includes('paste_your_real_groq_api_key_here') &&
  groqApiKey.trim().length > 0
);

const groq = isRealGroqKey
  ? new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

// In-memory fallback if Supabase is offline
let supabaseConnected = false;
const memoryUsers = new Map<string, any>();
const memoryRooms = new Map<string, any>();
const memoryFiles = new Map<string, any>();

function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
}

async function verifyDatabaseConnection() {
  try {
    const { error } = await supabaseAdmin.from('rooms').select('count', { count: 'exact', head: true });
    if (error) {
      supabaseConnected = false;
      console.warn('⚠️ Supabase connection warning (using resilient in-memory fallback):', error.message);
    } else {
      supabaseConnected = true;
      console.log('✅ Connected to Supabase managed PostgreSQL successfully');
    }
  } catch (err: any) {
    supabaseConnected = false;
    console.warn('⚠️ Could not connect to Supabase, running in resilient in-memory mode:', err.message);
  }
}

// Root API probe
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Nexathon Collaborative IDE API',
    status: 'online',
    version: '1.0.0',
    supabaseConnected,
    aiProvider: groq ? 'groq' : 'none',
    endpoints: {
      health: '/api/health',
      rooms: '/api/rooms',
      terminal: '/api/terminal',
      debug: '/api/ai/debug',
    },
  });
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected,
    aiProvider: groq ? 'groq' : 'none',
  });
});

// Users
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { username, avatarUrl, id } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (supabaseConnected) {
      const user = await WorkspaceService.upsertUser(username, avatarUrl, id);
      return res.json(user);
    }

    let user = Array.from(memoryUsers.values()).find((u) => u.username === username);
    if (!user) {
      user = { id: id || uuidv4(), username, avatar_url: avatarUrl || null, created_at: new Date().toISOString() };
      memoryUsers.set(user.id, user);
    }
    res.json(user);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (supabaseConnected) {
      const user = await WorkspaceService.getUser(id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json(user);
    }

    const user = memoryUsers.get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
});

// Rooms / Workspaces
const handleListRooms = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    if (supabaseConnected) {
      try {
        const rooms = await WorkspaceService.listRooms(token);
        if (Array.isArray(rooms) && rooms.length > 0) {
          return res.json(rooms);
        }
      } catch (dbErr: any) {
        console.warn('⚠️ Supabase listRooms error, falling back to memory/default rooms:', dbErr?.message);
      }
    }

    // Ensure memoryRooms has at least default rooms if empty
    if (memoryRooms.size === 0) {
      const defaultRoom = {
        id: 'room_python_wasm',
        name: 'Python ML & Pyodide Sandbox',
        description: 'In-browser Pyodide WASM runtime with NumPy calculations and Yjs sync',
        owner_id: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryRooms.set(defaultRoom.id, defaultRoom);
    }

    const rooms = Array.from(memoryRooms.values()).map((r) => ({
      ...r,
      createdAt: r.created_at || r.createdAt || new Date().toISOString(),
      updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
      ownerId: r.owner_id || r.ownerId || 'default',
    }));
    return res.json(rooms);
  } catch (error: any) {
    console.error('Error listing rooms:', error);
    return res.json([
      {
        id: 'room_python_wasm',
        name: 'Python ML & Pyodide Sandbox',
        description: 'In-browser Pyodide WASM runtime with NumPy calculations and Yjs sync',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: 'default',
      },
    ]);
  }
};

app.get('/api/rooms', handleListRooms);
app.get('/rooms', handleListRooms);

const handleCreateRoom = async (req: Request, res: Response) => {
  try {
    const { name, ownerId, userId, description } = req.body;
    const effectiveOwnerId = ownerId || userId || 'default';
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (supabaseConnected) {
      try {
        const room = await WorkspaceService.createWorkspace({
          name: name.trim(),
          ownerId: effectiveOwnerId,
        });
        if (description && room) {
          room.description = description;
        }
        return res.status(201).json(room);
      } catch (dbError: any) {
        console.warn('⚠️ Supabase createWorkspace error, falling back to resilient in-memory workspace:', dbError?.message);
      }
    }

    // Resilient fallback (or memory mode)
    const roomId = `room_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const room = {
      id: roomId,
      name: name.trim(),
      description: description || undefined,
      owner_id: effectiveOwnerId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryRooms.set(room.id, room);

    // Initial default file
    memoryFiles.set(`${room.id}:index.js`, {
      id: uuidv4(),
      room_id: room.id,
      path: 'index.js',
      content: '// Collaborative IDE Workspace\nconsole.log("Ready to collaborate!");\n',
      language: 'javascript',
      version: 1,
      updated_at: new Date().toISOString(),
    });

    return res.status(201).json({
      id: room.id,
      name: room.name,
      description: room.description,
      ownerId: room.owner_id,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    });
  } catch (error: any) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: error.message || 'Failed to create room' });
  }
};

app.post('/api/rooms', handleCreateRoom);
app.post('/rooms', handleCreateRoom);

app.get('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const id = String(req.params.id);

    if (supabaseConnected) {
      const room = await WorkspaceService.getRoom(id, token);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      return res.json(room);
    }

    let room = memoryRooms.get(id);
    if (!room) {
      room = { id, name: 'Collaborative Room', owner_id: 'default', created_at: new Date().toISOString() };
      memoryRooms.set(room.id, room);
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

    if (supabaseConnected) {
      const files = await WorkspaceService.listFiles(id, token);
      return res.json(files);
    }

    let files = Array.from(memoryFiles.values()).filter((f) => f.room_id === id || f.roomId === id);
    if (files.length === 0) {
      const defaultFile = {
        id: `${id}:index.js`,
        name: 'index.js',
        path: 'index.js',
        content: '// Collaborative Workspace Entrypoint\nconsole.log("Hello from Nexathon IDE!");\n',
        language: 'javascript',
        room_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryFiles.set(defaultFile.id, defaultFile);
      files = [defaultFile];
    }
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

    if (supabaseConnected) {
      const file = await WorkspaceService.loadFile(roomId, filePath, token);
      if (!file) return res.status(404).json({ error: 'File not found' });
      return res.json(file);
    }

    let file = memoryFiles.get(`${roomId}:${filePath}`);
    if (!file) {
      for (const f of memoryFiles.values()) {
        if ((f.roomId === roomId || f.room_id === roomId) && (f.id === filePath || f.path === filePath)) {
          file = f;
          break;
        }
      }
    }

    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json(file);
  } catch (error: any) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch file' });
  }
});

app.post('/api/rooms/:roomId/files', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const rawPath = req.body.path || req.body.filePath || req.body.name;
    const content = req.body.content || '';
    const language = req.body.language;
    const expectedVersion = req.body.expectedVersion;

    if (!rawPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const filePath = String(rawPath);
    const determinedLang = language || getLanguageFromPath(filePath);

    if (supabaseConnected) {
      const savedFile = await WorkspaceService.saveFile({
        roomId,
        path: filePath,
        content,
        language: determinedLang,
        expectedVersion,
        userToken: token,
      });
      return res.status(201).json(savedFile);
    }

    const key = `${roomId}:${filePath}`;
    const existing = memoryFiles.get(key);
    const file = {
      id: existing?.id || uuidv4(),
      roomId,
      room_id: roomId,
      path: filePath,
      content,
      language: determinedLang,
      version: 1,
      updated_at: new Date().toISOString(),
    };
    memoryFiles.set(key, file);
    res.status(201).json(file);
  } catch (error: any) {
    console.error('Error creating/updating file:', error);
    const status = error.message?.includes('CONFLICT') ? 409 : 500;
    res.status(status).json({ error: error.message || 'Failed to save file' });
  }
});

const handleUpdateFile = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const fileIdentifier = String(req.params.filePath);
    const { content, path, language } = req.body;

    if (supabaseConnected) {
      const updated = await WorkspaceService.updateFileContent(roomId, fileIdentifier, content, path, language, token);
      if (!updated) return res.status(404).json({ error: 'File not found' });
      return res.json(updated);
    }

    let file = memoryFiles.get(`${roomId}:${fileIdentifier}`);
    if (!file) {
      for (const f of memoryFiles.values()) {
        if ((f.roomId === roomId || f.room_id === roomId) && (f.id === fileIdentifier || f.path === fileIdentifier)) {
          file = f;
          break;
        }
      }
    }
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    if (content !== undefined) file.content = content;
    if (path !== undefined) file.path = path;
    if (language !== undefined) file.language = language;
    file.updated_at = new Date().toISOString();
    res.json(file);
  } catch (error: any) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: error.message || 'Failed to update file' });
  }
};

app.patch('/api/rooms/:roomId/files/:filePath', handleUpdateFile);
app.put('/api/rooms/:roomId/files/:filePath', handleUpdateFile);

app.delete('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const fileIdentifier = String(req.params.filePath);

    if (supabaseConnected) {
      await WorkspaceService.deleteFile(roomId, fileIdentifier, token);
      return res.status(204).send();
    }

    memoryFiles.delete(`${roomId}:${fileIdentifier}`);
    for (const [key, f] of memoryFiles.entries()) {
      if ((f.roomId === roomId || f.room_id === roomId) && (f.id === fileIdentifier || f.path === fileIdentifier)) {
        memoryFiles.delete(key);
      }
    }
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// AI Debugger (Groq ultra-fast LPU inference)
app.post('/api/ai/debug', async (req: Request, res: Response) => {
  try {
    const { code, language, error, filePath }: AIDebugRequest = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    if (!groq) {
      return res.status(503).json({
        error: 'AI service not configured',
        explanation: 'GROQ_API_KEY is not configured in .env. Please provide a valid Groq API key.',
        probableCause: 'Missing GROQ_API_KEY configuration',
        suggestedFix: code,
        confidence: 0,
      });
    }

    const prompt = `You are an expert real-time programming debugger and pair programmer.
Analyze the following source code and error/issue context.
You must return valid JSON only with four fields:
1. "explanation": A clear, concise explanation of the bug and why it occurs.
2. "probableCause": The root technical cause of the issue.
3. "suggestedFix": The COMPLETE corrected source code for this entire file, ready to replace the file content directly. Do NOT return markdown or code fences in this field, only raw valid source code.
4. "confidence": A number between 0.0 and 1.0 indicating confidence in this fix.

File: ${filePath}
Language: ${language}

Source Code:
${code}

Error / Issue Context:
${error || 'Check code for syntax errors, bugs, or logic flaws.'}`;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You are an expert real-time code debugger. You strictly output valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });
    } catch (modelErr: any) {
      console.warn('Groq primary model openai/gpt-oss-120b failed, falling back to openai/gpt-oss-20b:', modelErr?.message || modelErr);
      completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: 'You are an expert real-time code debugger. You strictly output valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });
    }

    const rawContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawContent);

    const response: AIDebugResponse = {
      explanation: parsed.explanation || 'No explanation provided.',
      probableCause: parsed.probableCause || parsed.explanation || 'Root cause identified in code syntax or logic.',
      suggestedFix: parsed.suggestedFix || code,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
    };

    res.json(response);
  } catch (error: any) {
    console.error('Groq AI debug error:', error);
    res.status(500).json({
      error: 'AI debugging failed',
      explanation: error.message || 'Failed to get Groq AI assistance. Please check your GROQ_API_KEY.',
      probableCause: 'AI API request or parsing error',
      suggestedFix: req.body?.code || '',
      confidence: 0,
    });
  }
});

// Initialize Modular Collaborative Terminal WebSocket Server
setupTerminalServer(httpServer);

httpServer.listen(PORT, async () => {
  await verifyDatabaseConnection();
  console.log(`API server running on port ${PORT}`);
  console.log(`Terminal WebSocket available at ws://localhost:${PORT}/ws/terminal`);
});

const handleGracefulShutdown = async () => {
  console.log('\nGracefully shutting down API server and terminal sessions...');
  sessionManager.shutdown();
  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', handleGracefulShutdown);
process.on('SIGTERM', handleGracefulShutdown);
