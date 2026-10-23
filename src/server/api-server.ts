import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { supabaseAdmin } from './supabase.js';
import { WorkspaceService } from './services/workspaceService.js';
import type { AIDebugRequest, AIDebugResponse } from './types.js';
import { setupTerminalServer, createTerminalRouter } from './terminal/terminalServer.js';
import { sessionManager } from './terminal/sessionManager.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());
app.use('/api/terminal', createTerminalRouter());

// AI Provider Setup: Supports Groq (fast inference) or OpenAI
const groqApiKey = process.env.GROQ_API_KEY;
const isRealGroqKey = groqApiKey && !groqApiKey.includes('paste_your_real_groq_api_key_here');

const groq = isRealGroqKey
  ? new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected,
    aiProvider: groq ? 'groq' : openai ? 'openai' : 'none',
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
app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const { name, ownerId, userId } = req.body;
    const effectiveOwnerId = ownerId || userId;
    if (!name || !effectiveOwnerId) {
      return res.status(400).json({ error: 'Name and ownerId are required' });
    }

    if (supabaseConnected) {
      const room = await WorkspaceService.createWorkspace({ name, ownerId: effectiveOwnerId });
      return res.status(201).json(room);
    }

    const room = { id: uuidv4(), name, owner_id: effectiveOwnerId, created_at: new Date().toISOString() };
    memoryRooms.set(room.id, room);
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

    const files = Array.from(memoryFiles.values()).filter((f) => f.room_id === id);
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

    const file = memoryFiles.get(`${roomId}:${filePath}`);
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
    const { path, content = '', language, expectedVersion } = req.body;
    const roomId = String(req.params.roomId);

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    if (supabaseConnected) {
      const savedFile = await WorkspaceService.saveFile({
        roomId,
        path,
        content,
        language,
        expectedVersion,
        userToken: token,
      });
      return res.status(201).json(savedFile);
    }

    const file = {
      id: uuidv4(),
      room_id: roomId,
      path,
      content,
      language: language || 'plaintext',
      version: 1,
      updated_at: new Date().toISOString(),
    };
    memoryFiles.set(`${roomId}:${path}`, file);
    res.status(201).json(file);
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

    if (supabaseConnected) {
      const updated = await WorkspaceService.updateFileContent(roomId, filePath, content, token);
      if (!updated) return res.status(404).json({ error: 'File not found' });
      return res.json(updated);
    }

    const file = memoryFiles.get(`${roomId}:${filePath}`);
    if (!file) return res.status(404).json({ error: 'File not found' });
    file.content = content;
    file.updated_at = new Date().toISOString();
    res.json(file);
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

    if (supabaseConnected) {
      await WorkspaceService.deleteFile(roomId, filePath, token);
      return res.status(204).send();
    }

    memoryFiles.delete(`${roomId}:${filePath}`);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: error.message || 'Failed to delete file' });
  }
});

// AI Debugger (Groq with fallback to OpenAI)
app.post('/api/ai/debug', async (req: Request, res: Response) => {
  try {
    const { code, language, error, filePath }: AIDebugRequest = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    const activeAIClient = groq || openai;
    const modelName = groq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    if (!activeAIClient) {
      return res.status(503).json({
        error: 'AI service not configured',
        explanation: 'Neither GROQ_API_KEY nor OPENAI_API_KEY is configured. Please provide an API key in .env.',
        suggestedFix: null,
        confidence: 0,
      });
    }

    const prompt = `You are an expert programming assistant and real-time code debugger. Analyze the following code and error, then provide a clear explanation and suggested fix.

File: ${filePath}
Language: ${language}

Code:
\`\`\`${language}
${code}
\`\`\`

${error ? `Error / Console Trace:\n${error}\n` : ''}

Provide your response strictly in JSON format:
{
  "explanation": "Clear explanation of why the issue happens",
  "suggestedFix": "Fixed code snippet (or full corrected block)",
  "confidence": 0.95
}`;

    const completion = await activeAIClient.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'You are an expert real-time code debugger. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const response = JSON.parse(completion.choices[0].message.content || '{}') as AIDebugResponse;
    res.json(response);
  } catch (error: any) {
    console.error('AI debug error:', error);
    res.status(500).json({
      error: 'AI debugging failed',
      explanation: error.message || 'Failed to get AI assistance. Please check your API key.',
      suggestedFix: null,
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
