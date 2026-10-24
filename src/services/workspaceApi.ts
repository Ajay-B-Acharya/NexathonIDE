import {
  SupportedLanguage,
  WorkspaceFile,
  WorkspaceRoom,
  ProjectProfile,
  GitHubRepoInfo,
  GitHubImportPayload,
  GitHubImportResult,
  WorkspaceGitState,
} from '../types';
import { getApiBaseUrl } from '../config/endpoints';

export interface ConflictDetails {
  type: 'file' | 'folder';
  path: string;
  name: string;
  existingItem?: {
    id?: string;
    path?: string;
    name?: string;
    updatedAt?: string;
  };
}

export class FileConflictError extends Error {
  public status = 409;
  public code = 'CONFLICT_EXISTS';
  public conflict: ConflictDetails;

  constructor(message: string, conflict: ConflictDetails) {
    super(message);
    this.name = 'FileConflictError';
    this.conflict = conflict;
  }
}

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
      const errJson = (await response.json()) as {
        message?: string;
        error?: string;
        code?: string;
        conflict?: ConflictDetails;
      };
      errorMessage = errJson.message || errJson.error || errorMessage;

      if (response.status === 409) {
        const conflictInfo: ConflictDetails = errJson.conflict || {
          type: 'file',
          path: '',
          name: '',
        };
        throw new FileConflictError(errorMessage, conflictInfo);
      }
    } catch (parseErr) {
      if (parseErr instanceof FileConflictError) {
        throw parseErr;
      }
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
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'c':
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'h':
    case 'hpp':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'dart':
      return 'dart';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
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
    payload: {
      path: string;
      content?: string;
      language?: SupportedLanguage;
      idempotencyKey?: string;
    }
  ): Promise<WorkspaceFile> {
    const cleanPath = payload.path.replace(/^\/+/, '');
    const name = cleanPath.split('/').pop() || cleanPath;
    const language = payload.language || detectLanguageFromPath(cleanPath);

    const headers: Record<string, string> = {};
    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey;
    }

    return request<WorkspaceFile>(`/rooms/${encodeURIComponent(roomId)}/files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        path: cleanPath,
        content: payload.content ?? '',
        language,
        idempotencyKey: payload.idempotencyKey,
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

  // GitHub Import & Git APIs
  async validateGitHubRepo(url: string, githubToken?: string): Promise<GitHubRepoInfo> {
    return request<GitHubRepoInfo>('/github/validate', {
      method: 'POST',
      body: JSON.stringify({ url, githubToken }),
    });
  },

  async importGitHubRepo(payload: GitHubImportPayload): Promise<GitHubImportResult> {
    return request<GitHubImportResult>('/github/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getProjectProfile(roomId: string): Promise<ProjectProfile> {
    return request<ProjectProfile>(`/workspaces/${encodeURIComponent(roomId)}/profile`);
  },

  async getWorkspaceGitState(roomId: string): Promise<WorkspaceGitState> {
    return request<WorkspaceGitState>(`/workspaces/${encodeURIComponent(roomId)}/git`);
  },

  async commitWorkspaceChanges(
    roomId: string,
    payload: { message: string; author: string }
  ): Promise<{ success: boolean; commit: { sha: string; message: string; author: string; timestamp: string } }> {
    return request(`/workspaces/${encodeURIComponent(roomId)}/git/commit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

