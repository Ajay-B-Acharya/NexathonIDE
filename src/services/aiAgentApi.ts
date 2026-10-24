import { getApiBaseUrl } from '../config/endpoints';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type {
  AIProviderType,
  UserAICredential,
  AIConversation,
  AIMessage,
  AIAgentContextPayload,
} from '../types';

async function getAuthHeaders(userId?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
      }
      if (data.session?.user?.id) {
        headers['x-user-id'] = data.session.user.id;
      }
    } catch {}
  }

  if (userId && !headers['x-user-id']) {
    headers['x-user-id'] = userId;
  }

  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}, userId?: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const authHeaders = await getAuthHeaders(userId);

  const response = await fetch(`${baseUrl}/ai/agent${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`;
    try {
      const err = await response.json();
      errorDetail = err.error || err.message || errorDetail;
    } catch {}
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const aiAgentApi = {
  /**
   * Get current user's provider settings (never exposes key).
   */
  async getSettings(userId?: string): Promise<UserAICredential & { isServerKeyAvailable: boolean }> {
    return request<UserAICredential & { isServerKeyAvailable: boolean }>('/settings', { method: 'GET' }, userId);
  },

  /**
   * Save user's encrypted provider credentials.
   */
  async saveSettings(
    payload: { provider: AIProviderType; apiKey: string; selectedModel?: string },
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(
      '/settings',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      userId
    );
  },

  /**
   * Delete personal AI credentials.
   */
  async deleteSettings(userId?: string): Promise<void> {
    await request<void>('/settings', { method: 'DELETE' }, userId);
  },

  /**
   * Test connection with a key or stored credentials.
   */
  async testConnection(
    payload: { provider: AIProviderType; apiKey?: string; model?: string },
    userId?: string
  ): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    return request<{ success: boolean; latencyMs: number; error?: string }>(
      '/test-connection',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      userId
    );
  },

  /**
   * List conversations for the user in a room.
   */
  async listConversations(roomId: string, userId?: string): Promise<AIConversation[]> {
    return request<AIConversation[]>(
      `/conversations?roomId=${encodeURIComponent(roomId)}`,
      { method: 'GET' },
      userId
    );
  },

  /**
   * Create a new conversation.
   */
  async createConversation(
    roomId: string,
    title?: string,
    userId?: string
  ): Promise<AIConversation> {
    return request<AIConversation>(
      '/conversations',
      {
        method: 'POST',
        body: JSON.stringify({ roomId, title }),
      },
      userId
    );
  },

  /**
   * Get messages for a specific conversation.
   */
  async getMessages(conversationId: string, userId?: string): Promise<AIMessage[]> {
    return request<AIMessage[]>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'GET' },
      userId
    );
  },

  /**
   * Delete a conversation.
   */
  async deleteConversation(conversationId: string, userId?: string): Promise<void> {
    await request<void>(
      `/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' },
      userId
    );
  },

  /**
   * Send user prompt with context to the agent.
   */
  async sendMessage(
    payload: {
      roomId: string;
      conversationId?: string;
      prompt: string;
      context?: AIAgentContextPayload;
    },
    userId?: string
  ): Promise<{ conversationId: string; message: AIMessage }> {
    return request<{ conversationId: string; message: AIMessage }>(
      '/chat',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      userId
    );
  },

  /**
   * Execute an approved command.
   */
  async executeCommand(
    payload: { command: string; workingDir?: string },
    userId?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
    return request<{ stdout: string; stderr: string; exitCode: number; durationMs: number }>(
      '/execute-command',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      userId
    );
  },
};
