import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  Cpu,
  Lock,
  Eye,
  EyeOff,
  Zap,
  ExternalLink,
  RefreshCw,
  Server,
  Code2,
} from 'lucide-react';
import { aiAgentApi } from '../services/aiAgentApi';
import type {
  AIProviderType,
  AIProviderProtocol,
  UserAICredential,
  ProviderModelInfo,
} from '../types';

interface AIAgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSettingsSaved?: () => void;
}

interface ProviderOption {
  id: AIProviderType;
  label: string;
  tag: string;
  description: string;
  defaultModel: string;
  defaultEndpoint: string;
  defaultProtocol: AIProviderProtocol;
  keyUrl: string;
  docsUrl: string;
  keyPlaceholder: string;
  models: ProviderModelInfo[];
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'groq',
    label: 'Groq',
    tag: 'Ultra-Fast LPU',
    description: 'Ultra-fast LPU inference for Llama 3.3, Qwen 2.5, and DeepSeek distilled models',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultEndpoint: 'https://api.groq.com/openai/v1',
    defaultProtocol: 'openai',
    keyUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs',
    keyPlaceholder: 'gsk_...',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Top Quality' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', tag: 'Fastest' },
      { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', tag: 'Code & Math' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', tag: 'Reasoning' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', tag: 'Long Context' },
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', tag: 'Direct Lab' },
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', tag: 'Direct Lab' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', tag: 'Direct Lab' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    tag: 'GPT-4o & o1',
    description: 'Direct GPT-4o, o1, and o3-mini models via official OpenAI API',
    defaultModel: 'gpt-4o-mini',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultProtocol: 'openai',
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
    keyPlaceholder: 'sk-proj-...',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & Affordable' },
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Flagship Intelligence' },
      { id: 'o3-mini', name: 'o3-mini', tag: 'Fast Reasoning' },
      { id: 'o1', name: 'o1', tag: 'Deep Reasoning' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'Reliable' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    tag: 'Claude 3.5',
    description: 'Claude 3.5 Sonnet and Haiku via native Anthropic messages protocol',
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultProtocol: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
    keyPlaceholder: 'sk-ant-api03-...',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Elite Coding' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Ultra-Fast' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', tag: 'Deep Analysis' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    tag: 'Google AI',
    description: 'Gemini 2.0 Flash and 1.5 Pro multimodal models via Google AI Studio',
    defaultModel: 'gemini-2.0-flash',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultProtocol: 'openai',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    keyPlaceholder: 'AIzaSy...',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tag: 'Next-Gen Speed' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: '2M Context' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Balanced' },
      { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite', tag: 'Lightweight' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    tag: 'Multi-Model',
    description: 'Unified aggregator providing 200+ models from Claude, OpenAI, Meta, and DeepSeek',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultProtocol: 'openai',
    keyUrl: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/docs',
    keyPlaceholder: 'sk-or-v1-...',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Top Tier' },
      { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', tag: 'Versatile' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', tag: 'High Performance' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tag: 'Reasoning' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tag: 'Open Weights' },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', tag: 'Free Tier' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    tag: 'V3 & R1',
    description: 'Official DeepSeek V3 and DeepSeek R1 reasoning models',
    defaultModel: 'deepseek-chat',
    defaultEndpoint: 'https://api.deepseek.com',
    defaultProtocol: 'openai',
    keyUrl: 'https://platform.deepseek.com/',
    docsUrl: 'https://api-docs.deepseek.com',
    keyPlaceholder: 'sk-...',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)', tag: 'General & Coding' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', tag: 'Deep Reasoning' },
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    tag: 'Codestral',
    description: 'European frontier models including Codestral and Mistral Large',
    defaultModel: 'codestral-latest',
    defaultEndpoint: 'https://api.mistral.ai/v1',
    defaultProtocol: 'openai',
    keyUrl: 'https://console.mistral.ai',
    docsUrl: 'https://docs.mistral.ai',
    keyPlaceholder: '...',
    models: [
      { id: 'codestral-latest', name: 'Codestral Latest', tag: 'Code Specialist' },
      { id: 'mistral-large-latest', name: 'Mistral Large', tag: 'Flagship' },
      { id: 'mistral-small-latest', name: 'Mistral Small', tag: 'Fast' },
      { id: 'pixtral-large-latest', name: 'Pixtral Large', tag: 'Multimodal' },
    ],
  },
  {
    id: 'xai',
    label: 'xAI',
    tag: 'Grok 2',
    description: 'Grok 2 and Grok Beta models from xAI with high reasoning capabilities',
    defaultModel: 'grok-2-latest',
    defaultEndpoint: 'https://api.xai.com/v1',
    defaultProtocol: 'openai',
    keyUrl: 'https://console.xai.com',
    docsUrl: 'https://docs.x.ai',
    keyPlaceholder: 'xai-...',
    models: [
      { id: 'grok-2-latest', name: 'Grok 2 Latest', tag: 'Flagship' },
      { id: 'grok-2', name: 'Grok 2', tag: 'Stable' },
      { id: 'grok-beta', name: 'Grok Beta', tag: 'Fast' },
    ],
  },
  {
    id: 'together',
    label: 'Together AI',
    tag: 'Cloud Turbo',
    description: 'Inference platform for high-throughput open-source coding models',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    defaultEndpoint: 'https://api.together.xyz/v1',
    defaultProtocol: 'openai',
    keyUrl: 'https://api.together.ai',
    docsUrl: 'https://docs.together.ai',
    keyPlaceholder: '...',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', tag: 'Top Quality' },
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', tag: 'Fast & Smart' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', tag: 'Reasoning' },
      { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen 2.5 Coder 32B', tag: 'Code Specialist' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    tag: 'Self-Hosted / URL',
    description: 'Connect to any OpenAI or Anthropic-compatible server (vLLM, Ollama, LocalAI, etc.)',
    defaultModel: 'default',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultProtocol: 'openai',
    keyUrl: '',
    docsUrl: '',
    keyPlaceholder: 'API key (optional for local Ollama)',
    models: [],
  },
];

