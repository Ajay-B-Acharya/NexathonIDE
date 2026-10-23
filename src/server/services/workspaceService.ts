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

    return room;
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
    return data;
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
    return data || [];
  }

  /**
   * Load single file by path
   */
  static async loadFile(roomId: string, filePath: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const { data, error } = await client
      .from('workspace_files')
      .select('*')
      .eq('room_id', roomId)
      .eq('path', filePath)
      .single();

    if (error) return null;
    return data;
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
      return data;
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
    return data;
  }

  /**
   * Patch file content
   */
  static async updateFileContent(roomId: string, filePath: string, content: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const { data, error } = await client
      .from('workspace_files')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('path', filePath)
      .select('*')
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Delete file
   */
  static async deleteFile(roomId: string, filePath: string, userToken?: string) {
    const client = createScopedClient(userToken);
    const { error } = await client
      .from('workspace_files')
      .delete()
      .eq('room_id', roomId)
      .eq('path', filePath);

    if (error) throw new Error(`Failed to delete file: ${error.message}`);
    return true;
  }
}
