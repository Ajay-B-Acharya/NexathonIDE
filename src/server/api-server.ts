import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import Groq from 'groq-sdk';
import { supabaseAdmin } from './supabase.js';
import { WorkspaceService, getLanguageFromPath, isValidUUID } from './services/workspaceService.js';
import type { AIDebugRequest, AIDebugResponse } from './types.js';
import { createTerminalRouter, setupTerminalServer } from './terminal/terminalServer.js';
import { sessionManager } from './terminal/sessionManager.js';
import { startServer as startYjsServer, wss as yjsWss } from './yjs-server.js';
import { createAIAgentRouter } from './ai-agent-routes.js';
import { GitHubImportService } from './services/githubImportService.js';
import { ProjectDetectionService } from './services/projectDetectionService.js';

try {
  process.loadEnvFile();
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());
app.use('/api/terminal', createTerminalRouter());
app.use('/api/ai/agent', createAIAgentRouter());
app.use('/ai/agent', createAIAgentRouter());

// AI Provider Setup: Groq (ultra-fast inference via OpenAI-compatible endpoint)
const groqApiKey = process.env.GROQ_API_KEY;
const isRealGroqKey = Boolean(
  groqApiKey &&
  !groqApiKey.includes('paste_your_real_groq_api_key_here') &&
  groqApiKey.trim().length > 0
);

const groq = isRealGroqKey ? new Groq({ apiKey: groqApiKey }) : null;

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

