import { validateCustomEndpoint } from './ssrfValidator.js';
import { getProviderMetadata, PROVIDER_REGISTRY } from './providerMetadata.js';
import type {
  ProviderConfig,
  AICompletionMessage,
  AICompletionOptions,
  ProviderModelInfo,
  NormalizedAIError,
  AIProviderType,
  AIProviderProtocol,
} from './types.js';

export class AIProviderService {
  /**
   * Normalizes any provider or network error into a structured, user-friendly message.
   */
  public static normalizeError(
    err: any,
    provider: AIProviderType,
    model?: string
  ): NormalizedAIError {
    const meta = getProviderMetadata(provider);
    const rawMsg = String(err?.message || err || '');
    const status = err?.status || err?.statusCode || (rawMsg.includes('401') ? 401 : rawMsg.includes('404') ? 404 : rawMsg.includes('429') ? 429 : 500);

    // 1. Detect decommissioned model error (e.g. llama-3.1-70b-versatile)
    if (
      rawMsg.includes('model_decommissioned') ||
      rawMsg.includes('decommissioned') ||
      (model && model.includes('llama-3.1-70b-versatile'))
    ) {
      return {
        status: 400,
        code: 'model_decommissioned',
        isDecommissioned: true,
        suggestedModel: 'llama-3.3-70b-versatile',
        message: `The model "${model || 'llama-3.1-70b-versatile'}" has been decommissioned by ${meta.name} and is no longer available. Please select a supported model such as "llama-3.3-70b-versatile" or "llama-3.1-8b-instant" in AI Provider Settings.`,
      };
    }

    // 2. Authentication failure (401 / 403)
    if (status === 401 || status === 403 || rawMsg.includes('invalid_api_key') || rawMsg.includes('Unauthorized')) {
      return {
        status,
        code: 'invalid_api_key',
        message: `Authentication failed for ${meta.name}. Please check that your API key is valid and has not expired.`,
      };
    }

    // 3. Model not found or not accessible on this account (404)
    if (status === 404 || rawMsg.includes('model_not_found') || rawMsg.includes('does not exist')) {
      return {
        status: 404,
        code: 'model_not_found',
        message: `The model "${model}" was not found or is not enabled for your ${meta.name} account. Please select an available model from the list in AI Settings.`,
      };
    }

    // 4. Rate limit or quota exceeded (429)
    if (status === 429 || rawMsg.includes('rate_limit') || rawMsg.includes('quota')) {
      return {
        status: 429,
        code: 'rate_limit_exceeded',
        message: `Rate limit or quota exceeded with ${meta.name}. Please wait a moment or check your account usage and billing at ${meta.keyManagementUrl || 'the provider dashboard'}.`,
      };
    }

    // 5. Billing or credit required
    if (rawMsg.includes('billing') || rawMsg.includes('insufficient_quota')) {
      return {
        status: 402,
        code: 'insufficient_quota',
        message: `Insufficient billing quota or credits with ${meta.name}. Please verify your billing configuration at ${meta.keyManagementUrl}.`,
      };
    }

    // 6. Security / SSRF violations
    if (rawMsg.includes('Security Policy:') || rawMsg.includes('SSRF')) {
      return {
        status: 400,
        code: 'security_violation',
        message: rawMsg,
      };
    }

    // 7. Network / connection timeout
    if (
      rawMsg.includes('ECONNREFUSED') ||
      rawMsg.includes('ENOTFOUND') ||
      rawMsg.includes('timeout') ||
      rawMsg.includes('fetch failed')
    ) {
      return {
        status: 504,
        code: 'network_timeout',
        message: `Network connection failed or timed out while reaching ${meta.name}. Please verify your internet connection or the endpoint URL.`,
      };
    }

    // Default normalized error
    return {
      status,
      message: `AI Provider Error (${meta.name}): ${rawMsg}`,
    };
  }

  /**
   * Resolves and validates the effective base URL and protocol for a provider config.
   */
  public static resolveEndpoint(config: ProviderConfig): {
    baseUrl: string;
    protocol: AIProviderProtocol;
  } {
    const meta = getProviderMetadata(config.provider);
    let rawUrl = config.apiEndpoint?.trim() || meta.defaultEndpoint;
    let protocol = config.customProtocol || meta.defaultProtocol;

    if (config.provider === 'custom' || config.apiEndpoint) {
      const validation = validateCustomEndpoint(rawUrl);
      if (!validation.valid || !validation.cleanUrl) {
        throw new Error(validation.error || 'Invalid API endpoint URL');
      }
      rawUrl = validation.cleanUrl;
    }

    return {
      baseUrl: rawUrl.replace(/\/+$/, ''),
      protocol,
    };
  }

