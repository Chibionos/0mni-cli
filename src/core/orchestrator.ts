import { createInterface, type Interface as ReadlineInterface } from 'readline';
import type { ChildProcess } from 'child_process';
import type { Provider } from '../config/defaults.js';
import { getCLIProvider } from './providers.js';
import type { ConversationContext } from './context.js';
import type { StreamEvent } from './providers.js';

// ---------------------------------------------------------------------------
// Callbacks — unchanged public interface
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface OrchestratorOptions {
  provider: Provider;
  model?: string;
  context: ConversationContext;
  maxTurns?: number;
  yolo?: boolean;
  callbacks: OrchestratorCallbacks;
}

// ---------------------------------------------------------------------------
// Module-level state for persistent / per-turn sessions
// ---------------------------------------------------------------------------

let activeProcess: ChildProcess | null = null;
let activeSessionId: string | null = null;
let activeProvider: Provider | null = null;
// activePersistent tracking is implicit — check activeProcess + provider.persistent

/** Readline interface for persistent mode (created once per persistent process). */
let persistentRl: ReadlineInterface | null = null;

/**
 * Resolve function for the current in-flight persistent turn.
 * Set before sending a message, cleared when a `result` event arrives.
 */
let resultResolve: ((value: string) => void) | null = null;

/**
 * Reject function for the current in-flight persistent turn.
 * Used if the persistent process dies unexpectedly mid-turn.
 */
let resultReject: ((reason: Error) => void) | null = null;

/** Accumulated text for the current turn (reset per runAgent call). */
let turnText = '';

/** Latest callbacks reference — updated every runAgent call so the
 *  persistent reader always dispatches to the current set of callbacks. */
let activeCallbacks: OrchestratorCallbacks = {};

// ---------------------------------------------------------------------------
// killAgent
// ---------------------------------------------------------------------------

/**
 * Kill the currently running CLI subprocess, if any.
 * Safe to call at any time (e.g. from a Ctrl+C handler).
 * Works for both persistent and per-turn modes.
 */
export function killAgent(): void {
  // Close the persistent readline if it exists
  if (persistentRl) {
    persistentRl.close();
    persistentRl = null;
  }

  // Reject any in-flight turn promise so the caller isn't left hanging
  if (resultReject) {
    resultReject(new Error('Agent was stopped.'));
    resultResolve = null;
    resultReject = null;
  }

  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM');

    // Force-kill after a short grace period
    const pid = activeProcess.pid;
    setTimeout(() => {
      try {
        if (pid) process.kill(pid, 0); // check alive
        activeProcess?.kill('SIGKILL');
      } catch {
        // already dead — ignore
      }
    }, 500);
  }

  activeProcess = null;
  activeSessionId = null;
  activeProvider = null;
  turnText = '';
}

// ---------------------------------------------------------------------------
// Event dispatcher (shared between both modes)
// ---------------------------------------------------------------------------

function dispatch(event: StreamEvent, callbacks: OrchestratorCallbacks): void {
  switch (event.type) {
    case 'init':
      if (event.sessionId) {
        activeSessionId = event.sessionId;
      }
      if (event.model && event.sessionId) {
        callbacks.onInit?.(event.model, event.sessionId);
      }
      break;

    case 'text':
      if (event.content) {
        turnText += event.content;
        callbacks.onText?.(event.content);
      }
      break;

    case 'thinking':
      if (event.content) {
        callbacks.onThinking?.(event.content);
      }
      break;

    case 'tool_call':
      if (event.toolName) {
        callbacks.onToolCall?.(event.toolName, event.toolArgs ?? {});
      }
      break;

    case 'tool_result':
      if (event.toolName) {
        callbacks.onToolResult?.(event.toolName, event.toolResult ?? '');
      }
      break;

    case 'result':
      if (event.usage) {
        callbacks.onFinish?.(event.usage);
      }
      break;

    case 'error':
      callbacks.onError?.(
        new Error(event.content ?? 'Unknown error from CLI provider'),
      );
      break;
  }
}

// ---------------------------------------------------------------------------
// Persistent-mode helpers
// ---------------------------------------------------------------------------

/**
 * Set up a readline listener on the persistent child's stdout.
 * Created once per persistent process lifetime.  Events are dispatched to
 * whatever `activeCallbacks` points at, so the caller that is currently
 * awaiting the result always gets the events.
 */
