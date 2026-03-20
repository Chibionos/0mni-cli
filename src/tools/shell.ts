import { tool } from 'ai';
import { z } from 'zod';
import { execSync } from 'child_process';

export const requiresConfirmation = true;

export const shellExecTool = tool({
  description:
    'Execute a shell command and return its output. Use this for running build commands, ' +
    'git operations, package management, and other CLI tasks. Commands run in the current ' +
    'working directory.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z
      .number()
      .int()
      .min(1000)
      .max(600000)
      .optional()
      .describe('Timeout in milliseconds. Defaults to 30000 (30 seconds). Max 600000 (10 min).'),
  }),
  execute: async ({ command, timeout }) => {
    const timeoutMs = timeout ?? 30000;

    try {
      const result = execSync(command, {
        timeout: timeoutMs,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024, // 10 MB
        shell: '/bin/sh',
      });

      return result || '(command completed with no output)';
    } catch (err: unknown) {
      // execSync throws on non-zero exit code — still return useful info
      if (err && typeof err === 'object' && 'status' in err) {
        const execErr = err as {
          status: number | null;
          stdout?: string;
          stderr?: string;
          message?: string;
        };

        const parts: string[] = [];

        if (execErr.status !== null) {
          parts.push(`Exit code: ${execErr.status}`);
        }

        if (execErr.stdout) {
          parts.push(`stdout:\n${execErr.stdout}`);
        }

        if (execErr.stderr) {
          parts.push(`stderr:\n${execErr.stderr}`);
        }

        if (parts.length === 0 && execErr.message) {
          parts.push(execErr.message);
        }

        return parts.join('\n\n') || 'Command failed with no output';
      }

      const msg = err instanceof Error ? err.message : String(err);
      return `Error executing command: ${msg}`;
    }
  },
});
