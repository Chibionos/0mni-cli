import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseToml } from 'toml';
import { DEFAULT_CONFIG, type Config } from './defaults.js';

function readToml(path: string): Partial<Config> | null {
  try {
    const raw = readFileSync(path, 'utf-8');
    return parseToml(raw) as Partial<Config>;
  } catch {
    return null;
  }
}

function findConfigFile(): Partial<Config> | null {
  const localPath = resolve(process.cwd(), '.0mni', 'config.toml');
  const local = readToml(localPath);
  if (local) return local;

  const homePath = join(homedir(), '.config', '0mni', 'config.toml');
  return readToml(homePath);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  ...overrides: (Partial<T> | null | undefined)[]
): T {
  const result = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    for (const key of Object.keys(override) as (keyof T)[]) {
      const val = override[key];
      if (val === undefined) continue;
      if (
        typeof val === 'object' &&
        val !== null &&
        !Array.isArray(val) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          val as Record<string, unknown>,
        ) as T[keyof T];
      } else {
        result[key] = val as T[keyof T];
      }
    }
  }
  return result;
}

export function loadConfig(cliArgs?: Partial<Config>): Config {
  const fileConfig = findConfigFile();
  return deepMerge(DEFAULT_CONFIG, fileConfig, cliArgs);
}
