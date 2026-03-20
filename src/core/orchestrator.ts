import { createInterface } from 'readline';
import type { ChildProcess } from 'child_process';
import type { Provider } from '../config/defaults.js';
import { getCLIProvider } from './providers.js';
import type { ConversationContext } from './context.js';
import type { StreamEvent } from './providers.js';

export interface OrchestratorCallbacks {
  onInit?: (model: string, sessionId: string) => void;
  onText?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
  onThinking?: (text: string) => void;
  onFinish?: (usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd?: number;
  }) => void;
  onError?: (error: Error) => void;
}

export interface OrchestratorOptions {
  provider: Provider;
  model?: string;
  context: ConversationContext;
  maxTurns?: number;
  yolo?: boolean;
  callbacks: OrchestratorCallbacks;
}

let activeProcess: ChildProcess | null = null;

/**
 * Kill the currently running CLI subprocess, if any.
 * Safe to call at any time (e.g. from a Ctrl+C handler).
 */
export function killAgent(): void {
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM');

    // Force-kill after a short grace period
    const pid = activeProcess.pid;
    setTimeout(() => {
      try {
        if (pid) process.kill(pid, 0); // check alive
        activeProcess?.kill('SIGKILL');
      } catch {
        // already dead -- ignore
      }
    }, 500);

    activeProcess = null;
  }
}

/**
 * Run an agent by spawning the actual CLI (claude, gemini, codex) as a
 * subprocess, streaming its JSON output line-by-line, and dispatching
 * parsed events to the provided callbacks.
 *
 * Returns the accumulated text response once the process exits.
 */
export async function runAgent(
  prompt: string,
  options: OrchestratorOptions,
): Promise<string> {
  const {
    provider,
    model,
    context,
    maxTurns,
    yolo,
    callbacks,
  } = options;

  const {
    onInit,
    onText,
    onToolCall,
    onToolResult,
    onThinking,
    onFinish,
    onError,
  } = callbacks;

  // Record the user message in our local context
  context.addUserMessage(prompt);

  const cliProvider = getCLIProvider(provider);

  // Spawn the CLI subprocess
  const child = cliProvider.spawn(prompt, {
    model,
    maxTurns,
    yolo,
  });

  activeProcess = child;

  let fullText = '';

  return new Promise<string>((resolve, reject) => {
    // ---- stdout: line-by-line JSON event parsing ----
    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });

      rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let event: StreamEvent | null = null;
        try {
          event = cliProvider.parseEvent(trimmed);
        } catch {
          // Unparseable line -- skip silently
          return;
        }

        if (!event) return;

        dispatch(event);
      });
    }

    // ---- stderr: non-JSON logs from the CLI ----
    if (child.stderr) {
      const stderrRl = createInterface({ input: child.stderr });

      stderrRl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Some CLIs emit progress info on stderr -- only forward genuine
        // errors (lines that look intentional) via the onError callback.
        if (
          /error|exception|fatal|panic|traceback/i.test(trimmed) &&
          !/debug|trace|info|warn/i.test(trimmed)
        ) {
          onError?.(new Error(`[${cliProvider.name} stderr] ${trimmed}`));
        }
      });
    }

    // ---- process lifecycle ----
    child.on('error', (err: Error) => {
      activeProcess = null;
      onError?.(err);
      reject(err);
    });

    child.on('close', (code: number | null, signal: string | null) => {
      activeProcess = null;

      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        // Killed intentionally via killAgent()
        onError?.(new Error('Agent was stopped.'));
        resolve(fullText);
        return;
      }

      if (code !== null && code !== 0) {
        const err = new Error(
          `${cliProvider.name} exited with code ${code}`,
        );
        onError?.(err);
        reject(err);
        return;
      }

      // Successful exit -- persist the response in context
      context.addAssistantMessage(fullText, provider, model ?? provider);
      resolve(fullText);
    });

    // ---- event dispatcher ----
    function dispatch(event: StreamEvent): void {
      switch (event.type) {
        case 'init':
          if (event.model && event.sessionId) {
            onInit?.(event.model, event.sessionId);
          }
          break;

        case 'text':
          if (event.content) {
            fullText += event.content;
            onText?.(event.content);
          }
          break;

        case 'thinking':
          if (event.content) {
            onThinking?.(event.content);
          }
          break;

        case 'tool_call':
          if (event.toolName) {
            onToolCall?.(event.toolName, event.toolArgs ?? {});
          }
          break;

        case 'tool_result':
          if (event.toolName) {
            onToolResult?.(event.toolName, event.toolResult ?? '');
          }
          break;

        case 'result':
          if (event.content) {
            fullText += event.content;
            onText?.(event.content);
          }
          if (event.usage) {
            onFinish?.(event.usage);
          }
          break;

        case 'error':
          onError?.(
            new Error(event.content ?? 'Unknown error from CLI provider'),
          );
          break;
      }
    }
  });
}
