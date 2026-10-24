import type {
  AIProviderType,
  AIProviderProtocol,
  ProviderModelInfo,
  ProviderMetadata,
} from '../../../types/index.js';

export type {
  AIProviderType,
  AIProviderProtocol,
  ProviderModelInfo,
  ProviderMetadata,
};

export interface ProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
  apiEndpoint?: string;
  customProviderName?: string;
  customProtocol?: AIProviderProtocol;
}

export interface AICompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface NormalizedAIError {
  status: number | string;
  message: string;
  code?: string;
  isDecommissioned?: boolean;
  suggestedModel?: string;
}

export interface UserAICredentialRecord {
  userId: string;
  provider: AIProviderType;
  selectedModel: string;
  hasKey: boolean;
  updatedAt?: string;
  apiEndpoint?: string;
  customProviderName?: string;
  customProtocol?: AIProviderProtocol;
  rawApiKey?: string;
}
