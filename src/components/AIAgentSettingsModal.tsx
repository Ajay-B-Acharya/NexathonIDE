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
} from 'lucide-react';
import { aiAgentApi } from '../services/aiAgentApi';
import type { AIProviderType, UserAICredential } from '../types';

interface AIAgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onSettingsSaved?: () => void;
}

const PROVIDER_OPTIONS: Array<{
  id: AIProviderType;
  label: string;
  description: string;
  defaultModel: string;
  models: Array<{ id: string; name: string; tag: string }>;
}> = [
  {
    id: 'groq',
    label: 'Groq (Recommended)',
    description: 'Ultra-fast LPU inference with Llama 3.3 and Mixtral',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Top Quality' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', tag: 'Fastest' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', tag: 'Reliable' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', tag: 'Large Context' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'Direct GPT-4o models with your OpenAI API key',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & Efficient' },
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Flagship' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude 3.5 Sonnet / Haiku intelligence',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Fast' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Elite Code' },
    ],
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
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [currentCredential, setCurrentCredential] = useState<UserAICredential | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
        if (data.provider && (data.provider === 'groq' || data.provider === 'openai' || data.provider === 'anthropic')) {
          setProvider(data.provider);
        }
        if (data.selectedModel) {
          setSelectedModel(data.selectedModel);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  // Update selected model when provider changes if needed
  const handleProviderChange = (newProvider: AIProviderType) => {
    setProvider(newProvider);
    const opt = PROVIDER_OPTIONS.find((p) => p.id === newProvider);
    if (opt) {
      setSelectedModel(opt.defaultModel);
    }
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await aiAgentApi.testConnection(
        {
          provider,
          apiKey: apiKey.trim() || undefined,
          model: selectedModel,
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() && !currentCredential?.hasKey) {
      setTestResult({ success: false, error: 'Please enter a valid API key' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setTestResult(null);

    try {
      await aiAgentApi.saveSettings(
        {
          provider,
          apiKey: apiKey.trim(),
          selectedModel,
        },
        userId
      );

      setStatusMessage('Credentials encrypted and saved successfully.');
      setApiKey('');
      // Refresh current credentials
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

  const handleDeleteCredentials = async () => {
    if (!confirm('Are you sure you want to remove your personal AI key?')) return;
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

  const activeProviderConfig = PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl border theme-border theme-bg-surface-1 p-6 neu-card shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b theme-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF7057] text-white neu-button">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold theme-text-primary font-heading">
                Personal AI Provider Settings
              </h3>
              <p className="text-xs theme-text-muted">
                Private credentials encrypted at rest for @{userId || 'developer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 theme-text-muted hover:theme-text-primary transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Security Isolation Notice */}
        <div className="rounded-xl border theme-border theme-bg-surface-2 p-3 text-xs theme-text-secondary flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="theme-text-primary">Strict Privacy Guarantee:</strong> Your API key is encrypted using AES-256-GCM. Other collaborators in this room cannot access or view your credentials, conversations, or personal AI history.
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 theme-text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF7057]" />
            <span className="text-xs font-mono">Loading configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Provider Selection Tabs */}
            <div>
              <label className="block text-xs font-medium theme-text-secondary mb-1.5">
                AI Inference Provider
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PROVIDER_OPTIONS.map((opt) => {
                  const isSelected = opt.id === provider;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleProviderChange(opt.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center text-center gap-1 transition cursor-pointer ${
                        isSelected
                          ? 'border-[#FF7057] bg-[#FF7057] text-white neu-button shadow-xs'
                          : 'theme-border theme-bg-surface-2 theme-text-secondary hover:theme-text-primary hover:border-[#FF7057]/40'
                      }`}
                    >
                      <span>{opt.label.split(' ')[0]}</span>
                      <span className={`text-[10px] font-normal ${isSelected ? 'text-white/90' : 'theme-text-muted'}`}>
                        {opt.id === 'groq' ? 'Free / Fast' : opt.id === 'openai' ? 'Direct' : 'Anthropic'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs font-medium theme-text-secondary mb-1.5">
                Model Architecture
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-xl border theme-border theme-bg-surface-2 px-3 py-2 text-xs font-mono theme-text-primary focus:border-[#FF7057] focus:outline-none appearance-none cursor-pointer"
                >
                  {activeProviderConfig.models.map((m) => (
                    <option key={m.id} value={m.id} className="theme-bg-surface-1">
                      {m.name} — ({m.tag})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium theme-text-secondary flex items-center gap-1">
                  <Key className="h-3 w-3 text-[#FF7057]" />
                  <span>{activeProviderConfig.label.split(' ')[0]} API Key</span>
                </label>
                {currentCredential?.hasKey && (
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
                    currentCredential?.hasKey
                      ? '•••••••••••••••••••••••••••• (Leave blank to keep current)'
                      : `Enter ${activeProviderConfig.label.split(' ')[0]} API Key (e.g. gsk_...)`
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
            </div>

            {/* Test Connection Button & Result */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || (!apiKey.trim() && !currentCredential?.hasKey)}
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
                      <Check className="h-3.5 w-3.5" />
                      <span>Valid ({testResult.latencyMs}ms RTT)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[200px]" title={testResult.error}>
                        {testResult.error}
                      </span>
                    </>
                  )}
                </div>
              )}

              {statusMessage && (
                <div className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
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
