import crypto from 'crypto';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { supabaseAdmin } from '../supabase.js';

export interface UserAICredentialRecord {
  userId: string;
  provider: 'groq' | 'openai' | 'anthropic';
  selectedModel: string;
  hasKey: boolean;
  updatedAt?: string;
  // Raw API key is ONLY returned internally on the server when needed for inference
  rawApiKey?: string;
}

// Derive a 32-byte AES key from server secret
const SERVER_SECRET =
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.GROQ_API_KEY ||
  'nexathon-ide-internal-ai-credential-encryption-key-v1';

const ENCRYPTION_KEY = crypto.createHash('sha256').update(SERVER_SECRET).digest();

/**
 * Encrypt an API key using AES-256-GCM authenticated encryption.
 */
export function encryptApiKey(apiKey: string): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypt an API key using AES-256-GCM.
 */
export function decryptApiKey(ciphertext: string, ivHex: string, tagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Resilient in-memory fallback for credentials if Supabase is offline or not configured
const memoryCredentials = new Map<string, {
  userId: string;
  provider: 'groq' | 'openai' | 'anthropic';
  selectedModel: string;
  encrypted: string;
  iv: string;
  tag: string;
  updatedAt: string;
}>();

export class AICredentialService {
  /**
   * Retrieve credential info for a user.
   * includeRawKey=true is ONLY used server-side for model invocation.
   */
  public static async getCredential(
    userId: string,
    includeRawKey = false
  ): Promise<UserAICredentialRecord | null> {
    if (!userId) return null;

    try {
      const { data, error } = await supabaseAdmin
        .from('user_ai_credentials')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        let rawKey: string | undefined;
        if (includeRawKey && data.encrypted_api_key && data.iv && data.tag) {
          try {
            rawKey = decryptApiKey(data.encrypted_api_key, data.iv, data.tag);
          } catch (decErr) {
            console.error('Failed to decrypt user API key:', decErr);
          }
        }

        return {
          userId: data.user_id,
          provider: data.provider || 'groq',
          selectedModel: data.selected_model || 'llama-3.3-70b-versatile',
          hasKey: Boolean(data.encrypted_api_key),
          updatedAt: data.updated_at,
          rawApiKey: rawKey,
        };
      }
    } catch {
      // Fallback to in-memory map
    }

    const mem = memoryCredentials.get(userId);
    if (mem) {
      let rawKey: string | undefined;
      if (includeRawKey) {
        try {
          rawKey = decryptApiKey(mem.encrypted, mem.iv, mem.tag);
        } catch {}
      }
      return {
        userId: mem.userId,
        provider: mem.provider,
        selectedModel: mem.selectedModel,
        hasKey: true,
        updatedAt: mem.updatedAt,
        rawApiKey: rawKey,
      };
    }

    return null;
  }

  /**
   * Save or update encrypted user AI credentials.
   */
  public static async saveCredential(
    userId: string,
    provider: 'groq' | 'openai' | 'anthropic',
    apiKey: string,
    selectedModel?: string
  ): Promise<void> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      throw new Error('API key cannot be empty');
    }

    const model = selectedModel || (provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile');
    const { ciphertext, iv, tag } = encryptApiKey(trimmedKey);
    const now = new Date().toISOString();

    // Store in-memory
    memoryCredentials.set(userId, {
      userId,
      provider,
      selectedModel: model,
      encrypted: ciphertext,
      iv,
      tag,
      updatedAt: now,
    });

    try {
      await supabaseAdmin.from('user_ai_credentials').upsert(
        {
          user_id: userId,
          provider,
          encrypted_api_key: ciphertext,
          iv,
          tag,
          selected_model: model,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      );
    } catch (dbErr: any) {
      console.warn('⚠️ Saved credential to memory fallback; database upsert failed:', dbErr?.message);
    }
  }

  /**
   * Delete personal AI credentials for a user.
   */
  public static async deleteCredential(userId: string): Promise<void> {
    memoryCredentials.delete(userId);
    try {
      await supabaseAdmin.from('user_ai_credentials').delete().eq('user_id', userId);
    } catch {}
  }

  /**
   * Test connection with a provided key or user's stored key.
   */
  public static async testConnection(
    provider: 'groq' | 'openai' | 'anthropic',
    apiKey: string,
    model?: string
  ): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = performance.now();
    const testModel = model || (provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.1-8b-instant');

    try {
      if (provider === 'groq') {
        const client = new Groq({ apiKey });
        await client.chat.completions.create({
          model: testModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        });
        const latency = Math.round(performance.now() - start);
        return { success: true, latencyMs: latency };
      }

      if (provider === 'openai') {
        const client = new OpenAI({ apiKey });
        await client.chat.completions.create({
          model: testModel,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        });
        const latency = Math.round(performance.now() - start);
        return { success: true, latencyMs: latency };
      }

      if (provider === 'anthropic') {
        // Direct ping endpoint validation for Anthropic
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-haiku-20241022',
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Ping' }],
          }),
        });

        if (!resp.ok) {
          const errData: any = await resp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Anthropic HTTP ${resp.status}`);
        }
        const latency = Math.round(performance.now() - start);
        return { success: true, latencyMs: latency };
      }

      throw new Error(`Unsupported AI provider: ${provider}`);
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: err?.message || 'Connection test failed',
      };
    }
  }
}
