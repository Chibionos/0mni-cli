import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { error as logError, debug } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

async function runSkillsCli(args: string[]): Promise<string> {
  debug(`Running: npx skills ${args.join(' ')}`);
  try {
    const { stdout } = await execFileAsync('npx', ['skills', ...args], {
      timeout: 60_000,
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    logError(`skills CLI failed: ${message}`);
    throw new Error(`skills CLI command failed: npx skills ${args.join(' ')}\n${message}`);
  }
}

export async function installSkill(packageRef: string): Promise<void> {
  await runSkillsCli(['add', packageRef]);
}

export async function removeSkill(name: string): Promise<void> {
  await runSkillsCli(['remove', name]);
}

export async function listInstalledSkills(): Promise<string> {
  return runSkillsCli(['list']);
}
