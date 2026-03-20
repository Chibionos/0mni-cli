import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { access, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';

export function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return resolve(homedir(), path.slice(2));
  return path;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(expandHome(path));
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(expandHome(dir), { recursive: true });
}

export function getProjectRoot(): string {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return root;
  } catch {
    return process.cwd();
  }
}