// Root API probe & frontend entry
app.get('/api', (req: Request, res: Response) => {
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

app.get('/', (req: Request, res: Response, next) => {
  if (fs.existsSync(path.join(distPath, 'index.html')) && req.accepts('html')) {
    return res.sendFile(path.join(distPath, 'index.html'));
  }
  if (!fs.existsSync(path.join(distPath, 'index.html'))) {
    return res.json({
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
  }
  next();
});

// Health check (supporting both /api/health and standard Render /health)
const handleHealthCheck = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected,
    aiProvider: groq ? 'groq' : 'none',
  });
};
app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

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

    if (supabaseConnected && isValidUUID(id)) {
      try {
        const room = await WorkspaceService.getRoom(id, token);
        if (room) return res.json(room);
      } catch (dbErr: any) {
        console.warn('Notice: Could not load room from DB, checking memory store:', dbErr?.message);
      }
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
const handleListFiles = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const id = String(req.params.id || req.params.roomId);

    if (supabaseConnected && isValidUUID(id)) {
      try {
        const files = await WorkspaceService.listFiles(id, token);
        if (files && files.length > 0) {
          return res.json(files);
        }
      } catch (dbErr: any) {
        console.warn('Notice: Could not list files from DB, checking memory store:', dbErr?.message);
      }
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
};

app.get('/api/rooms/:id/files', handleListFiles);
app.get('/rooms/:id/files', handleListFiles);

const handleGetFile = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const filePath = String(req.params.filePath);

    if (supabaseConnected && isValidUUID(roomId)) {
      try {
        const file = await WorkspaceService.loadFile(roomId, filePath, token);
        if (file) return res.json(file);
      } catch (err: any) {
        console.warn('Notice: Could not load file from DB, checking memory:', err?.message);
      }
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
};

app.get('/api/rooms/:roomId/files/:filePath', handleGetFile);
app.get('/rooms/:roomId/files/:filePath', handleGetFile);

// Idempotency store to safely handle retried creation requests
interface IdempotencyRecord {
  file: any;
  status: number;
  timestamp: number;
}
const idempotencyStore = new Map<string, IdempotencyRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.timestamp > 10 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 1000);

const handleCreateFile = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const rawPath = req.body.path || req.body.filePath || req.body.name;
    const content = req.body.content || '';
    const language = req.body.language;
    const idempotencyKey = String(req.headers['idempotency-key'] || req.body.idempotencyKey || '').trim();

    if (!rawPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const cleanPath = String(rawPath).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanPath) {
      return res.status(400).json({ error: 'Valid path is required' });
    }
    if (cleanPath.includes('..')) {
      return res.status(400).json({ error: 'Path cannot contain directory traversal (..)' });
    }

    const fileName = cleanPath.split('/').pop() || cleanPath;
    const isFolderPlaceholder = fileName === '.gitkeep';
    const itemType = isFolderPlaceholder ? 'folder' : 'file';
    const displayPath = isFolderPlaceholder ? cleanPath.replace(/\/\.gitkeep$/, '') : cleanPath;
    const displayName = isFolderPlaceholder ? displayPath.split('/').pop() || displayPath : fileName;

    // Idempotency: If this exact creation request was already processed, return the cached result
    if (idempotencyKey) {
      const cacheKey = `${roomId}:${idempotencyKey}`;
      const cached = idempotencyStore.get(cacheKey);
      if (cached) {
        return res.status(cached.status).json(cached.file);
      }
    }

    const determinedLang = language || getLanguageFromPath(cleanPath);

    if (supabaseConnected && isValidUUID(roomId)) {
      try {
        const savedFile = await WorkspaceService.createFile({
          roomId,
          path: cleanPath,
          content,
          language: determinedLang,
          userToken: token,
        });

        if (idempotencyKey) {
          idempotencyStore.set(`${roomId}:${idempotencyKey}`, {
            file: savedFile,
            status: 201,
            timestamp: Date.now(),
          });
        }

        return res.status(201).json(savedFile);
      } catch (dbErr: any) {
        if (dbErr?.message?.includes('CONFLICT')) {
          let existingItem: any = null;
          try {
            const found = await WorkspaceService.loadFile(roomId, cleanPath, token);
            if (found) {
              existingItem = {
                id: found.id,
                path: found.path,
                name: found.name,
                updatedAt: found.updatedAt,
              };
            }
          } catch {}

          return res.status(409).json({
            error: dbErr.message,
            code: 'CONFLICT_EXISTS',
            conflict: {
              type: itemType,
              path: displayPath,
              name: displayName,
              existingItem,
            },
          });
        }
        console.warn('Notice: Database create error, falling back to memory store:', dbErr?.message);
      }
    }

    // In-memory store (for demo workspaces or offline fallback)
    const exactKey = `${roomId}:${cleanPath}`;
    const existingExact = memoryFiles.get(exactKey);

    if (existingExact) {
      return res.status(409).json({
        error: `CONFLICT: ${itemType === 'folder' ? 'Folder' : 'File'} "${displayPath}" already exists.`,
        code: 'CONFLICT_EXISTS',
        conflict: {
          type: itemType,
          path: displayPath,
          name: displayName,
          existingItem: {
            id: existingExact.id,
            path: existingExact.path,
            name: existingExact.name || displayName,
            updatedAt: existingExact.updated_at,
          },
        },
      });
    }

    // Case-insensitive / folder vs file collision checks
    for (const f of memoryFiles.values()) {
      if (f.roomId === roomId || f.room_id === roomId) {
        const existingPath = String(f.path).replace(/^\/+/, '');

        // Exact or case collision in same directory
        if (existingPath.toLowerCase() === cleanPath.toLowerCase()) {
          return res.status(409).json({
            error: `CONFLICT: An item with path "${displayPath}" already exists.`,
            code: 'CONFLICT_EXISTS',
            conflict: {
              type: itemType,
              path: displayPath,
              name: displayName,
              existingItem: {
                id: f.id,
                path: f.path,
                name: f.name || displayName,
                updatedAt: f.updated_at,
              },
            },
          });
        }

        // Folder vs File collision: Cannot create a file where a folder exists
        if (existingPath.toLowerCase().startsWith(`${cleanPath.toLowerCase()}/`)) {
          return res.status(409).json({
            error: `CONFLICT: Cannot create file "${cleanPath}" because a folder with that name already exists.`,
            code: 'CONFLICT_EXISTS',
            conflict: {
              type: 'folder',
              path: displayPath,
              name: displayName,
              existingItem: {
                id: f.id,
                path: f.path,
                name: displayName,
                updatedAt: f.updated_at,
              },
            },
          });
        }

        // Folder vs File collision: Cannot create an item inside an existing file
        const segments = cleanPath.split('/');
        if (segments.length > 1) {
          let prefix = '';
          for (let i = 0; i < segments.length - 1; i++) {
            prefix = prefix ? `${prefix}/${segments[i]}` : segments[i];
            if (existingPath.toLowerCase() === prefix.toLowerCase()) {
              return res.status(409).json({
                error: `CONFLICT: Cannot create item inside "${prefix}" because it is a file, not a folder.`,
                code: 'CONFLICT_EXISTS',
                conflict: {
                  type: 'file',
                  path: prefix,
                  name: segments[i],
                  existingItem: {
                    id: f.id,
                    path: f.path,
                    name: segments[i],
                    updatedAt: f.updated_at,
                  },
                },
              });
            }
          }
        }
      }
    }

    const newFile = {
      id: uuidv4(),
      roomId,
      room_id: roomId,
      path: cleanPath,
      name: fileName,
      content,
      language: determinedLang,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryFiles.set(exactKey, newFile);

    if (idempotencyKey) {
      idempotencyStore.set(`${roomId}:${idempotencyKey}`, {
        file: newFile,
        status: 201,
        timestamp: Date.now(),
      });
    }

    return res.status(201).json(newFile);
  } catch (error: any) {
    console.error('Error creating file:', error);
    const status = error.message?.includes('CONFLICT') ? 409 : 500;
    res.status(status).json({ error: error.message || 'Failed to create file' });
  }
};

