import { spawn, execSync, type ChildProcess } from 'node:child_process';
import type { Provider } from '../config/defaults.js';

// ---------------------------------------------------------------------------
// Stream event types emitted by all providers
// ---------------------------------------------------------------------------

export interface StreamEvent {
  type: 'init' | 'text' | 'tool_call' | 'tool_result' | 'error' | 'result' | 'thinking';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  model?: string;
  sessionId?: string;
  usage?: { inputTokens: number; outputTokens: number; costUsd?: number };
}

// ---------------------------------------------------------------------------
// Provider interface & spawn options
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  cwd?: string;
  model?: string;
  yolo?: boolean; // auto-approve tools
  maxTurns?: number;
}

export interface CLIProvider {
  name: string;
  spawn(prompt: string, options: SpawnOptions): ChildProcess;
  parseEvent(line: string): StreamEvent | null;
}

// ---------------------------------------------------------------------------
// Model catalogue
// ---------------------------------------------------------------------------

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  claude: [
    'claude-sonnet-4-6',
    'claude-opus-4-6',
    'claude-haiku-4-5',
    'sonnet',
    'opus',
    'haiku',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'auto-gemini-2.5',
  ],
  codex: [
    'gpt-5.4',
    'codex-mini-latest',
    'o3',
    'o4-mini',
  ],
};

// ---------------------------------------------------------------------------
// Claude CLI provider
// ---------------------------------------------------------------------------

const claudeProvider: CLIProvider = {
  name: 'claude',

  spawn(prompt: string, options: SpawnOptions): ChildProcess {
    const args: string[] = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
    ];

    if (options.yolo) {
      args.push('--dangerously-skip-permissions');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    return spawn('claude', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  },

  parseEvent(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return null;
    }

    // Init event: {"type":"system","subtype":"init",...}
    if (data.type === 'system' && data.subtype === 'init') {
      return {
        type: 'init',
        model: data.model as string | undefined,
        sessionId: data.session_id as string | undefined,
      };
    }

    // Result event: {"type":"result","subtype":"success",...}
    if (data.type === 'result') {
      const usage = data.usage as Record<string, number> | undefined;
      return {
        type: 'result',
        content: data.result as string | undefined,
        usage: usage
          ? {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              costUsd: data.total_cost_usd as number | undefined,
            }
          : undefined,
      };
    }

    // Assistant message events
    if (data.type === 'assistant') {
      const message = data.message as Record<string, unknown> | undefined;
      const contentBlocks = message?.content as Array<Record<string, unknown>> | undefined;
      if (!contentBlocks || !Array.isArray(contentBlocks)) return null;

      // Process each content block — return the first meaningful event
      for (const block of contentBlocks) {
        if (block.type === 'text' && typeof block.text === 'string') {
          return { type: 'text', content: block.text };
        }

        if (block.type === 'tool_use') {
          return {
            type: 'tool_call',
            toolName: block.name as string,
            toolArgs: (block.input as Record<string, unknown>) ?? {},
          };
        }

        if (block.type === 'tool_result') {
          return {
            type: 'tool_result',
            toolName: block.tool_use_id as string | undefined,
            toolResult: typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content),
          };
        }

        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          return { type: 'thinking', content: block.thinking };
        }
      }
    }

    return null;
  },
};

// ---------------------------------------------------------------------------
// Gemini CLI provider
// ---------------------------------------------------------------------------

const geminiProvider: CLIProvider = {
  name: 'gemini',

  spawn(prompt: string, options: SpawnOptions): ChildProcess {
    const args: string[] = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
    ];

    if (options.yolo) {
      args.push('--yolo');
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    return spawn('gemini', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  },

  parseEvent(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return null;
    }

    if (data.type === 'init') {
      return {
        type: 'init',
        model: data.model as string | undefined,
        sessionId: data.session_id as string | undefined,
      };
    }

    if (data.type === 'message' && data.role === 'assistant') {
      return {
        type: 'text',
        content: data.content as string | undefined,
      };
    }

    if (data.type === 'tool_call') {
      return {
        type: 'tool_call',
        toolName: data.name as string | undefined,
        toolArgs: (data.args as Record<string, unknown>) ?? {},
      };
    }

    if (data.type === 'tool_result') {
      return {
        type: 'tool_result',
        toolName: data.name as string | undefined,
        toolResult: data.output as string | undefined,
      };
    }

    if (data.type === 'result') {
      const stats = data.stats as Record<string, unknown> | undefined;
      return {
        type: 'result',
        content: data.response as string | undefined,
        usage: stats
          ? {
              inputTokens: (stats.input_tokens as number) ?? 0,
              outputTokens: (stats.output_tokens as number) ?? 0,
              costUsd: stats.cost_usd as number | undefined,
            }
          : undefined,
      };
    }

    return null;
  },
};

// ---------------------------------------------------------------------------
// Codex CLI provider
// ---------------------------------------------------------------------------

const codexProvider: CLIProvider = {
  name: 'codex',

  spawn(prompt: string, options: SpawnOptions): ChildProcess {
    const args: string[] = ['exec', prompt, '--json'];

    if (options.model) {
      args.push('-m', options.model);
    }

    if (options.yolo) {
      args.push('-c', 'approval_policy=never');
    }

    return spawn('codex', args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
  },

  parseEvent(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return null;
    }

    if (data.type === 'thread.started') {
      return {
        type: 'init',
        sessionId: data.thread_id as string | undefined,
      };
    }

    if (data.type === 'item.completed') {
      const item = data.item as Record<string, unknown> | undefined;
      if (!item) return null;

      if (item.type === 'agent_message') {
        return {
          type: 'text',
          content: item.text as string | undefined,
        };
      }

      if (item.type === 'tool_call') {
        return {
          type: 'tool_call',
          toolName: item.name as string | undefined,
          toolArgs: (item.arguments as Record<string, unknown>) ?? {},
        };
      }

      if (item.type === 'tool_output') {
        return {
          type: 'tool_result',
          toolName: item.name as string | undefined,
          toolResult: item.output as string | undefined,
        };
      }
    }

    if (data.type === 'turn.completed') {
      const usage = data.usage as Record<string, number> | undefined;
      return {
        type: 'result',
        usage: usage
          ? {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              costUsd: usage.cost_usd,
            }
          : undefined,
      };
    }

    return null;
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const providers: Record<Provider, CLIProvider> = {
  claude: claudeProvider,
  gemini: geminiProvider,
  codex: codexProvider,
};

export function getProvider(name: Provider): CLIProvider {
  const p = providers[name];
  if (!p) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return p;
}

/** Alias used by the orchestrator */
export const getCLIProvider = getProvider;

/**
 * Check which provider CLIs are installed and available on PATH.
 */
export function getAvailableProviders(): Provider[] {
  const all: Provider[] = ['claude', 'gemini', 'codex'];
  return all.filter((name) => {
    try {
      execSync(`which ${name}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  });
}
