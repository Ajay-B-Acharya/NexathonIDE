import crypto from 'crypto';
import { supabaseAdmin } from '../supabase.js';
import { AIProviderService } from './aiProviders/providerService.js';
import { getProviderMetadata } from './aiProviders/providerMetadata.js';
import type {
  AIProviderType,
  AIProviderProtocol,
  UserAICredentialRecord,
} from './aiProviders/types.js';

export type { UserAICredentialRecord };

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
  provider: AIProviderType;
  selectedModel: string;
  apiEndpoint?: string;
  customProviderName?: string;
  customProtocol?: AIProviderProtocol;
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

        let model = data.selected_model || getProviderMetadata(data.provider || 'groq').defaultModel;
        // Auto-migrate decommissioned Groq model
        if (model === 'llama-3.1-70b-versatile') {
          model = 'llama-3.3-70b-versatile';
        }

        return {
          userId: data.user_id,
          provider: (data.provider as AIProviderType) || 'groq',
          selectedModel: model,
          hasKey: Boolean(data.encrypted_api_key),
          apiEndpoint: data.api_endpoint || undefined,
          customProviderName: data.custom_provider_name || undefined,
          customProtocol: data.custom_protocol || undefined,
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

      let model = mem.selectedModel || getProviderMetadata(mem.provider).defaultModel;
      if (model === 'llama-3.1-70b-versatile') {
        model = 'llama-3.3-70b-versatile';
      }

      return {
        userId: mem.userId,
        provider: mem.provider,
        selectedModel: model,
        hasKey: true,
        apiEndpoint: mem.apiEndpoint,
        customProviderName: mem.customProviderName,
        customProtocol: mem.customProtocol,
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
    provider: AIProviderType,
    apiKey: string,
    selectedModel?: string,
    extra?: {
      apiEndpoint?: string;
      customProviderName?: string;
      customProtocol?: AIProviderProtocol;
    }
  ): Promise<void> {
    const trimmedKey = apiKey ? apiKey.trim() : '';
    // Custom providers might not require an API key if local
    if (!trimmedKey && provider !== 'custom') {
      throw new Error('API key cannot be empty');
    }

    const meta = getProviderMetadata(provider);
    let model = selectedModel?.trim() || meta.defaultModel;
    if (model === 'llama-3.1-70b-versatile') {
      model = 'llama-3.3-70b-versatile';
    }

    const { ciphertext, iv, tag } = encryptApiKey(trimmedKey || 'NO_KEY_SPECIFIED');
    const now = new Date().toISOString();

    // Store in-memory
    memoryCredentials.set(userId, {
      userId,
      provider,
      selectedModel: model,
      apiEndpoint: extra?.apiEndpoint,
      customProviderName: extra?.customProviderName,
      customProtocol: extra?.customProtocol,
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
          api_endpoint: extra?.apiEndpoint || null,
          custom_provider_name: extra?.customProviderName || null,
          custom_protocol: extra?.customProtocol || 'openai',
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
    provider: AIProviderType,
    apiKey: string,
    model?: string,
    extra?: {
      apiEndpoint?: string;
      customProtocol?: AIProviderProtocol;
    }
  ): Promise<{ success: boolean; latencyMs: number; error?: string; modelUsed?: string }> {
    return AIProviderService.testConnection({
      provider,
      apiKey,
      model,
      apiEndpoint: extra?.apiEndpoint,
      customProtocol: extra?.customProtocol,
    });
  }
}
