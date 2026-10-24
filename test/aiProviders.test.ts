import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateCustomEndpoint } from '../src/server/services/aiProviders/ssrfValidator.js';
import { getAllProvidersMetadata, getProviderMetadata } from '../src/server/services/aiProviders/providerMetadata.js';
import { AIProviderService } from '../src/server/services/aiProviders/providerService.js';
import { encryptApiKey, decryptApiKey } from '../src/server/services/aiCredentialService.js';

describe('AI Provider Architecture & Security Suite', () => {
  // 1. All 10 Providers Registered with Verified Configurations
  it('1. Verifies all 10 AI providers are registered with metadata and defaults', () => {
    const providers = getAllProvidersMetadata();
    assert.strictEqual(providers.length, 10, 'Must have exactly 10 supported providers');

    const expectedIds = [
      'groq',
      'openai',
      'anthropic',
      'gemini',
      'openrouter',
      'deepseek',
      'mistral',
      'xai',
      'together',
      'custom',
    ];

    for (const id of expectedIds) {
      const meta = getProviderMetadata(id);
      assert.ok(meta, `Provider ${id} must exist`);
      assert.strictEqual(meta.id, id);
      assert.ok(meta.name.length > 0);
      assert.ok(meta.defaultEndpoint.length > 0);
      // Ensure decommissioned model is not default
      assert.notStrictEqual(meta.defaultModel, 'llama-3.1-70b-versatile');
    }
  });

  // 2. SSRF Validation & Boundary Enforcement
  it('2. Enforces SSRF boundary checks on custom endpoints', () => {
    // Prohibited Cloud Metadata Endpoints
    assert.strictEqual(validateCustomEndpoint('http://169.254.169.254/latest/meta-data').valid, false);
    assert.strictEqual(validateCustomEndpoint('https://169.254.169.254/v1').valid, false);
    assert.strictEqual(validateCustomEndpoint('http://metadata.google.internal/computeMetadata/v1').valid, false);

    // Prohibited Private Subnets (non-localhost)
    assert.strictEqual(validateCustomEndpoint('https://10.0.0.5:8000/v1').valid, false);
    assert.strictEqual(validateCustomEndpoint('https://192.168.1.100/v1').valid, false);
    assert.strictEqual(validateCustomEndpoint('https://172.20.0.1/v1').valid, false);

    // Prohibited Plain HTTP on Remote Hosts
    assert.strictEqual(validateCustomEndpoint('http://api.remote-llm.com/v1').valid, false);

    // Prohibited Internal Service Ports
    assert.strictEqual(validateCustomEndpoint('https://api.example.com:5432/v1').valid, false);
    assert.strictEqual(validateCustomEndpoint('https://api.example.com:6379/v1').valid, false);
    assert.strictEqual(validateCustomEndpoint('https://api.example.com:22/v1').valid, false);

    // Permitted Localhost & 127.0.0.1 for local runners (Ollama / vLLM)
    const localOllama = validateCustomEndpoint('http://localhost:11434/v1');
    assert.strictEqual(localOllama.valid, true);
    assert.strictEqual(localOllama.cleanUrl, 'http://localhost:11434/v1');

    const local127 = validateCustomEndpoint('http://127.0.0.1:8000/v1/');
    assert.strictEqual(local127.valid, true);
    assert.strictEqual(local127.cleanUrl, 'http://127.0.0.1:8000/v1');

    // Permitted Remote HTTPS
    const remoteHttps = validateCustomEndpoint('https://api.openai.com/v1/');
    assert.strictEqual(remoteHttps.valid, true);
    assert.strictEqual(remoteHttps.cleanUrl, 'https://api.openai.com/v1');
  });

  // 3. Error Normalization: Decommissioned Model Detection & Fix Guidance
  it('3. Normalizes decommissioned model errors with actionable guidance', () => {
    const decommissionedErr = new Error(
      'The model `llama-3.1-70b-versatile` has been decommissioned and is no longer supported.'
    );
    const normalized = AIProviderService.normalizeError(
      decommissionedErr,
      'groq',
      'llama-3.1-70b-versatile'
    );

    assert.strictEqual(normalized.isDecommissioned, true);
    assert.strictEqual(normalized.status, 400);
    assert.ok(normalized.message.includes('decommissioned'));
    assert.ok(normalized.message.includes('llama-3.3-70b-versatile'));
  });

  // 4. Error Normalization: Auth, Rate Limit, Not Found
  it('4. Correctly normalizes auth (401), rate limits (429), and not found (404)', () => {
    const authErr = { status: 401, message: 'Incorrect API key provided' };
    const authNorm = AIProviderService.normalizeError(authErr, 'openai', 'gpt-4o');
    assert.strictEqual(authNorm.status, 401);
    assert.ok(authNorm.message.includes('Authentication failed'));

    const rateLimitErr = { status: 429, message: 'Rate limit reached for requests' };
    const rateNorm = AIProviderService.normalizeError(rateLimitErr, 'anthropic', 'claude-3-5-sonnet');
    assert.strictEqual(rateNorm.status, 429);
    assert.ok(rateNorm.message.includes('Rate limit'));

    const notFoundErr = { status: 404, message: 'model_not_found' };
    const notFoundNorm = AIProviderService.normalizeError(notFoundErr, 'groq', 'non-existent-model');
    assert.strictEqual(notFoundNorm.status, 404);
    assert.ok(notFoundNorm.message.includes('was not found'));
  });

  // 5. AES-256-GCM Authenticated Encryption & Decryption
  it('5. Verifies AES-256-GCM authenticated credential encryption and decryption', () => {
    const testSecretKey = 'sk-proj-super-secret-production-api-key-12345';
    const { ciphertext, iv, tag } = encryptApiKey(testSecretKey);

    assert.notStrictEqual(ciphertext, testSecretKey, 'Ciphertext must not be plaintext');
    assert.strictEqual(typeof iv, 'string');
    assert.strictEqual(typeof tag, 'string');

    const decrypted = decryptApiKey(ciphertext, iv, tag);
    assert.strictEqual(decrypted, testSecretKey, 'Decrypted key must match original secret');

    // Tampered tag or ciphertext must throw
    assert.throws(() => {
      decryptApiKey(ciphertext, iv, '00000000000000000000000000000000');
    }, 'Decryption must fail with tampered authentication tag');
  });

  // 6. Native Anthropic Protocol vs OpenAI-compatible Protocol Format
  it('6. Resolves protocol standard accurately per provider', () => {
    const anthropicConfig = AIProviderService.resolveEndpoint({
      provider: 'anthropic',
      apiKey: 'test-key',
    });
    assert.strictEqual(anthropicConfig.protocol, 'anthropic');
    assert.strictEqual(anthropicConfig.baseUrl, 'https://api.anthropic.com');

    const openaiConfig = AIProviderService.resolveEndpoint({
      provider: 'openai',
      apiKey: 'test-key',
    });
    assert.strictEqual(openaiConfig.protocol, 'openai');
    assert.strictEqual(openaiConfig.baseUrl, 'https://api.openai.com/v1');

    const customAnthropic = AIProviderService.resolveEndpoint({
      provider: 'custom',
      apiKey: 'test-key',
      apiEndpoint: 'http://localhost:8000/v1',
      customProtocol: 'anthropic',
    });
    assert.strictEqual(customAnthropic.protocol, 'anthropic');
    assert.strictEqual(customAnthropic.baseUrl, 'http://localhost:8000/v1');
  });
});