app.post('/api/rooms/:roomId/files', handleCreateFile);
app.post('/rooms/:roomId/files', handleCreateFile);

const handleUpdateFile = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const fileIdentifier = String(req.params.filePath);
    const { content, path, language } = req.body;

    if (supabaseConnected && isValidUUID(roomId)) {
      try {
        const updated = await WorkspaceService.updateFileContent(roomId, fileIdentifier, content, path, language, token);
        if (updated) return res.json(updated);
      } catch (err: any) {
        if (err?.message?.includes('CONFLICT') || (err as any).code === '23505') {
          return res.status(409).json({ error: 'CONFLICT: Target path already exists', code: 'CONFLICT_EXISTS' });
        }
        console.warn('Notice: Could not update file in DB, checking memory:', err?.message);
      }
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

    // Rename collision check for in-memory store
    if (path !== undefined) {
      const cleanNewPath = String(path).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      if (cleanNewPath.toLowerCase() !== file.path.toLowerCase()) {
        for (const other of memoryFiles.values()) {
          if ((other.roomId === roomId || other.room_id === roomId) && other.id !== file.id) {
            if (other.path.toLowerCase() === cleanNewPath.toLowerCase()) {
              return res.status(409).json({
                error: `CONFLICT: Target path "${cleanNewPath}" already exists.`,
                code: 'CONFLICT_EXISTS',
              });
            }
          }
        }
      }
      file.path = cleanNewPath;
      file.name = cleanNewPath.split('/').pop() || cleanNewPath;
    }

    if (content !== undefined) file.content = content;
    if (language !== undefined) file.language = language;
    file.updated_at = new Date().toISOString();
    res.json(file);
  } catch (error: any) {
    console.error('Error updating file:', error);
    const status = error.message?.includes('CONFLICT') ? 409 : 500;
    res.status(status).json({ error: error.message || 'Failed to update file' });
  }
};

app.patch('/api/rooms/:roomId/files/:filePath', handleUpdateFile);
app.patch('/rooms/:roomId/files/:filePath', handleUpdateFile);
app.put('/api/rooms/:roomId/files/:filePath', handleUpdateFile);
app.put('/rooms/:roomId/files/:filePath', handleUpdateFile);

const handleDeleteFile = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const roomId = String(req.params.roomId);
    const fileIdentifier = String(req.params.filePath);

    if (supabaseConnected && isValidUUID(roomId)) {
      try {
        await WorkspaceService.deleteFile(roomId, fileIdentifier, token);
        return res.status(204).send();
      } catch (err: any) {
        console.warn('Notice: Could not delete file from DB:', err?.message);
      }
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
};

app.delete('/api/rooms/:roomId/files/:filePath', handleDeleteFile);
app.delete('/rooms/:roomId/files/:filePath', handleDeleteFile);

// ============================================================================
// GitHub Import & Multi-Language Repository APIs
// ============================================================================

