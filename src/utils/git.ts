import { execSync } from 'node:child_process';

function gitExec(command: string): string | null {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

export function isGitRepo(): boolean {
  return gitExec('git rev-parse --is-inside-work-tree') === 'true';
}

export function getGitRoot(): string | null {
  return gitExec('git rev-parse --show-toplevel');
}

export function getCurrentBranch(): string | null {
  return gitExec('git rev-parse --abbrev-ref HEAD');
}