function setupPersistentReader(
  child: ChildProcess,
  provider: ReturnType<typeof getCLIProvider>,
): void {
  if (!child.stdout) return;

  persistentRl = createInterface({ input: child.stdout });

  persistentRl.on('line', (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let events: StreamEvent[] = [];
    try {
      events = provider.parseEvents(trimmed);
    } catch {
      return;
    }

    for (const event of events) {
      dispatch(event, activeCallbacks);

      // A `result` event means this turn is complete — resolve the promise
      if (event.type === 'result' && resultResolve) {
        const text = turnText;
        resultResolve(text);
        resultResolve = null;
        resultReject = null;
      }
    }
  });

  // If the persistent process dies, reject any in-flight turn
  child.on('close', (_code: number | null, signal: string | null) => {
    // Clean up readline
    if (persistentRl) {
      persistentRl.close();
      persistentRl = null;
    }

    if (resultReject) {
      const reason =
        signal === 'SIGTERM' || signal === 'SIGKILL'
          ? new Error('Agent was stopped.')
          : new Error(`Persistent process exited unexpectedly (signal: ${signal ?? 'none'})`);
      activeCallbacks.onError?.(reason);
      resultReject(reason);
      resultResolve = null;
      resultReject = null;
    }

    activeProcess = null;
    activeSessionId = null;
    activeProvider = null;
  });

  child.on('error', (err: Error) => {
    if (resultReject) {
      activeCallbacks.onError?.(err);
      resultReject(err);
      resultResolve = null;
      resultReject = null;
    }
    activeProcess = null;
    activeSessionId = null;
    activeProvider = null;
  });

  // Forward genuine stderr errors
  if (child.stderr) {
    const stderrRl = createInterface({ input: child.stderr });
    stderrRl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (
        /error|exception|fatal|panic|traceback/i.test(trimmed) &&
        !/debug|trace|info|warn/i.test(trimmed)
      ) {
        activeCallbacks.onError?.(
          new Error(`[${provider.name} stderr] ${trimmed}`),
        );
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Per-turn mode helper
// ---------------------------------------------------------------------------

/**
 * Spawn a new process for a single turn, read stdout until the process exits,
 * then resolve with the accumulated text.
 */
function readUntilExit(
  child: ChildProcess,
  provider: ReturnType<typeof getCLIProvider>,
  options: OrchestratorOptions,
): Promise<string> {
  const { context, callbacks } = options;

  return new Promise<string>((resolve, reject) => {
    // ---- stdout: line-by-line JSON event parsing ----
    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });

      rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let events: StreamEvent[] = [];
        try {
          events = provider.parseEvents(trimmed);
        } catch {
          return;
        }

        for (const event of events) {
          dispatch(event, callbacks);
        }
      });
    }

    // ---- stderr: non-JSON logs from the CLI ----
    if (child.stderr) {
      const stderrRl = createInterface({ input: child.stderr });

      stderrRl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (
          /error|exception|fatal|panic|traceback/i.test(trimmed) &&
          !/debug|trace|info|warn/i.test(trimmed)
        ) {
          callbacks.onError?.(
            new Error(`[${provider.name} stderr] ${trimmed}`),
          );
        }
      });
    }

    // ---- process lifecycle ----
    child.on('error', (err: Error) => {
      activeProcess = null;
      callbacks.onError?.(err);
      reject(err);
    });

    child.on('close', (code: number | null, signal: string | null) => {
      activeProcess = null;

      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        callbacks.onError?.(new Error('Agent was stopped.'));
        resolve(turnText);
        return;
      }

      if (code !== null && code !== 0) {
        const err = new Error(`${provider.name} exited with code ${code}`);
        callbacks.onError?.(err);
        reject(err);
        return;
      }

      // Successful exit — persist the response in context
      context.addAssistantMessage(
        turnText,
        options.provider,
        options.model ?? options.provider,
      );
      resolve(turnText);
    });
  });
}

// ---------------------------------------------------------------------------
// runAgent — public entry point (multi-turn aware)
// ---------------------------------------------------------------------------

/**
 * Run a single turn of conversation.
 *
 * **Persistent providers** (e.g. Claude): the subprocess stays alive across
 * turns. On the first call the process is spawned via `spawnPersistent()`;
 * subsequent calls reuse it and send messages via `sendMessage()`. The
 * promise resolves when a `result` event is received.
 *
 * **Per-turn providers** (e.g. Gemini, Codex): a new subprocess is spawned
 * for every call via `spawnTurn()`. The sessionId from the init event is
 * carried forward automatically so the provider can resume context.
 *
 * Returns the accumulated text response for this turn.
 */
export async function runAgent(
  prompt: string,
  options: OrchestratorOptions,
): Promise<string> {
  const { provider, context, callbacks } = options;

  // Record the user message in our local context
  context.addUserMessage(prompt);

  const cliProvider = getCLIProvider(provider);

  // Reset per-turn text accumulator
  turnText = '';

  // Update the active callbacks reference so persistent readers dispatch
  // to the correct set of callbacks for this turn.
  activeCallbacks = callbacks;

  // Build spawn options from orchestrator options
  const spawnOpts = {
    model: options.model,
    maxTurns: options.maxTurns,
    yolo: options.yolo,
  };

  // ------------------------------------------------------------------
  // Persistent mode (e.g. Claude)
  // ------------------------------------------------------------------
  if (cliProvider.persistent) {
    // If we have an existing process but for a different provider, tear it down
    if (activeProcess && !activeProcess.killed && activeProvider !== provider) {
      killAgent();
    }

    // Spawn persistent process if needed
    if (!activeProcess || activeProcess.killed) {
      const child = cliProvider.spawnPersistent!(spawnOpts);
      activeProcess = child;
      activeProvider = provider;
      activeSessionId = null;

      setupPersistentReader(child, cliProvider);
    }

    // Send the message and wait for the result event
    return new Promise<string>((resolve, reject) => {
      resultResolve = (text: string) => {
        context.addAssistantMessage(text, provider, options.model ?? provider);
        resolve(text);
      };
      resultReject = reject;

      cliProvider.sendMessage!(
        activeProcess!,
        prompt,
        activeSessionId ?? 'default',
      );
    });
  }

  // ------------------------------------------------------------------
  // Per-turn mode (e.g. Gemini, Codex)
  // ------------------------------------------------------------------

  // Kill any prior per-turn process that may still be around
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM');
    activeProcess = null;
  }

  const child = cliProvider.spawnTurn!(prompt, {
    ...spawnOpts,
    sessionId: activeSessionId ?? undefined,
  });

  activeProcess = child;
  activeProvider = provider;

  return readUntilExit(child, cliProvider, options);
}