app.post(['/api/github/validate', '/github/validate'], async (req: Request, res: Response) => {
  try {
    const { url, githubToken } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const info = await GitHubImportService.validateRepository(url, githubToken);
    res.json(info);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Validation failed' });
  }
});

app.post(['/api/github/import', '/github/import'], async (req: Request, res: Response) => {
  try {
    const { url, branch, ownerId, name, githubToken } = req.body;
    if (!url) return res.status(400).json({ error: 'Repository URL is required' });
    const result = await GitHubImportService.importRepository(
      { url, branch, ownerId: ownerId || 'default', name, githubToken },
      memoryRooms,
      memoryFiles
    );
    res.status(201).json(result);
  } catch (err: any) {
    console.error('GitHub import failed:', err);
    res.status(400).json({ error: err.message || 'Repository import failed' });
  }
});

app.get(['/api/workspaces/:roomId/profile', '/workspaces/:roomId/profile'], async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    let files: Array<{ path: string; content?: string }> = [];
    if (supabaseConnected && isValidUUID(roomId)) {
      try {
        const dbFiles = await WorkspaceService.listFiles(roomId);
        if (Array.isArray(dbFiles)) {
          files = dbFiles.map((f: any) => ({ path: f.path, content: f.content }));
        }
      } catch {}
    }
    if (files.length === 0) {
      files = Array.from(memoryFiles.values())
        .filter((f) => f.room_id === roomId || f.roomId === roomId)
        .map((f) => ({ path: f.path, content: f.content }));
    }
    const profile = ProjectDetectionService.analyzeProject(files);
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to detect project profile' });
  }
});

const memoryGitCommits = new Map<string, Array<{ sha: string; message: string; author: string; timestamp: string }>>();

app.get(['/api/workspaces/:roomId/git', '/workspaces/:roomId/git'], async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    let room: any = null;
    if (supabaseConnected && isValidUUID(roomId)) {
      try {
        room = await WorkspaceService.getRoom(roomId);
      } catch {}
    }
    if (!room) {
      room = memoryRooms.get(roomId);
    }

    const commits = memoryGitCommits.get(roomId) || [
      {
        sha: room?.commit_sha || room?.commitSha || 'c01a4e8',
        message: room?.isGitHubImport || room?.repository_url ? 'Initial GitHub import' : 'Initial workspace commit',
        author: 'developer',
        timestamp: room?.created_at || room?.createdAt || new Date().toISOString(),
      },
    ];

    res.json({
      branch: room?.branch || 'main',
      commitSha: room?.commit_sha || room?.commitSha || 'c01a4e8',
      repositoryUrl: room?.repository_url || room?.repositoryUrl || undefined,
      branches: [room?.branch || 'main'],
      modifiedFiles: [],
      untrackedFiles: [],
      isClean: true,
      commits,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/workspaces/:roomId/git/commit', '/workspaces/:roomId/git/commit'], async (req: Request, res: Response) => {
  try {
    const roomId = String(req.params.roomId);
    const { message, author } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Commit message is required' });
    }
    const sha = Math.random().toString(36).substring(2, 9);
    const newCommit = {
      sha,
      message: message.trim(),
      author: author || 'Collaborator',
      timestamp: new Date().toISOString(),
    };

    const existing = memoryGitCommits.get(roomId) || [];
    existing.unshift(newCommit);
    memoryGitCommits.set(roomId, existing);

    res.status(201).json({ success: true, commit: newCommit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Debugger (Groq ultra-fast LPU inference)
const handleAIDebug = async (req: Request, res: Response) => {
  try {
    const { code, language, error, filePath }: AIDebugRequest = req.body;

    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        explanation: 'No source code was provided to debug. Please open a file containing code.',
        probableCause: 'Empty or missing code parameter',
        suggestedFix: '',
        confidence: 0,
      });
    }

    const determinedLang = language || (filePath ? getLanguageFromPath(filePath) : 'plaintext');

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
3. "suggestedFix": The COMPLETE corrected source code for this entire file, ready to replace the file content directly. Do NOT return markdown code fences in this field, only raw valid source code.
4. "confidence": A number between 0.0 and 1.0 indicating confidence in this fix.

File: ${filePath || 'untitled'}
Language: ${determinedLang}

Source Code:
${code}

Error / Issue Context:
${error || 'Check code for syntax errors, bugs, or logic flaws.'}`;

    const rawCandidates = [
      process.env.GROQ_MODEL,
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
    ].filter(Boolean) as string[];

    // Filter out decommissioned llama-3.1-70b-versatile
    const candidateModels = rawCandidates.filter((m) => m !== 'llama-3.1-70b-versatile');

    let completion = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are an expert real-time code debugger. You strictly output valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        });
        if (completion?.choices?.[0]?.message?.content) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Groq] Model ${model} failed (${err?.status || err?.message}), attempting next fallback model...`);
      }
    }

    if (!completion || !completion.choices?.[0]?.message?.content) {
      throw lastError || new Error('No Groq models available or responding.');
    }

    const rawContent = completion.choices[0].message.content || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { explanation: rawContent, suggestedFix: code };
    }

    // Clean suggestedFix: strip enclosing markdown code fences if present
    let cleanFix = parsed.suggestedFix || code;
    if (typeof cleanFix === 'string') {
      cleanFix = cleanFix.replace(/^```[a-zA-Z]*\r?\n/, '').replace(/\r?\n```$/, '');
    }

    const response: AIDebugResponse = {
      explanation: parsed.explanation || 'Issue diagnosed in code syntax or logic.',
      probableCause: parsed.probableCause || parsed.explanation || 'Root cause identified.',
      suggestedFix: cleanFix,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Groq AI debug error:', error?.message || error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : 500;
    return res.status(status).json({
      error: 'AI debugging failed',
      explanation: error?.message || 'Failed to get Groq AI assistance. Please check your GROQ_API_KEY.',
      probableCause: error?.status ? `Groq API HTTP ${error.status}` : 'AI inference error',
      suggestedFix: req.body?.code || '',
      confidence: 0,
    });
  }
};