  /**
   * Discovers and lists available models for a provider using their API key and endpoint.
   */
  public static async listModels(config: ProviderConfig): Promise<ProviderModelInfo[]> {
    const meta = getProviderMetadata(config.provider);
    const { baseUrl, protocol } = this.resolveEndpoint(config);

    try {
      // 1. Anthropic native models endpoint
      if (config.provider === 'anthropic' || protocol === 'anthropic') {
        const resp = await fetch(`${baseUrl}/v1/models`, {
          method: 'GET',
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
          },
        });

        if (resp.ok) {
          const data: any = await resp.json();
          if (Array.isArray(data?.data)) {
            return data.data.map((m: any) => ({
              id: m.id,
              name: m.display_name || m.id,
              tag: m.id.includes('sonnet') ? 'Elite' : m.id.includes('haiku') ? 'Fast' : 'Stable',
            }));
          }
        }
        return meta.popularModels;
      }

      // 2. Google Gemini native models endpoint
      if (config.provider === 'gemini') {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
        const resp = await fetch(geminiUrl);
        if (resp.ok) {
          const data: any = await resp.json();
          if (Array.isArray(data?.models)) {
            const chatModels = data.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => {
                const id = m.name.replace(/^models\//, '');
                return {
                  id,
                  name: m.displayName || id,
                  tag: id.includes('flash') ? 'Fast' : id.includes('pro') ? 'Elite' : 'General',
                };
              });
            if (chatModels.length > 0) return chatModels;
          }
        }
      }

      // 3. OpenAI-compatible /models endpoint (OpenAI, Groq, OpenRouter, DeepSeek, Mistral, xAI, Together, Custom)
      const modelsEndpoint = `${baseUrl}/models`;
      const resp = await fetch(modelsEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          ...(config.provider === 'openrouter'
            ? {
                'HTTP-Referer': 'https://nexathonide.dev',
                'X-Title': 'NexathonIDE',
              }
            : {}),
        },
      });

      if (resp.ok) {
        const data: any = await resp.json();
        const rawList = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (rawList.length > 0) {
          // Filter to conversational/text generation models
          const filtered = rawList
            .map((m: any) => ({
              id: typeof m === 'string' ? m : m.id || m.name,
              name: typeof m === 'string' ? m : m.name || m.id,
              contextLimit: m.context_length || m.max_context_length,
            }))
            .filter((m: any) => {
              const id = m.id.toLowerCase();
              // Exclude embedding, audio, tts, vision-only, moderation models
              return (
                !id.includes('embed') &&
                !id.includes('whisper') &&
                !id.includes('tts') &&
                !id.includes('moderation') &&
                !id.includes('dall-e')
              );
            });

          if (filtered.length > 0) {
            return filtered;
          }
        }
      }

      // If remote discovery wasn't successful, fall back to curated popular models
      return meta.popularModels;
    } catch {
      // In case of network error or unsupported endpoint, gracefully return curated models
      return meta.popularModels;
    }
  }

  /**
   * Tests connection to the provider using the specified key and model.
   */
  public static async testConnection(
    config: ProviderConfig
  ): Promise<{ success: boolean; latencyMs: number; error?: string; modelUsed?: string }> {
    const start = performance.now();
    const meta = getProviderMetadata(config.provider);
    const modelToUse = config.model?.trim() || meta.defaultModel;

    try {
      if (!config.apiKey && config.provider !== 'custom') {
        throw new Error('API key is required to test connection');
      }

      await this.generateCompletion(
        {
          ...config,
          model: modelToUse,
        },
        [{ role: 'user', content: 'Ping' }],
        { maxTokens: 5 }
      );

      const latencyMs = Math.round(performance.now() - start);
      return {
        success: true,
        latencyMs,
        modelUsed: modelToUse,
      };
    } catch (err: any) {
      const normalized = this.normalizeError(err, config.provider, modelToUse);
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        error: normalized.message,
        modelUsed: modelToUse,
      };
    }
  }

  /**
   * Generates a completion from the configured AI provider.
   */
  public static async generateCompletion(
    config: ProviderConfig,
    messages: AICompletionMessage[],
    options?: AICompletionOptions
  ): Promise<string> {
    const meta = getProviderMetadata(config.provider);
    const { baseUrl, protocol } = this.resolveEndpoint(config);
    const model = config.model?.trim() || meta.defaultModel;

    // Fail early if user passed decommissioned model
    if (model === 'llama-3.1-70b-versatile') {
      const normalized = this.normalizeError(
        new Error('model_decommissioned'),
        config.provider,
        model
      );
      throw new Error(normalized.message);
    }

    // 1. Anthropic Native Protocol
    if (protocol === 'anthropic' || config.provider === 'anthropic') {
      const systemMessage = messages.find((m) => m.role === 'system')?.content;
      const conversationMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      // Ensure at least one user message
      if (conversationMessages.length === 0) {
        conversationMessages.push({ role: 'user', content: 'Hello' });
      }

      const resp = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: systemMessage,
          max_tokens: options?.maxTokens ?? 3500,
          temperature: options?.temperature ?? 0.2,
          messages: conversationMessages,
        }),
      });

      if (!resp.ok) {
        const errJson: any = await resp.json().catch(() => ({}));
        const rawErr = errJson?.error?.message || `Anthropic HTTP ${resp.status}`;
        throw new Error(rawErr);
      }

      const result: any = await resp.json();
      return (
        result?.content
          ?.filter((c: any) => c.type === 'text')
          ?.map((c: any) => c.text)
          ?.join('') || ''
      );
    }

    // 2. OpenAI-Compatible Protocol (OpenAI, Groq, Gemini OpenAI, OpenRouter, DeepSeek, Mistral, xAI, Together, Custom)
    const chatEndpoint = `${baseUrl}/chat/completions`;
    const resp = await fetch(chatEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.provider === 'openrouter'
          ? {
              'HTTP-Referer': 'https://nexathonide.dev',
              'X-Title': 'NexathonIDE',
            }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 3500,
      }),
    });

    if (!resp.ok) {
      const errJson: any = await resp.json().catch(() => ({}));
      const rawErr = errJson?.error?.message || errJson?.message || `Provider HTTP ${resp.status}`;
      throw new Error(rawErr);
    }

    const result: any = await resp.json();
    return result?.choices?.[0]?.message?.content || '';
  }
}
