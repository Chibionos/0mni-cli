import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { DEFAULT_CONFIG, type Provider } from '../config/defaults.js';

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  claude: [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-sonnet-4-20250514',
    'claude-haiku-3-5-20241022',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
  ],
  openai: [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o3-mini',
  ],
};

const providerFactory = {
  claude: (model: string) => anthropic(model),
  gemini: (model: string) => google(model),
  openai: (model: string) => openai(model),
} as const;

export function getModel(provider: Provider, modelName?: string) {
  const model = modelName ?? DEFAULT_CONFIG.models[provider];
  return providerFactory[provider](model);
}

export function getDefaultModel(provider: Provider) {
  return getModel(provider, DEFAULT_CONFIG.models[provider]);
}
