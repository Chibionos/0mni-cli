import { execSync } from 'node:child_process';
import type { Provider } from './defaults.js';

/** Maps each provider to the CLI binary name used to check availability */
const PROVIDER_CLI: Record<Provider, string> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
};

/**
 * Checks if a CLI binary is available on the system PATH.
 */
function cliExists(bin: string): boolean {
  try {
    execSync(`command -v ${bin}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the list of providers whose CLI tools are installed.
 */
export function getAvailableProviders(): Provider[] {
  return (Object.keys(PROVIDER_CLI) as Provider[]).filter((p) =>
    cliExists(PROVIDER_CLI[p]),
  );
}

/**
 * Throws if the CLI for the given provider is not installed.
 */
export function validateCLI(provider: Provider): void {
  const bin = PROVIDER_CLI[provider];
  if (cliExists(bin)) return;
  throw new Error(
    `CLI "${bin}" not found. Install the ${provider} CLI to use this provider.`,
  );
}