export const AIAgentSettingsModal: React.FC<AIAgentSettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSettingsSaved,
}) => {
  const [provider, setProvider] = useState<AIProviderType>('groq');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [isManualModel, setIsManualModel] = useState(false);
  const [manualModelInput, setManualModelInput] = useState('');

  // Custom Provider Fields
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customProviderName, setCustomProviderName] = useState('');
  const [customProtocol, setCustomProtocol] = useState<AIProviderProtocol>('openai');

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const [availableModels, setAvailableModels] = useState<ProviderModelInfo[]>([]);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    error?: string;
    modelUsed?: string;
  } | null>(null);
  const [currentCredential, setCurrentCredential] = useState<UserAICredential | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeProvider = PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0];

  // Initialize available models list for current provider
  useEffect(() => {
    setAvailableModels(activeProvider.models);
  }, [provider]);

  // Load current personal settings on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setTestResult(null);
    setStatusMessage(null);

    aiAgentApi
      .getSettings(userId)
      .then((data) => {
        if (!isMounted) return;
        setCurrentCredential(data);

        if (data.provider) {
          setProvider(data.provider);
          const found = PROVIDER_OPTIONS.find((p) => p.id === data.provider);
          if (found) {
            setAvailableModels(found.models);
          }
        }

        // Handle decommissioned model migration gracefully
        let model = data.selectedModel || 'llama-3.3-70b-versatile';
        if (model === 'llama-3.1-70b-versatile') {
          model = 'llama-3.3-70b-versatile';
          setStatusMessage('Notice: llama-3.1-70b-versatile was decommissioned by Groq. Auto-migrated to Llama 3.3 70B.');
        }

        setSelectedModel(model);

        // Check if selected model is known or custom
        const isKnown = activeProvider.models.some((m) => m.id === model);
        if (!isKnown && model && model !== activeProvider.defaultModel) {
          setIsManualModel(true);
          setManualModelInput(model);
        } else {
          setIsManualModel(false);
        }

        if (data.apiEndpoint) setCustomEndpoint(data.apiEndpoint);
        if (data.customProviderName) setCustomProviderName(data.customProviderName);
        if (data.customProtocol) setCustomProtocol(data.customProtocol);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  // Handle provider switch
  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    const opt = PROVIDER_OPTIONS.find((p) => p.id === newProvider);
    if (opt) {
      setAvailableModels(opt.models);
      setSelectedModel(opt.defaultModel);
      setIsManualModel(false);
      setManualModelInput('');
      if (newProvider === 'custom' && !customEndpoint) {
        setCustomEndpoint(opt.defaultEndpoint);
      }
    }
    setTestResult(null);
    setStatusMessage(null);
  };

  // Live model discovery from provider
  const handleFetchLiveModels = async () => {
    setIsFetchingModels(true);
    setTestResult(null);
    setStatusMessage(null);
    try {
      const fetched = await aiAgentApi.getModels(
        {
          provider,
          apiKey: apiKey.trim() || undefined,
          endpoint: provider === 'custom' ? customEndpoint.trim() : undefined,
          protocol: provider === 'custom' ? customProtocol : undefined,
        },
        userId
      );

      if (fetched && fetched.length > 0) {
        setAvailableModels(fetched);
        setStatusMessage(`Successfully discovered ${fetched.length} models from ${activeProvider.label}.`);
        if (!fetched.some((m) => m.id === selectedModel)) {
          setSelectedModel(fetched[0].id);
        }
      } else {
        setStatusMessage(`No additional models returned. Displaying standard curated models.`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: `Model discovery failed: ${err?.message || 'Check endpoint or API key'}`,
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setStatusMessage(null);

    const effectiveModel = isManualModel ? manualModelInput.trim() : selectedModel;

    try {
      const result = await aiAgentApi.testConnection(
        {
          provider,
          apiKey: apiKey.trim() || undefined,
          model: effectiveModel,
          apiEndpoint: provider === 'custom' ? customEndpoint.trim() : undefined,
          customProtocol: provider === 'custom' ? customProtocol : undefined,
        },
        userId
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim() && !currentCredential?.hasKey && provider !== 'custom') {
      setTestResult({ success: false, error: 'Please enter a valid API key for this provider' });
      return;
    }

    if (provider === 'custom' && !customEndpoint.trim()) {
      setTestResult({ success: false, error: 'Please enter an API base URL for your custom provider' });
      return;
    }

    const effectiveModel = isManualModel ? manualModelInput.trim() : selectedModel;
    if (!effectiveModel) {
      setTestResult({ success: false, error: 'Please select or enter a model identifier' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setTestResult(null);

    try {
      await aiAgentApi.saveSettings(
        {
          provider,
          apiKey: apiKey.trim() || undefined,
          selectedModel: effectiveModel,
          apiEndpoint: provider === 'custom' ? customEndpoint.trim() : undefined,
          customProviderName: provider === 'custom' ? customProviderName.trim() : undefined,
          customProtocol: provider === 'custom' ? customProtocol : undefined,
        },
        userId
      );

      setStatusMessage('Credentials encrypted and settings saved successfully.');
      setApiKey('');
      const updated = await aiAgentApi.getSettings(userId);
      setCurrentCredential(updated);
      onSettingsSaved?.();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete credentials
  const handleDeleteCredentials = async () => {
    if (!confirm(`Are you sure you want to remove your saved credentials for ${activeProvider.label}?`)) return;
    setIsLoading(true);
    try {
      await aiAgentApi.deleteSettings(userId);
      setCurrentCredential(null);
      setApiKey('');
      setStatusMessage('Personal API credentials removed.');
      onSettingsSaved?.();
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Failed to delete' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-xl rounded-2xl border theme-border theme-bg-surface-1 p-6 neu-card shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b theme-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF7057] text-white neu-button">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold theme-text-primary font-heading">
                AI Provider Settings
              </h3>
              <p className="text-xs theme-text-muted">
                Private personal provider & model configuration for @{userId || 'developer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 theme-text-muted hover:theme-text-primary transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Security Privacy Notice */}
        <div className="rounded-xl border theme-border theme-bg-surface-2 p-3 text-xs theme-text-secondary flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="theme-text-primary">Private AI Assistant:</strong> Your API key is stored server-side encrypted with AES-256-GCM. Collaborators in this room cannot see your credentials, conversations, or settings. Shared code is only modified when you approve proposals.
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 theme-text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF7057]" />
            <span className="text-xs font-mono">Loading provider settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Provider Selector Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold theme-text-primary">
                  Select AI Provider (10 Supported)
                </label>
                {activeProvider.keyUrl && (
                  <a
                    href={activeProvider.keyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#FF7057] hover:underline"
                  >
                    <span>Get {activeProvider.label} API Key</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {PROVIDER_OPTIONS.map((opt) => {
                  const isSelected = opt.id === provider;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleProviderChange(opt.id)}
                      className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[58px] ${
                        isSelected
                          ? 'border-[#FF7057] bg-[#FF7057] text-white neu-button shadow-xs'
                          : 'theme-border theme-bg-surface-2 theme-text-secondary hover:theme-text-primary hover:border-[#FF7057]/40'
                      }`}
                    >
                      <span className="text-xs font-bold leading-tight truncate">{opt.label}</span>
                      <span
                        className={`text-[9px] font-mono leading-tight truncate ${
                          isSelected ? 'text-white/90' : 'theme-text-muted'
                        }`}
                      >
                        {opt.tag}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-1.5 text-[11px] theme-text-muted leading-relaxed">
                {activeProvider.description}
              </p>
            </div>

            {/* Custom Provider Configuration (if custom selected) */}
            {provider === 'custom' && (
              <div className="space-y-3 rounded-xl border theme-border theme-bg-surface-2 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold theme-text-primary">
                  <Server className="h-3.5 w-3.5 text-[#FF7057]" />
                  <span>Custom Provider Configuration</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium theme-text-secondary mb-1">
                      Provider Name
                    </label>
                    <input
                      type="text"
                      value={customProviderName}
                      onChange={(e) => setCustomProviderName(e.target.value)}
                      placeholder="e.g. Local Ollama, vLLM Server"
                      className="w-full rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs theme-text-primary focus:border-[#FF7057] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium theme-text-secondary mb-1">
                      Protocol Standard
                    </label>
                    <select
                      value={customProtocol}
                      onChange={(e) => setCustomProtocol(e.target.value as AIProviderProtocol)}
                      className="w-full rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs theme-text-primary focus:border-[#FF7057] focus:outline-none"
                    >
                      <option value="openai">OpenAI Compatible (v1/chat/completions)</option>
                      <option value="anthropic">Anthropic Messages Protocol (v1/messages)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium theme-text-secondary mb-1">
                    API Base URL (SSRF Protected)
                  </label>
                  <input
                    type="url"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/v1 or https://my-llm.example.com/v1"
                    className="w-full rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs font-mono theme-text-primary focus:border-[#FF7057] focus:outline-none"
                  />
                  <span className="block mt-1 text-[10px] theme-text-muted">
                    Remote URLs must use HTTPS. Plain HTTP is only permitted for localhost or 127.0.0.1.
                  </span>
                </div>
              </div>
            )}

            {/* Model Architecture Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-[#FF7057]" />
                  <span>Model Identifier</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFetchLiveModels}
                    disabled={isFetchingModels}
                    className="inline-flex items-center gap-1 text-[11px] text-[#FF7057] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
                    <span>Discover Models</span>
                  </button>
                  <span className="text-theme-border">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualModel(!isManualModel);
                      if (!isManualModel && !manualModelInput) {
                        setManualModelInput(selectedModel);
                      }
                    }}
                    className="text-[11px] text-[#FF7057] hover:underline cursor-pointer"
                  >
                    {isManualModel ? 'Choose from list' : 'Custom model ID'}
                  </button>
                </div>
              </div>

              {isManualModel || availableModels.length === 0 ? (
                <div>
                  <input
                    type="text"
                    value={manualModelInput}
                    onChange={(e) => setManualModelInput(e.target.value)}
                    placeholder="Enter model ID (e.g. qwen2.5-coder:7b or deepseek-chat)"
                    className="w-full rounded-xl border theme-border theme-bg-surface-2 px-3 py-2 text-xs font-mono theme-text-primary focus:border-[#FF7057] focus:outline-none"
                  />
                  <span className="block mt-1 text-[10px] theme-text-muted">
                    Custom ID will be sent directly in the provider request.
                  </span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-xl border theme-border theme-bg-surface-2 px-3 py-2 text-xs font-mono theme-text-primary focus:border-[#FF7057] focus:outline-none appearance-none cursor-pointer"
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id} className="theme-bg-surface-1">
                        {m.name || m.id} {m.tag ? `— (${m.tag})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold theme-text-primary flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-[#FF7057]" />
                  <span>{activeProvider.label} API Key</span>
                </label>
                {currentCredential?.hasKey && currentCredential.provider === provider && (
                  <span className="text-[10px] font-mono text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="h-3 w-3" /> Encrypted Key Stored
                  </span>
                )}
              </div>

              <div className="flex items-center rounded-xl border theme-border theme-bg-surface-2 focus-within:border-[#FF7057] px-3 py-2">
                <Lock className="h-4 w-4 theme-text-muted mr-2 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    currentCredential?.hasKey && currentCredential.provider === provider
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep existing key)'
                      : `Enter ${activeProvider.label} API Key (${activeProvider.keyPlaceholder})`
                  }
                  className="w-full bg-transparent font-mono text-xs theme-text-primary focus:outline-none placeholder:text-[var(--text-muted)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="theme-text-muted hover:theme-text-primary cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <p className="mt-1 text-[10px] theme-text-muted">
                Note: Usage will be billed directly to your {activeProvider.label} account according to their pricing.
              </p>
            </div>

            {/* Connection Test & Feedback */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || (!apiKey.trim() && !currentCredential?.hasKey && provider !== 'custom')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border theme-border theme-bg-surface-2 text-xs font-medium theme-text-secondary hover:theme-text-primary transition cursor-pointer disabled:opacity-50 neu-button"
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF7057]" />
                ) : (
                  <Zap className="h-3.5 w-3.5 text-[#FF7057]" />
                )}
                <span>Test Connection</span>
              </button>

              {testResult && (
                <div
                  className={`text-xs font-mono flex items-center gap-1.5 ${
                    testResult.success ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {testResult.success ? (
                    <>
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Success: Connected to {activeProvider.label} ({testResult.latencyMs}ms RTT)
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-xs" title={testResult.error}>
                        {testResult.error}
                      </span>
                    </>
                  )}
                </div>
              )}

              {statusMessage && (
                <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t theme-border pt-4 mt-2">
              {currentCredential?.hasKey ? (
                <button
                  type="button"
                  onClick={handleDeleteCredentials}
                  className="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 transition cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Stored Key</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border theme-border hover:theme-bg-surface-2 text-xs font-semibold theme-text-secondary hover:theme-text-primary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-[#FF7057] hover:bg-[#F26049] text-white text-xs font-semibold flex items-center gap-1.5 neu-button transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Encrypting...</span>
                    </>
                  ) : (
                    <span>Save Settings</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
