import { SupportedLanguage, WorkspaceFile, WorkspaceRoom } from '../types';
import { getApiBaseUrl } from '../config/endpoints';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP error ${response.status}`;
    try {
      const errJson = (await response.json()) as { message?: string; error?: string };
      errorMessage = errJson.message || errJson.error || errorMessage;
    } catch {
      // Fallback to status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function detectLanguageFromPath(filePath: string): SupportedLanguage {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'python';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    default:
      return 'javascript';
  }
}

export const workspaceApi = {
  async listRooms(): Promise<WorkspaceRoom[]> {
    return request<WorkspaceRoom[]>('/rooms');
  },

  async getRoom(roomId: string): Promise<WorkspaceRoom> {
    return request<WorkspaceRoom>(`/rooms/${encodeURIComponent(roomId)}`);
  },

  async createRoom(payload: {
    name: string;
    description?: string;
    ownerId: string;
  }): Promise<WorkspaceRoom> {
    return request<WorkspaceRoom>('/rooms', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listFiles(roomId: string): Promise<WorkspaceFile[]> {
    return request<WorkspaceFile[]>(`/rooms/${encodeURIComponent(roomId)}/files`);
  },

  async createFile(
    roomId: string,
    payload: { path: string; content?: string; language?: SupportedLanguage }
  ): Promise<WorkspaceFile> {
    const cleanPath = payload.path.replace(/^\/+/, '');
    const name = cleanPath.split('/').pop() || cleanPath;
    const language = payload.language || detectLanguageFromPath(cleanPath);

    return request<WorkspaceFile>(`/rooms/${encodeURIComponent(roomId)}/files`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        path: cleanPath,
        content: payload.content ?? '',
        language,
      }),
    });
  },

  async updateFile(
    roomId: string,
    fileId: string,
    payload: { content?: string; path?: string; name?: string; language?: SupportedLanguage }
  ): Promise<WorkspaceFile> {
    return request<WorkspaceFile>(
      `/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteFile(roomId: string, fileId: string): Promise<void> {
    return request<void>(
      `/rooms/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
      }
    );
  },
};