app.post('/api/ai/debug', handleAIDebug);
app.post('/ai/debug', handleAIDebug);

// Static frontend serving and SPA fallback for production when dist/ exists
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req: Request, res: Response, next) => {
    if (req.method !== 'GET') {
      return next();
    }
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/ws') ||
      req.path.startsWith('/yjs') ||
      req.path.startsWith('/terminal') ||
      req.path.startsWith('/health')
    ) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const terminalWss = setupTerminalServer();

// Unified WebSocket Upgrade Router for Terminal & Yjs CRDT Collaboration
httpServer.on('upgrade', (request, socket, head) => {
  try {
    const parsed = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const pathname = parsed.pathname;

    if (pathname.startsWith('/ws/terminal') || pathname === '/terminal') {
      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        terminalWss.emit('connection', ws, request);
      });
    } else if (pathname.startsWith('/yjs') || pathname.startsWith('/collab')) {
      yjsWss.handleUpgrade(request, socket as any, head, (ws) => {
        yjsWss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err: any) {
    console.warn('Notice: WebSocket upgrade error:', err?.message);
    try {
      socket.destroy();
    } catch {}
  }
});

const YJS_PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT, 10) : 1234;
startYjsServer(YJS_PORT)
  .then(() => {
    console.log(`Yjs Collaboration WebSocket running on ws://localhost:${YJS_PORT}`);
  })
  .catch((err) => {
    if ((err as any)?.code === 'EADDRINUSE') {
      console.log(`Yjs Collaboration WebSocket active on port ${YJS_PORT}`);
    } else {
      console.warn('Yjs server startup note:', err?.message || err);
    }
  });

httpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n======================================================`);
    console.error(`[API Server] Error: Port ${PORT} is already in use.`);
    console.error(`A previous API server instance or process is occupying port ${PORT}.`);
    console.error(`To stop it, run: npm run stop:all`);
    console.error(`======================================================\n`);
    process.exit(1);
  } else {
    console.error('[API Server] Fatal server error:', err);
    process.exit(1);
  }
});

httpServer.listen(PORT, '0.0.0.0', async () => {
  await verifyDatabaseConnection();
  console.log(`API server running on port ${PORT}`);
  console.log(`Terminal WebSocket available at ws://localhost:${PORT}/ws/terminal`);
  console.log(`Unified Yjs WebSocket available at ws://localhost:${PORT}/yjs`);
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
