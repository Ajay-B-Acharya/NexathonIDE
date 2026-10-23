import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { Pool } from 'pg';
import OpenAI from 'openai';
import type { AIDebugRequest, AIDebugResponse } from '../types/index.js';
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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/collaborative_ide',
  max: 20,
});

const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here');
const openai = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
    const { username, avatar_url } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    if (dbConnected) {
      const result = await pool.query(
        'INSERT INTO users (username, avatar_url) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET avatar_url = $2 RETURNING *',
        [username, avatar_url]
      );
      return res.json(result.rows[0]);
    }

    let user = memoryUsers.get(username);
    if (!user) {
      user = {
        id: `usr_${crypto.randomUUID().slice(0, 8)}`,
        username,
        avatar_url,
        created_at: new Date().toISOString(),
      };
      memoryUsers.set(username, user);
    } else if (avatar_url) {
      user.avatar_url = avatar_url;
    }
    res.json(user);
  } catch (error) {
    console.error('Error creating/updating user:', error);
    res.status(500).json({ error: 'Failed to create/update user' });
  }
});

app.get('/api/rooms', async (req: Request, res: Response) => {
  try {
    if (dbConnected) {
      const result = await pool.query('SELECT * FROM rooms ORDER BY created_at DESC');
      return res.json(result.rows);
    }
    res.json(Array.from(memoryRooms.values()));
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

app.post('/api/rooms', async (req: Request, res: Response) => {
  try {
    const { name, owner_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    
    if (dbConnected) {
      const result = await pool.query(
        'INSERT INTO rooms (name, owner_id) VALUES ($1, $2) RETURNING *',
        [name, owner_id || null]
      );
      
      const newRoom = result.rows[0];
      
      const defaultFiles = [
        { path: 'main.py', content: '# Welcome to your Python collaborative workspace!\n\ndef calculate_fibonacci(n):\n    if n <= 0:\n        return []\n    elif n == 1:\n        return [0]\n    fib = [0, 1]\n    while len(fib) < n:\n        fib.append(fib[-1] + fib[-2])\n    return fib\n\nif __name__ == "__main__":\n    print("Fibonacci Sequence (first 10 numbers):")\n    print(calculate_fibonacci(10))\n' },
        { path: 'index.js', content: '// Welcome to your JavaScript collaborative workspace!\n\nfunction processData(items) {\n    return items\n        .map(x => x * 2)\n        .filter(x => x > 5);\n}\n\nconst testData = [1, 2, 3, 4, 5];\nconsole.log("Processed Results:", processData(testData));\n' },
        { path: 'README.md', content: `# Collaborative Workspace\n\nThis workspace is synced across all connected peers in real time using Yjs CRDTs.\n\n### Features\n- Real-time peer-to-peer editing\n- Pyodide client-side Python execution\n- QuickJS client-side JavaScript execution\n- Shared interactive cloud terminal\n- AI Debugger with syntax error diagnostics\n` },
      ];
      
      for (const file of defaultFiles) {
        await pool.query(
          'INSERT INTO workspace_files (room_id, path, content, language) VALUES ($1, $2, $3, $4)',
          [newRoom.id, file.path, file.content, getLanguageFromPath(file.path)]
        );
      }
      
      return res.status(201).json(newRoom);
    }

    const roomId = `room_${crypto.randomUUID().slice(0, 8)}`;
    const newRoom = {
      id: roomId,
      name,
      owner_id: owner_id || null,
      created_at: new Date().toISOString(),
    };
    memoryRooms.set(roomId, newRoom);

    const defaultFiles = [
      { path: 'main.py', content: '# Welcome to your Python collaborative workspace!\n\ndef calculate_fibonacci(n):\n    if n <= 0:\n        return []\n    elif n == 1:\n        return [0]\n    fib = [0, 1]\n    while len(fib) < n:\n        fib.append(fib[-1] + fib[-2])\n    return fib\n\nif __name__ == "__main__":\n    print("Fibonacci Sequence (first 10 numbers):")\n    print(calculate_fibonacci(10))\n' },
      { path: 'index.js', content: '// Welcome to your JavaScript collaborative workspace!\n\nfunction processData(items) {\n    return items\n        .map(x => x * 2)\n        .filter(x => x > 5);\n}\n\nconst testData = [1, 2, 3, 4, 5];\nconsole.log("Processed Results:", processData(testData));\n' },
      { path: 'README.md', content: `# Collaborative Workspace\n\nThis workspace is synced across all connected peers in real time using Yjs CRDTs.\n\n### Features\n- Real-time peer-to-peer editing\n- Pyodide client-side Python execution\n- QuickJS client-side JavaScript execution\n- Shared interactive cloud terminal\n- AI Debugger with syntax error diagnostics\n` },
    ];

    for (const file of defaultFiles) {
      const fileId = `file_${crypto.randomUUID().slice(0, 8)}`;
      memoryFiles.set(`${roomId}:${file.path}`, {
        id: fileId,
        roomId,
        path: file.path,
        content: file.content,
        language: getLanguageFromPath(file.path),
        updated_at: new Date().toISOString(),
      });
    }

    res.status(201).json(newRoom);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

app.get('/api/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    
    if (dbConnected) {
      const roomResult = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
      if (roomResult.rows.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      const filesResult = await pool.query('SELECT * FROM workspace_files WHERE room_id = $1 ORDER BY path ASC', [roomId]);
      const room = roomResult.rows[0];
      room.files = filesResult.rows;
      return res.json(room);
    }

    const room = memoryRooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const files = Array.from(memoryFiles.values()).filter((f: any) => f.roomId === roomId);
    res.json({ ...room, files });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

app.get('/api/rooms/:roomId/files', async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    if (dbConnected) {
      const result = await pool.query('SELECT * FROM workspace_files WHERE room_id = $1 ORDER BY path ASC', [roomId]);
      return res.json(result.rows);
    }
    const files = Array.from(memoryFiles.values()).filter((f: any) => f.roomId === roomId);
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.post('/api/rooms/:roomId/files', async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    const { path: filePath, content = '', language } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const determinedLang = language || getLanguageFromPath(filePath);
    
    if (dbConnected) {
      const result = await pool.query(
        'INSERT INTO workspace_files (room_id, path, content, language) VALUES ($1, $2, $3, $4) ON CONFLICT (room_id, path) DO UPDATE SET content = $3, language = $4, updated_at = NOW() RETURNING *',
        [roomId, filePath, content, determinedLang]
      );
      return res.status(201).json(result.rows[0]);
    }

    const key = `${roomId}:${filePath}`;
    const existing = memoryFiles.get(key);
    const file = {
      id: existing?.id || `file_${crypto.randomUUID().slice(0, 8)}`,
      roomId,
      path: filePath,
      content,
      language: determinedLang,
      updated_at: new Date().toISOString(),
    };
    memoryFiles.set(key, file);
    res.status(201).json(file);
  } catch (error) {
    console.error('Error creating/updating file:', error);
    res.status(500).json({ error: 'Failed to create/update file' });
  }
});

const handleUpdateFile = async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    const fileIdentifier = String(req.params.filePath);
    const { content, path, language } = req.body;
    
    if (dbConnected) {
      const result = await pool.query(
        'UPDATE workspace_files SET content = COALESCE($1, content), path = COALESCE($4, path), language = COALESCE($5, language), updated_at = NOW() WHERE room_id = $2 AND (path = $3 OR id::text = $3) RETURNING *',
        [content, roomId, fileIdentifier, path || null, language || null]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'File not found' });
      }
      return res.json(result.rows[0]);
    }

    let file = memoryFiles.get(`${roomId}:${fileIdentifier}`);
    if (!file) {
      for (const [key, f] of memoryFiles.entries()) {
        if (f.roomId === roomId && (f.id === fileIdentifier || f.path === fileIdentifier)) {
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
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
};

app.patch('/api/rooms/:roomId/files/:filePath', handleUpdateFile);
app.put('/api/rooms/:roomId/files/:filePath', handleUpdateFile);

app.delete('/api/rooms/:roomId/files/:filePath', async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    const fileIdentifier = String(req.params.filePath);
    
    if (dbConnected) {
      await pool.query(
        'DELETE FROM workspace_files WHERE room_id = $1 AND (path = $2 OR id::text = $2)',
        [roomId, fileIdentifier]
      );
      return res.status(204).send();
    }

    memoryFiles.delete(`${roomId}:${fileIdentifier}`);
    for (const [key, f] of memoryFiles.entries()) {
      if (f.roomId === roomId && (f.id === fileIdentifier || f.path === fileIdentifier)) {
        memoryFiles.delete(key);
      }
    }
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
    
    if (!openai) {
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
