import type { Provider } from './defaults.js';

const PROVIDER_ENV_KEYS: Record<Provider, string[]> = {
  claude: ['ANTHROPIC_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
};

function getKey(provider: Provider): string | undefined {
  for (const key of PROVIDER_ENV_KEYS[provider]) {
    const val = process.env[key];
    if (val) return val;
  }
  return undefined;
}

export function getAvailableProviders(): Provider[] {
  return (Object.keys(PROVIDER_ENV_KEYS) as Provider[]).filter(
    (p) => getKey(p) !== undefined,
  );
}

export function validateAuth(provider: Provider): void {
  if (getKey(provider)) return;

  const keys = PROVIDER_ENV_KEYS[provider];
  const keyList = keys.join(' or ');
  throw new Error(
    `No API key found for ${provider}. Set ${keyList} in your environment.`,
  );
}
