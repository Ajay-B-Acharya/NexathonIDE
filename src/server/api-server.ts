import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import type { Room, WorkspaceFile, User, AIDebugRequest, AIDebugResponse } from './types.js';
import { setupTerminalServer, createTerminalRouter } from './terminal/terminalServer.js';
import { sessionManager } from './terminal/sessionManager.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());
app.use('/api/terminal', createTerminalRouter());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/collaborative_ide',
  max: 20,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let dbConnected = false;
const memoryUsers = new Map<string, any>();
const memoryRooms = new Map<string, any>();
const memoryFiles = new Map<string, any>();

async function initDatabase() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          username VARCHAR(255) UNIQUE NOT NULL,
          avatar_url TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          owner_id UUID REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS workspace_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          path TEXT NOT NULL,
          content TEXT DEFAULT '',
          language VARCHAR(50) DEFAULT 'plaintext',
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(room_id, path)
        );
        
        CREATE INDEX IF NOT EXISTS idx_workspace_files_room_id ON workspace_files(room_id);
      `);
      dbConnected = true;
      console.log('[Database] PostgreSQL initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    dbConnected = false;
    console.warn(`[Database] PostgreSQL is not running on port 5432. Operating in resilient in-memory mode.`);
  }
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'sql': 'sql',
    'sh': 'shell',
    'yaml': 'yaml',
    'yml': 'yaml',
  };
  return langMap[ext || ''] || 'plaintext';
}

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), dbConnected });
});

app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { username, avatarUrl } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (dbConnected) {
      const result = await pool.query(
        'INSERT INTO users (username, avatar_url) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET avatar_url = $2 RETURNING *',
        [username, avatarUrl || null]
      );
      return res.json(result.rows[0]);
    }

    let user = Array.from(memoryUsers.values()).find(u => u.username === username);
    if (!user) {
      user = { id: uuidv4(), username, avatar_url: avatarUrl || null, created_at: new Date().toISOString() };
      memoryUsers.set(user.id, user);
    }
    res.json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users/:id', async (req: Request, res: Response) => {
  try {
    if (dbConnected) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(result.rows[0]);
    }

    const user = memoryUsers.get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const { name, ownerId } = req.body;
    if (!name || !ownerId) {
      return res.status(400).json({ error: 'Name and ownerId are required' });
    }
    
    if (dbConnected) {
      const result = await pool.query(
        'INSERT INTO rooms (name, owner_id) VALUES ($1, $2) RETURNING *',
        [name, ownerId]
      );
      return res.status(201).json(result.rows[0]);
    }

    const room = { id: uuidv4(), name, owner_id: ownerId, created_at: new Date().toISOString() };
    memoryRooms.set(room.id, room);
    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms/:id', async (req: Request, res: Response) => {
  try {
    if (dbConnected) {
      const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }
      return res.json(result.rows[0]);
    }

    let room = memoryRooms.get(req.params.id);
    if (!room) {
      room = { id: req.params.id, name: `Collaborative Room`, owner_id: 'default', created_at: new Date().toISOString() };
      memoryRooms.set(room.id, room);
    }
    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.get('/api/rooms/:id/files', async (req: Request, res: Response) => {
  try {
    if (dbConnected) {
      const result = await pool.query(
        'SELECT * FROM workspace_files WHERE room_id = $1 ORDER BY path',
        [req.params.id]
      );
      return res.json(result.rows);
    }

    const files = Array.from(memoryFiles.values()).filter(f => f.room_id === req.params.id);
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.get('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const filePath = req.params.filePath;
    
    if (dbConnected) {
      const result = await pool.query(
        'SELECT * FROM workspace_files WHERE room_id = $1 AND path = $2',
        [roomId, filePath]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
      return res.json(result.rows[0]);
    }

    const file = memoryFiles.get(`${roomId}:${filePath}`);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

app.post('/api/rooms/:roomId/files', async (req: Request, res: Response) => {
  try {
    const { path, content = '', language } = req.body;
    const roomId = req.params.roomId;
    
    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fileLanguage = language || getLanguageFromPath(path);
    
    if (dbConnected) {
      const result = await pool.query(
        `INSERT INTO workspace_files (room_id, path, content, language) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (room_id, path) DO UPDATE SET content = $3, language = $4, updated_at = NOW() 
         RETURNING *`,
        [roomId, path, content, fileLanguage]
      );
      return res.status(201).json(result.rows[0]);
    }

    const file = {
      id: uuidv4(),
      room_id: roomId,
      path,
      content,
      language: fileLanguage,
      updated_at: new Date().toISOString(),
    };
    memoryFiles.set(`${roomId}:${path}`, file);
    res.status(201).json(file);
  } catch (error) {
    console.error('Error creating/updating file:', error);
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.patch('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const filePath = req.params.filePath;
    const { content } = req.body;
    
    if (dbConnected) {
      const result = await pool.query(
        'UPDATE workspace_files SET content = $1, updated_at = NOW() WHERE room_id = $2 AND path = $3 RETURNING *',
        [content, roomId, filePath]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
      return res.json(result.rows[0]);
    }

    const file = memoryFiles.get(`${roomId}:${filePath}`);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    file.content = content;
    file.updated_at = new Date().toISOString();
    res.json(file);
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
});

app.delete('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const filePath = req.params.filePath;
    
    if (dbConnected) {
      await pool.query('DELETE FROM workspace_files WHERE room_id = $1 AND path = $2', [roomId, filePath]);
      return res.status(204).send();
    }

    memoryFiles.delete(`${roomId}:${filePath}`);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

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
        confidence: 0
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
        { role: 'user', content: prompt }
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
      confidence: 0
    });
  }
});

// Initialize Modular Collaborative Terminal WebSocket Server
setupTerminalServer(httpServer);

httpServer.listen(PORT, async () => {
  await initDatabase();
  console.log(`API server running on port ${PORT}`);
  console.log(`Terminal WebSocket available at ws://localhost:${PORT}/ws/terminal`);
});

const handleGracefulShutdown = async () => {
  console.log('\nGracefully shutting down API server and terminal sessions...');
  sessionManager.shutdown();
  if (dbConnected) {
    try {
      await pool.end();
    } catch {
      // Ignore cleanup error
    }
  }
  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', handleGracefulShutdown);
process.on('SIGTERM', handleGracefulShutdown);