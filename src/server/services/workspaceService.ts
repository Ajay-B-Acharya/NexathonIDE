import { supabaseAdmin, createScopedClient } from '../supabase.js';

export interface CreateWorkspaceDTO {
  name: string;
  ownerId?: string;
  userId?: string;
}

export interface SaveFileDTO {
  roomId: string;
  path: string;
  content: string;
  language?: string;
  expectedVersion?: number;
  userToken?: string;
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return langMap[ext || ''] || 'plaintext';
}

export function formatRoom(room: any) {
  if (!room) return room;
  return {
    ...room,
    createdAt: room.created_at || room.createdAt || new Date().toISOString(),
    updatedAt: room.updated_at || room.updatedAt || new Date().toISOString(),
    ownerId: room.owner_id || room.ownerId || 'default',
  };
}

export function formatFile(file: any) {
  if (!file) return file;
  return {
    ...file,
    roomId: file.room_id || file.roomId,
    createdAt: file.created_at || file.createdAt || new Date().toISOString(),
    updatedAt: file.updated_at || file.updatedAt || new Date().toISOString(),
  };
}

export class WorkspaceService {
  /**
   * Create or fetch user profile
   */
  static async upsertUser(username: string, avatarUrl?: string, userId?: string) {
    if (!username) throw new Error('Username is required');

    // If userId is provided, update or insert with that id
    const payload: Record<string, any> = { username };
    if (avatarUrl) payload.avatar_url = avatarUrl;
    if (userId) payload.id = userId;

    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(payload, { onConflict: 'username' })
      .select('*')
      .single();

    if (error) throw new Error(`User upsert failed: ${error.message}`);
    return data;
  }

  /**
   * Get user by ID
   */
  static async getUser(id: string) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create a new workspace / room
   */
  static async createWorkspace({ name, ownerId, userId }: CreateWorkspaceDTO) {
    const effectiveOwnerId = ownerId || userId;
    if (!name || name.trim().length === 0) {
      throw new Error('Workspace name is required');
    }
    if (!effectiveOwnerId) {
      throw new Error('Owner ID is required to create a workspace');
    }

    // Insert room
    const { data: room, error } = await supabaseAdmin
      .from('rooms')
      .insert({
        name: name.trim(),
        owner_id: effectiveOwnerId,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create workspace: ${error.message}`);

    // Create a default initial file
    const defaultFile = {
      room_id: room.id,
      path: 'index.js',
      content: '// Collaborative IDE Workspace\nconsole.log("Ready to collaborate!");\n',
      language: 'javascript',
      version: 1,
    };

    await supabaseAdmin.from('workspace_files').insert(defaultFile);

    return formatRoom(room);
  }

  /**
   * List all rooms / workspaces
   */
  static async listRooms(userToken?: string) {
    const client = createScopedClient(userToken);
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      const { data: adminRooms } = await supabaseAdmin
        .from('rooms')
        .select('*')
        .order('created_at', { ascending: false });
      return (adminRooms || []).map(formatRoom);
    }

    return (data || []).map(formatRoom);
  }

  /**
   * Get room by ID
   */
  static async getRoom(id: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return formatRoom(data);
  }

  /**
   * List files in a workspace
   */
  static async listFiles(roomId: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const { data, error } = await client
      .from('workspace_files')
      .select('*')
      .eq('room_id', roomId)
      .order('path', { ascending: true });

    if (error) throw new Error(`Failed to list files: ${error.message}`);
    return (data || []).map(formatFile);
  }

  /**
   * Load single file by id or path
   */
  static async loadFile(roomId: string, fileIdentifier: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdentifier);

    let query = client.from('workspace_files').select('*').eq('room_id', roomId);
    if (isUUID) {
      query = query.or(`id.eq.${fileIdentifier},path.eq.${fileIdentifier}`);
    } else {
      query = query.eq('path', fileIdentifier);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return formatFile(data);
  }

  /**
   * Save or upsert a file with Optimistic Concurrency Control (OCC)
   */
  static async saveFile({ roomId, path, content, language, expectedVersion, userToken }: SaveFileDTO) {
    const client = createScopedClient(userToken);
    const fileLanguage = language || getLanguageFromPath(path);

    // Optimistic Concurrency Control check
    if (expectedVersion !== undefined) {
      const { data, error } = await client
        .from('workspace_files')
        .update({
          content,
          language: fileLanguage,
          version: expectedVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .eq('path', path)
        .eq('version', expectedVersion)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error('CONFLICT: File was modified by another user or session. Please reload.');
      }
      return formatFile(data);
    }

    // Upsert if no version locking requested
    const { data, error } = await client
      .from('workspace_files')
      .upsert(
        {
          room_id: roomId,
          path,
          content,
          language: fileLanguage,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'room_id,path' }
      )
      .select('*')
      .single();

    if (error) throw new Error(`Failed to save file: ${error.message}`);
    return formatFile(data);
  }

  /**
   * Patch file content by id or path
   */
  static async updateFileContent(
    roomId: string,
    fileIdentifier: string,
    content?: string,
    path?: string,
    language?: string,
    userToken?: string
  ) {
    const client = createScopedClient(userToken);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdentifier);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (content !== undefined) updatePayload.content = content;
    if (path !== undefined) updatePayload.path = path;
    if (language !== undefined) updatePayload.language = language;

    let query = client.from('workspace_files').update(updatePayload).eq('room_id', roomId);
    if (isUUID) {
      query = query.or(`id.eq.${fileIdentifier},path.eq.${fileIdentifier}`);
    } else {
      query = query.eq('path', fileIdentifier);
    }

    const { data, error } = await query.select('*');
    if (error || !data || data.length === 0) return null;
    return formatFile(data[0]);
  }

  /**
   * Delete file by id or path
   */
  static async deleteFile(roomId: string, fileIdentifier: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileIdentifier);

    let query = client.from('workspace_files').delete().eq('room_id', roomId);
    if (isUUID) {
      query = query.or(`id.eq.${fileIdentifier},path.eq.${fileIdentifier}`);
    } else {
      query = query.eq('path', fileIdentifier);
    }

    const { error } = await query;
    if (error) throw new Error(`Failed to delete file: ${error.message}`);
    return true;
  }
}
